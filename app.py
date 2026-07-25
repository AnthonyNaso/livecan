from flask import Flask, jsonify, render_template, request

from config import Config
from services.grok_service import chat_with_grok
from services.hottrack_service import generate_pix as hottrack_generate_pix
from services.hottrack_service import get_pix_status as hottrack_get_pix_status
from services.hottrack_service import resolve_click as hottrack_resolve_click
from services.pix_service import create_pix_charge, get_pix_status
from services.pushinpay_service import create_checkout, get_checkout_status
from services.tracking_service import TrackingService

app = Flask(__name__)

HOTTRACK_PLAN_PRICES_CENTS = {
    "vip-completo": 1999,
    "vip-basico": 1299,
    "verificacao-seguranca": 1200,
    "vip-upgrade-completo": 1500,
    "video-call": 2000,
}

HOTTRACK_PLAN_NAMES = {
    "vip-completo": "VIP Completo",
    "vip-basico": "VIP Básico",
    "verificacao-seguranca": "Verificação de Segurança",
    "vip-upgrade-completo": "Upgrade VIP Completo",
    "video-call": "Chamada de Vídeo",
}


@app.route("/")
def index():
    return render_template(
        "index.html",
        video_url=Config.BACKGROUND_VIDEO_URL,
        poster_url=Config.BACKGROUND_POSTER_URL,
        config={
            "META_PIXEL_ID": Config.META_PIXEL_ID,
            "CLARITY_PROJECT_ID": Config.CLARITY_PROJECT_ID,
        },
    )


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    history = data.get("history") or []

    if not user_message:
        return jsonify({"error": "Mensagem vazia."}), 400

    if not Config.XAI_API_KEY:
        return jsonify(
            {"error": "Configure a chave XAI_API_KEY no arquivo .env para usar a IA."}
        ), 500

    messages = [
        *[
            {"role": item["role"], "content": item["content"]}
            for item in history
            if item.get("role") in ("user", "assistant") and item.get("content")
        ],
        {"role": "user", "content": user_message},
    ]

    try:
        reply = chat_with_grok(messages)
        return jsonify({"response": reply})
    except Exception as exc:
        return jsonify({"error": f"Erro ao contactar a IA: {exc}"}), 502


@app.route("/track", methods=["POST"])
def track_event():
    data = request.get_json(silent=True) or {}
    event_name = (data.get("event_name") or "PageView").strip()
    payload = data.get("payload") or {}
    ok, detail = TrackingService.send_event(event_name, payload, request_context=request)
    return jsonify({"ok": ok, "event_name": event_name, "detail": detail})


@app.route("/track/pageview", methods=["GET"])
def track_pageview():
    ok, detail = TrackingService.send_event(
        "PageView",
        {
            "page": request.args.get("page", "home"),
            "page_url": request.args.get("page_url") or request.url,
        },
        request_context=request,
    )
    return jsonify({"ok": ok, "detail": detail})


@app.route("/debug/pixel", methods=["GET"])
def debug_pixel():
    """Rota de debug leve para checar o META_PIXEL_ID exposto pelo servidor.

    Não retorna tokens ou segredos — apenas o ID do pixel e um booleano indicando
    se está presente.
    """
    from config import Config as _Config

    clarity_id = getattr(_Config, "CLARITY_PROJECT_ID", None)
    return jsonify(
        {
            "META_PIXEL_ID": _Config.META_PIXEL_ID,
            "CLARITY_PROJECT_ID": clarity_id,
            "has_pixel": bool(_Config.META_PIXEL_ID),
            "has_clarity": bool(clarity_id),
        }
    )


@app.route("/pix/create", methods=["POST"])
def pix_create():
    data = request.get_json(silent=True) or {}
    plan_id = (data.get("plan_id") or "").strip()
    amount = data.get("amount")
    description = data.get("description", "Cobrança PIX")

    if not plan_id or not amount:
        return jsonify({"error": "Plano e valor são obrigatórios."}), 400

    try:
        charge = create_pix_charge(
            plan_id=plan_id,
            amount=amount,
            description=description,
        )
        return jsonify(charge)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@app.route("/pix/status", methods=["GET"])
def pix_status():
    transaction_id = (request.args.get("transaction_id") or "").strip()
    if not transaction_id:
        return jsonify({"error": "transaction_id é obrigatório."}), 400

    try:
        status = get_pix_status(transaction_id)
        return jsonify(status)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@app.route("/pushinpay/create", methods=["POST"])
def pushinpay_create():
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "").strip()
    amount = data.get("amount")

    if not plan:
        return jsonify({"error": "plan é obrigatório."}), 400

    try:
        result = create_checkout(token=None, plan=plan, amount=amount)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@app.route("/pushinpay/status", methods=["GET"])
def pushinpay_status():
    transaction_id = (request.args.get("transaction_id") or "").strip()
    if not transaction_id:
        return jsonify({"error": "transaction_id é obrigatório."}), 400

    try:
        status = get_checkout_status(transaction_id)
        return jsonify(status)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@app.route("/hottrack/resolve-click", methods=["POST"])
def hottrack_resolve_click_route():
    data = request.get_json(silent=True) or {}
    init_data = data.get("initData") or ""

    try:
        click_id = hottrack_resolve_click(init_data)
        return jsonify({"click_id": click_id})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@app.route("/hottrack/pix/create", methods=["POST"])
def hottrack_pix_create():
    data = request.get_json(silent=True) or {}
    plan = (data.get("plan") or "").strip()
    click_id = (data.get("click_id") or "").strip()
    amount = data.get("amount")

    if not click_id:
        return jsonify({"error": "click_id é obrigatório."}), 400

    value_cents = HOTTRACK_PLAN_PRICES_CENTS.get(plan)
    if amount:
        try:
            value_cents = int(round(float(amount) * 100))
        except (TypeError, ValueError):
            pass
    if not value_cents:
        value_cents = 1999

    product_name = HOTTRACK_PLAN_NAMES.get(plan, plan or "Acesso VIP")

    try:
        result = hottrack_generate_pix(click_id, value_cents, product_name)
        return jsonify(result)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


@app.route("/hottrack/pix/status", methods=["GET"])
def hottrack_pix_status_route():
    transaction_id = (request.args.get("transaction_id") or "").strip()
    if not transaction_id:
        return jsonify({"error": "transaction_id é obrigatório."}), 400

    try:
        status = hottrack_get_pix_status(transaction_id)
        return jsonify(status)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
