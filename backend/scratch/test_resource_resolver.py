import sys
import os

# Add backend to path so we can import from app
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.services.resource_resolver import resolve_icon, resolve_emoji, CURATED_ICON_PREFIXES

def test_resolvers():
    # Test Iconify resolver with curated prefixes
    print("Testing resolve_icon...")
    
    icon_pizza = resolve_icon("pizza")
    print(f'resolve_icon("pizza") -> {icon_pizza}')
    assert icon_pizza is not None and "pizza" in icon_pizza.lower(), "Should resolve pizza"
    prefix_pizza = icon_pizza.split(":")[0]
    assert prefix_pizza in CURATED_ICON_PREFIXES, f"Resolved icon prefix {prefix_pizza} must be in {CURATED_ICON_PREFIXES}"
    
    icon_gibberish = resolve_icon("gibberish nonsense query xyz123")
    print(f'resolve_icon("gibberish nonsense query xyz123") -> {icon_gibberish}')
    assert icon_gibberish == "lucide:sparkles", "Should fall back to lucide:sparkles for zero results"
    
    icon_synonym = resolve_icon("excited birthday celebration")
    print(f'resolve_icon("excited birthday celebration") -> {icon_synonym}')
    assert icon_synonym is not None and ("party" in icon_synonym.lower() or "celebration" in icon_synonym.lower() or "cake" in icon_synonym.lower()), "Should resolve using synonyms"
    prefix_synonym = icon_synonym.split(":")[0]
    assert prefix_synonym in CURATED_ICON_PREFIXES, f"Resolved icon prefix {prefix_synonym} must be in {CURATED_ICON_PREFIXES}"
    
    # Test Emoji resolver
    print("\nTesting resolve_emoji...")
    
    emoji_fire = resolve_emoji("fire")
    print(f'resolve_emoji("fire") -> {ascii(emoji_fire)}')
    assert emoji_fire == "🔥", "Should resolve 'fire' to 🔥"
    
    emoji_celebration = resolve_emoji("celebration")
    print(f'resolve_emoji("celebration") -> {ascii(emoji_celebration)}')
    assert emoji_celebration in ["🎉", "🎊", "🥳"], "Should resolve 'celebration' to a sensible match"
    
    print("\nAll tests passed successfully!")

if __name__ == "__main__":
    test_resolvers()
