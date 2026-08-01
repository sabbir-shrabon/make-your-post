"""
library_resolver.py
-------------------
Task C — Media library semantic search (caption + PostgreSQL full-text search).

This is the v1 "fast-ship" implementation as specified:
  * caption TEXT — auto-generated at ingestion by a vision LLM call
  * caption_tsv  — GENERATED ALWAYS tsvector (see migration 22)
  * GIN index on caption_tsv for fast full-text search

Public API
~~~~~~~~~~
    generate_caption(image_url)              → str | None
    ingest_caption(db, table, record_id, image_url, overwrite=False)
    resolve_from_library(description, scope, db, user_id, limit) → list[dict]
    backfill_captions(db)

Upgrade path to pgvector (v2):
  Once migration 23 adds VECTOR(768) columns and the embedding model is wired up,
  swap `resolve_from_library` to use ORDER BY embedding <-> $vec LIMIT N.
  Caption-based search can remain as a hybrid re-ranker on top.
"""

from __future__ import annotations

import logging
from typing import Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vision caption generation
# ---------------------------------------------------------------------------

def generate_caption(image_url: str) -> str | None:
    """
    Call a vision-capable LLM to produce a rich, searchable caption for the
    image at `image_url`.

    The caption is deliberately verbose (mood, colours, subject, setting) so
    the tsvector index can match a wide range of natural-language queries.

    Returns None on any failure so the caller can decide whether to retry.
    """
    from app.providers.llm_providers import generate_text
    from app.config import (
        GEMINI_API_KEY,
        OPENAI_API_KEY,
        MISTRAL_API_KEY,
        OPENROUTER_API_KEY,
        OPENROUTER_MODEL,
    )

    prompt = (
        "Describe this image in 2-3 sentences for a searchable caption. "
        "Include: the main subject, visual mood (e.g. dark, moody, bright, energetic, "
        "minimal, vintage, elegant, playful), dominant colours, setting or background, "
        "and any notable textures or style (e.g. grainy, neon, pastel, high-contrast). "
        "Be specific — this caption is used for full-text search, not display."
    )

    # Provider priority — prefer Mistral if configured, then Gemini or OpenAI
    provider, model, key = None, None, ""
    if MISTRAL_API_KEY:
        provider, model, key = "mistral", "pixtral-12b-2409", MISTRAL_API_KEY
    elif GEMINI_API_KEY:
        provider, model, key = "gemini", "gemini-2.0-flash", GEMINI_API_KEY
    elif OPENAI_API_KEY:
        provider, model, key = "openai", "gpt-4o-mini", OPENAI_API_KEY
    elif OPENROUTER_API_KEY:
        provider, model, key = "openrouter", OPENROUTER_MODEL or "openrouter/auto", OPENROUTER_API_KEY


    if not provider:
        logger.error("No vision-capable LLM provider configured for caption generation.")
        return None

    try:
        caption = generate_text(
            prompt=prompt,
            system_prompt="You write precise, keyword-rich image captions for search indexing.",
            model_name=model,
            provider_name=provider,
            api_key=key,
            temperature=0.2,
            max_tokens=200,
            images=[image_url],
        )
        return caption.strip() if caption else None
    except Exception as exc:
        logger.warning("Caption generation failed for %s: %s", image_url, exc)
        return None


# ---------------------------------------------------------------------------
# Ingestion helpers
# ---------------------------------------------------------------------------

_TABLE_MAP = {
    "media_library": "media_library",
    "backgrounds": "template_background_assets",
}

_URL_COLUMN = {
    "media_library": "image_url",
    "template_background_assets": "preview_url",
}


def ingest_caption(
    db: Session,
    scope: Literal["media_library", "backgrounds"],
    record_id: str,
    image_url: str,
    overwrite: bool = False,
) -> bool:
    """
    Generate and store a vision caption for a single row.

    `scope` maps to the table: 'media_library' → media_library,
    'backgrounds' → template_background_assets.

    Returns True if a caption was written, False if skipped or failed.
    """
    table = _TABLE_MAP[scope]

    if not overwrite:
        row = db.execute(
            text(f"SELECT caption FROM {table} WHERE id = :id"),
            {"id": record_id},
        ).mappings().first()
        if row and row["caption"]:
            logger.debug("Caption already exists for %s id=%s, skipping.", table, record_id)
            return False

    caption = generate_caption(image_url)
    if not caption:
        return False

    db.execute(
        text(f"UPDATE {table} SET caption = :caption WHERE id = :id"),
        {"caption": caption, "id": record_id},
    )
    db.commit()
    logger.info("Caption stored for %s id=%s", table, record_id)
    return True


