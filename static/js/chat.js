const ASSISTANT_NAME = "DANIELA LIMA 🔥";
const ASSISTANT_INITIAL = "D";
const INITIAL_ASSISTANT_MESSAGE = "Ei... tem alguém aí pra bater papo? 🙊";
const VIP_PLAN_PRICES = {
  "vip-completo": "19.99",
  "vip-basico": "12.99",
};

const VIP_BENEFIT_MESSAGES = [
  "🔓 LIBERE O 💚 VIP COMPLETO 💚 E GANHE ACESSO A:",
  "⭐ 😍 Tiro a roupa toda e fico nua pra você",
  "⭐ 💦 Me masturbo bem gostoso com você ao vivo 📹",
  "⭐ 📱 Passo meu WhatsApp pessoal agora",
  "⭐ 📍 A gente marca de se ver aí 💖",
];

const VIP_PREVIEW_IMAGES = [
  "/static/img/image1.jpeg",
  "/static/img/image2.jpeg",
  "/static/img/image3.jpeg",
];

const VIDEO_CALL_PLAN_PRICES = {
  "video-call": "20.00",
};

const chatArea = document.getElementById("chat-area");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const typingIndicator = document.getElementById("typing");
const errorBanner = document.getElementById("error-banner");
const bgVideo = document.querySelector(".bg-video");

