#!/usr/bin/env python3
"""
download_icons.py — One-time build step to pre-download curated icon SVGs.

Downloads SVGs from the Iconify API for a curated list of commonly-needed
icons and stores them at  backend/assets/icons/{prefix}/{name}.svg.

Usage:
    py scripts/download_icons.py

Idempotent — skips icons that already exist on disk.
"""

import os
import sys
import time
import urllib.request

ASSETS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets", "icons",
)

ICONIFY_SVG_URL = "https://api.iconify.design/{prefix}/{name}.svg"

# -------------------------------------------------------------------
# Curated icon download list — extend as needed
# -------------------------------------------------------------------
ICON_DOWNLOAD_LIST = [
    # lucide (primary set — general purpose)
    "lucide:sparkles", "lucide:star", "lucide:heart", "lucide:music",
    "lucide:camera", "lucide:gift", "lucide:pizza", "lucide:coffee",
    "lucide:sun", "lucide:moon", "lucide:flame", "lucide:zap",
    "lucide:trophy", "lucide:crown", "lucide:rocket", "lucide:megaphone",
    "lucide:calendar", "lucide:clock", "lucide:map-pin", "lucide:tag",
    "lucide:percent", "lucide:shopping-cart", "lucide:shopping-bag",
    "lucide:ticket", "lucide:utensils", "lucide:mic", "lucide:headphones",
    "lucide:party-popper", "lucide:cake", "lucide:wine", "lucide:beer",
    "lucide:dumbbell", "lucide:leaf", "lucide:flower-2", "lucide:palette",
    "lucide:graduation-cap", "lucide:book-open", "lucide:lightbulb",
    "lucide:wrench", "lucide:smile", "lucide:thumbs-up",
    "lucide:hand-heart", "lucide:bell", "lucide:mail", "lucide:send",
    "lucide:share-2", "lucide:bookmark", "lucide:flag", "lucide:award",
    "lucide:target", "lucide:trending-up", "lucide:users",
    # ph (phosphor — secondary set)
    "ph:fire", "ph:confetti", "ph:lightning", "ph:storefront",
    "ph:microphone-stage", "ph:barbell", "ph:paint-brush",
    "ph:shooting-star", "ph:megaphone-simple", "ph:heart",
    "ph:star", "ph:gift", "ph:music-notes",
    # tabler (tertiary set)
    "tabler:discount", "tabler:speakerphone", "tabler:mood-happy",
    "tabler:salad", "tabler:yoga", "tabler:run", "tabler:plant",
]


def download_icon(icon_id: str) -> bool:
    """Download a single icon SVG. Returns True if downloaded, False if skipped/failed."""
    if ":" not in icon_id:
        print(f"  FAIL  {icon_id} (invalid format, expected prefix:name)")
        return False

    prefix, name = icon_id.split(":", 1)
    target_dir = os.path.join(ASSETS_DIR, prefix)
    target_path = os.path.join(target_dir, f"{name}.svg")

    if os.path.isfile(target_path):
        print(f"  EXISTS  {icon_id}")
        return False

    url = ICONIFY_SVG_URL.format(prefix=prefix, name=name)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            svg_bytes = resp.read()

        if not svg_bytes or b"<svg" not in svg_bytes.lower():
            print(f"  FAIL  {icon_id} -- response is not valid SVG")
            return False

        os.makedirs(target_dir, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(svg_bytes)
        print(f"  OK    {icon_id} -> {target_path}")
        return True

    except Exception as exc:
        print(f"  FAIL  {icon_id} -- {exc}")
        return False


def main():
    print(f"Downloading {len(ICON_DOWNLOAD_LIST)} icons to {ASSETS_DIR}\n")

    downloaded = 0
    skipped = 0
    failed = 0

    for icon_id in ICON_DOWNLOAD_LIST:
        result = download_icon(icon_id)
        if result:
            downloaded += 1
            # Small delay to be polite to the Iconify API
            time.sleep(0.1)
        elif os.path.isfile(
            os.path.join(ASSETS_DIR, *icon_id.split(":", 1)[0:1],
                         icon_id.split(":", 1)[1] + ".svg")
            if ":" in icon_id else ""
        ):
            skipped += 1
        else:
            failed += 1

    # Verify default.svg exists
    default_path = os.path.join(ASSETS_DIR, "default.svg")
    if os.path.isfile(default_path):
        print(f"\n[OK] default.svg exists at {default_path}")
    else:
        print(f"\n[WARN] default.svg missing at {default_path}")
        print("  The fallback icon won't work. Create it manually.")

    print(f"\nDone: {downloaded} downloaded, {skipped} already existed, {failed} failed")


if __name__ == "__main__":
    main()
