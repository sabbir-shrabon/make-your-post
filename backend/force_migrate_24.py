import os
import sys
from sqlalchemy import text
from app.database import engine

def apply_candidate_count():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS candidate_count INTEGER DEFAULT 3 NOT NULL;"))
        print("Success")

if __name__ == "__main__":
    apply_candidate_count()
