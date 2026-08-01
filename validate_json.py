import json
import sys

def check_overlap(s1, s2):
    return not (s1["x_pct"] >= s2["x_pct"] + s2["w_pct"] or
                s1["x_pct"] + s1["w_pct"] <= s2["x_pct"] or
                s1["y_pct"] >= s2["y_pct"] + s2["h_pct"] or
                s1["y_pct"] + s1["h_pct"] <= s2["y_pct"])

def run_validation():
    print("Validating templates.json...")
    with open('design-resources/templates.json', 'r') as f:
        templates = json.load(f)
    
    for t in templates:
        slots = t.get("slots", {})
        for name, s in slots.items():
            # Check 0-100 bounds
            if not (0 <= s["x_pct"] <= 100 and 0 <= s["y_pct"] <= 100):
                print(f"Error in {t['id']}: slot {name} out of bounds")
                sys.exit(1)
            if not (0 <= s["x_pct"] + s["w_pct"] <= 100 and 0 <= s["y_pct"] + s["h_pct"] <= 100):
                print(f"Error in {t['id']}: slot {name} width/height extends out of bounds")
                sys.exit(1)
                
        # Check overlaps
        slot_items = list(slots.items())
        for i in range(len(slot_items)):
            for j in range(i+1, len(slot_items)):
                n1, s1 = slot_items[i]
                n2, s2 = slot_items[j]
                if check_overlap(s1, s2):
                    print(f"Error in {t['id']}: overlap between {n1} and {n2}")
                    sys.exit(1)
    print("templates.json passed (all bounds 0-100%, no overlaps).")

    print("\nValidating palettes.json...")
    with open('design-resources/palettes.json', 'r') as f:
        palettes = json.load(f)
    
    for p in palettes:
        if "text_on_dark" not in p or "text_on_light" not in p:
            print(f"Error in {p['id']}: missing text_on_dark or text_on_light")
            sys.exit(1)
            
    print("palettes.json passed (all have text_on_dark and text_on_light).")

if __name__ == '__main__':
    run_validation()
