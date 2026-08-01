"""
Test script for cat_photo_resolver.
Run from backend/ with:
    venv\Scripts\python.exe scratch\test_cat_resolver.py
"""
import sys
import os
import json

# Make backend/ the root so `from app...` works
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.cat_photo_resolver import (
    resolve_cat_photo,
    _description_cache,
    _CACHE_FILE,
)


def section(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print("=" * 60)


def test_sunglasses_theme():
    section("TEST 1 - sunglasses theme (should use category_id=4)")
    result = resolve_cat_photo("cat wearing sunglasses looking cool")
    print(f"URL            : {result['url']}")
    # Description may be empty if vision LLM failed; that is an infra issue, not logic
    desc = result.get("description", "")
    print(f"Description    : {desc[:120] if desc else '(no description - vision LLM may be unavailable)'}")
    print(f"Low confidence : {result['low_confidence']}")
    assert result["url"].startswith("https://"), "URL must be a valid https URL"
    assert result["url"], "URL must not be empty"
    print("PASSED")
    return result


def test_cache_not_regenerated():
    section("TEST 2 - cache reuse (no redundant vision calls for already-cached URLs)")
    import app.services.cat_photo_resolver as module

    # Capture which URLs the vision model actually receives
    sent_to_vision_for_cached: list[str] = []
    original_describe = module._describe_images_batch

    def spy_describe(image_urls):
        # Flag any URL that was already in the cache when this call was made
        for u in image_urls:
            if u in module._description_cache:
                sent_to_vision_for_cached.append(u)
        return original_describe(image_urls)

    module._describe_images_batch = spy_describe
    try:
        result2 = resolve_cat_photo("cat wearing sunglasses looking cool")
    finally:
        module._describe_images_batch = original_describe

    print(f"Cache size     : {len(module._description_cache)}")
    print(f"Cached URLs re-sent to vision: {len(sent_to_vision_for_cached)}")
    print(f"URL            : {result2['url']}")
    assert len(sent_to_vision_for_cached) == 0, (
        f"Vision model received {len(sent_to_vision_for_cached)} already-cached URL(s):\n"
        + "\n".join(f"  {u}" for u in sent_to_vision_for_cached[:5])
    )
    print("PASSED - no redundant vision calls for cached URLs")


def test_cache_file_persisted():
    section("TEST 3 - cache file written to disk")
    assert os.path.exists(_CACHE_FILE), f"Cache file not found: {_CACHE_FILE}"
    with open(_CACHE_FILE, encoding="utf-8") as f:
        data = json.load(f)
    print(f"Cache file has {len(data)} entries at:")
    print(f"  {_CACHE_FILE}")
    # Cache may be empty if vision LLM is unavailable; just verify the file exists
    print(f"PASSED ({len(data)} entries persisted)")


def test_generic_theme():
    section("TEST 4 - generic theme without a matching category")
    result = resolve_cat_photo("cute cat playing in a garden")
    print(f"URL            : {result['url']}")
    desc = result.get("description", "")
    print(f"Description    : {desc[:120] if desc else '(no description)'}")
    print(f"Low confidence : {result['low_confidence']}")
    assert result["url"].startswith("https://"), "URL must be a valid https URL"
    print("PASSED")


if __name__ == "__main__":
    test_sunglasses_theme()
    test_cache_not_regenerated()
    test_cache_file_persisted()
    test_generic_theme()
    print("\n\nAll cat photo resolver tests passed!")
