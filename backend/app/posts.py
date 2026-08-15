from datetime import date, datetime, time, timezone
import logging
from threading import Lock
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.config import (
    ANTHROPIC_API_BASE_URL,
    ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL,
    FACEBOOK_GRAPH_API_BASE_URL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)
from app.crypto import decrypt_token
from app.database import SessionLocal
from app.mistral_service import generate_ai_facebook_post, generate_ai_facebook_post_from_prompt, check_post_quality, extract_post_topic
from app.providers.llm_providers import generate_text_for_user
from app.providers.user_model_settings import MissingProviderKeyError as MissingUserKeyError, generate_post_text_for_user
from app.learning.service import build_learning_prompt_hint, build_strategy_prompt_hint, should_persona_post_now, user_has_learning_access


posting_lock = Lock()
user_posting_locks: set[int] = set()


def build_post_prompt(niche: str) -> str:
    return (
        f"Write a short, engaging Facebook post about {niche}. "
        "Keep it under 150 words, ask a question, include 2 relevant hashtags."
    )





def _persona_post_prompt(
    settings: models.AIPersona,
    db: Session,
    recent_topics: list[str] | None = None,
    topic_hint: str | None = None,
    learning_hint: str | None = None,
    prompt_template_override: str | None = None,
    angle_hint: str | None = None,
) -> tuple[str, str]:
    """Build the post-generation prompt used by the user's AI persona."""
    system_prompt_parts = [
        "You are an expert social media writer. Create polished, platform-ready "
        "Facebook posts that follow the user's saved persona and constraints exactly."
    ]

    # Include niche as context (Step 5)
    if settings.niche:
        system_prompt_parts.append(f"This page is about {settings.niche}. Every post must be relevant to this niche.")

    # Convert tone tags into concrete instruction (Step 5)
    tone_tags = [tag.strip() for tag in settings.tone_tags.split(",") if tag.strip()]
    tone_str = ", ".join(tone_tags) or "clear, useful, friendly"
    system_prompt_parts.append(
        f"The tone of every post must be {tone_str}. Stay consistent with this tone across all posts. Do not drift toward a neutral or generic style."
    )

    # Load persona's linked prompt template (Step 3) or use override
    if prompt_template_override and prompt_template_override.strip():
        system_prompt_parts.append(prompt_template_override.strip())
    else:
        template = None
        if settings.id is not None:
            template = (
                db.query(models.PromptTemplate)
                .filter(models.PromptTemplate.persona_id == settings.id)
                .order_by(models.PromptTemplate.created_at.desc())
                .first()
            )

        if template and template.assembled_prompt and template.assembled_prompt.strip():
            system_prompt_parts.append(template.assembled_prompt.strip())
        else:
            logging.warning(f"No prompt template found for persona {settings.id}, using fallback.")
            fallback_parts = []
            if settings.niche:
                fallback_parts.append(f"Page topic: {settings.niche}.")
            if settings.tone_tags:
                fallback_parts.append(f"Tone: {settings.tone_tags}.")
            if settings.custom_instructions and settings.custom_instructions.strip():
                fallback_parts.append(f"Extra instructions: {settings.custom_instructions.strip()}.")
            if fallback_parts:
                system_prompt_parts.append("\n".join(fallback_parts))

    # Add language instructions at the very end of the system prompt (Step 4)
    if settings.language and settings.language.strip():
        system_prompt_parts.append(
            f"You must write this post entirely in {settings.language.strip()}. "
            f"The post content, hashtags, and any call to action must all be in {settings.language.strip()}. "
            f"Do not use any other language."
        )

    system_prompt = "\n".join(system_prompt_parts)

    instructions: list[str] = []
    instructions.append(f"Length preference: creativity level {settings.creativity_level}/10.")
    
    # Add post length instructions directly to user prompt (not system prompt) to ensure they're applied
    # Extract length settings from persona's prompt_config if available
    if hasattr(settings, 'prompt_config') and settings.prompt_config:
        length = settings.prompt_config.get("length")
        if length and str(length).strip():
            instructions.append(f"Aim for {str(length).strip().lower()} length posts.")
    
    if settings.hashtags_enabled:
        instructions.append(f"Include {max(1, min(settings.hashtag_count, 5))} relevant hashtags.")
    if settings.always_include_engagement_hook:
        instructions.append("End with a natural question or call to action.")

    if recent_topics:
        instructions.append(f"Do not repeat these recent topics: {', '.join(recent_topics)}.")
    if topic_hint:
        instructions.append(f"Focus this post on: {topic_hint.strip()}.")
    if angle_hint:
        instructions.append(f"Incorporate this current angle/context: {angle_hint.strip()}.")
    if learning_hint:
        instructions.append(learning_hint.strip())
    instructions.append("Return only the Facebook post text. No labels, no explanation.")

    return system_prompt, "\n".join(instructions)