function getPlanAmount(planId) {
  const amount = VIP_PLAN_PRICES[planId] || VIDEO_CALL_PLAN_PRICES[planId];
  if (!amount) return null;
  const parsed = Number.parseFloat(String(amount).replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function initMetaPixel() {
  if (!window.META_PIXEL_ID || window.__metaPixelInitialized) return;
  window.__metaPixelInitialized = true;
  if (typeof window.fbq === "function") {
    window.fbq("init", window.META_PIXEL_ID);
  }
}

function sendTrackingEvent(eventName, payload = {}) {
  const eventPayload = {
    page: payload.page || "home",
    page_url: payload.page_url || window.location.href,
    ...payload,
  };

  if (typeof window.fbq === "function") {
    if (eventName === "PageView") {
      window.fbq("track", "PageView");
    }
    if (eventName === "Purchase") {
      window.fbq("track", "Purchase", {
        value: eventPayload.value || 0,
        currency: eventPayload.currency || "BRL",
      });
    }
  }

  fetch("/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_name: eventName, payload: eventPayload }),
  }).catch(() => {});
}

function trackPageView() {
  initMetaPixel();
  sendTrackingEvent("PageView", {
    page: "home",
    page_url: window.location.href,
  });
}

function trackPurchase(planId, amount) {
  initMetaPixel();
  const numericAmount =
    typeof amount === "number" ? amount : getPlanAmount(planId);
  const payload = {
    page: "purchase",
    page_url: window.location.href,
    plan_id: planId,
    value: numericAmount,
    currency: "BRL",
  };
  sendTrackingEvent("Purchase", payload);
}

// --- HotTrack: resolve/cache do click_id usado para gerar PIX ---
const HOTTRACK_CLICK_ID_KEY = "ht_click_id";
let hottrackClickIdPromise = null;

function generateFallbackClickId() {
  return `lead_padrao_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureHotTrackClickId() {
  const stored = localStorage.getItem(HOTTRACK_CLICK_ID_KEY);
  if (stored) return Promise.resolve(stored);

  if (hottrackClickIdPromise) return hottrackClickIdPromise;

  const initData = window.Telegram?.WebApp?.initData || "";

  hottrackClickIdPromise = fetch("/hottrack/resolve-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  })
    .then((res) => res.json().then((b) => ({ ok: res.ok, body: b })))
    .then(({ ok, body }) =>
      ok && body.click_id ? body.click_id : generateFallbackClickId(),
    )
    .catch(() => generateFallbackClickId())
    .then((clickId) => {
      localStorage.setItem(HOTTRACK_CLICK_ID_KEY, clickId);
      return clickId;
    });

  return hottrackClickIdPromise;
}

let history = [];
let isSending = false;
let currentPlanId = null;
let restorePaymentSession = null;
let openPaymentSuccessModal = null;
let videoCallInterval = null;

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add("visible");
}

function hideError() {
  errorBanner.classList.remove("visible");
  errorBanner.textContent = "";
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function addMessage(
  role,
  content,
  { renderOnly = false, type = "text", images = [] } = {},
) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (role === "assistant") {
    const name = document.createElement("span");
    name.className = "sender-name";
    name.textContent = ASSISTANT_NAME;
    bubble.appendChild(name);

    if (content && content.trim().length > 0) {
      const text = document.createElement("span");
      text.className = "message-text";
      text.textContent = content;
      bubble.appendChild(text);
    }

    if (type === "images" && images.length > 0) {
      const imagesContainer = document.createElement("div");
      imagesContainer.className = "assistant-image-grid";
      images.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Prévia VIP";
        imagesContainer.appendChild(img);
      });
      bubble.appendChild(imagesContainer);
    }

    const lower = content.toLowerCase();
    const state = loadState();
    if (
      !state.paymentConfirmed &&
      /(?:vip|vips|video|vídeo|chamada)/.test(lower)
    ) {
      showVipButton();
    }
  } else {
    bubble.textContent = content;
  }

  wrapper.appendChild(bubble);
  chatArea.insertBefore(wrapper, typingIndicator);
  scrollToBottom();

  if (!renderOnly) {
    saveHistory(history);
  }
}

function addAssistantImageMessage(caption, images) {
  history.push({
    role: "assistant",
    type: "images",
    content: caption,
    images,
  });
  saveHistory(history);
  addMessage("assistant", caption, {
    renderOnly: true,
    type: "images",
    images,
  });
}

function sendAssistantImagePreviews(images, onComplete) {
  images.forEach((src, index) => {
    setTimeout(
      () => {
        history.push({
          role: "assistant",
          type: "images",
          content: "",
          images: [src],
        });
        saveHistory(history);
        addMessage("assistant", "", {
          renderOnly: true,
          type: "images",
          images: [src],
        });

        if (index === images.length - 1 && typeof onComplete === "function") {
          onComplete();
        }
      },
      3000 * (index + 1),
    );
  });
}

// --- VIP popup ---
function createVipPopup() {
  if (document.getElementById("vip-popup")) return;

  const popup = document.createElement("div");
  popup.id = "vip-popup";
  popup.className = "vip-popup";

  popup.innerHTML = `
    <div class="vip-card">
      <button class="vip-close" aria-label="Fechar">×</button>
      <div class="vip-header">
        <span class="vip-badge">UPGRADE EXCLUSIVO <span class="vip-badge-icon">💎</span></span>
      </div>
      <h3 class="vip-main-title">QUER O ACESSO <span>TOTAL?</span></h3>
      <p class="vip-subtitle">LIBERE O <strong>VIP COMPLETO</strong> E GANHE ACESSO A:</p>
      <ul class="vip-list">
        <li><span>⭐</span> TIRO A ROUPA TODA E FICO NUA PRA VOCÊ</li>
        <li><span>⭐</span> ME MASTURBO BEM GOSTOSO COM VOCÊ AO VIVO</li>
        <li><span>⭐</span> PASSO MEU WHATSAPP PESSOAL AGORA</li>
        <li><span>⭐</span> A GENTE MARCA DE SE VER AÍ</li>
      </ul>
      <button class="vip-pill" type="button" data-plan-id="vip-completo">🔒 SIGILO TOTAL</button>
      <div class="vip-offer-label">OFERTA ÚNICA</div>
      <div class="vip-pricing">
        <span class="vip-old-price">De R$ 39,98</span>
        <strong class="vip-price">R$ 19,99</strong>
      </div>
      <div class="vip-actions">
        <button class="vip-action vip-action-primary" type="button" data-plan-id="vip-completo">ACESSO COMPLETO (R$ 19,99)</button>
        <button class="vip-action vip-action-secondary" type="button" data-plan-id="vip-basico">ACESSO BÁSICO (R$ 12,99)</button>
      </div>
    </div>
  `;

  popup.querySelector(".vip-close").addEventListener("click", hideVipPopup);
  popup.addEventListener("click", (ev) => {
    if (ev.target === popup) hideVipPopup();
  });

  document.body.appendChild(popup);

  let paymentPopup = null;
  let pushinpayInterval = null;
  let benefitAnimationTimer = null;

  const createPaymentPopup = () => {
    if (paymentPopup) return paymentPopup;

    paymentPopup = document.createElement("div");
    paymentPopup.id = "vip-payment-popup";
    paymentPopup.className = "pix-fullscreen-overlay";
    paymentPopup.innerHTML = `
      <div class="pix-fullscreen-inner">
        <div class="pix-benefit-messages" id="pix-benefit-messages"></div>
        <div class="pix-bottom-sheet">
          <div class="pix-sheet-header">
            <span class="badge-pendente"><span class="badge-dot"></span> PAGAMENTO PENDENTE</span>
            <button type="button" class="pix-sheet-close" aria-label="Fechar">×</button>
          </div>
          <div class="pix-content">
            <div class="pix-loader-box">
              <div class="pix-spinner"></div>
              <p>Gerando chave PIX...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    paymentPopup
      .querySelector(".pix-sheet-close")
      .addEventListener("click", () => {
        hidePaymentPopup();
        showVipPopup();
      });

    document.body.appendChild(paymentPopup);
    return paymentPopup;
  };

  const showBenefitMessagesInstant = () => {
    const payment = createPaymentPopup();
    const container = payment.querySelector("#pix-benefit-messages");
    if (!container) return;

    container.innerHTML = "";
    VIP_BENEFIT_MESSAGES.forEach((msg) => {
      const item = document.createElement("div");
      item.className = "pix-benefit-msg visible";
      item.innerHTML = `
        <div class="pix-benefit-avatar">${ASSISTANT_INITIAL}</div>
        <div class="pix-benefit-bubble">${msg}</div>
      `;
      container.appendChild(item);
    });
  };

  const animateBenefitMessages = () => {
    const payment = createPaymentPopup();
    const container = payment.querySelector("#pix-benefit-messages");
    if (!container) return;

    container.innerHTML = "";
    if (benefitAnimationTimer) clearInterval(benefitAnimationTimer);

    let index = 0;

    const showNext = () => {
      if (index >= VIP_BENEFIT_MESSAGES.length) return;

      const item = document.createElement("div");
      item.className = "pix-benefit-msg";
      item.innerHTML = `
        <div class="pix-benefit-avatar">${ASSISTANT_INITIAL}</div>
        <div class="pix-benefit-bubble">${VIP_BENEFIT_MESSAGES[index]}</div>
      `;
      container.appendChild(item);

      requestAnimationFrame(() => {
        item.classList.add("visible");
      });

      index += 1;
    };

    showNext();
    benefitAnimationTimer = setInterval(() => {
      if (index >= VIP_BENEFIT_MESSAGES.length) {
        clearInterval(benefitAnimationTimer);
        benefitAnimationTimer = null;
        return;
      }
      showNext();
    }, 650);
  };

  const openPaymentOverlay = (animateBenefits = true) => {
    const payment = createPaymentPopup();
    popup.classList.remove("visible");
    document.body.classList.add("payment-active");
    payment.classList.add("visible");
    if (animateBenefits) {
      animateBenefitMessages();
    } else {
      showBenefitMessagesInstant();
    }
  };

  const showPaymentPopup = (planId) => {
    currentPlanId = planId;
    openPaymentOverlay(true);
    loadPaymentForPlan(planId);
  };

  const hidePaymentPopup = () => {
    if (!paymentPopup) return;
    paymentPopup.classList.remove("visible");
    document.body.classList.remove("payment-active");
    if (benefitAnimationTimer) {
      clearInterval(benefitAnimationTimer);
      benefitAnimationTimer = null;
    }
    if (pushinpayInterval) {
      clearInterval(pushinpayInterval);
      pushinpayInterval = null;
    }
  };

  const loadPaymentForPlan = (planId) => {
    const payment = createPaymentPopup();
    const container = payment.querySelector(".pix-content");
    if (!container) return;
    container.innerHTML = `
      <div class="pix-loader-box">
        <div class="pix-spinner"></div>
        <p>Gerando chave PIX...</p>
      </div>
    `;

    const amount = VIP_PLAN_PRICES[planId] || "0.00";

    ensureHotTrackClickId().then((clickId) => {
      fetch("/hottrack/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, amount, click_id: clickId }),
      })
        .then((res) => res.json().then((b) => ({ ok: res.ok, body: b })))
        .then(({ ok, body }) => {
          if (!ok || body.error) {
            throw new Error(body.error || "Erro ao criar PIX HotTrack.");
          }
          renderPushinpayModal(body);
        })
        .catch((err) => {
          container.innerHTML = `<div class="pix-error">${err.message}</div>`;
        });
    });
  };

  popup.querySelectorAll(".vip-action, .vip-pill").forEach((el) => {
    const plan = el.getAttribute("data-plan-id") || "vip-completo";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      showPaymentPopup(plan);
    });
  });

  const renderPushinpayModal = (data, { instant = false } = {}) => {
    const payment = createPaymentPopup();
    const container = payment.querySelector(".pix-content");
    if (!container) return;

    const pixCode = data.pix_code || "";
    const transactionId = data.transaction_id || "";
    const status = data.status || "pending";

    savePayment({
      planId: currentPlanId || data.plan_id || "vip-completo",
      transactionId,
      pixCode,
      status,
    });

    const renderContent = () => {
      container.innerHTML = `
        <div class="pix-modal-custom">
          <h2 class="pix-title">🔥 DANIELA LIMA COMEÇOU!</h2>
          <p class="pix-subtitle">Vídeo chamada iniciada... Realize o pagamento para participar!</p>

          <div class="pix-steps">
            <span class="step"><i class="step-num">1</i> Copie o código</span>
            <span class="step-arrow">→</span>
            <span class="step"><i class="step-num">2</i> Cole no App do Banco</span>
          </div>

          <button type="button" class="pix-btn-copy" id="btn-copy-pix">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span id="btn-copy-text">CLIQUE PARA COPIAR O PIX</span>
          </button>

          <div class="pix-footer-status">
            <span class="dot-green"></span>
            <span class="pix-status-text">Aguardando pagamento...</span>
          </div>
        </div>
      `;

      const copyBtn = container.querySelector("#btn-copy-pix");
      const copyText = container.querySelector("#btn-copy-text");

      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(pixCode);
          copyText.textContent = "CÓDIGO COPIADO!";
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyText.textContent = "CLIQUE PARA COPIAR O PIX";
            copyBtn.classList.remove("copied");
          }, 2500);
        });
      }

      startPushinpayPolling(transactionId, status);
    };

    if (instant) {
      renderContent();
      return;
    }

    container.innerHTML = `
      <div class="pix-loader-box">
        <div class="pix-spinner"></div>
        <p>Gerando chave PIX...</p>
      </div>
    `;

    setTimeout(renderContent, 1000);
  };

  restorePaymentSession = (savedPayment) => {
    currentPlanId = savedPayment.planId || "vip-completo";
    openPaymentOverlay(false);
    renderPushinpayModal(
      {
        pix_code: savedPayment.pixCode,
        transaction_id: savedPayment.transactionId,
        status: savedPayment.status || "pending",
        plan_id: savedPayment.planId,
      },
      { instant: true },
    );
  };

  const startPushinpayPolling = (transactionId, currentStatus) => {
    updatePushinpayStatusText(currentStatus);
    if (pushinpayInterval) clearInterval(pushinpayInterval);
    pushinpayInterval = setInterval(() => {
      refreshPushinpayStatus(transactionId);
    }, 5000);
  };

  const refreshPushinpayStatus = (transactionId) => {
    if (!transactionId) return;
    fetch(
      `/hottrack/pix/status?transaction_id=${encodeURIComponent(transactionId)}`,
    )
      .then((res) => res.json().then((b) => ({ ok: res.ok, body: b })))
      .then(({ ok, body }) => {
        if (!ok || body.error) throw new Error(body.error || "Erro status");
        const nextStatus = (body.status || "pending").toLowerCase();
        updatePushinpayStatusText(nextStatus || "pending");
        const paidSignals = [
          "paid",
          "pago",
          "confirmed",
          "approved",
          "completed",
        ];
        if (paidSignals.includes(nextStatus)) {
          if (pushinpayInterval) clearInterval(pushinpayInterval);
          markPaymentConfirmed();
          trackPurchase(currentPlanId, getPlanAmount(currentPlanId));
          hideVipButton();
          setTimeout(() => {
            hidePaymentPopup();
            hideVipPopup();
            showPaymentSuccessModal();
          }, 300);
        } else {
          const saved = getValidPayment();
          if (saved) {
            savePayment({ ...saved, status: nextStatus });
          }
        }
      })
      .catch((err) => {
        const statusEl = document.querySelector(
          "#vip-payment-popup .pix-status-text",
        );
        if (statusEl) statusEl.textContent = `erro: ${err.message}`;
        if (pushinpayInterval) clearInterval(pushinpayInterval);
      });
  };

  const updatePushinpayStatusText = (st) => {
    const el = document.querySelector("#vip-payment-popup .pix-status-text");
    if (!el) return;

    const normalized = (st || "pending").toLowerCase();
    const paidSignals = ["paid", "pago", "confirmed", "approved", "completed"];

    if (paidSignals.includes(normalized)) {
      el.textContent = "Pagamento confirmado!";
      el.style.color = "#22c55e";
    } else {
      el.textContent = "Aguardando pagamento...";
      el.style.color = "#22c55e";
    }
  };

  // Função para exibir o modal de cadastro (Criar Sua Conta)
  // Função para exibir o modal de cadastro (Criar Sua Conta)
  const showCreateAccountModal = () => {
    let accountModal = document.getElementById("create-account-modal");

    if (!accountModal) {
      accountModal = document.createElement("div");
      accountModal.id = "create-account-modal";
      accountModal.className = "account-modal-overlay";
      accountModal.innerHTML = `
      <div class="account-modal-card">
        <div class="account-icon-container">
          <svg class="camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 7l-7 5 7 5V7z"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </div>
        
        <h2 class="account-title">CRIAR SUA CONTA</h2>
        <p class="account-subtitle">Para acessar o conteúdo VIP, crie sua conta agora</p>
        
        <form id="create-account-form">
          <div class="input-group">
            <label for="reg-username">NOME DE USUÁRIO</label>
            <input type="text" id="reg-username" placeholder="Digite seu usuário..." autocomplete="off">
          </div>
          
          <div class="input-group">
            <label for="reg-password">SENHA</label>
            <input type="password" id="reg-password" placeholder="Crie uma senha...">
          </div>
          
          <button type="submit" id="btn-submit-account" class="btn-submit-account" disabled>
            CRIAR CONTA E CONTINUAR &rarr;
          </button>
        </form>
        
        <p class="account-footer-text">Seus dados são privados e seguros 🔒</p>
      </div>
    `;

      document.body.appendChild(accountModal);

      const userInput = accountModal.querySelector("#reg-username");
      const passInput = accountModal.querySelector("#reg-password");
      const submitBtn = accountModal.querySelector("#btn-submit-account");
      const form = accountModal.querySelector("#create-account-form");

      const validateInputs = () => {
        const userValid = userInput.value.trim().length > 0;
        const passValid = passInput.value.trim().length > 0;

        if (userValid && passValid) {
          submitBtn.removeAttribute("disabled");
        } else {
          submitBtn.setAttribute("disabled", "true");
        }
      };

      userInput.addEventListener("input", validateInputs);
      passInput.addEventListener("input", validateInputs);

      // Ação ao enviar o formulário: fecha o formulário e abre o 2º gerador PIX
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        accountModal.classList.remove("visible");
        showSecurityPixModal();
      });
    }

    requestAnimationFrame(() => {
      accountModal.classList.add("visible");
    });
  };

  // --- NOVO: Modal de Verificação de Segurança (2º PIX) ---
  let securityPollingInterval = null;

  const showSecurityPixModal = () => {
    let secModal = document.getElementById("security-pix-modal");

    if (!secModal) {
      secModal = document.createElement("div");
      secModal.id = "security-pix-modal";
      secModal.className = "security-modal-overlay";
      secModal.innerHTML = `
        <div class="security-bottom-sheet">
          <div class="security-card">
            <div class="security-lock-icon">🔒</div>
            <h2 class="security-title">VERIFICAÇÃO DE SEGURANÇA</h2>
            <p class="security-subtitle">
              Para garantir a segurança da sua conta e do modelo, é necessário realizar uma verificação. Este processo é obrigatório e feito uma única vez.
            </p>
            <div class="security-badge-wrapper">
              <span class="security-badge"><span class="badge-dot-yellow"></span> VERIFICAÇÃO OBRIGATÓRIA</span>
            </div>
            <div class="security-price-box">
              <span class="security-price-label">VALOR</span>
              <strong class="security-price-value">R$ 9,90</strong>
            </div>
            <div class="security-steps">
              <span><i class="sec-num">1</i> Copie o código</span>
              <span class="sec-arrow">&rarr;</span>
              <span><i class="sec-num">2</i> Cole no App do Banco</span>
            </div>
            <button type="button" class="security-btn-copy" id="sec-btn-copy">
              <span class="copy-icon">📋</span>
              <span id="sec-copy-text">COPIAR PIX</span>
            </button>
            <div class="security-status">
              <span class="badge-dot-yellow"></span>
              <span id="sec-status-text">Aguardando pagamento...</span>
            </div>
            <div class="sheet-bottom-bar"></div>
          </div>
        </div>
      `;
      document.body.appendChild(secModal);
    }

    requestAnimationFrame(() => {
      secModal.classList.add("visible");
    });

    ensureHotTrackClickId().then((clickId) => {
      fetch("/hottrack/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "verificacao-seguranca",
          amount: "12.00",
          click_id: clickId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);

          const copyBtn = secModal.querySelector("#sec-btn-copy");
          const copyText = secModal.querySelector("#sec-copy-text");

          copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.pix_code || "");
            copyText.textContent = "CÓDIGO COPIADO!";
            setTimeout(() => {
              copyText.textContent = "COPIAR PIX";
            }, 2500);
          };

          startSecurityPolling(data.transaction_id);
        })
        .catch((err) => {
          const statusEl = secModal.querySelector("#sec-status-text");
          if (statusEl)
            statusEl.textContent = `Erro ao gerar Pix: ${err.message}`;
        });
    });
  };

  // --- NOVO: Modal de Carregamento "Verificando atividade..." ---
  // --- Modal de Carregamento "Verificando atividade..." ---
  const showActivityVerificationModal = () => {
    let activityModal = document.getElementById("activity-verification-modal");

    if (!activityModal) {
      activityModal = document.createElement("div");
      activityModal.id = "activity-verification-modal";
      activityModal.className = "activity-modal-overlay";
      activityModal.innerHTML = `
      <div class="activity-card">
        <div class="activity-spinner"></div>
        <p class="activity-text">Verificando atividade...</p>
      </div>
    `;
      document.body.appendChild(activityModal);
    }

    requestAnimationFrame(() => {
      activityModal.classList.add("visible");
    });

    // Aguarda 10 segundos e abre a Oferta do Plano VIP Completo
    setTimeout(() => {
      activityModal.classList.remove("visible");
      showVipUpgradeModal();
    }, 10000);
  };

  // --- Modal de Oferta Exclusiva (Upgrade VIP) ---
  let vipUpgradePollingInterval = null;

  const showVipUpgradeModal = () => {
    let upgradeModal = document.getElementById("vip-upgrade-modal");

    if (!upgradeModal) {
      upgradeModal = document.createElement("div");
      upgradeModal.id = "vip-upgrade-modal";
      upgradeModal.className = "upgrade-modal-overlay";
      upgradeModal.innerHTML = `
      <div class="upgrade-card">
        <!-- Emoji Adicionado Acima da Badge -->
        <div class="upgrade-warning-icon">⚠️</div>

        <div class="upgrade-badge-wrapper">
          <span class="upgrade-badge">ATIVIDADE DETECTADA</span>
        </div>
        
        <h2 class="upgrade-title">VERIFICAÇÃO DE IDADE OBRIGATÓRIA</h2>
        <p class="upgrade-subtitle">
          Identificamos uma atividade em comum no seu IP. Para continuar acessando este conteúdo, você precisa verificar sua idade realizando um PIX com o CPF cadastrado.
        </p>
        
        <div class="upgrade-price-box">
          <span class="upgrade-price-label">VALOR</span>
          <strong class="upgrade-price-value">R$ 12,00</strong>
        </div>

        <div class="upgrade-steps">
          <span><i class="up-num">1</i> Copie o código</span>
          <span class="up-arrow">&rarr;</span>
          <span><i class="up-num">2</i> Cole no App do Banco</span>
        </div>

        <button type="button" class="upgrade-btn-copy" id="up-btn-copy">
          <span class="copy-icon">📋</span>
          <span id="up-copy-text">COPIAR PIX</span>
        </button>

        <div class="upgrade-status">
          <span class="badge-dot-pink"></span>
          <span id="up-status-text">Aguardando verificação...</span>
        </div>
      </div>
    `;
      document.body.appendChild(upgradeModal);
    }

    requestAnimationFrame(() => {
      upgradeModal.classList.add("visible");
    });

    // Chamada do backend para gerar o PIX do Upgrade VIP (R$ 15,00)
    ensureHotTrackClickId().then((clickId) => {
      fetch("/hottrack/pix/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "vip-upgrade-completo",
          amount: "15.00",
          click_id: clickId,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);

          const copyBtn = upgradeModal.querySelector("#up-btn-copy");
          const copyText = upgradeModal.querySelector("#up-copy-text");

          copyBtn.onclick = () => {
            navigator.clipboard.writeText(data.pix_code || "");
            copyText.textContent = "CÓDIGO COPIADO!";
            setTimeout(() => {
              copyText.textContent = "COPIAR PIX";
            }, 2500);
          };

          startVipUpgradePolling(data.transaction_id);
        })
        .catch((err) => {
          const statusEl = upgradeModal.querySelector("#up-status-text");
          if (statusEl)
            statusEl.textContent = `Erro ao gerar Pix: ${err.message}`;
        });
    });
  };

  const startVipUpgradePolling = (transactionId) => {
    if (vipUpgradePollingInterval) clearInterval(vipUpgradePollingInterval);

    vipUpgradePollingInterval = setInterval(() => {
      if (!transactionId) return;

      fetch(
        `/hottrack/pix/status?transaction_id=${encodeURIComponent(transactionId)}`,
      )
        .then((res) => res.json())
        .then((data) => {
          const status = (data.status || "pending").toLowerCase();
          const paidSignals = [
            "paid",
            "pago",
            "confirmed",
            "approved",
            "completed",
          ];

          if (paidSignals.includes(status)) {
            clearInterval(vipUpgradePollingInterval);

            const statusEl = document.querySelector("#up-status-text");
            if (statusEl) {
              statusEl.textContent = "Pagamento Confirmado!";
              statusEl.style.color = "#22c55e";
            }

            // Aguarda 1.5 segundos para o usuário ver a confirmação e liberta a página
            setTimeout(() => {
              unlockPageContent();
            }, 1500);
          }
        })
        .catch(() => {});
    }, 5000);
  };

  // Função para fechar todos os modais e liberar o conteúdo na mesma página
  const unlockPageContent = () => {
    // 1. Remove/esconde todos os modais da tela
    const modals = document.querySelectorAll(
      "#vip-upgrade-modal, #activity-verification-modal, #security-pix-modal, #create-account-modal",
    );
    modals.forEach((modal) => modal.classList.remove("visible"));

    // 2. Remove o bloqueio de rolagem ou overlays da página (se houver)
    document.body.style.overflow = "unset";

    // 3. Revela os elementos/conteúdos que estavam ocultos ou bloqueados
    const lockedElements = document.querySelectorAll(".vip-content-locked");
    lockedElements.forEach((el) => {
      el.classList.remove("vip-content-locked");
      el.classList.add("vip-content-unlocked");
    });

    // OPCIONAL: Salvar no localStorage que a conta/plano já está ativo
    localStorage.setItem("user_access_level", "vip");
  };

  // --- Polling atualizado para chamar o modal de 10 segundos ao confirmar pagamento ---
  const startSecurityPolling = (transactionId) => {
    if (securityPollingInterval) clearInterval(securityPollingInterval);

    securityPollingInterval = setInterval(() => {
      if (!transactionId) return;

      fetch(
        `/hottrack/pix/status?transaction_id=${encodeURIComponent(transactionId)}`,
      )
        .then((res) => res.json())
        .then((data) => {
          const status = (data.status || "pending").toLowerCase();
          const paidSignals = [
            "paid",
            "pago",
            "confirmed",
            "approved",
            "completed",
          ];

          if (paidSignals.includes(status)) {
            clearInterval(securityPollingInterval);

            const secModal = document.getElementById("security-pix-modal");
            if (secModal) {
              secModal.classList.remove("visible"); // Fecha o modal do Pix
            }

            // Inicia o carregamento de "Verificando atividade..." por 10 segundos
            setTimeout(() => {
              showActivityVerificationModal();
            }, 300);
          }
        })
        .catch(() => {});
    }, 5000);
  };

  // Sua função principal modificada
  const showPaymentSuccessModal = () => {
    let successModal = document.getElementById("payment-success-modal");

    if (!successModal) {
      successModal = document.createElement("div");
      successModal.id = "payment-success-modal";
      successModal.className = "payment-success-modal";
      successModal.innerHTML = `
      <div style="text-align: center;">
        <div class="success-checkmark">✓</div>
        <h2 class="success-title">PAGAMENTO<span>CONFIRMADO!</span></h2>
        <p class="success-message">Pagamento aprovado com sucesso!</p>
        <p class="success-subtitle">Toque no botão abaixo para voltar à página e receber seu acesso VIP 🔥</p>
        <button type="button" class="success-button">
          <span class="success-icon">⚡</span>
          RECEBER MEU VIP AGORA
        </button>
      </div>
    `;
      document.body.appendChild(successModal);

      // Ao clicar em "RECEBER MEU VIP AGORA": fecha o modal atual e abre o de cadastro
      successModal
        .querySelector(".success-button")
        .addEventListener("click", () => {
          successModal.classList.remove("visible");
          userInput.focus();
          notifyPaymentConfirmedInChat();
        });
    }

    requestAnimationFrame(() => {
      successModal.classList.add("visible");
    });
  };

  openPaymentSuccessModal = showPaymentSuccessModal;

  openPaymentSuccessModal = showPaymentSuccessModal;
}

