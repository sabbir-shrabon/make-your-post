import sqlite3

def check_sql_syntax(file_path):
    try:
        with open(file_path, 'r') as f:
            sql = f.read()
            
        # Connect to an in-memory database just to check syntax
        conn = sqlite3.connect(':memory:')
        cursor = conn.cursor()
        
        # Execute the script
        cursor.executescript(sql)
        print(f"Success executing {file_path} in SQLite!")
    except sqlite3.OperationalError as e:
        print(f"SQLite Error in {file_path}: {e}")
    except Exception as e:
        print(f"Other Error in {file_path}: {e}")

check_sql_syntax('migrations/drop.sql')
check_sql_syntax('migrations/init.sql')
