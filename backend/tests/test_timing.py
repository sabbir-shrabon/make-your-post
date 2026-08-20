import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Make sure we can import app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.database import get_db
from app import models
from app.facebook_oauth import list_user_page_connections

def main():
    db_url = os.environ.get("DATABASE_URL")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # Get a user id (let's say the first user)
    user = db.query(models.User).first()
    if not user:
        print("No users found.")
        return
    
    user_id = user.id
    print(f"Testing for user_id: {user_id}")
    
    start_time = time.time()
    connections = list_user_page_connections(db, user_id)
    end_time = time.time()
    
    print(f"list_user_page_connections took {(end_time - start_time) * 1000:.2f} ms")
    print(f"Found {len(connections)} connections.")

if __name__ == "__main__":
    main()