def backfill_captions(db: Session) -> dict:
    """
    One-off backfill: iterate all rows in both tables that have a non-null
    image URL but a null caption, and generate captions for them.

    Returns a summary dict: {"media_library": N, "backgrounds": M}.
    """
    results: dict[str, int] = {}

    for scope, table, url_col in [
        ("media_library", "media_library", "image_url"),
        ("backgrounds", "template_background_assets", "preview_url"),
    ]:
        rows = db.execute(
            text(
                f"SELECT id, {url_col} AS url FROM {table} "
                f"WHERE caption IS NULL AND {url_col} IS NOT NULL"
            )
        ).mappings().all()

        count = 0
        for row in rows:
            try:
                wrote = ingest_caption(db, scope, row["id"], row["url"], overwrite=False)
                if wrote:
                    count += 1
            except Exception as exc:
                logger.warning("Backfill failed for %s id=%s: %s", table, row["id"], exc)

        results[scope] = count
        logger.info("Backfill done for %s: %d captions written.", table, count)

    return results


# ---------------------------------------------------------------------------
# Search — full-text nearest-neighbour via tsvector
# ---------------------------------------------------------------------------

def _build_tsquery(description: str) -> str:
    """
    Convert a free-text description into a Postgres tsquery string.

    Strategy:
    1. Tokenise by whitespace, strip punctuation.
    2. Emit  word1 & word2 & word3  (AND of all stems) so all keywords must
       appear — this is strict but precise.
    3. If the result is empty (all stop-words stripped), fall back to a
       plainto_tsquery so Postgres handles it gracefully.
    """
    import re
    words = re.sub(r"[^\w\s]", " ", description.lower()).split()
    # Postgres stop-word list is auto-applied by to_tsquery, but we pre-filter
    # very short words to avoid empty lexemes causing parse errors.
    words = [w for w in words if len(w) > 2]
    if not words:
        return description  # fall back to raw; plainto_tsquery is safer
    return " & ".join(words)


def resolve_from_library(
    description: str,
    scope: Literal["media_library", "backgrounds"],
    db: Session,
    user_id: int | None = None,
    limit: int = 5,
) -> list[dict]:
    """
    Full-text search over the caption column.

    Returns up to `limit` rows ordered by ts_rank DESC (best match first).
    Each result dict has: id, url, caption, rank.

    If zero rows match the strict AND-query, falls back to plainto_tsquery
    (any word) so we always return something when captions exist.
    """
    table = _TABLE_MAP[scope]
    url_col = _URL_COLUMN[table]

    # Build user filter clause
    user_filter = "AND user_id = :user_id" if user_id is not None else ""
    params: dict = {"limit": limit}
    if user_id is not None:
        params["user_id"] = user_id

    # --- Attempt 1: strict AND tsquery ---
    tsquery_str = _build_tsquery(description)

    strict_sql = text(f"""
        SELECT id, {url_col} AS url, caption,
               ts_rank(caption_tsv, to_tsquery('english', :query)) AS rank
        FROM   {table}
        WHERE  caption_tsv @@ to_tsquery('english', :query)
               {user_filter}
        ORDER  BY rank DESC
        LIMIT  :limit
    """)
    try:
        rows = db.execute(strict_sql, {**params, "query": tsquery_str}).mappings().all()
    except Exception as exc:
        logger.warning("Strict tsquery failed for '%s': %s — falling back.", description, exc)
        rows = []

    if rows:
        return [dict(r) for r in rows]

    # --- Attempt 2: plainto_tsquery (handles stop-words, morphological stems) ---
    loose_sql = text(f"""
        SELECT id, {url_col} AS url, caption,
               ts_rank(caption_tsv, plainto_tsquery('english', :query)) AS rank
        FROM   {table}
        WHERE  caption_tsv @@ plainto_tsquery('english', :query)
               {user_filter}
        ORDER  BY rank DESC
        LIMIT  :limit
    """)
    try:
        rows = db.execute(loose_sql, {**params, "query": description}).mappings().all()
    except Exception as exc:
        logger.warning("plainto_tsquery failed for '%s': %s", description, exc)
        rows = []

    return [dict(r) for r in rows]
