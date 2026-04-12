"""SSRF defense module for URL fetching (S-11 security requirement).

Validates URLs before fetching to prevent server-side request forgery.
See: security-s11-dossier-enrichment-2026-04-12.md, threats T1/T2/T8.
"""

import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("broflo-ai")

BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2 MB
FETCH_TIMEOUT = 10.0  # seconds

ALLOWED_CONTENT_TYPES = {"text/html", "application/xhtml+xml", "application/json"}

KNOWN_WISHLIST_DOMAINS = {
    "amazon.com", "www.amazon.com",
    "etsy.com", "www.etsy.com",
    "target.com", "www.target.com",
    "nordstrom.com", "www.nordstrom.com",
    "pinterest.com", "www.pinterest.com",
    "zola.com", "www.zola.com",
    "myregistry.com", "www.myregistry.com",
}


def validate_url(url: str) -> str:
    """Validate and normalize URL. Raises ValueError on rejection."""
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError(f"Only HTTPS URLs allowed, got: {parsed.scheme or 'empty'}")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname")

    # Reject userinfo component (used to confuse parsers)
    if "@" in (parsed.netloc or "").split(":")[0].rsplit("@", 1)[0]:
        raise ValueError("URL contains userinfo component (@)")
    if parsed.username or parsed.password:
        raise ValueError("URL contains credentials")

    # Normalize IDN to ASCII
    try:
        ascii_hostname = hostname.encode("idna").decode("ascii")
    except (UnicodeError, UnicodeDecodeError):
        raise ValueError(f"Invalid internationalized domain: {hostname}")

    # Log non-allowlisted domains
    base_domain = ".".join(ascii_hostname.rsplit(".", 2)[-2:])
    if base_domain not in {d.replace("www.", "") for d in KNOWN_WISHLIST_DOMAINS}:
        logger.info("Wishlist fetch from non-allowlisted domain: %s", base_domain)

    return url


def _check_ip_blocked(ip_str: str) -> bool:
    """Return True if IP is in a blocked network range."""
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # If we can't parse, block it
    return any(addr in network for network in BLOCKED_NETWORKS)


def resolve_and_check(hostname: str) -> None:
    """DNS-resolve hostname and check all IPs against denylist. Raises ValueError."""
    try:
        results = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise ValueError(f"DNS resolution failed for {hostname}: {e}")

    if not results:
        raise ValueError(f"No DNS results for {hostname}")

    for family, _type, _proto, _canonname, sockaddr in results:
        ip = sockaddr[0]
        if _check_ip_blocked(ip):
            raise ValueError(f"URL resolves to blocked IP range: {ip}")


async def safe_fetch(url: str) -> tuple[str, str]:
    """Fetch URL with SSRF protections. Returns (content, content_type).

    Raises ValueError for validation failures, httpx.HTTPError for fetch errors.
    """
    validated_url = validate_url(url)

    # Resolve DNS and check IPs before fetching
    parsed = urlparse(validated_url)
    resolve_and_check(parsed.hostname)

    async with httpx.AsyncClient(
        follow_redirects=False,
        timeout=httpx.Timeout(FETCH_TIMEOUT),
        limits=httpx.Limits(max_connections=4),
    ) as client:
        response = await client.get(
            validated_url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; BrofloBot/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/json",
            },
        )

    # Check for redirect (we don't follow them)
    if 300 <= response.status_code < 400:
        raise ValueError(
            f"URL returned redirect ({response.status_code}). "
            "Try the direct product URL instead."
        )

    response.raise_for_status()

    # Validate Content-Type
    content_type = response.headers.get("content-type", "")
    ct_base = content_type.split(";")[0].strip().lower()
    if ct_base not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Unsupported content type: {ct_base}")

    # Enforce size limit
    body = response.content
    if len(body) > MAX_RESPONSE_BYTES:
        raise ValueError(f"Response exceeds {MAX_RESPONSE_BYTES} byte limit")

    # Decode with fallback
    try:
        text = body.decode("utf-8")
    except UnicodeDecodeError:
        text = body.decode("latin-1")

    return text, ct_base
