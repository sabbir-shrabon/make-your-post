# AutoPoster Pipeline System (Poster Engine)

This document provides a deep-dive technical reference for the Poster Design Pipeline as it exists in the codebase today. It traces the actual execution flow, outlines explicit code-level constraints (like the slot system), and documents known limitations and recently fixed bugs.

For the general architecture, refer to `ARCHITECTURE.md`.

---

## 1. Pipeline Overview

The Poster Design Pipeline is the primary generative engine for creating composite social media posters without network-based rendering. It is orchestrated in `backend/app/services/poster_orchestrator.py` via `generatePoster()`.

The pipeline executes sequentially:

1. **Art Director (`app/services/art_director.py`)**: Uses an LLM to select a template, color palette, typography pair, background, and specific foreground elements based on the post topic and mood. It enforces structural constraints and requires a self-checklist (`design_rationale`).
2. **Resource Resolver (`app/services/resource_resolver_unified.py`)**: Translates the Art Director's natural language element descriptions (e.g., "pizza slice") into explicit asset refs (Iconify SVGs, Gemoji characters, Pexels URLs, or Cat API images).
3. **Composition Validator (`app/services/composition_validator.py`)**: A deterministic layout engine that executes safe-zone clamping, text-fit calculations (shrinking font sizes to prevent overflow), and contrast auto-fixing (adjusting overlay opacity based on relative luminance).
4. **Renderer (`app/services/poster_renderer.py`)**: The local zero-network compositing engine. Uses Pillow (`PIL`) to draw layers, render gradients, composite overlays, and rasterize text based on TrueType fonts, ultimately yielding a Base64 PNG.
5. **Vision Critic (`app/services/vision_critic.py`)**: A multi-modal visual inspection pass.

### The Vision Critic Re-Render Loop
The Vision Critic inspects the initially rendered Base64 PNG for visual hierarchy, contrast, and layout issues.
- **Trigger**: The re-render loop is triggered if the critic returns a JSON response where `status == "needs_fix"`.
- **Retry Limit**: There is **exactly one** re-render pass. The orchestrator attempts to apply the critic's suggested patch (via `apply_vision_critic_patch`) which manipulates opacities, font sizes, or vertical positioning (nudge), and re-renders the image.
- **Failure State**: If the subsequent re-render fails the critic's check *again* (or if parsing fails), the pipeline does not loop indefinitely. It accepts the image but assigns a penalized `critic_score` of `0.5` (down from `1.0`), which factors into the candidate's `composite_score` and makes it likely to lose in a best-of-N scenario.

---

## 2. Trigger Paths & Architectural Disconnects

> [!WARNING]
> Currently, there is an architectural divergence in how images are generated.

- **The Poster Studio Path**: Hitting the `/api/poster/assemble-trace` endpoint directly calls `generatePoster()` and runs the **full** Art Director pipeline documented above, including the validator, renderer, and critic.
- **The Auto-Publish Flow (`publish_flow.py`)**: When the background APScheduler worker automatically publishes posts for a persona, it triggers `maybe_generate_image_for_post()` in `publish_image_service.py`. **This path currently bypasses the Art Director pipeline.** Instead, it relies on either the Prompt Studio layer generator (`_run_post_image_generation`) or flat provider generation (e.g., raw Fal.ai/Stability generation) depending on persona settings. Bringing the auto-publish flow into the full Art Director pipeline is an ongoing integration gap.

---

## 3. The Template and Slot Discipline

The visual structure of posters is driven by a rigid **explicit-slot discipline**.
- Templates are defined in `backend/app/data/design-system/templates.json`.
- A template explicitly declares absolute `x`, `y`, `w`, `h` bounding boxes for named slots (e.g., `main_icon`, `corner_badge`).
- The Art Director is **prohibited** from outputting raw coordinates. It can only assign elements to valid slots defined by the chosen template.
- **Badges**: Badges are a specialized, atomic element type (background + content bundled together). If a badge's content fails to resolve, the entire badge (including its background shape) is dropped. They are never rendered empty.

---

## 4. Element Resolution & Fallback States

