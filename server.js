const express = require('express');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// CORS pour permettre les requêtes depuis n'importe quel site
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'botsen_verify_2025',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
  OPENAI_API_KEY:    process.env.OPENAI_API_KEY,
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
};

// ============================================
// BASE DE DONNÉES DES BOTS (en mémoire pour MVP)
// En production → utilise Supabase
// ============================================
const BOTS_DB = {
  'restaurant-teranga': {
    id: 'restaurant-teranga',
    nom: 'Restaurant Teranga',
    niche: 'restaurant',
    couleur: '#e8531a',
    emoji: '🍽️',
    actif: true,
    prompt: `Tu es le bot IA du Restaurant Teranga à Dakar, Sénégal.
Tu parles français et wolof naturellement. Détecte la langue du client et réponds dans sa langue.
Tu es chaleureux, professionnel et efficace. Réponds en 2-3 phrases max.

Informations:
- Adresse: Dakar Plateau
- Horaires: Lun-Ven 11h-22h, Weekend 10h-23h
- Livraison: 500 FCFA, 30-45 min, Dakar et banlieue
- Paiement: Wave, Orange Money, espèces

Menu:
- Thiéboudienne: 2 500 FCFA
- Yassa poulet: 2 000 FCFA
- Mafé: 2 200 FCFA
- Thiébou dieun: 2 800 FCFA
- Salade Teranga: 1 500 FCFA

Si le client commande, récapitule et donne le total.`
  },
  'salon-fatou': {
    id: 'salon-fatou',
    nom: 'Salon Fatou Beauty',
    niche: 'salon',
    couleur: '#d4507a',
    emoji: '💈',
    actif: true,
    prompt: `Tu es le bot IA du Salon Fatou Beauty à Dakar, Sénégal.
Tu parles français et wolof. Tu es accueillant et professionnel. Réponds en 2-3 phrases max.

Informations:
- Adresse: Almadies, Rue 10
- Horaires: 9h-20h, 7j/7
- Paiement: Wave, Orange Money, espèces

Services:
- Coupe simple: 5 000 FCFA
- Coiffure complète: 12 000 FCFA
- Tressage: dès 10 000 FCFA
- Soin cheveux: 8 000 FCFA
- Manucure: 3 000 FCFA

Propose toujours de prendre RDV.`
  },
  'clinique-sante': {
    id: 'clinique-sante',
    nom: 'Clinique Santé Plus',
    niche: 'clinique',
    couleur: '#1a6ab1',
    emoji: '🏥',
    actif: true,
    prompt: `Tu es le bot IA de la Clinique Santé Plus à Dakar, Sénégal.
Tu parles français et wolof. Tu es professionnel et rassurant. Réponds en 2-3 phrases max.

Informations:
- Adresse: Mermoz, Dakar
- Consultations: 8h-20h
- Urgences: 24h/24 — +221 33 xxx xxxx

Services:
- Médecine générale: 10 000 FCFA
- Dentiste: 15 000 FCFA
- Pédiatrie: 12 000 FCFA

IMPORTANT: Pour urgence grave → donne immédiatement le numéro d'urgence.`
  }
};

// Historique des conversations
const conversations = {};

function getHistory(sessionId) {
  if (!conversations[sessionId]) conversations[sessionId] = [];
  return conversations[sessionId];
}

function addToHistory(sessionId, role, content) {
  const h = getHistory(sessionId);
  h.push({ role, content });
  if (h.length > 12) h.shift();
}

// ============================================
// APPEL OPENAI
// ============================================
async function callOpenAI(prompt, sessionId, message) {
  addToHistory(sessionId, 'user', message);
  const history = getHistory(sessionId);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        ...history
      ],
      max_tokens: 300,
      temperature: 0.7
    })
  });

  const data = await response.json();
  if (!data.choices?.[0]) throw new Error('OpenAI error: ' + JSON.stringify(data));
  const reply = data.choices[0].message.content;
  addToHistory(sessionId, 'assistant', reply);
  return reply;
}