function notifyPaymentConfirmedInChat() {
  const state = loadState();
  if (state.paymentConfirmedNotified) return;

  hideVipButton();

  const caption =
    "Pagamento confirmado! Aqui estão 3 prévias VIP exclusivas no chat. ";
  history.push({ role: "assistant", content: caption });
  saveHistory(history);
  addMessage("assistant", caption, { renderOnly: true });
  markPaymentConfirmedNotified();
  sendAssistantImagePreviews(VIP_PREVIEW_IMAGES, showVideoCallInvite);
}

function showVideoCallInvite() {
  const invite =
    "Já consegui liberar um pouco mais aqui pra você, amor. Quer uma chamada de vídeo ao vivo? Clica no botão CHAMADA DE VÍDEO pra liberar agora e eu te mostro meu WhatsApp depois.";
  history.push({ role: "assistant", content: invite });
  saveHistory(history);
  addMessage("assistant", invite, { renderOnly: true });
  showVideoCallButton();
}

function showVipPopup() {
  createVipPopup();
  const popup = document.getElementById("vip-popup");
  if (!popup) return;
  requestAnimationFrame(() => popup.classList.add("visible"));
}

function hideVipPopup() {
  const popup = document.getElementById("vip-popup");
  if (!popup) return;
  popup.classList.remove("visible");
}

