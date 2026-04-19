import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Campaign, Prospect, Email
from .serializers import CampaignSerializer, ProspectSerializer, EmailSerializer
from .services import gemini, crustdata

logger = logging.getLogger(__name__)


def _extract_email(enriched: dict) -> str:
    if not enriched:
        return ''
    contact = enriched.get('contact', {})
    for key in ('business_emails', 'personal_emails'):
        entries = contact.get(key, [])
        if entries:
            first = entries[0]
            return first.get('email', '') if isinstance(first, dict) else str(first)
    return ''


def _parse_person(person):
    basic = person.get('basic_profile', {})
    name = basic.get('name', '').strip()
    emp = person.get('experience', {}).get('employment_details', {})
    current_list = emp.get('current', []) if isinstance(emp, dict) else []
    past_list = emp.get('past', []) if isinstance(emp, dict) else []
    current_exp = next((e for e in current_list if e.get('is_default')), current_list[0] if current_list else {})
    loc = basic.get('location', {})
    return {
        'name': name,
        'title': current_exp.get('title', '') or basic.get('current_title', ''),
        'company': current_exp.get('name', ''),
        'location': loc.get('raw', '') if isinstance(loc, dict) else str(loc),
        'linkedin_url': person.get('social_handles', {}).get('professional_network_identifier', {}).get('profile_url', ''),
        'profile_picture': basic.get('profile_picture_permalink', '') or '',
        'all_emp': current_list + past_list,
    }


def _process_prospect(person, campaign_id, product_context, tone, sender_name='', sender_designation=''):
    parsed = _parse_person(person)
    name = parsed['name']
    if not name:
        return None

    # Enrich (best-effort, skip if fails)
    enriched = {}
    if parsed['linkedin_url']:
        try:
            enriched = crustdata.enrich_person(linkedin_url=parsed['linkedin_url'])
        except Exception:
            pass

    # Intent detection + email generation run in parallel
    intent_data = {'intent_score': 'LOW', 'signal': '', 'quote': ''}
    sequence = []

    prospect_dict = {
        'name': name, 'title': parsed['title'], 'company': parsed['company'],
        'intent_signal': '', 'employment_history': parsed['all_emp'],
    }

    with ThreadPoolExecutor(max_workers=2) as inner:
        # Intent detection
        def get_intent():
            if not product_context:
                return {'intent_score': 'LOW', 'signal': '', 'quote': ''}
            try:
                web = crustdata.web_search(f"{name} {parsed['company']} {' '.join(product_context.split()[:5])}")
                return gemini.analyze_intent(name, parsed['company'], web, product_context)
            except Exception:
                return {'intent_score': 'LOW', 'signal': '', 'quote': ''}

        # Email sequence generation
        def get_sequence():
            try:
                return gemini.generate_sequence(prospect_dict, product_context, tone, sender_name, sender_designation)
            except Exception:
                return []

        intent_future = inner.submit(get_intent)
        seq_future = inner.submit(get_sequence)
        intent_data = intent_future.result()
        sequence = seq_future.result()

    # Update prospect_dict with intent signal before saving
    prospect_dict['intent_signal'] = intent_data.get('signal', '')

    return {
        'parsed': parsed,
        'enriched': enriched,
        'intent_data': intent_data,
        'sequence': sequence,
    }


