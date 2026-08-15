import sys
sys.path.insert(0, ".")
import unittest
from unittest.mock import MagicMock
import base64
import httpx

from app.posts import _build_facebook_post_request, _facebook_publish_error_message
from app.crypto import encrypt_token, decrypt_token, _fernet_for_key

class TestFacebookPublishSuite(unittest.TestCase):
    def setUp(self):
        self.mock_connection = MagicMock()
        self.mock_connection.page_id = "123456789"
        self.token = "EAAB..."

    def test_photo_and_link_precedence(self):
        """When an image URL and a link URL are both provided, it should post to /photos and append the link to the caption."""
        endpoint, params, files, fallback_url = _build_facebook_post_request(
            connection=self.mock_connection,
            token=self.token,
            message="Check out our new launch!",
            media_urls=["https://supabase.co/storage/v1/object/public/generated-images/poster1.png"],
            link_url="https://mywebsite.com/deal",
            image_url=None,
        )
        self.assertEqual(endpoint, "123456789/photos")
        self.assertEqual(params["url"], "https://supabase.co/storage/v1/object/public/generated-images/poster1.png")
        self.assertIn("https://mywebsite.com/deal", params["message"])
        self.assertIn("Check out our new launch!", params["message"])
        self.assertIsNone(files)
        self.assertEqual(fallback_url, "https://supabase.co/storage/v1/object/public/generated-images/poster1.png")

    def test_base64_data_uri_handling(self):
        """When an image is passed as a base64 Data URI, it should convert to multipart files dict."""
        sample_bytes = b"fake_png_binary_data"
        base64_str = f"data:image/png;base64,{base64.b64encode(sample_bytes).decode('utf-8')}"
        
        endpoint, params, files, fallback_url = _build_facebook_post_request(
            connection=self.mock_connection,
            token=self.token,
            message="Base64 poster post",
            image_url=base64_str,
        )
        self.assertEqual(endpoint, "123456789/photos")
        self.assertNotIn("url", params)
        self.assertIsNotNone(files)
        self.assertIn("source", files)
        filename, data_bytes, content_type = files["source"]
        self.assertEqual(data_bytes, sample_bytes)
        self.assertEqual(content_type, "image/png")
        self.assertIsNone(fallback_url)

    def test_text_and_link_feed_post(self):
        """When no image is provided, link should route to /feed with link parameter."""
        endpoint, params, files, fallback_url = _build_facebook_post_request(
            connection=self.mock_connection,
            token=self.token,
            message="Check out our blog post",
            link_url="https://mywebsite.com/blog/1",
        )
        self.assertEqual(endpoint, "123456789/feed")
        self.assertEqual(params["link"], "https://mywebsite.com/blog/1")
        self.assertEqual(params["message"], "Check out our blog post")
        self.assertIsNone(files)
        self.assertIsNone(fallback_url)

    def test_crypto_multi_key_decryption_fallback(self):
        """Tokens encrypted under alternate keys should decrypt successfully under fallback order."""
        secret_token = "EAAB_test_token_12345"
        # Encrypt with fallback key
        encrypted_with_fallback = _fernet_for_key("fallback-secret-key-autoposter").encrypt(secret_token.encode()).decode()
        decrypted = decrypt_token(encrypted_with_fallback)
        self.assertEqual(decrypted, secret_token)

        # Encrypt with standard encrypt_token
        encrypted = encrypt_token(secret_token)
        self.assertEqual(decrypt_token(encrypted), secret_token)

    def test_error_subcode_parsing(self):
        """Facebook Graph API responses should produce actionable user-facing messages."""
        # Subcode 463
        resp_463 = httpx.Response(400, json={"error": {"code": 190, "error_subcode": 463, "message": "Session expired"}})
        msg_463 = _facebook_publish_error_message(resp_463)
        self.assertIn("expired", msg_463.lower())

        # Code 200 Permissions
        resp_200 = httpx.Response(403, json={"error": {"code": 200, "message": "Permissions error"}})
        msg_200 = _facebook_publish_error_message(resp_200)
        self.assertIn("CREATE_CONTENT", msg_200)

        # Code 100 Image Download
        resp_100 = httpx.Response(400, json={"error": {"code": 100, "error_subcode": 33, "message": "Failed to download image"}})
        msg_100 = _facebook_publish_error_message(resp_100)
        self.assertIn("download", msg_100.lower())

        # Code 368 Spam block
        resp_368 = httpx.Response(400, json={"error": {"code": 368, "message": "Temporarily blocked"}})
        msg_368 = _facebook_publish_error_message(resp_368)
        self.assertIn("temporarily blocked", msg_368.lower())

if __name__ == "__main__":
    unittest.main()
