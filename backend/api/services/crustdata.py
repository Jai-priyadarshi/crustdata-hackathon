import requests
from django.conf import settings

BASE_URL = "https://api.crustdata.com"
HEADERS = {
    "Authorization": f"Bearer {settings.CRUSTDATA_API_KEY}",
    "x-api-version": "2025-11-01",
    "Content-Type": "application/json",
}


def search_companies(filters: dict) -> list:
    payload = {
        "filters": _build_company_filters(filters),
        "limit": filters.get("limit", 20),
    }
    resp = requests.post(f"{BASE_URL}/company/search", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("companies", data.get("results", []))


def search_people(filters: dict, company_names: list = None) -> list:
    filter_list = []

    if filters.get("titles"):
        filter_list.append({
            "field": "experience.employment_details.current.title",
            "type": "in",
            "value": filters["titles"]
        })

    if company_names:
        filter_list.append({
            "field": "experience.employment_details.current.company_name",
            "type": "in",
            "value": company_names[:50]
        })

    if filters.get("locations"):
        filter_list.append({
            "field": "basic_profile.location",
            "type": "in",
            "value": filters["locations"]
        })

    payload = {
        "filters": filter_list,
        "limit": filters.get("limit", 20),
    }
    resp = requests.post(f"{BASE_URL}/person/search", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("people", data.get("results", []))


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
    results = data.get("results", [])
    return results[0].get("person_data", {}) if results else {}


def web_search(query: str) -> list:
    payload = {"query": query}
    resp = requests.post(f"{BASE_URL}/web/search/live", json=payload, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data.get("results", [])


def _build_company_filters(filters: dict) -> list:
    result = []
    if filters.get("industries"):
        result.append({"field": "taxonomy.primary_industry", "type": "in", "value": filters["industries"]})
    if filters.get("locations"):
        result.append({"field": "headquarters.country", "type": "in", "value": filters["locations"]})
    if filters.get("company_headcount_min"):
        result.append({"field": "headcount.total", "type": "=>", "value": filters["company_headcount_min"]})
    if filters.get("company_headcount_max"):
        result.append({"field": "headcount.total", "type": "=<", "value": filters["company_headcount_max"]})
    return result
