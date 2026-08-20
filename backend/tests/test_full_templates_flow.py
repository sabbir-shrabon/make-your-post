import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.auth import create_access_token
from app import models

def test_full_template_lifecycle():
    client = TestClient(app)
    db = SessionLocal()

    # Find or create a test user
    user = db.query(models.User).first()
    if not user:
        user = models.User(
            email="test_templates@example.com",
            password_hash="test",
            created_at=models.datetime.now(models.timezone.utc)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    headers = {"Authorization": f"Bearer {token}"}

    print(f"Testing with user {user.email} (id={user.id})...")

    # 1. Test GET /api/poster/templates
    res = client.get("/api/poster/templates", headers=headers)
    assert res.status_code == 200, f"GET templates failed: {res.text}"
    data = res.json()
    print(f"[PASS] GET /api/poster/templates: {data['total_count']} templates ({data['system_count']} system, {data['custom_count']} custom)")
    assert data["system_count"] >= 11

    # 2. Test POST /api/poster/templates (create custom template)
    create_payload = {
        "name": "Automated Test Template",
        "category": "Tech & SaaS",
        "description": "A custom test template layout",
        "aspect_ratio": "1:1",
        "slots": {
            "headline": {"x_pct": 10, "y_pct": 20, "w_pct": 80, "h_pct": 25, "align": "center"},
            "subheadline": {"x_pct": 10, "y_pct": 50, "w_pct": 80, "h_pct": 15, "align": "center"},
            "corner_badge": {"x_pct": 75, "y_pct": 5, "w_pct": 20, "h_pct": 10, "align": "center"},
            "cta_text": {"x_pct": 30, "y_pct": 80, "w_pct": 40, "h_pct": 8, "align": "center"}
        },
        "best_for": ["tech", "test", "saas"]
    }
    res = client.post("/api/poster/templates", json=create_payload, headers=headers)
    assert res.status_code == 200, f"POST template failed: {res.text}"
    created_tpl = res.json()["template"]
    tpl_id = created_tpl["id"]
    print(f"[PASS] POST /api/poster/templates: Created {tpl_id}")

    # 3. Test POST /api/poster/save-canvas-as-template
    canvas_payload = {
        "name": "Saved Canvas Test Layout",
        "category": "Sales & Promo",
        "description": "Saved directly from Poster Lab canvas",
        "aspect_ratio": "1:1",
        "canvas_state": {
            "canvas_w": 1080,
            "canvas_h": 1080,
            "resolved_assets": [
                {"role": "headline", "content": "CANVAS HERO TITLE", "x": 100, "y": 200, "w": 880, "h": 200, "type": "text"},
                {"role": "badge", "badge_text": "SAVE TEST", "x": 800, "y": 50, "w": 200, "h": 80, "type": "badge"},
                {"role": "cta", "content": "CLICK ME", "x": 340, "y": 850, "w": 400, "h": 80, "type": "text"}
            ]
        }
    }
    res = client.post("/api/poster/templates/save-canvas-as-template", json=canvas_payload, headers=headers)
    assert res.status_code == 200, f"POST save-canvas failed: {res.text}"
    saved_canvas_tpl = res.json()["template"]
    canvas_tpl_id = saved_canvas_tpl["id"]
    print(f"[PASS] POST /api/poster/save-canvas-as-template: Saved {canvas_tpl_id}")

    # 4. Test Export
    res = client.get(f"/api/poster/templates/{tpl_id}/export", headers=headers)
    assert res.status_code == 200, f"Export failed: {res.text}"
    print(f"[PASS] GET /api/poster/templates/{tpl_id}/export: Exported JSON")

    # 5. Clean up created test templates via DELETE
    res = client.delete(f"/api/poster/templates/{tpl_id}", headers=headers)
    assert res.status_code == 200
    res = client.delete(f"/api/poster/templates/{canvas_tpl_id}", headers=headers)
    assert res.status_code == 200
    print(f"[PASS] DELETE custom templates: Cleaned up test records")

    db.close()
    print("\nALL POSTER TEMPLATE API TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_template_lifecycle()
