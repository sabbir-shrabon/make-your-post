"""Facebook page connect and disconnect flow."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import (
    ALGORITHM,
    FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET,
    FACEBOOK_OAUTH_SCOPES,
    FACEBOOK_REDIRECT_URI,
    FRONTEND_URL,
    SECRET_KEY,
)
from app.crypto import encrypt_token, decrypt_token

logger = logging.getLogger(__name__)

# Global registry for polling OAuth status (session_id -> {"status": "pending|success|error", "message": "..."})
oauth_polling_sessions: dict[str, dict] = {}

FACEBOOK_OAUTH_GRAPH_VERSION = "v18.0"
FACEBOOK_GRAPH_OAUTH_BASE = f"https://graph.facebook.com/{FACEBOOK_OAUTH_GRAPH_VERSION}"
FACEBOOK_DIALOG_OAUTH_BASE = f"https://www.facebook.com/{FACEBOOK_OAUTH_GRAPH_VERSION}/dialog/oauth"

def _create_oauth_state(db: Session, user_id: int) -> str:
    """Create and store OAuth state in database."""
    state = secrets.token_hex(16)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    oauth_state = models.OAuthState(
        id=state,
        user_id=user_id,
        state=state,
        expires_at=expires_at,
    )
    db.add(oauth_state)
    db.commit()
    return state


def _verify_oauth_state(db: Session, state: str) -> int | None:
    """Verify OAuth state and return user_id if valid."""
    oauth_state = (
        db.query(models.OAuthState)
        .filter(
            models.OAuthState.state == state,
            models.OAuthState.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if oauth_state:
        user_id = oauth_state.user_id
        db.delete(oauth_state)
        db.commit()
        return user_id
    return None


def _cleanup_expired_oauth_states(db: Session) -> None:
    """Clean up expired OAuth states."""
    db.query(models.OAuthState).filter(
        models.OAuthState.expires_at <= datetime.now(timezone.utc)
    ).delete()
    db.commit()


def _facebook_error(message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
    raise HTTPException(status_code=status_code, detail=message)


def current_user_from_popup_token(token: str, db: Session) -> models.User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    user = db.get(models.User, int(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return user


def _clear_oauth_session(request: Request) -> None:
    for key in ("oauth_state", "oauth_user_id", "oauth_pending_pages", "oauth_token_expires_at"):
        request.session.pop(key, None)


def _popup_error_html(message: str) -> HTMLResponse:
    return HTMLResponse(
        f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Connection Error</title>
  <style>
    body {{ font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }}
    .card {{ background: white; padding: 24px; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 400px; text-align: center; border: 1px solid #e2e8f0; }}
    h2 {{ color: #dc2626; margin-top: 0; font-size: 18px; }}
    p {{ color: #475569; font-size: 14px; line-height: 1.5; margin: 12px 0 20px 0; }}
    button {{ background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }}
    button:hover {{ background: #1d4ed8; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>Facebook Connection Issue</h2>
    <p>{message}</p>
    <button onclick="window.close()">Close Window</button>
  </div>
</body>
</html>"""
    )


def _popup_success_html(page_id: str) -> HTMLResponse:
    return HTMLResponse(
        """<!doctype html><html><body><script>
        window.close();
        </script></body></html>"""
    )


def _page_picker_html(pages: list[dict], session_id: str | None = None) -> HTMLResponse:
    cards = "".join(
        f"""
        <button type="submit" name="page_id" value="{page['page_id']}"
          style="display:block;width:100%;margin:8px 0;padding:12px;text-align:left;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">
          <strong>{page['page_name']}</strong>
        </button>
        """
        for page in pages
    )
    session_input = f'<input type="hidden" name="session_id" value="{session_id}">' if session_id else ""
    return HTMLResponse(
        f"""<!doctype html><html><body style="font-family:system-ui;padding:24px;">
        <h1>Select Facebook Page</h1>
        <form method="post" action="/auth/facebook/select-page">
          {session_input}
          {cards}
        </form></body></html>"""
    )


