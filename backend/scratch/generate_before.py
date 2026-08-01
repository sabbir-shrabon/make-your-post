import asyncio
from app.database import SessionLocal
from app.routers.persona_image_templates import _run_post_image_generation

async def main():
    db = SessionLocal()
    try:
        gen = await _run_post_image_generation(db, post_id=173, user_id=1, template_id='c0182d19-4b86-476b-8b71-f7d6ff87639b', raise_errors=False)
        print("Generated image:", gen.final_image_url)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