def generate_persona_post_with_user_model(
    db: Session,
    settings: models.AIPersona,
    recent_topics: list[str] | None = None,
    topic_hint: str | None = None,
    learning_hint: str | None = None,
    prompt_template_override: str | None = None,
    angle_hint: str | None = None,
) -> str:
    logger = logging.getLogger(__name__)

    if angle_hint is None and getattr(settings, "topic_generation_mode", "creative") == "grounded":
        logger.info(f"Topic generation mode is grounded. Researching angle for niche: {settings.niche}")
        from app.services.topic_research_resolver import research_topic_angle
        fetched_angle, source_log = research_topic_angle(settings.niche, settings.user_id, db)
        if fetched_angle:
            angle_hint = fetched_angle
            logger.info(f"[Diagnostics] {source_log}")
        else:
            logger.warning("Topic research returned no result. Falling back to creative mode.")

    system_prompt, prompt = _persona_post_prompt(
        settings,
        db,
        recent_topics=recent_topics,
        topic_hint=topic_hint,
        learning_hint=learning_hint,
        prompt_template_override=prompt_template_override,
        angle_hint=angle_hint,
    )
    temperature = max(0.1, min(settings.creativity_level / 10, 1.0))
    
    prompt_preview = (system_prompt + "\n\n" + prompt).replace("\n", " ")
    logger.info("[LLM Prompt Preview] persona_id=%s prompt=%s", settings.id, prompt_preview[:100])
    
    try:
        content = generate_post_text_for_user(
            user_id=settings.user_id,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=4096,
            db=db,
        )
    except MissingUserKeyError as e:
        raise RuntimeError(str(e)) from e

    if content is None:
        content = generate_text_for_user(
            user_id=settings.user_id,
            task_category="post_generation",
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=4096,
            db=db,
        )
    if not content or not content.strip():
        raise RuntimeError(
            "Post generation returned empty content. Check your AI model in Settings."
        )
    return content.strip()


def score_post_quality_with_user_model(db: Session, user_id: int, content: str) -> int:
    try:
        score = generate_text_for_user(
            user_id=user_id,
            task_category="post_analysis",
            prompt=(
                "Rate this Facebook post from 1 to 10 for clarity, usefulness, "
                f"and engagement. Return only one integer.\n\n{content}"
            ),
            system_prompt="You are a strict social media quality reviewer.",
            temperature=0.0,
            max_tokens=8,
            db=db,
        )
        if score:
            return max(1, min(10, int("".join(ch for ch in score if ch.isdigit())[:2] or "7")))
    except Exception:
        pass
    return 7


def generate_post_content(niche: str, db: Session | None = None, user_id: int | None = None) -> str:
    if db is not None and user_id is not None:
        system_prompt = "You write concise, friendly social media posts."
        try:
            content = generate_post_text_for_user(
                user_id=user_id,
                prompt=build_post_prompt(niche),
                system_prompt=system_prompt,
                temperature=0.8,
                max_tokens=4096,
                db=db,
            )
        except MissingUserKeyError as e:
            raise RuntimeError(str(e)) from e

        if content is None:
            content = generate_text_for_user(
                user_id=user_id,
                task_category="post_generation",
                prompt=build_post_prompt(niche),
                system_prompt=system_prompt,
                temperature=0.8,
                max_tokens=4096,
                db=db,
            )
        if not content or not content.strip():
            raise RuntimeError("The selected AI model returned empty content.")
        return content.strip()

    if not OPENAI_API_KEY:
        raise RuntimeError("No AI model is configured for post generation.")

    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You write concise, friendly social media posts.",
            },
            {"role": "user", "content": build_post_prompt(niche)},
        ],
        temperature=0.8,
        max_tokens=220,
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    return content.strip()


async def generate_caption_with_claude(prompt: str | None = None) -> str:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    user_prompt = (
        prompt.strip()
        if prompt and prompt.strip()
        else "Write a concise, engaging Facebook caption for a small business page."
    )

    async with httpx.AsyncClient(
        base_url=ANTHROPIC_API_BASE_URL,
        timeout=45,
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
    ) as client:
        response = await client.post(
            "/messages",
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 260,
                "temperature": 0.8,
                "system": (
                    "You write polished Facebook captions. Return only the caption, "
                    "with no labels or commentary."
                ),
                "messages": [{"role": "user", "content": user_prompt}],
            },
        )

    if response.status_code >= 400:
        raise RuntimeError("Claude caption request failed")

    data = response.json()
    blocks = data.get("content", [])
    caption = "".join(
        block.get("text", "")
        for block in blocks
        if block.get("type") == "text"
    ).strip()
    if not caption:
        raise RuntimeError("Claude returned empty content")
    return caption


def get_user_schedule_and_connection(
    db: Session,
    user_id: int,
) -> tuple[models.Schedule, models.FacebookConnection]:
    schedule = db.query(models.Schedule).filter(models.Schedule.user_id == user_id).first()
    if schedule is None:
        raise ValueError("Schedule not found")

    connection = (
        db.query(models.FacebookConnection)
        .filter(models.FacebookConnection.user_id == user_id)
        .first()
    )
    if connection is None:
        raise ValueError("Facebook connection not found")

    return schedule, connection


def create_draft_post(
    db: Session,
    user_id: int,
    content: str,
    connection_id: int,
) -> models.PostLog:
    post_log = models.PostLog(
        user_id=user_id,
        facebook_connection_id=connection_id,
        content=content,
        status="draft",
    )
    db.add(post_log)
    db.commit()
    db.refresh(post_log)
    return post_log


def _resolve_page_access_token(connection: models.FacebookConnection) -> str | None:
    if not connection.page_access_token:
        return None
    token = decrypt_token(connection.page_access_token)
    return token or None