class CampaignListView(APIView):
    def get(self, request):
        campaigns = Campaign.objects.all().order_by('-created_at')
        return Response(CampaignSerializer(campaigns, many=True).data)

    def post(self, request):
        serializer = CampaignSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CampaignDetailView(APIView):
    def get(self, request, pk):
        try:
            campaign = Campaign.objects.get(pk=pk)
        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        return Response(CampaignSerializer(campaign).data)

    def delete(self, request, pk):
        try:
            Campaign.objects.get(pk=pk).delete()
        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class RunCampaignView(APIView):
    def post(self, request):
        query = request.data.get('query', '')
        product_context = request.data.get('product_context', '')
        tone = request.data.get('tone', 'casual')
        sender_name = request.data.get('sender_name', '')
        sender_designation = request.data.get('sender_designation', '')
        campaign_name = request.data.get('name', f"Campaign — {query[:40]}")

        if not query:
            return Response({'error': 'query is required'}, status=400)

        # Step 1 — translate query
        try:
            filters = gemini.translate_query_to_filters(query)
        except Exception as e:
            return Response({'error': f'Query translation failed: {str(e)}'}, status=500)

        # Step 2 — company search (best-effort)
        company_names = []
        try:
            companies = crustdata.search_companies(filters)
            company_names = [c.get('basic_info', {}).get('name', '') for c in companies if c]
            company_names = [n for n in company_names if n][:50]
        except Exception as e:
            logger.warning(f"Company search failed: {e}")

        # Step 3 — person search
        try:
            people = crustdata.search_people(filters, company_names)
        except Exception as e:
            return Response({'error': f'Person search failed: {str(e)}'}, status=500)

        if not people:
            return Response({'error': 'No prospects found. Try broadening your search.'}, status=404)

        campaign = Campaign.objects.create(
            name=campaign_name, query=query,
            product_context=product_context, tone=tone,
            sender_name=sender_name, sender_designation=sender_designation,
        )

        # Step 4-6 — process all prospects in parallel (10 workers)
        limit = filters.get('limit', 20)
        results = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {
                executor.submit(_process_prospect, p, campaign.id, product_context, tone, sender_name, sender_designation): p
                for p in people[:limit]
            }
            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        results.append(result)
                except Exception as e:
                    logger.warning(f"Prospect processing failed: {e}")

        # Save to DB (must be in main thread for SQLite)
        prospects_created = []
        for r in results:
            parsed = r['parsed']
            enriched = r['enriched']
            intent_data = r['intent_data']
            sequence = r['sequence']

            prospect = Prospect.objects.create(
                campaign=campaign,
                name=parsed['name'],
                title=parsed['title'],
                company=parsed['company'],
                email=_extract_email(enriched),
                linkedin_url=parsed['linkedin_url'],
                profile_picture=parsed['profile_picture'],
                location=parsed['location'],
                employment_history=parsed['all_emp'],
                skills=enriched.get('skills', []) if enriched else [],
                intent=intent_data['intent_score'].lower(),
                intent_signal=intent_data.get('signal', ''),
                intent_quote=intent_data.get('quote', ''),
                status='draft',
                raw_data={},
            )

            for email_data in sequence:
                Email.objects.create(
                    prospect=prospect,
                    sequence_number=email_data['sequence_number'],
                    subject=email_data.get('subject', ''),
                    body=email_data.get('body', ''),
                    scheduled_day=email_data.get('scheduled_day', 0),
                )

            prospects_created.append(prospect)

        return Response({
            'campaign': CampaignSerializer(campaign).data,
            'filters_used': filters,
            'prospects_found': len(prospects_created),
        }, status=status.HTTP_201_CREATED)


class ProspectListView(APIView):
    def get(self, request, campaign_id):
        prospects = Prospect.objects.filter(campaign_id=campaign_id).order_by('-intent', 'name')
        return Response(ProspectSerializer(prospects, many=True).data)

    def post(self, request, campaign_id):
        try:
            campaign = Campaign.objects.get(pk=campaign_id)
        except Campaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        data = request.data
        prospect = Prospect.objects.create(
            campaign=campaign,
            name=data.get('name', ''),
            title=data.get('title', ''),
            company=data.get('company', ''),
            email=data.get('email', ''),
            linkedin_url=data.get('linkedin_url', ''),
            location=data.get('location', ''),
            intent='low',
            status='draft',
        )

        prospect_dict = {
            'name': prospect.name, 'title': prospect.title,
            'company': prospect.company, 'intent_signal': '',
            'employment_history': [],
        }
        sequence = gemini.generate_sequence(
            prospect_dict, campaign.product_context, campaign.tone,
            campaign.sender_name, campaign.sender_designation,
        )
        for email_data in sequence:
            Email.objects.create(
                prospect=prospect,
                sequence_number=email_data['sequence_number'],
                subject=email_data.get('subject', ''),
                body=email_data.get('body', ''),
                scheduled_day=email_data.get('scheduled_day', 0),
            )

        return Response(ProspectSerializer(prospect).data, status=status.HTTP_201_CREATED)