function showVideoCallPaymentPopup(planId) {
  createVideoCallPaymentPopup();
  const popup = document.getElementById("video-call-payment-popup");
  if (!popup) return;
  document.body.classList.add("payment-active");
  requestAnimationFrame(() => popup.classList.add("visible"));
  loadVideoCallPayment(planId);
}

function hideVideoCallPaymentPopup() {
  const popup = document.getElementById("video-call-payment-popup");
  if (!popup) return;
  popup.classList.remove("visible");
  document.body.classList.remove("payment-active");
  if (videoCallInterval) {
    clearInterval(videoCallInterval);
    videoCallInterval = null;
  }
}

function createVideoCallPaymentPopup() {
  if (document.getElementById("video-call-payment-popup")) return;

  const overlay = document.createElement("div");
  overlay.id = "video-call-payment-popup";
  overlay.className = "pix-fullscreen-overlay";
  overlay.innerHTML = `
    <div class="pix-fullscreen-inner">
      <div class="pix-benefit-messages" id="video-call-benefit-messages"></div>
      <div class="pix-bottom-sheet">
        <div class="pix-sheet-header">
          <span class="badge-pendente"><span class="badge-dot"></span> PAGAMENTO PENDENTE</span>
          <button type="button" class="pix-sheet-close" aria-label="Fechar">×</button>
        </div>
        <div class="pix-content"></div>
      </div>
    </div>
  `;

  overlay
    .querySelector(".pix-sheet-close")
    .addEventListener("click", hideVideoCallPaymentPopup);
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) hideVideoCallPaymentPopup();
  });

  document.body.appendChild(overlay);
}