def _page_picture_url(page: dict) -> str:
    picture = page.get("picture") or {}
    if isinstance(picture, dict):
        data = picture.get("data") or {}
        if isinstance(data, dict) and data.get("url"):
            return data["url"]
    page_id = page.get("page_id") or page.get("id")
    if page_id:
        return f"https://graph.facebook.com/{page_id}/picture?type=large"
    return ""


async def _exchange_code_for_token(code: str) -> tuple[str, dict | None]:
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            f"{FACEBOOK_GRAPH_OAUTH_BASE}/oauth/access_token",
            data={
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "redirect_uri": FACEBOOK_REDIRECT_URI,
                "code": code,
            },
        )
        if token_response.status_code >= 400:
            logger.warning("Facebook code exchange failed: %s", token_response.text[:200])
            return "", None

        short_lived_token = token_response.json().get("access_token")
        if not short_lived_token:
            return "", None

        long_lived_response = await client.get(
            f"{FACEBOOK_GRAPH_OAUTH_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": FACEBOOK_APP_ID,
                "client_secret": FACEBOOK_APP_SECRET,
                "fb_exchange_token": short_lived_token,
            },
        )
        if long_lived_response.status_code >= 400:
            logger.warning(
                "Long-lived token exchange failed for user; proceeding with short-lived token"
            )
            return short_lived_token, None

        token_data = long_lived_response.json()
        long_lived_token = token_data.get("access_token") or short_lived_token
        return long_lived_token, token_data


async def _fetch_managed_pages(access_token: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        pages_response = await client.get(
            f"{FACEBOOK_GRAPH_OAUTH_BASE}/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,picture,access_token",
            },
        )
        if pages_response.status_code >= 400:
            logger.warning("Could not fetch Facebook pages: %s", pages_response.text[:200])
            return []

    pages: list[dict] = []
    for page in pages_response.json().get("data", []):
        page_id = page.get("id")
        page_name = page.get("name")
        page_access_token = page.get("access_token")
        if not page_id or not page_name or not page_access_token:
            continue
        pages.append(
            {
                "page_id": str(page_id),
                "page_name": str(page_name),
                "page_access_token": str(page_access_token),
                "picture": page.get("picture"),
            }
        )
    return pages


def _resume_paused_posts(db: Session, connection: models.FacebookConnection) -> int:
    now = datetime.now(timezone.utc)
    missed = (
        db.query(models.PostLog)
        .filter(
            models.PostLog.facebook_connection_id == connection.id,
            models.PostLog.status == "paused",
            models.PostLog.scheduled_at.isnot(None),
            models.PostLog.scheduled_at <= now,
        )
        .all()
    )
    for post in missed:
        post.status = "missed"
        post.updated_at = now

    # Get posts to resume
    posts_to_resume = (
        db.query(models.PostLog)
        .filter(
            models.PostLog.facebook_connection_id == connection.id,
            models.PostLog.status == "paused",
            models.PostLog.scheduled_at.isnot(None),
            models.PostLog.scheduled_at > now,
        )
        .all()
    )
    
    resumed_count = 0
    for post in posts_to_resume:
        post.status = "scheduled"
        post.delivery_status = "pending"
        post.updated_at = now
        resumed_count += 1
    
    if resumed_count:
        logger.info("Resumed %s paused posts for page %s", resumed_count, connection.page_name)
        db.commit()
    
    return resumed_count


