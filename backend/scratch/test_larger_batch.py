import sys
import os
import json
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.art_director import run_art_director
from app.config import MISTRAL_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY

topics = [
    # Comparative (aimed at before-after-split)
    "kitchen renovation transformation before and after",
    "skin transformation 30 day skincare results",
    
    # List / Instructional (aimed at list-steps)
    "5 daily habits for better sleep",
    "3 steps to launch your first website",
    
    # Hero photo focus (aimed at right-rail, split-image-left)
    "handcrafted ceramic vase collection",
    "nature landscape photography workshop",
    "customer testimonial on financial services",
    
    # Announcement / Hero (aimed at centered-hero, top-heavy)
    "important company policy update announcement",
    "grand opening celebration of city park",
    "creative writing masterclass with top author",
    
    # Quote / Minimal (aimed at minimal-quote, centered-hero)
    "steve jobs inspirational quote on innovation",
    
    # Product / Sale (aimed at product-showcase, bottom-banner)
    "new organic coffee blend product launch",
    "gourmet dessert menu showcase",
    "smart home security system features",
    
    # Creative / News / Event (aimed at diagonal-split, bottom-banner, right-rail)
    "bold urban street style fashion week",
    "indie film festival premiere night",
    "breaking tech industry news roundup",
    "annual charity gala dinner invitation"
]

print("=== LARGER BATCH TEST: 18 VARIED TOPICS ===")
print(f"Testing {len(topics)} topics...\n")

provider = None
model = None
api_key = None

if MISTRAL_API_KEY:
    provider = "mistral"
    model = "mistral-small-latest"
    api_key = MISTRAL_API_KEY
elif GEMINI_API_KEY:
    provider = "gemini"
    model = "gemini-2.5-flash"
    api_key = GEMINI_API_KEY
elif OPENAI_API_KEY:
    provider = "openai"
    model = "gpt-4o-mini"
    api_key = OPENAI_API_KEY

print(f"Using provider: {provider}, model: {model}\n")

RUNS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "runs")
os.makedirs(RUNS_DIR, exist_ok=True)

results = []

for i, topic in enumerate(topics, 1):
    print(f"[{i}/{len(topics)}] Running Art Director for topic: '{topic}'...")
    try:
        if provider and api_key:
            ad_output = run_art_director(
                topic=topic,
                model=model,
                provider=provider,
                api_key=api_key
            )
        else:
            ad_output = run_art_director(topic=topic)
        
        data = ad_output.model_dump()
        template_id = data.get("template_id")
        rationale = data.get("design_rationale")
        
        run_id = f"test-batch2-{uuid.uuid4().hex[:8]}"
        log_data = {
            "run_id": run_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "topic": topic,
            "template_id": template_id,
            "art_director_output": data,
            "provider": provider,
            "model": model,
            "batch": 2
        }
        
        log_path = os.path.join(RUNS_DIR, f"{run_id}.json")
        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(log_data, f, indent=2)
            
        results.append({
            "topic": topic,
            "template_id": template_id,
            "rationale": rationale,
            "log_path": log_path
        })
        print(f"   -> Selected Template: '{template_id}'")
    except Exception as e:
        print(f"   -> ERROR: {e}")

print("\n" + "="*60)
print("=== BATCH 2 SUMMARY ===")
print("="*60)

template_counts = {}
for r in results:
    tid = r["template_id"]
    template_counts[tid] = template_counts.get(tid, 0) + 1
    print(f"Topic: '{r['topic']:<45}' | Selected: {tid}")

print("\nBatch 2 Template Distribution:")
for tid, count in sorted(template_counts.items(), key=lambda x: x[1], reverse=True):
    pct = (count / len(results)) * 100
    print(f"  {tid:<22}: {count}/{len(results)} ({pct:.1f}%)")