def _mark_connection_needs_reconnection(
    db: Session,
    connection: models.FacebookConnection,
    error_code: int | None,
) -> None:
    if error_code in (190, 102, 200, 463, 467):
        connection.connection_status = "needs-reconnection"
        db.commit()


def _build_facebook_post_request(
    connection: models.FacebookConnection,
    token: str,
    message: str,
    media_urls: list[str] | None = None,
    link_url: str | None = None,
    image_url: str | None = None,
) -> tuple[str, dict[str, str], dict | None, str | None]:
    """
    Build Facebook post request payload.
    Returns: (endpoint, form_data, files_dict_or_None, remote_url_for_binary_fallback_or_None)
    """
    photo_url = image_url
    if not photo_url and media_urls and media_urls[0]:
        photo_url = media_urls[0]

    # If we have a photo AND a link_url, ensure link_url is appended to the caption message
    caption = message
    if photo_url and link_url and link_url.strip() and link_url.strip() not in caption:
        caption = f"{caption.rstrip()}\n\n{link_url.strip()}"

    if photo_url:
        # Case A: Base64 Data URI
        if photo_url.startswith("data:image/"):
            import base64
            try:
                header, encoded = photo_url.split(",", 1)
                content_type = "image/png"
                if "image/jpeg" in header or "image/jpg" in header:
                    content_type = "image/jpeg"
                elif "image/webp" in header:
                    content_type = "image/webp"
                elif "image/gif" in header:
                    content_type = "image/gif"
                img_bytes = base64.b64decode(encoded)
                filename = "poster.jpg" if "jpeg" in content_type else "poster.png"
                files = {"source": (filename, img_bytes, content_type)}
                params = {
                    "message": caption,
                    "access_token": token,
                }
                return f"{connection.page_id}/photos", params, files, None
            except Exception as e:
                logging.warning(f"Failed to decode base64 photo_url: {e}")

        # Case B: Remote URL (e.g. Supabase or external CDN)
        return (
            f"{connection.page_id}/photos",
            {
                "message": caption,
                "url": photo_url,
                "access_token": token,
            },
            None,
            photo_url,
        )

    # Case C: Text / Link-only feed post
    params = {
        "message": message,
        "access_token": token,
    }
    if link_url:
        params["link"] = link_url
    return f"{connection.page_id}/feed", params, None, None


async def _post_to_facebook_graph_api(
    endpoint: str,
    params: dict[str, str],
    files: dict | None = None,
    fallback_url: str | None = None,
    token: str | None = None,
) -> httpx.Response:
    """
    Executes a POST request to Facebook Graph API with automatic binary upload fallback
    if URL ingestion fails.
    """
    timeout = 45.0
    async with httpx.AsyncClient(base_url=FACEBOOK_GRAPH_API_BASE_URL, timeout=timeout) as client:
        if files:
            response = await client.post(endpoint, data=params, files=files)
        else:
            response = await client.post(endpoint, data=params)

        # If Facebook failed to download image from the provided URL, fallback to downloading
        # the bytes ourselves and uploading directly as binary (multipart form-data 'source')
        if response.status_code >= 400 and fallback_url and endpoint.endswith("/photos"):
            err_code = _facebook_error_code(response)
            err_msg = response.text.lower()
            if err_code == 100 or "download" in err_msg or "url" in err_msg or "param" in err_msg:
                try:
                    logging.info(f"Facebook URL fetch failed. Attempting direct binary upload for {fallback_url[:80]}...")
                    async with httpx.AsyncClient(timeout=30) as dl_client:
                        dl_resp = await dl_client.get(fallback_url)
                        if dl_resp.status_code == 200 and dl_resp.content:
                            c_type = dl_resp.headers.get("content-type", "image/png").split(";")[0].strip()
                            if not c_type.startswith("image/"):
                                c_type = "image/png"
                            fname = "poster.jpg" if "jpeg" in c_type else "poster.png"
                            retry_files = {"source": (fname, dl_resp.content, c_type)}
                            retry_params = {
                                "message": params.get("message", ""),
                                "access_token": token or params.get("access_token", ""),
                            }
                            retry_resp = await client.post(endpoint, data=retry_params, files=retry_files)
                            if retry_resp.status_code < 400:
                                logging.info("Direct binary upload fallback succeeded.")
                                return retry_resp
                except Exception as fallback_exc:
                    logging.warning(f"Direct binary upload fallback attempt failed: {fallback_exc}")

        return response


async def verify_page_connection_for_publish(
    db: Session,
    connection: models.FacebookConnection,
) -> str:
    if connection.connection_status != "connected":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your Facebook connection has expired. Please reconnect your page in Settings.",
        )

    token = _resolve_page_access_token(connection)
    if not token:
        connection.connection_status = "needs-reconnection"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your Facebook page access token is missing. Please reconnect in Settings.",
        )

    async with httpx.AsyncClient(base_url=FACEBOOK_GRAPH_API_BASE_URL, timeout=20) as client:
        response = await client.get(
            str(connection.page_id),
            params={"fields": "id", "access_token": token},
        )

    if response.status_code >= 400:
        error_code = _facebook_error_code(response)
        _mark_connection_needs_reconnection(db, connection, error_code)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=_facebook_publish_error_message(response),
        )

    return token