def save_or_update_page_connection(
    db: Session,
    user_id: int,
    selected_page: dict,
    token_expires_at: datetime | None = None,
) -> models.FacebookConnection:
    page_id = selected_page["page_id"]
    now = datetime.now(timezone.utc)

    existing = (
        db.query(models.FacebookConnection)
        .filter(
            models.FacebookConnection.user_id == user_id,
            models.FacebookConnection.page_id == page_id,
        )
        .first()
    )

    if existing:
        existing.page_access_token = encrypt_token(selected_page["page_access_token"])
        existing.connection_status = "connected"
        existing.disconnected_at = None
        existing.last_token_refresh = now
        existing.reconnect_count = (existing.reconnect_count or 0) + 1
        existing.page_name = selected_page["page_name"]
        existing.page_picture_url = _page_picture_url(selected_page)
        existing.token_expires_at = token_expires_at
        existing.updated_at = now
        connection = existing
    else:
        conflict = (
            db.query(models.FacebookConnection)
            .filter(
                models.FacebookConnection.page_id == page_id,
                models.FacebookConnection.user_id != user_id,
                models.FacebookConnection.connection_status == "connected",
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This Facebook Page is already actively connected to another account.",
            )

        connection = models.FacebookConnection(
            user_id=user_id,
            page_id=page_id,
            page_name=selected_page["page_name"],
            page_picture_url=_page_picture_url(selected_page),
            page_access_token=encrypt_token(selected_page["page_access_token"]),
            long_lived_user_token="",
            connection_status="connected",
            reconnect_count=0,
            last_token_refresh=now,
            token_expires_at=token_expires_at,
            connected_at=now,
            created_at=now,
            updated_at=now,
        )
        db.add(connection)

    db.flush()
    resumed = _resume_paused_posts(db, connection)
    db.commit()
    db.refresh(connection)
    logger.info(
        "Page %s successfully connected for user %s reconnect_count=%s resumed_posts=%s",
        connection.page_name,
        user_id,
        connection.reconnect_count,
        resumed,
    )
    return connection


async def complete_page_selection(
    request: Request,
    db: Session,
    user_id: int,
    page_id: str,
) -> models.FacebookConnection:
    pending = db.get(models.PendingFacebookOAuth, user_id)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Connect Facebook before selecting a page")

    if pending.expires_at <= datetime.now(timezone.utc):
        db.delete(pending)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Facebook page selection expired. Please connect again.")

    selected_page = next((page for page in pending.pages if page.get("page_id") == page_id), None)
    if selected_page is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected page was not found")

    try:
        connection = save_or_update_page_connection(db, user_id, selected_page, pending.token_expires_at)
    except HTTPException as exc:
        _clear_oauth_session(request)
        if exc.status_code == status.HTTP_409_CONFLICT:
            raise
        raise

    db.delete(pending)
    db.commit()
    _clear_oauth_session(request)
    return connection


def start_facebook_oauth(request: Request, user: models.User, db: Session, session_id: str | None = None) -> RedirectResponse:
    if not FACEBOOK_APP_ID or not FACEBOOK_APP_SECRET:
        _facebook_error("Facebook app credentials are not configured", status.HTTP_500_INTERNAL_SERVER_ERROR)

    state = _create_oauth_state(db, user.id)
    if session_id:
        state = f"{state}:{session_id}"
        oauth_polling_sessions[session_id] = {"status": "pending", "user_id": user.id}

    request.session["oauth_state"] = state
    request.session["oauth_user_id"] = user.id
    logger.info("OAuth flow started for user %s", user.id)

    params = urlencode(
        {
            "client_id": FACEBOOK_APP_ID,
            "redirect_uri": FACEBOOK_REDIRECT_URI,
            "scope": FACEBOOK_OAUTH_SCOPES,
            "response_type": "code",
            "state": state,
        }
    )
    return RedirectResponse(f"{FACEBOOK_DIALOG_OAUTH_BASE}?{params}")


async def handle_facebook_callback(
    request: Request,
    db: Session,
    code: str | None,
    state: str | None,
    error: str | None,
) -> HTMLResponse:
    session_id = None
    if state and ":" in state:
        state, session_id = state.split(":", 1)

    if error:
        if session_id:
            oauth_polling_sessions[session_id] = {"status": "error", "message": error}
        return _popup_error_html(f"Facebook returned an error: {error}")

    # Verify OAuth state from database instead of session
    user_id = _verify_oauth_state(db, state) if state else None
    if not code or not state or not user_id:
        logger.warning("OAuth state mismatch for state %s", state)
        if session_id:
            oauth_polling_sessions[session_id] = {"status": "error", "message": "Security check failed"}
        return _popup_error_html("Security check failed. Please try again.")

    request.session.pop("oauth_state", None)

    access_token, token_data = await _exchange_code_for_token(code)
    if not access_token:
        _clear_oauth_session(request)
        if session_id:
            oauth_polling_sessions[session_id] = {"status": "error", "message": "Failed to connect"}
        return _popup_error_html("Failed to connect to Facebook. Please try again.")

    pages = await _fetch_managed_pages(access_token)
    if not pages:
        _clear_oauth_session(request)
        if session_id:
            oauth_polling_sessions[session_id] = {"status": "error", "message": "No pages found"}
        return _popup_error_html(
            "No Facebook Pages found on this account. You need to be an admin of at least one Facebook Page."
        )

    token_expires_at = None
    if token_data and token_data.get("expires_in") is not None:
        token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(token_data["expires_in"]))

    await store_pending_pages_for_user(db, int(user_id), pages, token_expires_at)

    if len(pages) == 1:
        try:
            connection = await complete_page_selection(request, db, int(user_id), pages[0]["page_id"])
        except HTTPException as exc:
            if session_id:
                oauth_polling_sessions[session_id] = {"status": "error", "message": str(exc.detail)}
            return _popup_error_html(str(exc.detail))
        
        if session_id:
            oauth_polling_sessions[session_id] = {
                "status": "success",
                "pageId": connection.page_id,
                "pageName": connection.page_name,
            }
        return _popup_success_html(connection.page_id)

    if session_id:
        oauth_polling_sessions[session_id] = {
            "status": "requires_selection",
            "pages": [
                {
                    "page_id": p["page_id"],
                    "page_name": p["page_name"],
                    "picture_url": _page_picture_url(p),
                }
                for p in pages
            ],
        }

    return HTMLResponse(
        """<!doctype html><html><body style="font-family:system-ui,sans-serif;text-align:center;padding:40px;background:#f8fafc;color:#0f172a;">
        <div style="max-width:400px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
            <div style="font-size:28px;margin-bottom:12px;">📄</div>
            <h2 style="font-size:18px;margin:0 0 8px;">Discovered Multiple Facebook Pages</h2>
            <p style="font-size:13px;color:#64748b;margin:0 0 16px;">You can now select which pages to connect directly on your dashboard.</p>
            <button onclick="window.close()" style="background:#0f172a;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">
                Done (Close window)
            </button>
        </div>
        <script>
        setTimeout(function() { window.close(); }, 1500);
        </script>
        </body></html>"""
    )


