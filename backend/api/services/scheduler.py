import random
import pytz
from datetime import datetime, timedelta

# Country/region → IANA timezone
TIMEZONE_MAP = {
    # US states
    'california': 'America/Los_Angeles', 'los angeles': 'America/Los_Angeles',
    'san francisco': 'America/Los_Angeles', 'seattle': 'America/Los_Angeles',
    'oregon': 'America/Los_Angeles', 'washington state': 'America/Los_Angeles',
    'nevada': 'America/Los_Angeles',
    'colorado': 'America/Denver', 'boulder': 'America/Denver',
    'utah': 'America/Denver', 'arizona': 'America/Denver',
    'new mexico': 'America/Denver', 'denver': 'America/Denver',
    'texas': 'America/Chicago', 'illinois': 'America/Chicago',
    'chicago': 'America/Chicago', 'minnesota': 'America/Chicago',
    'wisconsin': 'America/Chicago', 'missouri': 'America/Chicago',
    'new york': 'America/New_York', 'boston': 'America/New_York',
    'florida': 'America/New_York', 'georgia': 'America/New_York',
    'virginia': 'America/New_York', 'pennsylvania': 'America/New_York',
    'new jersey': 'America/New_York', 'massachusetts': 'America/New_York',
    # Countries
    'united states': 'America/New_York', 'usa': 'America/New_York', 'us': 'America/New_York',
    'united kingdom': 'Europe/London', 'uk': 'Europe/London', 'england': 'Europe/London',
    'australia': 'Australia/Sydney', 'sydney': 'Australia/Sydney',
    'melbourne': 'Australia/Melbourne', 'brisbane': 'Australia/Brisbane',
    'perth': 'Australia/Perth', 'adelaide': 'Australia/Adelaide',
    'new zealand': 'Pacific/Auckland',
    'canada': 'America/Toronto', 'toronto': 'America/Toronto',
    'vancouver': 'America/Vancouver',
    'india': 'Asia/Kolkata',
    'singapore': 'Asia/Singapore',
    'germany': 'Europe/Berlin', 'france': 'Europe/Paris',
    'netherlands': 'Europe/Amsterdam', 'ireland': 'Europe/Dublin',
}

DEFAULT_TZ = 'America/New_York'
DEFAULT_SEND_DAYS = [0, 1, 2, 3]  # Mon–Thu


def detect_timezone(location: str) -> str:
    if not location:
        return DEFAULT_TZ
    loc_lower = location.lower()
    for key, tz in TIMEZONE_MAP.items():
        if key in loc_lower:
            return tz
    return DEFAULT_TZ


def next_send_slot(tz_str: str, send_days: list, window_start: int, window_end: int,
                   after: datetime = None) -> datetime:
    tz = pytz.timezone(tz_str)
    base = (after or datetime.now(tz)).astimezone(tz)

    for delta in range(14):
        candidate = base + timedelta(days=delta)
        if candidate.weekday() not in send_days:
            continue
        hour = random.randint(window_start, window_end - 1)
        minute = random.randint(0, 59)
        slot = candidate.replace(hour=hour, minute=minute, second=random.randint(0, 59), microsecond=0)
        if slot > base:
            return slot.astimezone(pytz.utc)

    # Fallback: 7 days from now at 9 AM UTC
    return (base + timedelta(days=7)).replace(hour=9, minute=0, second=0).astimezone(pytz.utc)


def schedule_prospect_emails(prospect, campaign, prospect_index: int = 0):
    from django.utils import timezone as dj_tz

    tz_str = detect_timezone(prospect.location)
    send_days = campaign.send_days or DEFAULT_SEND_DAYS
    w_start = campaign.send_window_start or 9
    w_end = campaign.send_window_end or 11

    # Stagger prospects: 2–7 min apart
    stagger = timedelta(minutes=prospect_index * random.randint(2, 7))
    now = datetime.now(pytz.utc) + stagger

    emails = list(prospect.emails.order_by('sequence_number'))
    if not emails:
        return

    # Email 1: next valid slot
    slot1 = next_send_slot(tz_str, send_days, w_start, w_end, after=now)

    offsets = [0, 5, 12]  # days between emails in sequence
    prev_slot = slot1

    for i, email in enumerate(emails):
        if i == 0:
            send_at = slot1
        else:
            # Advance by offset days, find next valid slot from there
            after = prev_slot + timedelta(days=offsets[i] - offsets[i - 1])
            send_at = next_send_slot(tz_str, send_days, w_start, w_end, after=after)

        email.scheduled_at = send_at
        email.status = 'scheduled'
        email.save(update_fields=['scheduled_at', 'status'])
        prev_slot = send_at
