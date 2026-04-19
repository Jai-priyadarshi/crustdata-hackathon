import json
from google import genai
from django.conf import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)
MODEL = "gemini-2.0-flash"


def _parse_json(text: str) -> dict | list:
    text = text.strip()
    if text.startswith('```'):
        parts = text.split('```')
        text = parts[1] if len(parts) > 1 else text
        if text.startswith('json'):
            text = text[4:]
    return json.loads(text.strip())


def translate_query_to_filters(natural_language_query: str) -> dict:
    prompt = f"""You are an expert B2B sales researcher. Convert the natural language prospect query into structured Crustdata API filters. Return ONLY valid JSON, no markdown, no explanation.

The JSON must have these optional keys:
- titles: list of job titles
- industries: list of industries
- locations: list of country names
- company_headcount_min: integer
- company_headcount_max: integer
- limit: integer (default 20)

Query: "{natural_language_query}"

Return only JSON."""

    response = client.models.generate_content(model=MODEL, contents=prompt)
    return _parse_json(response.text)


def analyze_intent(prospect_name: str, company: str, web_results: list, product_context: str) -> dict:
    results_text = '\n'.join([r.get('snippet', '') or r.get('title', '') for r in web_results[:5]])
    prompt = f"""You are analysing web search results to detect buying intent for: {product_context}

Prospect: {prospect_name} at {company}

Web search results:
{results_text}

Score as HIGH, MEDIUM, or LOW and extract the key signal.
Return ONLY valid JSON:
{{
  "intent_score": "HIGH|MEDIUM|LOW",
  "signal": "one sentence describing the signal",
  "quote": "direct quote or empty string"
}}"""

    response = client.models.generate_content(model=MODEL, contents=prompt)
    try:
        return _parse_json(response.text)
    except Exception:
        return {"intent_score": "LOW", "signal": "No signal found", "quote": ""}


def generate_email(prospect: dict, product_context: str, tone: str, sequence_number: int = 1) -> dict:
    angles = {1: "pain point and product intro", 2: "social proof or a new insight", 3: "final low-friction ask"}
    days = {1: 0, 2: 5, 3: 12}

    prompt = f"""You are an expert SDR writing highly personalised cold emails.

Write email #{sequence_number} in a 3-part follow-up sequence. Angle: {angles.get(sequence_number)}.
Tone: {tone}. Keep it under 100 words.
- Opens with their specific pain point or recent activity
- Mentions the product benefit in one line
- Ends with one low-friction ask
Never use generic openers. Never say "I hope this finds you well."

Prospect:
Name: {prospect.get('name')}
Title: {prospect.get('title')}
Company: {prospect.get('company')}
Intent signal: {prospect.get('intent_signal', 'None')}
Employment history: {json.dumps(prospect.get('employment_history', [])[:2])}

Product context: {product_context}

Return ONLY valid JSON:
{{
  "subject": "email subject line",
  "body": "full email body"
}}"""

    response = client.models.generate_content(model=MODEL, contents=prompt)
    try:
        result = _parse_json(response.text)
        result['scheduled_day'] = days.get(sequence_number, 0)
        result['sequence_number'] = sequence_number
        return result
    except Exception:
        return {"subject": "Following up", "body": response.text, "scheduled_day": days.get(sequence_number, 0), "sequence_number": sequence_number}


def generate_sequence(prospect: dict, product_context: str, tone: str) -> list:
    return [generate_email(prospect, product_context, tone, i) for i in range(1, 4)]
