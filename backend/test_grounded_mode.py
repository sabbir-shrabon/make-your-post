import os
import sys

# Manually load .env since python-dotenv might not be available
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                os.environ[k.strip()] = v.strip()

from app.database import SessionLocal
from app import models
from app.posts import generate_persona_post_with_user_model
import logging

logging.basicConfig(level=logging.INFO)

def test_grounded_mode():
    db = SessionLocal()
    try:
        persona = db.query(models.AIPersona).first()
        if not persona:
            print("No persona found")
            return
            
        print(f"Testing with persona {persona.id}, niche: {persona.niche}")
        
        # Set to grounded
        persona.topic_generation_mode = 'grounded'
        db.commit()
        
        print("\n--- Testing Primary Path (SerpApi) ---")
        if 'BING_SEARCH_API_KEY' in os.environ:
            del os.environ['BING_SEARCH_API_KEY']
        
        post = generate_persona_post_with_user_model(db, persona)
        print(f"\nResulting Post:\n{post.encode('utf-8').decode('cp1252', 'ignore')}\n")
        
        print("\n--- Testing Bing Path (Invalid Key) ---")
        os.environ['BING_SEARCH_API_KEY'] = 'invalid-bing-key'
        post_fallback = generate_persona_post_with_user_model(db, persona)
        print(f"\nResulting Post (Bing Fallback to Google News):\n{post_fallback.encode('utf-8').decode('cp1252', 'ignore')}\n")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_grounded_mode()