async def _upload_single_photo_to_facebook(
    page_id: str,
    token: str,
    photo_item: str,
    published: bool = True,
    caption: str | None = None,
) -> tuple[str | None, str | None]:
    """
    Upload a single photo to /{page_id}/photos.
    Returns (photo_id, error_message).
    """
    endpoint = f"{page_id}/photos"
    params: dict[str, str] = {
        "access_token": token,
        "published": "true" if published else "false",
    }
    if caption:
        params["message"] = caption

    files = None
    fallback_url = None

    if photo_item.startswith("data:image/"):
        import base64
        try:
            header, encoded = photo_item.split(",", 1)
            content_type = "image/png"
            if "image/jpeg" in header or "image/jpg" in header:
                content_type = "image/jpeg"
            elif "image/webp" in header:
                content_type = "image/webp"
            elif "image/gif" in header:
                content_type = "image/gif"
            img_bytes = base64.b64decode(encoded)
            filename = "poster.jpg" if "jpeg" in content_type else "poster.png"
            files = {"source": (filename, img_bytes, content_type)}
        except Exception as e:
            return None, f"Failed to decode base64 image: {e}"
    else:
        params["url"] = photo_item
        fallback_url = photo_item

    response = await _post_to_facebook_graph_api(
        endpoint=endpoint,
        params=params,
        files=files,
        fallback_url=fallback_url,
        token=token,
    )

    if response.status_code < 400:
        data = response.json()
        photo_id = data.get("id") or data.get("post_id")
        return str(photo_id) if photo_id else None, None

    err_msg = _facebook_publish_error_message(response)
    return None, err_msg


async def _publish_payload_to_facebook(
    connection: models.FacebookConnection,
    token: str,
    message: str,
    media_urls: list[str] | None = None,
    link_url: str | None = None,
    image_url: str | None = None,
) -> tuple[bool, str | None, str | None]:
    """
    Publishes single photo, multi-photo carousel, or feed post to Facebook.
    Returns: (success: bool, facebook_post_id: str | None, error_message: str | None)
    """
    valid_media: list[str] = []
    if image_url and image_url.strip():
        valid_media.append(image_url.strip())
    if media_urls:
        for m in media_urls:
            if m and m.strip() and m.strip() not in valid_media:
                valid_media.append(m.strip())

    caption = message
    if valid_media and link_url and link_url.strip() and link_url.strip() not in caption:
        caption = f"{caption.rstrip()}\n\n{link_url.strip()}"

    # Scenario 1: Multi-photo batch (> 1 photos)
    if len(valid_media) > 1:
        uploaded_photo_ids = []
        last_error = None
        for idx, media_item in enumerate(valid_media):
            photo_id, err = await _upload_single_photo_to_facebook(
                page_id=str(connection.page_id),
                token=token,
                photo_item=media_item,
                published=False,
            )
            if photo_id:
                uploaded_photo_ids.append(photo_id)
            else:
                last_error = err
                logging.warning(f"Failed to upload photo {idx} in multi-photo batch: {err}")

        if uploaded_photo_ids:
            import json
            feed_params: dict[str, str] = {
                "message": caption,
                "access_token": token,
            }
            for i, pid in enumerate(uploaded_photo_ids):
                feed_params[f"attached_media[{i}]"] = json.dumps({"media_fbid": pid})

            feed_resp = await _post_to_facebook_graph_api(
                endpoint=f"{connection.page_id}/feed",
                params=feed_params,
                token=token,
            )
            if feed_resp.status_code < 400:
                data = feed_resp.json()
                f_id = data.get("id") or data.get("post_id")
                return True, str(f_id) if f_id else None, None
            else:
                return False, None, _facebook_publish_error_message(feed_resp)
        elif last_error:
            return False, None, last_error

    # Scenario 2: Single photo post (1 photo)
    if len(valid_media) == 1:
        photo_id, err = await _upload_single_photo_to_facebook(
            page_id=str(connection.page_id),
            token=token,
            photo_item=valid_media[0],
            published=True,
            caption=caption,
        )
        if photo_id:
            return True, photo_id, None
        return False, None, err

    # Scenario 3: Text or Link feed post (0 photos)
    feed_params = {
        "message": message,
        "access_token": token,
    }
    if link_url:
        feed_params["link"] = link_url

    response = await _post_to_facebook_graph_api(
        endpoint=f"{connection.page_id}/feed",
        params=feed_params,
        token=token,
    )
    if response.status_code < 400:
        data = response.json()
        f_id = data.get("id") or data.get("post_id")
        return True, str(f_id) if f_id else None, None

    return False, None, _facebook_publish_error_message(response)


