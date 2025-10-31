def search_sets(query, mode="offline"):
    if mode == "online":
        # TODO: call Rebrickable API
        return {"source": "online", "results": []}
    else:
        # TODO: search local DB
        return {"source": "offline", "results": []}
