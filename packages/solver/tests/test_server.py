from fastapi.testclient import TestClient
from harvestforge_solver.server import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"

def test_optimize_basic():
    r = client.post("/optimize", json={
        "org_id": "test", "plan_date": "2026-06-15",
        "machines": [{"id": "m1"}], "fields": [{"id": "f1"}],
        "rules": [], "weights": [], "current_positions": [],
    })
    assert r.status_code == 200
    assert len(r.json()["assignments"]) == 1
