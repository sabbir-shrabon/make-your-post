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

# High-frequency curated offline icon map (0ms instant resolution)
STATIC_ICON_MAP = {
    "bolt": "lucide:zap",
    "zap": "lucide:zap",
    "lightning": "lucide:zap",
    "energy": "lucide:zap",
    "sparkles": "lucide:sparkles",
    "star": "lucide:star",
    "magic": "lucide:wand-2",
    "fire": "lucide:flame",
    "flame": "lucide:flame",
    "hot": "lucide:flame",
    "rocket": "lucide:rocket",
    "launch": "lucide:rocket",
    "growth": "lucide:trending-up",
    "chart": "lucide:bar-chart-3",
    "analytics": "lucide:line-chart",
    "target": "lucide:target",
    "goal": "lucide:target",
    "check": "lucide:check-circle-2",
    "success": "lucide:check-circle",
    "shield": "lucide:shield-check",
    "security": "lucide:shield",
    "heart": "lucide:heart",
    "love": "lucide:heart",
    "clock": "lucide:clock",
    "time": "lucide:clock",
    "lightbulb": "lucide:lightbulb",
    "idea": "lucide:lightbulb",
    "coffee": "lucide:coffee",
    "trophy": "lucide:trophy",
    "award": "lucide:award",
    "user": "lucide:user",
    "users": "lucide:users",
    "team": "lucide:users-2",
    "lock": "lucide:lock",
    "code": "lucide:code-2",
    "laptop": "lucide:laptop",
    "phone": "lucide:smartphone",
    "bag": "lucide:shopping-bag",
    "cart": "lucide:shopping-cart",
    "dollar": "lucide:dollar-sign",
    "money": "lucide:banknote",
    "bell": "lucide:bell",
    "calendar": "lucide:calendar",
    "gift": "lucide:gift",
    "discount": "lucide:percent",
    "sale": "lucide:tag",
    "tag": "lucide:tag",
    "pizza": "tabler:pizza",
    "cat": "ph:cat",
    "dog": "ph:dog",
    "sun": "lucide:sun",
    "moon": "lucide:moon",
    "briefcase": "lucide:briefcase",
}


def resolve_icon(query: str, allow_fallback: bool = True) -> tuple[str | None, list[str]]:
    """
    Resolve a query to an Iconify ID constrained to CURATED_ICON_PREFIXES.
    Checks instant offline static map first, then calls Iconify with a strict timeout.
    """
    if not query:
        return None, []

    q_clean = query.strip().lower()
    
    # 1. Check instant offline static map
    if q_clean in STATIC_ICON_MAP:
        icon_id = STATIC_ICON_MAP[q_clean]
        return icon_id, [icon_id]

    for key, icon_id in STATIC_ICON_MAP.items():
        if key in q_clean or q_clean in key:
            return icon_id, [icon_id]

    # 2. Online search with strict 1.5s timeout
    prefixes_str = ",".join(CURATED_ICON_PREFIXES)
    url = f"https://api.iconify.design/search?query={urllib.parse.quote(query)}&prefixes={prefixes_str}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=1.5) as response:
            data = json.loads(response.read())
            icons = data.get("icons", [])
            if icons:
                return icons[0], icons[:10]
    except Exception as e:
        logger.info(f"Online icon search skipped for '{query}' ({e}), using fallback.")

    # 3. Fallback to standard clean icon
    fallback_icon = "lucide:sparkles"
    return (fallback_icon, [fallback_icon]) if allow_fallback else (None, [])



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

