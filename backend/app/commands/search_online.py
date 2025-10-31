import os
import requests

def search_online(query, api_key=None, limit=20):
    # fall back to env if not provided
    if not api_key:
        api_key = os.getenv("REBRICKABLE_API_KEY", "")
    base = os.getenv("REBRICKABLE_API_BASE", "https://rebrickable.com/api/v3")
    url = f"{base}/lego/sets/?search={query}&page=1&page_size={limit}"
    headers = {"Authorization": f"key {api_key}"} if api_key else {}
    r = requests.get(url, headers=headers, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"Search failed: {r.status_code}")
    return r.json().get("results", [])