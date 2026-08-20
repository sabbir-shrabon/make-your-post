"""
security_utils.py
-----------------
Security validation utilities, including SSRF defense and URL sanitization.
"""

from __future__ import annotations

import ipaddress
import logging
import socket
import urllib.parse

logger = logging.getLogger(__name__)

BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254",
    "metadata.google.internal",
    "::1",
}


def is_safe_public_url(url: str) -> bool:
    """
    Validate that an HTTP/HTTPS URL resolves only to safe, public internet IP addresses
    and cannot be used for SSRF against cloud metadata, localhost, or intranet services.
    """
    if not url or not isinstance(url, str):
        return False

    try:
        parsed = urllib.parse.urlparse(url.strip())
        if parsed.scheme.lower() not in ("http", "https"):
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        hostname_lower = hostname.lower()
        if hostname_lower in BLOCKED_HOSTS or hostname_lower.endswith(".internal"):
            logger.warning("SSRF blocked attempt to access prohibited host: %s", hostname)
            return False

        # Resolve IP addresses for hostname
        try:
            addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        except socket.gaierror:
            # Cannot resolve hostname
            return False

        for item in addr_info:
            ip_str = item[4][0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if (
                    ip_obj.is_private
                    or ip_obj.is_loopback
                    or ip_obj.is_link_local
                    or ip_obj.is_reserved
                    or ip_obj.is_multicast
                    or ip_obj.is_unspecified
                ):
                    logger.warning("SSRF blocked: Host %s resolved to non-public IP %s", hostname, ip_str)
                    return False
            except ValueError:
                return False

        return True

    except Exception as exc:
        logger.warning("Error evaluating URL safety (%s): %s", url[:60], exc)
        return False
