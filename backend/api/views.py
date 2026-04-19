import logging
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Campaign, Prospect, Email
from .serializers import CampaignSerializer, ProspectSerializer, EmailSerializer
from .services import gemini, crustdata

logger = logging.getLogger(__name__)


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
    """
    Main pipeline: NL query → Crustdata search → enrich → intent → emails
    """
    def post(self, request):
        query = request.data.get('query', '')
        product_context = request.data.get('product_context', '')
        tone = request.data.get('tone', 'casual')
        campaign_name = request.data.get('name', f"Campaign — {query[:40]}")

        if not query:
            return Response({'error': 'query is required'}, status=400)

        # Step 1 — translate NL query to filters
        try:
            filters = gemini.translate_query_to_filters(query)
        except Exception as e:
            logger.error(f"Gemini query translation failed: {e}")
            return Response({'error': f'Query translation failed: {str(e)}'}, status=500)

        # Step 2 — search companies
        company_names = []
        try:
            companies = crustdata.search_companies(filters)
            company_names = [c.get('basic_info', {}).get('name') or c.get('name', '') for c in companies if c]
            company_names = [n for n in company_names if n][:50]
        except Exception as e:
            logger.warning(f"Company search failed (continuing): {e}")

        # Step 3 — search people
        try:
            people = crustdata.search_people(filters, company_names)
        except Exception as e:
            logger.error(f"Person search failed: {e}")
            return Response({'error': f'Person search failed: {str(e)}'}, status=500)

        if not people:
            return Response({'error': 'No prospects found for this query. Try broadening your search.'}, status=404)

        # Create campaign
        campaign = Campaign.objects.create(
            name=campaign_name,
            query=query,
            product_context=product_context,
            tone=tone,
        )

        prospects_created = []

        for person in people[:filters.get('limit', 20)]:
            basic = person.get('basic_profile', {})
            name = basic.get('name', '').strip()
            if not name:
                continue

            # employment_details is {current: [...], past: [...]}
            emp = person.get('experience', {}).get('employment_details', {})
            current_list = emp.get('current', []) if isinstance(emp, dict) else []
            # pick the is_default entry or first
            current_exp = next((e for e in current_list if e.get('is_default')), current_list[0] if current_list else {})

            linkedin_url = person.get('social_handles', {}).get('professional_network_identifier', {}).get('profile_url', '')
            email_addr = ''

            # Step 4 — enrich person
            enriched = {}
            if linkedin_url or email_addr:
                try:
                    enriched = crustdata.enrich_person(linkedin_url=linkedin_url, email=email_addr)
                except Exception as e:
                    logger.warning(f"Enrich failed for {name}: {e}")

            merged = {**person, **enriched}
            final_email = merged.get('email', email_addr) or ''
            title = current_exp.get('title', '') or basic.get('current_title', '')
            company = current_exp.get('name', '')
            location_raw = basic.get('location', {})
            location = location_raw.get('raw', '') if isinstance(location_raw, dict) else str(location_raw)

            # Step 5 — intent detection
            intent_data = {"intent_score": "LOW", "signal": "", "quote": ""}
            if product_context:
                try:
                    web_results = crustdata.web_search(f"{name} {company} {' '.join(product_context.split()[:5])}")
                    intent_data = gemini.analyze_intent(name, company, web_results, product_context)
                except Exception as e:
                    logger.warning(f"Intent detection failed for {name}: {e}")

            all_emp = list(current_list) + emp.get('past', []) if isinstance(emp, dict) else []

            prospect = Prospect.objects.create(
                campaign=campaign,
                name=name,
                title=title,
                company=company,
                email=final_email,
                linkedin_url=linkedin_url,
                location=location,
                employment_history=all_emp,
                skills=merged.get('skills', []),
                intent=intent_data['intent_score'].lower(),
                intent_signal=intent_data.get('signal', ''),
                intent_quote=intent_data.get('quote', ''),
                status='draft',
                raw_data=merged,
            )

            # Step 6 — generate email sequence
            prospect_dict = {
                'name': name, 'title': title, 'company': company,
                'intent_signal': intent_data.get('signal', ''),
                'employment_history': all_emp,
            }
            try:
                sequence = gemini.generate_sequence(prospect_dict, product_context, tone)
                for email_data in sequence:
                    Email.objects.create(
                        prospect=prospect,
                        sequence_number=email_data['sequence_number'],
                        subject=email_data.get('subject', ''),
                        body=email_data.get('body', ''),
                        scheduled_day=email_data.get('scheduled_day', 0),
                    )
            except Exception as e:
                logger.warning(f"Email generation failed for {name}: {e}")

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

        try:
            resend.Emails.send({
                "from": "ProspectAI <onboarding@resend.dev>",
                "to": [prospect.email],
                "subject": email_obj.subject,
                "text": email_obj.body,
            })
            email_obj.sent_at = timezone.now()
            email_obj.save()
            prospect.status = 'sent'
            prospect.save()
            return Response({'success': True})
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
            'name': prospect.name,
            'title': prospect.title,
            'company': prospect.company,
            'intent_signal': prospect.intent_signal,
            'employment_history': prospect.employment_history,
        }

        prospect.emails.all().delete()
        sequence = gemini.generate_sequence(prospect_dict, campaign.product_context, campaign.tone)
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