async def handle_select_page_from_popup(
    request: Request,
    db: Session,
) -> HTMLResponse:
    form = await request.form()
    selected_page_id = form.get("page_id")
    session_id = form.get("session_id")
    
    if not selected_page_id:
        if session_id:
            oauth_polling_sessions[str(session_id)] = {"status": "error", "message": "Please select a Facebook Page."}
        return _popup_error_html("Please select a Facebook Page.")

    user_id = request.session.get("oauth_user_id")
    if not user_id:
        if session_id:
            oauth_polling_sessions[str(session_id)] = {"status": "error", "message": "Security check failed."}
        return _popup_error_html("Security check failed. Please try again.")

    try:
        connection = await complete_page_selection(request, db, int(user_id), str(selected_page_id))
    except HTTPException as exc:
        if session_id:
            oauth_polling_sessions[str(session_id)] = {"status": "error", "message": str(exc.detail)}
        return _popup_error_html(str(exc.detail))

    if session_id:
        oauth_polling_sessions[str(session_id)] = {"status": "success", "pageId": connection.page_id, "pageName": connection.page_name}
    return _popup_success_html(connection.page_id)


def disconnect_page_connection(
    db: Session,
    user_id: int,
    connection_id: int,
) -> schemas.PageDisconnectResponse:
    connection = (
        db.query(models.FacebookConnection)
        .filter(
            models.FacebookConnection.id == connection_id,
            models.FacebookConnection.user_id == user_id,
        )
        .first()
    )
    if connection is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Page connection not found")

    now = datetime.now(timezone.utc)
    connection.connection_status = "disconnected"
    connection.page_access_token = None
    connection.disconnected_at = now
    connection.updated_at = now

    paused_posts = (
        db.query(models.PostLog)
        .filter(
            models.PostLog.facebook_connection_id == connection_id,
            models.PostLog.status == "scheduled",
        )
        .update({"status": "paused", "updated_at": now}, synchronize_session=False)
    )
    db.commit()

    return schemas.PageDisconnectResponse(
        success=True,
        message="Page disconnected. Your post history is saved and will be restored when you reconnect.",
        paused_posts=paused_posts,
    )


