import requests
from django.conf import settings

BASE_URL = "https://api.crustdata.com"
HEADERS = {
    "Authorization": f"Bearer {settings.CRUSTDATA_API_KEY}",
    "x-api-version": "2025-11-01",
    "Content-Type": "application/json",
}


def search_companies(filters: dict) -> list:
    conditions = _build_company_filters(filters)
    if not conditions:
        return []
    payload = {
        "filters": {"op": "and", "conditions": conditions},
        "limit": filters.get("limit", 20),
    }
    resp = requests.post(f"{BASE_URL}/company/search", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("companies", data.get("results", []))


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
            location_values.append(loc)
            if loc.lower() in ("united states", "usa", "us"):
                location_values.append("United States of America")
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
    data = resp.json()
    return data.get("profiles", data.get("people", data.get("results", [])))


def enrich_person(linkedin_url: str = None, email: str = None) -> dict:
    payload = {}
    if linkedin_url:
        payload["professional_network_profile_urls"] = [linkedin_url]
    elif email:
        payload["business_emails"] = [email]
    else:
        return {}

    resp = requests.post(f"{BASE_URL}/person/enrich", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    # response is a list of {matched_on, match_type, matches: [{confidence_score, person_data}]}
    if isinstance(data, list) and data:
        matches = data[0].get("matches", [])
        return matches[0].get("person_data", {}) if matches else {}
    return {}


def web_search(query: str) -> list:
    payload = {"query": query}
    resp = requests.post(f"{BASE_URL}/web/search/live", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("results", [])


def _build_company_filters(filters: dict) -> list:
    result = []
    if filters.get("industries"):
        result.append({"field": "taxonomy.professional_network_industry", "type": "(.)", "value": "|".join(filters["industries"])})
    if filters.get("locations"):
        iso3_map = {"united states": "USA", "usa": "USA", "us": "USA", "united kingdom": "GBR", "uk": "GBR",
                    "canada": "CAN", "australia": "AUS", "india": "IND", "germany": "DEU", "france": "FRA",
                    "singapore": "SGP", "new zealand": "NZL"}
        iso3_values = [iso3_map.get(loc.lower(), loc) for loc in filters["locations"]]
        result.append({"field": "locations.country", "type": "in", "value": iso3_values})
    if filters.get("company_headcount_min"):
        result.append({"field": "headcount.total", "type": "=>", "value": filters["company_headcount_min"]})
    if filters.get("company_headcount_max"):
        result.append({"field": "headcount.total", "type": "=<", "value": filters["company_headcount_max"]})
    return result
