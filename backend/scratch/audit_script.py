import glob
import json
import os

print("=== DETAILED RUN LOG ANALYSIS (backend/runs/*.json) ===")
files = sorted(glob.glob(r"backend/runs/*.json"))
for f in files:
    with open(f, "r", encoding="utf-8") as fp:
        d = json.load(fp)
        ad = d.get("art_director_output", {})
        print(f"File: {os.path.basename(f)}")
        print(f"  Timestamp : {d.get('timestamp')}")
        print(f"  Topic     : {d.get('topic')}")
        print(f"  Template  : {d.get('template_id')}")
        if isinstance(ad, dict):
            print(f"  Rationale : {ad.get('design_rationale')}")
            elems = ad.get('elements', [])
            print(f"  Elements  : {len(elems)} element(s) -> {[e.get('slot') for e in elems]}")
        print("-" * 60)