When `resource_resolver_unified.py` processes the Art Director's elements:
- **Photos**: Reaches out to Pexels via query. **Fallback:** If the photo fetch fails, the renderer silently degrades to the `fallback_type` defined by the Art Director (usually a solid color or gradient).
- **Icons**: Calls Iconify search API. If zero results are returned, it attempts to simplify the query (stripping adjectives), and eventually falls back to a default `lucide:sparkles`.
- **Badges (`render_status`)**: To disambiguate why a badge might not appear, a `render_status` field is used during execution, distinguishing between `dropped_content_resolution` (the inner icon/text couldn't be resolved) versus `dropped_rasterization_failed` (the renderer threw an exception drawing it), which persists into the diagnostic run-log.

---

## 5. Text Fitting, Metrics, and Truncation

The pipeline handles dynamic text wrapping via a recursive shrink loop in `run_text_fit_check`.
- It measures text width and line height using PIL font metrics.
- If the text exceeds the slot's bounding box (`total_height > h` or `max_line_w > w`), it iteratively shrinks the `font_size` by 10% until the text fits or hits a hard floor of `12pt`.
- **Known Limitation**: There is a known difficulty handling single words that are horizontally wider than the bounding box (where line-wrapping fails to help).
- **Fix 1 (Ellipsis Truncation) Status:** This fix **is confirmed implemented** in `composition_validator.py`. If the text still exceeds bounds at the minimum `12pt` font size, `_truncate_text_to_fit` is called. It attempts word-level truncation first, and if the single word is still too wide, falls back to character-level truncation, appending an ellipsis `"..."`.

---

## 6. Contrast and Legibility

- **Current Approach**: `run_contrast_check` calculates relative luminance (WCAG formula) between the text color and the effective blended background. If the contrast ratio is too low (target 3.0 for headlines, 4.5 for subheadlines), it iteratively bumps the dark overlay opacity by `+0.1` up to a maximum cap of `0.85`.
- **Pending (Task 5)**: Color-harmony-first contrast (attempting to swap text colors dynamically using palette variants *before* aggressively dimming the background) **is NOT yet implemented**. The system still heavily relies on the dark overlay opacity crutch.

---

## 7. Diagnostic Logging

For deep observability, every execution of `generatePoster()` writes a comprehensive JSON file to `backend/runs/{run_id}.json`.
This artifact captures:
- The raw output from the Art Director LLM.
- The state of all `resolved_assets`.
- The final overlay opacity post-validation.
- The complete `VisionCriticResponse` (original and fixed).
- Individual aesthetic and composite scores.
This file is the primary tool for debugging why an element was dropped or why a specific fallback triggered.

---

## 8. Known Gaps / Unimplemented Features

### 8a. Not Yet Started
- **Task 2 (Icon-Set Curation)**: The Iconify search is currently unconstrained, sometimes yielding inconsistent icon weights/styles. The proposed icon-set allowlist is pending (and might be rendered moot by bundled-SVG rasterization approaches).
- **Task 4 (Best-of-N Selection)**: While the orchestrator accepts a `candidate_count`, a true "best-of-N" aesthetic tournament using multi-modal comparison is planned but not fully mature.
- **Satori POC**: The proposed architecture to swap the PIL renderer for a Node.js-based Satori subprocess (Option A) has been decided but not yet implemented.

### 8b. Approved But Unconfirmed
*Verified current status in codebase as of August 2026:*
- **Fix 1 (Text-Fit Overflow)**: **Confirmed Done.** The ellipsis truncation workaround is fully implemented in `composition_validator.py`.
- **Fix 2 (Art Director Few-Shot Hardcoded IDs)**: **Confirmed Done.** The system prompt in `art_director.py` correctly uses dynamically injected `random.choice()` IDs (e.g., `{example_template_1}`) rather than hallucination-prone hardcoded IDs.
- **Task A (Details Block / CTA Text)**: **Confirmed Done.** Both `details_block` and `cta_text` schema fields exist in the `ArtDirectorOutput` Pydantic model and the corresponding slots are processed by the orchestrator.

---

## 9. Historical Bug Reference: Badge `render_status` Wiring

**The Bug**: During the initial badge implementation, badges would render as empty colored shapes without their inner text/icons.
**The Cause**: In `poster_orchestrator.py`, when mapping the Art Director's elements to `resolved_asset_refs`, the dict construction was dropping the original fields. Specifically, `badge_text` and `badge_icon` existed on `elem` but were silently discarded when appending the resolved result.
**The Fix**: The dict creation was updated to spread the original element fields before merging the asset references:
```python
resolved_asset_refs.append({
    **elem.model_dump(),
    **asset_ref,
})
```
This post-mortem is retained here as a reference for future pipeline modifications: when mapping Pydantic objects through the resolver layer, always ensure native fields are merged explicitly.
