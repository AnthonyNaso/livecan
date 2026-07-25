import json
import urllib.error
import urllib.parse
import urllib.request

from config import Config


def _make_request(
    url: str,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict | None = None,
) -> dict:
    req = urllib.request.Request(url, data=body, method=method)

    if headers:
        for key, value in headers.items():
            req.add_header(key, value)

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload) if payload else {}

    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HotTrack HTTP {exc.code}: {error_body}")

    except urllib.error.URLError as exc:
        raise RuntimeError(f"Erro de conexão HotTrack: {exc.reason}")


def resolve_click(init_data: str) -> str:
    if not Config.HOTTRACK_API_KEY:
        raise ValueError("HOTTRACK_API_KEY não configurado.")

    payload = {
        "initData": init_data or "",
        "sellerId": Config.HOTTRACK_API_KEY,
    }

    response = _make_request(
        f"{Config.HOTTRACK_BASE_URL}/api/miniapp/resolve-click",
        method="POST",
        body=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    click_id = response.get("click_id")
    if not click_id:
        raise RuntimeError("HotTrack não retornou click_id.")
    return click_id


def generate_pix(click_id: str, value_cents: int, product_name: str) -> dict:
    if not Config.HOTTRACK_API_KEY:
        raise ValueError("HOTTRACK_API_KEY não configurado.")

    payload = {
        "click_id": click_id,
        "value_cents": value_cents,
        "product": {"name": product_name},
    }

    response = _make_request(
        f"{Config.HOTTRACK_BASE_URL}/api/pix/generate",
        method="POST",
        body=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": Config.HOTTRACK_API_KEY,
        },
    )

    transaction_id = (
        response.get("transaction_id")
        or response.get("id")
    )

    return {
        "pix_code": response.get("qr_code_text") or response.get("pix_code"),
        "transaction_id": transaction_id,
        "status": "pending",
    }


def get_pix_status(transaction_id: str) -> dict:
    if not Config.HOTTRACK_API_KEY:
        raise ValueError("HOTTRACK_API_KEY não configurado.")

    url = (
        f"{Config.HOTTRACK_BASE_URL}/api/pix/status/"
        f"{urllib.parse.quote(transaction_id)}"
    )

    response = _make_request(
        url,
        method="GET",
        headers={
            "Accept": "application/json",
            "x-api-key": Config.HOTTRACK_API_KEY,
        },
    )

    status = str(response.get("status") or "unknown").strip().lower()

    return {
        "transaction_id": transaction_id,
        "status": status,
    }
