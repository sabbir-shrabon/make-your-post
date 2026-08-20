import os
import sys
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text

def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("No DATABASE_URL found.")
        return
    
    engine = create_engine(db_url)
    with engine.connect() as conn:
        # Check total rows
        result = conn.execute(text("SELECT COUNT(*) FROM post_logs"))
        print(f"Total post_logs: {result.scalar()}")
        
        # EXPLAIN the query for connection id 1 just as an example
        explain = conn.execute(text("""
            EXPLAIN ANALYZE
            SELECT facebook_connection_id, status, count(id)
            FROM post_logs
            WHERE facebook_connection_id = 1
            GROUP BY facebook_connection_id, status
        """))
        for row in explain:
            print(row[0])

if __name__ == "__main__":
    main()