async def publish_post_to_facebook(
    db: Session,
    post_log: models.PostLog,
    connection: models.FacebookConnection,
    post_date: date | None = None,
) -> bool:
    token = _resolve_page_access_token(connection)
    if not token:
        post_log.status = "failed"
        post_log.error_message = "Facebook page access token is missing. Please reconnect in Settings."
        post_log.publish_error = post_log.error_message
        post_log.retry_count += 1
        db.commit()
        return False

    image_url = None
    if post_log.media_library_id:
        media = db.query(models.MediaLibrary).filter(models.MediaLibrary.id == post_log.media_library_id).first()
        if media and media.image_url:
            image_url = media.image_url
            media.is_used = True
            media.used_in_post_id = post_log.id
            db.commit()
    if not image_url and post_log.image_url:
        image_url = post_log.image_url

    success, facebook_post_id, error_message = await _publish_payload_to_facebook(
        connection=connection,
        token=token,
        message=post_log.content,
        media_urls=post_log.media_urls,
        link_url=post_log.link_url,
        image_url=image_url,
    )

    if success and facebook_post_id:
        posted_at = datetime.now(timezone.utc)
        post_log.status = "published"
        post_log.error_message = None
        post_log.publish_error = None
        post_log.posted_at = posted_at
        post_log.published_at = posted_at
        post_log.post_date = post_date or posted_at.date()
        post_log.facebook_post_id = facebook_post_id
        post_log.facebook_post_url = f"https://www.facebook.com/{facebook_post_id}"
        db.commit()
        return True

    error_code = None
    if error_message and ("expired" in error_message.lower() or "permission" in error_message.lower()):
        error_code = 190
    _mark_connection_needs_reconnection(db, connection, error_code)

    post_log.status = "failed"
    post_log.error_message = error_message or "Facebook publish failed."
    post_log.publish_error = post_log.error_message
    post_log.retry_count += 1
    db.commit()
    return False


def _facebook_error_code(response: httpx.Response) -> int | None:
    try:
        import json
        return json.loads(response.text).get("error", {}).get("code")
    except Exception:
        return None


def _facebook_publish_error_message(response: httpx.Response) -> str:
    error_text = response.text
    try:
        import json
        data = json.loads(error_text)
        error_data = data.get("error", {})
        error_code = error_data.get("code")
        error_subcode = error_data.get("error_subcode")
        raw_message = error_data.get("message") or error_text
    except Exception:
        error_code = None
        error_subcode = None
        raw_message = error_text

    if error_code == 190:
        if error_subcode == 460:
            return "Your Facebook session expired because your password was changed. Please reconnect your page."
        if error_subcode == 463:
            return "Your Facebook token has expired. Please reconnect your page in Settings."
        if error_subcode == 467:
            return "Invalid Facebook access token. Please reconnect your page in Settings."
        return "Your Facebook connection has expired or was revoked. Please reconnect your page in Settings."

    if error_code == 200:
        return (
            "Facebook Permission Error: The connected Facebook account lacks 'CREATE_CONTENT' permission "
            "on this Page, or the Meta App requires App Review approval for 'pages_manage_posts'."
        )

    if error_code == 100:
        if error_subcode == 33 or "download" in raw_message.lower():
            return "Facebook could not download the image from the storage URL. The image was re-sent or may need to be uploaded again."
        if "url" in raw_message.lower():
            return f"Invalid image URL provided to Facebook: {raw_message}"
        return f"Facebook rejected post parameters: {raw_message}"

    if error_code == 368:
        return "Facebook temporarily blocked posting for this page due to repeated actions or spam policies. Please wait and try again later."

    if error_code in (4, 17, 32):
        return "Facebook API rate limit reached. Please wait a few minutes before publishing again."

    if error_code == 506:
        return "Duplicate post: Facebook rejected this post because identical content was published recently."

    if error_code == 1:
        return "Facebook temporary server error. Please retry in a few moments."

    return raw_message


async def publish_message_to_facebook(
    db: Session,
    user_id: int,
    connection: models.FacebookConnection,
    message: str,
    media_urls: list[str] | None = None,
    link_url: str | None = None,
    link_preview_data: dict | None = None,
) -> tuple[bool, models.PostLog, str | None]:
    token = _resolve_page_access_token(connection)
    post_log = models.PostLog(
        user_id=user_id,
        facebook_connection_id=connection.id,
        content=message,
        status="draft",
        media_urls=media_urls or [],
        link_url=link_url,
        link_preview_data=link_preview_data,
    )
    db.add(post_log)
    db.flush()

    if not token:
        post_log.status = "failed"
        post_log.error_message = "Facebook page access token is missing. Please reconnect in Settings."
        post_log.publish_error = post_log.error_message
        post_log.retry_count += 1
        db.commit()
        db.refresh(post_log)
        return False, post_log, None

    success, facebook_post_id, error_message = await _publish_payload_to_facebook(
        connection=connection,
        token=token,
        message=message,
        media_urls=media_urls,
        link_url=link_url,
    )

    if success and facebook_post_id:
        posted_at = datetime.now(timezone.utc)
        post_log.status = "published"
        post_log.error_message = None
        post_log.publish_error = None
        post_log.posted_at = posted_at
        post_log.published_at = posted_at
        post_log.post_date = posted_at.date()
        post_log.facebook_post_id = facebook_post_id
        post_log.facebook_post_url = f"https://www.facebook.com/{facebook_post_id}"
        db.commit()
        db.refresh(post_log)
        return True, post_log, post_log.facebook_post_url

    error_code = None
    if error_message and ("expired" in error_message.lower() or "permission" in error_message.lower()):
        error_code = 190
    _mark_connection_needs_reconnection(db, connection, error_code)

    post_log.status = "failed"
    post_log.error_message = error_message or "Facebook publish failed."
    post_log.publish_error = post_log.error_message
    post_log.retry_count += 1
    db.commit()
    db.refresh(post_log)
    return False, post_log, None


def already_posted_today(db: Session, user_id: int, today: date) -> bool:
    return (
        db.query(models.PostLog)
        .filter(
            models.PostLog.user_id == user_id,
            models.PostLog.status.in_(["published", "success"]),
            models.PostLog.post_date == today,
        )
        .first()
        is not None
    )


