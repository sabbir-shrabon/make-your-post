import os
import sys

from sqlalchemy import text
from app.database import engine

def main():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT niche FROM ai_personas LIMIT 10"))
            rows = result.fetchall()
            for i, row in enumerate(rows):
                print(f"[{i+1}] {row[0]}")
            if not rows:
                print("No rows found in ai_personas.")
    except Exception as e:
        print(f"Error querying db: {e}")

if __name__ == "__main__":
    main()
