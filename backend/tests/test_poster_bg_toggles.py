from PIL import Image

from app.services import resource_resolver_unified as resolver
from app.services.art_director import run_art_director


def _img(color):
    return Image.new("RGBA", (8, 8), color)


def test_art_director_prompt_disallows_photo_when_bg_toggles_off(monkeypatch):
    prompts = []

    def fake_generate_text_for_user(**kwargs):
        prompts.append(kwargs["system_prompt"])
        return """{
          "design_rationale": "Minimal layout requested because photo backgrounds are disabled. Used a gradient and one text hierarchy choice.",
          "headline": "SOLAR TAX CREDITS",
          "subheadline": "What homeowners should know",
          "mood": "informative",
          "template_id": "centered-bold",
          "palette_id": "midnight-gold",
          "font_pair_id": "modern-sans",
          "background_choice": {"type": "gradient", "fallback_type": "gradient"},
          "use_contrast_overlay": false,
          "elements": []
        }"""

    monkeypatch.setattr("app.services.art_director.generate_text_for_user", fake_generate_text_for_user)

    outputs = [
        run_art_director(topic, user_id=1, db=None, allow_pexels_bg=False, allow_cat_bg=False)
        for topic in ("solar tax credits", "pizza weekend deal", "travel packing checklist")
    ]

    assert all(output.background_choice.type != "photo" for output in outputs)
    assert len(prompts) == 3
    assert all("Photo backgrounds are NOT allowed" in prompt for prompt in prompts)


def test_pexels_on_cat_off_zero_results_falls_back_without_cat(monkeypatch):
    calls = []

    def fake_pexels(**kwargs):
        calls.append("pexels")
        return None

    def fake_cat(*args, **kwargs):
        calls.append("cat_api")
        return _img("orange")

    monkeypatch.setattr("app.services.photo_background.fetch_photo_background", fake_pexels)
    monkeypatch.setattr(resolver, "_fetch_cat_background", fake_cat)

    image, diagnostics = resolver.resolve_background_photo(
        query="pizza on dark table",
        canvas_w=8,
        canvas_h=8,
        run_id="test",
        allow_pexels_bg=True,
        allow_cat_bg=False,
    )

    assert image is None
    assert calls == ["pexels"]
    assert diagnostics["sources_called"] == ["pexels"]
    assert diagnostics["resolved_source"] is None
    assert diagnostics["override_reason"] == "photo_sources_returned_no_results"


def test_both_on_pexels_zero_results_tries_cat(monkeypatch):
    calls = []

    def fake_pexels(**kwargs):
        calls.append("pexels")
        return None

    def fake_cat(*args, **kwargs):
        calls.append("cat_api")
        return _img("orange")

    monkeypatch.setattr("app.services.photo_background.fetch_photo_background", fake_pexels)
    monkeypatch.setattr(resolver, "_fetch_cat_background", fake_cat)

    image, diagnostics = resolver.resolve_background_photo(
        query="pizza on dark table",
        canvas_w=8,
        canvas_h=8,
        run_id="test",
        allow_pexels_bg=True,
        allow_cat_bg=True,
    )

    assert image is not None
    assert calls == ["pexels", "cat_api"]
    assert diagnostics["sources_called"] == ["pexels", "cat_api"]
    assert diagnostics["resolved_source"] == "cat_api"
    assert diagnostics["override_reason"] is None


def test_both_on_both_zero_results_falls_back(monkeypatch):
    calls = []

    def fake_pexels(**kwargs):
        calls.append("pexels")
        return None

    def fake_cat(*args, **kwargs):
        calls.append("cat_api")
        return None

    monkeypatch.setattr("app.services.photo_background.fetch_photo_background", fake_pexels)
    monkeypatch.setattr(resolver, "_fetch_cat_background", fake_cat)

    image, diagnostics = resolver.resolve_background_photo(
        query="pizza on dark table",
        canvas_w=8,
        canvas_h=8,
        run_id="test",
        allow_pexels_bg=True,
        allow_cat_bg=True,
    )

    assert image is None
    assert calls == ["pexels", "cat_api"]
    assert diagnostics["sources_called"] == ["pexels", "cat_api"]
    assert diagnostics["resolved_source"] is None
    assert diagnostics["override_reason"] == "photo_sources_returned_no_results"


def test_cat_on_pexels_off_non_cat_topic_calls_cat(monkeypatch):
    calls = []

    def fake_pexels(**kwargs):
        calls.append("pexels")
        return _img("blue")

    def fake_cat(*args, **kwargs):
        calls.append("cat_api")
        return _img("orange")

    monkeypatch.setattr("app.services.photo_background.fetch_photo_background", fake_pexels)
    monkeypatch.setattr(resolver, "_fetch_cat_background", fake_cat)

    image, diagnostics = resolver.resolve_background_photo(
        query="enterprise cybersecurity compliance dashboard",
        canvas_w=8,
        canvas_h=8,
        run_id="test",
        allow_pexels_bg=False,
        allow_cat_bg=True,
    )

    assert image is not None
    assert calls == ["cat_api"]
    assert diagnostics["sources_called"] == ["cat_api"]
    assert diagnostics["resolved_source"] == "cat_api"
    assert diagnostics["override_reason"] is None