def reconnect_page_connection(
    db: Session,
    user_id: int,
    connection_id: int,
) -> models.FacebookConnection:
    connection = (
        db.query(models.FacebookConnection)
        .filter(
            models.FacebookConnection.id == connection_id,
            models.FacebookConnection.user_id == user_id,
        )
        .first()
    )
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page connection not found")

    now = datetime.now(timezone.utc)
    connection.connection_status = "connected"
    connection.disconnected_at = None
    connection.updated_at = now
    _resume_paused_posts(db, connection)
    db.commit()
    db.refresh(connection)
    return connection


def delete_page_connection(
    db: Session,
    user_id: int,
    connection_id: int,
) -> dict:
    connection = (
        db.query(models.FacebookConnection)
        .filter(
            models.FacebookConnection.id == connection_id,
            models.FacebookConnection.user_id == user_id,
        )
        .first()
    )
    if connection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Page connection not found")

    # Set post_logs facebook_connection_id to NULL to preserve history
    db.query(models.PostLog).filter(
        models.PostLog.facebook_connection_id == connection_id
    ).update({"facebook_connection_id": None}, synchronize_session=False)

    db.delete(connection)
    db.commit()
    return {"success": True, "message": "Page connection removed successfully"}


def _post_counts_for_connection(db: Session, connection_id: int) -> tuple[int, int, int]:
    rows = (
        db.query(models.PostLog.status, func.count(models.PostLog.id))
        .filter(models.PostLog.facebook_connection_id == connection_id)
        .group_by(models.PostLog.status)
        .all()
    )
    counts = {status: count for status, count in rows}
    post_count = sum(counts.values())
    scheduled_post_count = counts.get("scheduled", 0)
    paused_post_count = counts.get("paused", 0)
    return post_count, scheduled_post_count, paused_post_count


def list_user_page_connections(db: Session, user_id: int) -> list[schemas.PageConnectionRead]:
    connections = (
        db.query(models.FacebookConnection)
        .filter(models.FacebookConnection.user_id == user_id)
        .order_by(models.FacebookConnection.connected_at.desc())
        .all()
    )
    if not connections:
        return []

    connection_ids = [c.id for c in connections]
    # Single query to group post counts by connection and status
    counts_rows = (
        db.query(
            models.PostLog.facebook_connection_id,
            models.PostLog.status,
            func.count(models.PostLog.id),
        )
        .filter(models.PostLog.facebook_connection_id.in_(connection_ids))
        .group_by(models.PostLog.facebook_connection_id, models.PostLog.status)
        .all()
    )

    counts_by_conn: dict[int, dict[str, int]] = {cid: {} for cid in connection_ids}
    for conn_id, status_val, count in counts_rows:
        if conn_id is not None and conn_id in counts_by_conn:
            counts_by_conn[conn_id][status_val] = count

    results: list[schemas.PageConnectionRead] = []
    for connection in connections:
        counts = counts_by_conn.get(connection.id, {})
        post_count = sum(counts.values())
        scheduled_post_count = counts.get("scheduled", 0)
        paused_post_count = counts.get("paused", 0)
        picture = connection.page_picture_url
        results.append(
            schemas.PageConnectionRead(
                id=connection.id,
                facebook_page_id=connection.page_id,
                page_id=connection.page_id,
                page_name=connection.page_name,
                profile_picture_url=picture,
                page_picture_url=picture,
                connection_status=connection.connection_status,
                connected_at=connection.connected_at,
                disconnected_at=connection.disconnected_at,
                reconnect_count=connection.reconnect_count or 0,
                post_count=post_count,
                scheduled_post_count=scheduled_post_count,
                paused_post_count=paused_post_count,
            )
        )
    return results


