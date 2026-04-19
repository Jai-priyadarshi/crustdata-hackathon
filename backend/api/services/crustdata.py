import requests
from django.conf import settings

BASE_URL = "https://api.crustdata.com"
HEADERS = {
    "Authorization": f"Bearer {settings.CRUSTDATA_API_KEY}",
    "x-api-version": "2025-11-01",
    "Content-Type": "application/json",
}

# Maps user-facing industry terms → Crustdata taxonomy values
INDUSTRY_MAP = {
    "geotechnical": "Civil Engineering",
    "geotechnical engineering": "Civil Engineering",
    "site investigation": "Civil Engineering",
    "ground engineering": "Civil Engineering",
    "fintech": "Financial Services",
    "saas": "Software Development",
    "software": "Software Development",
    "b2b saas": "Software Development",
    "healthcare": "Hospitals and Health Care",
    "health tech": "Hospitals and Health Care",
    "real estate": "Real Estate",
    "proptech": "Real Estate",
    "construction": "Construction",
    "manufacturing": "Manufacturing",
    "legal": "Law Practice",
    "marketing": "Marketing and Advertising",
    "renewable energy": "Renewables & Environment",
    "climate": "Renewables & Environment",
}

ISO3_MAP = {
    "united states": "USA", "usa": "USA", "us": "USA",
    "united kingdom": "GBR", "uk": "GBR",
    "canada": "CAN", "australia": "AUS", "india": "IND",
    "germany": "DEU", "france": "FRA", "singapore": "SGP",
    "new zealand": "NZL", "netherlands": "NLD", "ireland": "IRL",
}

# Maps country names → Crustdata person location values
PERSON_LOCATION_MAP = {
    "united states": ["United States", "United States of America"],
    "usa": ["United States", "United States of America"],
    "us": ["United States", "United States of America"],
    "united kingdom": ["United Kingdom"],
    "uk": ["United Kingdom"],
    "australia": ["Australia"],
    "canada": ["Canada"],
    "india": ["India"],
    "germany": ["Germany"],
    "france": ["France"],
    "singapore": ["Singapore"],
    "new zealand": ["New Zealand"],
}


def search_companies(filters: dict) -> list:
    conditions = _build_company_filters(filters)
    if not conditions:
        return []
    payload = {
        "filters": {"op": "and", "conditions": conditions},
        "limit": 50,
    }
    resp = requests.post(f"{BASE_URL}/company/search", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json().get("companies", [])


def search_people(filters: dict, company_names: list = None) -> list:
    conditions = []

    if filters.get("titles"):
        conditions.append({
            "field": "experience.employment_details.current.title",
            "type": "(.)",
            "value": "|".join(filters["titles"])
        })

    if company_names:
        conditions.append({
            "field": "experience.employment_details.company_name",
            "type": "in",
            "value": company_names[:50]
        })

    if filters.get("locations"):
        location_values = []
        for loc in filters["locations"]:
            mapped = PERSON_LOCATION_MAP.get(loc.lower())
            if mapped:
                location_values.extend(mapped)
            else:
                location_values.append(loc)
        conditions.append({
            "field": "basic_profile.location",
            "type": "in",
            "value": list(dict.fromkeys(location_values))
        })

    if not conditions:
        return []

    payload = {
        "filters": {"op": "and", "conditions": conditions},
        "limit": filters.get("limit", 20),
    }
    resp = requests.post(f"{BASE_URL}/person/search", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json().get("profiles", [])


def enrich_person(linkedin_url: str = None, email: str = None) -> dict:
    payload = {"fields": ["contact.business_emails", "contact.personal_emails"]}
    if linkedin_url:
        payload["professional_network_profile_urls"] = [linkedin_url]
    elif email:
        payload["business_emails"] = [email]
    else:
        return {}

    resp = requests.post(f"{BASE_URL}/person/enrich", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list) and data:
        matches = data[0].get("matches", [])
        return matches[0].get("person_data", {}) if matches else {}
    return {}


def web_search(query: str) -> list:
    resp = requests.post(f"{BASE_URL}/web/search/live", json={"query": query}, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json().get("results", [])


def _build_company_filters(filters: dict) -> list:
    result = []
    if filters.get("industries"):
        mapped = [INDUSTRY_MAP.get(i.lower(), i) for i in filters["industries"]]
        result.append({"field": "taxonomy.professional_network_industry", "type": "(.)", "value": "|".join(mapped)})
    if filters.get("locations"):
        iso3 = [ISO3_MAP.get(loc.lower(), loc) for loc in filters["locations"]]
        result.append({"field": "locations.country", "type": "in", "value": iso3})
    if filters.get("company_headcount_min"):
        result.append({"field": "headcount.total", "type": "=>", "value": filters["company_headcount_min"]})
    if filters.get("company_headcount_max"):
        result.append({"field": "headcount.total", "type": "=<", "value": filters["company_headcount_max"]})
    return result
