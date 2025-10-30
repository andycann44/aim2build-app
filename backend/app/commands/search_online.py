import requests

def search_online_sets(query: str, api_key: str = ""):
    url = f"https://rebrickable.com/api/v3/lego/sets/?search={query}"
    headers = {"Authorization": f"key {api_key}"} if api_key else {}
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    return r.json().get("results", [])
