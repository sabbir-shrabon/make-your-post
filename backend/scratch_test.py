import asyncio
from unittest.mock import patch
from app.services.poster_orchestrator import generatePoster
from app.database import SessionLocal
from app.services.art_director import ArtDirectorOutput, ElementItem, BackgroundChoice

mock_output = ArtDirectorOutput(
    headline="Test All Elements",
    subheadline="Badge, Icon, Shape, Photo",
    mood="energetic",
    template_id="centered-hero",
    palette_id="sunset-energy",
    font_pair_id="anton-montserrat",
    background_choice=BackgroundChoice(type="solid"),
    use_contrast_overlay=False,
    elements=[
        ElementItem(type="badge", description="discount badge", slot="corner_badge", shape_id="RibbonBanner", badge_text="20% OFF"),
        ElementItem(type="icon", description="star", slot="accent_icon"),
        ElementItem(type="shape", description="circle", slot="bottom_banner"),
        ElementItem(type="cat_photo", description="cute cat", slot="text_logo")
    ]
)

async def main():
    db = SessionLocal()
    try:
        with patch('app.services.poster_orchestrator.run_art_director', return_value=mock_output):
            await generatePoster('Mock Topic', persona_id=None, db=db, user_id=1, candidate_count=1)
    finally:
        db.close()

if __name__ == '__main__':
    asyncio.run(main())
