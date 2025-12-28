import pytest
from fastapi.testclient import TestClient
from main import app  # Import deiner main.py

client = TestClient(app)

@pytest.mark.asyncio
async def test_create_project():
    payload = {
        "portfolio_id": "7608eb53-768e-4fa8-94f7-633c92b7a6ab",  # Deine gültige ID
        "name": "Test Project",
        "description": "Test Desc",
        "budget": 10000
    }
    response = client.post("/projects/", json=payload)
    assert response.status_code == 201
    assert "id" in response.json()
    # Optional: Lösche das Test-Project per DELETE, um DB sauber zu halten

@pytest.mark.asyncio
async def test_list_projects():
    response = client.get("/projects/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# Füge Tests für GET single, PATCH, DELETE hinzu – analog
# z. B. test_get_project(project_id):
#   response = client.get(f"/projects/{project_id}")
#   assert response.status_code == 200

# Für Fehlertests
@pytest.mark.asyncio
async def test_create_project_invalid_portfolio():
    payload = {
        "portfolio_id": "invalid-uuid",
        "name": "Invalid",
    }
    response = client.post("/projects/", json=payload)
    assert response.status_code == 422  # FastAPI Validation-Error ist 422