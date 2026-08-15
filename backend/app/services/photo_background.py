"""
photo_background.py — Fetch a Pexels photo for poster backgrounds.

Sync function callable from the renderer. On any failure, returns None
so the caller can fall back to gradient.

Two-layer on-disk cache keyed by search query:
  1. Query → image URL  (avoids re-hitting the Pexels API)
  2. URL → image bytes  (avoids re-downloading the same photo)
"""

import hashlib
import json
import logging
import os
import urllib.request
import urllib.parse
import io

from PIL import Image

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "cache", "photo_bg")

PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"
FETCH_TIMEOUT = 4  # seconds — applies to both API search and image download


def _cache_key(query: str) -> str:
    """Stable filesystem-safe key from a search query."""
    return hashlib.sha256(query.strip().lower().encode()).hexdigest()[:24]


def _search_pexels_multiple(query: str, api_key: str | None = None) -> list[str]:
    """Hit Pexels search API, return up to 10 'large2x' URLs."""
    if not api_key:
        api_key = os.getenv("PEXELS_API_KEY", "")
    if not api_key:
        return []
    if not query.strip():
        logger.info("Pexels search aborted: query is empty.")
        return []
        
    params = urllib.parse.urlencode({"query": query, "per_page": 10, "orientation": "square"})
    url = f"{PEXELS_SEARCH_URL}?{params}"
    try:
        req = urllib.request.Request(url, headers={
            "Authorization": api_key,
            "User-Agent": "Mozilla/5.0",
        })
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            data = json.loads(resp.read())
        photos = data.get("photos", [])
        
        urls = []
        for p in photos:
            src = p.get("src", {})
            u = src.get("large2x") or src.get("large") or src.get("original")
            if u:
                urls.append(u)
        return urls
    except Exception as e:
        logger.warning(f"Pexels search multiple failed: {e}")
        return []

def _search_pexels(query: str, api_key: str) -> str | None:
    """Hit Pexels search API, return the 'large2x' URL of the top result, or None."""
    urls = _search_pexels_multiple(query, api_key)
    return urls[0] if urls else None


def _download_image(url: str) -> bytes:
    """Download image bytes with timeout."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
        return resp.read()


def fetch_photo_background(
    pexels_query: str,
    canvas_w: int,
    canvas_h: int,
    run_id: str = "",
) -> Image.Image | None:
    """
    Fetch a photo background for the given search query.

    Returns a PIL Image cover-cropped to canvas_w × canvas_h, or None on
    any failure (missing API key, network error, timeout, no results, corrupt
    image). The caller should fall back to gradient when None is returned.
    """
    api_key = os.getenv("PEXELS_API_KEY", "")
    if not api_key:
        logger.warning("[run=%s] PEXELS_API_KEY not set, skipping photo background", run_id)
        return None

    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_key = _cache_key(pexels_query)
    url_cache_path = os.path.join(CACHE_DIR, f"{cache_key}.url")
    img_cache_path = os.path.join(CACHE_DIR, f"{cache_key}.img")

    image_url: str | None = None
    raw_bytes: bytes | None = None

    # --- Layer 1: query → URL cache ---
    try:
        if os.path.isfile(url_cache_path):
            with open(url_cache_path, "r") as f:
                image_url = f.read().strip()
            logger.info("[run=%s] Photo BG cache hit (query): %s", run_id, pexels_query)
    except Exception:
        pass

    if not image_url:
        try:
            image_url = _search_pexels(pexels_query, api_key)
            if image_url:
                with open(url_cache_path, "w") as f:
                    f.write(image_url)
                logger.info("[run=%s] Pexels search OK: %r → %s", run_id, pexels_query, image_url[:80])
            else:
                logger.warning("[run=%s] Pexels returned 0 results for %r", run_id, pexels_query)
                return None
        except Exception as exc:
            logger.warning("[run=%s] Pexels search failed for %r: %s", run_id, pexels_query, exc)
            return None

    # --- Layer 2: URL → image bytes cache ---
    try:
        if os.path.isfile(img_cache_path):
            with open(img_cache_path, "rb") as f:
                raw_bytes = f.read()
            logger.info("[run=%s] Photo BG cache hit (image): %s bytes", run_id, len(raw_bytes))
    except Exception:
        pass

    if not raw_bytes:
        try:
            raw_bytes = _download_image(image_url)
            with open(img_cache_path, "wb") as f:
                f.write(raw_bytes)
            logger.info("[run=%s] Photo downloaded: %s bytes", run_id, len(raw_bytes))
        except Exception as exc:
            logger.warning("[run=%s] Photo download failed for %r: %s", run_id, image_url[:60] if image_url else "", exc)
            return None

    # --- Decode + cover-crop to canvas dimensions ---
    try:
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
        img_w, img_h = img.size
        scale = max(canvas_w / max(1, img_w), canvas_h / max(1, img_h))
        new_w = max(1, int(img_w * scale))
        new_h = max(1, int(img_h * scale))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = (new_w - canvas_w) // 2
        top = (new_h - canvas_h) // 2
        return img.crop((left, top, left + canvas_w, top + canvas_h))
    except Exception as exc:
        logger.warning("[run=%s] Photo decode/crop failed: %s", run_id, exc)
        return None
