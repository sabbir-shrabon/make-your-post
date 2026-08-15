import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql
from app.models import Base
from app.database import engine

def dump_schema():
    with open("schema_dump.sql", "w") as f:
        for table in Base.metadata.sorted_tables:
            create_table = CreateTable(table).compile(engine, dialect=postgresql.dialect())
            f.write(str(create_table).strip() + ";\n\n")
            
if __name__ == "__main__":
    dump_schema()
    print("Schema dumped to schema_dump.sql")
