import json
from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"


def _parse_json(text: str):
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        text = parts[1] if len(parts) > 1 else text
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text.strip())


def _call(prompt: str) -> str:
    return client.models.generate_content(model=MODEL, contents=prompt).text


def translate_query_to_filters(natural_language_query: str) -> dict:
    prompt = f"""You are an expert B2B sales researcher. Convert the natural language prospect query into structured Crustdata API filters. Return ONLY valid JSON, no markdown, no explanation.

Keys:
- titles: list of job titles
- industries: list of industries
- locations: list of country names
- company_headcount_min: integer
- company_headcount_max: integer
- limit: integer (default 20)

Query: "{natural_language_query}"

Return only JSON."""
    return _parse_json(_call(prompt))


def analyze_intent(prospect_name: str, company: str, web_results: list, product_context: str) -> dict:
    results_text = '\n'.join([r.get('snippet', '') or r.get('title', '') for r in web_results[:5]])
    prompt = f"""Analyse these web search results to detect buying intent for: {product_context}

Prospect: {prospect_name} at {company}
Web results:
{results_text or 'No results found.'}

Return ONLY valid JSON:
{{"intent_score": "HIGH|MEDIUM|LOW", "signal": "one sentence", "quote": "direct quote or empty string"}}"""
    try:
        return _parse_json(_call(prompt))
    except Exception:
        return {"intent_score": "LOW", "signal": "", "quote": ""}


def generate_email(prospect: dict, product_context: str, tone: str, sequence_number: int = 1,
                   sender_name: str = '', sender_designation: str = '') -> dict:
    angles = {1: "pain point and product intro", 2: "social proof or new insight", 3: "final low-friction ask"}
    days = {1: 0, 2: 5, 3: 12}
    signature = f"\n\n{sender_name}\n{sender_designation}" if sender_name else ""
    prompt = f"""You are an expert SDR. Write email #{sequence_number} of a 3-part follow-up sequence.
Angle: {angles[sequence_number]}. Tone: {tone}. Under 100 words (excluding signature).
- Open with their specific pain point
- One line product benefit
- End with one low-friction ask
Never say "I hope this finds you well."
End the email body with exactly this signature (do not change it): {signature if signature else "[Sender Name]"}

Prospect: {prospect.get('name')}, {prospect.get('title')} at {prospect.get('company')}
Intent signal: {prospect.get('intent_signal', 'None')}
Product: {product_context}

Return ONLY valid JSON: {{"subject": "...", "body": "..."}}"""
    try:
        result = _parse_json(_call(prompt))
        result['scheduled_day'] = days[sequence_number]
        result['sequence_number'] = sequence_number
        return result
    except Exception as e:
        return {"subject": "Following up", "body": str(e), "scheduled_day": days[sequence_number], "sequence_number": sequence_number}


def generate_sequence(prospect: dict, product_context: str, tone: str,
                      sender_name: str = '', sender_designation: str = '') -> list:
    return [generate_email(prospect, product_context, tone, i, sender_name, sender_designation) for i in range(1, 4)]


def extract_product_context_from_url_content(url: str, page_text: str) -> str:
    prompt = f"""Based on this website content, write a concise product/company description (2-4 sentences) for B2B sales outreach. Focus on: what they do, who they serve, key benefits/differentiators.

URL: {url}
Page content: {page_text}

Return ONLY the description text, no JSON, no markdown."""
    try:
        return _call(prompt).strip()
    except Exception:
        return ""