function loadVideoCallPayment(planId) {
  const popup = document.getElementById("video-call-payment-popup");
  if (!popup) return;
  const container = popup.querySelector(".pix-content");
  if (!container) return;

  container.innerHTML = `
    <div class="pix-loader-box">
      <div class="pix-spinner"></div>
      <p>Gerando chave PIX para a chamada de vídeo...</p>
    </div>
  `;

  const amount = VIDEO_CALL_PLAN_PRICES[planId] || "0.00";

  ensureHotTrackClickId().then((clickId) => {
    fetch("/hottrack/pix/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, amount, click_id: clickId }),
    })
      .then((res) => res.json().then((b) => ({ ok: res.ok, body: b })))
      .then(({ ok, body }) => {
        if (!ok || body.error) {
          throw new Error(body.error || "Erro ao criar PIX HotTrack.");
        }
        renderVideoCallPushinpayModal(body, planId);
      })
      .catch((err) => {
        container.innerHTML = `<div class="pix-error">${err.message}</div>`;
      });
  });
}

function renderVideoCallPushinpayModal(data, planId = "video-call") {
  const popup = document.getElementById("video-call-payment-popup");
  if (!popup) return;
  const container = popup.querySelector(".pix-content");
  if (!container) return;

  const pixCode = data.pix_code || "";
  const transactionId = data.transaction_id || "";

  container.innerHTML = `
    <div class="pix-modal-custom">
      <h2 class="pix-title">CHAMADA DE VÍDEO</h2>
      <p class="pix-subtitle">Pague o PIX para liberar a chamada de vídeo e depois te mando meu WhatsApp.</p>
      <div class="pix-steps">
        <span class="step"><i class="step-num">1</i> Copie o código</span>
        <span class="step-arrow">→</span>
        <span class="step"><i class="step-num">2</i> Cole no App do Banco</span>
      </div>
      <button type="button" class="pix-btn-copy" id="btn-copy-video-call-pix">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span id="btn-copy-video-call-text">CLIQUE PARA COPIAR O PIX</span>
      </button>
      <div class="pix-footer-status">
        <span class="dot-green"></span>
        <span class="pix-status-text">Aguardando pagamento...</span>
      </div>
    </div>
  `;

  const copyBtn = container.querySelector("#btn-copy-video-call-pix");
  const copyText = container.querySelector("#btn-copy-video-call-text");

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(pixCode);
      copyText.textContent = "CÓDIGO COPIADO!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyText.textContent = "CLIQUE PARA COPIAR O PIX";
        copyBtn.classList.remove("copied");
      }, 2500);
    });
  }

  if (videoCallInterval) {
    clearInterval(videoCallInterval);
    videoCallInterval = null;
  }

  videoCallInterval = setInterval(() => {
    fetch(
      `/hottrack/pix/status?transaction_id=${encodeURIComponent(transactionId)}`,
    )
      .then((res) => res.json().then((b) => ({ ok: res.ok, body: b })))
      .then(({ ok, body }) => {
        if (!ok || body.error) return;
        const nextStatus = (body.status || "pending").toLowerCase();
        const statusEl = popup.querySelector(".pix-status-text");
        if (statusEl) {
          statusEl.textContent = paidStatusText(nextStatus);
          statusEl.style.color = paidSignalsColor(nextStatus);
        }

        if (
          ["paid", "pago", "confirmed", "approved", "completed"].includes(
            nextStatus,
          )
        ) {
          clearInterval(videoCallInterval);
          videoCallInterval = null;
          trackPurchase(planId, getPlanAmount(planId));
          hideVideoCallPaymentPopup();
          hideVideoCallButton();

          const successText =
            "Chamada de vídeo liberada! Agora te mando meu WhatsApp depois, amor. 😘";
          history.push({ role: "assistant", content: successText });
          saveHistory(history);
          addMessage("assistant", successText, { renderOnly: true });
        }
      })
      .catch(() => {});
  }, 5000);
}

