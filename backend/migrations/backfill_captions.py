"""
backfill_captions.py
--------------------
One-off script: generate vision captions for all existing rows in
media_library and template_background_assets that currently have no caption.

Run from backend/:
    venv\Scripts\python.exe migrations\backfill_captions.py

Reads DATABASE_URL from backend/.env automatically.
"""

import sys
import os

# Make 'backend/' the working root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal
from app.services.library_resolver import backfill_captions

def main() -> None:
    print("Starting caption backfill...")
    db = SessionLocal()
    try:
        results = backfill_captions(db)
        print(f"Done. media_library: {results.get('media_library', 0)} captions written.")
        print(f"      backgrounds:   {results.get('backgrounds', 0)} captions written.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