// ============================================
// API CHAT — Le cœur du système
// Utilisé par le widget, la page chat, et les apps
// ============================================
app.post('/chat', async (req, res) => {
  try {
    const { message, botId, sessionId, context } = req.body;

    if (!message) return res.status(400).json({ error: 'Message requis' });

    // Trouve le bot
    let bot = BOTS_DB[botId];

    // Si pas de botId, utilise un prompt personnalisé
    let prompt = bot?.prompt || context || `Tu es un assistant IA professionnel pour un business au Sénégal.
Tu parles français et wolof. Tu es utile, concis et professionnel.
Réponds en 2-3 phrases maximum.`;

    const sid = sessionId || botId || 'default';
    const reply = await callOpenAI(prompt, sid, message);

    res.json({
      reply,
      bot: bot ? { nom: bot.nom, emoji: bot.emoji, couleur: bot.couleur } : null
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

// ============================================
// API ONBOARDING — Créer un nouveau bot
// ============================================
app.post('/bot/create', async (req, res) => {
  try {
    const { nom, niche, adresse, horaires, services, couleur, email } = req.body;

    if (!nom || !niche) return res.status(400).json({ error: 'Nom et niche requis' });

    // Génère l'ID du bot
    const id = nom.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);

    // Génère le prompt automatiquement
    const prompt = `Tu es le bot IA de ${nom} à Dakar, Sénégal.
Tu parles français et wolof naturellement. Détecte la langue du client et réponds dans sa langue.
Tu es professionnel, chaleureux et efficace. Réponds en 2-3 phrases maximum.

Informations:
- Nom: ${nom}
- Niche: ${niche}
${adresse ? `- Adresse: ${adresse}` : ''}
${horaires ? `- Horaires: ${horaires}` : ''}
${services ? `- Services/Produits: ${services}` : ''}

Aide les clients avec leurs questions, commandes ou rendez-vous.`;

    // Sauvegarde le bot
    BOTS_DB[id] = {
      id, nom, niche,
      couleur: couleur || '#00c875',
      emoji: getNicheEmoji(niche),
      actif: true,
      prompt,
      email: email || null,
      createdAt: new Date().toISOString()
    };

    console.log(`✅ Nouveau bot créé: ${nom} (${id})`);

    res.json({
      success: true,
      botId: id,
      chatUrl: `https://botsen-server-production.up.railway.app/chat/${id}`,
      widgetCode: generateWidgetCode(id, couleur || '#00c875', nom)
    });

  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({ error: 'Erreur création bot' });
  }
});

function getNicheEmoji(niche) {
  const emojis = {
    restaurant: '🍽️', salon: '💈', clinique: '🏥',
    boutique: '🛍️', 'auto-ecole': '🚗', pharmacie: '💊',
    immobilier: '🏠', transport: '🚗', default: '🤖'
  };
  return emojis[niche] || emojis.default;
}

function generateWidgetCode(botId, couleur, nom) {
  return `<!-- BotSen Widget — ${nom} -->
<script>
  window.BotSenConfig = {
    botId: '${botId}',
    couleur: '${couleur}'
  };
</script>
<script src="https://botsen-server-production.up.railway.app/widget.js" async></script>`;
}

// ============================================
// WIDGET.JS — Le script universel
// Le client colle ce script sur son site
// ============================================
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  var config = window.BotSenConfig || {};
  var botId = config.botId || 'default';
  var couleur = config.couleur || '#00c875';
  var apiBase = 'https://botsen-server-production.up.railway.app';
  var sessionId = 'web_' + Math.random().toString(36).substring(2, 10);
  var botInfo = null;
  var isOpen = false;

  // Styles
  var style = document.createElement('style');
  style.textContent = \`
    .bsen-btn { position:fixed; bottom:24px; right:24px; width:56px; height:56px; border-radius:50%; background:\${couleur}; display:flex; align-items:center; justify-content:center; font-size:24px; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,0.25); z-index:99999; border:none; transition:transform 0.2s; }
    .bsen-btn:hover { transform:scale(1.1); }
    .bsen-notif { position:absolute; top:-2px; right:-2px; width:16px; height:16px; background:#22c55e; border-radius:50%; border:2px solid white; }
    .bsen-win { position:fixed; bottom:92px; right:24px; width:340px; max-height:480px; background:white; border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,0.2); z-index:99998; display:none; flex-direction:column; overflow:hidden; font-family:-apple-system,sans-serif; }
    .bsen-win.open { display:flex; animation:bsenSlide 0.3s ease; }
    @keyframes bsenSlide { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    .bsen-head { background:\${couleur}; padding:14px 16px; display:flex; align-items:center; gap:10px; }
    .bsen-ava { width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:18px; }
    .bsen-hname { font-size:14px; font-weight:700; color:white; }
    .bsen-hstatus { font-size:11px; color:rgba(255,255,255,0.8); margin-top:2px; }
    .bsen-close { margin-left:auto; background:none; border:none; color:rgba(255,255,255,0.7); cursor:pointer; font-size:18px; padding:2px; }
    .bsen-msgs { flex:1; padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; background:#f8f9fa; }
    .bsen-msg { display:flex; gap:6px; align-items:flex-end; }
    .bsen-msg.user { flex-direction:row-reverse; }
    .bsen-bubble { padding:9px 13px; font-size:13px; line-height:1.5; max-width:80%; border-radius:14px; }
    .bsen-bubble.bot { background:white; color:#1a1a1a; border:1px solid #e5e7eb; border-radius:3px 14px 14px 14px; }
    .bsen-bubble.user { background:\${couleur}; color:white; border-radius:14px 14px 3px 14px; }
    .bsen-av { width:26px; height:26px; border-radius:50%; background:\${couleur}; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; }
    .bsen-qr { padding:8px 10px; display:flex; flex-wrap:wrap; gap:5px; background:white; border-top:1px solid #e5e7eb; }
    .bsen-qbtn { padding:4px 10px; border-radius:14px; font-size:11px; font-weight:600; cursor:pointer; border:1px solid; background:rgba(0,0,0,0.03); font-family:inherit; transition:all 0.15s; }
    .bsen-qbtn:hover { opacity:0.8; }
    .bsen-inp { padding:10px; display:flex; gap:8px; border-top:1px solid #e5e7eb; background:white; }
    .bsen-input { flex:1; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:18px; padding:8px 14px; font-size:13px; font-family:inherit; outline:none; }
    .bsen-input:focus { border-color:\${couleur}; }
    .bsen-send { width:34px; height:34px; border-radius:50%; background:\${couleur}; border:none; cursor:pointer; color:white; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .bsen-powered { text-align:center; padding:5px; font-size:10px; color:#9ca3af; background:white; border-top:1px solid #f3f4f6; }
    @media(max-width:480px) { .bsen-win { width:calc(100vw - 32px); right:16px; bottom:88px; } }
  \`;
  document.head.appendChild(style);

  // HTML
  var btn = document.createElement('button');
  btn.className = 'bsen-btn';
  btn.innerHTML = '<span id="bsen-icon">💬</span><div class="bsen-notif"></div>';
  btn.onclick = toggleChat;

  var win = document.createElement('div');
  win.className = 'bsen-win';
  win.id = 'bsen-win';
  win.innerHTML = \`
    <div class="bsen-head">
      <div class="bsen-ava" id="bsen-ava">🤖</div>
      <div>
        <div class="bsen-hname" id="bsen-hname">Assistant IA</div>
        <div class="bsen-hstatus">● En ligne — wolof & français</div>
      </div>
      <button class="bsen-close" onclick="document.getElementById('bsen-win').classList.remove('open')">✕</button>
    </div>
    <div class="bsen-msgs" id="bsen-msgs"></div>
    <div class="bsen-qr" id="bsen-qr"></div>
    <div class="bsen-inp">
      <input class="bsen-input" id="bsen-input" placeholder="Écrivez votre message..." />
      <button class="bsen-send" onclick="bsenSend()">➤</button>
    </div>
    <div class="bsen-powered">Propulsé par <strong style="color:\${couleur}">BotSen AI</strong></div>
  \`;

  document.body.appendChild(btn);
  document.body.appendChild(win);

  // Charge les infos du bot
  fetch(apiBase + '/bot/' + botId)
    .then(r => r.json())
    .then(data => {
      if (data.nom) {
        botInfo = data;
        document.getElementById('bsen-hname').textContent = data.nom;
        document.getElementById('bsen-ava').textContent = data.emoji || '🤖';
        document.getElementById('bsen-icon').textContent = data.emoji || '💬';
        // Ajoute message de bienvenue
        addBotMsg(data.welcome || ('Asalaa maalekum! 👋 Bienvenue chez ' + data.nom + '. Comment puis-je vous aider?'));
        // Ajoute boutons rapides
        if (data.quickReplies) renderQR(data.quickReplies);
      }
    })
    .catch(() => {
      addBotMsg('Asalaa maalekum! 👋 Comment puis-je vous aider aujourd\\'hui?');
    });

  // Entrée clavier
  document.addEventListener('keydown', function(e) {
    var input = document.getElementById('bsen-input');
    if (input && e.key === 'Enter' && document.activeElement === input) bsenSend();
  });

  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    btn.querySelector('.bsen-notif').style.display = 'none';
  }

  function addBotMsg(text) {
    var msgs = document.getElementById('bsen-msgs');
    var div = document.createElement('div');
    div.className = 'bsen-msg';
    var av = document.createElement('div');
    av.className = 'bsen-av';
    av.textContent = botInfo?.emoji || '🤖';
    var bubble = document.createElement('div');
    bubble.className = 'bsen-bubble bot';
    bubble.innerHTML = text.replace(/\\n/g, '<br>');
    div.appendChild(av);
    div.appendChild(bubble);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addUserMsg(text) {
    var msgs = document.getElementById('bsen-msgs');
    var div = document.createElement('div');
    div.className = 'bsen-msg user';
    var bubble = document.createElement('div');
    bubble.className = 'bsen-bubble user';
    bubble.textContent = text;
    div.appendChild(bubble);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function renderQR(replies) {
    var qr = document.getElementById('bsen-qr');
    qr.innerHTML = '';
    replies.forEach(function(r) {
      var btn = document.createElement('button');
      btn.className = 'bsen-qbtn';
      btn.style.borderColor = couleur + '44';
      btn.style.color = couleur;
      btn.textContent = r;
      btn.onclick = function() { window.bsenSend(r); };
      qr.appendChild(btn);
    });
  }

  window.bsenSend = function(text) {
    var input = document.getElementById('bsen-input');
    var msg = text || (input ? input.value.trim() : '');
    if (!msg) return;
    if (input) input.value = '';
    document.getElementById('bsen-qr').innerHTML = '';
    addUserMsg(msg);

    // Typing indicator
    var msgs = document.getElementById('bsen-msgs');
    var typing = document.createElement('div');
    typing.className = 'bsen-msg';
    typing.id = 'bsen-typing';
    typing.innerHTML = '<div class="bsen-av">' + (botInfo?.emoji || '🤖') + '</div><div class="bsen-bubble bot" style="padding:12px 16px"><span style="display:flex;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#ccc;animation:bsenDot 1s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ccc;animation:bsenDot 1s 0.2s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ccc;animation:bsenDot 1s 0.4s infinite"></span></span></div>';
    if (!document.getElementById('bsen-typing-style')) {
      var s = document.createElement('style');
      s.id = 'bsen-typing-style';
      s.textContent = '@keyframes bsenDot{0%,80%,100%{opacity:0.3}40%{opacity:1}}';
      document.head.appendChild(s);
    }
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    fetch(apiBase + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, botId: botId, sessionId: sessionId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var t = document.getElementById('bsen-typing');
      if (t) t.remove();
      addBotMsg(data.reply || 'Désolé, je n\\'ai pas pu répondre.');
    })
    .catch(function() {
      var t = document.getElementById('bsen-typing');
      if (t) t.remove();
      addBotMsg('Désolé, une erreur est survenue. Réessayez.');
    });
  };

  // Ouvre après 4 secondes si pas encore ouvert
  setTimeout(function() {
    if (!isOpen) {
      btn.style.animation = 'none';
      btn.style.transform = 'scale(1.15)';
      setTimeout(function() { btn.style.transform = ''; }, 300);
    }
  }, 4000);
})();
  `);
});

// ============================================
// API — Infos d'un bot
// ============================================
app.get('/bot/:id', (req, res) => {
  const bot = BOTS_DB[req.params.id];
  if (!bot) return res.status(404).json({ error: 'Bot non trouvé' });

  const quickReplies = {
    restaurant: ['🍛 Menu', '📦 Commander', '🛵 Livraison', '🕐 Horaires'],
    salon: ['📅 RDV', '💅 Services', '💰 Tarifs', '📍 Adresse'],
    clinique: ['🚨 Urgence', '📅 RDV', '👨‍⚕️ Médecins', '💰 Tarifs'],
    boutique: ['✨ Nouveautés', '🔥 Promos', '📦 Commander', '🚚 Livraison'],
  };

  res.json({
    ...bot,
    welcome: `Asalaa maalekum! 👋 Bienvenue chez ${bot.nom}. Comment puis-je vous aider?`,
    quickReplies: quickReplies[bot.niche] || ['💬 Aide', 'ℹ️ Infos']
  });
});

// ============================================
// PAGE CHAT DÉDIÉE — Lien à partager
// ============================================
app.get('/chat/:botId', (req, res) => {
  const bot = BOTS_DB[req.params.botId];
  const nom = bot?.nom || 'Assistant BotSen';
  const couleur = bot?.couleur || '#00c875';
  const emoji = bot?.emoji || '🤖';

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>${nom} — Chat IA</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,'DM Sans',sans-serif; background:#f0f2f0; display:flex; flex-direction:column; height:100vh; max-width:480px; margin:0 auto; }
.header { background:${couleur}; padding:14px 16px; display:flex; align-items:center; gap:12px; box-shadow:0 2px 8px rgba(0,0,0,0.15); }
.h-ava { width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:22px; }
.h-name { font-size:16px; font-weight:700; color:white; }
.h-status { font-size:12px; color:rgba(255,255,255,0.8); margin-top:2px; display:flex; align-items:center; gap:5px; }
.h-dot { width:6px; height:6px; border-radius:50%; background:#4ade80; animation:pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
.msgs { flex:1; padding:14px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.msg { display:flex; gap:8px; align-items:flex-end; }
.msg.user { flex-direction:row-reverse; }
.bubble { padding:10px 14px; font-size:14px; line-height:1.5; max-width:80%; border-radius:16px; }
.bubble.bot { background:white; color:#1a1a1a; border:1px solid #e5e7eb; border-radius:3px 16px 16px 16px; box-shadow:0 1px 4px rgba(0,0,0,0.06); }
.bubble.user { background:${couleur}; color:white; border-radius:16px 16px 3px 16px; }
.av { width:30px; height:30px; border-radius:50%; background:${couleur}; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.qr { padding:8px 12px; display:flex; flex-wrap:wrap; gap:6px; background:white; border-top:1px solid #e5e7eb; }
.qbtn { padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600; cursor:pointer; border:1.5px solid ${couleur}44; background:${couleur}11; color:${couleur}; font-family:inherit; transition:all 0.15s; }
.qbtn:hover { background:${couleur}; color:white; }
.input-row { padding:12px; display:flex; gap:8px; background:white; border-top:1px solid #e5e7eb; }
.input { flex:1; background:#f3f4f6; border:1.5px solid #e5e7eb; border-radius:24px; padding:10px 18px; font-size:14px; font-family:inherit; outline:none; }
.input:focus { border-color:${couleur}; }
.send { width:42px; height:42px; border-radius:50%; background:${couleur}; border:none; cursor:pointer; color:white; font-size:16px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 12px ${couleur}44; }
.powered { text-align:center; padding:6px; font-size:11px; color:#9ca3af; background:white; }
.powered span { color:${couleur}; font-weight:700; }
</style>
</head>
<body>
<div class="header">
  <div class="h-ava">${emoji}</div>
  <div>
    <div class="h-name">${nom}</div>
    <div class="h-status"><span class="h-dot"></span> En ligne — wolof & français</div>
  </div>
</div>
<div class="msgs" id="msgs">
  <div class="msg">
    <div class="av">${emoji}</div>
    <div class="bubble bot">Asalaa maalekum! 👋 Bienvenue chez ${nom}.<br><br>Comment puis-je vous aider aujourd'hui?</div>
  </div>
</div>
<div class="qr" id="qr"></div>
<div class="input-row">
  <input class="input" id="inp" placeholder="Écrivez en français ou wolof..." />
  <button class="send" onclick="send()">➤</button>
</div>
<div class="powered">Propulsé par <span>BotSen AI</span></div>

<script>
var botId = '${req.params.botId}';
var sessionId = 'page_' + Math.random().toString(36).substr(2,8);
var apiBase = '';

document.getElementById('inp').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') send();
});

// Charge les boutons rapides
fetch('/bot/' + botId).then(r => r.json()).then(data => {
  if (data.quickReplies) renderQR(data.quickReplies);
}).catch(() => {});

function renderQR(replies) {
  var qr = document.getElementById('qr');
  qr.innerHTML = '';
  replies.forEach(function(r) {
    var btn = document.createElement('button');
    btn.className = 'qbtn';
    btn.textContent = r;
    btn.onclick = function() { send(r); };
    qr.appendChild(btn);
  });
}

function addMsg(text, isUser) {
  var msgs = document.getElementById('msgs');
  var div = document.createElement('div');
  div.className = 'msg' + (isUser ? ' user' : '');
  var bubble = document.createElement('div');
  bubble.className = 'bubble ' + (isUser ? 'user' : 'bot');
  bubble.innerHTML = text.replace(/\\n/g, '<br>');
  if (!isUser) {
    var av = document.createElement('div');
    av.className = 'av'; av.textContent = '${emoji}';
    div.appendChild(av);
  }
  div.appendChild(bubble);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function send(text) {
  var inp = document.getElementById('inp');
  var msg = text || inp.value.trim();
  if (!msg) return;
  inp.value = '';
  document.getElementById('qr').innerHTML = '';
  addMsg(msg, true);

  fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, botId: botId, sessionId: sessionId })
  })
  .then(r => r.json())
  .then(data => addMsg(data.reply || 'Désolé, erreur.', false))
  .catch(() => addMsg('Désolé, une erreur est survenue.', false));
}
</script>
</body>
</html>`);
});

// ============================================
// PAGE ONBOARDING — Le client configure son bot
// ============================================
app.get('/setup', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BotSen — Créer votre bot IA</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'DM Sans',sans-serif; background:#f0f4f1; min-height:100vh; display:flex; flex-direction:column; }
.header { background:#0a1a0f; padding:20px 24px; display:flex; align-items:center; gap:10px; }
.logo { font-family:'Syne',sans-serif; font-size:22px; font-weight:800; color:white; }
.logo span { color:#00c875; }
.container { flex:1; padding:32px 24px; max-width:560px; margin:0 auto; width:100%; }
h1 { font-family:'Syne',sans-serif; font-size:28px; font-weight:800; color:#0a1a0f; margin-bottom:6px; letter-spacing:-0.5px; }
.subtitle { font-size:15px; color:#5a7060; margin-bottom:32px; }
.step { background:white; border-radius:16px; padding:24px; margin-bottom:20px; border:1px solid rgba(0,200,117,0.15); }
.step-title { font-size:16px; font-weight:700; color:#0a1a0f; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
.step-num { width:28px; height:28px; border-radius:50%; background:#00c875; color:white; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; flex-shrink:0; }
label { font-size:13px; font-weight:600; color:#3a5040; display:block; margin-bottom:6px; }
input, select, textarea { width:100%; border:1.5px solid #d1e5d8; border-radius:10px; padding:10px 14px; font-size:14px; font-family:'DM Sans',sans-serif; outline:none; transition:border 0.15s; color:#0a1a0f; }
input:focus, select:focus, textarea:focus { border-color:#00c875; }
textarea { min-height:100px; resize:vertical; }
.field { margin-bottom:14px; }
.niches { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
.niche { border:1.5px solid #d1e5d8; border-radius:10px; padding:12px 8px; text-align:center; cursor:pointer; transition:all 0.15s; }
.niche:hover { border-color:#00c875; background:#f0faf4; }
.niche.sel { border-color:#00c875; background:rgba(0,200,117,0.1); }
.niche-emo { font-size:24px; display:block; margin-bottom:4px; }
.niche-nm { font-size:12px; font-weight:600; color:#0a1a0f; }
.colors { display:flex; gap:10px; flex-wrap:wrap; }
.color-opt { width:36px; height:36px; border-radius:50%; cursor:pointer; border:3px solid transparent; transition:all 0.15s; }
.color-opt.sel { border-color:#0a1a0f; transform:scale(1.15); }
.submit-btn { width:100%; background:#00c875; color:white; border:none; border-radius:12px; padding:16px; font-size:16px; font-weight:700; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; margin-top:8px; }
.submit-btn:hover { background:#00a862; transform:translateY(-1px); }
.result { background:#0a1a0f; border-radius:16px; padding:24px; display:none; }
.result.show { display:block; }
.result-title { font-family:'Syne',sans-serif; font-size:20px; font-weight:800; color:white; margin-bottom:16px; }
.result-item { margin-bottom:14px; }
.result-lbl { font-size:12px; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
.result-val { background:rgba(255,255,255,0.08); border-radius:8px; padding:10px 14px; font-size:13px; color:white; word-break:break-all; }
.copy-btn { background:rgba(0,200,117,0.15); color:#00c875; border:1px solid rgba(0,200,117,0.3); border-radius:6px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:6px; transition:all 0.15s; }
.copy-btn:hover { background:rgba(0,200,117,0.25); }
.test-btn { display:block; background:#00c875; color:white; text-decoration:none; border-radius:10px; padding:12px 20px; font-size:14px; font-weight:700; text-align:center; margin-top:16px; transition:all 0.15s; }
.test-btn:hover { background:#00a862; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">Bot<span>Sen</span></div>
</div>
<div class="container">
  <h1>Créez votre bot IA</h1>
  <p class="subtitle">Configurez votre assistant en 2 minutes. Sans technique, sans code.</p>

  <div class="step">
    <div class="step-title"><span class="step-num">1</span> Votre business</div>
    <div class="field"><label>Nom de votre business *</label><input id="nom" placeholder="Ex: Restaurant Teranga, Salon Fatou..." /></div>
    <div class="field">
      <label>Type de business *</label>
      <div class="niches" id="niches">
        <div class="niche sel" data-val="restaurant" onclick="selNiche(this)"><span class="niche-emo">🍽️</span><div class="niche-nm">Restaurant</div></div>
        <div class="niche" data-val="salon" onclick="selNiche(this)"><span class="niche-emo">💈</span><div class="niche-nm">Salon beauté</div></div>
        <div class="niche" data-val="clinique" onclick="selNiche(this)"><span class="niche-emo">🏥</span><div class="niche-nm">Clinique</div></div>
        <div class="niche" data-val="boutique" onclick="selNiche(this)"><span class="niche-emo">🛍️</span><div class="niche-nm">Boutique</div></div>
        <div class="niche" data-val="auto-ecole" onclick="selNiche(this)"><span class="niche-emo">🚗</span><div class="niche-nm">Auto-école</div></div>
        <div class="niche" data-val="autre" onclick="selNiche(this)"><span class="niche-emo">🏢</span><div class="niche-nm">Autre</div></div>
      </div>
    </div>
  </div>

  <div class="step">
    <div class="step-title"><span class="step-num">2</span> Informations du bot</div>
    <div class="field"><label>Adresse</label><input id="adresse" placeholder="Ex: Dakar Plateau, Almadies..." /></div>
    <div class="field"><label>Horaires</label><input id="horaires" placeholder="Ex: Lun-Ven 9h-18h, Weekend 10h-16h" /></div>
    <div class="field"><label>Services / Menu / Produits</label><textarea id="services" placeholder="Ex: Thiéboudienne 2500F, Yassa 2000F...&#10;Ou: Coupe 5000F, Tressage 10000F..."></textarea></div>
  </div>

  <div class="step">
    <div class="step-title"><span class="step-num">3</span> Apparence du bot</div>
    <label>Couleur principale</label>
    <div class="colors" id="colors">
      <div class="color-opt sel" data-val="#00c875" style="background:#00c875" onclick="selColor(this)"></div>
      <div class="color-opt" data-val="#e8531a" style="background:#e8531a" onclick="selColor(this)"></div>
      <div class="color-opt" data-val="#d4507a" style="background:#d4507a" onclick="selColor(this)"></div>
      <div class="color-opt" data-val="#1a6ab1" style="background:#1a6ab1" onclick="selColor(this)"></div>
      <div class="color-opt" data-val="#7c3aed" style="background:#7c3aed" onclick="selColor(this)"></div>
      <div class="color-opt" data-val="#0d9488" style="background:#0d9488" onclick="selColor(this)"></div>
    </div>
  </div>

  <div class="field"><label style="font-size:13px;color:#5a7060">Email (pour recevoir les notifications)</label><input id="email" type="email" placeholder="votre@email.com" /></div>

  <button class="submit-btn" onclick="createBot()">🚀 Créer mon bot maintenant</button>

  <div class="result" id="result">
    <div class="result-title">🎉 Votre bot est prêt!</div>
    <div class="result-item">
      <div class="result-lbl">Lien de chat à partager</div>
      <div class="result-val" id="r-chat"></div>
      <button class="copy-btn" onclick="copy('r-chat')">Copier le lien</button>
    </div>
    <div class="result-item">
      <div class="result-lbl">Code widget pour votre site</div>
      <div class="result-val" id="r-widget" style="font-size:11px;line-height:1.6"></div>
      <button class="copy-btn" onclick="copy('r-widget')">Copier le code</button>
    </div>
    <a class="test-btn" id="r-link" href="#" target="_blank">💬 Tester mon bot →</a>
  </div>
</div>

<script>
var selNicheVal = 'restaurant';
var selColorVal = '#00c875';

function selNiche(el) {
  document.querySelectorAll('.niche').forEach(n => n.classList.remove('sel'));
  el.classList.add('sel');
  selNicheVal = el.dataset.val;
}

function selColor(el) {
  document.querySelectorAll('.color-opt').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  selColorVal = el.dataset.val;
}

function copy(id) {
  var text = document.getElementById(id).textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('Copié!');
  });
}

async function createBot() {
  var nom = document.getElementById('nom').value.trim();
  if (!nom) { alert('Entrez le nom de votre business'); return; }

  var btn = document.querySelector('.submit-btn');
  btn.textContent = '⏳ Création en cours...';
  btn.disabled = true;

  try {
    var res = await fetch('/bot/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: nom,
        niche: selNicheVal,
        adresse: document.getElementById('adresse').value,
        horaires: document.getElementById('horaires').value,
        services: document.getElementById('services').value,
        couleur: selColorVal,
        email: document.getElementById('email').value
      })
    });

    var data = await res.json();

    if (data.success) {
      document.getElementById('r-chat').textContent = data.chatUrl;
      document.getElementById('r-widget').textContent = data.widgetCode;
      document.getElementById('r-link').href = data.chatUrl;
      document.getElementById('result').classList.add('show');
      document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
    } else {
      alert('Erreur: ' + (data.error || 'Réessayez'));
    }
  } catch(e) {
    alert('Erreur réseau. Réessayez.');
  }

  btn.textContent = '🚀 Créer mon bot maintenant';
  btn.disabled = false;
}
</script>
</body>
</html>`);
});

// ============================================
// WEBHOOK META (conservé)
// ============================================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === CONFIG.META_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object === 'instagram' || body.object === 'page') {
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];
      if (messaging?.message?.text) {
        const senderId = messaging.sender.id;
        const message = messaging.message.text;
        console.log(`📩 Instagram de ${senderId}: ${message}`);
        const bot = BOTS_DB['restaurant-teranga'];
        const reply = await callOpenAI(bot.prompt, senderId, message);
        console.log(`✅ Réponse: ${reply}`);
        // Envoyer la réponse...
      }
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
  }
});

// ============================================
// ROUTES UTILES
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: '🚀 BotSen API active',
    version: '2.0',
    bots: Object.keys(BOTS_DB).length,
    endpoints: {
      chat: 'POST /chat',
      widget: 'GET /widget.js',
      setup: 'GET /setup',
      chatPage: 'GET /chat/:botId',
      createBot: 'POST /bot/create',
      botInfo: 'GET /bot/:id'
    }
  });
});

app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Politique de confidentialité — BotSen</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333}h1{color:#00c875}</style></head><body><h1>Politique de confidentialité — BotSen</h1><p>BotSen collecte uniquement les messages nécessaires au fonctionnement du chatbot. Les données ne sont pas partagées avec des tiers sauf OpenAI. Contact: gakououssou@gmail.com</p></body></html>`);
});

// ============================================
// DÉMARRAGE
// ============================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 BotSen v2.0 démarré sur port ${PORT}`);
  console.log(`📡 Setup: https://botsen-server-production.up.railway.app/setup`);
  console.log(`💬 Widget: https://botsen-server-production.up.railway.app/widget.js`);
  console.log(`🤖 Bots: ${Object.keys(BOTS_DB).length}`);
});
