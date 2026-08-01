"""
cat_photo_resolver.py
---------------------
Resolves a theme description string to the best-matching Cat API photo URL.

Algorithm
~~~~~~~~~
1. Map the theme onto Cat API native category filters where possible
   (sunglasses, hats, boxes, space, ties, clothes, sinks).
2. Fetch a batch of ~15-20 candidate photos from the Cat API.
3. For each candidate whose URL has NOT been seen before, generate a short
   visual description using a vision-capable LLM (single batched call).
4. Cache those descriptions keyed by URL so reruns never redo vision work.
5. Ask the LLM to rank the cached/new descriptions against the theme and
   return the index of the best match.
6. If confidence is low (e.g. the theme couldn't be expressed through any
   real match), fetch one more batch and re-rank across both; then return
   the winner with ``low_confidence=True``.

Return value
~~~~~~~~~~~~
A dict:  {"url": str, "low_confidence": bool}

Acceptance criteria (from spec)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
* resolveCatPhoto("cat wearing sunglasses looking cool")
    → photo whose description mentions sunglasses (or closest, flagged)
* Running it twice doesn't regenerate descriptions for already-cached URLs.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cat API category map  (id → keywords that suggest this category)
# Source: GET https://api.thecatapi.com/v1/categories
# ---------------------------------------------------------------------------

_CAT_CATEGORIES: list[dict] = [
    {"id": 5,  "name": "boxes",     "keywords": ["box", "boxes", "container", "cardboard"]},
    {"id": 15, "name": "clothes",   "keywords": ["clothes", "clothing", "dressed", "outfit", "shirt", "jacket", "sweater", "coat"]},
    {"id": 1,  "name": "hats",      "keywords": ["hat", "hats", "cap", "beanie", "beret", "fedora", "top hat"]},
    {"id": 14, "name": "sinks",     "keywords": ["sink", "sinks", "basin", "bathtub", "bathroom"]},
    {"id": 2,  "name": "space",     "keywords": ["space", "galaxy", "astronaut", "cosmos", "stars", "universe", "rocket"]},
    {"id": 4,  "name": "sunglasses","keywords": ["sunglasses", "glasses", "shades", "eyewear", "cool", "stylish"]},
    {"id": 7,  "name": "ties",      "keywords": ["tie", "ties", "bowtie", "bow tie", "necktie", "formal", "business"]},
]

# Minimum ranking score (0-1) below which we declare low confidence
_LOW_CONFIDENCE_THRESHOLD = 0.40

# Batch size for candidate fetching
_BATCH_SIZE = 15

# ---------------------------------------------------------------------------
# In-memory description cache  {url: str  →  description: str}
# Persisted to a JSON file alongside this module so it survives restarts.
# ---------------------------------------------------------------------------

_CACHE_FILE = os.path.join(os.path.dirname(__file__), "cat_description_cache.json")
_description_cache: dict[str, str] = {}
_cache_loaded = False


def _load_cache() -> None:
    global _cache_loaded
    if _cache_loaded:
        return
    _cache_loaded = True
    if os.path.exists(_CACHE_FILE):
        try:
            with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                _description_cache.update(json.load(f))
            logger.debug("Cat description cache loaded (%d entries).", len(_description_cache))
        except Exception as exc:
            logger.warning("Could not load cat description cache: %s", exc)


def _save_cache() -> None:
    try:
        with open(_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_description_cache, f, ensure_ascii=False, indent=2)
    except Exception as exc:
        logger.warning("Could not save cat description cache: %s", exc)


# ---------------------------------------------------------------------------
# Cat API helpers
# ---------------------------------------------------------------------------

def _cat_api_key() -> str:
    from app.config import CAT_API_KEY  # lazy import to avoid circular deps
    return CAT_API_KEY or ""


def _detect_category_id(theme: str) -> Optional[int]:
    """Return a Cat API category_id if the theme mentions any known category keyword."""
    theme_lower = theme.lower()
    for cat in _CAT_CATEGORIES:
        for kw in cat["keywords"]:
            if kw in theme_lower:
                return cat["id"]
    return None


def _fetch_candidates(batch_size: int = _BATCH_SIZE, category_id: Optional[int] = None) -> list[str]:
    """
    Fetch a batch of photo URLs from the Cat API.
    Applies category_id filter when available.
    Returns a list of CDN image URLs.
    """
    params: dict = {
        "limit": batch_size,
        "mime_types": "jpg,png",
        "size": "small",   # smaller images → faster downloads for vision model
        "order": "RAND",
    }
    if category_id is not None:
        params["category_ids"] = str(category_id)

    query_string = urllib.parse.urlencode(params)
    url = f"https://api.thecatapi.com/v1/images/search?{query_string}"

    headers = {"User-Agent": "AutoPoster/1.0"}
    api_key = _cat_api_key()
    if api_key:
        headers["x-api-key"] = api_key

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        logger.error("Cat API fetch failed: %s", exc)
        return []

    if not isinstance(data, list):
        return []

    urls = []
    for item in data:
        img_url = item.get("url", "")
        if img_url and img_url.startswith("https://"):
            urls.append(img_url)
    return urls


# ---------------------------------------------------------------------------
# Vision description via LLM providers
# ---------------------------------------------------------------------------

def _describe_images_batch(image_urls: list[str]) -> dict[str, str]:
    """
    Send all uncached image URLs in ONE batched call to a vision-capable model.
    Returns a mapping {url → description}.

    Strategy:
    - Build a numbered list prompt so the model returns one line per image.
    - We try each provider that supports vision in priority order:
      Gemini → OpenAI → Mistral (pixtral) → OpenRouter.
    """
    from app.providers.llm_providers import generate_text
    from app.config import (
        GEMINI_API_KEY, GEMINI_MODEL,
        OPENAI_API_KEY,
        MISTRAL_API_KEY,
        OPENROUTER_API_KEY, OPENROUTER_MODEL,
    )

    if not image_urls:
        return {}

    numbered = "\n".join(f"{i+1}. <image>" for i in range(len(image_urls)))
    prompt = (
        f"You are given {len(image_urls)} cat photos (shown in order below). "
        "For EACH photo, write ONE SHORT sentence (max 20 words) describing what you see: "
        "pose, accessories, setting, mood. Number your responses to match the photos.\n\n"
        f"{numbered}\n\n"
        "Reply with ONLY the numbered list, nothing else. Example:\n"
        "1. A tabby cat sitting inside a cardboard box looking curious.\n"
        "2. An orange cat wearing oversized sunglasses on a sunny porch."
    )

    # Pick first available vision-capable provider (prefer Mistral if configured)
    provider, model, key = None, None, ""
    if MISTRAL_API_KEY:
        provider = "mistral"
        model = "pixtral-12b-2409"
        key = MISTRAL_API_KEY
    elif GEMINI_API_KEY:
        provider = "gemini"
        model = "gemini-2.0-flash"
        key = GEMINI_API_KEY
    elif OPENAI_API_KEY:
        provider = "openai"
        model = "gpt-4o-mini"
        key = OPENAI_API_KEY
    elif OPENROUTER_API_KEY:
        provider = "openrouter"
        model = OPENROUTER_MODEL or "openrouter/auto"
        key = OPENROUTER_API_KEY


    if not provider:
        logger.error("No vision-capable LLM provider configured; cannot describe cat photos.")
        return {}

    try:
        raw = generate_text(
            prompt=prompt,
            system_prompt="You describe images precisely and concisely.",
            model_name=model,
            provider_name=provider,
            api_key=key,
            temperature=0.2,
            max_tokens=60 * len(image_urls),  # ~60 tokens per description
            images=image_urls,
        )
    except Exception as exc:
        logger.error("Vision LLM call failed: %s", exc)
        return {}

    if not raw:
        return {}

    # Parse numbered lines: "1. Some description."
    descriptions: dict[str, str] = {}
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        if ". " in line:
            num_part, desc_part = line.split(". ", 1)
            try:
                idx = int(num_part.strip()) - 1  # zero-based
                if 0 <= idx < len(image_urls):
                    descriptions[image_urls[idx]] = desc_part.strip()
            except ValueError:
                continue

    return descriptions


# ---------------------------------------------------------------------------
# LLM ranking: which description best matches the theme?
# ---------------------------------------------------------------------------

def _rank_by_llm(theme: str, descriptions: dict[str, str]) -> tuple[str, float]:
    """
    Ask the LLM to pick the best-matching description index for the theme.
    Returns (best_url, confidence_score 0–1).

    confidence_score is the fraction of how well the LLM considers it a match
    (we ask it to give a 0-10 score).
    """
    from app.providers.llm_providers import generate_text
    from app.config import (
        GEMINI_API_KEY, GEMINI_MODEL,
        OPENAI_API_KEY,
        MISTRAL_API_KEY,
        OPENROUTER_API_KEY, OPENROUTER_MODEL,
    )

    urls = list(descriptions.keys())
    if not urls:
        raise ValueError("No descriptions to rank.")

    if len(urls) == 1:
        # Only one candidate — return it with medium confidence
        return urls[0], 0.5

    numbered_descs = "\n".join(
        f"{i+1}. {descriptions[url]}" for i, url in enumerate(urls)
    )

    prompt = (
        f"THEME: \"{theme}\"\n\n"
        f"CANDIDATE DESCRIPTIONS:\n{numbered_descs}\n\n"
        "Which numbered description BEST matches the theme? "
        "Reply with ONLY a JSON object in this exact format:\n"
        '{"best": <number>, "score": <0-10>}\n'
        "where 'score' is how well the best match fits (10=perfect, 0=no match at all)."
    )

    # Use Mistral (or Gemini) for text ranking
    provider, model, key = None, None, ""
    if MISTRAL_API_KEY:
        provider = "mistral"
        model = MISTRAL_MODEL or "mistral-small-latest"
        key = MISTRAL_API_KEY
    elif GEMINI_API_KEY:
        provider = "gemini"
        model = "gemini-2.0-flash"
        key = GEMINI_API_KEY
    elif OPENAI_API_KEY:
        provider = "openai"
        model = "gpt-4o-mini"
        key = OPENAI_API_KEY
    elif OPENROUTER_API_KEY:
        provider = "openrouter"
        model = OPENROUTER_MODEL or "openrouter/auto"
        key = OPENROUTER_API_KEY


    if not provider:
        logger.warning("No LLM configured for ranking; returning first candidate.")
        return urls[0], 0.0

    try:
        raw = generate_text(
            prompt=prompt,
            system_prompt="You rank image descriptions against a theme. Reply only with valid JSON.",
            model_name=model,
            provider_name=provider,
            api_key=key,
            temperature=0.0,
            max_tokens=64,
        )
    except Exception as exc:
        logger.error("Ranking LLM call failed: %s", exc)
        return urls[0], 0.0

    if not raw:
        return urls[0], 0.0

    # Strip markdown fences if present
    cleaned = raw.strip()
    if "```" in cleaned:
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        cleaned = cleaned[start:end]

    try:
        result = json.loads(cleaned)
        idx = int(result.get("best", 1)) - 1  # back to zero-based
        score = float(result.get("score", 5)) / 10.0  # normalize 0-10 → 0-1
        idx = max(0, min(idx, len(urls) - 1))
        return urls[idx], score
    except Exception as exc:
        logger.warning("Could not parse ranking response '%s': %s", raw[:100], exc)
        return urls[0], 0.0


# ---------------------------------------------------------------------------
# Main public entry point
# ---------------------------------------------------------------------------

def resolve_cat_photo(theme_description: str) -> dict:
    """
    Resolve a theme description to the best-matching Cat API photo.

    Returns:
        {
            "url": str,           # direct Cat API CDN URL
            "description": str,   # generated visual description of the chosen photo
            "low_confidence": bool
        }
    Raises:
        RuntimeError if the Cat API returns no photos at all.
    """
    _load_cache()

    category_id = _detect_category_id(theme_description)
    if category_id is not None:
        logger.info(
            "Theme '%s' matched Cat API category_id=%d", theme_description, category_id
        )

    # --- Batch 1 ---
    candidate_urls = _fetch_candidates(batch_size=_BATCH_SIZE, category_id=category_id)
    if not candidate_urls:
        raise RuntimeError("Cat API returned no photos for the given theme.")

    # Describe only uncached URLs
    uncached = [u for u in candidate_urls if u not in _description_cache]
    if uncached:
        new_descs = _describe_images_batch(uncached)
        _description_cache.update(new_descs)
        _save_cache()

    # Build description map for candidates we actually have descriptions for
    descs_batch1 = {u: _description_cache[u] for u in candidate_urls if u in _description_cache}

    if not descs_batch1:
        # Vision call returned nothing useful — return first candidate as-is
        return {"url": candidate_urls[0], "description": "", "low_confidence": True}

    best_url, score = _rank_by_llm(theme_description, descs_batch1)

    if score >= _LOW_CONFIDENCE_THRESHOLD:
        return {
            "url": best_url,
            "description": _description_cache.get(best_url, ""),
            "low_confidence": False,
        }

    # --- Low confidence — fetch a second batch and re-rank across both ---
    logger.info(
        "Low confidence (%.2f) for theme '%s', fetching second batch.", score, theme_description
    )
    candidate_urls2 = _fetch_candidates(batch_size=_BATCH_SIZE, category_id=category_id)

    uncached2 = [u for u in candidate_urls2 if u not in _description_cache]
    if uncached2:
        new_descs2 = _describe_images_batch(uncached2)
        _description_cache.update(new_descs2)
        _save_cache()

    descs_batch2 = {u: _description_cache[u] for u in candidate_urls2 if u in _description_cache}

    # Merge both batches for final ranking
    all_descs = {**descs_batch1, **descs_batch2}
    best_url2, score2 = _rank_by_llm(theme_description, all_descs)

    return {
        "url": best_url2,
        "description": _description_cache.get(best_url2, ""),
        "low_confidence": True,  # Always flag low_confidence after needing a second batch
    }
