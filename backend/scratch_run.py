import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.poster_orchestrator import generatePoster
from app.database import SessionLocal

async def main():
    db = SessionLocal()
    topic = "Major Tech Conference 2024, Friday 8pm at the Moscone Center. Featuring AI experts."
    
    print("Generating poster...")
    result = await generatePoster(topic=topic, persona_id=0, db=db, user_id=1, candidate_count=1)
    
    print("Run ID:", result["run_id"])
    run_log = os.path.join("runs", f"{result['run_id']}.json")
    print("Log saved to:", run_log)

if __name__ == "__main__":
    asyncio.run(main())