async def store_pending_pages_for_user(
    db: Session,
    user_id: int,
    pages: list[dict],
    token_expires_at: datetime | None = None,
) -> None:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    pending = db.get(models.PendingFacebookOAuth, user_id)
    if pending is None:
        pending = models.PendingFacebookOAuth(user_id=user_id)
        db.add(pending)
    pending.pages = pages
    pending.token_expires_at = token_expires_at
    pending.expires_at = expires_at
    db.query(models.PendingFacebookOAuth).filter(
        models.PendingFacebookOAuth.expires_at <= datetime.now(timezone.utc)
    ).delete(synchronize_session=False)
    db.commit()


def get_pending_pages_for_user(db: Session, user_id: int) -> list[dict]:
    pending = db.get(models.PendingFacebookOAuth, user_id)
    if not pending or pending.expires_at <= datetime.now(timezone.utc):
        return []
    
    # Check which pages are already connected
    existing_page_ids = set(
        row[0]
        for row in db.query(models.FacebookConnection.page_id)
        .filter(
            models.FacebookConnection.user_id == user_id,
            models.FacebookConnection.connection_status == "connected",
        )
        .all()
    )
    
    result = []
    for p in (pending.pages or []):
        pid = str(p.get("page_id"))
        result.append({
            "page_id": pid,
            "page_name": str(p.get("page_name", "Unnamed Page")),
            "picture_url": _page_picture_url(p),
            "is_already_connected": pid in existing_page_ids,
        })
    return result