def schedule_matches_now(schedule: models.Schedule, now_utc: datetime) -> tuple[bool, date]:
    try:
        schedule_timezone = ZoneInfo(schedule.timezone)
    except ZoneInfoNotFoundError:
        schedule_timezone = ZoneInfo("UTC")

    local_now = now_utc.astimezone(schedule_timezone)
    try:
        scheduled_time = time.fromisoformat(schedule.post_time)
    except ValueError:
        return False, local_now.date()

    scheduled_now = local_now.replace(
        hour=scheduled_time.hour,
        minute=scheduled_time.minute,
        second=0,
        microsecond=0,
    )
    seconds_since_scheduled_time = (local_now - scheduled_now).total_seconds()
    return 0 <= seconds_since_scheduled_time < 600, local_now.date()


def try_claim_user_posting(user_id: int) -> bool:
    with posting_lock:
        if user_id in user_posting_locks:
            return False
        user_posting_locks.add(user_id)
        return True


def release_user_posting(user_id: int) -> None:
    with posting_lock:
        user_posting_locks.discard(user_id)


def clear_all_user_posting_locks() -> None:
    """Clear all user posting locks. Call this on server startup to recover from crashes."""
    with posting_lock:
        user_posting_locks.clear()


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


async def run_scheduled_posts() -> None:
    from datetime import timedelta
    now_utc = datetime.now(timezone.utc)
    print(f"Scheduler triggered via cron endpoint at {now_utc}")
    db = SessionLocal()
    try:
        due_posts = (
            db.query(models.PostLog)
            .filter(
                models.PostLog.status == "scheduled",
                models.PostLog.scheduled_at <= now_utc,
                (models.PostLog.qstash_message_id == None) | (models.PostLog.qstash_message_id == ""),
            )
            .all()
        )
        cutoff_time = now_utc - timedelta(hours=12)
        for post_log in due_posts:
            scheduled_at = _as_utc(post_log.scheduled_at)
            if scheduled_at is None:
                post_log.status = "failed"
                post_log.error_message = "Scheduled post is missing a scheduled time."
                post_log.publish_error = post_log.error_message
                db.commit()
                continue

            if scheduled_at < cutoff_time:
                post_log.status = "missed"
                post_log.error_message = "Post missed its scheduling window (older than 12 hours)."
                db.commit()
                print(f"Marked post {post_log.id} as missed (scheduled at {post_log.scheduled_at})")
                continue

            connection = db.get(models.FacebookConnection, post_log.facebook_connection_id)
            if connection is None or connection.connection_status != "connected":
                post_log.status = "failed"
                post_log.error_message = "Facebook page is not connected"
                post_log.publish_error = post_log.error_message
                db.commit()
                continue
            post_log.status = "publishing"
            db.commit()
            await publish_post_to_facebook(db, post_log, connection)

        from app.services.schedule_service import process_due_persona_slots
        await process_due_persona_slots(db)

        schedules = db.query(models.Schedule).filter(models.Schedule.active.is_(True)).all()
        for schedule in schedules:
            should_post, local_today = schedule_matches_now(schedule, now_utc)
            if not should_post or not try_claim_user_posting(schedule.user_id):
                continue

            try:
                if already_posted_today(db, schedule.user_id, local_today):
                    continue

                connection = (
                    db.query(models.FacebookConnection)
                    .filter(models.FacebookConnection.user_id == schedule.user_id)
                    .first()
                )
                if connection is None:
                    continue

                content = generate_post_content(schedule.niche, db, schedule.user_id)
                post_log = create_draft_post(
                    db,
                    schedule.user_id,
                    content,
                    connection.id,
                )
                await publish_post_to_facebook(db, post_log, connection, local_today)
            finally:
                release_user_posting(schedule.user_id)

        # Active personas are now scheduled and processed via QStash webhook instead of polling.
        # await run_auto_ai_posts(db, now_utc)
    finally:
        db.close()


def _local_now_for_user(user: models.User, now_utc: datetime) -> datetime:
    try:
        return now_utc.astimezone(ZoneInfo(user.timezone))
    except ZoneInfoNotFoundError:
        return now_utc.astimezone(ZoneInfo("UTC"))


def _persona_matches_current_slot(persona: models.AIPersona, local_now: datetime) -> bool:
    if local_now.strftime("%a") not in persona.assigned_days.split(","):
        return False
    for slot in persona.posting_time_slots or []:
        try:
            slot_time = time.fromisoformat(slot)
        except ValueError:
            continue
        scheduled_at = local_now.replace(hour=slot_time.hour, minute=slot_time.minute, second=0, microsecond=0)
        if 0 <= (local_now - scheduled_at).total_seconds() < 300:
            return True
    return False


def _persona_priority_value(persona: models.AIPersona) -> int:
    return {"High": 3, "Normal": 2, "Low": 1}.get(persona.priority_level, 2)


