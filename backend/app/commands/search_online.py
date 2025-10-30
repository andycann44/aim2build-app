import requests

def search_online(query, api_key=None):
    url = f"https://rebrickable.com/api/v3/lego/sets/?search={query}"
    headers = {"Authorization": f"key {api_key}"} if api_key else {}
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        raise RuntimeError(f"Search failed: {r.status_code}")
    return r.json().get("results", [])