async def sync_facebook_page_posts_internal(
    db: Session,
    user_id: int,
    connection: models.FacebookConnection,
    limit: int = 50,
) -> int:
    if not connection or not connection.page_access_token:
        return 0

    access_token = decrypt_token(connection.page_access_token)
    if not access_token:
        return 0

    page_id = connection.page_id
    try:
        async with httpx.AsyncClient(base_url="https://graph.facebook.com/v18.0", timeout=15.0) as client:
            response = await client.get(
                f"{page_id}/posts",
                params={
                    "fields": "id,message,created_time,full_picture,attachments{media,subattachments},likes.summary(true),comments.summary(true),shares",
                    "limit": limit,
                    "access_token": access_token,
                },
            )
        if response.status_code >= 400:
            logger.warning("Facebook history sync returned status %s for page %s", response.status_code, page_id)
            return 0

        fb_posts = response.json().get("data", [])
        synced_count = 0

        for fb_post in fb_posts:
            fb_post_id = fb_post.get("id")
            if not fb_post_id:
                continue

            exists = (
                db.query(models.PostLog)
                .filter(models.PostLog.facebook_post_id == fb_post_id)
                .first()
            )
            if exists:
                if exists.facebook_connection_id != connection.id or exists.user_id != user_id:
                    exists.facebook_connection_id = connection.id
                    exists.user_id = user_id
                continue

            created_time_str = fb_post.get("created_time")
            try:
                posted_at = datetime.fromisoformat(created_time_str.replace("Z", "+00:00"))
            except Exception:
                posted_at = datetime.now(timezone.utc)

            message = fb_post.get("message", "")
            media_urls = []
            full_pic = fb_post.get("full_picture")
            if full_pic:
                media_urls.append(full_pic)

            post = models.PostLog(
                user_id=user_id,
                facebook_connection_id=connection.id,
                content=message,
                media_urls=media_urls,
                status="published",
                facebook_post_id=fb_post_id,
                posted_at=posted_at,
                created_at=posted_at,
                updated_at=posted_at,
                ai_generated=False,
                auto_generated=False,
            )
            db.add(post)
            db.flush()

            likes_count = fb_post.get("likes", {}).get("summary", {}).get("total_count", 0)
            comments_count = fb_post.get("comments", {}).get("summary", {}).get("total_count", 0)
            shares_count = fb_post.get("shares", {}).get("count", 0)

            analytics_snapshot = models.AnalyticsSnapshot(
                post_id=post.id,
                likes_count=likes_count,
                comments_count=comments_count,
                shares_count=shares_count,
                snapshot_at=posted_at,
            )
            db.add(analytics_snapshot)

            post_engagement = models.PostEngagementSnapshot(
                post_id=post.id,
                page_connection_id=connection.id,
                snapshot_taken_at=posted_at,
                snapshot_type="facebook",
                likes_count=likes_count,
                comments_count=comments_count,
                shares_count=shares_count,
                reach_count=likes_count * 3,
                engagement_score=likes_count + comments_count * 2 + shares_count * 5,
            )
            db.add(post_engagement)
            synced_count += 1

        db.commit()
        return synced_count
    except Exception as exc:
        logger.warning("Error during Facebook history sync for page %s: %s", page_id, exc)
        return 0


async def select_page_for_user(db: Session, user_id: int, page_id: str) -> models.FacebookConnection:
    pending = db.get(models.PendingFacebookOAuth, user_id)
    if not pending:
        _facebook_error("Connect Facebook before selecting a page")

    if pending.expires_at <= datetime.now(timezone.utc):
        db.delete(pending)
        db.commit()
        _facebook_error("Facebook page selection expired. Please connect again.")

    selected_page = next((page for page in pending.pages if page["page_id"] == page_id), None)
    if selected_page is None:
        _facebook_error("Selected page was not found")

    try:
        connection = save_or_update_page_connection(
            db,
            user_id,
            selected_page,
            pending.token_expires_at,
        )
    except HTTPException:
        raise

    db.delete(pending)
    db.commit()

    # Auto-ingest post history asynchronously
    try:
        await sync_facebook_page_posts_internal(db, user_id, connection)
    except Exception as e:
        logger.warning("Auto history sync failed on page connect: %s", e)

    return connection


async def batch_connect_pages_for_user(
    db: Session,
    user_id: int,
    page_ids: list[str],
) -> list[str]:
    pending = db.get(models.PendingFacebookOAuth, user_id)
    if not pending:
        _facebook_error("Connect Facebook before selecting pages")

    if pending.expires_at <= datetime.now(timezone.utc):
        db.delete(pending)
        db.commit()
        _facebook_error("Facebook page selection expired. Please connect again.")

    connected_names: list[str] = []
    connected_objects: list[models.FacebookConnection] = []
    for pid in page_ids:
        selected_page = next((page for page in (pending.pages or []) if page.get("page_id") == pid), None)
        if not selected_page:
            continue
        try:
            conn = save_or_update_page_connection(
                db,
                user_id,
                selected_page,
                pending.token_expires_at,
            )
            connected_names.append(conn.page_name)
            connected_objects.append(conn)
        except Exception as exc:
            logger.warning("Failed to connect page %s: %s", pid, exc)

    db.commit()

    # Auto-ingest post history for newly connected pages
    for conn in connected_objects:
        try:
            await sync_facebook_page_posts_internal(db, user_id, conn)
        except Exception as e:
            logger.warning("Auto history sync failed for page %s: %s", conn.page_name, e)

    return connected_names
