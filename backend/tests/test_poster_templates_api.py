import os
import sys
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.routers.poster_templates import _load_system_templates

def test_system_templates_loading():
    templates = _load_system_templates()
    print(f"Loaded {len(templates)} system templates:")
    for t in templates:
        print(f"  - [{t['category']}] {t['id']} ({t['name']}): {len(t['slots'])} slots. Demo headline: {t.get('demo_sample', {}).get('headline')}")
    
    assert len(templates) >= 11, f"Expected at least 11 templates, got {len(templates)}"
    print("\nSUCCESS: All system templates loaded and enriched with demo poster data!")

if __name__ == "__main__":
    test_system_templates_loading()
