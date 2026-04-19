import logging
import resend
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def send_scheduled_emails():
    from .models import Email
    resend.api_key = settings.RESEND_API_KEY
    fallback = getattr(settings, 'RESEND_TEST_EMAIL', '')

    due = Email.objects.filter(status='scheduled', scheduled_at__lte=timezone.now()).select_related('prospect')
    for email_obj in due:
        prospect = email_obj.prospect
        if not prospect.email and not fallback:
            continue

        def try_send(to, subject):
            resend.Emails.send({
                "from": "ProspectAI <onboarding@resend.dev>",
                "to": [to],
                "subject": subject,
                "text": email_obj.body,
            })

        try:
            try_send(prospect.email, email_obj.subject)
        except Exception:
            if fallback:
                try:
                    try_send(fallback, f"[TEST → {prospect.email}] {email_obj.subject}")
                except Exception as e:
                    logger.error(f"Fallback send failed for email {email_obj.id}: {e}")
                    email_obj.status = 'failed'
                    email_obj.save(update_fields=['status'])
                    continue
            else:
                email_obj.status = 'failed'
                email_obj.save(update_fields=['status'])
                continue

        email_obj.sent_at = timezone.now()
        email_obj.status = 'sent'
        email_obj.save(update_fields=['sent_at', 'status'])
        prospect.status = 'sent'
        prospect.save(update_fields=['status'])
        logger.info(f"Sent email {email_obj.id} to {prospect.name}")