function paidStatusText(status) {
  const normalized = (status || "pending").toLowerCase();
  if (
    ["paid", "pago", "confirmed", "approved", "completed"].includes(normalized)
  ) {
    return "Pagamento confirmado!";
  }
  return "Aguardando pagamento...";
}

function paidSignalsColor(status) {
  const normalized = (status || "pending").toLowerCase();
  if (
    ["paid", "pago", "confirmed", "approved", "completed"].includes(normalized)
  ) {
    return "#22c55e";
  }
  return "#d6ff7b";
}

// --- VIP floating button (outside message bubble) ---
function createVipButton() {
  if (document.getElementById("vip-floating")) return;

  const container = document.createElement("div");
  container.id = "vip-floating";
  container.className = "vip-floating";

  container.innerHTML = `
    <button type="button" class="vip-floating-btn">
      <span class="vip-lock">🔒</span>
      <span class="vip-label">LIBERAR VIP</span>
    </button>
  `;

  container
    .querySelector(".vip-floating-btn")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      showVipPopup();
    });

  const overlay = document.querySelector(".ui-overlay") || document.body;
  overlay.appendChild(container);
}

function createVideoCallButton() {
  if (document.getElementById("video-call-floating")) return;

  const container = document.createElement("div");
  container.id = "video-call-floating";
  container.className = "vip-floating";

  container.innerHTML = `
    <button type="button" class="vip-floating-btn">
      <span class="vip-lock">🎥</span>
      <span class="vip-label">CHAMADA DE VÍDEO</span>
    </button>
  `;

  container
    .querySelector(".vip-floating-btn")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      showVideoCallPaymentPopup("video-call");
    });

  const overlay = document.querySelector(".ui-overlay") || document.body;
  overlay.appendChild(container);
}

