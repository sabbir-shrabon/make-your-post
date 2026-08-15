import os
import re

with open('schema_dump.sql', 'r') as f:
    sql = f.read()

# Extract table names
tables = re.findall(r'CREATE TABLE (\w+)', sql)

# Reverse for dropping
tables_to_drop = reversed(tables)

drop_statements = []

for table in tables_to_drop:
    drop_statements.append(f"DROP TABLE IF EXISTS {table} CASCADE;")

init_sql_content = "-- Initial Schema Migration\n-- Drops all existing tables and creates fresh schema\n\n"
init_sql_content += "\n".join(drop_statements) + "\n\n"
init_sql_content += sql

os.makedirs('migrations', exist_ok=True)
with open('migrations/init.sql', 'w') as f:
    f.write(init_sql_content)

print("init.sql created!")
