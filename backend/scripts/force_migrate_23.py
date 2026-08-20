import os
import sys
from sqlalchemy import text
from app.database import engine

def apply_23():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS topic_generation_mode VARCHAR DEFAULT 'creative' NOT NULL;"))
        print("Success")

if __name__ == "__main__":
    apply_23()