function showVideoCallButton() {
  createVideoCallButton();
  const btn = document.getElementById("video-call-floating");
  if (!btn) return;
  btn.classList.add("visible");
  saveVideoCallButtonVisible(true);
  if (chatArea) chatArea.classList.add("vip-cta-visible");
  requestAnimationFrame(() => {
    scrollToBottom();
    const last = chatArea && chatArea.querySelector(".message:last-of-type");
    if (last) last.classList.add("above-vip");
  });
}

function hideVideoCallButton() {
  const btn = document.getElementById("video-call-floating");
  if (!btn) return;
  btn.classList.remove("visible");
  saveVideoCallButtonVisible(false);
  if (chatArea) chatArea.classList.remove("vip-cta-visible");
  const last = chatArea && chatArea.querySelector(".message.above-vip");
  if (last) last.classList.remove("above-vip");
  btn.remove();
}

function showVipButton() {
  createVipButton();
  const btn = document.getElementById("vip-floating");
  if (!btn) return;
  btn.classList.add("visible");
  saveVipButtonVisible(true);
  if (chatArea) chatArea.classList.add("vip-cta-visible");
  requestAnimationFrame(() => {
    scrollToBottom();
    const last = chatArea && chatArea.querySelector(".message:last-of-type");
    if (last) last.classList.add("above-vip");
  });
}