class ProspectDetailView(APIView):
    def get(self, request, pk):
        try:
            prospect = Prospect.objects.get(pk=pk)
        except Prospect.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        return Response(ProspectSerializer(prospect).data)

    def patch(self, request, pk):
        try:
            prospect = Prospect.objects.get(pk=pk)
        except Prospect.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        serializer = ProspectSerializer(prospect, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        try:
            Prospect.objects.get(pk=pk).delete()
        except Prospect.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmailDetailView(APIView):
    def patch(self, request, pk):
        try:
            email = Email.objects.get(pk=pk)
        except Email.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        serializer = EmailSerializer(email, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class SendEmailView(APIView):
    def post(self, request, email_id):
        import resend
        from django.conf import settings
        resend.api_key = settings.RESEND_API_KEY

        try:
            email_obj = Email.objects.get(pk=email_id)
        except Email.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        prospect = email_obj.prospect
        if not prospect.email:
            return Response({'error': 'Prospect has no email address'}, status=400)

        fallback_email = getattr(settings, 'RESEND_TEST_EMAIL', '')

        def try_send(to, subject):
            resend.Emails.send({
                "from": "ProspectAI <onboarding@resend.dev>",
                "to": [to],
                "subject": subject,
                "text": email_obj.body,
            })

        try:
            try_send(prospect.email, email_obj.subject)
        except Exception as primary_err:
            if fallback_email:
                try:
                    try_send(fallback_email, f"[TEST → {prospect.email}] {email_obj.subject}")
                except Exception as e:
                    return Response({'error': str(e)}, status=500)
            else:
                return Response({'error': str(primary_err)}, status=500)
            email_obj.sent_at = timezone.now()
            email_obj.save()
            prospect.status = 'sent'
            prospect.save()
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class ScrapeUrlView(APIView):
    def post(self, request):
        url = request.data.get('url', '').strip()
        if not url:
            return Response({'error': 'url is required'}, status=400)
        try:
            import requests as req
            resp = req.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
            resp.raise_for_status()
            from html.parser import HTMLParser

            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text = []
                    self._skip = False
                def handle_starttag(self, tag, attrs):
                    if tag in ('script', 'style', 'nav', 'footer'):
                        self._skip = True
                def handle_endtag(self, tag):
                    if tag in ('script', 'style', 'nav', 'footer'):
                        self._skip = False
                def handle_data(self, data):
                    if not self._skip and data.strip():
                        self.text.append(data.strip())

            parser = TextExtractor()
            parser.feed(resp.text)
            raw_text = ' '.join(parser.text)[:4000]
            context = gemini.extract_product_context_from_url_content(url, raw_text)
            return Response({'product_context': context})
        except Exception as e:
            return Response({'error': str(e)}, status=500)


class RegenerateEmailView(APIView):
    def post(self, request, prospect_id):
        try:
            prospect = Prospect.objects.get(pk=prospect_id)
        except Prospect.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        campaign = prospect.campaign
        prospect_dict = {
            'name': prospect.name, 'title': prospect.title,
            'company': prospect.company, 'intent_signal': prospect.intent_signal,
            'employment_history': prospect.employment_history,
        }

        prospect.emails.all().delete()
        sequence = gemini.generate_sequence(prospect_dict, campaign.product_context, campaign.tone,
                                            campaign.sender_name, campaign.sender_designation)
        emails = []
        for email_data in sequence:
            e = Email.objects.create(
                prospect=prospect,
                sequence_number=email_data['sequence_number'],
                subject=email_data.get('subject', ''),
                body=email_data.get('body', ''),
                scheduled_day=email_data.get('scheduled_day', 0),
            )
            emails.append(e)

        return Response(EmailSerializer(emails, many=True).data)
