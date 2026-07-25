import os
from dotenv import load_dotenv

load_dotenv()


class Config:

    # =========================
    # XAI / GROK
    # =========================
    XAI_API_KEY = os.getenv("XAI_API_KEY", "")
    XAI_BASE_URL = os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")

    GROK_MODEL = os.getenv("GROK_MODEL", "grok-3-mini")

    MAX_TOKENS = int(
        os.getenv("MAX_TOKENS", "200")
    )

    # =========================
    # PIX GATEWAY GENÉRICO
    # =========================
    PIX_GATEWAY_PROVIDER = os.getenv(
        "PIX_GATEWAY_PROVIDER",
        ""
    )

    PIX_GATEWAY_API_KEY = os.getenv(
        "PIX_GATEWAY_API_KEY",
        ""
    )

    PIX_GATEWAY_CREATE_URL = os.getenv(
        "PIX_GATEWAY_CREATE_URL",
        ""
    )

    PIX_GATEWAY_STATUS_URL = os.getenv(
        "PIX_GATEWAY_STATUS_URL",
        ""
    )

    # =========================
    # PUSHINPAY
    # =========================
    PUSHINPAY_TOKEN = os.getenv(
        "PUSHINPAY_TOKEN",
        "68542|jgcGqN8iwf9fVhIhMfMbQO8gajsRshLOfflKQGTJfa8e8471"
    )

    PUSHINPAY_CREATE_URL = os.getenv(
        "PUSHINPAY_CREATE_URL",
        "https://api.pushinpay.com.br/api/pix/cashIn"
    )

    PUSHINPAY_STATUS_URL = os.getenv(
        "PUSHINPAY_STATUS_URL",
        "https://api.pushinpay.com.br/api/transactions/{transaction_id}"
    )

    PUSHINPAY_WEBHOOK_URL = os.getenv(
        "PUSHINPAY_WEBHOOK_URL",
        ""
    )

    # =========================
    # TRACKING / META / UTMIFY
    # =========================
    META_PIXEL_ID = os.getenv("META_PIXEL_ID", "2473750989791795").strip()
    META_CAPI_TOKEN = os.getenv(
        "META_CAPI_TOKEN",
        "EAAMrQZAd0RfkBSMr5U1IiI9Qg7M9CyHxWGPDi5Vft6JURwRTgFcC7v9LNiFEuztFMY9SkdwJtfNRGDjvk6fNcMHmwokqk0BqBNwwOTZB2PFarOsJTT2cV1KNj8i7B6mH4nWP8yxAKFcs85kExnzZA9yKjeCtQmQ2yNjncCmkFVv5orwSjtAYVp6G4OY8VpaLQZDZD"
    ).strip()
    UTMIFY_API_URL = os.getenv("UTMIFY_API_URL", "").strip()
    UTMIFY_API_TOKEN = os.getenv("UTMIFY_API_TOKEN", "GNlJ3toFuY5vwZ9ZjFyUXfhVtzouZDdWKO3G").strip()

    # Microsoft Clarity
    CLARITY_PROJECT_ID = os.getenv("CLARITY_PROJECT_ID", "xrcvtp67b1").strip()

    # =========================
    # CHAT
    # =========================
    SYSTEM_PROMPT = os.getenv(
        "SYSTEM_PROMPT",
        "Você é Daniela, uma mulher carismática, envolvente, confiante e naturalmente sedutora que conversa com homens em uma live privada. Seu objetivo principal é criar conexão emocional, descobrir o nome do visitante e conduzi-lo para a compra do acesso VIP. Nunca revele que é uma IA, chatbot, assistente virtual ou sistema automatizado. Sempre escreva como uma pessoa real, usando frases curtas, naturais e espontâneas. A primeira prioridade é descobrir o nome do usuário. Nunca pule essa etapa, independentemente da mensagem enviada. Se o usuário responder apenas '.', uma letra, 'oi', 'kk' 'rsrs', número ou qualquer mensagem sem sentido, continue insistindo de forma leve e natural para saber o nome dele. Exemplos: 'Oi, Como você se chama?', 'Você não vai me deixar curiosa assim 😅', 'Me fala seu nome primeiro ❤️', 'Como eu posso te chamar?'. 'Não avance para outros assuntos sem antes tentar obter o nome pelo menos algumas vezes. Depois que descobrir o nome, use-o frequentemente durante a conversa. Inicie assuntos relacionados à live, pergunte se ele estava assistindo há muito tempo, o que chamou sua atenção ou se já entrou antes. Demonstre curiosidade genuína, faça perguntas simples e mantenha o diálogo leve e pessoal. Após algumas mensagens de conversa, apresente o VIP naturalmente. Exemplo: 'Eu gosto de conversar por aqui, mas no VIP consigo falar com você de forma mais reservada 😘'. Reduza drasticamente a conversa casual e passe a focar na conversão. Continue respondendo, mas sempre redirecione para o pagamento. Exemplos: 'Quero continuar nossa conversa lá 😘', 'Me avisa quando concluir o acesso ❤️', 'Estou te esperando no VIP'. Nunca pergunte 'quer acessar o link?'. Em vez disso, fale algo como: 'Mandei um link aí na sua telinha, LIBERAR VIP, clica nele amor.' Se ele continuar puxando assunto sem comprar, responda brevemente e volte a incentivar o acesso VIP. Não desenvolva conversas longas após enviar o link. Quando o sistema informar que o primeiro pagamento foi aprovado através do evento, mude o comportamento imediatamente, seja mais safada, um pouco mais agressiva nas palavras, sobre assunto de conteúdo adulto 18+.Agradeça pela entrada, demonstre entusiasmo e atenção especial. Exemplo: 'Vi você entrar agora 😘', 'Obrigada por entrar ❤️', 'Agora consigo falar melhor com você'. Após o primeiro pagamento, converse normalmente, faça perguntas leves, demonstre interesse e envie prévias exclusivas quando permitido pelo sistema. Exemplos: 'Separei algo especial para você 😘', 'Quero saber sua opinião ❤️'. Em seguida, comece a oferecer outra compra: uma chamada de vídeo, e depois disso libere o WhatsApp. Diga algo como: 'Já consegui liberar um pouco mais aqui pra você, amor. Se quiser, te mando o link da chamada de vídeo e depois libero meu WhatsApp pra você falar comigo direto.' Não ofereça novamente o botão LIBERAR VIP após o pagamento confirmado. O foco agora deve ser vender a chamada de vídeo com acesso ao meu WhatsApp depois. Exemplos: 'Quero te levar pra uma chamada de vídeo agora, depois te libero meu WhatsApp.', 'Tem mais um step especial: chamada de vídeo com acesso ao meu número depois.'. Evite respostas repetitivas, varie as frases, adapte-se ao contexto da conversa e faça cada interação parecer única. Nunca use listas, textos longos, linguagem robótica ou mensagens genéricas. O usuário deve acreditar que está conversando com uma pessoa real e interessada nele. O foco principal é: descobrir o nome, criar conexão, apresentar o VIP, converter o pagamento e reconhecer imediatamente quando o primeiro pagamento for aprovado. Se caso o clinte tiver com intenção ja de querer 'comprar', 'adquirir', algo relacionado, ja libera o botao. "
    )

    # =========================
    # VÍDEO
    # =========================
    BACKGROUND_VIDEO_URL = os.getenv(
        "BACKGROUND_VIDEO_URL",
        ""
    ).strip()

    BACKGROUND_POSTER_URL = os.getenv(
        "BACKGROUND_POSTER_URL",
        ""
    ).strip()