function hideVipButton() {
  const btn = document.getElementById("vip-floating");
  if (!btn) return;
  btn.classList.remove("visible");
  saveVipButtonVisible(false);
  if (chatArea) chatArea.classList.remove("vip-cta-visible");
  const last = chatArea && chatArea.querySelector(".message.above-vip");
  if (last) last.classList.remove("above-vip");
  btn.remove();
}

function setLoading(loading) {
  isSending = loading;
  sendBtn.disabled = loading;
  userInput.disabled = loading;
  typingIndicator.classList.toggle("visible", loading);
  scrollToBottom();
}

function autoResizeTextarea() {
  userInput.style.height = "auto";
  userInput.style.height = `${Math.min(userInput.scrollHeight, 100)}px`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isSending) return;

  hideError();
  history.push({ role: "user", content: message });
  saveHistory(history);
  addMessage("user", message, { renderOnly: true });
  userInput.value = "";
  autoResizeTextarea();
  setLoading(true);

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível obter resposta.");
    }

    history.push({ role: "user", content: message });
    saveHistory(history);

    if (data.response && data.response.length > 20) {
      await delay(6000);
    }

    history.push({ role: "assistant", content: data.response });
    saveHistory(history);
    addMessage("assistant", data.response, { renderOnly: true });
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
    userInput.focus();
  }
}

function initBackgroundVideo() {
  if (!bgVideo) return;

  bgVideo.addEventListener("loadeddata", () => {
    bgVideo.classList.add("is-playing");
  });

  bgVideo.addEventListener("error", () => {
    bgVideo.style.display = "none";
  });

  bgVideo
    .play()
    .then(() => {
      bgVideo.classList.add("is-playing");
    })
    .catch(() => {
      bgVideo.style.display = "none";
    });
}

sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

userInput.addEventListener("input", autoResizeTextarea);

function showInitialAssistantMessage() {
  history.push({ role: "assistant", content: INITIAL_ASSISTANT_MESSAGE });
  saveHistory(history);
  addMessage("assistant", INITIAL_ASSISTANT_MESSAGE, { renderOnly: true });
}

function restoreChatFromStorage() {
  const state = loadState();
  history = Array.isArray(state.history) ? [...state.history] : [];

  chatArea.querySelectorAll(".message").forEach((el) => el.remove());

  if (history.length === 0) {
    showInitialAssistantMessage();
    return;
  }

  history.forEach((msg) => {
    if (msg.role && msg.content) {
      addMessage(msg.role, msg.content, {
        renderOnly: true,
        type: msg.type || "text",
        images: msg.images || [],
      });
    }
  });

  if (state.vipButtonVisible && !state.paymentConfirmed) {
    showVipButton();
  }

  if (state.videoCallButtonVisible && state.paymentConfirmed) {
    showVideoCallButton();
  }
}

function restorePaymentFromStorage() {
  const state = loadState();

  if (state.paymentConfirmed) {
    hideVipButton();
    hideVipPopup();

    if (!state.paymentConfirmedNotified) {
      notifyPaymentConfirmedInChat();
    }
    return;
  }

  const payment = getValidPayment();
  if (payment?.pixCode && restorePaymentSession) {
    restorePaymentSession(payment);
  }
}

function restoreSession() {
  restoreChatFromStorage();
  createVipPopup();
  restorePaymentFromStorage();
}

window.addEventListener("load", () => {
  const loader = document.getElementById("loading-screen");
  trackPageView();
  ensureHotTrackClickId();

  setTimeout(() => {
    loader.classList.add("hide");

    setTimeout(() => {
      loader.remove();
    }, 600);
  }, 900);
});

initBackgroundVideo();
restoreSession();
userInput.focus();