async def run_auto_ai_posts(db: Session, now_utc: datetime) -> None:
    page_ids = [
        row[0]
        for row in db.query(models.AIPersona.page_connection_id)
        .filter(models.AIPersona.is_active.is_(True))
        .distinct()
        .all()
    ]
    for page_id in page_ids:
        connection = db.get(models.FacebookConnection, page_id)
        user = db.get(models.User, connection.user_id) if connection else None
        if connection is None or user is None or connection.connection_status != "connected":
            continue

        local_now = _local_now_for_user(user, now_utc)
        matching_personas = [
            persona
            for persona in db.query(models.AIPersona)
            .filter(
                models.AIPersona.page_connection_id == connection.id,
                models.AIPersona.is_active.is_(True),
            )
            .all()
            if _persona_matches_current_slot(persona, local_now)
        ]
        if user_has_learning_access(user):
            matching_personas = [persona for persona in matching_personas if should_persona_post_now(persona)]
        if not matching_personas:
            continue
        settings = sorted(
            matching_personas,
            key=lambda persona: (_persona_priority_value(persona), float(persona.performance_score or 0)),
            reverse=True,
        )[0]

        try:
            # Fix 6 — Topic rotation: fetch last 5 topics for this page
            recent_topics = [
                row[0]
                for row in db.query(models.PostLog.topic)
                .filter(
                    models.PostLog.facebook_connection_id == connection.id,
                    models.PostLog.topic.isnot(None),
                )
                .order_by(models.PostLog.created_at.desc())
                .limit(5)
                .all()
            ]

            # Fix 7 — Quality score check loop (up to 3 attempts)
            content = ""
            max_attempts = 3
            for attempt in range(max_attempts):
                hint_parts = [
                    build_learning_prompt_hint(db, settings) if user_has_learning_access(user) else None,
                    build_strategy_prompt_hint(db, settings),
                ]
                learning_hint = " ".join(part for part in hint_parts if part)
                content = generate_persona_post_with_user_model(
                    db,
                    settings,
                    recent_topics=recent_topics,
                    learning_hint=learning_hint,
                )
                score = score_post_quality_with_user_model(db, settings.user_id, content)
                if score >= 6:
                    break
                print(f"Auto post scored {score}/10 (below 6), regenerating (attempt {attempt + 1}/{max_attempts})...")

            # Extract topic for rotation memory
            topic = extract_post_topic(content)

            post_log = models.PostLog(
                user_id=settings.user_id,
                facebook_connection_id=connection.id,
                content=content,
                status="draft",
                ai_generated=True,
                auto_generated=True,
                ai_persona_id=settings.id,
                topic=topic,
            )
            db.add(post_log)
            db.flush()

            # Optional: Image Generation Layer
            if settings.include_image:
                import time
                import asyncio
                import uuid
                from app.routers.images import async_upload_to_supabase, generate_template_layered_image
                from app.providers.image_providers import get_image_provider_for_user

                # Check frequency
                total_posts = settings.total_posts_published
                should_generate = False
                freq = settings.image_frequency
                if freq == "every_post":
                    should_generate = True
                elif freq == "every_other" and total_posts % 2 == 0:
                    should_generate = True
                elif freq == "1_in_3" and total_posts % 3 == 2:
                    should_generate = True
                elif freq == "1_in_5" and total_posts % 5 == 4:
                    should_generate = True
                elif freq == "weekends_only" and local_now.weekday() >= 5:
                    should_generate = True

                if should_generate:
                    # Check if template-based generation is enabled
                    if settings.template_image_generation_enabled:
                        # Use template-based layered image generation
                        template_settings = db.query(models.ImagePromptSettings).filter(
                            models.ImagePromptSettings.persona_id == settings.id
                        ).first()

                        if template_settings and template_settings.template_layers_json:
                            try:
                                media_id, image_url, _ = await generate_template_layered_image(
                                    persona_id=settings.id,
                                    post_text=content,
                                    topic_hint=topic,
                                    db=db,
                                    user_id=settings.user_id
                                )
                                post_log.media_library_id = media_id
                                print(f"Template image generation for persona {settings.persona_name}: status=success")
                            except Exception as e:
                                print(f"Template image generation for persona {settings.persona_name}: status=failed error={str(e)}")
                                # Apply fallback policy
                                if settings.image_fallback_policy == "skip_post":
                                    post_log.status = "missed"
                                    post_log.error_message = f"template_image_generation_failed: {str(e)}"
                                    db.commit()
                                    continue
                                elif settings.image_fallback_policy == "use_library":
                                    any_unused = db.query(models.MediaLibrary).filter(
                                        models.MediaLibrary.user_id == settings.user_id,
                                        models.MediaLibrary.is_used == False
                                    ).order_by(models.MediaLibrary.created_at.asc()).first()
                                    if any_unused:
                                        post_log.media_library_id = str(any_unused.id)
                                # text_only: continue without image
                        else:
                            # Template not analyzed, fall back to simple generation
                            print(f"Template not analyzed for persona {settings.persona_name}, falling back to simple generation")
                            # Continue to simple generation below
                    else:
                        # Simple image generation (existing logic)
                        image_prompt = None
                        if settings.image_prompt_source == "persona_prompt":
                            psettings = db.query(models.ImagePromptSettings).filter(models.ImagePromptSettings.persona_id == settings.id).first()
                            if psettings and psettings.assembled_prompt:
                                image_prompt = psettings.assembled_prompt
                        elif settings.image_prompt_source == "generate_from_post":
                            from app.providers.llm_providers import generate_text_for_user
                            sys_p = "You are an expert at writing prompts for AI image generation. Given a social media post text, write a detailed image generation prompt that would create the perfect visual to accompany that post. The image should enhance the post's message without containing any text. Return only the image generation prompt, nothing else, maximum 150 words."
                            image_prompt = generate_text_for_user(
                                user_id=settings.user_id,
                                task_category="image_prompt_generation",
                                prompt=content,
                                system_prompt=sys_p,
                                db=db,
                                temperature=0.7,
                                max_tokens=200,
                            )
                            if image_prompt:
                                image_prompt = image_prompt.strip()
                        elif settings.image_prompt_source == "library_image":
                            oldest_unused = db.query(models.MediaLibrary).filter(
                                models.MediaLibrary.persona_id == settings.id,
                                models.MediaLibrary.is_used == False
                            ).order_by(models.MediaLibrary.created_at.asc()).first()
                            if oldest_unused:
                                post_log.media_library_id = str(oldest_unused.id)
                            else:
                                # Fallback to generate_from_post
                                from app.providers.llm_providers import generate_text_for_user
                                sys_p = "You are an expert at writing prompts for AI image generation. Given a social media post text, write a detailed image generation prompt that would create the perfect visual to accompany that post. The image should enhance the post's message without containing any text. Return only the image generation prompt, nothing else, maximum 150 words."
                                image_prompt = generate_text_for_user(
                                    user_id=settings.user_id,
                                    task_category="image_prompt_generation",
                                    prompt=content,
                                    system_prompt=sys_p,
                                    db=db,
                                    temperature=0.7,
                                    max_tokens=200,
                                )
                                if image_prompt:
                                    image_prompt = image_prompt.strip

                        if image_prompt and not post_log.media_library_id:
                            provider_inst, model_name, api_key = get_image_provider_for_user(settings.user_id, db)
                            provider_name = provider_inst.__class__.__name__.replace('Provider', '').lower()
                            start_img_t = time.time()
                            try:
                                import asyncio
                                import uuid
                                async def _gen():
                                    return await asyncio.to_thread(
                                        provider_inst.generate,
                                        prompt=image_prompt,
                                        negative_prompt="",
                                        aspect_ratio="1:1",
                                        model_name=model_name,
                                        api_key=api_key,
                                    )
                                img_bytes = await asyncio.wait_for(
                                    _gen(),
                                    timeout=max(10, min(settings.image_max_wait_seconds or 120, 180)),
                                )
                                job_id_str = str(uuid.uuid4())
                                filename = f"{settings.user_id}/{job_id_str}.png"
                                pub_url = await async_upload_to_supabase(filename, img_bytes)

                                media = models.MediaLibrary(
                                    user_id=settings.user_id,
                                    persona_id=settings.id,
                                    image_url=pub_url,
                                    storage_path=filename,
                                    generation_prompt=image_prompt,
                                    provider=provider_name,
                                    model_name=model_name,
                                )
                                db.add(media)
                                db.flush()
                                post_log.media_library_id = str(media.id)
                                elapsed = int(time.time() - start_img_t)
                                print(f"Auto image generation for persona {settings.persona_name}: provider={provider_name} status=success seconds={elapsed}")
                            except asyncio.TimeoutError:
                                elapsed = int(time.time() - start_img_t)
                                print(f"Auto image generation for persona {settings.persona_name}: provider={provider_name} status=timeout seconds={elapsed}")
                                if settings.image_fallback_policy == "skip_post":
                                    post_log.status = "missed"
                                    post_log.error_message = "image_generation_failed (timeout)"
                                    db.commit()
                                    continue
                                elif settings.image_fallback_policy == "use_library":
                                    any_unused = db.query(models.MediaLibrary).filter(
                                        models.MediaLibrary.user_id == settings.user_id,
                                        models.MediaLibrary.is_used == False
                                    ).order_by(models.MediaLibrary.created_at.asc()).first()
                                    if any_unused:
                                        post_log.media_library_id = str(any_unused.id)
                            except Exception as e:
                                elapsed = int(time.time() - start_img_t)
                                print(f"Auto image generation for persona {settings.persona_name}: provider={provider_name} status=failed seconds={elapsed}")
                                if settings.image_fallback_policy == "skip_post":
                                    post_log.status = "missed"
                                    post_log.error_message = "image_generation_failed (error)"
                                    db.commit()
                                    continue
                                elif settings.image_fallback_policy == "use_library":
                                    any_unused = db.query(models.MediaLibrary).filter(
                                        models.MediaLibrary.user_id == settings.user_id,
                                        models.MediaLibrary.is_used == False
                                    ).order_by(models.MediaLibrary.created_at.asc()).first()
                                    if any_unused:
                                        post_log.media_library_id = str(any_unused.id)

            success = await publish_post_to_facebook(db, post_log, connection, local_now.date())
            settings.last_auto_post_at = now_utc
            settings.consecutive_failures = 0 if success else settings.consecutive_failures + 1
            if success:
                settings.total_posts_published += 1
            db.commit()
        except Exception as exc:
            settings.consecutive_failures += 1
            db.commit()
            print(f"Auto AI posting failed for page {settings.page_connection_id}: {exc}")
            if settings.consecutive_failures >= 3:
                print(
                    "Auto AI posting has failed three times for "
                    f"user {settings.user_id}, page {settings.page_connection_id}. "
                    "Email notification is not configured."
                )
