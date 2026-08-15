import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.services.poster_orchestrator import generatePoster

async def test_live_orchestrator():
    print("Testing generatePoster live execution...")
    db = SessionLocal()
    try:
        result = await generatePoster(
            topic="5 Time Management Tips for Founders",
            persona_id=None,
            db=db,
            user_id=1,
            candidate_count=1,
            allow_pexels_bg=True,
        )
        print("[OK] generatePoster executed successfully!")
        print("Winner run_id:", result.get("run_id"))
        print("Has base64 image:", bool(result.get("base64_image")))
        print("Candidate count:", len(result.get("candidates", [])))
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_live_orchestrator())
