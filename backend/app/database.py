import json

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import SQLALCHEMY_DATABASE_URL


connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {}
)
if (
    SQLALCHEMY_DATABASE_URL.startswith("postgresql")
    and (
        "pgbouncer=true" in SQLALCHEMY_DATABASE_URL
        or "pooler.supabase.com" in SQLALCHEMY_DATABASE_URL
    )
):
    connect_args["prepare_threshold"] = None

engine_kwargs = {
    "connect_args": connect_args,
    "pool_pre_ping": True,
    "pool_recycle": 1800,
    "pool_size": 3,
    "max_overflow": 5,
}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_database_tables() -> None:
    try:
        Base.metadata.create_all(bind=engine)
    except OperationalError as exc:
        message = str(exc.orig).lower() if getattr(exc, "orig", None) else str(exc).lower()
        
        # Check for statement timeout - these are non-critical schema updates, allow startup
        if "statement timeout" in message or "canceling statement" in message:
            print(f"[MIGRATION WARNING] Database statement timeout during startup (non-critical): {message}")
            return
        
        if "failed to resolve host" in message and "supabase.co" in message:
            raise RuntimeError(
                "Could not resolve the Supabase direct database host. "
                "Open Supabase Project Settings -> Database -> Connection string "
                "and use the Transaction pooler URL in backend/.env as DATABASE_URL. "
                "The direct db.<project-ref>.supabase.co URL often fails on networks "
                "that cannot reach Supabase's direct database host."
            ) from exc
        raise


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
