import json
import time
import uuid
from urllib import error as urllib_error
from urllib import request as urllib_request


class TrackingService:
    @staticmethod
    def _post_json(url, payload, headers=None):
        data = json.dumps(payload).encode("utf-8")
        request = urllib_request.Request(
            url,
            data=data,
            headers=headers or {"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib_request.urlopen(request, timeout=10) as response:
                return True, response.read().decode("utf-8", errors="ignore")
        except urllib_error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            return False, {"status": exc.code, "body": body}
        except Exception as exc:
            return False, str(exc)

    @staticmethod
    def send_event(event_name, payload, request_context=None):
        event_name = event_name or "PageView"
        payload = payload or {}
        event_time = int(time.time())
        event_id = payload.get("event_id") or f"{event_name}-{uuid.uuid4()}"

        custom_data = {}
        value = payload.get("value")
        if value is not None:
            try:
                custom_data["value"] = float(value)
            except (TypeError, ValueError):
                custom_data["value"] = 0.0

        currency = payload.get("currency")
        if currency:
            custom_data["currency"] = str(currency).upper()

        if payload.get("plan_id"):
            custom_data["plan_id"] = payload.get("plan_id")
        if payload.get("transaction_id"):
            custom_data["transaction_id"] = payload.get("transaction_id")
        if payload.get("page"):
            custom_data["page"] = payload.get("page")

        meta_payload = {
            "data": [
                {
                    "event_name": event_name,
                    "event_time": event_time,
                    "event_id": event_id,
                    "event_source_url": payload.get("page_url") or "https://livecan.com.br",
                    "custom_data": custom_data,
                    "user_data": {},
                }
            ]
        }

        if request_context is not None:
            user_agent = request_context.headers.get("User-Agent", "")
            remote_ip = request_context.headers.get("X-Forwarded-For") or request_context.remote_addr
            if user_agent:
                meta_payload["data"][0]["user_data"]["client_user_agent"] = user_agent
            if remote_ip:
                meta_payload["data"][0]["user_data"]["client_ip_address"] = remote_ip

        from config import Config

        meta_pixel_id = (Config.META_PIXEL_ID or "").strip()
        meta_capi_token = (Config.META_CAPI_TOKEN or "").strip()
        utmify_url = (Config.UTMIFY_API_URL or "").strip()
        utmify_token = (Config.UTMIFY_API_TOKEN or "").strip()

        meta_ok = True
        meta_detail = None
        if meta_pixel_id and meta_capi_token:
            capi_url = f"https://graph.facebook.com/v19.0/{meta_pixel_id}/events?access_token={meta_capi_token}"
            meta_ok, meta_detail = TrackingService._post_json(
                capi_url,
                meta_payload,
                headers={"Content-Type": "application/json"},
            )
        else:
            meta_detail = "Meta Pixel/CAPI not configured"

        utmify_ok = True
        utmify_detail = None
        if utmify_url and utmify_token:
            utmify_payload = {
                "event_name": event_name,
                "event_time": event_time,
                "event_id": event_id,
                "data": payload,
            }
            utmify_ok, utmify_detail = TrackingService._post_json(
                utmify_url,
                utmify_payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {utmify_token}",
                },
            )
        else:
            utmify_detail = "Utmify not configured"

        return meta_ok and utmify_ok, {
            "meta": meta_detail,
            "utmify": utmify_detail,
        }
