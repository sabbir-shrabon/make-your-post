import urllib.request
import urllib.parse
import json
import os
import re
import logging

logger = logging.getLogger(__name__)

# Basic synonym map for fallback searches
SYNONYM_MAP = {
    "sale": "discount",
    "celebration": "party",
    "food": "restaurant",
    "birthday": "party",
    "gift": "present",
    "music": "audio",
    "picture": "image",
}

# Words to ignore when simplifying a query
IGNORE_WORDS = {
    "excited", "happy", "sad", "angry", "big", "small", "huge", "tiny", 
    "new", "old", "beautiful", "ugly", "fast", "slow", "red", "blue", 
    "green", "yellow", "black", "white", "awesome", "great", "cool"
}

# Curated allowlist of icon set prefixes for visual consistency
CURATED_ICON_PREFIXES = ["lucide", "ph", "tabler"]

def simplify_query(query: str) -> str:
    """Strip adjectives and use synonyms to find a simpler core query."""
    words = query.lower().split()
    
    # 1. Try to find a word that is in our synonym map
    for word in reversed(words):
        if word in SYNONYM_MAP:
            return SYNONYM_MAP[word]
            
    # 2. If no direct synonym, just strip ignore words and pick the last word (likely the noun)
    filtered_words = [w for w in words if w not in IGNORE_WORDS]
    if not filtered_words:
        return ""
    
    core_noun = filtered_words[-1]
    return SYNONYM_MAP.get(core_noun, core_noun)

def resolve_icon(query: str, allow_fallback: bool = True) -> tuple[str | None, list[str]]:
    """
    Resolve a query to an Iconify ID constrained to CURATED_ICON_PREFIXES.
    Calls Iconify search API. Returns (top result's icon id, list of up to 10 candidates).
    Retries once with simplified query if zero results.
    """
    if not query:
        return None, []
        
    prefixes_str = ",".join(CURATED_ICON_PREFIXES)
    url = f"https://api.iconify.design/search?query={urllib.parse.quote(query)}&prefixes={prefixes_str}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read())
            icons = data.get("icons", [])
            if icons:
                return icons[0], icons[:10]
    except Exception as e:
        logger.warning(f"Error fetching icon for '{query}': {e}")

    # Retry with simplified query
    simplified = simplify_query(query)
    if not simplified or simplified == query.lower():
        return ("lucide:sparkles", ["lucide:sparkles"]) if allow_fallback else (None, [])

    url_retry = f"https://api.iconify.design/search?query={urllib.parse.quote(simplified)}&prefixes={prefixes_str}"
    try:
        req = urllib.request.Request(url_retry, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read())
            icons = data.get("icons", [])
            if icons:
                return icons[0], icons[:10]
    except Exception as e:
        logger.warning(f"Error fetching icon for '{simplified}' (retry): {e}")

    # Fallback to standard icon
    return ("lucide:sparkles", ["lucide:sparkles"]) if allow_fallback else (None, [])



# --- Emoji Resolver ---

EMOJI_INDEX_URL = "https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json"
EMOJI_INDEX_FILE = os.path.join(os.path.dirname(__file__), "emoji_index.json")
_emoji_index = []

def _load_emoji_index():
    global _emoji_index
    if _emoji_index:
        return

    # Try to load from local file first
    if os.path.exists(EMOJI_INDEX_FILE):
        try:
            with open(EMOJI_INDEX_FILE, "r", encoding="utf-8") as f:
                _emoji_index = json.load(f)
                return
        except Exception as e:
            logger.warning(f"Failed to load local emoji index: {e}")

    # Download if not available locally
    try:
        req = urllib.request.Request(EMOJI_INDEX_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read())
            
            # Keep only what we need to save space/memory: emoji, description, aliases, tags
            _emoji_index = []
            for item in data:
                _emoji_index.append({
                    "emoji": item.get("emoji", ""),
                    "description": item.get("description", ""),
                    "aliases": item.get("aliases", []),
                    "tags": item.get("tags", [])
                })
                
            # Save locally for future runs
            with open(EMOJI_INDEX_FILE, "w", encoding="utf-8") as f:
                json.dump(_emoji_index, f, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to download emoji index: {e}")
        _emoji_index = []

def resolve_emoji(query: str) -> str | None:
    """
    Resolve a query to a Twemoji character code using local static index.
    """
    if not query:
        return None
        
    _load_emoji_index()
    if not _emoji_index:
        return None
        
    query_lower = query.lower().strip()
    
    # Calculate score for each emoji
    best_score = -1
    best_emoji = None
    
    for item in _emoji_index:
        score = 0
        
        # Exact alias match gives highest score
        if query_lower in item.get("aliases", []):
            score = 100
        # Exact tag match
        elif query_lower in item.get("tags", []):
            score = 80
        # Word in description
        elif query_lower in item.get("description", "").lower():
            score = 50
        # Substring in aliases
        elif any(query_lower in alias for alias in item.get("aliases", [])):
            score = 30
            
        if score > best_score:
            best_score = score
            best_emoji = item.get("emoji")
            
        # Early exit if perfect match
        if best_score == 100:
            break
            
    if best_score >= 30 and best_emoji:
        return best_emoji
    return "✨"

