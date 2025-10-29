import sys, os
sys.path.append(os.path.dirname(__file__) + "/..")
from fastapi.testclient import TestClient
from app.main import app

def test_health():
    c = TestClient(app)
    r = c.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True
