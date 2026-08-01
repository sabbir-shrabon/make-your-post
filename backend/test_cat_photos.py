import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import Response

from app.routers.cat_photos import get_cat_photos, proxy_cat_photo


def test_get_cat_photos_without_api_key_fetches_public_results(monkeypatch):
    monkeypatch.delenv("CAT_API_KEY", raising=False)

    fake_payload = [
        {"id": "1", "url": "https://cdn2.thecatapi.com/images/cat1.jpg", "width": 400, "height": 400},
    ]
    mock_get = AsyncMock(return_value=Response(200, json=fake_payload))

    with patch("app.routers.cat_photos.httpx.AsyncClient") as fake_client_cls:
        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.get = mock_get
        fake_client_cls.return_value = fake_client

        result = asyncio.run(get_cat_photos(limit=4, page=1))

    assert result == [
        {
            "id": "1",
            "url": "/api/cat-photos/proxy?url=https%3A%2F%2Fcdn2.thecatapi.com%2Fimages%2Fcat1.jpg",
            "original_url": "https://cdn2.thecatapi.com/images/cat1.jpg",
            "width": 400,
            "height": 400,
        }
    ]
    args, kwargs = mock_get.call_args
    assert args[0] == "https://api.thecatapi.com/v1/images/search"
    assert kwargs["headers"] == {}
    assert kwargs["params"]["limit"] == 4
    assert kwargs["params"]["page"] == 1


def test_get_cat_photos_passes_api_key_and_sub_id(monkeypatch):
    monkeypatch.setenv("CAT_API_KEY", "test-key")

    fake_payload = [
        {"id": "1", "url": "https://cdn.thecatapi.com/images/cat1.jpg", "width": 400, "height": 400},
        {"id": "2", "url": "https://cdn2.thecatapi.com/images/cat2.jpg", "width": 400, "height": 400},
    ]

    mock_get = AsyncMock(return_value=Response(200, json=fake_payload))

    with patch("app.routers.cat_photos.httpx.AsyncClient") as fake_client_cls:
        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.get = mock_get
        fake_client_cls.return_value = fake_client

        result = asyncio.run(get_cat_photos(limit=2, page=1, mime_types="jpg,png", size="med"))

    assert len(result) == 2
    assert result[0]["url"].startswith("/api/cat-photos/proxy?url=")
    mock_get.assert_awaited_once()
    args, kwargs = mock_get.call_args
    assert args[0] == "https://api.thecatapi.com/v1/images/search"
    assert kwargs["headers"]["x-api-key"] == "test-key"
    assert kwargs["params"]["limit"] == 2
    assert kwargs["params"]["page"] == 1
    assert kwargs["params"]["mime_types"] == "jpg,png"
    assert kwargs["params"]["size"] == "med"
    assert "sub_id" in kwargs["params"]
    assert isinstance(kwargs["params"]["sub_id"], str)


def test_proxy_cat_photo_rejects_non_cat_api_urls():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(proxy_cat_photo("https://example.com/not-a-cat.jpg"))

    assert exc_info.value.status_code == 400


def test_proxy_cat_photo_returns_image_response():
    mock_get = AsyncMock(return_value=Response(200, content=b"image-bytes", headers={"content-type": "image/jpeg"}))

    with patch("app.routers.cat_photos.httpx.AsyncClient") as fake_client_cls:
        fake_client = AsyncMock()
        fake_client.__aenter__.return_value = fake_client
        fake_client.get = mock_get
        fake_client_cls.return_value = fake_client

        result = asyncio.run(proxy_cat_photo("https://cdn2.thecatapi.com/images/cat1.jpg"))

    assert result.body == b"image-bytes"
    assert result.media_type == "image/jpeg"
    mock_get.assert_awaited_once_with("https://cdn2.thecatapi.com/images/cat1.jpg")