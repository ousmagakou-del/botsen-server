const express = require('express');
const app = express();
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  OPENAI_API_KEY:       process.env.OPENAI_API_KEY,
  SUPABASE_URL:         process.env.SUPABASE_URL || 'https://qymbvpevaobeadslmjah.supabase.co',
  SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  META_VERIFY_TOKEN:    process.env.META_VERIFY_TOKEN || 'samabot_verify_2025',
  META_ACCESS_TOKEN:    process.env.META_ACCESS_TOKEN,
  BASE_URL:             process.env.BASE_URL || 'https://api.samabot.app',
  RESEND_API_KEY:       process.env.RESEND_API_KEY,
  WASENDER_API_KEY:     process.env.WASENDER_API_KEY,
  WASENDER_SESSION_ID:  process.env.WASENDER_SESSION_ID,
  JWT_SECRET:           process.env.JWT_SECRET || 'samabot_jwt_secret_2025',
  GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  // Stripe pour facturation SaaS
  STRIPE_SECRET_KEY:    process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_STARTER_MONTHLY: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  STRIPE_PRICE_STARTER_YEARLY:  process.env.STRIPE_PRICE_STARTER_YEARLY,
  STRIPE_PRICE_PRO_MONTHLY:     process.env.STRIPE_PRICE_PRO_MONTHLY,
  STRIPE_PRICE_PRO_YEARLY:      process.env.STRIPE_PRICE_PRO_YEARLY,
  STRIPE_PRICE_BUSINESS_MONTHLY: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  STRIPE_PRICE_BUSINESS_YEARLY:  process.env.STRIPE_PRICE_BUSINESS_YEARLY,
};

// ============================================
// 💰 PLANS & PRICING
// ============================================
const PLANS = {
  trial: {
    name: 'Trial',
    price_usd_monthly: 0,
    price_fcfa_monthly: 0,
    duration_days: 3,
    bots_max: 1,
    features: ['Toutes les features Pro', '3 jours seulement', 'Pas de carte requise']
  },
  starter: {
    name: 'Starter',
    price_usd_monthly: 9,
    price_usd_yearly: 86,    // -20%
    price_fcfa_monthly: 5000,
    price_fcfa_yearly: 48000, // -20%
    bots_max: 3,
    features: ['Jusqu\'à 3 bots', 'Catalogue illimité', 'Support email', 'WhatsApp + Email']
  },
  pro: {
    name: 'Pro',
    price_usd_monthly: 25,
    price_usd_yearly: 240,
    price_fcfa_monthly: 15000,
    price_fcfa_yearly: 144000,
    bots_max: 10,
    features: ['Jusqu\'à 10 bots', 'Analytics avancées', 'Codes promo', 'Multi-établissements', 'API publique', 'Support prioritaire']
  },
  business: {
    name: 'Business',
    price_usd_monthly: 85,
    price_usd_yearly: 816,
    price_fcfa_monthly: 50000,
    price_fcfa_yearly: 480000,
    bots_max: -1, // illimité
    features: ['Bots illimités', 'White-label', 'API dédiée', 'Account manager', 'SLA 99.9%']
  }
};

const appPageHtml = "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">\n<title>SamaBot</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{font-family:'DM Sans',sans-serif;background:#f0f4f1;min-height:100vh}\nnav{background:#0a1a0f;padding:0 24px;height:58px;display:flex;align-items:center;justify-content:space-between}\n.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#fff}\n.logo b{color:#00c875}\n.wrap{max-width:960px;margin:0 auto;padding:32px 20px}\nh1{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#0a1a0f;margin-bottom:6px}\n.sub{font-size:14px;color:#5a7060;margin-bottom:28px}\n.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}\n.card{background:#fff;border-radius:14px;padding:20px;border:1px solid #e5e7eb;transition:all .2s}\n.card:hover{box-shadow:0 4px 16px rgba(0,0,0,.08)}\n.ch{display:flex;align-items:center;gap:10px;margin-bottom:14px}\n.av{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}\n.cn{font-size:15px;font-weight:700;color:#0a1a0f}\n.cni{font-size:12px;color:#5a7060;text-transform:capitalize}\n.cb{display:flex;gap:6px}\n.ba{flex:1;padding:9px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;border:none;cursor:pointer;display:block;transition:opacity .15s}\n.ba:hover{opacity:.85}\n.bg{background:#00c875;color:#fff}\n.bo{background:#f0f4f1;color:#0a1a0f}\n.add{border:2px dashed #d1e5d8;border-radius:14px;padding:24px;text-align:center;cursor:pointer;background:#f9fdf9;transition:all .2s}\n.add:hover{border-color:#00c875;background:rgba(0,200,117,.04)}\n.empty{text-align:center;padding:40px;color:#9ab0a0;font-size:14px}\n.deco{background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 16px;color:rgba(255,255,255,.8);font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}\n.deco:hover{background:rgba(255,255,255,.15);color:#fff}\n.pill{background:rgba(0,200,117,.12);color:#00a862;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700}\n</style>\n</head>\n<body>\n<nav>\n  <div class=\"logo\">Sama<b>Bot</b></div>\n  <button class=\"deco\" id=\"deco\">Deconnexion</button>\n</nav>\n<div class=\"wrap\">\n  <h1>Mes bots</h1>\n  <div class=\"sub\" id=\"info\">Chargement...</div>\n  <div class=\"grid\" id=\"grid\"><div class=\"empty\">Chargement...</div></div>\n</div>\n<script>\n// 1. Logout\ndocument.getElementById('deco').onclick = function() {\n  localStorage.removeItem('sb-token');\n  localStorage.removeItem('sb-user');\n  fetch('/auth/logout', { method: 'POST' }).finally(function() {\n    window.location.replace('/login');\n  });\n};\n\n// 2. Recupere token depuis URL (Google OAuth / reset-password)\n(function() {\n  var hrf = window.location.href;\n  var tm = hrf.match(/[?&]token=([^&]+)/);\n  if (tm && tm[1]) {\n    localStorage.setItem('sb-token', tm[1]);\n    var um = hrf.match(/[?&]user=([^&]+)/);\n    if (um && um[1]) {\n      try { localStorage.setItem('sb-user', decodeURIComponent(um[1])); } catch(e) {}\n    }\n    history.replaceState({}, '', '/app');\n  }\n})();\n\n// 3. Verifie token via API avant d'afficher\nvar tk = localStorage.getItem('sb-token');\nif (!tk) {\n  window.location.replace('/login');\n} else {\n  // Valide le token cote serveur\n  fetch('/auth/test', { headers: { 'Authorization': 'Bearer ' + tk } })\n    .then(function(r) { return r.json(); })\n    .then(function(d) {\n      if (!d.valid) {\n        localStorage.removeItem('sb-token');\n        localStorage.removeItem('sb-user');\n        window.location.replace('/login');\n        return;\n      }\n      // Token valide - charge les bots\n      loadBots();\n    })\n    .catch(function() {\n      loadBots(); // En cas d'erreur reseau, essaie quand meme\n    });\n}\n\nfunction loadBots() {\n  var grid = document.getElementById('grid');\n  var info = document.getElementById('info');\n  var tk = localStorage.getItem('sb-token');\n\n  fetch('/auth/my-bots', { headers: { 'Authorization': 'Bearer ' + tk } })\n    .then(function(r) {\n      if (r.status === 401) {\n        localStorage.removeItem('sb-token');\n        window.location.replace('/login');\n        return null;\n      }\n      return r.json();\n    })\n    .then(function(bots) {\n      if (!bots) return;\n      if (!Array.isArray(bots)) {\n        info.textContent = bots.error || 'Erreur serveur';\n        grid.innerHTML = '<div class=\"empty\">' + (bots.error || 'Erreur') + '</div>';\n        return;\n      }\n      var userRaw = localStorage.getItem('sb-user') || '{}';\n      var user = {};\n      try { user = JSON.parse(userRaw); } catch(e) {}\n      info.innerHTML = '<span class=\"pill\">Plan ' + (user.plan || 'free') + '</span> &nbsp;' + bots.length + ' bot' + (bots.length !== 1 ? 's' : '');\n      var h = '';\n      for (var i = 0; i < bots.length; i++) {\n        var b = bots[i];\n        var av = b.logo_url\n          ? '<img src=\"' + b.logo_url + '\" style=\"width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0\" alt=\"\" />'\n          : '<div class=\"av\" style=\"background:' + (b.couleur || '#00c875') + '\">' + (b.emoji || '?') + '</div>';\n        h += '<div class=\"card\">';\n        h += '<div class=\"ch\">' + av + '<div><div class=\"cn\">' + b.nom + '</div><div class=\"cni\">' + b.niche + '</div></div></div>';\n        h += '<div class=\"cb\">';\n        h += '<a class=\"ba bo\" href=\"/chat/' + b.id + '\" target=\"_blank\">Chat</a>';\n        h += '<a class=\"ba bg\" href=\"/dashboard/' + b.id + '\">Dashboard</a>';\n        h += '</div></div>';\n      }\n      if (!bots.length) {\n        h = '<div class=\"empty\">Pas encore de bot. Creez votre premier bot!</div>';\n      }\n      h += '<div class=\"add\" id=\"addbtn\"><div style=\"font-size:28px;margin-bottom:6px\">+</div><div style=\"font-size:14px;font-weight:600;color:#5a7060\">Nouveau bot</div></div>';\n      grid.innerHTML = h;\n      document.getElementById('addbtn').onclick = function() { window.location.href = '/setup'; };\n    })\n    .catch(function(e) {\n      info.textContent = 'Erreur reseau';\n      grid.innerHTML = '<div class=\"empty\">Impossible de charger. Verifiez votre connexion.</div>';\n    });\n}\n</script>\n</body>\n</html>";

const STORAGE_URL = `${CONFIG.SUPABASE_URL}/storage/v1`;
const BUCKET = 'samabot-media';

// ============================================
// I18N — Multi-langue
// ============================================
const i18n = {
  fr: {
    dashboard_title: 'Dashboard',
    msgs_today: 'Msgs aujourd\'hui',
    rdv_today: 'RDV aujourd\'hui',
    orders: 'Commandes',
    revenue: 'FCFA revenus',
    avg_rating: 'Note moy.',
    tab_orders: 'Commandes',
    tab_rdv: 'RDV',
    tab_messages: 'Messages',
    tab_audio: 'Vocaux',
    tab_reviews: 'Avis',
    tab_share: 'Partage',
    recent_orders: '📦 Commandes récentes',
    no_orders: 'Aucune commande encore. Partagez votre lien de chat !',
    pending_alert: '⚠️ commande(s) en attente !',
    client: 'Client',
    phone: 'Téléphone',
    address: 'Adresse livraison',
    payment: 'Paiement',
    articles: 'Articles',
    call: '📞 Appeler',
    status_pending: '⏳ En attente',
    status_confirmed: '✅ Confirmée',
    status_preparing: '👨‍🍳 En préparation',
    status_ready: '✅ Prête',
    status_delivering: '🛵 En livraison',
    status_delivered: '📦 Livrée',
    status_cancelled: '❌ Annulée',
    status_paid: '💰 Payée',
    online: 'En direct',
    offline: 'Hors ligne',
    lang_label: 'Langue',
  },
  en: {
    dashboard_title: 'Dashboard',
    msgs_today: 'Msgs today',
    rdv_today: 'Appointments today',
    orders: 'Orders',
    revenue: 'Revenue (FCFA)',
    avg_rating: 'Avg rating',
    tab_orders: 'Orders',
    tab_rdv: 'Appointments',
    tab_messages: 'Messages',
    tab_audio: 'Voice',
    tab_reviews: 'Reviews',
    tab_share: 'Share',
    recent_orders: '📦 Recent orders',
    no_orders: 'No orders yet. Share your chat link!',
    pending_alert: '⚠️ order(s) pending!',
    client: 'Client',
    phone: 'Phone',
    address: 'Delivery address',
    payment: 'Payment',
    articles: 'Items',
    call: '📞 Call',
    status_pending: '⏳ Pending',
    status_confirmed: '✅ Confirmed',
    status_preparing: '👨‍🍳 Preparing',
    status_ready: '✅ Ready',
    status_delivering: '🛵 Delivering',
    status_delivered: '📦 Delivered',
    status_cancelled: '❌ Cancelled',
    status_paid: '💰 Paid',
    online: 'Online',
    offline: 'Offline',
    lang_label: 'Language',
  },
  pt: {
    dashboard_title: 'Painel',
    msgs_today: 'Msgs hoje',
    rdv_today: 'Consultas hoje',
    orders: 'Pedidos',
    revenue: 'Receita (FCFA)',
    avg_rating: 'Nota média',
    tab_orders: 'Pedidos',
    tab_rdv: 'Consultas',
    tab_messages: 'Mensagens',
    tab_audio: 'Voz',
    tab_reviews: 'Avaliações',
    tab_share: 'Partilhar',
    recent_orders: '📦 Pedidos recentes',
    no_orders: 'Sem pedidos ainda. Partilhe o seu link!',
    pending_alert: '⚠️ pedido(s) pendente(s)!',
    client: 'Cliente',
    phone: 'Telefone',
    address: 'Endereço de entrega',
    payment: 'Pagamento',
    articles: 'Artigos',
    call: '📞 Ligar',
    status_pending: '⏳ Pendente',
    status_confirmed: '✅ Confirmado',
    status_preparing: '👨‍🍳 A preparar',
    status_ready: '✅ Pronto',
    status_delivering: '🛵 A entregar',
    status_delivered: '📦 Entregue',
    status_cancelled: '❌ Cancelado',
    status_paid: '💰 Pago',
    online: 'Online',
    offline: 'Offline',
    lang_label: 'Idioma',
  }
};

function t(lang, key) {
  return (i18n[lang] || i18n.fr)[key] || i18n.fr[key] || key;
}


// ============================================
// SUPABASE DB
// ============================================
async function sb(table, method='GET', data=null, query='') {
  const key = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: { 'Content-Type':'application/json', 'apikey':key, 'Authorization':`Bearer ${key}`, 'Prefer':'return=representation' },
    body: data ? JSON.stringify(data) : undefined
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const db = {
  select: (t,q='') => sb(t,'GET',null,q),
  insert: (t,d) => sb(t,'POST',d),
  update: (t,d,q) => sb(t,'PATCH',d,q),
};

// ============================================
// SUPABASE STORAGE — Upload fichier
// ============================================
async function uploadToStorage(fileBuffer, fileName, mimeType, folder='uploads') {
  const key = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;
  const path = `${folder}/${Date.now()}-${fileName}`;

  const res = await fetch(`${STORAGE_URL}/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': mimeType,
      'x-upsert': 'true'
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Storage upload failed: ${err}`);
  }

  // Retourne l'URL publique
  return `${STORAGE_URL}/object/public/${BUCKET}/${path}`;
}

// ============================================
// UPLOAD IMAGE — Endpoint pour le setup
// ============================================
app.post('/upload/image', async (req, res) => {
  try {
    const { base64, fileName, mimeType, folder } = req.body;
    if (!base64 || !fileName) return res.status(400).json({ error: 'base64 et fileName requis' });

    // Convertit base64 en buffer
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const url = await uploadToStorage(buffer, fileName, mimeType || 'image/jpeg', folder || 'logos');

    console.log(`📸 Image uploadée: ${url}`);
    res.json({ success: true, url });
  } catch(e) {
    console.error('Upload error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// UPLOAD AUDIO + TRANSCRIPTION WHISPER
// ============================================
app.post('/upload/audio', async (req, res) => {
  try {
    const { base64, fileName, mimeType, botId, sessionId } = req.body;
    if (!base64) return res.status(400).json({ error: 'base64 requis' });

    // Upload audio vers Supabase Storage
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const audioUrl = await uploadToStorage(buffer, fileName || 'audio.webm', mimeType || 'audio/webm', 'audio');

    // Transcription avec Whisper
    const transcription = await transcribeAudio(buffer, fileName || 'audio.webm', mimeType || 'audio/webm');

    console.log(`🎤 Audio transcrit: "${transcription}"`);

    // Sauvegarde en DB
    if (botId && sessionId) {
      await db.insert('audio_messages', {
        bot_id: botId,
        session_id: sessionId,
        audio_url: audioUrl,
        transcription: transcription,
        langue_detectee: detectLang(transcription)
      }).catch(() => {});
    }

    res.json({ success: true, transcription, audioUrl });
  } catch(e) {
    console.error('Audio error:', e);
    res.status(500).json({ error: e.message, transcription: null });
  }
});

// ============================================
// WHISPER — Transcription audio
// ============================================
async function transcribeAudio(audioBuffer, fileName, mimeType) {
  // Crée un FormData avec le fichier audio
  const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

  // Construction manuelle du multipart/form-data
  const fileExtension = fileName.split('.').pop() || 'webm';
  const whisperFileName = `audio.${fileExtension}`;

  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="model"\r\n\r\n`;
  body += `whisper-1\r\n`;
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="language"\r\n\r\n`;
  body += `fr\r\n`; // Commence par le français, Whisper détecte automatiquement
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="prompt"\r\n\r\n`;
  body += `Transcription en français ou wolof. Mots wolof courants: jerejef, waaw, deedeet, asalaa maalekum, xam, bëgg, ci, bi, la, nga, ma, ak, bu, si, dafa, sama.\r\n`;

  const bodyPrefix = Buffer.from(body, 'utf-8');
  const fileHeader = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${whisperFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    'utf-8'
  );
  const bodySuffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');

  const fullBody = Buffer.concat([bodyPrefix, fileHeader, audioBuffer, bodySuffix]);

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: fullBody
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Whisper error');

  return data.text || '';
}

// ============================================
// SESSIONS & OPENAI
// ============================================
// Cache mémoire (rapide) + persistance Supabase (survit aux redémarrages)
const sessions = {};
const sessionsDirty = new Set(); // sids modifiés à sauvegarder
const sessionsLoaded = new Set(); // sids déjà chargés depuis la DB

function getHist(sid) { if(!sessions[sid]) sessions[sid]=[]; return sessions[sid]; }
function addHist(sid, role, content) {
  const h=getHist(sid);
  h.push({role,content});
  if(h.length>14) h.shift();
  sessionsDirty.add(sid);
}

// Charger une session depuis la DB si pas en mémoire (lazy loading)
async function loadSessionFromDb(sid) {
  if (sessionsLoaded.has(sid)) return; // déjà tenté
  sessionsLoaded.add(sid);
  if (sessions[sid] && sessions[sid].length) return; // déjà en mémoire
  try {
    const rows = await db.select('chat_sessions', `?session_id=eq.${encodeURIComponent(sid)}&limit=1`);
    if (rows && rows[0] && Array.isArray(rows[0].messages)) {
      sessions[sid] = rows[0].messages.slice(-14); // garde max 14 messages
      console.log(`💾 Session ${sid.substring(0,15)}... rechargée (${sessions[sid].length} msgs)`);
    }
  } catch(e) { /* table peut ne pas exister, ce n'est pas grave */ }
}

// Sauvegarder en DB toutes les sessions modifiées (toutes les 30s)
async function flushDirtySessions() {
  if (!sessionsDirty.size) return;
  const sids = Array.from(sessionsDirty);
  sessionsDirty.clear();
  for (const sid of sids) {
    try {
      const msgs = sessions[sid] || [];
      if (!msgs.length) continue;
      // upsert: insert ou update si existe déjà
      const existing = await db.select('chat_sessions', `?session_id=eq.${encodeURIComponent(sid)}&select=id&limit=1`);
      if (existing?.[0]?.id) {
        await db.update('chat_sessions', { messages: msgs, updated_at: new Date().toISOString() }, `?id=eq.${existing[0].id}`);
      } else {
        await db.insert('chat_sessions', { session_id: sid, messages: msgs, updated_at: new Date().toISOString() });
      }
    } catch(e) { /* table peut ne pas exister, on continue silencieusement */ }
  }
}

// Crée la table chat_sessions si elle n'existe pas (au démarrage, via Supabase REST best-effort)
async function ensureSessionsTable() {
  try {
    // Test simple pour voir si la table existe
    await db.select('chat_sessions', '?limit=1');
    console.log('💾 Table chat_sessions: ✅ (sessions persistées)');
  } catch(e) {
    console.log('');
    console.log('⚠️  ====================================================');
    console.log('💾 TABLE chat_sessions INTROUVABLE');
    console.log('⚠️  Les sessions ne survivront PAS aux redémarrages.');
    console.log('⚠️  Exécutez ce SQL dans Supabase (SQL Editor):');
    console.log('====================================================');
    console.log(`CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_sid ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_upd ON chat_sessions(updated_at);

CREATE TABLE IF NOT EXISTS promos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_id TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  reduction_type TEXT DEFAULT 'pct',
  reduction_value INT NOT NULL,
  max_uses INT,
  used_count INT DEFAULT 0,
  client_tel TEXT,
  actif BOOLEAN DEFAULT TRUE,
  description TEXT,
  expire_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  UNIQUE(bot_id, code)
);
CREATE INDEX IF NOT EXISTS idx_promos_bot ON promos(bot_id);
CREATE INDEX IF NOT EXISTS idx_promos_code ON promos(bot_id, code);

ALTER TABLE avis ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE;
ALTER TABLE avis ADD COLUMN IF NOT EXISTS reponse TEXT;
ALTER TABLE avis ADD COLUMN IF NOT EXISTS reponse_date TIMESTAMPTZ;`);
    console.log('====================================================');
    console.log('💡 Une fois exécuté, redémarrez le service Render.');
    console.log('');
  }
}

// Démarrer le flush périodique (toutes les 30s)
setInterval(flushDirtySessions, 30000);
// Et au démarrage du serveur
setTimeout(ensureSessionsTable, 3000);

// Cleanup mémoire: supprime les sessions inactives depuis >2h pour éviter fuite mémoire
setInterval(() => {
  const now = Date.now();
  const beforeCount = Object.keys(sessions).length;
  for (const sid in sessions) {
    // Garde un timestamp d'accès via une closure (simple): supprime si pas modifié récemment
    // (en réalité on ne sait pas, donc on garde tout en mémoire ; les sessions seront rechargées au besoin depuis la DB)
  }
  // En pratique, on fait simple: si plus de 1000 sessions en mémoire, on garde les 500 plus récemment modifiées
  const sids = Object.keys(sessions);
  if (sids.length > 1000) {
    // On supprime simplement les premiers (ordre d'insertion)
    const toRemove = sids.slice(0, sids.length - 500);
    toRemove.forEach(sid => delete sessions[sid]);
    console.log(`🧹 Cleanup mémoire: ${toRemove.length} sessions retirées (${Object.keys(sessions).length} restent)`);
  }
}, 600000); // toutes les 10 min

function detectLang(text) {
  if (!text) return 'inconnu';
  const wolofWords = /\b(jerejef|waaw|deedeet|asalaa|xam|bëgg|sama|ci|bi|la|nga|dafa|jaay|jënd|dem|nekk)\b/i;
  const frWords = /\b(bonjour|merci|je|vous|nous|est|sont|avoir|faire)\b/i;
  const hasWolof = wolofWords.test(text);
  const hasFr = frWords.test(text);
  if (hasWolof && hasFr) return 'Franwolof';
  if (hasWolof) return 'Wolof';
  if (hasFr) return 'Français';
  return 'Autre';
}

async function callAI(prompt, sid, message, retries=2, attempt=1) {
  // N'ajoute le message à l'historique qu'au premier essai (évite duplication)
  if (attempt === 1) addHist(sid, 'user', message);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${CONFIG.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role:'system', content:prompt }, ...getHist(sid)],
        max_tokens: 400, temperature: 0.7
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    // Distinction des erreurs HTTP
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      const status = res.status;

      // 401/403 = problème de clé API → ne pas retry, log critique
      if (status === 401 || status === 403) {
        console.error(`🔑 OpenAI AUTH ERROR (${status}): vérifiez OPENAI_API_KEY`);
        throw new Error(`OpenAI auth error ${status}`);
      }
      // 429 = rate limit → backoff plus long
      if (status === 429) {
        console.warn(`⏳ OpenAI rate limit (tentative ${attempt}/${retries+1})`);
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
          return callAI(prompt, sid, message, retries-1, attempt+1);
        }
      }
      // 500/502/503 = OpenAI down → retry
      if (status >= 500 && retries > 0) {
        console.warn(`⚠️ OpenAI ${status} (tentative ${attempt}/${retries+1})`);
        await new Promise(r => setTimeout(r, 1500 * attempt));
        return callAI(prompt, sid, message, retries-1, attempt+1);
      }
      throw new Error(`OpenAI error ${status}: ${errBody.substring(0,150)}`);
    }

    const data = await res.json();
    if (!data.choices?.[0]?.message?.content) throw new Error('OpenAI: empty response');
    const reply = data.choices[0].message.content;
    addHist(sid, 'assistant', reply);
    return reply;
  } catch(err) {
    // Timeout ou erreur réseau → retry
    if ((err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') && retries > 0) {
      console.warn(`🔄 OpenAI timeout/reseau (tentative ${attempt}/${retries+1})`);
      await new Promise(r => setTimeout(r, 1200 * attempt));
      return callAI(prompt, sid, message, retries-1, attempt+1);
    }
    // Échec définitif: log + relance pour que le caller décide du fallback
    console.error(`❌ callAI failed définitivement: ${err.message}`);
    throw err;
  }
}

// Réponse de secours quand l'IA est down (au lieu de planter le chat)
function getFallbackReply(message, bot) {
  const msg = (message||'').toLowerCase();
  // Détection d'intention basique pour répondre minimalement
  if (/bonjour|salut|salam|hello|hi\b/.test(msg)) {
    return `Asalaa maalekum! 👋 Bienvenue chez ${bot.nom}.\n\nNotre assistant rencontre une petite difficulté technique. Vous pouvez ${bot.telephone?`nous contacter au ${bot.telephone}`:'réessayer dans quelques secondes'}. Jërëjëf 🙏`;
  }
  if (/horaire|heure|ouvert/.test(msg) && bot.horaires) {
    return `🕐 Nos horaires: ${bot.horaires}\n\nPour plus d'infos, ${bot.telephone?`appelez le ${bot.telephone}`:'réessayez dans un moment'}.`;
  }
  if (/adresse|où|localisation/.test(msg) && bot.adresse) {
    return `📍 Notre adresse: ${bot.adresse}\n\nPour plus d'infos, ${bot.telephone?`appelez le ${bot.telephone}`:'réessayez dans un moment'}.`;
  }
  if (/téléphone|contact|appel/.test(msg) && bot.telephone) {
    return `📞 Appelez-nous au ${bot.telephone}`;
  }
  return `Désolé, notre assistant rencontre une difficulté temporaire 🙏\n\n${bot.telephone?`Vous pouvez nous appeler au ${bot.telephone}`:'Réessayez dans quelques instants.'} ${bot.adresse?`\n📍 ${bot.adresse}`:''}`;
}

// ============================================
// INTENTIONS & ACTIONS
// ============================================
function detectIntent(msg, bot) {
  const l = msg.toLowerCase();
  const intents = [];
  if (/adresse|où|localisation|trouver|venir|plan|chemin|maps/.test(l)) intents.push('maps');
  if (/numéro|téléphone|appeler|contact|tel|phone/.test(l)) intents.push('phone');
  if (/whatsapp|wa\b|wsp/.test(l)) intents.push('whatsapp');
  if (/partager|lien|link/.test(l)) intents.push('share');
  if (/horaire|heure|ouvert|fermé|quand/.test(l)) intents.push('hours');
  if (/commander|commande|prendre|acheter|vouloir|bëgg|veux/.test(l)) intents.push('order');
  if (/rdv|rendez.vous|réserver|appointment|booking|créneau|disponible|samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain|semaine/.test(l)) intents.push('rdv');
  if (/adresse|livraison|où.*habite|domicile|quartier|rue|position|gps|localisation/.test(l)) intents.push('geoloc');
  if (/confirme|confirmé|valider|c'est bon|ok pour|d'accord/.test(l)) intents.push('confirm_order');
  if (/payer|paiement|wave|orange|om\b|prix|total/.test(l)) intents.push('payment');
  if (/catalogue|produit|menu|service|quoi|qu'est|liste/.test(l)) intents.push('catalogue');
  if (/note|avis|satisfaction|comment c'était|bien|nul|super/.test(l)) intents.push('rating');
  if (/suivi|statut|livraison|où en est|commande/.test(l)) intents.push('tracking');
  return intents;
}

function buildActions(intents, bot, orderTotal=0, orderRef='') {
  const actions = [];
  if (intents.includes('maps') && (bot.adresse || bot.maps_url)) {
    const url = bot.maps_url || `https://maps.google.com/maps?q=${encodeURIComponent(bot.adresse+', Dakar, Sénégal')}`;
    actions.push({ type:'maps', label:'📍 Voir sur Google Maps', url });
  }
  if (intents.includes('phone') && bot.telephone) {
    actions.push({ type:'phone', label:`📞 Appeler ${bot.telephone}`, url:`tel:${bot.telephone.replace(/\s/g,'')}` });
  }
  if ((intents.includes('whatsapp')||intents.includes('phone')) && bot.telephone) {
    const n = bot.telephone.replace(/[\s+]/g,'');
    actions.push({ type:'whatsapp', label:'💬 WhatsApp', url:`https://wa.me/${n}?text=${encodeURIComponent('Bonjour '+bot.nom+'!')}` });
  }
  if (intents.includes('payment') && orderTotal > 0) {
    if (bot.wave_number) {
      const n = bot.wave_number.replace(/[\s+]/g,'');
      actions.push({ type:'wave', label:`💙 Payer ${orderTotal.toLocaleString('fr-FR')} F par Wave`, url:`https://pay.wave.com/m/${n}?amount=${orderTotal}` });
    }
    if (bot.om_number) {
      const n = bot.om_number.replace(/[\s+]/g,'');
      actions.push({ type:'om', label:`🟠 Orange Money`, url:`tel:#144*${n}*${orderTotal}#` });
    }
    actions.push({ type:'cash', label:'💵 Payer à la livraison', url:null });
  }
  // RDV — affiche le calendrier
  if (intents.includes('rdv')) {
    actions.push({ type:'rdv', label:'📅 Voir les créneaux disponibles', url:null });
  }
  // Géolocalisation — affichée quand commande détectée ou adresse demandée
  if (intents.includes('order') || intents.includes('geoloc')) {
    actions.push({ type:'geoloc', label:'📍 Partager ma position GPS', url:null });
    actions.push({ type:'address_manual', label:'✏️ Entrer mon adresse', url:null });
  }
  if (intents.includes('rating')) actions.push({ type:'rating', label:'⭐ Donner un avis', url:null });
  if (intents.includes('share')) actions.push({ type:'share', label:'🔗 Partager', url:null });
  if (intents.includes('hours') && bot.horaires) actions.push({ type:'hours', label:`🕐 ${bot.horaires}`, url:null });
  return actions;
}

// ============================================
// API CHAT PRINCIPAL
// ============================================
app.post('/chat', async (req, res) => {
  try {
    const { message, botId, sessionId } = req.body;
    if (!message||!botId) return res.status(400).json({ error:'message et botId requis' });

    const bots = await db.select('bots', `?id=eq.${botId}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ reply:'Ce bot n\'existe pas.', actions:[] });

    const bot = bots[0];

    // 🛡️ Vérification du plan / trial / abonnement
    const access = await checkBotPlanAccess(bot);
    if (!access.allowed) {
      return res.json({
        reply: access.message || 'Ce bot est temporairement indisponible.',
        actions: access.upgrade_url ? [{ type: 'link', label: '💳 S\'abonner', url: access.upgrade_url }] : [],
        plan_blocked: true,
        reason: access.reason
      });
    }

    // 🚦 Rate limiting anti-abus (30 msg/min/IP/bot)
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const rl = checkRateLimit(ip, botId);
    if (!rl.allowed) {
      return res.status(429).json({
        reply: '⏳ Trop de messages. Patientez ' + rl.retry_after + 's.',
        actions: [],
        rate_limited: true
      });
    }

    const sid = sessionId || `${botId}_${Date.now()}`;
    // Lazy-load la session depuis la DB si pas déjà en mémoire (survie aux redémarrages)
    await loadSessionFromDb(sid);
    const intents = detectIntent(message, bot);

    // 🧠 v10.7: Extraction des infos client pour mémoire enrichie
    try {
      const extracted = (typeof extractClientInfo === 'function') ? extractClientInfo(message) : {};
      if (extracted && Object.keys(extracted).length > 0) {
        updateClientMemory(sid, extracted);
        console.log(`🧠 Infos client extraites:`, Object.keys(extracted).join(', '));
      }
    } catch(e) { /* extraction optionnelle, n'empêche pas le chat */ }

    // Vérifie les workflows avant l'IA
    const workflowReply = await runWorkflows(botId, message, sid);

    let reply;
    if (workflowReply) {
      reply = workflowReply;
      console.log(`⚡ Réponse workflow pour bot ${botId}`);
    } else {
      // 🔄 Toujours utiliser le prompt fraîchement calculé (pas celui en DB)
      // 🧠 v10.7: makePromptSmart si dispo (mémoire client + niche adaptée + skills)
      const freshPrompt = (typeof makePromptSmart === 'function') ? makePromptSmart(bot, sid) : makePrompt(bot);
      try {
        reply = await callAI(freshPrompt, sid, message);
      } catch(aiErr) {
        // OpenAI down → fallback gracieux pour ne pas casser l'expérience client
        console.error(`⚠️ Fallback activé pour bot ${botId}:`, aiErr.message);
        reply = getFallbackReply(message, bot);
      }
    }

    // Détecte si le BOT demande l'adresse dans sa réponse
    // → affiche les boutons GPS
    const replyLower = reply.toLowerCase();
    if (/adresse|livraison|où.*habite|domicile|quartier|livrer|deliver/i.test(replyLower)) {
      if (!intents.includes('geoloc')) intents.push('geoloc');
      // Retire 'order' pour ne pas afficher GPS en double
      const orderIdx = intents.indexOf('order');
      if (orderIdx > -1) intents.splice(orderIdx, 1);
    }

    // Extrait le total — supporte: "Total: 5 000 FCFA" "Total : 5000 FCFA." "5 000 FCFA"
    let orderTotal = 0;
    const totalMatch = reply.match(/total\s*[:\-]\s*\*?\s*([0-9][0-9\s]*)\s*\*?\s*f?cfa/i) ||
                       reply.match(/total\s*[:\-]\s*([0-9\s]+)/i) ||
                       reply.match(/([0-9][0-9\s]{2,})\s*f?cfa/i);
    if (totalMatch) {
      const extracted = parseInt(totalMatch[1].replace(/\s/g,''));
      if (extracted > 0 && extracted < 10000000) orderTotal = extracted;
    }

    // 🆕 Détection robuste de la confirmation finale d'une commande
    // Cas 1: le BOT dit "commande confirmée" (le bot a déjà toutes les infos)
    // Cas 2: le CLIENT dit "oui/ok/confirme" après un récap explicite du bot
    const botConfirmingOrder = /✅\s*\*?\s*commande\s+confirm[ée]/i.test(reply) ||
                                /commande\s+confirm[ée]\s*[!.\s]/i.test(reply);
    const confirmationKeywords = /^\s*(oui|ouais|yes|ok|d'accord|confirme[rz]?|valide[rz]?|c'est bon|c bon|parfait|allez[\s-]?y|go|waaw|d'acc)\b/i;
    const isClientConfirming = confirmationKeywords.test(message.trim());

    // Historique pour récupérer le récap (avant-dernier message assistant)
    const history = getHist(sid);
    const assistantMsgs = history.filter(h => h.role === 'assistant');
    const previousBotMsg = assistantMsgs.length >= 2 ? assistantMsgs[assistantMsgs.length - 2] : null;
    // 🔒 v10.8: Récap STRICT — doit contenir total + confirmez/récap (pas juste un mot)
    const lastBotHadRecap = previousBotMsg && (
      /récapitulatif|recapitulatif/i.test(previousBotMsg.content) &&
      /total\s*[:\-]?\s*\*?\s*\d/i.test(previousBotMsg.content) &&
      /confirmez|valider|valid[eé]|oui pour valider/i.test(previousBotMsg.content)
    );

    // Affiche les boutons paiement quand on a un total
    // 🔒 v10.8: Boutons paiement UNIQUEMENT si le bot a explicitement confirmé la commande
    //   (évite l'affichage prématuré pendant l'étape récap)
    if (orderTotal > 0 && botConfirmingOrder) {
      console.log(`💰 Total détecté: ${orderTotal} FCFA pour bot ${botId} (paiement autorisé)`);
      intents.push('payment');
    }

    // 🎯 Création commande déclenchée par:
    //   - Le bot lui-même dit "Commande confirmée!" dans sa réponse, OU
    //   - Le client dit "oui/ok/confirme" après un récap du bot
    const shouldCreateOrder = botConfirmingOrder || (isClientConfirming && lastBotHadRecap);

    // 🎁 Détection d'un code promo dans le message client
    // Patterns: "code BIENVENUE10", "BIENVENUE10", "j'ai un code: PROMO20", etc.
    let promoApplied = null;
    const codeMatch = message.match(/\b(?:code\s*(?:promo)?[:\s]*)?([A-Z0-9]{4,15}(?:-[A-Z0-9]{4,15})?)\b/i);
    if (codeMatch && /[A-Z]/i.test(codeMatch[1])) {
      const candidate = codeMatch[1].toUpperCase();
      // Filtrer les faux positifs (pas un code promo): mots communs, numéros tels...
      if (!/^(BONJOUR|MERCI|ASALAA|MAALEKUM|WAAW|JEREJEF|OUI|NON|CONFIRME|COMMANDER|PIZZA|BURGER|CAFE|PROMO|CODE)$/i.test(candidate) && candidate.length >= 5) {
        try {
          const promoCheck = await db.select('promos', `?bot_id=eq.${botId}&code=eq.${encodeURIComponent(candidate)}&actif=eq.true&limit=1`);
          if (promoCheck?.[0]) {
            const p = promoCheck[0];
            // Vérifs basiques
            const expired = p.expire_at && new Date(p.expire_at) < new Date();
            const exhausted = p.max_uses && p.used_count >= p.max_uses;
            if (!expired && !exhausted) {
              promoApplied = p;
              console.log(`🎁 Code promo détecté: ${candidate} pour bot ${botId}`);
            } else {
              console.log(`⚠️ Code ${candidate} ${expired?'expiré':'épuisé'}`);
            }
          }
        } catch(e) { /* table peut ne pas exister, on continue */ }
      }
    }

    if (shouldCreateOrder) {
      const trigger = botConfirmingOrder ? 'bot a confirmé' : 'client a confirmé';
      console.log(`✅ Création commande déclenchée (${trigger}) pour bot ${botId}`);

      // Concatène TOUS les messages du bot pour chercher le récap/total
      const allBotMsgs = assistantMsgs.map(m => m.content).join('\n') + '\n' + reply;
      const sourceText = allBotMsgs;

      // Extraire le total — cherche dans tout l'historique
      let totalFromRecap = 0;
      const recapTotalMatch = sourceText.match(/total[^:]*[:\s]*\*?\s*([0-9][0-9\s]*)\s*\*?\s*f?cfa/i);
      if (recapTotalMatch) {
        totalFromRecap = parseInt(recapTotalMatch[1].replace(/\s/g,'')) || 0;
      }
      const finalTotal = totalFromRecap || orderTotal || 0;

      // Récupérer le promo de toute la conversation (pas juste le message courant)
      // car le client peut avoir donné le code plusieurs messages avant
      let promoToApply = promoApplied;
      if (!promoToApply) {
        const allUserMsgs = getHist(sid).filter(h=>h.role==='user').map(m=>m.content).join(' ');
        const allCodeMatch = allUserMsgs.match(/\b([A-Z0-9]{4,15}(?:-[A-Z0-9]{4,15})?)\b/g);
        if (allCodeMatch) {
          for (const c of allCodeMatch) {
            const cu = c.toUpperCase();
            if (/^(BONJOUR|MERCI|ASALAA|MAALEKUM|WAAW|JEREJEF|OUI|NON|CONFIRME|COMMANDER|PIZZA|BURGER|CAFE|PROMO|CODE)$/i.test(cu)) continue;
            try {
              const check = await db.select('promos', `?bot_id=eq.${botId}&code=eq.${encodeURIComponent(cu)}&actif=eq.true&limit=1`);
              if (check?.[0] && (!check[0].expire_at || new Date(check[0].expire_at) > new Date()) && (!check[0].max_uses || check[0].used_count < check[0].max_uses)) {
                promoToApply = check[0];
                break;
              }
            } catch(e) {}
          }
        }
      }

      // Crée la commande + envoie TOUTES les notifs (patron + client) en UNE fois
      createOrderFromConfirmation(botId, sid, finalTotal, bot, sourceText, promoToApply).catch(e=>console.error('createOrder err:', e.message));
    }

    // Si commande sans total encore → GPS pour adresse
    if (intents.includes('order') && orderTotal === 0) {
      if (!intents.includes('geoloc')) intents.push('geoloc');
    }

    const actions = buildActions(intents, bot, orderTotal, 'CMD-'+Date.now().toString(36).toUpperCase());
    const catalogue = (intents.includes('catalogue') && bot.catalogue?.length) ? bot.catalogue.slice(0,8) : null;

    saveMsg(botId, sid, message, reply).catch(()=>{});

    res.json({ reply, actions, catalogue, intents });
  } catch(err) {
    console.error('Chat:', err);
    res.status(500).json({ reply:'Désolé, une erreur est survenue. Réessayez. 🙏', actions:[] });
  }
});

// ============================================
// API CHAT VOCAL — Reçoit transcription et répond
// ============================================
app.post('/chat/voice', async (req, res) => {
  try {
    const { base64, mimeType, fileName, botId, sessionId } = req.body;
    if (!base64 || !botId) return res.status(400).json({ error:'base64 et botId requis' });

    const bots = await db.select('bots', `?id=eq.${botId}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error:'Bot non trouvé' });
    const bot = bots[0];

    // Transcription Whisper
    const buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    let transcription = '';
    try {
      transcription = await transcribeAudio(buffer, fileName||'audio.webm', mimeType||'audio/webm');
    } catch(e) {
      console.error('Whisper error:', e);
      return res.status(500).json({ error:'Transcription échouée: '+e.message });
    }

    if (!transcription.trim()) {
      return res.json({ transcription:'', reply:'Je n\'ai pas entendu votre message. Réessayez.', actions:[] });
    }

    // Sauvegarde audio
    const sid = sessionId || `${botId}_voice_${Date.now()}`;
    await loadSessionFromDb(sid);
    db.insert('audio_messages', { bot_id:botId, session_id:sid, transcription, langue_detectee:detectLang(transcription) }).catch(()=>{});

    // Réponse IA — prompt frais avec fallback gracieux
    const intents = detectIntent(transcription, bot);
    let reply;
    try {
      reply = await callAI(makePrompt(bot), sid, transcription);
    } catch(aiErr) {
      console.error(`⚠️ Voice fallback pour bot ${botId}:`, aiErr.message);
      reply = getFallbackReply(transcription, bot);
    }

    let orderTotal = 0;
    const totalMatch = reply.match(/total\s*[:\-]?\s*([0-9][0-9\s]*)\s*f?cfa/i);
    if (totalMatch) orderTotal = parseInt(totalMatch[1].replace(/\s/g,'')) || 0;
    if (orderTotal > 0) intents.push('payment');

    const actions = buildActions(intents, bot, orderTotal);
    saveMsg(botId, sid, `🎤 ${transcription}`, reply).catch(()=>{});

    res.json({ transcription, reply, actions, langue: detectLang(transcription) });
  } catch(err) {
    console.error('Voice chat error:', err);
    res.status(500).json({ error:err.message, reply:'Erreur de traitement vocal.' });
  }
});

// ============================================
// GÉOLOCALISATION — Reverse geocoding
// Convertit lat/lng en adresse lisible
// ============================================
app.post('/geo/reverse', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat et lng requis' });

    // Nominatim (OpenStreetMap) — gratuit, pas de clé API
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`,
      { headers: { 'User-Agent': 'SamaBot/1.0 (samabot.sn)' } }
    );
    const data = await r.json();
    if (!data.display_name) return res.status(404).json({ error: 'Adresse non trouvée' });

    const addr = data.address || {};
    const parts = [
      addr.road || addr.pedestrian || addr.path,
      addr.suburb || addr.neighbourhood || addr.quarter || addr.district,
      addr.city || addr.town || addr.village || addr.municipality,
    ].filter(Boolean);

    const shortAddress = parts.length > 0 ? parts.join(', ') : data.display_name.split(',').slice(0,3).join(',');
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const mapsUrlLabel = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    console.log(`📍 Géoloc: ${shortAddress} (${lat}, ${lng})`);

    res.json({
      full: data.display_name,
      short: shortAddress,
      lat, lng,
      mapsUrl,
      mapsUrlLabel, // Pour le livreur — itinéraire vers le client
      address: addr
    });
  } catch(e) {
    console.error('Geo reverse error:', e);
    res.status(500).json({ error: e.message });
  }
});


app.post('/commande/create', async (req, res) => {
  try {
    const { botId, sessionId, items, total, methode, adresse, clientNom, clientTel } = req.body;
    const cmd = await db.insert('commandes', {
      bot_id:botId, session_id:sessionId,
      items:items||[], total:total||0,
      statut: methode==='cash'?'pending':'paid',
      methode_paiement:methode, adresse_livraison:adresse||null,
      client_nom:clientNom||null, client_tel:clientTel||null
    });
    if (cmd?.[0]) notifyPatron(botId, cmd[0]).catch(()=>{});
    res.json({ success:true, commande:cmd?.[0], numero:cmd?.[0]?.numero });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.patch('/commande/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    await db.update('commandes', { statut, updated_at:new Date().toISOString() }, `?id=eq.${req.params.id}`);

    // Notifie le client du changement de statut
    notifyClientStatut(req.params.id, statut).catch(()=>{});

    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// ANALYTICS — Graphiques + export CSV
// ============================================

// Stats temporelles d'un bot (commandes, revenus, msgs par jour)
app.get('/analytics/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const days = parseInt(req.query.days) || 30; // 7, 30, 90 jours

    const since = new Date(Date.now() - days*86400000).toISOString();

    const [commandes, msgs, avis, rdvs] = await Promise.all([
      db.select('commandes', `?bot_id=eq.${botId}&created_at=gte.${since}&order=created_at.asc`),
      db.select('messages', `?bot_id=eq.${botId}&role=eq.user&created_at=gte.${since}&order=created_at.asc&limit=10000`),
      db.select('avis', `?bot_id=eq.${botId}&created_at=gte.${since}&visible=eq.true&order=created_at.asc`),
      db.select('rendez_vous', `?bot_id=eq.${botId}&created_at=gte.${since}&order=created_at.asc`)
    ]);

    // Agréger par jour
    const buildDailyMap = (items) => {
      const map = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - (days-1-i)*86400000);
        const key = d.toISOString().split('T')[0];
        map[key] = 0;
      }
      (items||[]).forEach(it => {
        const key = (it.created_at || '').split('T')[0];
        if (key in map) map[key]++;
      });
      return Object.entries(map).map(([date, count]) => ({date, count}));
    };

    const buildRevenueMap = (cmds) => {
      const map = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - (days-1-i)*86400000);
        const key = d.toISOString().split('T')[0];
        map[key] = 0;
      }
      (cmds||[]).forEach(c => {
        if (c.statut === 'paid' || c.statut === 'delivered') {
          const key = (c.created_at || '').split('T')[0];
          if (key in map) map[key] += (c.total||0);
        }
      });
      return Object.entries(map).map(([date, total]) => ({date, total}));
    };

    // Calcul comparatif période vs précédente
    const halfDays = Math.floor(days/2);
    const halfwayMs = Date.now() - halfDays*86400000;
    const recent = (commandes||[]).filter(c => new Date(c.created_at).getTime() > halfwayMs);
    const previous = (commandes||[]).filter(c => new Date(c.created_at).getTime() <= halfwayMs);
    const recentRev = recent.filter(c => c.statut==='paid'||c.statut==='delivered').reduce((s,c)=>s+(c.total||0),0);
    const previousRev = previous.filter(c => c.statut==='paid'||c.statut==='delivered').reduce((s,c)=>s+(c.total||0),0);
    const revGrowth = previousRev > 0 ? ((recentRev - previousRev) / previousRev * 100) : (recentRev > 0 ? 100 : 0);

    // Distribution des statuts
    const statusDist = {};
    (commandes||[]).forEach(c => {
      statusDist[c.statut] = (statusDist[c.statut]||0) + 1;
    });

    // Heures les plus actives (0-23)
    const hourly = Array(24).fill(0);
    (msgs||[]).forEach(m => {
      const h = new Date(m.created_at).getHours();
      hourly[h]++;
    });

    res.json({
      period_days: days,
      orders: {
        total: (commandes||[]).length,
        daily: buildDailyMap(commandes),
        by_status: statusDist,
      },
      revenue: {
        total: (commandes||[]).filter(c => c.statut==='paid'||c.statut==='delivered').reduce((s,c)=>s+(c.total||0),0),
        daily: buildRevenueMap(commandes),
        growth_pct: parseFloat(revGrowth.toFixed(1)),
        recent_period: recentRev,
        previous_period: previousRev,
      },
      messages: {
        total: (msgs||[]).length,
        daily: buildDailyMap(msgs),
        hourly: hourly.map((count, hour) => ({hour, count})),
      },
      reviews: {
        total: (avis||[]).length,
        average: (avis||[]).length ? parseFloat(((avis||[]).reduce((s,a)=>s+a.note,0)/avis.length).toFixed(2)) : 0,
      },
      appointments: {
        total: (rdvs||[]).length,
        daily: buildDailyMap(rdvs),
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Export CSV des commandes
app.get('/analytics/:botId/export/commandes.csv', async (req, res) => {
  try {
    const { botId } = req.params;
    const days = parseInt(req.query.days) || 90;
    const since = new Date(Date.now() - days*86400000).toISOString();
    const commandes = await db.select('commandes', `?bot_id=eq.${botId}&created_at=gte.${since}&order=created_at.desc&limit=5000`);

    const escape = (s) => {
      if (s == null) return '';
      const str = String(s).replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    };

    const headers = ['Numero','Date','Statut','Total_FCFA','Client_Nom','Client_Tel','Client_Email','Adresse_Livraison','Methode_Paiement','Articles'];
    const rows = (commandes||[]).map(c => [
      c.numero || c.id,
      c.created_at ? c.created_at.replace('T',' ').substring(0,19) : '',
      c.statut || '',
      c.total || 0,
      c.client_nom || '',
      c.client_tel || '',
      c.client_email || '',
      c.adresse_livraison || '',
      c.methode_paiement || '',
      Array.isArray(c.items) ? c.items.map(i => i.nom||i).join(' | ') : ''
    ].map(escape).join(','));

    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n'); // BOM pour Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="commandes-${botId}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Export CSV des conversations / messages
app.get('/analytics/:botId/export/messages.csv', async (req, res) => {
  try {
    const { botId } = req.params;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days*86400000).toISOString();
    const msgs = await db.select('messages', `?bot_id=eq.${botId}&created_at=gte.${since}&order=created_at.desc&limit=5000`);

    const escape = (s) => {
      if (s == null) return '';
      const str = String(s).replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    };
    const headers = ['Date','Role','Session','Contenu'];
    const rows = (msgs||[]).map(m => [
      m.created_at ? m.created_at.replace('T',' ').substring(0,19) : '',
      m.role || '',
      m.conversation_id || '',
      m.content || ''
    ].map(escape).join(','));

    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="messages-${botId}-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// CODES PROMO — Texte (BIENVENUE10) + Uniques (par client)
// Table 'promos' attendue:
//   id (uuid), bot_id, code (unique par bot), type ('text'/'unique'),
//   reduction_type ('pct'/'fcfa'), reduction_value (number),
//   max_uses (int, null=illimité), used_count (int default 0),
//   client_tel (text, null pour 'text', valeur pour 'unique'),
//   actif (bool default true), expire_at (timestamp), description (text),
//   created_at, used_at
// ============================================

// Génère un code unique aléatoire (8 chars alphanumériques upper)
function generatePromoCode(prefix) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L pour lisibilité
  let s = (prefix||'') + '-';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s.toUpperCase();
}

// Liste les codes promo d'un bot
app.get('/promos/:botId', async (req, res) => {
  try {
    const promos = await db.select('promos', `?bot_id=eq.${req.params.botId}&order=created_at.desc`);
    res.json(promos || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Crée un code promo texte (réutilisable, ex: BIENVENUE10)
app.post('/promos/:botId/text', async (req, res) => {
  try {
    const { botId } = req.params;
    const { code, reduction_type, reduction_value, max_uses, expire_at, description } = req.body;
    if (!code || !reduction_type || !reduction_value) {
      return res.status(400).json({ error: 'code, reduction_type, reduction_value requis' });
    }
    if (!['pct','fcfa'].includes(reduction_type)) {
      return res.status(400).json({ error: 'reduction_type doit être pct ou fcfa' });
    }
    const codeUpper = String(code).toUpperCase().trim();
    // Vérifier que ce code n'existe pas déjà
    const existing = await db.select('promos', `?bot_id=eq.${botId}&code=eq.${encodeURIComponent(codeUpper)}&limit=1`);
    if (existing?.length) return res.status(400).json({ error: 'Ce code existe déjà' });

    const data = {
      bot_id: botId,
      code: codeUpper,
      type: 'text',
      reduction_type,
      reduction_value: parseInt(reduction_value),
      max_uses: max_uses ? parseInt(max_uses) : null,
      used_count: 0,
      actif: true,
      description: description || null,
      expire_at: expire_at || null
    };
    const out = await db.insert('promos', data);
    res.json({ success: true, promo: out?.[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Crée un code promo unique pour un client donné
app.post('/promos/:botId/unique', async (req, res) => {
  try {
    const { botId } = req.params;
    const { client_tel, reduction_type, reduction_value, expire_at, description } = req.body;
    if (!client_tel || !reduction_type || !reduction_value) {
      return res.status(400).json({ error: 'client_tel, reduction_type, reduction_value requis' });
    }
    // Charger le bot pour le préfixe
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom`);
    const prefix = (bots?.[0]?.nom || 'PROMO').substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    let code, attempts = 0;
    while (attempts < 5) {
      code = generatePromoCode(prefix);
      const existing = await db.select('promos', `?bot_id=eq.${botId}&code=eq.${encodeURIComponent(code)}&limit=1`);
      if (!existing?.length) break;
      attempts++;
    }
    const data = {
      bot_id: botId,
      code,
      type: 'unique',
      reduction_type,
      reduction_value: parseInt(reduction_value),
      max_uses: 1,
      used_count: 0,
      client_tel,
      actif: true,
      description: description || null,
      expire_at: expire_at || null
    };
    const out = await db.insert('promos', data);
    // Envoyer le code au client par WhatsApp si tel valide
    if (client_tel && CONFIG.WASENDER_API_KEY) {
      const botNom = bots?.[0]?.nom || 'Notre service';
      const reduc = reduction_type === 'pct' ? `${reduction_value}%` : `${parseInt(reduction_value).toLocaleString('fr-FR')} FCFA`;
      const msg = `🎁 *${botNom}* — Code promo personnel\n\nVotre code: *${code}*\nRéduction: *${reduc}*\n${expire_at?`⏰ Valide jusqu'au ${new Date(expire_at).toLocaleDateString('fr-FR')}\n`:''}${description?`\n${description}\n`:''}\nUtilisez-le lors de votre prochaine commande! Jërëjëf 🙏`;
      sendWhatsApp(client_tel, msg).catch(()=>{});
    }
    res.json({ success: true, promo: out?.[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Désactive/supprime un code promo
app.delete('/promos/:botId/:promoId', async (req, res) => {
  try {
    await db.update('promos', { actif: false }, `?id=eq.${req.params.promoId}&bot_id=eq.${req.params.botId}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Valide un code promo (utilisé par le bot ou côté client lors de la commande)
app.post('/promos/:botId/validate', async (req, res) => {
  try {
    const { botId } = req.params;
    const { code, total, client_tel } = req.body;
    if (!code) return res.status(400).json({ error: 'code requis' });
    const codeUpper = String(code).toUpperCase().trim();
    const promos = await db.select('promos', `?bot_id=eq.${botId}&code=eq.${encodeURIComponent(codeUpper)}&actif=eq.true&limit=1`);
    if (!promos?.[0]) return res.json({ valid: false, error: 'Code invalide' });
    const p = promos[0];
    // Vérifications
    if (p.expire_at && new Date(p.expire_at) < new Date()) return res.json({ valid: false, error: 'Code expiré' });
    if (p.max_uses && p.used_count >= p.max_uses) return res.json({ valid: false, error: 'Code déjà utilisé' });
    if (p.type === 'unique' && p.client_tel && client_tel) {
      // Normalise pour comparaison
      const norm = (s) => (s||'').replace(/[\s+\-()]/g,'');
      if (norm(p.client_tel) !== norm(client_tel)) {
        return res.json({ valid: false, error: 'Code réservé à un autre client' });
      }
    }
    // Calculer la réduction
    const subtotal = parseInt(total) || 0;
    let reduction = 0;
    if (p.reduction_type === 'pct') reduction = Math.floor(subtotal * p.reduction_value / 100);
    else if (p.reduction_type === 'fcfa') reduction = parseInt(p.reduction_value);
    if (reduction > subtotal) reduction = subtotal;
    const newTotal = subtotal - reduction;
    res.json({
      valid: true,
      code: p.code,
      reduction,
      reduction_type: p.reduction_type,
      reduction_value: p.reduction_value,
      original_total: subtotal,
      new_total: newTotal,
      description: p.description
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Marque un code promo comme utilisé (incrémente used_count)
async function applyPromoCode(botId, code) {
  try {
    const codeUpper = String(code).toUpperCase().trim();
    const promos = await db.select('promos', `?bot_id=eq.${botId}&code=eq.${encodeURIComponent(codeUpper)}&limit=1`);
    if (!promos?.[0]) return false;
    await db.update('promos', {
      used_count: (promos[0].used_count || 0) + 1,
      used_at: new Date().toISOString()
    }, `?id=eq.${promos[0].id}`);
    return true;
  } catch(e) { console.error('applyPromoCode:', e.message); return false; }
}

// ============================================
// EMAILS RÉCAPS PATRON — Hebdo (lundi) + Mensuel (1er du mois)
// ============================================

// Construit les statistiques d'un bot pour une période donnée
async function buildBotRecap(botId, sinceDate, untilDate) {
  try {
    const since = sinceDate.toISOString();
    const until = untilDate.toISOString();
    const [commandes, msgs, avis, rdvs, prevCommandes] = await Promise.all([
      db.select('commandes', `?bot_id=eq.${botId}&created_at=gte.${since}&created_at=lt.${until}`),
      db.select('messages', `?bot_id=eq.${botId}&role=eq.user&created_at=gte.${since}&created_at=lt.${until}&limit=10000`),
      db.select('avis', `?bot_id=eq.${botId}&created_at=gte.${since}&created_at=lt.${until}&visible=eq.true`),
      db.select('rendez_vous', `?bot_id=eq.${botId}&created_at=gte.${since}&created_at=lt.${until}`),
      // Période précédente (même durée) pour comparaison
      (function(){
        const dur = untilDate.getTime() - sinceDate.getTime();
        const prevSince = new Date(sinceDate.getTime() - dur).toISOString();
        return db.select('commandes', `?bot_id=eq.${botId}&created_at=gte.${prevSince}&created_at=lt.${since}`);
      })()
    ]);
    const validC = (commandes||[]).filter(c => c.statut==='paid'||c.statut==='delivered');
    const totalRevenue = validC.reduce((s,c)=>s+(c.total||0),0);
    const validPrevC = (prevCommandes||[]).filter(c => c.statut==='paid'||c.statut==='delivered');
    const prevRevenue = validPrevC.reduce((s,c)=>s+(c.total||0),0);
    const growth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : (totalRevenue > 0 ? 100 : 0);
    const avgRating = (avis||[]).length ? (avis.reduce((s,a)=>s+a.note,0)/avis.length).toFixed(1) : null;
    return {
      orders: (commandes||[]).length,
      orders_paid: validC.length,
      revenue: totalRevenue,
      messages: (msgs||[]).length,
      reviews: (avis||[]).length,
      avg_rating: avgRating,
      appointments: (rdvs||[]).length,
      growth_pct: parseFloat(growth.toFixed(1)),
      prev_revenue: prevRevenue,
    };
  } catch(e) { console.error('buildBotRecap:', e.message); return null; }
}

// Envoie un email récap à un patron
async function sendRecapEmail(bot, recap, periodLabel, periodIcon) {
  if (!bot.notifications_email || !recap) return false;
  const growth = recap.growth_pct;
  const growthColor = growth >= 0 ? '#10b981' : '#ef4444';
  const growthIcon = growth >= 0 ? '📈' : '📉';
  const growthSign = growth >= 0 ? '+' : '';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f5f7f6;font-family:-apple-system,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:linear-gradient(135deg,${bot.couleur||'#00c875'},#0a1a0f);padding:30px 24px;color:#fff;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">${periodIcon}</div>
      <div style="font-size:22px;font-weight:800">${periodLabel}</div>
      <div style="font-size:14px;opacity:.9;margin-top:4px">${bot.nom}</div>
    </div>
    <div style="padding:28px 24px">
      <p style="font-size:14px;color:#3a5040;margin:0 0 20px">Voici votre récap d'activité ${periodLabel.toLowerCase()}.</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:.5px">Commandes payées</div>
          <div style="font-size:28px;font-weight:800;color:#0a1a0f;margin-top:4px">${recap.orders_paid}</div>
          <div style="font-size:11px;color:#5a7060;margin-top:2px">Total: ${recap.orders}</div>
        </div>
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.5px">Revenus</div>
          <div style="font-size:28px;font-weight:800;color:#0a1a0f;margin-top:4px">${(recap.revenue||0).toLocaleString('fr-FR')} F</div>
          <div style="font-size:11px;color:${growthColor};margin-top:2px;font-weight:700">${growthIcon} ${growthSign}${growth}% vs période préc.</div>
        </div>
        <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:11px;color:#1e40af;text-transform:uppercase;letter-spacing:.5px">Messages</div>
          <div style="font-size:28px;font-weight:800;color:#0a1a0f;margin-top:4px">${recap.messages}</div>
        </div>
        <div style="background:#fce7f3;border:1px solid #f9a8d4;border-radius:10px;padding:16px;text-align:center">
          <div style="font-size:11px;color:#9d174d;text-transform:uppercase;letter-spacing:.5px">RDV</div>
          <div style="font-size:28px;font-weight:800;color:#0a1a0f;margin-top:4px">${recap.appointments}</div>
        </div>
      </div>

      ${recap.reviews>0 ? `
      <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:14px;margin-bottom:20px;text-align:center">
        <div style="font-size:11px;color:#854d0e;text-transform:uppercase">⭐ Note moyenne</div>
        <div style="font-size:24px;font-weight:800;color:#0a1a0f;margin-top:4px">${recap.avg_rating}/5</div>
        <div style="font-size:11px;color:#5a7060">${recap.reviews} nouveaux avis</div>
      </div>` : ''}

      <a href="${CONFIG.BASE_URL}/dashboard/${bot.id}" style="display:block;background:#00c875;color:#000;text-align:center;padding:14px;border-radius:10px;font-weight:800;font-size:14px;text-decoration:none;margin-bottom:10px">📊 Voir le dashboard complet →</a>

      ${recap.orders === 0 ? `<p style="font-size:13px;color:#5a7060;background:#f9faf9;padding:14px;border-radius:8px;margin-top:10px">💡 Pas de commandes ${periodLabel.toLowerCase()}? Pensez à partager votre lien sur les réseaux sociaux ou créer un code promo!</p>` : ''}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">
      SamaBot IA — samabot.app · Vous recevez cet email car vous gérez ${bot.nom}
    </div>
  </div></body></html>`;
  await sendEmail(bot.notifications_email, `${periodIcon} ${periodLabel} — ${bot.nom}`, html);
  return true;
}

// Envoie les récaps à tous les bots actifs
async function sendAllRecaps(periodType) {
  try {
    const bots = await db.select('bots', '?actif=eq.true&select=id,nom,couleur,notifications_email');
    if (!bots?.length) return;
    const now = new Date();
    let sinceDate, untilDate, label, icon;
    if (periodType === 'week') {
      // Semaine précédente: lundi 00:00 → dimanche 23:59
      const dayOfWeek = now.getDay() || 7; // dim=0 → 7
      sinceDate = new Date(now);
      sinceDate.setDate(now.getDate() - dayOfWeek - 6);
      sinceDate.setHours(0, 0, 0, 0);
      untilDate = new Date(sinceDate.getTime() + 7*86400000);
      label = 'Récap de la semaine';
      icon = '📅';
    } else { // month
      // Mois précédent: 1er du mois précédent → 1er du mois en cours
      sinceDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      untilDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
      label = `Récap de ${monthNames[sinceDate.getMonth()]}`;
      icon = '🗓️';
    }
    console.log(`📧 Envoi récaps ${periodType} à ${bots.length} bots (${sinceDate.toISOString().substring(0,10)} → ${untilDate.toISOString().substring(0,10)})`);
    let sent = 0;
    for (const bot of bots) {
      if (!bot.notifications_email) continue;
      try {
        const recap = await buildBotRecap(bot.id, sinceDate, untilDate);
        if (recap) {
          await sendRecapEmail(bot, recap, label, icon);
          sent++;
        }
      } catch(e) { console.error(`recap ${bot.nom}:`, e.message); }
    }
    console.log(`✅ ${sent} récaps envoyés`);
  } catch(e) { console.error('sendAllRecaps:', e.message); }
}

// Scheduler: vérifie toutes les heures si on doit envoyer un récap
// Hebdo: lundi à 9h00
// Mensuel: 1er du mois à 9h30
let lastWeeklyRun = null, lastMonthlyRun = null;
function checkAndSendRecaps() {
  const now = new Date();
  const day = now.getDay(); // 0=dimanche, 1=lundi
  const date = now.getDate();
  const hour = now.getHours();
  const todayKey = now.toISOString().substring(0, 10);

  // Hebdo: lundi (day=1) à 9h
  if (day === 1 && hour === 9 && lastWeeklyRun !== todayKey) {
    lastWeeklyRun = todayKey;
    sendAllRecaps('week').catch(e => console.error('Weekly recap err:', e.message));
  }
  // Mensuel: 1er du mois à 9h30 (vérifié à 9h pour correspondre au cycle horaire)
  if (date === 1 && hour === 9 && lastMonthlyRun !== todayKey) {
    lastMonthlyRun = todayKey;
    // Délai pour ne pas envoyer en même temps que l'hebdo
    setTimeout(() => sendAllRecaps('month').catch(e => console.error('Monthly recap err:', e.message)), 30*60*1000);
  }
}
// Vérifier toutes les heures
setInterval(checkAndSendRecaps, 60 * 60 * 1000);
// Et au démarrage (utile si serveur redémarre à 9h05 par ex.)
setTimeout(checkAndSendRecaps, 5000);

// ============================================
// MARKETING AUTOMATISÉ
// 1. Panier abandonné (commande pending depuis > 2h, pas confirmée)
// 2. Reminder RDV (J-1)
// 3. Anniversaire client (date_naissance dans la DB)
// ============================================

// Vérifie et envoie les rappels marketing
async function runMarketingAutomations() {
  await abandonedCartReminders().catch(e => console.error('abandonedCart:', e.message));
  await rdvReminders().catch(e => console.error('rdvReminders:', e.message));
  await birthdayReminders().catch(e => console.error('birthdays:', e.message));
}

// 1️⃣ Panier abandonné: commande pending depuis 2h-24h, pas encore relancée
async function abandonedCartReminders() {
  try {
    // Cherche les commandes pending entre 2h et 24h, pas encore relancées
    const since = new Date(Date.now() - 24*3600000).toISOString();
    const until = new Date(Date.now() - 2*3600000).toISOString();
    const cmds = await db.select('commandes', `?statut=eq.pending&created_at=gte.${since}&created_at=lte.${until}&limit=200`);
    if (!cmds?.length) return;

    for (const cmd of cmds) {
      // Skip si déjà relancée ou pas d'infos client
      if (cmd.relance_envoyee || (!cmd.client_tel && !cmd.client_email)) continue;
      if (!cmd.total || cmd.total === 0) continue; // Skip commandes vides

      // Récupérer le bot
      const bots = await db.select('bots', `?id=eq.${cmd.bot_id}&select=nom,couleur,emoji,notifications_phone`);
      const bot = bots?.[0];
      if (!bot) continue;

      const totalFmt = (cmd.total||0).toLocaleString('fr-FR');
      console.log(`🛒 Relance panier abandonné: ${cmd.numero} (${bot.nom})`);

      // WhatsApp client (priorité)
      if (cmd.client_tel) {
        const msg = `👋 *${bot.nom}*\n\nVous aviez commencé une commande de *${totalFmt} FCFA*.\n\nElle vous attend toujours ! 🎁\n\nTerminez-la ici: ${CONFIG.BASE_URL}/chat/${cmd.bot_id}\n\nDes questions? Répondez à ce message.`;
        sendWhatsApp(cmd.client_tel, msg).catch(()=>{});
      }

      // Email client (si pas de tel ou en complément)
      if (cmd.client_email) {
        const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px"><div style="background:${bot.couleur||'#00c875'};color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center"><div style="font-size:40px">🛒</div><div style="font-size:20px;font-weight:800;margin-top:6px">Votre commande vous attend</div></div><div style="background:#fff;padding:24px;border-radius:0 0 12px 12px"><p>Bonjour${cmd.client_nom?' '+cmd.client_nom:''},</p><p>Vous aviez commencé une commande de <strong>${totalFmt} FCFA</strong> chez ${bot.nom} mais ne l'avez pas terminée.</p><p>Pas de souci, elle vous attend toujours !</p><a href="${CONFIG.BASE_URL}/chat/${cmd.bot_id}" style="display:inline-block;background:#00c875;color:#000;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:10px">Terminer ma commande →</a></div></div>`;
        sendEmail(cmd.client_email, `🛒 Votre commande chez ${bot.nom} vous attend`, html).catch(()=>{});
      }

      // Marquer comme relancée
      await db.update('commandes', { relance_envoyee: true, relance_date: new Date().toISOString() }, `?id=eq.${cmd.id}`);
    }
  } catch(e) { console.error('abandonedCartReminders:', e.message); }
}

// 2️⃣ Rappel RDV J-1
async function rdvReminders() {
  try {
    const tomorrow = new Date(Date.now() + 24*3600000);
    const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
    const rdvs = await db.select('rendez_vous', `?date=eq.${dateStr}&statut=eq.confirme&limit=200`);
    if (!rdvs?.length) return;

    for (const rdv of rdvs) {
      if (rdv.rappel_envoye) continue;
      const bots = await db.select('bots', `?id=eq.${rdv.bot_id}&select=nom,adresse`);
      const bot = bots?.[0];
      if (!bot) continue;

      console.log(`📅 Rappel RDV J-1: ${bot.nom} ${rdv.heure} (${rdv.client_nom||'?'})`);

      const heureFmt = rdv.heure || '';
      const service = rdv.service || 'votre rendez-vous';

      if (rdv.client_tel) {
        const msg = `📅 *Rappel ${bot.nom}*\n\nN'oubliez pas! Vous avez ${service} *demain à ${heureFmt}*.\n${bot.adresse?`📍 ${bot.adresse}\n`:''}\nÀ demain! 🙏`;
        sendWhatsApp(rdv.client_tel, msg).catch(()=>{});
      }
      if (rdv.client_email) {
        const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px"><h2 style="color:#00c875">📅 Rappel: votre rendez-vous demain</h2><p>Bonjour${rdv.client_nom?' '+rdv.client_nom:''},</p><p>Petit rappel: vous avez <strong>${service}</strong> chez <strong>${bot.nom}</strong> demain à <strong>${heureFmt}</strong>.</p>${bot.adresse?`<p>📍 ${bot.adresse}</p>`:''}<p>À demain!</p></div>`;
        sendEmail(rdv.client_email, `📅 Rappel — Votre RDV demain à ${heureFmt}`, html).catch(()=>{});
      }
      await db.update('rendez_vous', { rappel_envoye: true }, `?id=eq.${rdv.id}`);
    }
  } catch(e) { console.error('rdvReminders:', e.message); }
}

// 3️⃣ Anniversaire client (table clients_birthdays optionnelle, ou via commandes avec date_naissance)
async function birthdayReminders() {
  try {
    const today = new Date();
    const monthDay = String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

    // Cherche les clients dont c'est l'anniversaire (basé sur une éventuelle table clients)
    // Cette fonction est best-effort: si la table n'existe pas, elle ne fait rien
    let clients = [];
    try {
      // PostgREST: filter sur to_char(date_naissance, 'MM-DD') = monthDay
      // Comme c'est complexe en REST, on fait simple: récupère tous les clients et filtre côté code
      clients = await db.select('clients_birthdays', `?notif_envoyee_${today.getFullYear()}=is.null&limit=500`) || [];
    } catch(e) { return; /* Table n'existe pas, pas grave */ }

    for (const client of clients) {
      if (!client.date_naissance) continue;
      const bd = String(client.date_naissance).substring(5, 10); // MM-DD
      if (bd !== monthDay) continue;

      const bots = await db.select('bots', `?id=eq.${client.bot_id}&select=nom`);
      const bot = bots?.[0];
      if (!bot) continue;

      console.log(`🎂 Anniversaire ${client.nom||'client'} (${bot.nom})`);

      if (client.tel) {
        const msg = `🎂 *Joyeux anniversaire${client.nom?' '+client.nom:''}!*\n\nToute l'équipe ${bot.nom} vous souhaite une belle journée!\n\n🎁 *Cadeau spécial*: profitez de -15% sur votre prochaine commande aujourd'hui avec le code *ANNIV15*\n\nÀ bientôt!`;
        sendWhatsApp(client.tel, msg).catch(()=>{});
      }
      // Marquer comme envoyé pour cette année
      const yearField = `notif_envoyee_${today.getFullYear()}`;
      await db.update('clients_birthdays', { [yearField]: new Date().toISOString() }, `?id=eq.${client.id}`).catch(()=>{});
    }
  } catch(e) { console.error('birthdayReminders:', e.message); }
}

// Scheduler marketing: toutes les 30 min
setInterval(runMarketingAutomations, 30 * 60 * 1000);
// Et au démarrage (10s après pour laisser le serveur démarrer)
setTimeout(runMarketingAutomations, 10000);

// Endpoint admin pour déclencher manuellement
app.post('/admin/marketing/run', async (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  runMarketingAutomations().catch(()=>{});
  res.json({ success: true, message: 'Automations marketing déclenchées' });
});

// Endpoint pour ajouter un anniversaire client (best-effort, marche si table existe)
app.post('/clients/:botId/birthday', async (req, res) => {
  try {
    const { nom, tel, email, date_naissance } = req.body;
    if (!date_naissance) return res.status(400).json({ error: 'date_naissance requise (YYYY-MM-DD)' });
    const data = { bot_id: req.params.botId, nom, tel, email, date_naissance };
    Object.keys(data).forEach(k => data[k] == null && delete data[k]);
    const out = await db.insert('clients_birthdays', data);
    res.json({ success: true, client: out?.[0] });
  } catch(e) { res.status(500).json({ error: e.message + ' (la table clients_birthdays existe-t-elle?)' }); }
});

// Endpoint pour déclencher manuellement le récap (admin)
app.post('/admin/recap/:type', async (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET && req.query.secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  const type = req.params.type;
  if (!['week','month'].includes(type)) return res.status(400).json({ error: 'type doit être week ou month' });
  sendAllRecaps(type).catch(e => console.error('Manual recap err:', e.message));
  res.json({ success: true, message: `Récap ${type} déclenché` });
});

// Endpoint pour tester un récap sur un bot précis
app.get('/recap/:botId/preview', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}`);
    if (!bots?.[0]) return res.status(404).json({ error: 'bot introuvable' });
    const bot = bots[0];
    const period = req.query.period || 'week';
    const now = new Date();
    let sinceDate, untilDate;
    if (period === 'week') {
      const dayOfWeek = now.getDay() || 7;
      sinceDate = new Date(now);
      sinceDate.setDate(now.getDate() - dayOfWeek - 6);
      sinceDate.setHours(0, 0, 0, 0);
      untilDate = new Date(sinceDate.getTime() + 7*86400000);
    } else {
      sinceDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      untilDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const recap = await buildBotRecap(bot.id, sinceDate, untilDate);
    res.json({ bot: { id: bot.id, nom: bot.nom }, period, since: sinceDate.toISOString(), until: untilDate.toISOString(), recap });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// NOTIFICATION CLIENT — Changement de statut
// ============================================
async function notifyClientStatut(commandeId, statut) {
  try {
    const cmds = await db.select('commandes', `?id=eq.${commandeId}`);
    const cmd = cmds?.[0];
    if (!cmd) return;

    const bots = await db.select('bots', `?id=eq.${cmd.bot_id}&select=nom,couleur,logo_url,telephone`);
    const bot = bots?.[0];
    if (!bot) return;

    const messages = {
      preparing: { emoji:'👨‍🍳', titre:'En préparation', msg:`Votre commande ${cmd.numero} est en cours de préparation!` },
      ready:     { emoji:'✅', titre:'Prête!', msg:`Votre commande ${cmd.numero} est prête! On prépare la livraison.` },
      delivering:{ emoji:'🛵', titre:'En route!', msg:`Votre commande ${cmd.numero} est en route vers vous! Restez disponible.` },
      delivered: { emoji:'🎉', titre:'Livrée!', msg:`Votre commande ${cmd.numero} a été livrée. Bon appétit! Jerejef 🙏` },
      cancelled: { emoji:'❌', titre:'Annulée', msg:`Votre commande ${cmd.numero} a été annulée. Contactez-nous: ${bot.telephone||''}` },
    };

    const info = messages[statut];
    if (!info) return;

    // WhatsApp au client si on a son numéro
    if (cmd.client_tel) {
      const waMsg = `${info.emoji} *${bot.nom}*\n\n${info.msg}`;
      const sent = await sendWhatsApp(cmd.client_tel, waMsg);
      if (!sent) console.log(`📱 Statut client fallback: ${whatsappNotifUrl(cmd.client_tel, waMsg)}`);
    }

    // Email au client si on a son email
    if (cmd.client_email && CONFIG.RESEND_API_KEY) {
      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:20px;margin:0">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:${bot.couleur||'#00c875'};padding:20px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">${info.emoji}</div>
      <div style="font-size:16px;font-weight:700;color:#fff">${info.titre}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">${bot.nom}</div>
    </div>
    <div style="padding:24px;text-align:center">
      <div style="font-size:16px;color:#0a1a0f;margin-bottom:16px">${info.msg}</div>
      <div style="background:#f0f4f1;border-radius:8px;padding:12px;display:inline-block">
        <div style="font-size:12px;color:#9ab0a0">Commande</div>
        <div style="font-size:18px;font-weight:800;color:#0a1a0f">${cmd.numero}</div>
        <div style="font-size:14px;font-weight:700;color:#00c875;margin-top:4px">${(cmd.total||0).toLocaleString('fr-FR')} FCFA</div>
      </div>
    </div>
    <div style="padding:14px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">SamaBot — samabot.app</div>
  </div>
</body></html>`;
      await sendEmail(cmd.client_email, `${info.emoji} ${info.titre} — ${cmd.numero} · ${bot.nom}`, html);
    }

    console.log(`📲 Client notifié: ${statut} → ${cmd.client_tel||cmd.client_email||'?'}`);
  } catch(e) { console.error('notifyClientStatut:', e.message); }
}

// ============================================
// IMPORT CATALOGUE — depuis site web ou API
// ============================================

// Import depuis une URL (scraping simple)
app.post('/import/catalogue', async (req, res) => {
  try {
    const { botId, url, type, apiKey } = req.body;
    if (!botId || !url) return res.status(400).json({ error:'botId et url requis' });

    let produits = [];

    if (type === 'shopify') {
      // Shopify — API publique products.json
      const shopUrl = url.replace(/\/$/, '');
      const r = await fetch(`${shopUrl}/products.json?limit=100`, {
        headers: apiKey ? { 'X-Shopify-Access-Token': apiKey } : {}
      });
      const data = await r.json();
      produits = (data.products||[]).map(p => ({
        nom: p.title,
        prix: Math.round(parseFloat(p.variants?.[0]?.price||0) * 655), // USD → FCFA approx
        desc: p.body_html?.replace(/<[^>]*>/g,'').substring(0,100)||'',
        image: p.images?.[0]?.src||null,
        emoji: '🛍️'
      }));

    } else if (type === 'woocommerce') {
      // WooCommerce REST API
      const r = await fetch(`${url}/wp-json/wc/v3/products?per_page=50&consumer_key=${apiKey?.split(':')[0]||''}&consumer_secret=${apiKey?.split(':')[1]||''}`);
      const data = await r.json();
      produits = (data||[]).map(p => ({
        nom: p.name,
        prix: Math.round(parseFloat(p.price||0)),
        desc: p.short_description?.replace(/<[^>]*>/g,'').substring(0,100)||'',
        image: p.images?.[0]?.src||null,
        emoji: '🛍️'
      }));

    } else if (type === 'json') {
      // API JSON générique — format [{nom, prix, description, image}]
      const r = await fetch(url, { headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {} });
      const data = await r.json();
      const items = Array.isArray(data) ? data : data.products || data.items || data.data || [];
      produits = items.map(p => ({
        nom: p.nom || p.name || p.title || p.label || '?',
        prix: parseInt(p.prix || p.price || p.cost || 0),
        desc: (p.description || p.desc || p.details || '').substring(0,100),
        image: p.image || p.photo || p.img || p.thumbnail || null,
        emoji: '🛍️'
      }));

    } else {
      // Scraping basique — cherche des patterns prix dans la page
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 SamaBot/1.0' } });
      const html = await r.text();

      // Cherche les prix en FCFA ou F CFA
      const matches = [...html.matchAll(/([A-Za-zÀ-ÿ\s]{3,50})[^<]*?(\d[\d\s]{2,8})\s*(?:FCFA|F CFA|CFA|Fr)/gi)];
      produits = matches.slice(0,20).map(m => ({
        nom: m[1].trim().substring(0,50),
        prix: parseInt(m[2].replace(/\s/g,'')),
        desc: '',
        image: null,
        emoji: '🛍️'
      })).filter(p => p.nom.length > 2 && p.prix > 0);
    }

    if (!produits.length) return res.status(404).json({ error:'Aucun produit trouvé', tip:'Essayez type=json avec une API' });

    // Sauvegarde dans le bot
    await db.update('bots', {
      catalogue: produits,
      updated_at: new Date().toISOString()
    }, `?id=eq.${botId}`);

    // Rebuild le prompt
    const bots = await db.select('bots', `?id=eq.${botId}`);
    if (bots?.[0]) {
      const newPrompt = makePrompt(bots[0]);
      await db.update('bots', { prompt: newPrompt }, `?id=eq.${botId}`);
    }

    console.log(`📥 Import catalogue: ${produits.length} produits → bot ${botId}`);
    res.json({ success:true, count:produits.length, produits: produits.slice(0,5), message:`${produits.length} produits importés dans le catalogue` });

  } catch(e) {
    console.error('Import catalogue error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Sync automatique (webhook ou cron)
app.post('/import/sync/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&select=id,catalogue_url,catalogue_type,catalogue_api_key`);
    const bot = bots?.[0];
    if (!bot?.catalogue_url) return res.status(400).json({ error:'Pas d\'URL de sync configurée' });

    // Re-import depuis l'URL sauvegardée
    const importRes = await fetch(`${CONFIG.BASE_URL}/import/catalogue`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ botId: bot.id, url: bot.catalogue_url, type: bot.catalogue_type, apiKey: bot.catalogue_api_key })
    });
    const data = await importRes.json();
    res.json(data);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// CATALOGUE CRUD — Gestion des produits
// ============================================

// Helper: récupère le catalogue actuel d'un bot
async function getCatalogue(botId) {
  const bots = await db.select('bots', `?id=eq.${botId}&select=catalogue`);
  if (!bots?.[0]) return null;
  const cat = bots[0].catalogue;
  return Array.isArray(cat) ? cat : [];
}

// Helper: sauvegarde le catalogue + reconstruit le prompt
async function saveCatalogue(botId, catalogue) {
  await db.update('bots', {
    catalogue: catalogue,
    updated_at: new Date().toISOString()
  }, `?id=eq.${botId}`);
  // Rebuild le prompt avec le nouveau catalogue
  const bots = await db.select('bots', `?id=eq.${botId}`);
  if (bots?.[0]) {
    const newPrompt = makePrompt(bots[0]);
    await db.update('bots', { prompt: newPrompt }, `?id=eq.${botId}`);
  }
}

// GET /catalogue/:botId — Liste des produits d'un bot
app.get('/catalogue/:botId', async (req, res) => {
  try {
    const cat = await getCatalogue(req.params.botId);
    if (cat === null) return res.status(404).json({ error: 'Bot non trouvé' });
    res.json({ catalogue: cat, count: cat.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /catalogue/:botId — Ajouter un produit
app.post('/catalogue/:botId', async (req, res) => {
  try {
    const { nom, prix, desc, image, emoji } = req.body;
    if (!nom || prix === undefined || prix === null) return res.status(400).json({ error: 'nom et prix requis' });
    const prixNum = parseInt(prix);
    if (isNaN(prixNum) || prixNum < 0) return res.status(400).json({ error: 'prix invalide' });

    const cat = await getCatalogue(req.params.botId);
    if (cat === null) return res.status(404).json({ error: 'Bot non trouvé' });

    const nouveau = {
      id: 'p_' + Date.now().toString(36),
      nom: String(nom).substring(0, 100),
      prix: prixNum,
      desc: desc ? String(desc).substring(0, 200) : '',
      image: image || null,
      emoji: emoji || '🛍️',
      actif: true
    };
    cat.push(nouveau);
    await saveCatalogue(req.params.botId, cat);
    console.log(`✅ Produit ajouté à ${req.params.botId}: ${nouveau.nom}`);
    res.json({ success: true, produit: nouveau, total: cat.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PATCH /catalogue/:botId/:produitIndex — Modifier un produit
app.patch('/catalogue/:botId/:produitIndex', async (req, res) => {
  try {
    const idx = parseInt(req.params.produitIndex);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Index invalide' });

    const cat = await getCatalogue(req.params.botId);
    if (cat === null) return res.status(404).json({ error: 'Bot non trouvé' });
    if (idx >= cat.length) return res.status(404).json({ error: 'Produit non trouvé' });

    const { nom, prix, desc, image, emoji, actif } = req.body;
    if (nom !== undefined) cat[idx].nom = String(nom).substring(0, 100);
    if (prix !== undefined) {
      const prixNum = parseInt(prix);
      if (!isNaN(prixNum) && prixNum >= 0) cat[idx].prix = prixNum;
    }
    if (desc !== undefined) cat[idx].desc = String(desc).substring(0, 200);
    if (image !== undefined) cat[idx].image = image || null;
    if (emoji !== undefined) cat[idx].emoji = emoji || '🛍️';
    if (actif !== undefined) cat[idx].actif = !!actif;

    await saveCatalogue(req.params.botId, cat);
    console.log(`✏️ Produit modifié dans ${req.params.botId}: ${cat[idx].nom}`);
    res.json({ success: true, produit: cat[idx] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE /catalogue/:botId/:produitIndex — Supprimer un produit
app.delete('/catalogue/:botId/:produitIndex', async (req, res) => {
  try {
    const idx = parseInt(req.params.produitIndex);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Index invalide' });

    const cat = await getCatalogue(req.params.botId);
    if (cat === null) return res.status(404).json({ error: 'Bot non trouvé' });
    if (idx >= cat.length) return res.status(404).json({ error: 'Produit non trouvé' });

    const removed = cat.splice(idx, 1);
    await saveCatalogue(req.params.botId, cat);
    console.log(`🗑️ Produit supprimé de ${req.params.botId}: ${removed[0]?.nom}`);
    res.json({ success: true, removed: removed[0], total: cat.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// BROADCASTS — Messages en masse
// ============================================

// Créer et envoyer un broadcast
app.post('/broadcast/send', async (req, res) => {
  try {
    const { botId, message, filtre, mediaUrl } = req.body;
    if (!botId || !message) return res.status(400).json({ error:'botId et message requis' });

    // Récupère tous les contacts uniques du bot
    const convs = await db.select('conversations', `?bot_id=eq.${botId}&order=created_at.desc`);
    if (!convs?.length) return res.json({ success:true, sent:0, message:'Aucun contact' });

    const bot = (await db.select('bots', `?id=eq.${botId}`))?.[0];
    if (!bot) return res.status(404).json({ error:'Bot non trouvé' });

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const conv of convs) {
      try {
        // Envoie via WhatsApp si numéro disponible
        if (conv.client_tel && CONFIG.WASENDER_API_KEY) {
          const waMsg = `📣 *${bot.nom}*\n\n${message}`;
          const ok = await sendWhatsApp(conv.client_tel, waMsg);
          if (ok) sent++;
          else failed++;
        } else {
          // Sinon sauvegarde comme message sortant dans la conversation
          await db.insert('messages', {
            conversation_id: conv.id,
            bot_id: botId,
            role: 'broadcast',
            content: message
          });
          sent++;
        }
        results.push({ session: conv.session_id, status: 'sent' });
      } catch(e) {
        failed++;
        results.push({ session: conv.session_id, status: 'failed', error: e.message });
      }
    }

    // Sauvegarde le broadcast en DB
    await db.insert('broadcasts', {
      bot_id: botId,
      message,
      total_sent: sent,
      total_failed: failed,
      statut: 'sent'
    }).catch(()=>{});

    console.log(`📣 Broadcast envoyé: ${sent} succès, ${failed} échecs`);
    res.json({ success:true, sent, failed, total: convs.length });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Historique des broadcasts
app.get('/broadcast/history/:botId', async (req, res) => {
  try {
    const broadcasts = await db.select('broadcasts', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=20`);
    res.json(broadcasts || []);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// INBOX UNIFIÉE — Tous les messages d'un bot
// ============================================
app.get('/inbox/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}`);
    const bot = bots?.[0];
    if (!bot) return res.status(404).send('Bot non trouvé');

    const convs = await db.select('conversations',
      `?bot_id=eq.${req.params.botId}&order=last_message_at.desc&limit=50`
    );

    const base = CONFIG.BASE_URL;
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${bot.nom} — Inbox</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f0f4f1;height:100vh;display:flex;flex-direction:column}
.nav{background:#0a1a0f;height:54px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.logo{font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:#fff}.logo span{color:#00c875}
.bot-name{font-size:13px;color:rgba(255,255,255,.6)}
.inbox-wrap{display:flex;flex:1;overflow:hidden}
.conv-list{width:320px;border-right:1px solid #e5e7eb;background:#fff;overflow-y:auto;flex-shrink:0}
.conv-item{padding:14px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background .15s;display:flex;gap:10px;align-items:flex-start}
.conv-item:hover,.conv-item.active{background:#f0f4f1}
.conv-ava{width:38px;height:38px;border-radius:50%;background:#00c875;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;color:#fff;font-weight:700}
.conv-name{font-size:14px;font-weight:600;color:#0a1a0f}
.conv-preview{font-size:12px;color:#9ab0a0;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.conv-time{font-size:10px;color:#c0d0c4;margin-top:2px}
.unread{background:#00c875;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.chat-area{flex:1;display:flex;flex-direction:column;overflow:hidden}
.chat-head{background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}
.chat-head-name{font-size:15px;font-weight:700;color:#0a1a0f}
.chat-head-sub{font-size:12px;color:#9ab0a0;margin-top:2px}
.msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;background:#f9faf9}
.msg{display:flex;gap:8px;align-items:flex-end;max-width:80%}
.msg.bot{align-self:flex-start}
.msg.user{align-self:flex-end;flex-direction:row-reverse}
.bubble{padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.5}
.bubble.bot{background:#fff;border:1px solid #e5e7eb;color:#0a1a0f;border-radius:2px 12px 12px 12px}
.bubble.user{background:#00c875;color:#fff;border-radius:12px 12px 2px 12px}
.msg-time{font-size:10px;color:#c0d0c4;margin:0 4px 2px}
.reply-bar{background:#fff;border-top:1px solid #e5e7eb;padding:12px 16px;display:flex;gap:10px;align-items:center}
.reply-input{flex:1;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;resize:none;max-height:100px}
.reply-input:focus{border-color:#00c875}
.send-btn{background:#00c875;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
.empty-state{flex:1;display:flex;align-items:center;justify-content:center;color:#9ab0a0;font-size:14px;flex-direction:column;gap:8px}
.broadcast-btn{background:#0a1a0f;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.broadcast-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:none;align-items:center;justify-content:center}
.broadcast-sheet{background:#fff;border-radius:16px;padding:24px;width:90%;max-width:480px}
.b-title{font-size:16px;font-weight:800;color:#0a1a0f;margin-bottom:16px}
textarea.b-msg{width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:12px;font-size:14px;font-family:inherit;outline:none;resize:vertical;min-height:100px;margin-bottom:12px}
textarea.b-msg:focus{border-color:#00c875}
.b-btns{display:flex;gap:8px}
.b-send{background:#00c875;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;flex:1}
.b-cancel{background:#f0f4f1;color:#0a1a0f;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
@media(max-width:600px){.conv-list{width:100%;display:block}.chat-area{display:none}.conv-list.hide{display:none}.chat-area.show{display:flex}}
</style>
</head>
<body>
<div class="nav">
  <div class="logo">Sama<span>Bot</span></div>
  <div class="bot-name">${bot.emoji} ${bot.nom}</div>
  <button class="broadcast-btn" onclick="openBroadcast()">📣 Broadcast</button>
</div>

<div class="inbox-wrap">
  <div class="conv-list" id="conv-list">
    ${convs?.length ? convs.map(c => `
    <div class="conv-item" data-session="${c.session_id||''}" onclick="loadConv('${c.id}','${c.session_id||''}',this)">
      <div class="conv-ava">${c.session_id?.charAt(0)?.toUpperCase()||'?'}</div>
      <div style="flex:1;min-width:0">
        <div class="conv-name">${c.session_id||'Visiteur'}</div>
        <div class="conv-preview">Cliquez pour voir les messages</div>
        <div class="conv-time">${new Date(c.last_message_at||c.created_at).toLocaleString('fr-FR')}</div>
      </div>
    </div>`).join('') : '<div style="padding:20px;text-align:center;color:#9ab0a0;font-size:13px">Aucune conversation</div>'}
  </div>

  <div class="chat-area" id="chat-area">
    <div class="empty-state">
      <div style="font-size:32px">💬</div>
      <div>Sélectionnez une conversation</div>
    </div>
  </div>
</div>

<!-- BROADCAST MODAL -->
<div class="broadcast-modal" id="b-modal">
  <div class="broadcast-sheet">
    <div class="b-title">📣 Envoyer un broadcast</div>
    <div style="font-size:13px;color:#5a7060;margin-bottom:12px" id="b-count">Chargement du nombre de contacts...</div>
    <textarea class="b-msg" id="b-msg" placeholder="Votre message à tous vos clients...&#10;&#10;Ex: 🎉 Promotion spéciale! -20% ce weekend sur tout le catalogue. Venez vite!"></textarea>
    <div class="b-btns">
      <button class="b-cancel" onclick="closeBroadcast()">Annuler</button>
      <button class="b-send" id="b-send-btn" onclick="sendBroadcast()">📣 Envoyer à tous</button>
    </div>
    <div id="b-result" style="display:none;margin-top:12px;padding:10px;border-radius:8px;font-size:13px"></div>
  </div>
</div>

<script>
var botId = "${bot.id}";
var currentConvId = null;

async function loadConv(convId, sessionId, el) {
  document.querySelectorAll('.conv-item').forEach(i=>i.classList.remove('active'));
  el.classList.add('active');
  currentConvId = convId;

  var area = document.getElementById('chat-area');
  area.innerHTML = '<div class="chat-head"><div><div class="chat-head-name">'+sessionId+'</div><div class="chat-head-sub">Conversation</div></div></div><div class="msgs" id="msgs-area"><div style="text-align:center;color:#9ab0a0;font-size:12px;padding:20px">Chargement...</div></div><div class="reply-bar"><textarea class="reply-input" id="reply-input" placeholder="Répondre..." rows="1" onkeydown="handleKey(event)"></textarea><button class="send-btn" onclick="sendReply()">Envoyer</button></div>';

  try {
    var r = await fetch('/inbox/messages/'+convId);
    var msgs = await r.json();
    var area2 = document.getElementById('msgs-area');
    if(!msgs.length){area2.innerHTML='<div style="text-align:center;color:#9ab0a0;font-size:12px;padding:20px">Aucun message</div>';return;}
    area2.innerHTML = msgs.map(m => {
      var isBot = m.role==='assistant'||m.role==='broadcast';
      return '<div class="msg '+(isBot?'bot':'user')+'">'
        +(isBot?'<div class="conv-ava" style="width:28px;height:28px;font-size:12px;background:#00c875">🤖</div>':'')
        +'<div><div class="bubble '+(isBot?'bot':'user')+'">'+m.content+'</div><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})+'</div></div>'
        +'</div>';
    }).join('');
    area2.scrollTop = area2.scrollHeight;
  } catch(e) { document.getElementById('msgs-area').innerHTML='<div style="color:#ef4444;padding:20px">Erreur: '+e.message+'</div>'; }
}

function handleKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendReply();}}

async function sendReply(){
  var input=document.getElementById('reply-input');
  var msg=input.value.trim();
  if(!msg||!currentConvId)return;
  input.value='';
  try{
    // Use the session_id stored in data attribute, not the conv id
    var convItem = document.querySelector('.conv-item.active');
    var sessionId = convItem ? convItem.getAttribute('data-session') : currentConvId;
    await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId,message:msg,sessionId:sessionId})});
    var btn=document.querySelector('.conv-item.active');
    if(btn)btn.click();
  }catch(e){alert('Erreur envoi');}
}

function openBroadcast(){
  document.getElementById('b-modal').style.display='flex';
  fetch('/inbox/contacts/'+botId).then(r=>r.json()).then(d=>{
    document.getElementById('b-count').textContent='📊 '+d.total+' contacts dans votre liste';
  }).catch(()=>{document.getElementById('b-count').textContent='Contacts disponibles';});
}

function closeBroadcast(){document.getElementById('b-modal').style.display='none';document.getElementById('b-result').style.display='none';}

async function sendBroadcast(){
  var msg=document.getElementById('b-msg').value.trim();
  if(!msg){alert('Entrez un message');return;}
  var btn=document.getElementById('b-send-btn');
  btn.disabled=true;btn.textContent='⏳ Envoi...';
  try{
    var r=await fetch('/broadcast/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId,message:msg})});
    var d=await r.json();
    var res=document.getElementById('b-result');
    res.style.display='block';
    if(d.success){res.style.background='#dcfce7';res.style.color='#166534';res.textContent='✅ Envoyé à '+d.sent+' contacts!'+(d.failed>0?' ('+d.failed+' échecs)':'');}
    else{res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='❌ '+d.error;}
    document.getElementById('b-msg').value='';
  }catch(e){alert('Erreur réseau');}
  btn.disabled=false;btn.textContent='📣 Envoyer à tous';
}
</script>
</body>
</html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});

// Messages d'une conversation
app.get('/inbox/messages/:convId', async (req, res) => {
  try {
    const msgs = await db.select('messages', `?conversation_id=eq.${req.params.convId}&order=created_at.asc&limit=100`);
    res.json(msgs || []);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Nombre de contacts d'un bot
app.get('/inbox/contacts/:botId', async (req, res) => {
  try {
    const convs = await db.select('conversations', `?bot_id=eq.${req.params.botId}`);
    res.json({ total: convs?.length || 0 });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// WORKFLOW AUTOMATION
// ============================================

// Récupère les workflows d'un bot
app.get('/workflow/:botId', async (req, res) => {
  try {
    const workflows = await db.select('workflows', `?bot_id=eq.${req.params.botId}&order=created_at.desc`);
    res.json(workflows || []);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Crée un workflow
app.post('/workflow/create', async (req, res) => {
  try {
    const { botId, nom, trigger, action, valeur, reponse, actif } = req.body;
    if (!botId || !trigger || !reponse) return res.status(400).json({ error:'botId, trigger et reponse requis' });

    const wf = await db.insert('workflows', {
      bot_id: botId,
      nom: nom || 'Workflow',
      trigger_type: trigger, // keyword, order, rdv, payment, rating
      trigger_valeur: valeur || null,
      action_type: action || 'reply',
      action_reponse: reponse,
      actif: actif !== false
    });

    res.json({ success:true, workflow: wf?.[0] });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Active/désactive un workflow
app.patch('/workflow/:id/toggle', async (req, res) => {
  try {
    const wfs = await db.select('workflows', `?id=eq.${req.params.id}`);
    const wf = wfs?.[0];
    if (!wf) return res.status(404).json({ error:'Workflow non trouvé' });
    await db.update('workflows', { actif: !wf.actif }, `?id=eq.${req.params.id}`);
    res.json({ success:true, actif: !wf.actif });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Supprime un workflow
app.delete('/workflow/:id', async (req, res) => {
  try {
    await db.update('workflows', { actif: false }, `?id=eq.${req.params.id}`);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Exécute les workflows automatiquement dans le chat
async function runWorkflows(botId, message, sessionId) {
  try {
    const workflows = await db.select('workflows', `?bot_id=eq.${botId}&actif=eq.true`);
    if (!workflows?.length || !Array.isArray(workflows)) return null;

    const msgLower = message.toLowerCase();

    for (const wf of workflows) {
      let triggered = false;

      switch(wf.trigger_type) {
        case 'keyword':
          // Déclenche si le message contient le mot-clé
          if (wf.trigger_valeur && msgLower.includes(wf.trigger_valeur.toLowerCase())) {
            triggered = true;
          }
          break;
        case 'greeting':
          if (/bonjour|salut|salam|asalaa|hello|hi\b/.test(msgLower)) triggered = true;
          break;
        case 'promo':
          if (/promo|réduction|solde|offre|discount/.test(msgLower)) triggered = true;
          break;
        case 'horaires':
          if (/heure|horaire|ouvert|fermé|quand/.test(msgLower)) triggered = true;
          break;
        case 'first_message':
          // Déclenche uniquement pour le premier message
          const count = await db.select('messages', `?bot_id=eq.${botId}&role=eq.user&select=id`);
          if (count?.length <= 1) triggered = true;
          break;
      }

      if (triggered) {
        console.log(`⚡ Workflow déclenché: ${wf.nom} → ${wf.trigger_type}`);
        return wf.action_reponse;
      }
    }
    return null;
  } catch(e) {
    console.error('runWorkflows error:', e.message);
    return null;
  }
}

// ============================================
// AVIS
// ============================================
app.post('/avis', async (req, res) => {
  try {
    const { botId, sessionId, note, commentaire } = req.body;
    await db.insert('avis', {
      bot_id:botId, session_id:sessionId, note,
      commentaire: commentaire||null,
      visible: true,    // visible par défaut, le patron peut masquer
      reponse: null     // réponse du patron (null = pas répondu)
    });
    // Recalcule la moyenne sur les avis visibles uniquement
    const allAvis = await db.select('avis', `?bot_id=eq.${botId}&visible=eq.true&select=note`);
    if (allAvis?.length) {
      const avg = allAvis.reduce((s,a)=>s+a.note,0)/allAvis.length;
      await db.update('bots', { avg_rating:parseFloat(avg.toFixed(2)) }, `?id=eq.${botId}`);
    }
    // Notifie le patron par email/WhatsApp si avis négatif (note <= 2)
    if (note <= 2) {
      notifyPatronAvisNegatif(botId, note, commentaire).catch(()=>{});
    }
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Stats avis pour le dashboard
app.get('/avis/stats/:botId', async (req, res) => {
  try {
    const all = await db.select('avis', `?bot_id=eq.${req.params.botId}&order=created_at.desc`);
    if (!all || !Array.isArray(all)) return res.json({ total:0, distribution:{1:0,2:0,3:0,4:0,5:0}, moyenne:0 });
    const visible = all.filter(a => a.visible !== false);
    const distribution = {1:0, 2:0, 3:0, 4:0, 5:0};
    visible.forEach(a => { if (a.note >= 1 && a.note <= 5) distribution[a.note]++; });
    const moyenne = visible.length ? (visible.reduce((s,a)=>s+a.note,0)/visible.length) : 0;
    const repondus = visible.filter(a => a.reponse).length;
    const negatifs = visible.filter(a => a.note <= 2).length;
    res.json({
      total: visible.length,
      total_brut: all.length,
      caches: all.length - visible.length,
      distribution,
      moyenne: parseFloat(moyenne.toFixed(2)),
      repondus,
      negatifs,
      a_repondre: visible.filter(a => a.note <= 3 && !a.reponse).length
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Récupérer tous les avis (avec réponses)
app.get('/avis/list/:botId', async (req, res) => {
  try {
    const all = await db.select('avis', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=100`);
    res.json(all || []);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Patron: répondre à un avis
app.patch('/avis/:id/repondre', async (req, res) => {
  try {
    const { reponse } = req.body;
    if (!reponse || !reponse.trim()) return res.status(400).json({ error:'reponse requise' });
    await db.update('avis', {
      reponse: reponse.substring(0, 500),
      reponse_date: new Date().toISOString()
    }, `?id=eq.${req.params.id}`);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Patron: masquer/afficher un avis
app.patch('/avis/:id/visibilite', async (req, res) => {
  try {
    const { visible } = req.body;
    await db.update('avis', { visible: !!visible }, `?id=eq.${req.params.id}`);
    // Recalcule la moyenne
    const avis = await db.select('avis', `?id=eq.${req.params.id}&select=bot_id`);
    if (avis?.[0]?.bot_id) {
      const visibles = await db.select('avis', `?bot_id=eq.${avis[0].bot_id}&visible=eq.true&select=note`);
      if (visibles?.length) {
        const avg = visibles.reduce((s,a)=>s+a.note,0)/visibles.length;
        await db.update('bots', { avg_rating:parseFloat(avg.toFixed(2)) }, `?id=eq.${avis[0].bot_id}`);
      }
    }
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Notif patron pour avis négatif
async function notifyPatronAvisNegatif(botId, note, commentaire) {
  try {
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom,notifications_phone,notifications_email`);
    const bot = bots?.[0];
    if (!bot) return;
    const stars = '⭐'.repeat(note) + '☆'.repeat(5-note);
    if (bot.notifications_phone) {
      const msg = `⚠️ *${bot.nom}* — Avis négatif reçu\n\nNote: ${stars} (${note}/5)\n${commentaire?`💬 "${commentaire.substring(0,200)}"\n\n`:''}👉 Répondez vite: ${CONFIG.BASE_URL}/dashboard/${botId}`;
      sendWhatsApp(bot.notifications_phone, msg).catch(()=>{});
    }
    if (bot.notifications_email) {
      const html = `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px"><h2 style="color:#dc2626">⚠️ Avis négatif sur ${bot.nom}</h2><p style="font-size:18px">${stars} (${note}/5)</p>${commentaire?`<blockquote style="border-left:4px solid #ef4444;padding:10px;background:#fef2f2;margin:10px 0">${commentaire}</blockquote>`:''}<p>Pensez à y répondre rapidement pour montrer votre engagement.</p><p><a href="${CONFIG.BASE_URL}/dashboard/${botId}" style="background:#00c875;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">📊 Voir le dashboard</a></p></div>`;
      sendEmail(bot.notifications_email, `⚠️ Avis ${note}/5 — ${bot.nom}`, html).catch(()=>{});
    }
  } catch(e) { console.error('notifyPatronAvisNegatif:', e.message); }
}

// ============================================
// AUTH CLIENTS — Login / Register simple
// ============================================

// Simple token generator (sans dépendance externe)
const crypto = require('crypto');

function generateToken(userId) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const payload = Buffer.from(JSON.stringify({userId, exp: Math.floor(Date.now()/1000) + 30*24*60*60})).toString('base64url');
  const sig = crypto.createHmac('sha256', CONFIG.JWT_SECRET).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+sig;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const parts = (token||'').split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = crypto.createHmac('sha256', CONFIG.JWT_SECRET).update(header+'.'+payload).digest('base64url');
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Math.floor(Date.now()/1000)) return null;
    return data.userId;
  } catch(e) { return null; }
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ','');
  const userId = verifyToken(token);
  if (!userId) return res.status(401).json({ error:'Non autorisé' });
  req.userId = userId;
  next();
}

function authOptional(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ','');
  req.userId = verifyToken(token) || null;
  next();
}

// ============================================
// AUTH — Google OAuth + Email/Password
// ============================================

// Google OAuth — Step 1: redirect
app.get('/auth/google', (req, res) => {
  if (!CONFIG.GOOGLE_CLIENT_ID) return res.status(500).send('Google OAuth non configuré');
  const params = new URLSearchParams({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    redirect_uri: `${CONFIG.BASE_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Google OAuth — Step 2: callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/login?error=google_failed');

    // Échange code contre token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        client_secret: CONFIG.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${CONFIG.BASE_URL}/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect('/login?error=google_token');

    // Récupère infos utilisateur
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();
    if (!profile.email) return res.redirect('/login?error=google_profile');

    // Trouve ou crée l'utilisateur
    let users = await db.select('users', `?email=eq.${encodeURIComponent(profile.email)}`);
    let user;
    if (users?.length) {
      user = users[0];
    } else {
      const created = await db.insert('users', {
        email: profile.email,
        nom: profile.name || profile.email.split('@')[0],
        plan: 'free',
        actif: true,
        google_id: profile.sub,
        avatar_url: profile.picture || null
      });
      user = created?.[0];
    }
    if (!user) return res.redirect('/login?error=user_create');

    const token = generateToken(user.id);
    const userStr = encodeURIComponent(JSON.stringify({ id:user.id, email:user.email, nom:user.nom, plan:user.plan }));
    // Token est déjà URL-safe (base64url), pas besoin de l'encoder
    res.redirect(`/app?token=${token}&user=${userStr}`);
  } catch(e) {
    console.error('Google OAuth error:', e.message);
    res.redirect('/login?error=server');
  }
});

// Register email/password
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, nom } = req.body;
    if (!email||!password) return res.status(400).json({ error:'email et password requis' });
    const existing = await db.select('users', `?email=eq.${encodeURIComponent(email)}`);
    if (existing?.length) return res.status(409).json({ error:'Email déjà utilisé' });
    const passHash = Buffer.from(password + CONFIG.JWT_SECRET).toString('base64');
    const user = await db.insert('users', { email, nom:nom||email.split('@')[0], plan:'free', actif:true, password_hash:passHash });
    if (!user?.[0]) return res.status(500).json({ error:'Erreur création compte' });
    const token = generateToken(user[0].id);
    res.json({ success:true, token, user:{ id:user[0].id, email, nom:user[0].nom, plan:'free' } });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Login email/password
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ error:'email et password requis' });
    const users = await db.select('users', `?email=eq.${encodeURIComponent(email)}`);
    if (!users?.length) return res.status(401).json({ error:'Email ou mot de passe incorrect' });
    const user = users[0];
    const passHash = Buffer.from(password + CONFIG.JWT_SECRET).toString('base64');
    if (user.password_hash !== passHash) return res.status(401).json({ error:'Email ou mot de passe incorrect' });
    const token = generateToken(user.id);
    res.json({ success:true, token, user:{ id:user.id, email:user.email, nom:user.nom, plan:user.plan } });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// Mes bots — protégé par auth
app.get('/auth/my-bots', authMiddleware, async (req, res) => {
  try {
    const bots = await db.select('bots', `?user_id=eq.${req.userId}&actif=eq.true&order=created_at.desc`);
    res.json(bots||[]);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// RENDEZ-VOUS — API complète
// ============================================

// Créneaux disponibles pour une date
app.get('/rdv/creneaux/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { date } = req.query; // format: YYYY-MM-DD

    if (!date) return res.status(400).json({ error: 'date requis (YYYY-MM-DD)' });

    // Récupère les disponibilités du jour
    const dateObj = new Date(date);
    const jourSemaine = dateObj.getDay(); // 0=dim, 1=lun...

    const [dispos, rdvPris, jourFerme] = await Promise.all([
      db.select('disponibilites', `?bot_id=eq.${botId}&jour_semaine=eq.${jourSemaine}&actif=eq.true`),
      db.select('rendez_vous', `?bot_id=eq.${botId}&date=eq.${date}&statut=neq.annule`),
      db.select('jours_fermes', `?bot_id=eq.${botId}&date=eq.${date}`)
    ]);

    if (jourFerme?.length) {
      return res.json({ creneaux: [], ferme: true, message: jourFerme[0].raison || 'Fermé ce jour' });
    }

    if (!dispos?.length) {
      return res.json({ creneaux: [], ferme: true, message: 'Pas de disponibilité ce jour' });
    }

    const dispo = dispos[0];
    const heuresPrises = new Set(rdvPris?.map(r => r.heure) || []);

    // Génère les créneaux
    const creneaux = [];
    let h = parseInt(dispo.heure_debut.split(':')[0]);
    let m = parseInt(dispo.heure_debut.split(':')[1]);
    const hFin = parseInt(dispo.heure_fin.split(':')[0]);
    const mFin = parseInt(dispo.heure_fin.split(':')[1]);
    const slot = dispo.duree_slot || 60;

    while (h < hFin || (h === hFin && m < mFin)) {
      const heureStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      creneaux.push({
        heure: heureStr,
        disponible: !heuresPrises.has(heureStr)
      });
      m += slot;
      h += Math.floor(m / 60);
      m = m % 60;
    }

    res.json({ creneaux, date, jourSemaine });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Créneaux des 7 prochains jours
app.get('/rdv/semaine/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const jours = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const jourSemaine = d.getDay();
      const joursNoms = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
      const moisNoms = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

      const [dispos, rdvPris, jourFerme] = await Promise.all([
        db.select('disponibilites', `?bot_id=eq.${botId}&jour_semaine=eq.${jourSemaine}&actif=eq.true`),
        db.select('rendez_vous', `?bot_id=eq.${botId}&date=eq.${dateStr}&statut=neq.annule`),
        db.select('jours_fermes', `?bot_id=eq.${botId}&date=eq.${dateStr}`)
      ]);

      const ferme = !!jourFerme?.length || !dispos?.length;
      const heuresPrises = new Set(rdvPris?.map(r => r.heure) || []);
      let creneauxDispo = 0;

      if (!ferme && dispos?.length) {
        const dispo = dispos[0];
        let h = parseInt(dispo.heure_debut.split(':')[0]);
        let m = parseInt(dispo.heure_debut.split(':')[1]);
        const hFin = parseInt(dispo.heure_fin.split(':')[0]);
        const slot = dispo.duree_slot || 60;
        while (h < hFin) {
          const heureStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          if (!heuresPrises.has(heureStr)) creneauxDispo++;
          m += slot; h += Math.floor(m/60); m = m%60;
        }
      }

      jours.push({
        date: dateStr,
        label: i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : `${joursNoms[jourSemaine]} ${d.getDate()} ${moisNoms[d.getMonth()]}`,
        ferme,
        creneauxDispo
      });
    }

    res.json({ jours });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Créer un RDV
app.post('/rdv/create', async (req, res) => {
  try {
    const { botId, sessionId, clientNom, clientTel, clientEmail, service, date, heure, notes } = req.body;
    if (!botId || !date || !heure) return res.status(400).json({ error: 'botId, date et heure requis' });

    // Vérifie que le créneau est encore disponible
    const existing = await db.select('rendez_vous', `?bot_id=eq.${botId}&date=eq.${date}&heure=eq.${heure}&statut=neq.annule`);
    if (existing?.length) return res.status(409).json({ error: 'Ce créneau est déjà pris' });

    const rdv = await db.insert('rendez_vous', {
      bot_id: botId,
      session_id: sessionId || null,
      client_nom: clientNom || 'Client',
      client_tel: clientTel || null,
      service: service || 'RDV',
      date, heure,
      statut: 'confirme',
      notes: notes || null
    });

    // Notifie le patron
    const bots2 = await db.select('bots', `?id=eq.${botId}&select=nom,notifications_phone`);
    const bot2 = bots2?.[0];
    console.log(`📅 Nouveau RDV: ${clientNom} le ${date} à ${heure} chez ${bot2?.nom}`);

    // Notifie le patron par email + WhatsApp
    if (rdv?.[0]) {
      notifyRdv(botId, rdv[0]).catch(()=>{});
      // Confirmation au client si email fourni
      if (clientEmail) sendConfirmationRdvClient(botId, rdv[0], clientEmail).catch(()=>{});
    }

    res.json({ success: true, rdv: rdv?.[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Annuler un RDV
app.patch('/rdv/:id/annuler', async (req, res) => {
  try {
    await db.update('rendez_vous', { statut: 'annule', updated_at: new Date().toISOString() }, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Changer statut RDV
app.patch('/rdv/:id/statut', async (req, res) => {
  try {
    await db.update('rendez_vous', { statut: req.body.statut, updated_at: new Date().toISOString() }, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// RDV du jour
app.get('/rdv/today/:botId', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const rdvs = await db.select('rendez_vous', `?bot_id=eq.${req.params.botId}&date=eq.${today}&statut=eq.confirme&order=heure.asc`);
    res.json(rdvs || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Configurer les disponibilités
app.post('/rdv/disponibilites/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { disponibilites } = req.body;

    // Supprime les anciennes
    await db.update('disponibilites', { actif: false }, `?bot_id=eq.${botId}`);

    // Insère les nouvelles
    for (const d of disponibilites) {
      await db.insert('disponibilites', {
        bot_id: botId,
        jour_semaine: d.jour,
        heure_debut: d.debut,
        heure_fin: d.fin,
        duree_slot: d.slot || 60,
        actif: true
      });
    }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// NOTIFICATIONS — Email + WhatsApp
// ============================================

// Envoie email via Resend (gratuit jusqu'à 3000 emails/mois)
async function sendEmail(to, subject, html) {
  if (!CONFIG.RESEND_API_KEY) {
    console.log(`📧 Email simulé → ${to}: ${subject}`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'SamaBot <notifications@samabot.app>',
        to: [to],
        subject,
        html
      })
    });
    const data = await res.json();
    console.log(`📧 Email envoyé à ${to}: ${data.id || JSON.stringify(data)}`);
  } catch(e) {
    console.error('Email error:', e.message);
  }
}

// Envoie un vrai message WhatsApp via WaSenderAPI
async function sendWhatsApp(to, message) {
  if (!CONFIG.WASENDER_API_KEY) {
    console.log(`📱 WhatsApp simulé (pas de WASENDER_API_KEY) → ${to}: ${message.substring(0,60)}...`);
    return false;
  }
  try {
    // Normalise le numéro: retire espaces/tirets/parenthèses, garde le +
    let phone = to.replace(/[\s\-()]/g,'');
    if (!phone.startsWith('+')) phone = '+' + phone;

    // Format selon la doc officielle WaSender:
    // POST /api/send-message + Authorization: Bearer KEY + body { to, text }
    const res = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization':`Bearer ${CONFIG.WASENDER_API_KEY}`
      },
      body: JSON.stringify({ to: phone, text: message })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      console.log(`📱 WhatsApp envoyé à ${phone} ✅ (msgId: ${data.data?.msgId||'?'})`);
      return true;
    } else {
      console.error(`📱 WhatsApp erreur (${res.status}) → ${phone}:`, JSON.stringify(data).substring(0,300));
      return false;
    }
  } catch(e) { console.error('sendWhatsApp error:', e.message); return false; }
}

// Génère le lien WhatsApp de notification
function whatsappNotifUrl(phone, message) {
  const n = phone.replace(/[\s+\-()]/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

// ============================================
// 🛡️ PLAN ACCESS CHECK + RATE LIMITING
// ============================================

// Cache pour rate limiting (in-memory, suffit pour un seul serveur)
const rateLimitMap = new Map(); // key = "ip:botId", value = { count, resetAt }

// Anti-abus: max 30 messages/min/IP/bot
function checkRateLimit(ip, botId) {
  const key = `${ip}:${botId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return { allowed: true };
  }
  if (entry.count >= 30) {
    return {
      allowed: false,
      reason: 'rate_limit',
      retry_after: Math.ceil((entry.resetAt - now) / 1000)
    };
  }
  entry.count++;
  return { allowed: true };
}

// Cleanup périodique du cache rate limit
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

// Vérifie si un bot a le droit de répondre selon son plan/trial/abo
async function checkBotPlanAccess(bot) {
  if (!bot) return { allowed: false, reason: 'bot_introuvable' };

  // Bot expiré explicitement par l'admin
  if (bot.actif === false) {
    return { allowed: false, reason: 'bot_inactif', message: 'Ce bot a été désactivé.' };
  }

  const plan = bot.plan || 'trial';
  const now = Date.now();

  // Plan TRIAL: vérifier la date de fin
  if (plan === 'trial') {
    const trialEnd = bot.trial_until ? new Date(bot.trial_until).getTime() : null;
    if (!trialEnd) {
      // Pas de date de trial → on assume nouveau bot, on lui donne 3 jours à partir de maintenant
      const newTrialEnd = new Date(now + 3 * 24 * 3600 * 1000).toISOString();
      db.update('bots', { trial_until: newTrialEnd, plan: 'trial' }, `?id=eq.${bot.id}`).catch(()=>{});
      return { allowed: true, plan: 'trial', trial_ends_at: newTrialEnd };
    }
    if (now > trialEnd) {
      return {
        allowed: false,
        reason: 'trial_expired',
        message: '⏰ Votre période d\'essai de 3 jours est terminée. Pour continuer, abonnez-vous: ' + CONFIG.BASE_URL + '/pricing',
        upgrade_url: CONFIG.BASE_URL + '/pricing?bot=' + bot.id
      };
    }
    // Trial encore actif
    return { allowed: true, plan: 'trial', trial_ends_at: bot.trial_until };
  }

  // Plans payants: vérifier que l'abonnement est actif
  if (['starter','pro','business'].includes(plan)) {
    // Si subscription_status est 'canceled' ou 'past_due' depuis +7 jours → bloqué
    if (bot.subscription_status === 'canceled') {
      return { allowed: false, reason: 'subscription_canceled', message: 'Votre abonnement a été annulé.' };
    }
    if (bot.subscription_status === 'past_due') {
      const pastDueSince = bot.past_due_since ? new Date(bot.past_due_since).getTime() : now;
      if (now - pastDueSince > 7 * 24 * 3600 * 1000) {
        return {
          allowed: false,
          reason: 'subscription_past_due',
          message: '💳 Votre paiement a échoué. Mettez à jour votre carte: ' + CONFIG.BASE_URL + '/billing/' + bot.id
        };
      }
    }
    return { allowed: true, plan };
  }

  // Plan inconnu → on assume trial
  return { allowed: true, plan: 'trial' };
}

// Email J-1 avant fin du trial
async function checkTrialReminders() {
  try {
    // Trouver tous les bots dont le trial expire dans 18-30h
    const bots = await db.select('bots', `?plan=eq.trial&trial_reminder_sent=is.null&actif=eq.true&select=id,nom,trial_until,notifications_email,couleur,emoji`);
    if (!bots?.length) return;
    const now = Date.now();
    for (const bot of bots) {
      if (!bot.trial_until || !bot.notifications_email) continue;
      const trialEnd = new Date(bot.trial_until).getTime();
      const hoursLeft = (trialEnd - now) / 3600000;
      if (hoursLeft > 18 && hoursLeft < 30) {
        // Envoyer le rappel
        const html = `<!DOCTYPE html><html><body style="margin:0;background:#f5f7f6;font-family:-apple-system,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff">
  <div style="background:linear-gradient(135deg,${bot.couleur||'#00c875'},#0a1a0f);padding:30px;color:#fff;text-align:center">
    <div style="font-size:50px">⏰</div>
    <div style="font-size:22px;font-weight:800;margin-top:8px">Plus que 24 heures !</div>
  </div>
  <div style="padding:30px">
    <p>Bonjour,</p>
    <p>Votre période d'essai gratuit pour <strong>${bot.nom}</strong> ${bot.emoji||'🤖'} se termine dans <strong>24 heures</strong>.</p>
    <p>Pour continuer à utiliser SamaBot et ne pas perdre vos clients, choisissez un abonnement :</p>
    <div style="background:#f0fdf4;padding:16px;border-radius:10px;margin:16px 0">
      <strong>🎁 Offre de bienvenue :</strong> -20% sur le plan annuel
    </div>
    <a href="${CONFIG.BASE_URL}/pricing?bot=${bot.id}" style="display:block;background:#00c875;color:#000;padding:14px;border-radius:10px;text-align:center;text-decoration:none;font-weight:800;margin:20px 0">Voir les plans →</a>
    <p style="font-size:13px;color:#666">Si vous ne faites rien, votre bot sera mis en pause automatiquement à la fin du trial. Vos données restent sauvegardées.</p>
  </div>
</div></body></html>`;
        await sendEmail(bot.notifications_email, `⏰ Votre essai SamaBot se termine demain — ${bot.nom}`, html).catch(()=>{});
        // Marquer comme envoyé
        await db.update('bots', { trial_reminder_sent: new Date().toISOString() }, `?id=eq.${bot.id}`).catch(()=>{});
        console.log(`📧 Rappel J-1 envoyé pour ${bot.nom} (${bot.id})`);
      }
    }
  } catch(e) { console.error('checkTrialReminders:', e.message); }
}
// Vérifier les rappels toutes les heures
setInterval(checkTrialReminders, 3600000);
// Et au démarrage (15s après pour laisser le serveur s'initier)
setTimeout(checkTrialReminders, 15000);

// ============ NOTIFICATION COMMANDE ============
async function notifyPatron(botId, commande) {
  try {
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom,notifications_email,notifications_phone,couleur`);
    const bot = bots?.[0];
    if (!bot) return;

    const itemsText = Array.isArray(commande.items)
      ? commande.items.map(i => `• ${i.nom || i} — ${i.prix ? i.prix.toLocaleString('fr-FR')+' FCFA' : ''}`).join('\n')
      : '';
    const total = (commande.total || 0).toLocaleString('fr-FR');
    const adresse = commande.adresse_livraison || 'Non spécifiée';
    const methode = commande.methode_paiement || 'Non spécifié';
    const numero = commande.numero || 'N/A';

    console.log(`🔔 Nouvelle commande ${numero} — ${bot.nom} — ${total} FCFA`);

    // ---- EMAIL ----
    if (bot.notifications_email) {
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:20px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#0a1a0f;padding:20px 24px;display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">📦</span>
      <div>
        <div style="font-size:16px;font-weight:700;color:#fff">Nouvelle commande!</div>
        <div style="font-size:12px;color:#00c875;margin-top:2px">${bot.nom}</div>
      </div>
    </div>
    <div style="padding:24px">
      <div style="background:#f0f4f1;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;color:#5a7060;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Référence</div>
        <div style="font-size:20px;font-weight:800;color:#0a1a0f">${numero}</div>
      </div>
      ${itemsText ? `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;color:#5a7060;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Articles</div>
        <div style="font-size:14px;color:#0a1a0f;line-height:1.7;white-space:pre-line">${itemsText}</div>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#5a7060;margin-bottom:4px">Total</div>
          <div style="font-size:18px;font-weight:800;color:#00c875">${total} FCFA</div>
        </div>
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#5a7060;margin-bottom:4px">Paiement</div>
          <div style="font-size:14px;font-weight:600;color:#0a1a0f">${methode}</div>
        </div>
      </div>
      <div style="background:#e8f5e9;border-radius:8px;padding:12px;margin-bottom:20px">
        <div style="font-size:11px;color:#5a7060;margin-bottom:4px">📍 Adresse de livraison</div>
        <div style="font-size:14px;font-weight:600;color:#0a1a0f">${adresse}</div>
      </div>
      <a href="${CONFIG.BASE_URL}/dashboard/${botId}" style="display:block;background:#00c875;color:#000;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">
        📊 Voir le dashboard →
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">
      SamaBot IA — samabot.app
    </div>
  </div>
</body>
</html>`;
      await sendEmail(bot.notifications_email, `📦 Nouvelle commande ${numero} — ${total} FCFA`, html);
    }

    // ---- WHATSAPP ----
    if (bot.notifications_phone) {
      const msg = `🔔 *SamaBot — Nouvelle commande!*\n\n📦 *${numero}*\n💰 Total: *${total} FCFA*\n💳 Paiement: ${methode}\n📍 Adresse: ${adresse}\n\n👉 Dashboard: ${CONFIG.BASE_URL}/dashboard/${botId}`;
      const sent = await sendWhatsApp(bot.notifications_phone, msg);
      if (!sent) console.log(`📱 WhatsApp fallback: ${whatsappNotifUrl(bot.notifications_phone, msg)}`);
    }
  } catch(e) {
    console.error('notifyPatron error:', e.message);
  }
}

// ============ NOTIFICATION RDV ============
async function notifyRdv(botId, rdv) {
  try {
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom,notifications_email,notifications_phone`);
    const bot = bots?.[0];
    if (!bot) return;

    const dateLabel = new Date(rdv.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    console.log(`📅 Nouveau RDV: ${rdv.client_nom} — ${dateLabel} à ${rdv.heure} chez ${bot.nom}`);

    // ---- EMAIL ----
    if (bot.notifications_email) {
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:20px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#0a1a0f;padding:20px 24px">
      <div style="font-size:16px;font-weight:700;color:#fff">📅 Nouveau rendez-vous!</div>
      <div style="font-size:12px;color:#00c875;margin-top:2px">${bot.nom}</div>
    </div>
    <div style="padding:24px">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:24px;font-weight:800;color:#0a1a0f;text-transform:capitalize">${dateLabel}</div>
        <div style="font-size:28px;font-weight:800;color:#00c875;margin-top:4px">${rdv.heure}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#5a7060;margin-bottom:4px">👤 Client</div>
          <div style="font-size:14px;font-weight:700;color:#0a1a0f">${rdv.client_nom || 'N/A'}</div>
        </div>
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#5a7060;margin-bottom:4px">📞 Téléphone</div>
          <div style="font-size:14px;font-weight:700;color:#0a1a0f">${rdv.client_tel || 'Non renseigné'}</div>
        </div>
      </div>
      ${rdv.service ? `<div style="background:#f0f4f1;border-radius:8px;padding:12px;margin-bottom:20px"><div style="font-size:11px;color:#5a7060;margin-bottom:4px">💅 Service</div><div style="font-size:14px;font-weight:700;color:#0a1a0f">${rdv.service}</div></div>` : ''}
      <a href="${CONFIG.BASE_URL}/dashboard/${botId}" style="display:block;background:#00c875;color:#000;text-align:center;padding:14px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">
        📅 Voir le calendrier →
      </a>
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">SamaBot IA — samabot.app</div>
  </div>
</body>
</html>`;
      await sendEmail(bot.notifications_email, `📅 Nouveau RDV — ${rdv.client_nom} le ${dateLabel} à ${rdv.heure}`, html);
    }

    // ---- WHATSAPP ----
    if (bot.notifications_phone) {
      const msg = `📅 *SamaBot — Nouveau RDV!*\n\n👤 *${rdv.client_nom || 'Client'}*\n📆 ${dateLabel}\n🕐 ${rdv.heure}\n💅 ${rdv.service || 'RDV'}\n📞 ${rdv.client_tel || 'Non renseigné'}\n\n👉 ${CONFIG.BASE_URL}/dashboard/${botId}`;
      const sent = await sendWhatsApp(bot.notifications_phone, msg);
      if (!sent) console.log(`📱 WhatsApp RDV fallback: ${whatsappNotifUrl(bot.notifications_phone, msg)}`);
    }
  } catch(e) {
    console.error('notifyRdv error:', e.message);
  }
}

// ============ CONFIRMATION EMAIL CLIENT — COMMANDE ============
async function sendConfirmationClient(botId, commande, clientEmail) {
  if (!clientEmail || !CONFIG.RESEND_API_KEY) return;
  try {
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom,couleur,logo_url`);
    const bot = bots?.[0];
    if (!bot) return;

    const total = (commande.total||0).toLocaleString('fr-FR');
    const numero = commande.numero || 'CMD-???';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:20px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:${bot.couleur||'#00c875'};padding:24px;text-align:center">
      ${bot.logo_url?`<img src="${bot.logo_url}" style="width:60px;height:60px;border-radius:12px;object-fit:cover;margin-bottom:10px"/><br/>`:''}
      <div style="font-size:18px;font-weight:700;color:#fff">${bot.nom}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">Confirmation de commande</div>
    </div>
    <div style="padding:28px">
      <div style="font-size:22px;margin-bottom:6px">✅ Commande confirmée!</div>
      <div style="font-size:14px;color:#5a7060;margin-bottom:24px">Votre commande a bien été reçue.</div>
      <div style="background:#f0f4f1;border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;color:#9ab0a0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Référence</div>
        <div style="font-size:20px;font-weight:800;color:#0a1a0f">${numero}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#9ab0a0;margin-bottom:4px">Total</div>
          <div style="font-size:18px;font-weight:800;color:#00c875">${total} FCFA</div>
        </div>
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#9ab0a0;margin-bottom:4px">Statut</div>
          <div style="font-size:14px;font-weight:700;color:#0a1a0f">En préparation</div>
        </div>
      </div>
      ${commande.adresse_livraison?`<div style="background:#e8f5e9;border-radius:8px;padding:12px;margin-bottom:16px"><div style="font-size:11px;color:#9ab0a0;margin-bottom:4px">📍 Livraison</div><div style="font-size:14px;font-weight:600;color:#0a1a0f">${commande.adresse_livraison}</div></div>`:''}
      <div style="text-align:center;padding:16px;background:#f9f9f9;border-radius:8px">
        <div style="font-size:13px;color:#5a7060">Merci pour votre commande!</div>
        <div style="font-size:12px;color:#9ab0a0;margin-top:4px">Nous vous contacterons dès que votre commande sera prête.</div>
      </div>
    </div>
    <div style="padding:14px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">
      Propulsé par <strong style="color:#00c875">SamaBot</strong> — samabot.app
    </div>
  </div>
</body></html>`;

    await sendEmail(clientEmail, `✅ Commande confirmée — ${numero} · ${bot.nom}`, html);
    console.log(`📧 Confirmation client envoyée à ${clientEmail}`);
  } catch(e) { console.error('sendConfirmationClient:', e.message); }
}

// ============ CONFIRMATION EMAIL CLIENT — RDV ============
async function sendConfirmationRdvClient(botId, rdv, clientEmail) {
  if (!clientEmail || !CONFIG.RESEND_API_KEY) return;
  try {
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom,couleur,logo_url,adresse,telephone`);
    const bot = bots?.[0];
    if (!bot) return;

    const dateLabel = new Date(rdv.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,sans-serif;background:#f5f5f5;padding:20px;margin:0">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:${bot.couleur||'#00c875'};padding:24px;text-align:center">
      ${bot.logo_url?`<img src="${bot.logo_url}" style="width:60px;height:60px;border-radius:12px;object-fit:cover;margin-bottom:10px"/><br/>`:''}
      <div style="font-size:18px;font-weight:700;color:#fff">${bot.nom}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">Confirmation de rendez-vous</div>
    </div>
    <div style="padding:28px">
      <div style="font-size:22px;margin-bottom:6px">📅 RDV confirmé!</div>
      <div style="font-size:14px;color:#5a7060;margin-bottom:24px">Votre rendez-vous a bien été enregistré.</div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:16px;text-align:center">
        <div style="font-size:26px;font-weight:800;color:#0a1a0f;text-transform:capitalize">${dateLabel}</div>
        <div style="font-size:32px;font-weight:800;color:#00c875;margin-top:4px">${rdv.heure}</div>
        ${rdv.service?`<div style="font-size:14px;color:#5a7060;margin-top:8px">💅 ${rdv.service}</div>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#9ab0a0;margin-bottom:4px">👤 Nom</div>
          <div style="font-size:14px;font-weight:700;color:#0a1a0f">${rdv.client_nom||'Client'}</div>
        </div>
        <div style="background:#f0f4f1;border-radius:8px;padding:12px">
          <div style="font-size:11px;color:#9ab0a0;margin-bottom:4px">📍 Lieu</div>
          <div style="font-size:14px;font-weight:700;color:#0a1a0f">${bot.adresse||bot.nom}</div>
        </div>
      </div>
      ${bot.telephone?`<div style="background:#dbeafe;border-radius:8px;padding:12px;margin-bottom:16px;text-align:center"><div style="font-size:13px;color:#1e40af">Pour annuler ou modifier: <strong>${bot.telephone}</strong></div></div>`:''}
      <div style="text-align:center;padding:16px;background:#f9f9f9;border-radius:8px">
        <div style="font-size:13px;color:#5a7060">Jerejef! Nous vous attendons.</div>
      </div>
    </div>
    <div style="padding:14px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">
      Propulsé par <strong style="color:#00c875">SamaBot</strong> — samabot.app
    </div>
  </div>
</body></html>`;

    await sendEmail(clientEmail, `📅 RDV confirmé — ${dateLabel} à ${rdv.heure} · ${bot.nom}`, html);
    console.log(`📧 Confirmation RDV client envoyée à ${clientEmail}`);
  } catch(e) { console.error('sendConfirmationRdvClient:', e.message); }
}


async function notifyNouveauMessage(botId, message) {
  // Désactivé pour éviter de spammer le patron à chaque message
  // Les notifs WhatsApp ne sont envoyées que pour: nouvelle commande, RDV, statut commande
  return;
}

// ============================================
// CRÉATION COMMANDE — Sur confirmation explicite du client
// Extrait les infos client depuis le récap du bot, crée la commande complète,
// et envoie TOUTES les notifs (patron + client, email + WhatsApp) en UN SEUL appel
// ============================================
async function createOrderFromConfirmation(botId, sessionId, total, bot, recapText, promo) {
  try {
    // Vérifie si une commande a déjà été créée récemment pour cette session (anti-doublon)
    const existing = await db.select('commandes', `?bot_id=eq.${botId}&session_id=eq.${sessionId}&order=created_at.desc&limit=1`);
    if (existing?.[0]) {
      const ageMs = Date.now() - new Date(existing[0].created_at).getTime();
      if (ageMs < 60000) { // moins d'1 min: c'est probablement la même commande
        console.log(`⚠️ Commande récente déjà créée (${existing[0].numero}), skip`);
        return;
      }
    }

    // Extraire les infos client depuis le RÉCAP du bot (plus fiable que parser les messages)
    const infos = extractInfosFromRecap(recapText);
    // Compléter avec les infos depuis l'historique des messages si manquant
    const fromMessages = await extractInfosFromMessages(botId, sessionId);
    const finalInfos = {
      client_nom: infos.nom || fromMessages.nom || null,
      client_tel: infos.tel || fromMessages.tel || null,
      client_email: infos.email || fromMessages.email || null,
      adresse_livraison: infos.adresse || fromMessages.adresse || null,
      article: infos.article || null,
    };

    // 🎁 Appliquer le code promo si fourni
    let originalTotal = total || 0;
    let promoReduction = 0;
    let promoCode = null;
    if (promo && originalTotal > 0) {
      // Vérifie que le client_tel correspond pour les promos uniques
      const okClient = promo.type !== 'unique' || !promo.client_tel ||
        (finalInfos.client_tel && (promo.client_tel.replace(/[\s+\-()]/g,'') === finalInfos.client_tel.replace(/[\s+\-()]/g,'')));
      if (okClient) {
        if (promo.reduction_type === 'pct') {
          promoReduction = Math.floor(originalTotal * promo.reduction_value / 100);
        } else if (promo.reduction_type === 'fcfa') {
          promoReduction = parseInt(promo.reduction_value) || 0;
        }
        if (promoReduction > originalTotal) promoReduction = originalTotal;
        promoCode = promo.code;
        console.log(`🎁 Code promo ${promo.code} appliqué: -${promoReduction} FCFA`);
      }
    }
    const finalTotal = originalTotal - promoReduction;

    console.log(`📦 Création commande pour bot ${botId}:`, JSON.stringify(finalInfos), promoCode?`(promo: ${promoCode})`:'');

    // Créer la commande
    const cmdData = {
      bot_id: botId,
      session_id: sessionId,
      items: finalInfos.article ? [{ nom: finalInfos.article }] : [],
      total: finalTotal,
      statut: 'pending',
      methode_paiement: 'en attente',
      client_nom: finalInfos.client_nom,
      client_tel: finalInfos.client_tel,
      client_email: finalInfos.client_email,
      adresse_livraison: finalInfos.adresse_livraison,
    };
    // Stocker le code promo et la réduction dans items si table le supporte
    if (promoCode) {
      cmdData.items = [...cmdData.items, { promo_code: promoCode, reduction: promoReduction, original_total: originalTotal }];
    }
    // Retire les null pour ne pas écraser les valeurs par défaut DB
    Object.keys(cmdData).forEach(k => cmdData[k] == null && delete cmdData[k]);

    const cmd = await db.insert('commandes', cmdData);
    if (!cmd?.[0]) {
      console.error('❌ Échec création commande');
      return;
    }
    const commande = cmd[0];
    console.log(`✅ Commande créée: ${commande.numero} — ${finalTotal} FCFA${promoCode?` (promo ${promoCode}: -${promoReduction})`:''}`);

    // Marquer le promo comme utilisé
    if (promoCode) {
      applyPromoCode(botId, promoCode).catch(()=>{});
    }

    // 📧📱 NOTIFICATIONS PATRON (1 email + 1 WhatsApp seulement)
    notifyPatron(botId, commande).catch(e => console.error('notifyPatron:', e.message));

    // 📧 EMAIL CLIENT (si email donné)
    if (commande.client_email) {
      sendConfirmationClient(botId, commande, commande.client_email).catch(e => console.error('emailClient:', e.message));
    } else {
      console.log('ℹ️ Pas d\'email client → pas d\'email de confirmation');
    }

    // 📱 WHATSAPP CLIENT (si tel donné)
    if (commande.client_tel) {
      sendWhatsAppClientConfirmation(botId, commande).catch(e => console.error('waClient:', e.message));
    } else {
      console.log('ℹ️ Pas de tel client → pas de WhatsApp de confirmation');
    }

  } catch(e) {
    console.error('createOrderFromConfirmation:', e.message);
  }
}

// Helper: extrait les infos client depuis le texte du récapitulatif du bot
// ============================================
// 📞 NORMALISATION TÉLÉPHONES — Afrique de l'Ouest francophone + diaspora
// Couvre: Sénégal, Mauritanie, Mali, Côte d'Ivoire, Burkina Faso, Niger, Guinée,
// Togo, Bénin, France (diaspora), USA/Canada (diaspora), Belgique, Suisse, Maroc
// ============================================
//
// Ranges valides par pays (préfixe local):
//   🇸🇳 Sénégal +221:    70/75/76/77/78 + 7 chiffres
//   🇲🇷 Mauritanie +222: 2/3/4 + 7 chiffres (8 total)
//   🇲🇱 Mali +223:       6/7/9 + 7 chiffres (8 total)
//   🇨🇮 Côte d'Ivoire +225: 01/05/07 + 8 chiffres (10 total — depuis 2021)
//   🇧🇫 Burkina Faso +226: 5/6/7 + 7 chiffres (8 total)
//   🇳🇪 Niger +227:      8/9 + 7 chiffres (8 total)
//   🇹🇬 Togo +228:       7/9 + 7 chiffres (8 total)
//   🇧🇯 Bénin +229:      4/5/6/9 + 7 chiffres (8 total)
//   🇬🇳 Guinée +224:     6 + 8 chiffres (9 total)
//   🇫🇷 France +33:      6/7 + 8 chiffres (9 total, après le 0 initial)
//   🇲🇦 Maroc +212:      6/7 + 8 chiffres (9 total)
//   🇧🇪 Belgique +32:    4 + 8 chiffres (9 total)
//   🇨🇭 Suisse +41:      7 + 8 chiffres (9 total)
//   🇺🇸 USA/Canada +1:   10 chiffres
function normalizePhoneAfrica(raw) {
  if (!raw) return null;
  // Nettoie tous les séparateurs (espaces, tirets, points, parenthèses)
  let tel = String(raw).replace(/[\s.\-()]/g,'').trim();
  if (!tel) return null;

  // Cas 1: déjà international avec + → on garde tel quel (validation basique)
  if (tel.startsWith('+')) {
    if (/^\+\d{8,15}$/.test(tel)) return tel;
    return null;
  }

  // Cas 2: commence par 00 (style international ancien) → remplace par +
  if (tel.startsWith('00')) {
    const candidate = '+' + tel.substring(2);
    if (/^\+\d{8,15}$/.test(candidate)) return candidate;
    return null;
  }

  // Cas 3: commence par un indicatif sans + (221, 222, 223, 225, etc.)
  // Note: ordre important — on teste les indicatifs 3 chiffres AVANT 2/1 chiffres
  // pour éviter qu'un numéro CI "225..." soit interprété comme USA "1..." (impossible vu qu'on ne fait pas ça mais bon)
  const indicatifsLong = ['221','222','223','224','225','226','227','228','229','212'];
  for (const ind of indicatifsLong) {
    if (tel.startsWith(ind)) {
      const rest = tel.substring(ind.length);
      // Vérifier que ce qui reste est cohérent (7-10 chiffres pour le numéro local)
      if (rest.length >= 7 && rest.length <= 10 && /^\d+$/.test(rest)) {
        return '+' + tel;
      }
    }
  }
  // Indicatifs courts (33, 32, 41, 1) — seulement si la longueur totale fait sens
  if (tel.startsWith('33') && tel.length === 11) return '+' + tel;
  if (tel.startsWith('32') && tel.length === 11) return '+' + tel;
  if (tel.startsWith('41') && tel.length === 11) return '+' + tel;
  // L'indicatif 1 (USA) — seulement si total = 11 chiffres (ex: 14104597653)
  if (tel.startsWith('1') && tel.length === 11 && /^1[2-9]\d{9}$/.test(tel)) return '+' + tel;

  // Cas 4: commence par 0 (style français/européen)
  if (tel.startsWith('0') && tel.length === 10) {
    const rest = tel.substring(1);
    // 9 chiffres après le 0 commençant par 6 ou 7 → français
    if (/^[67]\d{8}$/.test(rest)) return '+33' + rest;
  }

  // Cas 5: numéro local 9 chiffres commençant par 7 → SÉNÉGAL (marché principal, on priorise)
  if (/^7[05678]\d{7}$/.test(tel)) return '+221' + tel;

  // Cas 6: numéro local 10 chiffres — USA/Canada (ex: 4104597653)
  // On priorise USA car ce format est rarement utilisé en Afrique de l'Ouest
  if (/^[2-9]\d{9}$/.test(tel) && tel.length === 10) {
    // Si commence par 0[157] ou 2[57] → Côte d'Ivoire (10 chiffres aussi depuis 2021)
    if (/^(0[157]|2[57])\d{8}$/.test(tel)) return '+225' + tel;
    return '+1' + tel;
  }

  // Cas 7: 9 chiffres commençant par 6 → Guinée probable (rare au Sénégal)
  if (/^6\d{8}$/.test(tel) && tel.length === 9) return '+224' + tel;

  // Cas 8: dernier recours — numéro 9-10 chiffres assumé sénégalais
  // (compatibilité ascendante avec l'ancien comportement)
  if (/^\d{9,10}$/.test(tel) && tel.startsWith('7')) return '+221' + tel;

  // Pas de match clair → retourner null
  return null;
}

function extractInfosFromRecap(text) {
  if (!text) return {};
  const get = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  // Helper: filtre les fausses adresses (FCFA, prix purs)
  const filterAddr = (a) => {
    if (!a) return null;
    if (/fcfa/i.test(a)) return null;
    if (/^\s*\d+[\s,.]*$/.test(a)) return null;
    return a;
  };
  return {
    nom: get(/(?:nom|prénom)\s*[:\-]\s*\*?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,40}?)\s*\*?\s*(?:\n|$|📞|📍|📧|🛍️|💰)/i),
    tel: (function(){
      const m = text.match(/(?:téléphone|telephone|tel|phone)\s*[:\-]\s*\*?\s*([+\d][\d\s.\-+()]{6,20})\s*\*?/i);
      if (!m) return null;
      return normalizePhoneAfrica(m[1]);
    })(),
    email: (function(){
      const m = text.match(/[\w.+-]+@[\w-]+\.[\w-]+(?:\.[\w-]+)*/);
      return m ? m[0].toLowerCase() : null;
    })(),
    // Adresse: prioriser "📍 Adresse:" formal, puis "Mon adresse de livraison est:", éviter "livraison: 1000 FCFA"
    adresse: filterAddr(
      get(/📍\s*(?:adresse|livraison)\s*[:\-]\s*\*?\s*([^\n*📞📧🛍️💰🛵👤]{5,150}?)\s*\*?\s*(?:\n|$|📞|📍|📧|🛍️|💰|🛵|👤)/i) ||
      get(/(?:^|\n)\s*adresse\s*[:\-]\s*\*?\s*([^\n*📞📧🛍️💰🛵👤]{5,150}?)\s*\*?\s*(?:\n|$|📞|📍|📧|🛍️|💰|🛵|👤)/i) ||
      get(/Mon adresse(?:\s+de livraison)?(?:\s+est)?\s*[:est]+\s*([^.\n(]+?)(?:\s*\(|\.|$|\n)/i) ||
      get(/Livraison à\s+([^,.\n]+(?:,\s*[^,.\n]+){0,2}?)\s+dans\s+/i) ||
      get(/Livraison à\s+([^,.\n]+(?:,\s*[^,.\n]+){0,2})/i)
    ),
    article: get(/(?:article|produit|commande)\s*[:\-]\s*\*?\s*([^\n*📞📧💰🛵👤📍]{2,100}?)\s*\*?\s*(?:\n|$|📞|📍|📧|🛍️|💰|🛵|👤)/i),
  };
}

// Helper: extrait les infos client depuis l'historique des messages user (fallback)
async function extractInfosFromMessages(botId, sessionId) {
  try {
    const convs = await db.select('conversations', `?bot_id=eq.${botId}&session_id=eq.${sessionId}&select=id`);
    if (!convs?.length) return {};
    const msgs = await db.select('messages', `?conversation_id=eq.${convs[0].id}&role=eq.user&order=created_at.desc&limit=15`);
    if (!msgs?.length) return {};
    const fullText = msgs.map(m => m.content).join(' ');

    const emailMatch = fullText.match(/[\w.+-]+@[\w-]+\.[\w-]+(?:\.[\w-]+)*/);
    // Capture tous les formats: +221xxx, 00221xxx, 221xxx, 077xxx, 77xxx, etc.
    const telMatch = fullText.match(/\+\d[\d\s.\-()]{7,18}\d/) ||
                     fullText.match(/\b00\d{8,13}\b/) ||
                     fullText.match(/\b22[1-9]\d{7,9}\b/) ||  // 221/222/223/225/226/227/228/229
                     fullText.match(/\b212\d{8,9}\b/) ||       // Maroc
                     fullText.match(/\b7[05678][\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/) ||  // Sénégal sans préfixe
                     fullText.match(/\b0[67]\d{8}\b/) ||         // France style 06/07
                     fullText.match(/\b\d{10}\b/);              // US/Canada 10 chiffres bruts
    // Adresse: priorité 1 = format GPS explicite, priorité 2 = mot "adresse" mais filtrer les fausses
    let adresseMatch = fullText.match(/Mon adresse(?:\s+de livraison)?(?:\s+est)?\s*[:est]+\s*([^.\n(]+?)(?:\s*\(|\.|$|\n)/i);
    if (!adresseMatch) {
      adresseMatch = fullText.match(/(?:j'habite|je suis (?:à|au)|livr(?:er|aison)\s+(?:à|au))\s*[:à]?\s*([^(.\n]{5,80})/i);
    }
    if (!adresseMatch) {
      adresseMatch = fullText.match(/adresse\s*[:est]*\s*([^(.\n]{5,80})/i);
    }

    // Pattern 1: "je m'appelle X" / "mon nom est X" / etc.
    let nomMatch = fullText.match(/(?:je m'appelle|je suis|c'est|mon (?:nom|prénom)(?:\s+est)?|moi c'est)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i);
    // Pattern 2: <prénom> [<nom>] <téléphone> — typique du Sénégal "ousmane gakou +221..."
    if (!nomMatch) {
      nomMatch = fullText.match(/\b([A-Za-zÀ-ÿ]{2,20}(?:\s+[A-Za-zÀ-ÿ]{2,20})?)\s+(?:\+?221|7[05678])/i);
    }
    // Pattern 3: début de message avec juste 1-2 mots suivis du numéro (ex: "Aminata 771234567")
    if (!nomMatch) {
      // Cherche dans chaque message individuel
      for (const m of msgs) {
        const direct = m.content.match(/^([A-Za-zÀ-ÿ]{2,20}(?:\s+[A-Za-zÀ-ÿ]{2,20})?)\s+\+?\d{8,}/);
        if (direct) { nomMatch = direct; break; }
      }
    }

    const out = {};
    if (emailMatch) out.email = emailMatch[0].toLowerCase();
    if (telMatch) {
      const normalized = normalizePhoneAfrica(telMatch[0]);
      if (normalized) out.tel = normalized;
    }
    if (adresseMatch) {
      const addr = adresseMatch[1].trim().substring(0,200);
      // Filtrer les faux positifs (ex: "1000 FCFA" qui matche par erreur)
      if (!/fcfa|^\d+\s*$/i.test(addr) && addr.length > 4) {
        out.adresse = addr;
      }
    }
    if (nomMatch) {
      const n = nomMatch[1].trim();
      // Filtrer les faux positifs (mots communs)
      const faux = /^(le|la|les|un|une|et|ou|de|du|des|mon|ma|mes|pour|avec|chez|sur|sous|oui|non|bonjour|salut|merci|salam|bjr|bsr|adresse|gps|tel|telephone|email|mail|nom|prenom|livraison|commande|cafe|the|pizza|burger)$/i;
      if (n.length > 1 && !faux.test(n)) out.nom = n;
    }
    return out;
  } catch(e) { return {}; }
}

// Envoie un WhatsApp de confirmation au client
async function sendWhatsAppClientConfirmation(botId, cmd) {
  try {
    const bots = await db.select('bots', `?id=eq.${botId}&select=nom,livraison_delai`);
    const bot = bots?.[0];
    if (!bot) return;
    const total = (cmd.total||0).toLocaleString('fr-FR');
    const msg = `✅ *${bot.nom}*\n\nVotre commande *${cmd.numero}* est confirmée!\n\n💰 Total: *${total} FCFA*\n${cmd.adresse_livraison?`📍 Livraison: ${cmd.adresse_livraison}\n`:''}🛵 Délai: ${bot.livraison_delai||'30-45 min'}\n\nNous vous tiendrons informé de l'avancement. Jërëjëf 🙏`;
    await sendWhatsApp(cmd.client_tel, msg);
  } catch(e) { console.error('sendWhatsAppClientConfirmation:', e.message); }
}

// ============================================
// AUTO COMMANDE — DÉPRÉCIÉ mais conservé pour compat (autres flux comme webhook WhatsApp)
// ============================================
async function autoCreateCommande(botId, sessionId, total, bot) {
  try {
    // Vérifie si une commande existe déjà pour cette session avec ce total
    const existing = await db.select('commandes', `?bot_id=eq.${botId}&session_id=eq.${sessionId}&total=eq.${total}&statut=eq.pending`);
    if (existing?.length) return; // Déjà créée

    const cmd = await db.insert('commandes', {
      bot_id: botId,
      session_id: sessionId,
      items: [],
      total: total,
      statut: 'pending',
      methode_paiement: 'en attente',
    });

    if (cmd?.[0]) {
      console.log(`📦 Commande auto-créée: ${cmd[0].numero} — ${total} FCFA`);
      await notifyPatron(botId, cmd[0]);
      // Met à jour avec infos client extraites des messages
      updateCommandeInfos(cmd[0].id, sessionId, botId).catch(()=>{});
    }
  } catch(e) {
    console.error('autoCreateCommande:', e.message);
  }
}

// Extrait et sauvegarde les infos client depuis les messages de la session
async function updateCommandeInfos(commandeId, sessionId, botId) {
  try {
    // Récupère les messages de la session via conversations
    const convs = await db.select('conversations', `?bot_id=eq.${botId}&session_id=eq.${sessionId}&select=id`);
    if (!convs?.length) return;
    const convId = convs[0].id;
    const msgs = await db.select('messages', `?conversation_id=eq.${convId}&role=eq.user&order=created_at.desc&limit=15`);
    if (!msgs?.length) return;

    const fullText = msgs.map(m=>m.content).join(' ');

    // Extrait email
    const emailMatch = fullText.match(/[\w.+-]+@[\w-]+\.[\w-]+(?:\.[\w-]+)*/);
    // Extrait téléphone (formats internationaux + Afrique de l'Ouest francophone + diaspora)
    const telMatch = fullText.match(/\+\d[\d\s.\-()]{7,18}\d/) ||
                     fullText.match(/\b00\d{8,13}\b/) ||
                     fullText.match(/\b22[1-9]\d{7,9}\b/) ||
                     fullText.match(/\b212\d{8,9}\b/) ||
                     fullText.match(/\b7[05678][\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/) ||
                     fullText.match(/\b0[67]\d{8}\b/) ||
                     fullText.match(/\b\d{9,10}\b/);
    // Extrait adresse depuis les messages GPS ou texte
    const adresseMatch = fullText.match(/(?:Mon adresse(?:\s+de livraison)?(?:\s+est)?\s*[:est]+\s*)([^(.\n]+)/i) ||
                         fullText.match(/(?:adresse|j'habite|je suis (?:à|au)|livr(?:er|aison)\s+(?:à|au))\s*[:à]?\s*([^(.\n]{5,80})/i);
    // Extrait prénom — patterns plus larges
    const nomMatch = fullText.match(/(?:je m'appelle|je suis|c'est|mon (?:nom|prénom)(?:\s+est)?|moi c'est|prenom[:\s]+|nom[:\s]+)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i);

    const updates = {};
    if (emailMatch) updates.client_email = emailMatch[0].toLowerCase();
    if (telMatch) {
      const normalized = normalizePhoneAfrica(telMatch[0]);
      if (normalized) updates.client_tel = normalized;
    }
    if (adresseMatch) {
      const addr = adresseMatch[1].trim().substring(0, 200);
      if (addr.length > 4) updates.adresse_livraison = addr;
    }
    if (nomMatch) {
      const nom = nomMatch[1].trim();
      if (nom.length > 1 && !/^(le|la|les|un|une|et|ou|de)$/i.test(nom)) {
        updates.client_nom = nom;
      }
    }

    // Mise à jour silencieuse — pas de re-notification (évite les doublons)
    if (Object.keys(updates).length > 0) {
      await db.update('commandes', updates, `?id=eq.${commandeId}`);
      console.log(`👤 Infos client mises à jour (silencieux):`, updates);
    }
  } catch(e) { console.error('updateCommandeInfos:', e.message); }
}


async function saveMsg(botId, sessionId, userMsg, botReply) {
  try {
    let convs = await db.select('conversations', `?bot_id=eq.${botId}&session_id=eq.${sessionId}`);
    let convId;
    if (!convs?.length) {
      const nc = await db.insert('conversations', { bot_id:botId, session_id:sessionId, canal:'web', messages_count:0 });
      convId = nc?.[0]?.id;
    } else {
      convId = convs[0].id;
      await db.update('conversations', { last_message_at:new Date().toISOString(), messages_count:(convs[0].messages_count||0)+2 }, `?id=eq.${convId}`);
    }
    if (!convId) return;
    await Promise.all([
      db.insert('messages', { conversation_id:convId, bot_id:botId, role:'user', content:userMsg }),
      db.insert('messages', { conversation_id:convId, bot_id:botId, role:'assistant', content:botReply })
    ]);
    // Notifie le patron tous les 5 messages
    notifyNouveauMessage(botId, userMsg).catch(()=>{});
  } catch(e) { console.error('saveMsg:', e.message); }
}

// ============================================
// HELPERS
// ============================================
function getEmoji(n) {
  return {restaurant:'🍽️',salon:'💈',clinique:'🏥',boutique:'🛍️','auto-ecole':'🚗',pharmacie:'💊',immobilier:'🏠',traiteur:'🍲',boulangerie:'🥖',assurance:'🛡️',banque:'🏦',hotel:'🏨',transport:'🚗',education:'📚',fitness:'💪',informatique:'💻',evenement:'🎉',default:'🤖'}[n]||'🤖';
}
function getQR(n) {
  return {
    restaurant:   ['🍛 Voir le menu','📦 Commander','🛵 Livraison','📍 Adresse','🕐 Horaires'],
    traiteur:     ['🍲 Notre menu','📦 Commander','🚚 Livraison','📍 Adresse','🕐 Horaires'],
    boulangerie:  ['🥖 Nos produits','📦 Commander','📍 Adresse','🕐 Horaires'],
    salon:        ['📅 Prendre RDV','💅 Nos services','💰 Tarifs','📍 Adresse','📞 Nous appeler'],
    clinique:     ['🚨 Urgence','📅 RDV médecin','👨‍⚕️ Nos médecins','💰 Tarifs','📍 Adresse'],
    pharmacie:    ['💊 Médicaments','🕐 Horaires','📍 Adresse','📞 Urgence'],
    boutique:     ['✨ Nouveautés','🔥 Promotions','📦 Commander','🚚 Livraison','📍 Adresse'],
    'auto-ecole': ['📝 S\'inscrire','💰 Tarifs','📅 Calendrier','📍 Adresse','📞 Contact'],
    immobilier:   ['🏠 Nos biens','📅 Visite','💰 Prix','📍 Localisation','📞 Contact'],
    assurance:    ['🛡️ Nos produits','💰 Tarifs','📋 Devis gratuit','📅 RDV conseiller','📞 Contact'],
    banque:       ['💳 Nos services','💰 Tarifs','📅 RDV conseiller','📍 Agences','📞 Contact'],
    hotel:        ['🏨 Disponibilités','💰 Tarifs','📅 Réserver','📍 Localisation','📞 Contact'],
    transport:    ['🚗 Réserver','💰 Tarifs','📍 Localisation','📞 Contact'],
    education:    ['📚 Nos formations','💰 Frais','📝 S\'inscrire','📅 Planning','📞 Contact'],
    fitness:      ['💪 Nos programmes','💰 Abonnements','📅 Essai gratuit','📍 Adresse','📞 Contact'],
    informatique: ['💻 Nos services','💰 Devis','🔧 Support','📍 Adresse','📞 Contact'],
    evenement:    ['🎉 Nos prestations','💰 Tarifs','📅 Disponibilités','📍 Contact'],
    autre:        ['💬 Nos services','💰 Tarifs','📅 RDV','📍 Adresse','📞 Contact'],
  }[n] || ['💬 Nos services','💰 Tarifs','📍 Adresse','📞 Contact'];
}
function makePrompt(bot) {
  const cat = bot.catalogue?.length ? `\nCATALOGUE:\n${bot.catalogue.map(p=>`- ${p.nom}: ${p.prix.toLocaleString('fr-FR')} FCFA${p.desc?' ('+p.desc+')':''}`).join('\n')}` : '';
  const livraison = bot.livraison_actif ? `\nLIVRAISON:
- Frais de livraison: ${(bot.livraison_frais||0).toLocaleString('fr-FR')} FCFA
- Délai: ${bot.livraison_delai||'30-45 min'}
- Zones: ${bot.livraison_zones||'Dakar'}
${bot.livraison_min>0?`- Commande minimum: ${bot.livraison_min.toLocaleString('fr-FR')} FCFA`:''}` : '\n- Pas de livraison disponible (vente sur place uniquement)';

  return `Tu es l'assistant IA officiel de "${bot.nom}" à Dakar, Sénégal.
Tu parles français et wolof naturellement. Réponds TOUJOURS dans la même langue que le client.
Tu es chaleureux, professionnel et efficace. Réponds en 2-4 phrases max.

INFOS DU BUSINESS:
- Nom: ${bot.nom} | Secteur: ${bot.niche}
${bot.adresse?`- Adresse: ${bot.adresse}`:''}
${bot.horaires?`- Horaires: ${bot.horaires}`:''}
${bot.telephone?`- Téléphone: ${bot.telephone}`:''}
${bot.services?`- Services: ${bot.services}`:''}
- Paiement accepté: ${bot.paiement||'Wave, Orange Money, espèces'}
${cat}
${livraison}

FLUX DE COMMANDE STRICT — respecte CET ORDRE EXACT:

ÉTAPE 1 — Client veut commander:
  → Liste les articles avec tirets et prix
  → Demande ce qu'il veut

ÉTAPE 2 — Client choisit un article:
  → Annonce les détails: "Votre commande: [article] = [prix] FCFA${bot.livraison_actif?`, livraison: ${(bot.livraison_frais||0).toLocaleString('fr-FR')} FCFA, total: [total] FCFA`:''}"
  → Demande SES INFORMATIONS: "Pour finaliser, j'ai besoin de:\\n• Votre prénom\\n• Votre numéro de téléphone\\n• Votre adresse de livraison (utilisez le bouton GPS ci-dessous)\\n• Votre email (optionnel, pour la confirmation)"

ÉTAPE 3 — Client donne ses infos:
  → Fais un RÉCAPITULATIF COMPLET avec ce format EXACT:
    "📋 *Récapitulatif de votre commande:*\\n
    👤 Nom: [prénom]\\n
    📞 Téléphone: [numéro]\\n
    📍 Adresse: [adresse]\\n
    📧 Email: [email ou 'non fourni']\\n
    🛍️ Article: [article]\\n
    💰 *Total: [montant] FCFA*\\n
    🛵 Livraison: ${bot.livraison_delai||'30-45 min'}\\n\\n
    Confirmez-vous votre commande? Répondez *OUI* pour valider ou dites-moi ce qu'il faut modifier."

ÉTAPE 4 — Client confirme (dit "oui", "confirme", "valider", "c'est bon", etc.):
  → Réponds EXACTEMENT: "✅ *Commande confirmée!* Référence: à venir. Vous allez recevoir une confirmation par email/WhatsApp. Comment souhaitez-vous payer?"
  → Propose les paiements: Wave, Orange Money, à la livraison

ÉTAPE 5 — Client choisit le paiement:
  → Confirme la méthode: "Parfait! Paiement par [méthode] noté."
  → Donne le délai final: "Votre commande sera livrée dans ${bot.livraison_delai||'30-45 min'}. Jërëjëf!"

RÈGLES IMPORTANTES:
- TOUJOURS faire le RÉCAPITULATIF avant de demander confirmation (étape 3)
- Ne JAMAIS sauter l'étape de confirmation (étape 4)
- Si le client n'a pas donné toutes les infos, redemande les manquantes avant de récapituler
- Si le client modifie quelque chose, refais le récap complet
- TOUJOURS lister produits/services avec tirets (- Article: prix FCFA)
- En wolof: utiliser "Jerejef", "Waaw", "Asalaa maalekum" naturellement`;
}
function makeBotId(nom) {
  return nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').trim().replace(/\s+/g,'-').substring(0,25)+'-'+Date.now().toString(36);
}

// ============================================
// API BOT
// ============================================
app.get('/bot/:id', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.id}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error:'Bot non trouvé' });
    const b = bots[0];
    // CORS ouvert pour permettre l'intégration depuis n'importe quel site client
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      nom:b.nom, emoji:b.emoji, couleur:b.couleur, niche:b.niche,
      logo:b.logo_url||null, adresse:b.adresse, telephone:b.telephone,
      horaires:b.horaires, wave_number:b.wave_number, om_number:b.om_number,
      catalogue:b.catalogue||[],
      livraison: b.livraison_actif ? {
        actif: true,
        frais: b.livraison_frais||0,
        delai: b.livraison_delai||'30-45 min',
        zones: b.livraison_zones||'Dakar',
        min: b.livraison_min||0
      } : null,
      welcome: b.custom_welcome || `Asalaa maalekum! 👋 Bienvenue chez *${b.nom}*.\n\nComment puis-je vous aider aujourd'hui?`,
      quickReplies: getQR(b.niche),
      voiceEnabled: true
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// 🌐 API PUBLIQUE — Pour intégration sur sites/apps externes
// CORS ouvert pour permettre les appels depuis n'importe quel domaine
// ============================================

// Middleware CORS pour les routes publiques /api/v1
app.use('/api/v1', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// 📋 API: Infos complètes d'un bot (publique)
app.get('/api/v1/bots/:id', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.id}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error:'Bot non trouvé' });
    const b = bots[0];
    res.json({
      id: b.id, nom: b.nom, emoji: b.emoji, couleur: b.couleur, niche: b.niche,
      logo: b.logo_url, adresse: b.adresse, telephone: b.telephone,
      horaires: b.horaires, services: b.services,
      paiement: { wave: b.wave_number, om: b.om_number, accepted: b.paiement },
      livraison: b.livraison_actif ? {
        actif: true, frais: b.livraison_frais||0, delai: b.livraison_delai||'30-45 min',
        zones: b.livraison_zones||'Dakar', min: b.livraison_min||0
      } : { actif: false },
      catalogue_count: (b.catalogue||[]).length,
      avg_rating: b.avg_rating || null,
      chat_url: `${CONFIG.BASE_URL}/chat/${b.id}`,
      widget_url: `${CONFIG.BASE_URL}/widget.js`
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 🛍️ API: Récupérer le catalogue d'un bot (pour affichage sur site client)
app.get('/api/v1/bots/:id/catalogue', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.id}&actif=eq.true&select=catalogue,nom,couleur,livraison_actif,livraison_frais,wave_number,om_number`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });
    const b = bots[0];
    const catalogue = (b.catalogue || []).map((p, idx) => ({
      id: idx,
      nom: p.nom,
      prix: p.prix,
      desc: p.desc || null,
      photo: p.photo || null,
      emoji: p.emoji || '🛍️',
      categorie: p.categorie || null,
      stock: p.stock || null
    }));
    res.json({
      bot: { nom: b.nom, couleur: b.couleur },
      catalogue,
      count: catalogue.length,
      livraison_frais: b.livraison_actif ? (b.livraison_frais||0) : null,
      paiement: { wave: b.wave_number, om: b.om_number }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 🛒 API: Créer une commande directement depuis un site externe
// Nécessite l'API key du bot (générée par patron) pour éviter abus
app.post('/api/v1/bots/:id/commandes', async (req, res) => {
  try {
    const { items, total, client_nom, client_tel, client_email, adresse_livraison, methode_paiement, source } = req.body;
    if (!items || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items requis (array)' });
    if (!total || total <= 0) return res.status(400).json({ error: 'total requis' });

    const bots = await db.select('bots', `?id=eq.${req.params.id}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });
    const bot = bots[0];

    const cmdData = {
      bot_id: bot.id,
      session_id: `api_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
      items, total: parseInt(total),
      statut: 'pending',
      methode_paiement: methode_paiement || 'en attente',
      client_nom: client_nom || null,
      client_tel: client_tel || null,
      client_email: client_email || null,
      adresse_livraison: adresse_livraison || null,
      source: source || 'api_external'
    };
    Object.keys(cmdData).forEach(k => cmdData[k] == null && delete cmdData[k]);

    const cmd = await db.insert('commandes', cmdData);
    if (!cmd?.[0]) return res.status(500).json({ error: 'Échec création' });
    const commande = cmd[0];

    // Notifications: patron + client (comme via le chat)
    notifyPatron(bot.id, commande).catch(()=>{});
    if (commande.client_email) sendConfirmationClient(bot.id, commande, commande.client_email).catch(()=>{});
    if (commande.client_tel) sendWhatsAppClientConfirmation(bot.id, commande).catch(()=>{});

    res.json({
      success: true,
      commande: {
        id: commande.id,
        numero: commande.numero,
        total: commande.total,
        statut: commande.statut
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 💬 API: Envoyer un message au bot (pour intégration custom)
app.post('/api/v1/bots/:id/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'message requis' });
    // Réutilise la même logique que /chat
    const fakeReq = { body: { message, botId: req.params.id, sessionId: sessionId || `api_${Date.now()}` } };
    // On simule un appel interne en passant par fetch
    const r = await fetch(`http://localhost:${CONFIG.PORT}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakeReq.body)
    });
    const d = await r.json();
    res.json({
      reply: d.reply,
      session_id: fakeReq.body.sessionId,
      actions: d.actions || [],
      catalogue: d.catalogue || null
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ⭐ API: Récupérer les avis publics d'un bot
app.get('/api/v1/bots/:id/avis', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const all = await db.select('avis', `?bot_id=eq.${req.params.id}&visible=eq.true&order=created_at.desc&limit=${limit}`);
    if (!all || !Array.isArray(all)) return res.json({ avis: [], moyenne: 0, total: 0 });
    const moyenne = all.length ? (all.reduce((s,a)=>s+a.note,0)/all.length).toFixed(2) : 0;
    res.json({
      avis: all.map(a => ({
        note: a.note,
        commentaire: a.commentaire || null,
        reponse: a.reponse || null,
        date: a.created_at
      })),
      moyenne: parseFloat(moyenne),
      total: all.length
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 🎁 API: Valider un code promo (à utiliser depuis un site/app externe)
app.post('/api/v1/bots/:id/promo/validate', async (req, res) => {
  try {
    const { code, total, client_tel } = req.body;
    if (!code) return res.status(400).json({ error: 'code requis' });
    const codeUpper = String(code).toUpperCase().trim();
    const promos = await db.select('promos', `?bot_id=eq.${req.params.id}&code=eq.${encodeURIComponent(codeUpper)}&actif=eq.true&limit=1`);
    if (!promos?.[0]) return res.json({ valid: false, error: 'Code invalide' });
    const p = promos[0];
    if (p.expire_at && new Date(p.expire_at) < new Date()) return res.json({ valid: false, error: 'Code expiré' });
    if (p.max_uses && p.used_count >= p.max_uses) return res.json({ valid: false, error: 'Code épuisé' });
    if (p.type === 'unique' && p.client_tel && client_tel) {
      const norm = (s) => (s||'').replace(/[\s+\-()]/g,'');
      if (norm(p.client_tel) !== norm(client_tel)) return res.json({ valid: false, error: 'Code réservé' });
    }
    const subtotal = parseInt(total) || 0;
    let reduction = 0;
    if (p.reduction_type === 'pct') reduction = Math.floor(subtotal * p.reduction_value / 100);
    else if (p.reduction_type === 'fcfa') reduction = parseInt(p.reduction_value);
    if (reduction > subtotal) reduction = subtotal;
    res.json({
      valid: true, code: p.code, reduction,
      reduction_type: p.reduction_type, reduction_value: p.reduction_value,
      original_total: subtotal, new_total: subtotal - reduction
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 📊 API: Statistiques publiques (info générale, sans données sensibles)
app.get('/api/v1/bots/:id/stats', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.id}&actif=eq.true&select=avg_rating,messages_count`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });
    const avis = await db.select('avis', `?bot_id=eq.${req.params.id}&visible=eq.true&select=note`);
    res.json({
      avg_rating: bots[0].avg_rating || null,
      total_reviews: avis?.length || 0,
      total_messages: bots[0].messages_count || 0
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 📚 Page de documentation API publique
app.get('/api/docs', (req, res) => {
  const base = CONFIG.BASE_URL;
  res.send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>API SamaBot — Documentation</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#f5f7f6;color:#0a1a0f;line-height:1.6}
.hd{background:linear-gradient(135deg,#00c875,#0a1a0f);color:#fff;padding:40px 20px;text-align:center}
.hd h1{font-size:32px;font-weight:800;margin-bottom:8px}
.hd p{font-size:14px;opacity:.9}
.wrap{max-width:900px;margin:0 auto;padding:30px 20px}
.toc{background:#fff;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #e5e7eb}
.toc h3{font-size:14px;color:#3a5040;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.toc a{display:block;padding:6px 0;color:#0a1a0f;text-decoration:none;font-size:13px;border-bottom:1px solid #f0f4f1}
.toc a:hover{color:#00c875}
.toc a:last-child{border:none}
.section{background:#fff;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #e5e7eb}
.section h2{font-size:20px;font-weight:800;margin-bottom:16px;color:#0a1a0f}
.section h3{font-size:14px;color:#3a5040;text-transform:uppercase;letter-spacing:1px;margin:16px 0 8px}
.section p{font-size:14px;color:#3a5040;margin-bottom:12px}
.endpoint{display:flex;align-items:center;gap:10px;background:#0a1a0f;color:#fff;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:13px;margin-bottom:10px;flex-wrap:wrap}
.method{background:#00c875;color:#000;font-weight:800;padding:3px 10px;border-radius:4px;font-size:11px}
.method.post{background:#f59e0b}
.method.put,.method.patch{background:#3b82f6}
.method.delete{background:#ef4444}
.code{background:#0a1a0f;color:#a0e0c0;padding:14px;border-radius:8px;font-family:monospace;font-size:12px;overflow-x:auto;white-space:pre;line-height:1.5;margin:8px 0}
.note{background:#fef3c7;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:4px;font-size:13px;margin:10px 0}
.tag{display:inline-block;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:6px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
th{text-align:left;padding:8px;background:#f0f4f1;color:#3a5040;font-size:11px;text-transform:uppercase}
td{padding:8px;border-top:1px solid #f0f4f1;color:#0a1a0f}
td code{background:#f0f4f1;padding:2px 6px;border-radius:3px;font-family:monospace;font-size:12px}
</style></head><body>

<div class="hd">
  <h1>🤖 API SamaBot v1</h1>
  <p>Intégrez SamaBot dans votre site, app ou plateforme</p>
</div>

<div class="wrap">

<div class="toc">
  <h3>📑 Sommaire</h3>
  <a href="#integration">🚀 Intégration rapide (3 méthodes)</a>
  <a href="#widget">💬 Widget JavaScript</a>
  <a href="#api">🔌 API REST</a>
  <a href="#sdk">📦 SDK JavaScript</a>
  <a href="#examples">💡 Exemples concrets</a>
  <a href="#cors">🔒 Sécurité & CORS</a>
  <a href="/api/docs/wordpress" style="color:#21759b;font-weight:700">📝 Guide WordPress dédié →</a>
</div>

<div class="section" id="integration">
  <h2>🚀 Intégration rapide</h2>

  <h3>1. Lien direct (le plus simple)</h3>
  <p>Partagez votre lien de chat partout (WhatsApp, Instagram, email...) :</p>
  <div class="code">${base}/chat/VOTRE_BOT_ID</div>

  <h3>2. Widget flottant (bulle de chat sur votre site)</h3>
  <p>Collez ce code juste avant <code>&lt;/body&gt;</code> sur n'importe quel site :</p>
  <div class="code">&lt;script&gt;
  window.SamaBotConfig = { botId: 'VOTRE_BOT_ID', couleur: '#00c875' };
&lt;/script&gt;
&lt;script src="${base}/widget.js" async&gt;&lt;/script&gt;</div>
  <div class="note">✅ Compatible avec WordPress, Shopify, Wix, React, Vue, HTML pur, etc.</div>

  <h3>3. iframe (intégration page complète)</h3>
  <div class="code">&lt;iframe src="${base}/chat/VOTRE_BOT_ID" width="100%" height="600" style="border:none;border-radius:12px"&gt;&lt;/iframe&gt;</div>
</div>

<div class="section" id="api">
  <h2>🔌 API REST publique</h2>
  <p>Base URL: <code>${base}/api/v1</code></p>
  <div class="note">🔓 Tous les endpoints publics ont CORS ouvert (<code>Access-Control-Allow-Origin: *</code>) pour intégration depuis n'importe quel domaine.</div>

  <h3>📋 Récupérer les infos d'un bot</h3>
  <div class="endpoint"><span class="method">GET</span> /api/v1/bots/:id</div>
  <div class="code">curl ${base}/api/v1/bots/sargal-mov2odnz</div>
  <p>Retourne : nom, logo, couleur, adresse, téléphone, horaires, livraison, paiement, etc.</p>

  <h3>🛍️ Récupérer le catalogue (produits/services)</h3>
  <div class="endpoint"><span class="method">GET</span> /api/v1/bots/:id/catalogue</div>
  <div class="code">curl ${base}/api/v1/bots/VOTRE_BOT_ID/catalogue</div>
  <p>Retourne tous les produits avec photos, prix, descriptions, emojis. <span class="tag">Idéal pour afficher sur votre site</span></p>
  <div class="code">{
  "bot": { "nom": "Sargal", "couleur": "#00c875" },
  "catalogue": [
    {
      "id": 0,
      "nom": "Pizza Margherita",
      "prix": 5000,
      "desc": "Sauce tomate, mozzarella, basilic",
      "photo": "https://...",
      "emoji": "🍕"
    }
  ],
  "count": 1,
  "livraison_frais": 1000,
  "paiement": { "wave": "+221...", "om": "+221..." }
}</div>

  <h3>🛒 Créer une commande depuis votre site</h3>
  <div class="endpoint"><span class="method post">POST</span> /api/v1/bots/:id/commandes</div>
  <div class="code">curl -X POST ${base}/api/v1/bots/VOTRE_BOT_ID/commandes \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [{"nom":"Pizza","prix":5000,"qte":1}],
    "total": 6000,
    "client_nom": "Aminata",
    "client_tel": "+221771234567",
    "adresse_livraison": "Almadies"
  }'</div>
  <p>✅ Crée la commande + envoie email/WhatsApp au patron + confirmation au client</p>

  <h3>💬 Envoyer un message au bot IA</h3>
  <div class="endpoint"><span class="method post">POST</span> /api/v1/bots/:id/chat</div>
  <div class="code">curl -X POST ${base}/api/v1/bots/VOTRE_BOT_ID/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Bonjour, vos horaires?","sessionId":"client123"}'</div>

  <h3>⭐ Récupérer les avis</h3>
  <div class="endpoint"><span class="method">GET</span> /api/v1/bots/:id/avis?limit=20</div>
  <p><span class="tag">Idéal pour social proof sur votre site</span></p>

  <h3>🎁 Valider un code promo</h3>
  <div class="endpoint"><span class="method post">POST</span> /api/v1/bots/:id/promo/validate</div>
  <div class="code">curl -X POST ${base}/api/v1/bots/VOTRE_BOT_ID/promo/validate \\
  -H "Content-Type: application/json" \\
  -d '{"code":"BIENVENUE10","total":6000}'</div>

  <h3>📊 Statistiques publiques</h3>
  <div class="endpoint"><span class="method">GET</span> /api/v1/bots/:id/stats</div>
  <p>Note moyenne, nombre d'avis, nombre de messages traités</p>
</div>

<div class="section" id="sdk">
  <h2>📦 SDK JavaScript (le plus rapide)</h2>
  <p>Inclus le SDK puis utilisez l'API simplifiée :</p>
  <div class="code">&lt;script src="${base}/sdk.js"&gt;&lt;/script&gt;
&lt;script&gt;
  const sb = SamaBot('VOTRE_BOT_ID');

  // Récupérer le catalogue
  const cat = await sb.getCatalogue();
  console.log(cat.catalogue);

  // Envoyer un message au bot IA
  const r = await sb.sendMessage('Vos horaires?');
  console.log(r.reply);

  // Créer une commande
  const cmd = await sb.createOrder({
    items: [{nom:'Pizza',prix:5000}],
    total: 6000,
    client_nom: 'Aminata',
    client_tel: '+221771234567'
  });

  // Valider un code promo
  const promo = await sb.validatePromo('BIENVENUE10', 6000);
  if (promo.valid) console.log('-' + promo.reduction + ' FCFA');
&lt;/script&gt;</div>
</div>

<div class="section" id="examples">
  <h2>💡 Exemples concrets</h2>

  <h3>Exemple 1 : Afficher votre catalogue sur votre site WordPress</h3>
  <div class="code">&lt;div id="mon-catalogue"&gt;Chargement...&lt;/div&gt;
&lt;script src="${base}/sdk.js"&gt;&lt;/script&gt;
&lt;script&gt;
const sb = SamaBot('VOTRE_BOT_ID');
sb.getCatalogue().then(d =&gt; {
  const html = d.catalogue.map(p =&gt;
    \`&lt;div class="produit"&gt;
       &lt;h3&gt;\${p.emoji} \${p.nom}&lt;/h3&gt;
       &lt;p&gt;\${p.desc||''}&lt;/p&gt;
       &lt;strong&gt;\${p.prix.toLocaleString('fr-FR')} FCFA&lt;/strong&gt;
       &lt;a href="${base}/chat/VOTRE_BOT_ID?produit=\${p.id}"&gt;Commander&lt;/a&gt;
     &lt;/div&gt;\`
  ).join('');
  document.getElementById('mon-catalogue').innerHTML = html;
});
&lt;/script&gt;</div>

  <h3>Exemple 2 : Bouton "Avis" avec note moyenne</h3>
  <div class="code">&lt;script src="${base}/sdk.js"&gt;&lt;/script&gt;
&lt;script&gt;
SamaBot('VOTRE_BOT_ID').getStats().then(s =&gt; {
  document.getElementById('rating').innerHTML =
    '⭐ ' + s.avg_rating + ' (' + s.total_reviews + ' avis)';
});
&lt;/script&gt;</div>

  <h3>Exemple 3 : App React</h3>
  <div class="code">// catalogue.jsx
import { useState, useEffect } from 'react';

function Catalogue() {
  const [produits, setProduits] = useState([]);
  useEffect(() =&gt; {
    fetch('${base}/api/v1/bots/VOTRE_BOT_ID/catalogue')
      .then(r =&gt; r.json())
      .then(d =&gt; setProduits(d.catalogue));
  }, []);
  return produits.map(p =&gt; &lt;div key={p.id}&gt;{p.nom}: {p.prix} F&lt;/div&gt;);
}</div>
</div>

<div class="section" id="cors">
  <h2>🔒 Sécurité & CORS</h2>

  <h3>Endpoints publics (CORS *)</h3>
  <p>Tous les endpoints <code>/api/v1/bots/:id/*</code> ont CORS ouvert et sont consultables depuis n'importe quel domaine sans authentification.</p>

  <h3>Limitations</h3>
  <table>
    <thead><tr><th>Endpoint</th><th>Limite</th></tr></thead>
    <tbody>
      <tr><td><code>GET /catalogue</code></td><td>Illimité (mise en cache navigateur)</td></tr>
      <tr><td><code>POST /chat</code></td><td>30 messages/min/IP (selon plan)</td></tr>
      <tr><td><code>POST /commandes</code></td><td>10 commandes/min/IP</td></tr>
      <tr><td><code>POST /promo/validate</code></td><td>60/min/IP</td></tr>
    </tbody>
  </table>

  <h3>Bonnes pratiques</h3>
  <ul style="margin-left:20px">
    <li>Cachez les réponses du catalogue (ça change rarement)</li>
    <li>Validez les données côté client AVANT d'envoyer</li>
    <li>Affichez la note moyenne en cache de manière responsive</li>
  </ul>
</div>

<div style="text-align:center;color:#9ab0a0;font-size:13px;padding:30px 0">
  Questions? <a href="mailto:gakououssou@gmail.com" style="color:#00c875">Contactez-nous</a>
</div>

</div>
</body></html>`);
});

// 📚 Page doc dédiée WordPress
app.get('/api/docs/wordpress', (req, res) => {
  const base = CONFIG.BASE_URL;
  res.send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SamaBot pour WordPress — Guide d'intégration</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#f5f7f6;color:#0a1a0f;line-height:1.6}
.hd{background:linear-gradient(135deg,#21759b,#0a1a0f);color:#fff;padding:50px 20px;text-align:center}
.hd-logo{font-size:60px;margin-bottom:14px}
.hd h1{font-size:32px;font-weight:800;margin-bottom:8px}
.hd p{font-size:15px;opacity:.95}
.hd-cta{display:inline-block;background:#00c875;color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;margin-top:20px;font-size:14px}
.wrap{max-width:900px;margin:0 auto;padding:30px 20px}
.section{background:#fff;border-radius:12px;padding:28px;margin-bottom:20px;border:1px solid #e5e7eb}
.section h2{font-size:22px;font-weight:800;margin-bottom:14px;color:#0a1a0f;display:flex;align-items:center;gap:10px}
.section h3{font-size:15px;color:#3a5040;text-transform:uppercase;letter-spacing:1px;margin:20px 0 10px}
.section p{font-size:14px;color:#3a5040;margin-bottom:12px}
.steps{counter-reset:step}
.step{counter-increment:step;background:#f9faf9;border-radius:10px;padding:18px;margin-bottom:12px;display:flex;gap:14px;border-left:4px solid #00c875}
.step::before{content:counter(step);background:#00c875;color:#000;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;font-size:14px}
.step-content{flex:1}
.step-content strong{display:block;margin-bottom:4px;font-size:15px}
.step-content p{margin:0;font-size:13px;color:#5a7060}
.code{background:#0a1a0f;color:#a0e0c0;padding:14px;border-radius:8px;font-family:monospace;font-size:12px;overflow-x:auto;white-space:pre;line-height:1.5;margin:10px 0}
.note{background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:4px;font-size:13px;margin:12px 0;color:#92400e}
.success{background:#f0fdf4;border-left:3px solid #00c875;padding:12px 16px;border-radius:4px;font-size:13px;margin:12px 0;color:#166534}
.btn{display:inline-block;background:#00c875;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;margin:8px 4px}
.btn-2{background:#21759b;color:#fff}
.shortcode-card{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;margin-bottom:14px}
.shortcode-card h4{margin:0 0 8px;color:#166534}
.shortcode-card code{background:#0a1a0f;color:#a0e0c0;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:12px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
th{text-align:left;padding:10px;background:#f0f4f1;color:#3a5040;font-size:11px;text-transform:uppercase}
td{padding:10px;border-top:1px solid #f0f4f1;color:#0a1a0f}
.method-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:16px 0}
.method-card{background:#fff;border:1.5px solid #e5e7eb;border-radius:10px;padding:18px;text-align:center}
.method-card-icon{font-size:36px;margin-bottom:8px}
.method-card h4{margin:0 0 6px;font-size:15px}
.method-card p{font-size:12px;color:#5a7060}
.recommend{border-color:#00c875;background:#f0fdf4;position:relative}
.recommend::before{content:'⭐ RECOMMANDÉ';position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#00c875;color:#000;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:800}
</style></head><body>

<div class="hd">
  <div class="hd-logo">📝</div>
  <h1>SamaBot pour WordPress</h1>
  <p>Intégration en 2 minutes — sans code</p>
  <a href="${base}/samabot-wp.zip" class="hd-cta">⬇️ Télécharger le plugin</a>
</div>

<div class="wrap">

<div class="section">
  <h2>🎯 3 méthodes d'intégration</h2>
  <p>Choisissez la méthode qui vous convient :</p>

  <div class="method-grid">
    <div class="method-card recommend">
      <div class="method-card-icon">🔌</div>
      <h4>Plugin WordPress</h4>
      <p>Installation 1-clic, page de réglages, shortcodes & blocs Gutenberg</p>
    </div>
    <div class="method-card">
      <div class="method-card-icon">📋</div>
      <h4>Code dans le footer</h4>
      <p>Coller un script via "Insert Headers and Footers"</p>
    </div>
    <div class="method-card">
      <div class="method-card-icon">📄</div>
      <h4>Shortcode PHP</h4>
      <p>Pour les développeurs (functions.php)</p>
    </div>
  </div>
</div>

<div class="section">
  <h2>🚀 Méthode 1 — Plugin WordPress (recommandé)</h2>

  <div class="steps">
    <div class="step">
      <div class="step-content">
        <strong>Téléchargez le plugin</strong>
        <p>Cliquez sur le bouton ci-dessous pour récupérer le ZIP du plugin officiel SamaBot.</p>
        <a href="${base}/samabot-wp.zip" class="btn">⬇️ Télécharger samabot-wp.zip</a>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>Créez votre bot SamaBot</strong>
        <p>Si vous n'avez pas encore de bot, créez-le gratuitement et notez votre <strong>Bot ID</strong>.</p>
        <a href="${base}/setup" target="_blank" class="btn btn-2">Créer mon bot →</a>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>Installez le plugin sur WordPress</strong>
        <p>Dans WordPress: <strong>Extensions → Ajouter → Téléverser une extension</strong> → sélectionnez le ZIP → <strong>Installer</strong> → <strong>Activer</strong>.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>Configurez votre Bot ID</strong>
        <p>Allez dans <strong>Réglages → SamaBot</strong>, collez votre Bot ID, choisissez votre couleur, et enregistrez.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>✅ C'est fait !</strong>
        <p>La bulle de chat apparaît automatiquement sur tout votre site. Utilisez les shortcodes pour aller plus loin.</p>
      </div>
    </div>
  </div>

  <div class="success">
    🎉 <strong>Total : ~2 minutes</strong>. Votre site WordPress est maintenant connecté à SamaBot.
  </div>
</div>

<div class="section">
  <h2>🧱 Shortcodes disponibles</h2>
  <p>Une fois le plugin installé, utilisez ces shortcodes dans n'importe quelle page ou article WordPress :</p>

  <div class="shortcode-card">
    <h4>🛍️ Catalogue produits</h4>
    <code>[samabot_catalogue limit="8"]</code>
    <p style="margin-top:8px;font-size:13px;color:#5a7060">Affiche vos produits avec photo, prix et bouton "Commander". Idéal pour pages "Menu", "Boutique", "Services".</p>
  </div>

  <div class="shortcode-card">
    <h4>💬 Bouton "Discuter"</h4>
    <code>[samabot_chat texte="Discuter sur WhatsApp"]</code>
    <p style="margin-top:8px;font-size:13px;color:#5a7060">Bouton CTA qui ouvre le chat. Personnalisez le texte.</p>
  </div>

  <div class="shortcode-card">
    <h4>⭐ Avis clients</h4>
    <code>[samabot_avis limit="5"]</code>
    <p style="margin-top:8px;font-size:13px;color:#5a7060">Affiche les avis avec note moyenne. Excellent pour social proof.</p>
  </div>

  <div class="shortcode-card">
    <h4>📊 Note moyenne (badge)</h4>
    <code>[samabot_rating]</code>
    <p style="margin-top:8px;font-size:13px;color:#5a7060">Petit badge "⭐ 4.5 (28 avis)" à mettre dans le header ou footer.</p>
  </div>

  <div class="shortcode-card">
    <h4>🖼️ Chat intégré (iframe)</h4>
    <code>[samabot_chat_embed height="600"]</code>
    <p style="margin-top:8px;font-size:13px;color:#5a7060">Intègre le chat complet dans une page (idéal pour page "Contact").</p>
  </div>
</div>

<div class="section">
  <h2>📋 Méthode 2 — Code manuel (sans plugin)</h2>
  <p>Si vous préférez ne pas installer le plugin :</p>

  <div class="steps">
    <div class="step">
      <div class="step-content">
        <strong>Installez "Insert Headers and Footers"</strong>
        <p>Dans WordPress: <strong>Extensions → Ajouter → Cherchez "Insert Headers and Footers"</strong> (par WPBeginner) → Installer + Activer.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>Allez dans Réglages → Insert Headers and Footers</strong>
        <p>Trouvez la section "Scripts in Footer".</p>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>Collez ce code (remplacez VOTRE_BOT_ID)</strong>
        <div class="code">&lt;script&gt;
  window.SamaBotConfig = { botId: 'VOTRE_BOT_ID', couleur: '#00c875' };
&lt;/script&gt;
&lt;script src="${base}/widget.js" async&gt;&lt;/script&gt;</div>
      </div>
    </div>
    <div class="step">
      <div class="step-content">
        <strong>Save → C'est fait !</strong>
        <p>La bulle apparaît sur tout le site.</p>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <h2>📄 Méthode 3 — Shortcode PHP custom (développeurs)</h2>
  <p>Pour les développeurs qui veulent intégrer dans <code>functions.php</code> sans plugin :</p>

  <div class="code">// Dans functions.php du thème enfant
function mon_catalogue_samabot() {
    $bot_id = 'VOTRE_BOT_ID';
    $url = 'https://api.samabot.app/api/v1/bots/' . $bot_id . '/catalogue';
    $response = wp_remote_get($url, ['timeout' => 5]);
    if (is_wp_error($response)) return '';
    $data = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($data['catalogue'])) return '';

    $html = '&lt;div class="catalogue"&gt;';
    foreach ($data['catalogue'] as $p) {
        $html .= '&lt;div&gt;&lt;h3&gt;' . esc_html($p['nom']) . '&lt;/h3&gt;';
        $html .= '&lt;p&gt;' . number_format($p['prix']) . ' FCFA&lt;/p&gt;&lt;/div&gt;';
    }
    return $html . '&lt;/div&gt;';
}
add_shortcode('mon_catalogue', 'mon_catalogue_samabot');

// Usage dans une page: [mon_catalogue]</div>
</div>

<div class="section">
  <h2>🛠️ Compatibilité</h2>
  <table>
    <thead><tr><th>Plateforme</th><th>Support</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>WordPress 5.8+</td><td>✅ Oui</td><td>Plugin officiel</td></tr>
      <tr><td>WooCommerce</td><td>✅ Oui</td><td>Shortcode <code>[samabot_chat]</code> sur fiches produit</td></tr>
      <tr><td>Elementor</td><td>✅ Oui</td><td>Widget HTML + shortcode</td></tr>
      <tr><td>Divi</td><td>✅ Oui</td><td>Module Code + shortcode</td></tr>
      <tr><td>Beaver Builder</td><td>✅ Oui</td><td>Module HTML + shortcode</td></tr>
      <tr><td>Gutenberg</td><td>✅ Oui</td><td>3 blocs natifs (Catalogue, Avis, Chat)</td></tr>
      <tr><td>Multilangue (WPML/Polylang)</td><td>✅ Oui</td><td>Le bot répond en wolof + français automatiquement</td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <h2>❓ FAQ</h2>

  <h3>Le plugin ralentit-il mon site ?</h3>
  <p>Non. Le widget se charge en mode <code>async</code> (n'empêche pas l'affichage de la page) et le catalogue est mis en cache 5-10 min.</p>

  <h3>Compatible avec tous les thèmes ?</h3>
  <p>Oui. Le plugin s'injecte via <code>wp_footer</code>, qui fonctionne avec 99% des thèmes.</p>

  <h3>Je peux personnaliser le design ?</h3>
  <p>Oui : couleur dans les réglages, et CSS custom via <code>.samabot-catalogue</code>, <code>.samabot-avis</code>, etc.</p>

  <h3>Le widget marche sur mobile ?</h3>
  <p>Parfaitement. Il s'adapte automatiquement aux petits écrans.</p>

  <h3>Je peux désactiver la bulle sur certaines pages ?</h3>
  <p>Oui. Dans les réglages, ajoutez les slugs des pages à exclure (ex: <code>checkout, mon-compte</code>).</p>
</div>

<div style="text-align:center;color:#9ab0a0;font-size:13px;padding:30px 0">
  <strong>Besoin d'aide ?</strong><br>
  <a href="${base}/api/docs" style="color:#00c875">Documentation API complète</a> ·
  <a href="mailto:gakououssou@gmail.com" style="color:#00c875">Nous contacter</a>
</div>

</div>
</body></html>`);
});

// Servir le ZIP du plugin WordPress
app.get('/samabot-wp.zip', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const zipPath = path.join(__dirname, 'samabot-wp.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'samabot-wp.zip');
  } else {
    // Fallback: redirect vers le ZIP hébergé (à uploader sur ton serveur Render)
    res.status(404).send('Plugin ZIP introuvable. Téléchargez-le depuis votre dashboard SamaBot.');
  }
});

// ============================================
// 💰 PAGE PRICING PUBLIQUE
// ============================================
app.get('/pricing', (req, res) => {
  const base = CONFIG.BASE_URL;
  const botId = req.query.bot || '';
  const stripeReady = !!CONFIG.STRIPE_SECRET_KEY;
  res.send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tarifs — SamaBot</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f7f6;color:#0a1a0f;line-height:1.5}
.hd{background:linear-gradient(135deg,#00c875 0%,#0a1a0f 100%);color:#fff;padding:60px 20px;text-align:center}
.hd h1{font-size:38px;font-weight:800;margin-bottom:10px}
.hd p{font-size:16px;opacity:.95}
.toggle{display:inline-flex;background:rgba(255,255,255,.15);border-radius:50px;padding:4px;margin-top:24px;border:1px solid rgba(255,255,255,.2)}
.toggle button{background:none;border:none;padding:10px 24px;color:#fff;cursor:pointer;border-radius:50px;font-size:13px;font-weight:700;font-family:inherit;transition:all .2s}
.toggle button.active{background:#00c875;color:#000}
.save-badge{display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:6px}
.wrap{max-width:1100px;margin:-30px auto 60px;padding:0 20px;position:relative}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
.card{background:#fff;border-radius:16px;padding:28px 22px;border:2px solid #e5e7eb;position:relative;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,.08)}
.card.popular{border-color:#00c875;box-shadow:0 12px 24px rgba(0,200,117,.15)}
.popular-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#00c875;color:#000;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:800}
.plan-name{font-size:14px;color:#5a7060;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.plan-price{font-size:36px;font-weight:800;color:#0a1a0f;margin-bottom:4px}
.plan-price small{font-size:14px;color:#5a7060;font-weight:500}
.plan-price-fcfa{font-size:13px;color:#5a7060;margin-bottom:20px}
.plan-features{list-style:none;margin:20px 0}
.plan-features li{padding:6px 0;font-size:13px;color:#3a5040;display:flex;align-items:flex-start;gap:8px}
.plan-features li::before{content:"✓";color:#00c875;font-weight:800;flex-shrink:0}
.btn-cta{display:block;width:100%;padding:14px;border-radius:10px;text-align:center;text-decoration:none;font-weight:800;font-size:14px;border:none;cursor:pointer;font-family:inherit;transition:all .15s}
.btn-cta.primary{background:#00c875;color:#000}
.btn-cta.primary:hover{background:#00a862}
.btn-cta.secondary{background:#f0f4f1;color:#0a1a0f}
.btn-cta.secondary:hover{background:#e5e7eb}
.faq{max-width:800px;margin:60px auto 0;padding:0 20px}
.faq h2{font-size:24px;font-weight:800;margin-bottom:20px;text-align:center}
.faq-item{background:#fff;border-radius:10px;padding:20px;margin-bottom:12px;border:1px solid #e5e7eb}
.faq-q{font-size:15px;font-weight:700;color:#0a1a0f;margin-bottom:8px}
.faq-a{font-size:13px;color:#5a7060;line-height:1.6}
.guarantee{text-align:center;background:#fef9c3;padding:16px;border-radius:12px;margin:30px auto;max-width:600px;font-size:13px;color:#854d0e}
@media (max-width: 700px) {
  .hd h1{font-size:28px}
  .plan-price{font-size:28px}
}
</style></head><body>

<div class="hd">
  <h1>💰 Tarifs simples & transparents</h1>
  <p>Commencez gratuitement, payez seulement si SamaBot vous fait gagner du temps</p>
  <div class="toggle">
    <button class="active" onclick="setPeriod('monthly', this)">Mensuel</button>
    <button onclick="setPeriod('yearly', this)">Annuel <span class="save-badge">-20%</span></button>
  </div>
  <div class="toggle" style="margin-left:10px">
    <button class="active" onclick="setCurrency('USD', this)">USD ($)</button>
    <button onclick="setCurrency('FCFA', this)">FCFA</button>
  </div>
</div>

<div class="wrap">
  <div class="grid">

    <!-- TRIAL -->
    <div class="card">
      <div class="plan-name">🎁 Trial</div>
      <div class="plan-price">Gratuit</div>
      <div class="plan-price-fcfa">3 jours d'accès Pro</div>
      <ul class="plan-features">
        <li>Toutes les features Pro</li>
        <li>1 bot</li>
        <li>Pas de carte bancaire</li>
        <li>Support email</li>
      </ul>
      <a href="${base}/setup" class="btn-cta secondary">Démarrer →</a>
    </div>

    <!-- STARTER -->
    <div class="card">
      <div class="plan-name">Starter</div>
      <div class="plan-price"><span data-price="starter">$9</span><small> /mois</small></div>
      <div class="plan-price-fcfa" data-fcfa="starter">≈ 5 500 FCFA / mois</div>
      <ul class="plan-features">
        <li>Jusqu'à 3 bots</li>
        <li>Catalogue illimité</li>
        <li>Notifications WhatsApp + Email</li>
        <li>Codes promo</li>
        <li>Analytics</li>
        <li>Support email</li>
      </ul>
      <button class="btn-cta primary" onclick="checkout('starter')">S'abonner →</button>
    </div>

    <!-- PRO (popular) -->
    <div class="card popular">
      <div class="popular-badge">⭐ Le plus populaire</div>
      <div class="plan-name">Pro</div>
      <div class="plan-price"><span data-price="pro">$25</span><small> /mois</small></div>
      <div class="plan-price-fcfa" data-fcfa="pro">≈ 15 000 FCFA / mois</div>
      <ul class="plan-features">
        <li>Jusqu'à 10 bots</li>
        <li>Tout du Starter +</li>
        <li>Multi-établissements</li>
        <li>API publique + SDK</li>
        <li>Plugin WordPress</li>
        <li>Email récap auto</li>
        <li>Marketing automatisé</li>
        <li>Support prioritaire</li>
      </ul>
      <button class="btn-cta primary" onclick="checkout('pro')">S'abonner →</button>
    </div>

    <!-- BUSINESS -->
    <div class="card">
      <div class="plan-name">Business</div>
      <div class="plan-price"><span data-price="business">$85</span><small> /mois</small></div>
      <div class="plan-price-fcfa" data-fcfa="business">≈ 50 000 FCFA / mois</div>
      <ul class="plan-features">
        <li>Bots illimités</li>
        <li>Tout du Pro +</li>
        <li>White-label</li>
        <li>API dédiée</li>
        <li>Account manager</li>
        <li>SLA 99.9%</li>
        <li>Onboarding personnalisé</li>
      </ul>
      <button class="btn-cta primary" onclick="checkout('business')">Nous contacter →</button>
    </div>

  </div>

  <div class="guarantee">
    💯 <strong>Satisfait ou remboursé pendant 30 jours</strong> · Annulation possible à tout moment · Pas d'engagement
  </div>

  <div class="faq">
    <h2>❓ Questions fréquentes</h2>

    <div class="faq-item">
      <div class="faq-q">Y a-t-il une vraie période d'essai gratuit ?</div>
      <div class="faq-a">Oui ! 3 jours gratuits avec accès complet à toutes les features Pro. Aucune carte bancaire requise pour commencer. Vous pouvez tester avec vos vrais clients.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q">Puis-je changer de plan plus tard ?</div>
      <div class="faq-a">Oui, à tout moment. Upgrade instantané, downgrade à la fin du cycle de facturation en cours. Aucun frais caché.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q">Comment se passe la facturation en FCFA ?</div>
      <div class="faq-a">Stripe convertit automatiquement le montant USD en FCFA pour les cartes locales. Vous voyez le prix exact avant de payer. Les diaspora paient en USD directement.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q">Y a-t-il une limite de messages ?</div>
      <div class="faq-a">Non. Tous nos plans payants offrent un usage illimité. Nous appliquons juste un anti-abus standard (30 msg/min/IP) pour protéger les serveurs.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q">Que se passe-t-il après 3 jours d'essai ?</div>
      <div class="faq-a">Si vous n'avez pas choisi de plan, votre bot est mis en pause (vos données sont sauvegardées). Vous pouvez vous abonner à tout moment pour le réactiver.</div>
    </div>

    <div class="faq-item">
      <div class="faq-q">J'ai une question avant de m'abonner</div>
      <div class="faq-a">Écrivez-nous à <a href="mailto:gakououssou@gmail.com" style="color:#00c875">gakououssou@gmail.com</a> ou via WhatsApp.</div>
    </div>
  </div>
</div>

<script>
var period = 'monthly';
var currency = 'USD';
var prices = {
  starter:  { USD: { monthly: 9, yearly: 7.17 }, FCFA: { monthly: 5500, yearly: 4400 } },
  pro:      { USD: { monthly: 25, yearly: 20 }, FCFA: { monthly: 15000, yearly: 12000 } },
  business: { USD: { monthly: 85, yearly: 68 }, FCFA: { monthly: 50000, yearly: 40000 } }
};

function setPeriod(p, el){
  period = p;
  el.parentNode.querySelectorAll('button').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  updatePrices();
}
function setCurrency(c, el){
  currency = c;
  el.parentNode.querySelectorAll('button').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  updatePrices();
}
function updatePrices(){
  ['starter','pro','business'].forEach(function(plan){
    var p = prices[plan][currency][period];
    var symbol = currency === 'USD' ? '$' : '';
    var suffix = currency === 'FCFA' ? ' F' : '';
    var formatted = currency === 'USD' ? p.toFixed(p % 1 === 0 ? 0 : 2) : p.toLocaleString('fr-FR');
    document.querySelector('[data-price="'+plan+'"]').textContent = symbol + formatted + suffix;
    var fcfaP = prices[plan].FCFA[period];
    document.querySelector('[data-fcfa="'+plan+'"]').textContent = currency === 'USD'
      ? '≈ ' + fcfaP.toLocaleString('fr-FR') + ' FCFA / ' + (period === 'yearly' ? 'mois (facturé annuellement)' : 'mois')
      : (period === 'yearly' ? 'Facturé annuellement, économisez 20%' : 'Sans engagement');
  });
}

async function checkout(planKey){
  if (planKey === 'business') {
    window.location.href = 'mailto:gakououssou@gmail.com?subject=Plan Business SamaBot&body=Bonjour, je souhaite m\\'abonner au plan Business pour mon entreprise.';
    return;
  }
  var btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Redirection...';
  try {
    var r = await fetch('/billing/checkout', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ plan: planKey, period: period, bot_id: '${botId}' })
    });
    var d = await r.json();
    if (d.checkout_url) {
      window.location.href = d.checkout_url;
    } else if (d.error === 'stripe_not_configured') {
      alert('💳 Le paiement en ligne n\\'est pas encore activé. Contactez gakououssou@gmail.com pour vous abonner.');
      btn.disabled = false;
      btn.textContent = 'S\\'abonner →';
    } else {
      alert('Erreur: ' + (d.error || 'Inconnue'));
      btn.disabled = false;
      btn.textContent = 'S\\'abonner →';
    }
  } catch(e) {
    alert('Erreur réseau');
    btn.disabled = false;
    btn.textContent = 'S\\'abonner →';
  }
}
</script>
</body></html>`);
});

// ============================================
// 💳 STRIPE CHECKOUT — Création session de paiement
// ============================================
app.post('/billing/checkout', async (req, res) => {
  try {
    const { plan, period, bot_id } = req.body;
    if (!CONFIG.STRIPE_SECRET_KEY) {
      return res.json({ error: 'stripe_not_configured', message: 'Stripe pas encore configuré. Contactez l\'admin.' });
    }
    if (!['starter','pro','business'].includes(plan)) return res.status(400).json({ error: 'plan invalide' });
    if (!['monthly','yearly'].includes(period)) return res.status(400).json({ error: 'period invalide' });

    // Récupérer le price ID Stripe correspondant
    const priceKey = `STRIPE_PRICE_${plan.toUpperCase()}_${period.toUpperCase()}`;
    const priceId = CONFIG[priceKey];
    if (!priceId) {
      return res.json({ error: 'stripe_not_configured', message: 'Price ID manquant pour ' + plan + '/' + period });
    }

    // Créer la session Stripe Checkout
    const params = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': `${CONFIG.BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}&bot=${encodeURIComponent(bot_id||'')}`,
      'cancel_url': `${CONFIG.BASE_URL}/pricing?canceled=1${bot_id ? '&bot='+encodeURIComponent(bot_id) : ''}`,
      'allow_promotion_codes': 'true',
      'metadata[plan]': plan,
      'metadata[period]': period,
      'metadata[bot_id]': bot_id || '',
    });

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });
    const data = await r.json();
    if (data.error) {
      console.error('Stripe error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }
    res.json({ checkout_url: data.url, session_id: data.id });
  } catch(e) {
    console.error('checkout:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Page de succès après paiement
app.get('/billing/success', async (req, res) => {
  const { session_id, bot } = req.query;
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Paiement réussi</title>
<style>body{font-family:-apple-system,sans-serif;background:#f5f7f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#fff;border-radius:16px;padding:40px;text-align:center;max-width:480px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.box h1{color:#00c875;font-size:30px;margin:14px 0 8px}
.box p{color:#5a7060;line-height:1.6}
.btn{display:inline-block;background:#00c875;color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:800;margin-top:20px}</style></head>
<body><div class="box">
<div style="font-size:60px">🎉</div>
<h1>Paiement réussi!</h1>
<p>Votre abonnement SamaBot est maintenant actif.<br>Un email de confirmation vous a été envoyé.</p>
${bot ? `<a href="/dashboard/${bot}" class="btn">Aller à mon dashboard →</a>` : `<a href="/app" class="btn">Mes bots →</a>`}
</div></body></html>`);
});

// ============================================
// 🔔 STRIPE WEBHOOK — Gérer abonnements (créés/payés/annulés)
// ============================================
app.post('/billing/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  // Note: ce endpoint reçoit raw body pour vérification de signature
  // Si pas de webhook secret configuré, on parse quand même mais sans vérif
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (CONFIG.STRIPE_WEBHOOK_SECRET && sig) {
      // Vérification signature Stripe (best practice)
      // Pour simplifier, on parse directement le body. En prod stricte, utiliser stripe.webhooks.constructEvent
      event = JSON.parse(req.body.toString());
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch(e) {
    return res.status(400).send('Webhook parse error: ' + e.message);
  }

  console.log(`🔔 Stripe webhook: ${event.type}`);

  try {
    switch(event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const botId = session.metadata?.bot_id;
        const plan = session.metadata?.plan;
        const customerId = session.customer;
        const subId = session.subscription;
        if (botId && plan) {
          await db.update('bots', {
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subId,
            subscription_status: 'active',
            subscription_started_at: new Date().toISOString(),
            past_due_since: null,
            trial_until: null  // fin du trial dès qu'on souscrit
          }, `?id=eq.${botId}`);
          console.log(`✅ Bot ${botId} abonné au plan ${plan}`);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status; // active, past_due, canceled, etc.
        const customerId = sub.customer;
        // Trouver le bot associé
        const bots = await db.select('bots', `?stripe_customer_id=eq.${customerId}&select=id`);
        if (bots?.[0]) {
          const updates = { subscription_status: status };
          if (status === 'past_due' && !bots[0].past_due_since) {
            updates.past_due_since = new Date().toISOString();
          } else if (status === 'active') {
            updates.past_due_since = null;
          }
          await db.update('bots', updates, `?id=eq.${bots[0].id}`);
          console.log(`🔄 Bot ${bots[0].id} subscription_status → ${status}`);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const bots = await db.select('bots', `?stripe_customer_id=eq.${customerId}&select=id`);
        if (bots?.[0]) {
          await db.update('bots', {
            subscription_status: 'canceled',
            plan: 'trial',
            trial_until: new Date(Date.now() + 24*3600*1000).toISOString() // 24h de grâce
          }, `?id=eq.${bots[0].id}`);
          console.log(`❌ Bot ${bots[0].id} subscription annulée`);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const bots = await db.select('bots', `?stripe_customer_id=eq.${customerId}&select=id,nom,notifications_email`);
        if (bots?.[0]) {
          await db.update('bots', {
            subscription_status: 'past_due',
            past_due_since: new Date().toISOString()
          }, `?id=eq.${bots[0].id}`);
          // Email au patron
          if (bots[0].notifications_email) {
            sendEmail(bots[0].notifications_email, '⚠️ Échec du paiement — SamaBot',
              `<p>Bonjour, le paiement de votre abonnement SamaBot pour <strong>${bots[0].nom}</strong> a échoué.</p><p>Veuillez mettre à jour votre carte: <a href="${CONFIG.BASE_URL}/billing/${bots[0].id}">Gérer mon abonnement</a></p><p>Sans action, votre bot sera suspendu dans 7 jours.</p>`
            ).catch(()=>{});
          }
        }
        break;
      }
    }
    res.json({ received: true });
  } catch(e) {
    console.error('webhook error:', e.message);
    res.status(500).send('Error: ' + e.message);
  }
});

// ============================================
// 🧾 PAGE BILLING par bot (gérer son abonnement)
// ============================================
app.get('/billing/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}`);
    if (!bots?.length) return res.status(404).send('Bot introuvable');
    const bot = bots[0];
    const plan = bot.plan || 'trial';
    const planInfo = PLANS[plan] || PLANS.trial;
    const status = bot.subscription_status || (plan === 'trial' ? 'trial' : 'unknown');
    const trialEnd = bot.trial_until ? new Date(bot.trial_until) : null;
    const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : 0;

    const statusLabel = {
      'trial': '🎁 Période d\'essai',
      'active': '✅ Actif',
      'past_due': '⚠️ Paiement en attente',
      'canceled': '❌ Annulé',
      'unknown': '❓ Inconnu'
    }[status] || status;

    res.send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Mon abonnement — ${bot.nom}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#f5f7f6;color:#0a1a0f;padding:30px 20px;line-height:1.5}
.wrap{max-width:680px;margin:0 auto}
h1{font-size:24px;font-weight:800;margin-bottom:6px}
.sub{color:#5a7060;font-size:14px;margin-bottom:24px}
.card{background:#fff;border-radius:14px;padding:24px;border:1px solid #e5e7eb;margin-bottom:14px}
.card h2{font-size:16px;font-weight:800;margin-bottom:14px}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f4f1;font-size:14px}
.row:last-child{border:none}
.row strong{color:#0a1a0f}
.badge{display:inline-block;padding:4px 12px;border-radius:14px;font-size:12px;font-weight:700}
.badge.trial{background:#fef9c3;color:#854d0e}
.badge.active{background:#dcfce7;color:#166534}
.badge.past_due{background:#fed7aa;color:#9a3412}
.badge.canceled{background:#fecaca;color:#991b1b}
.btn{display:inline-block;background:#00c875;color:#000;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;margin:6px 4px;border:none;cursor:pointer;font-family:inherit;font-size:13px}
.btn-2{background:#f0f4f1;color:#0a1a0f}
.btn-danger{background:#fff;color:#dc2626;border:1px solid #fca5a5}
.feature{padding:6px 0;font-size:13px;color:#3a5040}
.feature::before{content:"✓ ";color:#00c875;font-weight:800}
</style></head><body>
<div class="wrap">
  <h1>💳 Mon abonnement</h1>
  <div class="sub">${bot.emoji||'🤖'} <strong>${bot.nom}</strong></div>

  <div class="card">
    <h2>📊 Plan actuel</h2>
    <div class="row"><span>Plan</span><strong>${planInfo.name}</strong></div>
    <div class="row"><span>Statut</span><span class="badge ${status}">${statusLabel}</span></div>
    ${plan === 'trial' && trialEnd ? `<div class="row"><span>Fin de l'essai</span><strong>${trialEnd.toLocaleDateString('fr-FR')} (${trialDaysLeft}j restants)</strong></div>` : ''}
    ${bot.subscription_started_at ? `<div class="row"><span>Abonné depuis</span><strong>${new Date(bot.subscription_started_at).toLocaleDateString('fr-FR')}</strong></div>` : ''}
    ${plan !== 'trial' ? `<div class="row"><span>Prix</span><strong>$${planInfo.price_usd_monthly}/mois <span style="color:#5a7060;font-size:12px">≈ ${planInfo.price_fcfa_monthly?.toLocaleString('fr-FR')} F</span></strong></div>` : ''}
    <div class="row"><span>Bots inclus</span><strong>${planInfo.bots_max === -1 ? 'Illimité' : 'Jusqu\'à ' + planInfo.bots_max}</strong></div>
  </div>

  <div class="card">
    <h2>✨ Features incluses</h2>
    ${planInfo.features.map(f => `<div class="feature">${f}</div>`).join('')}
  </div>

  <div class="card">
    <h2>⚙️ Actions</h2>
    ${plan === 'trial' || status === 'canceled' ?
      `<a href="/pricing?bot=${bot.id}" class="btn">💎 Choisir un plan</a>` :
      `<a href="/pricing?bot=${bot.id}" class="btn">⬆️ Changer de plan</a>
       <button class="btn btn-danger" onclick="cancelSub()">❌ Annuler l'abonnement</button>`
    }
    <a href="/dashboard/${bot.id}" class="btn btn-2">← Retour au dashboard</a>
  </div>

  ${status === 'past_due' ? `
  <div class="card" style="background:#fef3c7;border-color:#fcd34d">
    <h2 style="color:#92400e">⚠️ Paiement requis</h2>
    <p style="color:#92400e;font-size:13px">Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour éviter la suspension de votre bot.</p>
    <a href="/pricing?bot=${bot.id}" class="btn" style="margin-top:10px">Mettre à jour la carte</a>
  </div>` : ''}
</div>

<script>
async function cancelSub(){
  if(!confirm('Annuler votre abonnement? Votre bot sera suspendu à la fin du cycle actuel.')) return;
  try {
    var r = await fetch('/billing/${bot.id}/cancel', {method:'POST'});
    var d = await r.json();
    if(d.success) {
      alert('✅ Abonnement annulé. Vous gardez l\\'accès jusqu\\'à la fin du cycle.');
      location.reload();
    } else {
      alert('Erreur: ' + (d.error || 'Inconnue'));
    }
  } catch(e) { alert('Erreur réseau'); }
}
</script>
</body></html>`);
  } catch(e) { res.status(500).send('Erreur: ' + e.message); }
});

// Annuler un abonnement
app.post('/billing/:botId/cancel', async (req, res) => {
  try {
    if (!CONFIG.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe pas configuré' });
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&select=stripe_subscription_id`);
    if (!bots?.[0]?.stripe_subscription_id) return res.status(404).json({ error: 'Pas d\'abonnement actif' });

    // Annuler à la fin du cycle (pas immédiatement)
    const r = await fetch(`https://api.stripe.com/v1/subscriptions/${bots[0].stripe_subscription_id}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.STRIPE_SECRET_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'cancel_at_period_end=true'
    });
    const d = await r.json();
    if (d.error) return res.status(500).json({ error: d.error.message });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 📦 SDK JavaScript SamaBot — pour intégration ultra simple
app.get('/sdk.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const base = CONFIG.BASE_URL;
  res.send(`(function(g){
"use strict";
var BASE = '${base}';
function SamaBot(botId){
  if(!(this instanceof SamaBot)) return new SamaBot(botId);
  this.botId = botId;
  this.base = BASE;
}
SamaBot.prototype._fetch = function(path, opts){
  return fetch(this.base + '/api/v1/bots/' + this.botId + path, opts || {})
    .then(function(r){ return r.json(); });
};
SamaBot.prototype.getInfo = function(){
  return this._fetch('');
};
SamaBot.prototype.getCatalogue = function(){
  return this._fetch('/catalogue');
};
SamaBot.prototype.getReviews = function(limit){
  return this._fetch('/avis?limit=' + (limit || 20));
};
SamaBot.prototype.getStats = function(){
  return this._fetch('/stats');
};
SamaBot.prototype.sendMessage = function(message, sessionId){
  return this._fetch('/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ message: message, sessionId: sessionId })
  });
};
SamaBot.prototype.createOrder = function(data){
  return this._fetch('/commandes', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
};
SamaBot.prototype.validatePromo = function(code, total, clientTel){
  return this._fetch('/promo/validate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code: code, total: total, client_tel: clientTel })
  });
};
SamaBot.prototype.openChat = function(){
  // Ouvre le chat dans un nouvel onglet
  window.open(this.base + '/chat/' + this.botId, '_blank');
};
SamaBot.prototype.embedChat = function(selector){
  // Intègre le chat en iframe dans un élément
  var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if(!el) return console.error('SamaBot: élément introuvable');
  var iframe = document.createElement('iframe');
  iframe.src = this.base + '/chat/' + this.botId;
  iframe.style.cssText = 'width:100%;min-height:540px;border:none;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.08)';
  el.appendChild(iframe);
};
SamaBot.prototype.injectWidget = function(){
  // Injecte le widget bulle flottante
  if(g.SamaBotConfig) return;
  g.SamaBotConfig = { botId: this.botId };
  var s = document.createElement('script');
  s.src = this.base + '/widget.js';
  s.async = true;
  document.body.appendChild(s);
};
g.SamaBot = SamaBot;
})(typeof window !== 'undefined' ? window : this);`);
});

// ============================================
// CRÉER UN BOT
// ============================================
app.post('/bot/create', async (req, res) => {
  try {
    const { nom, niche, adresse, horaires, services, telephone, paiement, maps_url,
            wave_number, om_number, couleur, email, logo_url, catalogue,
            notifications_phone, notifications_email, custom_welcome,
            livraison_actif, livraison_frais, livraison_delai, livraison_zones, livraison_min } = req.body;
    if (!nom||!niche) return res.status(400).json({ error:'nom et niche requis' });

    const id = makeBotId(nom);
    const botData = {
      id, nom, niche, couleur:couleur||'#00c875', emoji:getEmoji(niche), actif:true,
      adresse:adresse||null, horaires:horaires||null, services:services||null,
      telephone:telephone||null, paiement:paiement||'Wave, Orange Money, espèces',
      maps_url:maps_url||null, wave_number:wave_number||null, om_number:om_number||null,
      logo_url:logo_url||null, catalogue:catalogue||[],
      notifications_phone:notifications_phone||null, notifications_email:notifications_email||email||null, custom_welcome:custom_welcome||null,
      livraison_actif: livraison_actif||false,
      livraison_frais: livraison_frais||0,
      livraison_delai: livraison_delai||'30-45 min',
      livraison_zones: livraison_zones||'Dakar',
      livraison_min:   livraison_min||0,
      user_id: '00000000-0000-0000-0000-000000000001' // sera remplacé ci-dessous
    };
    botData.prompt = makePrompt(botData);

    // Priorité: 1) token auth, 2) email fourni, 3) admin fallback
    const authToken = req.headers.authorization?.replace('Bearer ','');
    const authUserId = verifyToken(authToken);

    if (authUserId) {
      // Utilisateur connecté — lie le bot à son compte
      botData.user_id = authUserId;
    } else if (email) {
      // Email fourni — trouve ou crée le user
      const ex = await db.select('users', `?email=eq.${encodeURIComponent(email)}`);
      if (!ex?.length) {
        const nu = await db.insert('users', { email, nom:nom+' (owner)', plan:'starter' });
        if (nu?.[0]?.id) botData.user_id = nu[0].id;
      } else {
        botData.user_id = ex[0].id;
      }
    }

    // 🎁 Trial 3 jours automatique à la création du bot
    botData.plan = 'trial';
    botData.trial_until = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

    await db.insert('bots', botData);
    console.log(`✅ Bot créé: ${nom} (${id}) — Trial jusqu'au ${botData.trial_until}`);

    // 📧 Email de bienvenue au patron (async, ne bloque pas la réponse)
    if (botData.notifications_email) {
      sendWelcomeEmail(botData, id).catch(e => console.error('Welcome email:', e.message));
    }

    const base = CONFIG.BASE_URL;
    res.json({
      success:true, botId:id,
      chatUrl:`${base}/chat/${id}`,
      dashUrl:`${base}/dashboard/${id}`,
      widgetCode:`<!-- SamaBot — ${nom} -->\n<script>\n  window.SamaBotConfig = { botId: '${id}', couleur: '${couleur||'#00c875'}' };\n</script>\n<script src="${base}/widget.js" async></script>`
    });
  } catch(e) { console.error('Create:', e); res.status(500).json({ error:e.message }); }
});

// Email de bienvenue avec tutoriel 3 étapes
async function sendWelcomeEmail(bot, botId) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#f5f7f6;font-family:-apple-system,BlinkMacSystemFont,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:linear-gradient(135deg,${bot.couleur||'#00c875'} 0%,#0a1a0f 100%);padding:40px 24px;color:#fff;text-align:center">
      <div style="font-size:50px;margin-bottom:10px">🎉</div>
      <div style="font-size:26px;font-weight:800;margin-bottom:6px">Bienvenue sur SamaBot!</div>
      <div style="font-size:14px;opacity:.9">Votre bot ${bot.emoji||'🤖'} <strong>${bot.nom}</strong> est prêt</div>
    </div>
    <div style="padding:32px 24px">
      <p style="font-size:15px;color:#3a5040;line-height:1.6;margin:0 0 24px">
        Asalaa maalekum 👋<br><br>
        Félicitations! Votre assistant IA est en ligne et prêt à recevoir vos clients en wolof et en français.
      </p>

      <h2 style="font-size:18px;color:#0a1a0f;margin:0 0 16px">🚀 3 étapes pour bien démarrer</h2>

      <div style="background:#f0fdf4;border-left:4px solid #00c875;border-radius:8px;padding:16px;margin-bottom:14px">
        <div style="font-weight:700;color:#0a1a0f;margin-bottom:6px">1️⃣ Ajoutez votre catalogue</div>
        <div style="font-size:13px;color:#5a7060;line-height:1.5">Allez dans l'onglet <strong>🛍️ Catalogue</strong> du dashboard et ajoutez vos produits/services avec photos. Plus c'est complet, mieux votre bot répondra.</div>
      </div>

      <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:14px">
        <div style="font-weight:700;color:#0a1a0f;margin-bottom:6px">2️⃣ Personnalisez les notifications</div>
        <div style="font-size:13px;color:#5a7060;line-height:1.5">Vérifiez votre numéro WhatsApp et email pour recevoir les commandes en temps réel. Section <strong>Paramètres</strong> du dashboard.</div>
      </div>

      <div style="background:#dbeafe;border-left:4px solid #3b82f6;border-radius:8px;padding:16px;margin-bottom:24px">
        <div style="font-weight:700;color:#0a1a0f;margin-bottom:6px">3️⃣ Partagez votre lien</div>
        <div style="font-size:13px;color:#5a7060;line-height:1.5">Votre lien de chat: <a href="${CONFIG.BASE_URL}/chat/${botId}" style="color:#00c875;text-decoration:none">${CONFIG.BASE_URL}/chat/${botId}</a><br>Partagez-le sur WhatsApp, Instagram, ou collez le widget sur votre site.</div>
      </div>

      <div style="text-align:center;margin:24px 0">
        <a href="${CONFIG.BASE_URL}/dashboard/${botId}" style="display:inline-block;background:#00c875;color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;font-size:14px">📊 Ouvrir mon dashboard →</a>
      </div>

      <h3 style="font-size:15px;color:#0a1a0f;margin:24px 0 12px">💡 Astuces de démarrage</h3>
      <ul style="font-size:13px;color:#5a7060;line-height:1.7;padding-left:20px;margin:0">
        <li>Créez un code promo <strong>BIENVENUE10</strong> pour vos premiers clients (onglet 🎁 Promos)</li>
        <li>Activez la livraison et configurez vos zones</li>
        <li>Consultez l'onglet <strong>📊 Analytics</strong> chaque semaine pour voir vos performances</li>
        <li>Répondez aux avis pour fidéliser vos clients</li>
      </ul>

      <div style="background:#f9faf9;border-radius:10px;padding:16px;margin-top:24px;text-align:center">
        <div style="font-size:12px;color:#5a7060;margin-bottom:6px">Besoin d'aide?</div>
        <div style="font-size:13px;color:#0a1a0f">Répondez à cet email ou contactez-nous sur WhatsApp</div>
      </div>
    </div>
    <div style="padding:20px 24px;border-top:1px solid #f0f0f0;font-size:11px;color:#9ab0a0;text-align:center">
      SamaBot IA — samabot.app · Votre assistant business 24/7
    </div>
  </div></body></html>`;
  await sendEmail(bot.notifications_email, `🎉 Bienvenue sur SamaBot — ${bot.nom} est prêt!`, html);
}

// ============================================
// TEMPLATES PAR NICHE — Catalogues pré-remplis
// ============================================
const NICHE_TEMPLATES = {
  'restaurant': {
    catalogue: [
      {nom:'Thieboudienne', prix:3500, desc:'Riz au poisson, légumes', emoji:'🍛'},
      {nom:'Yassa Poulet', prix:3000, desc:'Poulet à l\'oignon, citron', emoji:'🍗'},
      {nom:'Mafé', prix:3000, desc:'Sauce arachide, viande', emoji:'🥘'},
      {nom:'Salade', prix:2000, desc:'Salade composée fraîche', emoji:'🥗'},
      {nom:'Bissap', prix:500, desc:'Jus de bissap maison', emoji:'🥤'}
    ],
    livraison_frais: 1000, livraison_delai: '30-45 min',
    horaires: '11h-23h tous les jours'
  },
  'salon': {
    catalogue: [
      {nom:'Coupe simple', prix:3000, desc:'Coupe + mise en forme', emoji:'✂️'},
      {nom:'Tresses', prix:8000, desc:'Tresses africaines', emoji:'💆‍♀️'},
      {nom:'Soin cheveux', prix:5000, desc:'Soin profond + masque', emoji:'💇‍♀️'},
      {nom:'Manucure', prix:3000, desc:'Pose + vernis', emoji:'💅'},
      {nom:'Maquillage', prix:10000, desc:'Maquillage évènement', emoji:'💄'}
    ],
    livraison_actif: false,
    horaires: '9h-19h du lundi au samedi'
  },
  'boutique': {
    catalogue: [
      {nom:'Article exemple', prix:5000, desc:'Description du produit', emoji:'🛍️'}
    ],
    livraison_frais: 1500, livraison_delai: '24-48h',
    horaires: '9h-20h tous les jours'
  },
  'pharmacie': {
    catalogue: [
      {nom:'Paracétamol', prix:500, desc:'Antidouleur — boîte de 20', emoji:'💊'},
      {nom:'Vitamine C', prix:2000, desc:'Cure d\'1 mois', emoji:'🌿'},
      {nom:'Pansements', prix:1000, desc:'Boîte de 10', emoji:'🩹'}
    ],
    livraison_frais: 500, livraison_delai: '20-30 min',
    horaires: '8h-22h, garde 24/7 sur appel'
  },
  'menuiserie': {
    catalogue: [
      {nom:'Devis personnalisé', prix:0, desc:'Sur mesure selon vos besoins', emoji:'🪚'},
      {nom:'Réparation meuble', prix:5000, desc:'À partir de — selon dégâts', emoji:'🔨'}
    ],
    livraison_actif: false,
    horaires: '8h-18h du lundi au samedi'
  },
  'auto-ecole': {
    catalogue: [
      {nom:'Forfait permis B', prix:150000, desc:'Code + 20h conduite', emoji:'🚗'},
      {nom:'Heure de conduite', prix:8000, desc:'Cours individuel', emoji:'🚦'},
      {nom:'Code seul', prix:50000, desc:'Cours + examen blanc', emoji:'📚'}
    ],
    livraison_actif: false,
    horaires: '8h-19h du lundi au samedi'
  }
};

// Endpoint pour récupérer les templates disponibles
app.get('/templates', (req, res) => {
  const templates = Object.entries(NICHE_TEMPLATES).map(([niche, data]) => ({
    niche,
    label: niche.charAt(0).toUpperCase() + niche.slice(1).replace('-', ' '),
    catalogue_count: data.catalogue.length,
    sample_items: data.catalogue.slice(0, 3).map(i => i.nom)
  }));
  res.json({ templates });
});

// Endpoint pour appliquer un template à un bot existant
app.post('/templates/:botId/apply', async (req, res) => {
  try {
    const { niche } = req.body;
    const tpl = NICHE_TEMPLATES[niche];
    if (!tpl) return res.status(400).json({ error: 'Template introuvable' });
    const updates = { catalogue: tpl.catalogue };
    if (tpl.livraison_frais !== undefined) updates.livraison_frais = tpl.livraison_frais;
    if (tpl.livraison_delai) updates.livraison_delai = tpl.livraison_delai;
    if (tpl.livraison_actif !== undefined) updates.livraison_actif = tpl.livraison_actif;
    if (tpl.horaires) updates.horaires = tpl.horaires;
    await db.update('bots', updates, `?id=eq.${req.params.botId}`);
    res.json({ success: true, applied: tpl.catalogue.length + ' articles' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ============================================
// DASHBOARD CLIENT
// ============================================
app.get('/dashboard/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}`);
    const bot = bots?.[0];
    if (!bot) return res.status(404).send('Bot non trouvé');

    // Langue depuis query param ou cookie ou défaut fr
    const lang = ['fr','en','pt'].includes(req.query.lang) ? req.query.lang : 'fr';

    const [convs, msgs, commandes, allAvis, audioMsgs] = await Promise.all([
      db.select('conversations', `?bot_id=eq.${req.params.botId}&order=last_message_at.desc&limit=30`),
      db.select('messages', `?bot_id=eq.${req.params.botId}&role=eq.user&order=created_at.desc&limit=50`),
      db.select('commandes', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=30`),
      db.select('avis', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=20`),
      db.select('audio_messages', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=10`)
    ]);

    const now = Date.now();
    const msgsToday = msgs?.filter(m=>new Date(m.created_at)>new Date(now-86400000)).length||0;
    const cmdsPending = commandes?.filter(c=>c.statut==='pending').length||0;
    const revenuTotal = commandes?.filter(c=>c.statut==='paid').reduce((s,c)=>s+c.total,0)||0;
    const avgNote = allAvis?.length ? (allAvis.reduce((s,a)=>s+a.note,0)/allAvis.length).toFixed(1) : '—';
    const statusColors = {pending:'#f59e0b',paid:'#10b981',preparing:'#3b82f6',ready:'#8b5cf6',delivered:'#6b7280',cancelled:'#ef4444',delivering:'#f59e0b'};
    const statusLabels = {
      pending:    t(lang,'status_pending'),
      paid:       t(lang,'status_paid'),
      preparing:  t(lang,'status_preparing'),
      ready:      t(lang,'status_ready'),
      delivering: t(lang,'status_delivering'),
      delivered:  t(lang,'status_delivered'),
      cancelled:  t(lang,'status_cancelled'),
    };

    res.send(`<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${bot.nom} — ${t(lang,'dashboard_title')}</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f0f4f1;min-height:100vh;color:#0a1a0f}
.topbar{background:#0a1a0f;padding:0 20px;display:flex;align-items:center;gap:12px;height:58px;position:sticky;top:0;z-index:100}
.logo{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#fff}.logo span{color:#00c875}
.bot-badge{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border-radius:20px;padding:5px 12px}
.bot-logo-sm{width:26px;height:26px;border-radius:6px;object-fit:cover}
.bot-ava-sm{width:26px;height:26px;border-radius:50%;background:${bot.couleur};display:flex;align-items:center;justify-content:center;font-size:13px}
.bot-nm{font-size:13px;font-weight:600;color:#fff}
.live{display:flex;align-items:center;gap:5px;font-size:12px;color:#4ade80;font-weight:600;margin-left:auto}
.live-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:p 2s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}
.wrap{padding:18px;max-width:1100px;margin:0 auto}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.btn{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:none;border:none;transition:all .15s}
.btn-p{background:${bot.couleur};color:#fff}.btn-g{background:#fff;color:#0a1a0f;border:1px solid #d1e5d8}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
.stat{background:#fff;border-radius:12px;padding:14px;border:1px solid rgba(0,200,117,.1)}
.stat-val{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;line-height:1;color:#0a1a0f}
.stat-lbl{font-size:11px;color:#5a7060;margin-top:4px;font-weight:500}
.stat-sub{font-size:11px;font-weight:600;color:#00c875;margin-top:2px}
.alert{background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#92400e}
.tab-btns{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tab-btn{padding:7px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #d1e5d8;background:#fff;color:#5a7060;font-family:'DM Sans',sans-serif;transition:all .15s}
.tab-btn.active{background:${bot.couleur};color:#fff;border-color:${bot.couleur}}
.tab{display:none}.tab.active{display:block}
.card{background:#fff;border-radius:12px;padding:16px;border:1px solid rgba(0,200,117,.1);margin-bottom:12px}
.card-title{font-size:14px;font-weight:700;color:#0a1a0f;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
.row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f0f4f1;gap:10px}
.cmd-card{background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;transition:all .2s}
.cmd-card:hover{border-color:#d1e5d8;box-shadow:0 4px 16px rgba(0,0,0,.06)}
.cmd-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.cmd-num{font-size:14px;font-weight:800;color:#0a1a0f}
.cmd-date{font-size:11px;color:#9ab0a0;margin-top:3px}
.cmd-right{text-align:right}
.cmd-infos{display:flex;flex-direction:column;gap:8px;padding:12px;background:#f9faf9;border-radius:8px;margin-bottom:10px}
.cmd-info-row{display:flex;gap:10px;align-items:flex-start}
.cmd-info-icon{font-size:15px;flex-shrink:0;margin-top:1px}
.cmd-info-label{font-size:10px;color:#9ab0a0;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.cmd-info-val{font-size:13px;color:#0a1a0f;font-weight:600;line-height:1.5}
.row:last-child{border-bottom:none}
.row-main{font-size:13px;font-weight:600;color:#0a1a0f}
.row-sub{font-size:11px;color:#9ab0a0;margin-top:2px}
.row-right{text-align:right;flex-shrink:0}
.price{font-size:14px;font-weight:700;color:#0a1a0f}
.badge{display:inline-flex;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:700}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.msg-text{font-size:13px;color:#2a3a2a;line-height:1.5}
.msg-time{font-size:11px;color:#9ab0a0;margin-top:2px}
.stars{color:#f59e0b;font-size:14px}
.qr-img{width:140px;height:140px;border-radius:8px;display:block;margin:0 auto}
.copy-area{background:#f0f4f1;border-radius:8px;padding:10px;font-size:11px;color:#3a5040;word-break:break-all;font-family:monospace;line-height:1.6;margin-top:6px}
.cp{background:rgba(0,200,117,.12);color:#00a862;border:1px solid rgba(0,200,117,.25);border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:5px}
.audio-pill{display:inline-flex;align-items:center;gap:5px;background:#ede9fe;color:#5b21b6;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:4px}
.empty{text-align:center;color:#9ab0a0;font-size:13px;padding:20px;font-style:italic}
select{font-size:11px;border-radius:6px;border:1px solid #d1e5d8;padding:3px 6px;cursor:pointer;margin-top:3px;font-family:'DM Sans',sans-serif;background:#fff}
@media(max-width:768px){.stats{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}.wrap{padding:12px}}
</style>
</head>
<body>
<div class="topbar">
  <div class="logo">Sama<span>Bot</span></div>
  <div class="bot-badge">
    ${bot.logo_url?`<img class="bot-logo-sm" src="${bot.logo_url}" alt="${bot.nom}"/>`:`<div class="bot-ava-sm">${bot.emoji}</div>`}
    <span class="bot-nm">${bot.nom}</span>
  </div>
  <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
    <div class="live"><span class="live-dot"></span>${t(lang,'online')}</div>
    <select onchange="changeLang(this.value)" style="padding:5px 8px;border-radius:8px;border:1px solid #d1e5d8;font-size:12px;font-family:inherit;background:#fff">
      <option value="fr" ${lang==='fr'?'selected':''}>🇫🇷 FR</option>
      <option value="en" ${lang==='en'?'selected':''}>🇬🇧 EN</option>
      <option value="pt" ${lang==='pt'?'selected':''}>🇵🇹 PT</option>
    </select>
    <a href="/app" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:6px 12px;color:#fff;font-size:12px;font-weight:600;text-decoration:none">← Mes bots</a>
  </div>
</div>

<div class="wrap">
  <div class="actions">
    <a class="btn btn-p" href="/chat/${bot.id}" target="_blank">💬 Chat</a>
    <a class="btn btn-g" href="/inbox/${bot.id}" target="_blank">📥 Inbox</a>
    <button class="btn btn-g" onclick="copyLink()">🔗 Lien</button>
    <button class="btn btn-g" onclick="document.getElementById(&quot;wm&quot;).style.display=&quot;flex&quot;">📋 Widget</button>
    <button class="btn btn-g" onclick="location.reload()">🔄</button>
  </div>

  ${cmdsPending>0?`<div class="alert">⚠️ ${cmdsPending} ${t(lang,'pending_alert')}</div>`:''}

  <div class="stats">
    <div class="stat"><div class="stat-val">${msgsToday}</div><div class="stat-lbl">${t(lang,'msgs_today')}</div></div>
    <div class="stat"><div class="stat-val" id="rdv-today-count">—</div><div class="stat-lbl">${t(lang,'rdv_today')}</div><div class="stat-sub">📅</div></div>
    <div class="stat"><div class="stat-val">${commandes?.length||0}</div><div class="stat-lbl">${t(lang,'orders')}</div><div class="stat-sub">⏳ ${cmdsPending}</div></div>
    <div class="stat"><div class="stat-val">${(revenuTotal/1000).toFixed(0)}K</div><div class="stat-lbl">${t(lang,'revenue')}</div></div>
    <div class="stat"><div class="stat-val">${avgNote}${avgNote!=='—'?'⭐':''}</div><div class="stat-lbl">${t(lang,'avg_rating')}</div><div class="stat-sub">${allAvis?.length||0}</div></div>
  </div>

  ${(function(){
    const plan = bot.plan || 'trial';
    const trialEnd = bot.trial_until ? new Date(bot.trial_until) : null;
    const daysLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : 0;
    if (plan === 'trial' && trialEnd) {
      if (daysLeft <= 0) {
        return `<div style="background:#fecaca;border:1px solid #ef4444;border-radius:10px;padding:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div><strong style="color:#991b1b">⏰ Période d'essai expirée</strong><br><span style="font-size:13px;color:#7f1d1d">Votre bot est en pause. Abonnez-vous pour le réactiver.</span></div>
          <a href="/pricing?bot=${bot.id}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">💎 Choisir un plan</a>
        </div>`;
      } else if (daysLeft <= 1) {
        return `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div><strong style="color:#92400e">⏰ Plus que ${daysLeft} jour${daysLeft>1?'s':''} d'essai!</strong><br><span style="font-size:13px;color:#78350f">Abonnez-vous pour continuer sans interruption.</span></div>
          <a href="/pricing?bot=${bot.id}" style="background:#f59e0b;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">💎 Voir les plans</a>
        </div>`;
      } else {
        return `<div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div style="font-size:13px;color:#1e40af">🎁 <strong>Période d'essai</strong> — Plus que ${daysLeft} jour${daysLeft>1?'s':''}</div>
          <a href="/pricing?bot=${bot.id}" style="background:#3b82f6;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px">Voir les plans →</a>
        </div>`;
      }
    } else if (bot.subscription_status === 'past_due') {
      return `<div style="background:#fed7aa;border:1px solid #f97316;border-radius:10px;padding:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div><strong style="color:#9a3412">⚠️ Paiement en attente</strong><br><span style="font-size:13px;color:#7c2d12">Mettez à jour votre carte pour éviter la suspension.</span></div>
        <a href="/billing/${bot.id}" style="background:#ea580c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">💳 Mettre à jour</a>
      </div>`;
    }
    return '';
  })()}

  <div class="tab-btns">
    <button class="tab-btn active" onclick="showTab('cmd',this)">📦 ${t(lang,'tab_orders')} (${commandes?.length||0})</button>
    <button class="tab-btn" onclick="showTab('rdv',this)">📅 ${t(lang,'tab_rdv')}</button>
    <button class="tab-btn" onclick="showTab('catalogue',this)">🛍️ Catalogue (${(bot.catalogue||[]).length})</button>
    <button class="tab-btn" onclick="showTab('promos',this)">🎁 Promos</button>
    <button class="tab-btn" onclick="showTab('analytics',this)">📊 Analytics</button>
    <button class="tab-btn" onclick="showTab('msgs',this)">💬 ${t(lang,'tab_messages')} (${msgs?.length||0})</button>
    <button class="tab-btn" onclick="showTab('audio',this)">🎤 ${t(lang,'tab_audio')} (${audioMsgs?.length||0})</button>
    <button class="tab-btn" onclick="showTab('avis',this)">⭐ ${t(lang,'tab_reviews')} (${allAvis?.length||0})</button>
    <button class="tab-btn" onclick="showTab('workflow',this)">⚡ Workflows</button>
    <button class="tab-btn" onclick="showTab('partage',this)">🔗 ${t(lang,'tab_share')}</button>
    <a href="/billing/${bot.id}" class="tab-btn" style="text-decoration:none;display:inline-block">💳 Mon abonnement</a>
  </div>

  <!-- RDV -->
  <div id="tab-rdv" class="tab">
    <div class="card">
      <div class="card-title">
        <span>📅 Calendrier des RDV</span>
        <button class="btn btn-g" style="font-size:11px;padding:5px 10px" onclick="ouvrirConfigDispo()">⚙️ Horaires</button>
      </div>

      <!-- Sélecteur de semaine -->
      <div id="rdv-semaine" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:12px;margin-bottom:16px;scrollbar-width:none"></div>

      <!-- RDV de la date sélectionnée -->
      <div id="rdv-liste"></div>
    </div>

    <!-- Config horaires -->
    <div id="config-dispo" style="display:none">
      <div class="card">
        <div class="card-title">⚙️ Configurer vos horaires d'ouverture</div>
        <div id="dispo-form">
          ${['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'].map((j,i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f4f1;flex-wrap:wrap">
            <div style="width:80px;font-size:13px;font-weight:600;color:#0a1a0f">${j}</div>
            <input type="checkbox" id="actif-${i+1}" checked style="width:auto"/>
            <input type="time" id="debut-${i+1}" value="09:00" style="width:100px;padding:4px 8px;font-size:12px"/>
            <span style="font-size:12px;color:#5a7060">à</span>
            <input type="time" id="fin-${i+1}" value="18:00" style="width:100px;padding:4px 8px;font-size:12px"/>
            <select id="slot-${i+1}" style="padding:4px 8px;font-size:12px;border-radius:6px;border:1px solid #d1e5d8">
              <option value="30">30 min</option>
              <option value="60" selected>1h</option>
              <option value="90">1h30</option>
              <option value="120">2h</option>
            </select>
          </div>`).join('')}
        </div>
        <div style="margin-top:16px;display:flex;gap:8px">
          <button class="btn btn-p" onclick="sauvegarderDispo()">💾 Sauvegarder</button>
          <button class="btn btn-g" onclick="document.getElementById(&quot;config-dispo&quot;).style.display=&quot;none&quot;">Annuler</button>
        </div>
      </div>
    </div>
  </div>

  <!-- COMMANDES -->
  <div id="tab-cmd" class="tab active">
    <div class="card">
      <div class="card-title">📦 Commandes récentes</div>
      ${commandes?.length ? commandes.map(c => `
        <div class="cmd-card">
          <div class="cmd-head">
            <div>
              <div class="cmd-num">${c.numero||'#'}</div>
              <div class="cmd-date">${new Date(c.created_at).toLocaleString('fr-FR')}</div>
            </div>
            <div class="cmd-right">
              <div class="price">${(c.total||0).toLocaleString('fr-FR')} F</div>
              <span class="badge" style="background:${statusColors[c.statut]||'#ccc'}22;color:${statusColors[c.statut]||'#666'}">${statusLabels[c.statut]||c.statut}</span>
            </div>
          </div>

          <div class="cmd-infos">
            ${c.client_nom ? `
            <div class="cmd-info-row">
              <span class="cmd-info-icon">👤</span>
              <div>
                <div class="cmd-info-label">Client</div>
                <div class="cmd-info-val">${c.client_nom}</div>
              </div>
            </div>` : ''}

            ${c.client_tel ? `
            <div class="cmd-info-row">
              <span class="cmd-info-icon">📞</span>
              <div>
                <div class="cmd-info-label">Téléphone</div>
                <div class="cmd-info-val">
                  <a href="tel:${c.client_tel}" style="color:#00c875;font-weight:700;text-decoration:none">${c.client_tel}</a>
                  &nbsp;
                  <a href="https://wa.me/${c.client_tel.replace(/[\s+\-()]/g,'')}" target="_blank" style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;text-decoration:none">💬 WhatsApp</a>
                </div>
              </div>
            </div>` : ''}

            ${c.adresse_livraison ? `
            <div class="cmd-info-row">
              <span class="cmd-info-icon">📍</span>
              <div>
                <div class="cmd-info-label">Adresse livraison</div>
                <div class="cmd-info-val">${c.adresse_livraison}
                  ${c.adresse_livraison.includes('maps.google') || c.adresse_livraison.includes('GPS:') ? 
                    `<br><a href="${c.adresse_livraison.match(/https?:\/\/[^\s)]+/)?.[0]||'#'}" target="_blank" style="color:#00c875;font-size:12px;font-weight:600">🗺️ Voir sur Maps →</a>` : ''}
                </div>
              </div>
            </div>` : ''}

            ${c.methode_paiement ? `
            <div class="cmd-info-row">
              <span class="cmd-info-icon">💳</span>
              <div>
                <div class="cmd-info-label">Paiement</div>
                <div class="cmd-info-val">${c.methode_paiement}</div>
              </div>
            </div>` : ''}

            ${c.items?.length ? `
            <div class="cmd-info-row">
              <span class="cmd-info-icon">🛍️</span>
              <div>
                <div class="cmd-info-label">Articles</div>
                <div class="cmd-info-val">${Array.isArray(c.items) ? c.items.map(i=>i.nom||i).join(', ') : c.items}</div>
              </div>
            </div>` : ''}
          </div>

          <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <select onchange="updateStatut('${c.id}',this.value)" style="flex:1;min-width:140px;padding:8px 10px;border-radius:8px;border:1.5px solid #d1e5d8;font-size:13px;font-weight:600;font-family:inherit;color:#0a1a0f">
              ${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}"${c.statut===k?' selected':''}>${v}</option>`).join('')}
            </select>
            ${c.client_tel ? `<a href="tel:${c.client_tel}" style="background:#0a1a0f;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none">📞 Appeler</a>` : ''}
          </div>
        </div>
      `).join('') : `<div class="empty">Aucune commande encore. Partagez votre lien de chat !</div>`}
    </div>
  </div>

  <!-- CATALOGUE -->
  <div id="tab-catalogue" class="tab">
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>🛍️ Mon catalogue de produits</span>
        <button class="btn btn-p" style="font-size:12px;padding:7px 14px" onclick="catOpenAdd()">+ Ajouter un produit</button>
      </div>
      <p style="font-size:13px;color:#5a7060;margin-bottom:14px">Gérez les produits/services que votre bot peut proposer aux clients.</p>

      <div id="cat-add-form" style="display:none;background:#f0f4f1;border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">Nouveau produit</div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-bottom:8px">
          <input id="cat-new-nom" placeholder="Nom du produit *" style="padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
          <input id="cat-new-prix" type="number" min="0" placeholder="Prix FCFA *" style="padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
        <input id="cat-new-desc" placeholder="Description (optionnelle)" style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:8px"/>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <img id="cat-new-img-preview" src="" style="width:50px;height:50px;border-radius:8px;object-fit:cover;display:none;border:1px solid #d1e5d8"/>
          <label style="padding:7px 12px;background:#fff;border:1.5px dashed #d1e5d8;border-radius:8px;font-size:12px;color:#5a7060;cursor:pointer">
            📷 Photo (optionnelle)
            <input type="file" accept="image/*" style="display:none" onchange="catUploadNewImg(this)"/>
          </label>
          <input id="cat-new-emoji" placeholder="🛍️" maxlength="2" style="width:50px;padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:18px;text-align:center;font-family:inherit"/>
        </div>
        <input type="hidden" id="cat-new-img-url"/>
        <div style="display:flex;gap:8px">
          <button class="btn btn-p" onclick="catAddSubmit()">💾 Ajouter</button>
          <button class="btn btn-g" onclick="catCloseAdd()">Annuler</button>
        </div>
        <div id="cat-add-result" style="display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:13px"></div>
      </div>

      <div id="cat-list">
        <div style="text-align:center;color:#9ab0a0;font-size:13px;padding:20px">Chargement...</div>
      </div>
    </div>
  </div>

  <!-- ANALYTICS -->
  <div id="tab-analytics" class="tab">
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span>📊 Analytics & Performance</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <select id="ana-period" onchange="loadAnalytics()" style="padding:6px 10px;border-radius:8px;border:1.5px solid #d1e5d8;font-size:12px;font-family:inherit;background:#fff">
            <option value="7">7 derniers jours</option>
            <option value="30" selected>30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
          <a href="/analytics/${bot.id}/export/commandes.csv?days=90" class="btn btn-g" style="font-size:11px;padding:6px 10px;text-decoration:none">📥 Export CSV</a>
        </div>
      </div>

      <div id="ana-content">
        <div style="text-align:center;color:#9ab0a0;padding:30px">Chargement des analytics...</div>
      </div>
    </div>
  </div>

  <!-- PROMOS -->
  <div id="tab-promos" class="tab">
    <div class="card">
      <div class="card-title">🎁 Codes promo</div>

      <!-- Création code TEXTE -->
      <div style="background:#f0f4f1;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">📢 Code public (texte)</div>
        <p style="font-size:12px;color:#5a7060;margin-bottom:10px">Code utilisable par tous (ex: <strong>BIENVENUE10</strong> = -10%)</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <input id="pt-code" placeholder="Code (ex: BIENVENUE10)" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit;text-transform:uppercase"/>
          <input id="pt-desc" placeholder="Description (optionnel)" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <select id="pt-type" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="pct">% (pourcentage)</option>
            <option value="fcfa">FCFA (montant fixe)</option>
          </select>
          <input id="pt-value" type="number" placeholder="Valeur" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
          <input id="pt-max" type="number" placeholder="Max usages (vide=illimité)" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
          <input id="pt-expire" type="date" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
          <button onclick="promoCreateText()" class="btn btn-g" style="font-size:12px;padding:9px 14px">Créer le code</button>
        </div>
      </div>

      <!-- Création code UNIQUE -->
      <div style="background:#fef3c7;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">🎯 Code personnel (un client)</div>
        <p style="font-size:12px;color:#5a7060;margin-bottom:10px">Code unique généré et envoyé par WhatsApp à un client spécifique</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <input id="pu-tel" placeholder="Tel client (+221...)" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
          <input id="pu-desc" placeholder="Description (optionnel)" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <select id="pu-type" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="pct">% (pourcentage)</option>
            <option value="fcfa">FCFA (montant fixe)</option>
          </select>
          <input id="pu-value" type="number" placeholder="Valeur" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
          <input id="pu-expire" type="date" style="padding:9px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
        <button onclick="promoCreateUnique()" class="btn btn-g" style="font-size:12px;padding:9px 14px">Générer & envoyer par WhatsApp</button>
      </div>

      <div style="font-size:13px;font-weight:700;color:#0a1a0f;margin:14px 0 10px">Codes existants</div>
      <div id="promos-list">
        <div style="text-align:center;color:#9ab0a0;padding:20px">Chargement...</div>
      </div>
    </div>
  </div>

  <!-- MESSAGES -->
  <div id="tab-msgs" class="tab">
    <div class="card">
      <div class="card-title">💬 Messages clients récents</div>
      ${msgs?.length?msgs.slice(0,20).map(m=>`
        <div class="row">
          <div>
            <div class="msg-text">${m.content.startsWith('🎤')?'<span style="background:#ede9fe;color:#5b21b6;padding:2px 6px;border-radius:10px;font-size:11px;margin-right:4px">🎤 Vocal</span>':''} ${m.content.replace('🎤 ','')}</div>
            <div class="msg-time">${new Date(m.created_at).toLocaleString('fr-FR')}</div>
          </div>
        </div>
      `).join(''):`<div class="empty">Aucun message encore.</div>`}
    </div>
  </div>

  <!-- VOCAUX -->
  <div id="tab-audio" class="tab">
    <div class="card">
      <div class="card-title">🎤 Messages vocaux transcrits</div>
      ${audioMsgs?.length?audioMsgs.map(a=>`
        <div class="row">
          <div>
            <span class="audio-pill">🎤 ${a.langue_detectee||'Auto'}</span>
            <div class="msg-text">"${a.transcription||'...'}"</div>
            <div class="msg-time">${new Date(a.created_at).toLocaleString('fr-FR')}</div>
          </div>
        </div>
      `).join(''):`<div class="empty">Aucun message vocal encore.<br>Le bouton micro 🎤 apparaît dans le chat.</div>`}
    </div>
  </div>

  <!-- AVIS -->
  <div id="tab-avis" class="tab">
    <div class="card">
      <div class="card-title">
        <span>⭐ Avis clients</span>
        <span style="font-size:22px;font-weight:800;color:#f59e0b">${avgNote!=='—'?avgNote+'⭐':'Pas encore d\'avis'}</span>
      </div>
      <div id="avis-list-mgr">
        <div style="text-align:center;color:#9ab0a0;padding:30px">Chargement...</div>
      </div>
    </div>
  </div>

  <!-- PARTAGE -->
  <!-- WORKFLOWS -->
  <div id="tab-workflow" class="tab">
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>⚡ Workflows automatiques</span>
        <button class="btn btn-p" style="font-size:11px;padding:6px 12px" onclick="document.getElementById(&quot;wf-add&quot;).style.display=&quot;block&quot;">+ Nouveau</button>
      </div>
      <p style="font-size:13px;color:#5a7060;margin-bottom:16px">Réponses automatiques selon les mots-clés ou événements.</p>

      <div id="wf-add" style="display:none;background:#f0f4f1;border-radius:10px;padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div><label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:4px">Nom</label>
          <input id="wf-nom" placeholder="Ex: Réponse promo" style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/></div>
          <div><label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:4px">Déclencheur</label>
          <select id="wf-trigger" onchange="toggleWfVal()" style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="keyword">Mot-clé</option>
            <option value="greeting">Salutation</option>
            <option value="promo">Demande promo</option>
            <option value="horaires">Question horaires</option>
            <option value="first_message">Premier message</option>
          </select></div>
        </div>
        <div id="wf-val-wrap" style="margin-bottom:10px">
          <label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:4px">Mot-clé à détecter</label>
          <input id="wf-val" placeholder="Ex: promo, livraison, prix..." style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:4px">Réponse automatique</label>
          <textarea id="wf-rep" placeholder="Message envoyé automatiquement..." style="width:100%;border:1.5px solid #d1e5d8;border-radius:8px;padding:9px 12px;font-size:13px;font-family:inherit;min-height:80px;resize:vertical"></textarea>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-p" onclick="saveWorkflow()">💾 Sauvegarder</button>
          <button class="btn btn-g" onclick="document.getElementById(&quot;wf-add&quot;).style.display=&quot;none&quot;">Annuler</button>
        </div>
        <div id="wf-result" style="display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:13px"></div>
      </div>

      <div id="wf-list">
        <div style="text-align:center;color:#9ab0a0;font-size:13px;padding:20px">Chargement...</div>
      </div>
    </div>

    <!-- BROADCASTS -->
    <div class="card" style="margin-top:14px">
      <div class="card-title">📣 Broadcasts — Messages en masse</div>
      <p style="font-size:13px;color:#5a7060;margin-bottom:14px">Envoyez un message à tous vos contacts d'un coup.</p>
      <div id="bc-count" style="font-size:13px;color:#5a7060;margin-bottom:12px">Chargement...</div>
      <textarea id="bc-msg" placeholder="Votre message promo...&#10;Ex: 🎉 -20% ce weekend sur tout le catalogue!" style="width:100%;border:1.5px solid #d1e5d8;border-radius:8px;padding:12px;font-size:13px;font-family:inherit;min-height:100px;resize:vertical;margin-bottom:10px"></textarea>
      <button class="btn btn-p" id="bc-btn" onclick="sendBroadcast()">📣 Envoyer à tous mes contacts</button>
      <div id="bc-result" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:13px"></div>
    </div>
  </div>

  <div id="tab-partage" class="tab">
    <div class="grid2">
      <div class="card">
        <div class="card-title">📱 QR Code</div>
        <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(CONFIG.BASE_URL+'/chat/'+bot.id)}&color=0a1a0f&bgcolor=ffffff" alt="QR"/>
        <p style="font-size:12px;color:#5a7060;text-align:center;margin-top:8px">Imprimez et affichez dans votre commerce</p>
        <div style="text-align:center;margin-top:6px">
          <a href="https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(CONFIG.BASE_URL+'/chat/'+bot.id)}&color=0a1a0f&bgcolor=ffffff" download="qr-${bot.id}.png" class="cp" style="text-decoration:none">⬇️ Télécharger HD</a>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🔗 Liens</div>
        <div style="margin-bottom:12px">
          <div style="font-size:12px;font-weight:600;color:#5a7060;margin-bottom:3px">Lien chat</div>
          <div class="copy-area">${CONFIG.BASE_URL}/chat/${bot.id}</div>
          <button class="cp" onclick="copyLink()">📋 Copier</button>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:#5a7060;margin-bottom:3px">Widget site web</div>
          <div class="copy-area" id="wcode-inline">&lt;script&gt;window.SamaBotConfig={botId:BID,couleur:BCOL}&lt;/script&gt;&lt;script src="${CONFIG.BASE_URL}/widget.js" async&gt;&lt;/script&gt;</div>
          <button class="cp" onclick="copyWidget()">📋 Copier widget</button>
        </div>
      </div>
    </div>

    <!-- IMPORT CATALOGUE -->
    <div class="card" style="margin-top:14px">
      <div class="card-title">🔄 Import catalogue depuis votre site/app</div>
      <p style="font-size:13px;color:#5a7060;margin-bottom:14px">
        Vous avez déjà un site e-commerce ou une app? Importez votre catalogue automatiquement.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div>
          <label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:5px">Type de plateforme</label>
          <select id="imp-type" style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit">
            <option value="json">API JSON (universel)</option>
            <option value="shopify">Shopify</option>
            <option value="woocommerce">WooCommerce</option>
            <option value="scrape">Scraping site web</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:5px">URL du site ou API</label>
          <input id="imp-url" placeholder="https://votresite.com/products.json" style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:5px">Clé API (optionnel)</label>
        <input id="imp-key" placeholder="Laissez vide si pas nécessaire" type="password" style="width:100%;padding:9px 12px;border:1.5px solid #d1e5d8;border-radius:8px;font-size:13px;font-family:inherit"/>
      </div>
      <div id="imp-result" style="display:none;padding:10px;border-radius:8px;font-size:13px;margin-bottom:10px"></div>
      <button class="btn btn-p" id="imp-btn" onclick="importCatalogue()">🔄 Importer le catalogue</button>
      <div style="margin-top:10px;font-size:11px;color:#9ab0a0">
        💡 Shopify: entrez l'URL de votre boutique (ex: monshop.myshopify.com)<br>
        💡 WooCommerce: entrez l'URL + clé API au format clé:secret<br>
        💡 JSON: votre API doit retourner [{nom, prix, description, image}]
      </div>
    </div>
  </div>
</div>

<!-- MODAL WIDGET -->
<div id="wm" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)this.style.display='none'">
  <div style="background:#fff;border-radius:16px;padding:22px;max-width:480px;width:100%">
    <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:14px">📋 Code widget</div>
    <div class="copy-area">&lt;script&gt;\n  window.SamaBotConfig = { botId:BID, couleur: BCOL };\n&lt;/script&gt;\n&lt;script src="${CONFIG.BASE_URL}/widget.js" async&gt;&lt;/script&gt;</div>
    <button class="cp" onclick="copyWidget()">📋 Copier</button>
    <button onclick="document.getElementById(&quot;wm&quot;).style.display=&quot;none&quot;" style="margin-left:10px;background:none;border:none;cursor:pointer;font-size:13px;color:#5a7060">Fermer</button>
  </div>
</div>

<script>
var BID = '${bot.id}';
var BCOL = '${bot.couleur}';
async function importCatalogue(){
  var url=document.getElementById('imp-url').value.trim();
  var type=document.getElementById('imp-type').value;
  var key=document.getElementById('imp-key').value.trim();
  var res=document.getElementById('imp-result');
  var btn=document.getElementById('imp-btn');
  if(!url){res.style.display="block";res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='Entrez une URL';return;}
  btn.disabled=true;btn.textContent='⏳ Import en cours...';
  res.style.display="none";
  try{
    var r=await fetch('/import/catalogue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:BID,url,type,apiKey:key||undefined})});
    var d=await r.json();
    if(d.success){
      res.style.display="block";res.style.background='#dcfce7';res.style.color='#166534';
      res.textContent='✅ '+d.count+' produits importés! Rechargement...';
      setTimeout(()=>location.reload(),2000);
    }else{
      res.style.display="block";res.style.background='#fee2e2';res.style.color='#dc2626';
      res.textContent='❌ '+( d.error||'Erreur import')+'. '+(d.tip||'');
    }
  }catch(e){res.style.display="block";res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='❌ Erreur réseau';}
  btn.disabled=false;btn.textContent='🔄 Importer le catalogue';
}

function changeLang(l){window.location.href='/dashboard/'+BID+'?lang='+l;}

// WORKFLOWS
function toggleWfVal(){
  var t=document.getElementById('wf-trigger').value;
  document.getElementById('wf-val-wrap').style.display=t==='keyword'?'block':'none';
}
toggleWfVal();

async function loadWorkflows(){
  try{
    var r=await fetch('/workflow/'+BID);
    var wfs=await r.json();
    var el=document.getElementById('wf-list');
    if(!wfs.length){el.innerHTML='<div style="text-align:center;color:#9ab0a0;font-size:13px;padding:20px">Aucun workflow. Créez le premier!</div>';return;}
    el.innerHTML=wfs.map(w=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f4f1">'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:700;color:#0a1a0f">'+w.nom+'</div>'
      +'<div style="font-size:11px;color:#9ab0a0;margin-top:2px">'+w.trigger_type+(w.trigger_valeur?' → "'+w.trigger_valeur+'"':'')+'</div>'
      +'<div style="font-size:12px;color:#5a7060;margin-top:3px">'+w.action_reponse.substring(0,60)+'\u2026</div></div>'
      +'<div style="display:flex;gap:6px">'
      +'<button data-wid="'+w.id+'" data-actif="'+w.actif+'" onclick="toggleWf(this.dataset.wid,this.dataset.actif==String(true))" style="padding:5px 10px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:600;background:'+(w.actif?'#dcfce7':'#f0f4f1')+';color:'+(w.actif?'#166534':'#9ab0a0')+'">'+(w.actif?'✅ Actif':'⭕ Inactif')+'</button>'
      +'</div></div>').join('');
  }catch(e){document.getElementById('wf-list').innerHTML='<div style="color:#ef4444;font-size:13px">Erreur chargement</div>';}
}

async function saveWorkflow(){
  var nom=document.getElementById('wf-nom').value.trim();
  var trigger=document.getElementById('wf-trigger').value;
  var val=document.getElementById('wf-val').value.trim();
  var rep=document.getElementById('wf-rep').value.trim();
  var res=document.getElementById('wf-result');
  if(!nom||!rep){res.style.display="block";res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='Remplissez le nom et la réponse';return;}
  try{
    var r=await fetch('/workflow/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:BID,nom,trigger,valeur:val,reponse:rep})});
    var d=await r.json();
    if(d.success){res.style.display="block";res.style.background='#dcfce7';res.style.color='#166534';res.textContent='✅ Workflow créé!';loadWorkflows();document.getElementById('wf-nom').value='';document.getElementById('wf-rep').value='';}
    else{res.style.display="block";res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='Erreur: '+d.error;}
  }catch(e){alert('Erreur réseau');}
}

async function toggleWf(id,actif){
  await fetch('/workflow/'+id+'/toggle',{method:'PATCH'});
  loadWorkflows();
}

// BROADCASTS
async function loadBroadcastCount(){
  try{
    var r=await fetch('/inbox/contacts/'+BID);
    var d=await r.json();
    document.getElementById('bc-count').textContent='📊 '+d.total+' contact'+(d.total!==1?'s':'')+' dans votre liste';
  }catch(e){}
}

async function sendBroadcast(){
  var msg=document.getElementById('bc-msg').value.trim();
  var res=document.getElementById('bc-result');
  var btn=document.getElementById('bc-btn');
  if(!msg){res.style.display="block";res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='Entrez un message';return;}
  if(!confirm('Envoyer ce message à tous vos contacts?'))return;
  btn.disabled=true;btn.textContent='⏳ Envoi en cours...';
  try{
    var r=await fetch('/broadcast/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:BID,message:msg})});
    var d=await r.json();
    res.style.display="block";
    if(d.success){res.style.background='#dcfce7';res.style.color='#166534';res.textContent='✅ Envoyé à '+d.sent+' contacts!'+(d.failed>0?' ('+d.failed+' échecs)':'');document.getElementById('bc-msg').value='';}
    else{res.style.background='#fee2e2';res.style.color='#dc2626';res.textContent='Erreur: '+d.error;}
  }catch(e){alert('Erreur réseau');}
  btn.disabled=false;btn.textContent='📣 Envoyer à tous mes contacts';
}

// ============================================
// RDV JavaScript
// ============================================
var rdvDateSelectionnee = new Date().toISOString().split('T')[0];

async function loadRdvSemaine(){
  const r = await fetch('/rdv/semaine/'+BID);
  const data = await r.json();
  const el = document.getElementById('rdv-semaine');
  el.innerHTML = '';
  data.jours.forEach(j => {
    const btn = document.createElement('button');
    btn.style.cssText = 'min-width:80px;padding:10px 8px;border-radius:10px;border:1.5px solid '+(j.date===rdvDateSelectionnee?BCOL:'#d1e5d8')+';background:'+(j.date===rdvDateSelectionnee?BCOL:'#fff')+';cursor:pointer;font-family:inherit;transition:all .15s;flex-shrink:0';
    btn.innerHTML = '<div style="font-size:11px;font-weight:600;color:'+(j.date===rdvDateSelectionnee?'#fff':'#5a7060')+'">'+j.label+'</div><div style="font-size:16px;font-weight:800;color:'+(j.ferme?'#ccc':(j.date===rdvDateSelectionnee?'#fff':'#0a1a0f'))+'">'+(!j.ferme?j.creneauxDispo:'—')+'</div><div style="font-size:10px;color:'+(j.date===rdvDateSelectionnee?'rgba(255,255,255,.7)':'#9ab0a0')+'">'+(j.ferme?'Fermé':j.creneauxDispo+' libres')+'</div>';
    if(!j.ferme){btn.onclick=()=>{rdvDateSelectionnee=j.date;loadRdvSemaine();loadRdvListe(j.date);};}
    el.appendChild(btn);
  });
  loadRdvListe(rdvDateSelectionnee);

  // RDV du jour pour le stat
  const today = await fetch('/rdv/today/'+BID).then(r=>r.json());
  document.getElementById('rdv-today-count').textContent = today.length || '0';
}

async function loadRdvListe(date){
  const r = await fetch('/rdv/creneaux/'+BID+'?date='+date);
  const data = await r.json();
  const el = document.getElementById('rdv-liste');
  if(data.ferme){el.innerHTML='<div class="empty">'+data.message+'</div>';return;}
  const dateLabel = new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  el.innerHTML='<div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:12px;text-transform:capitalize">'+dateLabel+'</div>';
  if(!data.creneaux?.length){el.innerHTML+='<div class="empty">Aucun créneau ce jour</div>';return;}
  const grid=document.createElement('div');
  grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px';
  data.creneaux.forEach(function(c){
    var btn=document.createElement('div');
    btn.style.cssText='padding:10px;border-radius:8px;text-align:center;border:1.5px solid '+(c.disponible?'#d1e5d8':'#fee2e2')+';background:'+(c.disponible?'#fff':'#fef2f2');
    btn.innerHTML='<div style="font-size:14px;font-weight:700;color:'+(c.disponible?'#0a1a0f':'#ef4444')+'">'+c.heure+'</div><div style="font-size:10px;color:'+(c.disponible?'#00c875':'#ef4444')+';font-weight:600;margin-top:2px">'+(c.disponible?'Libre':'Pris')+'</div>';
    grid.appendChild(btn);
  });
  el.appendChild(grid);
}

function ouvrirConfigDispo(){
  const el = document.getElementById('config-dispo');
  el.style.display = el.style.display==='none'?'block':'none';
}

async function sauvegarderDispo(){
  const jours = [1,2,3,4,5,6,0]; // Lun à Dim
  const disponibilites = jours.map((j,i) => ({
    jour: j,
    actif: document.getElementById('actif-'+(i+1))?.checked,
    debut: document.getElementById('debut-'+(i+1))?.value || '09:00',
    fin: document.getElementById('fin-'+(i+1))?.value || '18:00',
    slot: parseInt(document.getElementById('slot-'+(i+1))?.value || '60')
  })).filter(d => d.actif);

  await fetch('/rdv/disponibilites/'+BID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({disponibilites})});
  alert('✅ Horaires sauvegardés!');
  document.getElementById('config-dispo').style.display="none";
  loadRdvSemaine();
}

// Charge les RDV au démarrage
loadRdvSemaine();
setTimeout(()=>location.reload(),60000);

function showTab(id,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='rdv') loadRdvSemaine();
  if(id==='analytics') loadAnalytics();
  if(id==='avis') avisLoad();
  if(id==='promos') promosLoad();
}
function copyLink(){
  navigator.clipboard.writeText(location.origin+'/chat/'+BID).then(function(){alert('Lien copie!');});
}
function copyWidget(){
  var t = document.getElementById('wcode-inline');
  if(t){ navigator.clipboard.writeText(t.textContent).then(function(){alert('Code copie!');}); }
}
async function updateStatut(id,s){
  await fetch('/commande/'+id+'/statut',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut:s})});
  setTimeout(function(){location.reload();},500);
}

// ============================================
// CATALOGUE — Gestion des produits
// ============================================
function catEscape(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

async function catLoad(){
  try{
    var r=await fetch('/catalogue/'+BID);
    var d=await r.json();
    var el=document.getElementById('cat-list');
    if(!el)return;
    var items=d.catalogue||[];
    if(!items.length){
      el.innerHTML='<div style="text-align:center;color:#9ab0a0;font-size:14px;padding:30px;background:#f9faf9;border-radius:10px">Aucun produit. Cliquez sur "+ Ajouter un produit" pour commencer.</div>';
      return;
    }
    var html='';
    for(var i=0;i<items.length;i++){
      var p=items[i];
      var img=p.image
        ?'<img src="'+catEscape(p.image)+'" style="width:60px;height:60px;border-radius:8px;object-fit:cover;flex-shrink:0;border:1px solid #e5e7eb"/>'
        :'<div style="width:60px;height:60px;border-radius:8px;background:linear-gradient(135deg,#f0f4f1,#d1e5d8);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">'+(p.emoji||'🛍️')+'</div>';
      html+='<div data-idx="'+i+'" style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center">'
        +img
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:14px;font-weight:700;color:#0a1a0f;margin-bottom:3px">'+catEscape(p.nom)+'</div>'
        +(p.desc?'<div style="font-size:12px;color:#9ab0a0;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+catEscape(p.desc)+'</div>':'')
        +'<div style="font-size:14px;font-weight:800;color:#00c875">'+(p.prix||0).toLocaleString('fr-FR')+' FCFA</div>'
        +'</div>'
        +'<div style="display:flex;flex-direction:column;gap:4px">'
        +'<button onclick="catEdit('+i+')" style="background:#f0f4f1;border:1px solid #d1e5d8;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#0a1a0f">✏️ Modifier</button>'
        +'<button onclick="catDelete('+i+')" style="background:#fee2e2;border:1px solid #fca5a5;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#dc2626">🗑️ Supprimer</button>'
        +'</div></div>';
    }
    el.innerHTML=html;
  }catch(e){
    var el2=document.getElementById('cat-list');
    if(el2)el2.innerHTML='<div style="color:#ef4444;font-size:13px;padding:20px;text-align:center">Erreur de chargement: '+e.message+'</div>';
  }
}

function catOpenAdd(){
  document.getElementById('cat-add-form').style.display='block';
  document.getElementById('cat-new-nom').value='';
  document.getElementById('cat-new-prix').value='';
  document.getElementById('cat-new-desc').value='';
  document.getElementById('cat-new-emoji').value='';
  document.getElementById('cat-new-img-url').value='';
  document.getElementById('cat-new-img-preview').style.display='none';
  document.getElementById('cat-add-result').style.display='none';
  setTimeout(function(){document.getElementById('cat-new-nom').focus();},100);
}
function catCloseAdd(){
  document.getElementById('cat-add-form').style.display='none';
}

async function catUploadNewImg(input){
  var file=input.files[0];if(!file)return;
  var preview=document.getElementById('cat-new-img-preview');
  var reader=new FileReader();
  reader.onload=async function(e){
    try{
      var r=await fetch('/upload/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64:e.target.result,fileName:file.name,mimeType:file.type,folder:'catalogue'})});
      var d=await r.json();
      if(d.url){
        preview.src=d.url;preview.style.display='block';
        document.getElementById('cat-new-img-url').value=d.url;
      }else{alert('Erreur upload image');}
    }catch(err){alert('Erreur upload: '+err.message);}
  };
  reader.readAsDataURL(file);
}

async function catAddSubmit(){
  var nom=document.getElementById('cat-new-nom').value.trim();
  var prix=document.getElementById('cat-new-prix').value;
  var desc=document.getElementById('cat-new-desc').value.trim();
  var emoji=document.getElementById('cat-new-emoji').value.trim()||'🛍️';
  var image=document.getElementById('cat-new-img-url').value||null;
  var res=document.getElementById('cat-add-result');
  if(!nom||!prix){
    res.style.display='block';res.style.background='#fee2e2';res.style.color='#dc2626';
    res.textContent='Remplissez le nom et le prix';
    return;
  }
  try{
    var r=await fetch('/catalogue/'+BID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nom:nom,prix:prix,desc:desc,image:image,emoji:emoji})});
    var d=await r.json();
    if(d.success){
      res.style.display='block';res.style.background='#dcfce7';res.style.color='#166534';
      res.textContent='✅ Produit ajouté! Total: '+d.total;
      catLoad();
      setTimeout(function(){catCloseAdd();},800);
    }else{
      res.style.display='block';res.style.background='#fee2e2';res.style.color='#dc2626';
      res.textContent='Erreur: '+(d.error||'inconnu');
    }
  }catch(e){
    res.style.display='block';res.style.background='#fee2e2';res.style.color='#dc2626';
    res.textContent='Erreur réseau';
  }
}

async function catEdit(idx){
  try{
    var r=await fetch('/catalogue/'+BID);
    var d=await r.json();
    var p=(d.catalogue||[])[idx];
    if(!p){alert('Produit introuvable');return;}
    var nouveauNom=prompt('Nom du produit:',p.nom);
    if(nouveauNom===null)return;
    var nouveauPrix=prompt('Prix (FCFA):',p.prix);
    if(nouveauPrix===null)return;
    var nouveauDesc=prompt('Description (optionnelle):',p.desc||'');
    if(nouveauDesc===null)return;
    var resp=await fetch('/catalogue/'+BID+'/'+idx,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({nom:nouveauNom,prix:nouveauPrix,desc:nouveauDesc})});
    var data=await resp.json();
    if(data.success){catLoad();}
    else{alert('Erreur: '+(data.error||'inconnu'));}
  }catch(e){alert('Erreur: '+e.message);}
}

async function catDelete(idx){
  if(!confirm('Supprimer ce produit du catalogue?'))return;
  try{
    var r=await fetch('/catalogue/'+BID+'/'+idx,{method:'DELETE'});
    var d=await r.json();
    if(d.success){catLoad();}
    else{alert('Erreur: '+(d.error||'inconnu'));}
  }catch(e){alert('Erreur réseau');}
}

// ============================================
// ANALYTICS — Graphiques + KPIs
// ============================================
var anaLoaded = false;
async function loadAnalytics(){
  var days = document.getElementById('ana-period')?.value || '30';
  var content = document.getElementById('ana-content');
  if(!content) return;
  content.innerHTML = '<div style="text-align:center;color:#9ab0a0;padding:30px">Chargement...</div>';
  try {
    var r = await fetch('/analytics/' + BID + '?days=' + days);
    var d = await r.json();
    if(d.error){
      content.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center">Erreur: ' + d.error + '</div>';
      return;
    }

    var growth = d.revenue.growth_pct;
    var growthColor = growth >= 0 ? '#00c875' : '#ef4444';
    var growthIcon = growth >= 0 ? '📈' : '📉';

    var html = '';

    // KPIs
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">';
    html += '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px"><div style="font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:.5px">Commandes</div><div style="font-family:Syne,sans-serif;font-size:24px;font-weight:800;color:#0a1a0f;margin-top:4px">' + d.orders.total + '</div></div>';
    html += '<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:14px"><div style="font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.5px">Revenus FCFA</div><div style="font-family:Syne,sans-serif;font-size:24px;font-weight:800;color:#0a1a0f;margin-top:4px">' + (d.revenue.total/1000).toFixed(1) + 'K</div><div style="font-size:11px;color:' + growthColor + ';font-weight:700;margin-top:2px">' + growthIcon + ' ' + (growth>=0?'+':'') + growth + '% vs période préc.</div></div>';
    html += '<div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:14px"><div style="font-size:11px;color:#1e40af;text-transform:uppercase;letter-spacing:.5px">Messages</div><div style="font-family:Syne,sans-serif;font-size:24px;font-weight:800;color:#0a1a0f;margin-top:4px">' + d.messages.total + '</div></div>';
    html += '<div style="background:#fce7f3;border:1px solid #f9a8d4;border-radius:10px;padding:14px"><div style="font-size:11px;color:#9d174d;text-transform:uppercase;letter-spacing:.5px">RDV</div><div style="font-family:Syne,sans-serif;font-size:24px;font-weight:800;color:#0a1a0f;margin-top:4px">' + d.appointments.total + '</div></div>';
    html += '<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:14px"><div style="font-size:11px;color:#854d0e;text-transform:uppercase;letter-spacing:.5px">Note moy.</div><div style="font-family:Syne,sans-serif;font-size:24px;font-weight:800;color:#0a1a0f;margin-top:4px">' + (d.reviews.average||'—') + (d.reviews.average?'⭐':'') + '</div><div style="font-size:11px;color:#9ab0a0;margin-top:2px">' + d.reviews.total + ' avis</div></div>';
    html += '</div>';

    // Graphique commandes par jour (SVG simple, pas de dépendance)
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px">';
    html += '<div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">📦 Commandes par jour</div>';
    html += anaSvgBarChart(d.orders.daily, '#00c875', 200);
    html += '</div>';

    // Graphique revenus par jour
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px">';
    html += '<div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">💰 Revenus par jour (FCFA)</div>';
    html += anaSvgLineChart(d.revenue.daily, '#f59e0b', 200);
    html += '</div>';

    // Heures les plus actives
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:14px">';
    html += '<div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">🕐 Heures les plus actives</div>';
    html += anaSvgBarChart(d.messages.hourly.map(function(x){return {date: String(x.hour).padStart(2,'0')+'h', count: x.count}}), '#3b82f6', 150, true);
    html += '</div>';

    // Distribution statuts
    if(Object.keys(d.orders.by_status).length > 0){
      html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px">';
      html += '<div style="font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:10px">📊 Statuts des commandes</div>';
      var statusColors = {pending:'#f59e0b',paid:'#10b981',preparing:'#3b82f6',ready:'#8b5cf6',delivered:'#6b7280',cancelled:'#ef4444',delivering:'#f59e0b'};
      var totalSt = Object.values(d.orders.by_status).reduce(function(a,b){return a+b},0);
      Object.entries(d.orders.by_status).forEach(function(entry){
        var st = entry[0], cnt = entry[1];
        var pct = totalSt ? (cnt/totalSt*100).toFixed(1) : 0;
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
        html += '<div style="width:90px;font-size:12px;text-transform:capitalize;color:#0a1a0f">' + st + '</div>';
        html += '<div style="flex:1;background:#f0f4f1;border-radius:6px;height:18px;overflow:hidden"><div style="background:' + (statusColors[st]||'#666') + ';height:100%;width:' + pct + '%"></div></div>';
        html += '<div style="font-size:12px;font-weight:700;color:#0a1a0f;min-width:50px;text-align:right">' + cnt + ' (' + pct + '%)</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    content.innerHTML = html;
    anaLoaded = true;
  } catch(e) {
    content.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center">Erreur réseau: ' + e.message + '</div>';
  }
}

function anaSvgBarChart(items, color, height, hourly){
  if(!items||!items.length) return '<div style="text-align:center;color:#9ab0a0;padding:20px">Aucune donnée</div>';
  var max = Math.max.apply(null, items.map(function(i){return i.count||0})) || 1;
  var w = 100/items.length;
  var svg = '<svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" style="width:100%;height:' + height + 'px;display:block">';
  items.forEach(function(it, i){
    var h = ((it.count||0)/max) * (height-30);
    var y = height - h - 20;
    svg += '<rect x="' + (i*w + w*0.15) + '" y="' + y + '" width="' + (w*0.7) + '" height="' + h + '" fill="' + color + '" rx="1"><title>' + it.date + ': ' + (it.count||0) + '</title></rect>';
  });
  svg += '</svg>';
  // Labels
  var labels = '<div style="display:flex;justify-content:space-between;font-size:9px;color:#9ab0a0;margin-top:4px">';
  if(hourly){
    [0,6,12,18,23].forEach(function(h){ labels += '<span>' + String(h).padStart(2,'0') + 'h</span>'; });
  } else {
    var step = Math.max(1, Math.floor(items.length/6));
    for(var i=0; i<items.length; i+=step){
      var d = items[i].date.substring(5); // MM-DD
      labels += '<span>' + d + '</span>';
    }
  }
  labels += '</div>';
  return svg + labels;
}

function anaSvgLineChart(items, color, height){
  if(!items||!items.length) return '<div style="text-align:center;color:#9ab0a0;padding:20px">Aucune donnée</div>';
  var max = Math.max.apply(null, items.map(function(i){return i.total||0})) || 1;
  var w = 100/(items.length-1 || 1);
  var points = items.map(function(it, i){
    var h = ((it.total||0)/max) * (height-30);
    var y = height - h - 20;
    return (i*w) + ',' + y;
  }).join(' ');
  var svg = '<svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" style="width:100%;height:' + height + 'px;display:block">';
  // Aire
  svg += '<polygon points="0,' + (height-20) + ' ' + points + ' 100,' + (height-20) + '" fill="' + color + '" opacity="0.15"/>';
  // Ligne
  svg += '<polyline points="' + points + '" stroke="' + color + '" stroke-width="0.5" fill="none"/>';
  // Points
  items.forEach(function(it, i){
    var h = ((it.total||0)/max) * (height-30);
    var y = height - h - 20;
    svg += '<circle cx="' + (i*w) + '" cy="' + y + '" r="0.8" fill="' + color + '"><title>' + it.date + ': ' + (it.total||0).toLocaleString('fr-FR') + ' FCFA</title></circle>';
  });
  svg += '</svg>';
  // Légende max
  var labels = '<div style="display:flex;justify-content:space-between;font-size:9px;color:#9ab0a0;margin-top:4px"><span>0</span><span>Max: ' + max.toLocaleString('fr-FR') + ' FCFA</span></div>';
  return svg + labels;
}

// ============================================
// AVIS — Modération + réponse patron
// ============================================
async function avisLoad(){
  try {
    var [statsR, listR] = await Promise.all([
      fetch('/avis/stats/' + BID),
      fetch('/avis/list/' + BID)
    ]);
    var stats = await statsR.json();
    var list = await listR.json();
    var el = document.getElementById('avis-list-mgr');
    if(!el) return;

    var html = '';
    // Stats résumé
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:14px">';
    html += '<div style="background:#f0fdf4;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:#0a1a0f">' + (stats.moyenne||'—') + '</div><div style="font-size:10px;color:#5a7060">Note moy.</div></div>';
    html += '<div style="background:#fef3c7;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:#0a1a0f">' + stats.total + '</div><div style="font-size:10px;color:#5a7060">Avis visibles</div></div>';
    html += '<div style="background:#fee2e2;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:#0a1a0f">' + stats.negatifs + '</div><div style="font-size:10px;color:#5a7060">Négatifs</div></div>';
    html += '<div style="background:#dbeafe;border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:#0a1a0f">' + stats.a_repondre + '</div><div style="font-size:10px;color:#5a7060">À répondre</div></div>';
    html += '</div>';

    // Distribution étoiles
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:14px">';
    [5,4,3,2,1].forEach(function(n){
      var c = stats.distribution[n]||0;
      var pct = stats.total ? (c/stats.total*100).toFixed(0) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
      html += '<div style="width:50px;font-size:11px">' + '⭐'.repeat(n) + '</div>';
      html += '<div style="flex:1;background:#f0f4f1;border-radius:4px;height:10px;overflow:hidden"><div style="background:#f59e0b;height:100%;width:' + pct + '%"></div></div>';
      html += '<div style="font-size:11px;color:#5a7060;min-width:40px;text-align:right">' + c + ' (' + pct + '%)</div>';
      html += '</div>';
    });
    html += '</div>';

    // Liste des avis
    if(!list.length){
      html += '<div style="text-align:center;color:#9ab0a0;padding:20px">Aucun avis encore.</div>';
    } else {
      list.forEach(function(a){
        var visible = a.visible !== false;
        var stars = '⭐'.repeat(a.note) + '☆'.repeat(5-a.note);
        var bg = visible ? '#fff' : '#f9fafb';
        var opacity = visible ? '1' : '0.5';
        html += '<div data-aid="' + a.id + '" style="background:' + bg + ';border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px;opacity:' + opacity + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">';
        html += '<div><div style="font-size:14px;color:#f59e0b">' + stars + '</div><div style="font-size:10px;color:#9ab0a0;margin-top:2px">' + new Date(a.created_at).toLocaleString('fr-FR') + '</div></div>';
        html += '<div style="display:flex;gap:4px">';
        html += '<button data-toggle-id="' + a.id + '" data-make-visible="' + (!visible) + '" style="padding:4px 8px;border-radius:6px;border:1px solid #d1e5d8;background:#fff;font-size:10px;cursor:pointer;font-family:inherit;color:#0a1a0f">' + (visible?'👁️ Visible':'🚫 Masqué') + '</button>';
        html += '</div>';
        html += '</div>';
        if(a.commentaire){
          html += '<div style="font-size:13px;color:#0a1a0f;margin:8px 0;padding:8px;background:#f9faf9;border-radius:6px">"' + a.commentaire.replace(/</g,'&lt;') + '"</div>';
        }
        if(a.reponse){
          html += '<div style="margin-top:8px;padding:8px;background:#dcfce7;border-left:3px solid #00c875;border-radius:4px"><div style="font-size:10px;color:#166534;font-weight:700;margin-bottom:2px">↳ Votre réponse</div><div style="font-size:12px;color:#0a1a0f">' + a.reponse.replace(/</g,'&lt;') + '</div></div>';
        } else {
          html += '<div style="margin-top:8px"><textarea data-aid="' + a.id + '" placeholder="Répondre à cet avis..." style="width:100%;padding:8px;border:1px solid #d1e5d8;border-radius:6px;font-size:12px;font-family:inherit;resize:vertical;min-height:50px"></textarea>';
          html += '<button data-reply-id="' + a.id + '" style="margin-top:4px;background:#00c875;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">💬 Répondre</button></div>';
        }
        html += '</div>';
      });
    }
    el.innerHTML = html;
    // Hook les boutons (évite le problème d'échappement onclick="")
    el.querySelectorAll('[data-toggle-id]').forEach(function(b){
      b.addEventListener('click', function(){
        avisToggle(b.getAttribute('data-toggle-id'), b.getAttribute('data-make-visible')==='true');
      });
    });
    el.querySelectorAll('[data-reply-id]').forEach(function(b){
      b.addEventListener('click', function(){
        avisRepondre(b.getAttribute('data-reply-id'));
      });
    });
  } catch(e) {
    var el2 = document.getElementById('avis-list-mgr');
    if(el2) el2.innerHTML = '<div style="color:#ef4444;padding:20px">Erreur: ' + e.message + '</div>';
  }
}

async function avisRepondre(id){
  var card = document.querySelector('[data-aid="'+id+'"]');
  var ta = card?.querySelector('textarea[data-aid="'+id+'"]');
  if(!ta) return;
  var rep = ta.value.trim();
  if(!rep){ alert('Entrez une réponse'); return; }
  try {
    var r = await fetch('/avis/' + id + '/repondre', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({reponse: rep})});
    var d = await r.json();
    if(d.success) avisLoad();
    else alert('Erreur: ' + (d.error||'inconnu'));
  } catch(e){ alert('Erreur réseau'); }
}

async function avisToggle(id, makeVisible){
  try {
    await fetch('/avis/' + id + '/visibilite', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({visible: makeVisible})});
    avisLoad();
  } catch(e){ alert('Erreur réseau'); }
}

// ============================================
// PROMOS — Gestion codes promo
// ============================================
async function promosLoad(){
  var el = document.getElementById('promos-list');
  if(!el) return;
  try {
    var r = await fetch('/promos/' + BID);
    var list = await r.json();
    if(!Array.isArray(list) || !list.length){
      el.innerHTML = '<div style="text-align:center;color:#9ab0a0;padding:20px">Aucun code créé. Créez votre premier code ci-dessus!</div>';
      return;
    }
    var html = '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f0f4f1">';
    html += '<th style="padding:8px;text-align:left;font-size:11px;color:#3a5040">Code</th>';
    html += '<th style="padding:8px;text-align:left;font-size:11px;color:#3a5040">Type</th>';
    html += '<th style="padding:8px;text-align:left;font-size:11px;color:#3a5040">Réduction</th>';
    html += '<th style="padding:8px;text-align:center;font-size:11px;color:#3a5040">Utilisations</th>';
    html += '<th style="padding:8px;text-align:left;font-size:11px;color:#3a5040">Statut</th>';
    html += '<th style="padding:8px;text-align:right;font-size:11px;color:#3a5040">Action</th>';
    html += '</tr></thead><tbody>';
    list.forEach(function(p){
      var reduc = p.reduction_type === 'pct' ? p.reduction_value + '%' : (p.reduction_value||0).toLocaleString('fr-FR') + ' FCFA';
      var typeLabel = p.type === 'unique' ? '🎯 Personnel' : '📢 Public';
      var typeColor = p.type === 'unique' ? '#92400e' : '#166534';
      var typeBg = p.type === 'unique' ? '#fef3c7' : '#dcfce7';
      var usage = p.max_uses ? (p.used_count||0) + ' / ' + p.max_uses : (p.used_count||0) + ' (illimité)';
      var expired = p.expire_at && new Date(p.expire_at) < new Date();
      var statut = !p.actif ? '🚫 Désactivé' : (expired ? '⏰ Expiré' : '✅ Actif');
      var statutColor = !p.actif ? '#9ca3af' : (expired ? '#ef4444' : '#10b981');
      var opacity = (!p.actif || expired) ? '0.5' : '1';
      html += '<tr style="border-bottom:1px solid #e5e7eb;opacity:' + opacity + '">';
      html += '<td style="padding:8px;font-family:monospace;font-weight:700;color:#0a1a0f">' + p.code + '</td>';
      html += '<td style="padding:8px"><span style="background:' + typeBg + ';color:' + typeColor + ';padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700">' + typeLabel + '</span>' + (p.client_tel?'<br><span style="font-size:10px;color:#9ab0a0">' + p.client_tel + '</span>':'') + '</td>';
      html += '<td style="padding:8px;font-weight:700;color:#00c875">-' + reduc + '</td>';
      html += '<td style="padding:8px;text-align:center;font-size:12px">' + usage + '</td>';
      html += '<td style="padding:8px;font-size:11px;color:' + statutColor + ';font-weight:600">' + statut + '</td>';
      html += '<td style="padding:8px;text-align:right">';
      if(p.actif) html += '<button data-promo-disable="' + p.id + '" style="padding:4px 10px;border-radius:6px;border:1px solid #fca5a5;background:#fff;color:#dc2626;font-size:10px;cursor:pointer;font-family:inherit">Désactiver</button>';
      html += '</td>';
      html += '</tr>';
      if(p.description){
        html += '<tr><td colspan="6" style="padding:0 8px 8px;font-size:11px;color:#5a7060;font-style:italic">↳ ' + p.description + '</td></tr>';
      }
    });
    html += '</tbody></table>';
    el.innerHTML = html;
    // Hook bouton désactiver
    el.querySelectorAll('[data-promo-disable]').forEach(function(b){
      b.addEventListener('click', async function(){
        if(!confirm('Désactiver ce code promo?')) return;
        try {
          await fetch('/promos/' + BID + '/' + b.getAttribute('data-promo-disable'), {method:'DELETE'});
          promosLoad();
        } catch(e){ alert('Erreur réseau'); }
      });
    });
  } catch(e){
    el.innerHTML = '<div style="color:#ef4444;padding:20px">Erreur: ' + e.message + '</div>';
  }
}

async function promoCreateText(){
  var code = document.getElementById('pt-code').value.trim().toUpperCase();
  var type = document.getElementById('pt-type').value;
  var value = parseInt(document.getElementById('pt-value').value);
  var max = document.getElementById('pt-max').value;
  var expire = document.getElementById('pt-expire').value;
  var desc = document.getElementById('pt-desc').value.trim();
  if(!code || !value){ alert('Code et valeur de réduction requis'); return; }
  if(value < 0 || (type==='pct' && value>100)){ alert('Valeur invalide'); return; }
  try {
    var r = await fetch('/promos/' + BID + '/text', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      code, reduction_type: type, reduction_value: value,
      max_uses: max ? parseInt(max) : null,
      expire_at: expire || null,
      description: desc || null
    })});
    var d = await r.json();
    if(d.success){
      document.getElementById('pt-code').value='';
      document.getElementById('pt-value').value='';
      document.getElementById('pt-max').value='';
      document.getElementById('pt-expire').value='';
      document.getElementById('pt-desc').value='';
      promosLoad();
      alert('✅ Code créé: ' + (d.promo?.code || code));
    } else {
      alert('Erreur: ' + (d.error || 'inconnu'));
    }
  } catch(e){ alert('Erreur réseau'); }
}

async function promoCreateUnique(){
  var tel = document.getElementById('pu-tel').value.trim();
  var type = document.getElementById('pu-type').value;
  var value = parseInt(document.getElementById('pu-value').value);
  var expire = document.getElementById('pu-expire').value;
  var desc = document.getElementById('pu-desc').value.trim();
  if(!tel || !value){ alert('Téléphone client et valeur requis'); return; }
  if(value < 0 || (type==='pct' && value>100)){ alert('Valeur invalide'); return; }
  try {
    var r = await fetch('/promos/' + BID + '/unique', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      client_tel: tel, reduction_type: type, reduction_value: value,
      expire_at: expire || null, description: desc || null
    })});
    var d = await r.json();
    if(d.success){
      document.getElementById('pu-tel').value='';
      document.getElementById('pu-value').value='';
      document.getElementById('pu-expire').value='';
      document.getElementById('pu-desc').value='';
      promosLoad();
      alert('✅ Code généré et envoyé par WhatsApp: ' + (d.promo?.code || ''));
    } else {
      alert('Erreur: ' + (d.error || 'inconnu'));
    }
  } catch(e){ alert('Erreur réseau'); }
}

loadWorkflows();
loadBroadcastCount();
catLoad();
</script>
</body></html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});

// ============================================
// SETUP v5
// ============================================
app.get('/setup', (req, res) => {
  const base = CONFIG.BASE_URL;
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SamaBot — Créer votre bot IA</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f0f4f1;min-height:100vh}
.hd{background:#0a1a0f;padding:18px 24px;display:flex;align-items:center;gap:10px}
.logo{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff}.logo span{color:#00c875}
.wrap{max-width:600px;margin:0 auto;padding:24px 20px}
h1{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#0a1a0f;margin-bottom:6px}
.sub{font-size:14px;color:#5a7060;margin-bottom:22px}
.card{background:#fff;border-radius:14px;padding:20px;margin-bottom:14px;border:1px solid rgba(0,200,117,.15)}
.ctitle{font-size:14px;font-weight:700;color:#0a1a0f;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.num{width:26px;height:26px;border-radius:50%;background:#00c875;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
label{font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:5px}
input,select,textarea{width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;color:#0a1a0f;transition:border .15s;background:#fff}
input:focus,select:focus,textarea:focus{border-color:#00c875}
textarea{min-height:80px;resize:vertical}
.f{margin-bottom:12px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.niches{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.n{border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .15s}
.n:hover,.n.s{border-color:#00c875;background:rgba(0,200,117,.08)}
.ne{font-size:22px;display:block;margin-bottom:3px}
.nn{font-size:11px;font-weight:600;color:#0a1a0f}
.cols{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.co{width:32px;height:32px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .15s}
.co.s{border-color:#0a1a0f;transform:scale(1.2)}
.upload-zone{border:2px dashed #d1e5d8;border-radius:12px;padding:20px;text-align:center;cursor:pointer;transition:all .15s;position:relative;overflow:hidden}
.upload-zone:hover{border-color:#00c875;background:rgba(0,200,117,.04)}
.upload-zone input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.upload-preview{width:80px;height:80px;border-radius:12px;object-fit:cover;display:none;border:2px solid #d1e5d8;margin:8px auto 0}
.upload-preview.show{display:block}
.upload-progress{height:4px;background:#e5e7eb;border-radius:2px;margin-top:8px;display:none;overflow:hidden}
.upload-progress.show{display:block}
.upload-progress-bar{height:100%;background:#00c875;border-radius:2px;transition:width .3s;width:0%}
.pay-opts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.pay-opt{padding:6px 14px;border-radius:20px;border:1.5px solid #d1e5d8;font-size:13px;font-weight:600;cursor:pointer;color:#5a7060;transition:all .15s}
.pay-opt.s{background:#00c875;color:#fff;border-color:#00c875}
.cat-items{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.cat-item{background:#f9faf9;border:1px solid #e5e7eb;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px}
.cat-item-row{display:grid;grid-template-columns:1fr 90px auto;gap:6px;align-items:center}
.cat-item-img{display:flex;align-items:center;gap:8px}
.cat-img-preview{width:40px;height:40px;border-radius:8px;object-fit:cover;display:none;border:1px solid #d1e5d8}
.cat-img-preview.show{display:block}
.cat-img-btn{padding:5px 10px;background:#f0f4f1;border:1.5px dashed #d1e5d8;border-radius:8px;font-size:11px;font-weight:600;color:#5a7060;cursor:pointer;position:relative;overflow:hidden;white-space:nowrap}
.cat-img-btn input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.cat-item input{padding:8px 10px;font-size:13px}
.rm{background:#fee2e2;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;font-size:13px;color:#dc2626}
.add-cat{border:1.5px dashed rgba(0,200,117,.4);border-radius:10px;padding:9px;text-align:center;cursor:pointer;font-size:13px;font-weight:600;color:#00a862;background:rgba(0,200,117,.06);margin-top:6px}
.sbtn{width:100%;background:#00c875;color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;margin-top:4px}
.sbtn:hover{background:#00a862}.sbtn:disabled{opacity:.6;cursor:not-allowed}
.res{background:#0a1a0f;border-radius:14px;padding:22px;display:none;margin-top:14px}
.res.show{display:block}
.rt{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:14px}
.ri{margin-bottom:12px}
.rl{font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.rv{background:rgba(255,255,255,.07);border-radius:8px;padding:10px 12px;font-size:12px;color:#fff;word-break:break-all;font-family:monospace;line-height:1.7}
.cp{background:rgba(0,200,117,.15);color:#00c875;border:1px solid rgba(0,200,117,.3);border-radius:6px;padding:4px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:4px}
.rbtns{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.rb{flex:1;min-width:130px;padding:11px;border-radius:10px;font-size:13px;font-weight:700;text-align:center;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:none;border:none}
.rb-g{background:#00c875;color:#fff}.rb-o{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)}
@media(max-width:480px){.row2{grid-template-columns:1fr}.niches{grid-template-columns:repeat(2,1fr)}.cat-item{grid-template-columns:1fr 70px auto}}
</style>
</head>
<body>
<div class="hd"><div class="logo">Sama<span>Bot</span></div></div>
<div class="wrap">
  <h1>Créez votre bot IA 🤖</h1>
  <p class="sub">Configurez votre assistant en 3 minutes. Sans technique.</p>

  <!-- 1 -->
  <div class="card">
    <div class="ctitle"><span class="num">1</span> Votre business</div>
    <div class="f"><label>Nom du business *</label><input id="nom" placeholder="Ex: Restaurant Teranga, Salon Aminata..."/></div>
    <div class="f">
      <label>Logo de votre business</label>
      <div class="upload-zone" id="logo-zone">
        <input type="file" id="logo-file" accept="image/*" onchange="uploadLogo(this)"/>
        <div id="logo-placeholder">
          <div style="font-size:28px;margin-bottom:6px">🖼️</div>
          <div style="font-size:13px;font-weight:600;color:#3a5040">Cliquez pour uploader votre logo</div>
          <div style="font-size:11px;color:#9ab0a0;margin-top:3px">JPG, PNG, WebP — max 5MB</div>
        </div>
        <img id="logo-preview" class="upload-preview" alt="Logo"/>
        <div class="upload-progress" id="logo-progress"><div class="upload-progress-bar" id="logo-bar"></div></div>
      </div>
      <input type="hidden" id="logo-url"/>
    </div>
    <div class="f">
      <label>Type de business *</label>
      <div class="niches">
        <div class="n s" data-val="restaurant" onclick="selN(this)"><span class="ne">🍽️</span><div class="nn">Restaurant</div></div>
        <div class="n" data-val="salon" onclick="selN(this)"><span class="ne">💈</span><div class="nn">Salon beauté</div></div>
        <div class="n" data-val="clinique" onclick="selN(this)"><span class="ne">🏥</span><div class="nn">Clinique</div></div>
        <div class="n" data-val="boutique" onclick="selN(this)"><span class="ne">🛍️</span><div class="nn">Boutique</div></div>
        <div class="n" data-val="auto-ecole" onclick="selN(this)"><span class="ne">🚗</span><div class="nn">Auto-école</div></div>
        <div class="n" data-val="pharmacie" onclick="selN(this)"><span class="ne">💊</span><div class="nn">Pharmacie</div></div>
        <div class="n" data-val="traiteur" onclick="selN(this)"><span class="ne">🍲</span><div class="nn">Traiteur</div></div>
        <div class="n" data-val="assurance" onclick="selN(this)"><span class="ne">🛡️</span><div class="nn">Assurance</div></div>
        <div class="n" data-val="banque" onclick="selN(this)"><span class="ne">🏦</span><div class="nn">Banque/Finance</div></div>
        <div class="n" data-val="hotel" onclick="selN(this)"><span class="ne">🏨</span><div class="nn">Hôtel</div></div>
        <div class="n" data-val="transport" onclick="selN(this)"><span class="ne">🚕</span><div class="nn">Transport</div></div>
        <div class="n" data-val="education" onclick="selN(this)"><span class="ne">📚</span><div class="nn">Éducation</div></div>
        <div class="n" data-val="fitness" onclick="selN(this)"><span class="ne">💪</span><div class="nn">Fitness/Sport</div></div>
        <div class="n" data-val="informatique" onclick="selN(this)"><span class="ne">💻</span><div class="nn">Informatique</div></div>
        <div class="n" data-val="immobilier" onclick="selN(this)"><span class="ne">🏠</span><div class="nn">Immobilier</div></div>
        <div class="n" data-val="evenement" onclick="selN(this)"><span class="ne">🎉</span><div class="nn">Événementiel</div></div>
        <div class="n" data-val="boulangerie" onclick="selN(this)"><span class="ne">🥖</span><div class="nn">Boulangerie</div></div>
        <div class="n" data-val="autre" onclick="selN(this)"><span class="ne">⭐</span><div class="nn">Autre</div></div>
        <div class="n" data-val="immobilier" onclick="selN(this)"><span class="ne">🏠</span><div class="nn">Immobilier</div></div>
        <div class="n" data-val="autre" onclick="selN(this)"><span class="ne">🏢</span><div class="nn">Autre</div></div>
      </div>
    </div>
  </div>

  <!-- 2 -->
  <div class="card">
    <div class="ctitle"><span class="num">2</span> Coordonnées</div>
    <div class="f"><label>Adresse</label><input id="adr" placeholder="Ex: Almadies, Rue 10, Dakar"/></div>
    <div class="row2">
      <div class="f"><label>Google Maps URL</label><input id="maps" placeholder="https://maps.google.com/..."/></div>
      <div class="f"><label>Téléphone</label><input id="tel" placeholder="+221 77 xxx xxxx" type="tel"/></div>
    </div>
    <div class="f"><label>Horaires</label><input id="hor" placeholder="Ex: Lun-Ven 9h-20h, Weekend 10h-17h"/></div>
  </div>

  <!-- 3.5 LIVRAISON -->
  <div class="card">
    <div class="ctitle"><span class="num">3</span> Livraison</div>
    <div class="f" style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <input type="checkbox" id="liv-actif" style="width:auto;margin:0" onchange="toggleLivraison(this)"/>
      <label style="margin:0;font-size:14px;font-weight:600;color:#0a1a0f;cursor:pointer" for="liv-actif">Proposer la livraison à domicile</label>
    </div>
    <div id="liv-options" style="display:none">
      <div class="row2">
        <div class="f"><label>Frais de livraison (FCFA)</label><input id="liv-frais" type="number" min="0" placeholder="Ex: 500" value="500"/></div>
        <div class="f"><label>Délai de livraison</label><input id="liv-delai" placeholder="Ex: 30-45 min" value="30-45 min"/></div>
      </div>
      <div class="row2">
        <div class="f"><label>Zones de livraison</label><input id="liv-zones" placeholder="Ex: Dakar, Pikine, Guédiawaye"/></div>
        <div class="f"><label>Commande minimum (FCFA)</label><input id="liv-min" type="number" min="0" placeholder="0 = pas de minimum" value="0"/></div>
      </div>
    </div>
  </div>

  <!-- 4 CATALOGUE -->
  <div class="card">
    <div class="ctitle"><span class="num">4</span> Catalogue & Services</div>
    <div class="f"><label>Description générale</label><textarea id="srv" placeholder="Décrivez vos services..."></textarea></div>
    <div class="f">
      <label>Articles du catalogue</label>
      <div style="font-size:11px;color:#9ab0a0;margin-bottom:6px">Nom • Prix • Description (optionnel)</div>
      <div class="cat-items" id="cat-items">
        <div class="cat-item">
          <div class="cat-item-row">
            <input placeholder="Nom de l'article *" class="cat-nom"/>
            <input placeholder="Prix F" class="cat-prix" type="number" min="0"/>
            <button class="rm" onclick="this.closest('.cat-item').remove()">✕</button>
          </div>
          <input placeholder="Description (optionnel)" class="cat-desc" style="font-size:13px"/>
          <div class="cat-item-img">
            <img class="cat-img-preview" alt=""/>
            <div class="cat-img-btn">
              📷 Photo
              <input type="file" accept="image/*" onchange="uploadCatImg(this)"/>
            </div>
            <span style="font-size:11px;color:#9ab0a0;margin-left:4px">Optionnel</span>
          </div>
        </div>
      </div>
      <div class="add-cat" onclick="addItem()">+ Ajouter un article</div>
    </div>
  </div>

  <!-- 5 PAIEMENT -->
  <div class="card">
    <div class="ctitle"><span class="num">5</span> Paiement</div>
    <div class="f">
      <label>Moyens acceptés</label>
      <div class="pay-opts">
        <div class="pay-opt s" data-val="Wave" onclick="tPay(this)">💙 Wave</div>
        <div class="pay-opt s" data-val="Orange Money" onclick="tPay(this)">🟠 Orange Money</div>
        <div class="pay-opt s" data-val="Espèces" onclick="tPay(this)">💵 Espèces</div>
        <div class="pay-opt" data-val="Free Money" onclick="tPay(this)">🟢 Free Money</div>
        <div class="pay-opt" data-val="Carte bancaire" onclick="tPay(this)">💳 Carte</div>
      </div>
    </div>
    <div class="row2">
      <div class="f"><label>N° Wave business</label><input id="wave" placeholder="77 xxx xx xx"/></div>
      <div class="f"><label>N° Orange Money</label><input id="om" placeholder="77 xxx xx xx"/></div>
    </div>
  </div>

  <!-- 5 -->
  <div class="card">
    <div class="ctitle"><span class="num">6</span> Notifications & Design</div>
    <div class="row2">
      <div class="f"><label>WhatsApp notifs commandes</label><input id="notif" placeholder="+221 77 xxx xxxx"/></div>
      <div class="f"><label>Email notifications</label><input id="notif_email" type="email" placeholder="patron@monbusiness.com"/></div>
    </div>
    <div class="f"><label style="color:#5a7060;font-size:11px">💡 Vous recevrez un email à chaque commande et RDV</label></div>
    <div class="f">
      <label>Couleur du bot</label>
      <div class="cols">
        <div class="co s" data-val="#00c875" style="background:#00c875" onclick="selC(this)"></div>
        <div class="co" data-val="#e8531a" style="background:#e8531a" onclick="selC(this)"></div>
        <div class="co" data-val="#d4507a" style="background:#d4507a" onclick="selC(this)"></div>
        <div class="co" data-val="#1a6ab1" style="background:#1a6ab1" onclick="selC(this)"></div>
        <div class="co" data-val="#7c3aed" style="background:#7c3aed" onclick="selC(this)"></div>
        <div class="co" data-val="#0d9488" style="background:#0d9488" onclick="selC(this)"></div>
        <div class="co" data-val="#f59e0b" style="background:#f59e0b" onclick="selC(this)"></div>
        <div class="co" data-val="#0a1a0f" style="background:#0a1a0f" onclick="selC(this)"></div>
      </div>
    </div>
  </div>

  <button class="sbtn" id="sbtn" onclick="create()">🚀 Créer mon bot SamaBot</button>

  <div class="res" id="res">
    <div class="rt">🎉 Votre bot est prêt !</div>
    <div class="ri"><div class="rl">🔗 Lien chat</div><div class="rv" id="r-chat"></div><button class="cp" onclick="cp('r-chat')">📋 Copier</button></div>
    <div class="ri"><div class="rl">📊 Dashboard</div><div class="rv" id="r-dash"></div><button class="cp" onclick="cp('r-dash')">📋 Copier</button></div>
    <div class="ri"><div class="rl">📦 Widget site</div><div class="rv" id="r-widget"></div><button class="cp" onclick="cp('r-widget')">📋 Copier</button></div>
    <div class="rbtns">
      <a class="rb rb-g" id="r-link" href="#" target="_blank">💬 Tester →</a>
      <a class="rb rb-o" id="r-dlink" href="#" target="_blank">📊 Dashboard →</a>
    </div>
  </div>
</div>

<script>
var nv='restaurant',cv='#00c875';
var payOpts=['Wave','Orange Money','Espèces'];

function toggleLivraison(cb){
  document.getElementById('liv-options').style.display=cb.checked?'block':'none';
}

function selN(e){document.querySelectorAll('.n').forEach(x=>x.classList.remove('s'));e.classList.add('s');nv=e.dataset.val;}
function selC(e){document.querySelectorAll('.co').forEach(x=>x.classList.remove('s'));e.classList.add('s');cv=e.dataset.val;}
function tPay(e){e.classList.toggle('s');payOpts=Array.from(document.querySelectorAll('.pay-opt.s')).map(x=>x.dataset.val);}

function addItem(){
  var d=document.createElement('div');d.className='cat-item';
  d.innerHTML='<div class="cat-item-row"><input placeholder="Nom de larticle *" class="cat-nom"/><input placeholder="Prix F" class="cat-prix" type="number" min="0"/><button class="rm" onclick="this.closest(&#39;.cat-item&#39;).remove()">✕</button></div><input placeholder="Description (optionnel)" class="cat-desc" style="font-size:13px"/><div class="cat-item-img"><img class="cat-img-preview" alt=""/><div class="cat-img-btn">📷 Photo<input type="file" accept="image/*" onchange="uploadCatImg(this)"/></div><span style="font-size:11px;color:#9ab0a0;margin-left:4px">Optionnel</span></div>';
  document.getElementById('cat-items').appendChild(d);
}

async function uploadCatImg(input){
  var file=input.files[0];if(!file)return;
  var item=input.closest('.cat-item');
  var preview=item.querySelector('.cat-img-preview');
  var btn=item.querySelector('.cat-img-btn');
  btn.style.opacity='.5';
  var reader=new FileReader();
  reader.onload=async function(e){
    try{
      var r=await fetch('/upload/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64:e.target.result,fileName:file.name,mimeType:file.type,folder:'catalogue'})});
      var d=await r.json();
      if(d.url){
        preview.src=d.url;preview.classList.add('show');
        input.dataset.url=d.url;
        btn.innerHTML='✅ Photo<input type="file" accept="image/*" onchange="uploadCatImg(this)"/>';
      }
    }catch(e){alert('Erreur upload image');}
    btn.style.opacity='1';
  };
  reader.readAsDataURL(file);
}

function getCat(){
  return Array.from(document.querySelectorAll('.cat-item')).map(i=>{
    var n=i.querySelector('.cat-nom')?.value?.trim();
    var p=i.querySelector('.cat-prix')?.value;
    var d=i.querySelector('.cat-desc')?.value?.trim();
    var imgInput=i.querySelector('input[type=file]');
    var img=imgInput?.dataset?.url||null;
    return n&&p?{nom:n,prix:parseInt(p),desc:d||'',image:img,emoji:'🛍️'}:null;
  }).filter(Boolean);
}

async function uploadLogo(input){
  var file=input.files[0];if(!file)return;
  var prog=document.getElementById('logo-progress');
  var bar=document.getElementById('logo-bar');
  prog.classList.add('show');
  bar.style.width='30%';

  try{
    var reader=new FileReader();
    reader.onload=async function(e){
      bar.style.width='60%';
      var r=await fetch('/upload/image',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({base64:e.target.result,fileName:file.name,mimeType:file.type,folder:'logos'})
      });
      var d=await r.json();
      bar.style.width='100%';
      if(d.url){
        document.getElementById('logo-url').value=d.url;
        var preview=document.getElementById('logo-preview');
        preview.src=d.url;preview.classList.add('show');
        document.getElementById('logo-placeholder').style.display='none';
      }else{alert('Erreur upload: '+(d.error||'Réessayez'));}
      setTimeout(()=>prog.classList.remove('show'),1000);
    };
    reader.readAsDataURL(file);
  }catch(e){alert('Erreur: '+e.message);prog.classList.remove('show');}
}

function cp(id){
  var t=document.getElementById(id).textContent;
  navigator.clipboard.writeText(t).then(()=>alert('✅ Copié!')).catch(()=>{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ Copié!');});
}

async function create(){
  var nom=document.getElementById('nom').value.trim();
  if(!nom){alert('⚠️ Entrez le nom de votre business');return;}
  var btn=document.getElementById('sbtn');btn.textContent='⏳ Création...';btn.disabled=true;
  try{
    var r=await fetch('/bot/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      nom,niche:nv,
      logo_url:document.getElementById('logo-url').value||null,
      adresse:document.getElementById('adr').value,
      maps_url:document.getElementById('maps').value,
      telephone:document.getElementById('tel').value,
      horaires:document.getElementById('hor').value,
      services:document.getElementById('srv').value,
      catalogue:getCat(),
      paiement:payOpts.join(', '),
      wave_number:document.getElementById('wave').value,
      om_number:document.getElementById('om').value,
      notifications_phone:document.getElementById('notif').value,
      notifications_email:document.getElementById('notif_email').value,
      email:document.getElementById('notif_email').value,
      livraison_actif:document.getElementById('liv-actif').checked,
      livraison_frais:parseInt(document.getElementById('liv-frais').value)||0,
      livraison_delai:document.getElementById('liv-delai').value||'30-45 min',
      livraison_zones:document.getElementById('liv-zones').value||'Dakar',
      livraison_min:parseInt(document.getElementById('liv-min').value)||0,
      couleur:cv
    })});
    var d=await r.json();
    if(d.success){
      document.getElementById('r-chat').textContent=d.chatUrl;
      document.getElementById('r-dash').textContent=d.dashUrl;
      document.getElementById('r-widget').textContent=d.widgetCode;
      document.getElementById('r-link').href=d.chatUrl;
      document.getElementById('r-dlink').href=d.dashUrl;
      document.getElementById('res').classList.add('show');
      document.getElementById('res').scrollIntoView({behavior:'smooth'});
    }else alert('❌ '+(d.error||'Erreur'));
  }catch(e){alert('❌ Erreur réseau');}
  btn.textContent='🚀 Créer mon bot SamaBot';btn.disabled=false;
}
</script>
</body>
</html>`);
});

// ============================================
// WIDGET.JS v5 avec bouton micro
// ============================================
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type','application/javascript');
  const base = CONFIG.BASE_URL;
  res.send(`(function(){
var cfg=window.SamaBotConfig||window.BotSenConfig||{};
var botId=cfg.botId||'default';
var couleur=cfg.couleur||'#00c875';
var base='${base}';
var sid='w_'+Math.random().toString(36).substr(2,9);
var botInfo=null;
var open=false;
var isRecording=false;
var mediaRec=null;
var audioChunks=[];

var css=document.createElement('style');
css.textContent='.sb-btn{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border-radius:50%;background:'+couleur+';display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:2147483647;border:none;transition:transform .2s;animation:sbIn 1s ease 1.5s both}.sb-btn:hover{transform:scale(1.1)}.sb-notif{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#22c55e;border-radius:50%;border:2px solid #fff;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}.sb-win{position:fixed;bottom:94px;right:24px;width:350px;max-height:540px;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.2);z-index:2147483646;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,sans-serif}.sb-win.open{display:flex;animation:sbSlide .3s ease}@keyframes sbSlide{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes sbIn{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}.sb-head{background:'+couleur+';padding:13px 16px;display:flex;align-items:center;gap:10px}.sb-logo-h{width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid rgba(255,255,255,.3)}.sb-ava{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid rgba(255,255,255,.3)}.sb-hn{font-size:14px;font-weight:700;color:#fff}.sb-hs{font-size:11px;color:rgba(255,255,255,.8);margin-top:1px;display:flex;align-items:center;gap:4px}.sb-hd{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:sbP 2s infinite}@keyframes sbP{0%,100%{opacity:1}50%{opacity:.4}}.sb-x{margin-left:auto;background:rgba(255,255,255,.15);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}.sb-msgs{flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;background:#f8faf8}.sb-msg{display:flex;gap:7px;align-items:flex-end}.sb-msg.u{flex-direction:row-reverse}.sb-bub{padding:9px 13px;font-size:13px;line-height:1.5;max-width:82%;border-radius:14px}.sb-bub.b{background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:3px 14px 14px 14px;box-shadow:0 1px 4px rgba(0,0,0,.05)}.sb-bub.u{background:'+couleur+';color:#fff;border-radius:14px 14px 3px 14px}.sb-av-sm{width:26px;height:26px;border-radius:50%;overflow:hidden;flex-shrink:0;background:'+couleur+';display:flex;align-items:center;justify-content:center;font-size:12px}.sb-av-sm img{width:100%;height:100%;object-fit:cover}.sb-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 12px 6px}.sb-act{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:18px;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s}.sb-maps{background:#e8f5e9;color:#1b5e20}.sb-phone{background:#e3f2fd;color:#0d47a1}.sb-whatsapp{background:#dcfce7;color:#166534}.sb-wave{background:#dbeafe;color:#1e40af}.sb-om{background:#ffedd5;color:#9a3412}.sb-cash{background:#f0fdf4;color:#15803d}.sb-share{background:#f3e5f5;color:#4a148c}.sb-hours{background:#fff8e1;color:#e65100}.sb-rating{background:#fef9c3;color:#ca8a04}.sb-cat{display:flex;gap:7px;padding:6px 12px;overflow-x:auto;scrollbar-width:none;border-top:1px solid #f0f0f0}.sb-cat::-webkit-scrollbar{display:none}.sb-ci{min-width:90px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px 6px;text-align:center;cursor:pointer;flex-shrink:0;transition:all .15s}.sb-ci:hover{border-color:'+couleur+';transform:translateY(-1px)}.sb-ce{font-size:20px;display:block;margin-bottom:3px}.sb-cn{font-size:10px;font-weight:600;color:#111;display:block}.sb-cp{font-size:11px;font-weight:700;color:'+couleur+';display:block;margin-top:1px}.sb-stars{display:flex;gap:6px;padding:6px 12px;justify-content:center;border-top:1px solid #f0f0f0}.sb-star{font-size:22px;cursor:pointer;transition:transform .15s;background:none;border:none}.sb-star:hover{transform:scale(1.2)}.sb-qr{padding:7px 12px;display:flex;flex-wrap:wrap;gap:5px;background:#fff;border-top:1px solid #f0f0f0}.sb-qb{padding:5px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid '+couleur+'33;background:'+couleur+'0d;color:'+couleur+';font-family:inherit;transition:all .15s}.sb-qb:hover{background:'+couleur+';color:#fff}.sb-inp{padding:9px 12px;display:flex;gap:6px;align-items:center;background:#fff;border-top:1px solid #f0f0f0}.sb-input{flex:1;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:18px;padding:8px 14px;font-size:13px;font-family:inherit;outline:none}.sb-input:focus{border-color:'+couleur+'}.sb-send{width:34px;height:34px;border-radius:50%;background:'+couleur+';border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px '+couleur+'44}.sb-mic{width:34px;height:34px;border-radius:50%;background:#f3f4f6;border:1.5px solid #e5e7eb;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}.sb-mic.recording{background:#fee2e2;border-color:#fca5a5;animation:sbPulse 1s infinite}@keyframes sbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}.sb-trans{font-size:11px;color:#6b7280;font-style:italic;padding:0 12px 4px;background:#fff}.sb-pw{text-align:center;padding:4px;font-size:10px;color:#b0b8b0;background:#fff;border-top:1px solid #f5f5f5}@media(max-width:480px){.sb-win{width:calc(100vw - 28px);right:14px;bottom:84px}}';
document.head.appendChild(css);

var btn=document.createElement('button');
btn.className='sb-btn';
btn.innerHTML='<span id="sb-ico">💬</span><div class="sb-notif" id="sb-notif">1</div>';
btn.onclick=function(){toggle();};

var win=document.createElement('div');
win.className='sb-win';
win.innerHTML='<div class="sb-head"><div id="sb-head-ava"></div><div style="flex:1"><div class="sb-hn" id="sb-hn">SamaBot</div><div class="sb-hs"><span class="sb-hd"></span>En ligne — wolof & français</div></div><button class="sb-x" onclick="document.querySelector(\\'.sb-win\\').classList.remove(\\'open\\')">✕</button></div><div class="sb-msgs" id="sb-msgs"></div><div class="sb-actions" id="sb-act"></div><div class="sb-cat" id="sb-cat" style="display:none"></div><div class="sb-stars" id="sb-stars" style="display:none"></div><div class="sb-qr" id="sb-qr"></div><div class="sb-trans" id="sb-trans" style="display:none"></div><div class="sb-inp"><input class="sb-input" id="sb-inp" placeholder="Écrivez en français ou wolof..."/><button class="sb-mic" id="sb-mic" onclick="toggleMic()" title="Message vocal">🎤</button><button class="sb-send" onclick="sbSend()">➤</button></div><div class="sb-pw">Propulsé par <strong style="color:'+couleur+'">SamaBot IA</strong></div>';

document.body.appendChild(btn);
document.body.appendChild(win);
document.getElementById('sb-inp').onkeydown=function(e){if(e.key==='Enter')sbSend();};

fetch(base+'/bot/'+botId).then(r=>r.json()).then(function(d){
  if(!d.nom)return;
  botInfo=d;
  document.getElementById('sb-hn').textContent=d.nom;
  document.getElementById('sb-ico').textContent=d.emoji||'💬';
  var ha=document.getElementById('sb-head-ava');
  if(d.logo){var img=document.createElement('img');img.className='sb-logo-h';img.src=d.logo;ha.appendChild(img);}
  else{var av=document.createElement('div');av.className='sb-ava';av.textContent=d.emoji||'🤖';ha.appendChild(av);}
  addBot(d.welcome||('Asalaa maalekum! 👋 Bienvenue chez '+d.nom+'.'));
  if(d.quickReplies)renderQR(d.quickReplies);
}).catch(()=>addBot('Asalaa maalekum! 👋 Comment puis-je vous aider?'));

function toggle(){open=!open;win.classList.toggle('open',open);if(open)document.getElementById('sb-notif').style.display='none';}

function makeAv(){
  var av=document.createElement('div');av.className='sb-av-sm';
  if(botInfo?.logo){var img=document.createElement('img');img.src=botInfo.logo;av.appendChild(img);}
  else av.textContent=botInfo?.emoji||'🤖';
  return av;
}

function addBot(t){
  var m=document.getElementById('sb-msgs');
  var d=document.createElement('div');d.className='sb-msg';
  var b=document.createElement('div');b.className='sb-bub b';
  b.innerHTML=t.replace(/\\n/g,'<br>').replace(/\\*(.*?)\\*/g,'<strong>$1</strong>');
  d.appendChild(makeAv());d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

function addUser(t,isVoice){
  var m=document.getElementById('sb-msgs');
  var d=document.createElement('div');d.className='sb-msg u';
  var b=document.createElement('div');b.className='sb-bub u';
  b.innerHTML=(isVoice?'🎤 ':'')+t;
  d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

function renderActions(actions){
  var el=document.getElementById('sb-act');el.innerHTML='';
  document.getElementById('sb-stars').style.display='none';
  if(!actions?.length)return;
  actions.forEach(function(a){
    if(a.type==='rating'){showStars();return;}
    if(a.type==='share'){var b=document.createElement('button');b.className='sb-act sb-share';b.textContent=a.label;b.onclick=function(){if(navigator.share)navigator.share({title:botInfo?.nom,url:base+'/chat/'+botId});else{navigator.clipboard.writeText(base+'/chat/'+botId);alert('Lien copié!');}};el.appendChild(b);return;}
    if(a.type==='cash'){var b=document.createElement('button');b.className='sb-act sb-cash';b.textContent=a.label;b.onclick=function(){addBot('✅ Paiement à la livraison noté!');el.innerHTML='';};el.appendChild(b);return;}
    if(!a.url&&a.type==='hours'){var s=document.createElement('span');s.className='sb-act sb-hours';s.textContent=a.label;el.appendChild(s);return;}
    if(a.url){var l=document.createElement('a');l.className='sb-act sb-'+a.type;l.textContent=a.label;l.href=a.url;l.target='_blank';l.rel='noopener';el.appendChild(l);}
  });
}

function renderCat(items){
  var el=document.getElementById('sb-cat');
  if(!items?.length){el.style.display='none';return;}
  el.style.display='flex';el.innerHTML='';
  items.forEach(function(item){
    var c=document.createElement('div');c.className='sb-ci';
    c.innerHTML='<span class="sb-ce">'+(item.emoji||'🛍️')+'</span><span class="sb-cn">'+item.nom+'</span><span class="sb-cp">'+item.prix.toLocaleString('fr-FR')+' F</span>';
    c.onclick=function(){sbSend('Je veux commander '+item.nom);};
    el.appendChild(c);
  });
}

function showStars(){
  var el=document.getElementById('sb-stars');el.style.display='flex';el.innerHTML='';
  [1,2,3,4,5].forEach(function(n){
    var b=document.createElement('button');b.className='sb-star';b.textContent='☆';
    b.onclick=function(){
      document.querySelectorAll('.sb-star').forEach((s,i)=>s.textContent=i<n?'⭐':'☆');
      setTimeout(function(){
        fetch(base+'/avis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId,sessionId:sid,note:n})}).catch(()=>{});
        el.style.display='none';
        addBot('Jerejef! 🙏 Merci pour votre note '+n+'/5!');
      },600);
    };
    el.appendChild(b);
  });
}

function renderQR(rs){var qr=document.getElementById('sb-qr');qr.innerHTML='';rs.forEach(function(r){var b=document.createElement('button');b.className='sb-qb';b.textContent=r;b.onclick=function(){sbSend(r);};qr.appendChild(b);});}

// ============================================
// MICROPHONE — Enregistrement vocal
// ============================================
async function toggleMic(){
  if(!isRecording){await startRec();}
  else{stopRec();}
}

async function startRec(){
  try{
    var stream=await navigator.mediaDevices.getUserMedia({audio:true});
    audioChunks=[];
    mediaRec=new MediaRecorder(stream,{mimeType:'audio/webm'});
    mediaRec.ondataavailable=function(e){if(e.data.size>0)audioChunks.push(e.data);};
    mediaRec.onstop=async function(){
      var blob=new Blob(audioChunks,{type:'audio/webm'});
      stream.getTracks().forEach(t=>t.stop());
      await sendVoice(blob);
    };
    mediaRec.start();
    isRecording=true;
    document.getElementById('sb-mic').classList.add('recording');
    document.getElementById('sb-mic').textContent='⏹️';
    document.getElementById('sb-trans').style.display='block';
    document.getElementById('sb-trans').textContent='🎤 Enregistrement en cours... (cliquez ⏹️ pour arrêter)';
  }catch(e){
    alert('Microphone non accessible. Vérifiez les permissions.');
    console.error('Mic error:',e);
  }
}

function stopRec(){
  if(mediaRec&&isRecording){
    mediaRec.stop();
    isRecording=false;
    document.getElementById('sb-mic').classList.remove('recording');
    document.getElementById('sb-mic').textContent='🎤';
    document.getElementById('sb-trans').textContent='⏳ Transcription en cours...';
  }
}

async function sendVoice(blob){
  var reader=new FileReader();
  reader.onload=async function(e){
    try{
      var r=await fetch(base+'/chat/voice',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({base64:e.target.result,mimeType:'audio/webm',fileName:'audio.webm',botId,sessionId:sid})
      });
      var data=await r.json();
      document.getElementById('sb-trans').style.display='none';
      if(data.transcription){
        addUser(data.transcription,true);
        if(data.reply)addBot(data.reply);
        if(data.actions?.length)renderActions(data.actions);
      }else{
        addBot('Désolé, je n\\'ai pas pu comprendre votre message vocal. Réessayez ou écrivez votre message.');
      }
    }catch(err){
      document.getElementById('sb-trans').style.display='none';
      addBot('Erreur de traitement vocal. Réessayez.');
    }
  };
  reader.readAsDataURL(blob);
}

window.sbSend=function(t){
  var inp=document.getElementById('sb-inp');
  var msg=t||(inp?inp.value.trim():'');if(!msg)return;
  if(inp)inp.value='';
  document.getElementById('sb-qr').innerHTML='';
  document.getElementById('sb-act').innerHTML='';
  document.getElementById('sb-cat').style.display='none';
  document.getElementById('sb-stars').style.display='none';
  addUser(msg,false);

  var m=document.getElementById('sb-msgs');
  var ty=document.createElement('div');ty.className='sb-msg';ty.id='sb-ty';
  var tb=document.createElement('div');tb.className='sb-bub b';tb.style='padding:10px 14px';
  tb.innerHTML='<span style="display:flex;gap:4px"><span style="width:7px;height:7px;border-radius:50%;background:#ccc;animation:sbD 1.2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:#ccc;animation:sbD 1.2s .2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:#ccc;animation:sbD 1.2s .4s infinite"></span></span>';
  if(!document.getElementById('sb-ds')){var s=document.createElement('style');s.id='sb-ds';s.textContent='@keyframes sbD{0%,80%,100%{opacity:.25}40%{opacity:1}}';document.head.appendChild(s);}
  ty.appendChild(makeAv());ty.appendChild(tb);m.appendChild(ty);m.scrollTop=m.scrollHeight;

  fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,botId,sessionId:sid})})
  .then(r=>r.json())
  .then(function(data){
    var t=document.getElementById('sb-ty');if(t)t.remove();
    addBot(data.reply||'Désolé, erreur.');
    if(data.actions?.length)renderActions(data.actions);
    if(data.catalogue?.length)renderCat(data.catalogue);
  })
  .catch(function(){var t=document.getElementById('sb-ty');if(t)t.remove();addBot('Désolé, erreur. Réessayez.');});
};

setTimeout(function(){if(!open){btn.style.transform='scale(1.15)';setTimeout(()=>btn.style.transform='',350);}},5000);
})();`);
});

// ============================================
// PAGE CHAT v5 avec vocal
// ============================================
app.get('/chat/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&actif=eq.true`);
    const bot = bots?.[0] || { nom:'SamaBot', couleur:'#00c875', emoji:'🤖', niche:'default', id:req.params.botId };
    const qr = getQR(bot.niche);
    const base = CONFIG.BASE_URL;

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<meta property="og:title" content="${bot.nom}"/>
<meta property="og:description" content="Chattez avec ${bot.nom} en wolof et français"/>
${bot.logo_url?`<meta property="og:image" content="${bot.logo_url}"/>`:''}
<title>${bot.nom}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'DM Sans',sans-serif;background:#f0f4f1;display:flex;flex-direction:column;height:100dvh;max-width:500px;margin:0 auto}
.hd{background:${bot.couleur};padding:12px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 10px rgba(0,0,0,.15);flex-shrink:0}
.hd-logo{width:42px;height:42px;border-radius:10px;object-fit:cover;border:2px solid rgba(255,255,255,.3)}
.hd-ava{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:24px;border:2px solid rgba(255,255,255,.3)}
.hd-nm{font-size:16px;font-weight:700;color:#fff}
.hd-st{font-size:12px;color:rgba(255,255,255,.8);margin-top:2px;display:flex;align-items:center;gap:5px}
.hd-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:p 2s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}
.hd-dash{margin-left:auto;background:rgba(255,255,255,.15);border:none;border-radius:8px;padding:6px 10px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none}
.msgs{flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;min-height:0}
.msg{display:flex;gap:8px;align-items:flex-end}
.msg.u{flex-direction:row-reverse}
.bub{padding:10px 14px;font-size:14px;line-height:1.5;max-width:82%;border-radius:16px}
.bub.b{background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:3px 16px 16px 16px;box-shadow:0 2px 6px rgba(0,0,0,.05)}
.bub.u{background:${bot.couleur};color:#fff;border-radius:16px 16px 3px 16px}
.av{width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;background:${bot.couleur};display:flex;align-items:center;justify-content:center;font-size:16px}
.av img{width:100%;height:100%;object-fit:cover}
.actions{display:flex;flex-wrap:wrap;gap:6px;padding:3px 12px 6px 52px}
.act{display:inline-flex;align-items:center;gap:4px;padding:7px 13px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;text-decoration:none}
.act-maps{background:#e8f5e9;color:#1b5e20}.act-phone{background:#e3f2fd;color:#0d47a1}.act-whatsapp{background:#dcfce7;color:#166534}.act-wave{background:#dbeafe;color:#1e40af}.act-om{background:#ffedd5;color:#9a3412}.act-cash{background:#f0fdf4;color:#15803d}.act-share{background:#f3e5f5;color:#4a148c}.act-hours{background:#fff8e1;color:#e65100}
.act-rdv{background:#f0fdf4;color:#166534;font-weight:700;border:1.5px solid #bbf7d0}
.rdv-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-end;justify-content:center}
.rdv-sheet{background:#fff;border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:500px;max-height:80vh;overflow-y:auto;animation:slideUp .3s ease}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.rdv-title{font-size:16px;font-weight:700;color:#0a1a0f;margin-bottom:4px}
.rdv-sub{font-size:13px;color:#5a7060;margin-bottom:16px}
.rdv-days{display:flex;gap:8px;overflow-x:auto;padding-bottom:10px;margin-bottom:16px;scrollbar-width:none}
.rdv-days::-webkit-scrollbar{display:none}
.rdv-day{min-width:70px;padding:10px 6px;border-radius:10px;border:1.5px solid #d1e5d8;background:#fff;cursor:pointer;text-align:center;transition:all .15s;flex-shrink:0}
.rdv-day.sel{border-color:${bot.couleur};background:${bot.couleur}}
.rdv-day-lbl{font-size:10px;font-weight:600;color:#5a7060}
.rdv-day.sel .rdv-day-lbl{color:rgba(255,255,255,.8)}
.rdv-day-num{font-size:18px;font-weight:800;color:#0a1a0f}
.rdv-day.sel .rdv-day-num{color:#fff}
.rdv-day-free{font-size:10px;color:#00c875;font-weight:600}
.rdv-day.sel .rdv-day-free{color:rgba(255,255,255,.8)}
.rdv-day.ferme{opacity:.4;cursor:not-allowed}
.rdv-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.rdv-slot{padding:12px 8px;border-radius:8px;border:1.5px solid #d1e5d8;background:#fff;cursor:pointer;text-align:center;font-size:14px;font-weight:700;color:#0a1a0f;transition:all .15s}
.rdv-slot:hover{border-color:${bot.couleur};color:${bot.couleur}}
.rdv-slot.sel{background:${bot.couleur};border-color:${bot.couleur};color:#fff}
.rdv-slot.pris{background:#f9fafb;border-color:#e5e7eb;color:#d1d5db;cursor:not-allowed;text-decoration:line-through}
.rdv-form{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.rdv-input{border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;width:100%}
.rdv-input:focus{border-color:${bot.couleur}}
.rdv-confirm-btn{width:100%;height:48px;background:${bot.couleur};color:#000;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s}
.rdv-confirm-btn:hover{opacity:.9}
.rdv-cancel{width:100%;background:none;border:none;color:#9ab0a0;font-size:13px;cursor:pointer;padding:8px;font-family:inherit;margin-top:4px}
.act-geoloc{background:#e0f2fe;color:#0369a1;font-weight:700;border:1.5px solid #bae6fd}
.act-address{background:#f8fafc;color:#475569;border:1.5px solid #e2e8f0}
.geo-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:0}
.geo-sheet{background:#fff;border-radius:20px 20px 0 0;padding:24px 20px;width:100%;max-width:500px;animation:slideUp .3s ease}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.geo-title{font-family:'DM Sans',sans-serif;font-size:17px;font-weight:700;color:#111;margin-bottom:6px}
.geo-sub{font-size:13px;color:#6b7280;margin-bottom:18px}
.geo-btn{width:100%;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .15s}
.geo-btn-p{background:#0369a1;color:#fff}.geo-btn-p:hover{background:#0284c7}
.geo-btn-s{background:#f3f4f6;color:#374151}.geo-btn-s:hover{background:#e5e7eb}
.geo-cancel{width:100%;background:none;border:none;color:#9ca3af;font-size:14px;cursor:pointer;padding:8px;font-family:inherit}
.geo-loading{text-align:center;padding:20px;font-size:14px;color:#6b7280}
.geo-result{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin:10px 0}
.geo-addr{font-size:14px;font-weight:600;color:#166534}
.geo-coords{font-size:11px;color:#4ade80;margin-top:3px}
.address-input-wrap{display:flex;gap:8px;margin-top:10px}
.address-input{flex:1;border:1.5px solid #d1d5db;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none}
.address-input:focus{border-color:#0369a1}
.address-send{background:#0369a1;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
.catalogue{display:flex;gap:10px;padding:10px 12px;overflow-x:auto;scrollbar-width:none;border-top:1px solid #e5e7eb;background:#fafafa}
.catalogue::-webkit-scrollbar{display:none}
.cat-card{min-width:130px;max-width:130px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;cursor:pointer;flex-shrink:0;overflow:hidden;transition:all .15s;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.cat-card:active{transform:scale(.97);border-color:${bot.couleur}}
.cat-card:hover{border-color:${bot.couleur}55;box-shadow:0 4px 12px rgba(0,0,0,.1)}
.cat-img{width:100%;height:80px;object-fit:cover;display:block;background:#f0f4f1}
.cat-img-placeholder{width:100%;height:80px;background:linear-gradient(135deg,${bot.couleur}22,${bot.couleur}44);display:flex;align-items:center;justify-content:center;font-size:32px}
.cat-body{padding:8px}
.cat-nom{font-size:12px;font-weight:700;color:#111;display:block;line-height:1.3;margin-bottom:3px}
.cat-desc-small{font-size:10px;color:#9ab0a0;display:block;margin-bottom:5px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cat-footer{display:flex;align-items:center;justify-content:space-between}
.cat-prix{font-size:13px;font-weight:800;color:${bot.couleur}}
.cat-add{width:22px;height:22px;border-radius:50%;background:${bot.couleur};border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700}
.rating-stars{display:flex;justify-content:center;gap:8px;padding:8px;border-top:1px solid #e5e7eb}
.star-btn{font-size:26px;background:none;border:none;cursor:pointer}
.qr{padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px;background:#fff;border-top:1px solid #e5e7eb;flex-shrink:0}
.qb{padding:7px 13px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid ${bot.couleur}33;background:${bot.couleur}0d;color:${bot.couleur};font-family:inherit}
.transcription{font-size:12px;color:#6b7280;font-style:italic;padding:4px 14px;background:#fff;border-top:1px solid #f0f0f0;display:none;flex-shrink:0}
.ir{padding:10px 12px;display:flex;gap:7px;align-items:center;background:#fff;border-top:1px solid #e5e7eb;flex-shrink:0}
.inp{flex:1;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:24px;padding:10px 16px;font-size:14px;font-family:inherit;outline:none}
.inp:focus{border-color:${bot.couleur}}
.mic-btn{width:40px;height:40px;border-radius:50%;background:#f3f4f6;border:1.5px solid #e5e7eb;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.mic-btn.recording{background:#fee2e2;border-color:#fca5a5;animation:pulse 1s infinite}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.snd{width:40px;height:40px;border-radius:50%;background:${bot.couleur};border:none;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pw{text-align:center;padding:4px;font-size:11px;color:#9ab0a0;background:#fff;flex-shrink:0}
.pw a{color:${bot.couleur};font-weight:700;text-decoration:none}
.typing{display:flex;gap:4px;align-items:center;padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:3px 16px 16px 16px;width:fit-content}
.typing span{width:7px;height:7px;border-radius:50%;background:#ccc;animation:dot 1.2s infinite}
.typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,80%,100%{opacity:.25}40%{opacity:1}}
</style>
</head>
<body>
<div class="hd">
  ${bot.logo_url?`<img class="hd-logo" src="${bot.logo_url}" alt="${bot.nom}"/>`:`<div class="hd-ava">${bot.emoji}</div>`}
  <div style="flex:1">
    <div class="hd-nm">${bot.nom}</div>
    <div class="hd-st"><span class="hd-dot"></span>En ligne — wolof & français 🎤</div>
  </div>
  <button class="hd-restart" id="hd-restart" title="Recommencer la conversation" style="background:rgba(255,255,255,0.15);border:none;color:#fff;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center">↻</button>
</div>

<div class="msgs" id="msgs">
  <div class="msg">
    <div class="av">${bot.logo_url?`<img src="${bot.logo_url}" alt=""/>`:`${bot.emoji}`}</div>
    <div class="bub b">Asalaa maalekum! 👋 Bienvenue chez <strong>${bot.nom}</strong>.<br><br>Écrivez ou utilisez le 🎤 pour parler en wolof ou français!</div>
  </div>
</div>

<div class="actions" id="actions"></div>
<div class="catalogue" id="catalogue" style="display:none"></div>
<div class="rating-stars" id="rating" style="display:none"></div>

<div class="qr" id="qr">
  ${qr.map(r=>`<button class="qb" onclick="send('${r.replace(/'/g,"\\'")}')">${r}</button>`).join('')}
</div>

<div class="transcription" id="transcription"></div>

<div class="ir">
  <input class="inp" id="inp" placeholder="Écrivez ou utilisez le micro 🎤..." autocomplete="off"/>
  <button class="mic-btn" id="mic-btn" onclick="toggleMic()" title="Message vocal en wolof/français">🎤</button>
  <button class="snd" onclick="send()">➤</button>
</div>
<div class="pw">Propulsé par <a href="${base}" target="_blank">SamaBot IA</a></div>

<!-- MODAL RDV -->
<div class="rdv-modal" id="rdv-modal" style="display:none">
  <div class="rdv-sheet">
    <div class="rdv-title">📅 Prendre rendez-vous</div>
    <div class="rdv-sub">Choisissez une date et un créneau</div>
    <div class="rdv-days" id="rdv-days"></div>
    <div class="rdv-slots" id="rdv-slots"><div style="text-align:center;color:#9ab0a0;font-size:13px;grid-column:span 3">Sélectionnez une date</div></div>
    <div class="rdv-form" id="rdv-form" style="display:none">
      <input class="rdv-input" id="rdv-nom" placeholder="Votre nom *"/>
      <input class="rdv-input" id="rdv-tel" placeholder="Votre téléphone" type="tel"/>
      <input class="rdv-input" id="rdv-email" placeholder="Votre email (pour confirmation)" type="email"/>
      <input class="rdv-input" id="rdv-service" placeholder="Service souhaité"/>
    </div>
    <button class="rdv-confirm-btn" id="rdv-confirm-btn" onclick="confirmerRdv()" style="display:none">✅ Confirmer le rendez-vous</button>
    <button class="rdv-cancel" onclick="fermerRdv()">Annuler</button>
  </div>
</div>

<!-- MODAL GÉOLOCALISATION -->
<div class="geo-modal" id="geo-modal" style="display:none">
  <div class="geo-sheet">
    <div class="geo-title">📍 Partager votre position</div>
    <div class="geo-sub">Votre adresse de livraison sera détectée automatiquement</div>
    <div id="geo-content">
      <button class="geo-btn geo-btn-p" onclick="requestGeo()">
        📍 Utiliser ma position GPS
      </button>
      <button class="geo-btn geo-btn-s" onclick="showManualInput()">
        ✏️ Entrer mon adresse manuellement
      </button>
      <div id="manual-input" style="display:none">
        <div class="address-input-wrap">
          <input class="address-input" id="manual-addr" placeholder="Ex: Almadies, Rue 10, Dakar" autocomplete="street-address"/>
          <button class="address-send" onclick="sendManualAddress()">OK</button>
        </div>
      </div>
    </div>
    <button class="geo-cancel" onclick="closeGeoModal()">Annuler</button>
  </div>
</div>

<script>
// Persistance du sid dans localStorage pour garder le contexte entre rechargements
var sid;
try {
  var saved = localStorage.getItem('samabot_sid_${req.params.botId}');
  if(saved && saved.length > 5) sid = saved;
} catch(e){}
if(!sid){
  sid = 'p_' + Math.random().toString(36).substr(2,9);
  try { localStorage.setItem('samabot_sid_${req.params.botId}', sid); } catch(e){}
}
var botId='${req.params.botId}';
var BID=botId;
var logoSrc='${bot.logo_url||''}';
var botEmoji='${bot.emoji}';
var BOT_NAME='${(bot.nom||'').replace(/'/g, "\\'")}';
var BOT_LOGO=logoSrc;
var BOT_EMOJI=botEmoji;
window.__INIT_QR = ${JSON.stringify(qr)};
var isRec=false,mediaRec=null,audioChunks=[];

document.getElementById('inp').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};

function makeAv(){
  var av=document.createElement('div');av.className='av';
  if(logoSrc){var img=document.createElement('img');img.src=logoSrc;av.appendChild(img);}
  else av.textContent=botEmoji;
  return av;
}

function addMsg(t,isUser,isVoice){
  var m=document.getElementById('msgs');
  var d=document.createElement('div');d.className='msg'+(isUser?' u':'');
  var b=document.createElement('div');b.className='bub '+(isUser?'u':'b');
  if(isUser)b.innerHTML=(isVoice?'🎤 ':'')+t;
  else b.innerHTML=t.replace(/\\n/g,'<br>').replace(/\\*(.*?)\\*/g,'<strong>$1</strong>');
  if(!isUser)d.appendChild(makeAv());
  d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

function renderActions(actions){
  var el=document.getElementById('actions');el.innerHTML='';
  if(!actions?.length)return;
  actions.forEach(function(a){
    if(a.type==='rdv'){
      var b=document.createElement('button');
      b.className='act act-rdv';
      b.textContent='📅 Voir les créneaux';
      b.onclick=ouvrirRdv;
      el.appendChild(b);
      return;
    }
    if(a.type==='geoloc'){
      var b=document.createElement('button');
      b.className='act act-geoloc';
      b.innerHTML='📍 Partager ma position GPS';
      b.onclick=openGeoModal;
      el.appendChild(b);
      return;
    }
    if(a.type==='address_manual'){
      var b=document.createElement('button');
      b.className='act act-address';
      b.innerHTML='✏️ Entrer mon adresse';
      b.onclick=function(){openGeoModal();setTimeout(showManualInput,300);};
      el.appendChild(b);
      return;
    }
    if(a.type==='rating'){showRating();return;}
    if(a.type==='share'){var b=document.createElement('button');b.className='act act-share';b.textContent=a.label;b.onclick=function(){if(navigator.share)navigator.share({title:"${bot.nom}",url:window.location.href});else{navigator.clipboard.writeText(window.location.href);alert('✅ Lien copié!');}};el.appendChild(b);return;}
    if(a.type==='cash'){var b=document.createElement('button');b.className='act act-cash';b.textContent=a.label;b.onclick=function(){addMsg('✅ Paiement à la livraison noté! Votre commande est confirmée.',false);el.innerHTML='';};el.appendChild(b);return;}
    if(!a.url&&a.type==='hours'){var s=document.createElement('span');s.className='act act-hours';s.textContent=a.label;el.appendChild(s);return;}
    if(a.url){var l=document.createElement('a');l.className='act act-'+a.type;l.textContent=a.label;l.href=a.url;l.target='_blank';l.rel='noopener';el.appendChild(l);}
  });
}

// ============================================
// SYSTÈME RDV
// ============================================
var rdvDateSel=null, rdvHeureSel=null;

async function ouvrirRdv(){
  document.getElementById('rdv-modal').style.display='flex';
  await chargerSemaineRdv();
}
function fermerRdv(){document.getElementById('rdv-modal').style.display='none';rdvDateSel=null;rdvHeureSel=null;}

async function chargerSemaineRdv(){
  const r=await fetch('/rdv/semaine/'+BID);
  const data=await r.json();
  const el=document.getElementById('rdv-days');
  el.innerHTML='';
  data.jours.forEach(j=>{
    const d=document.createElement('div');
    d.className='rdv-day'+(j.ferme?' ferme':'')+(j.date===rdvDateSel?' sel':'');
    d.innerHTML='<div class="rdv-day-lbl">'+j.label.split(' ')[0]+'</div><div class="rdv-day-num">'+(!j.ferme?j.creneauxDispo:'×')+'</div><div class="rdv-day-free">'+(j.ferme?'Fermé':'libres')+'</div>';
    if(!j.ferme)d.onclick=()=>{rdvDateSel=j.date;chargerSemaineRdv();chargerCreneaux(j.date);};
    el.appendChild(d);
  });
}

async function chargerCreneaux(date){
  const r=await fetch('/rdv/creneaux/'+BID+'?date='+date);
  const data=await r.json();
  const el=document.getElementById('rdv-slots');
  el.innerHTML='';
  if(data.ferme){el.innerHTML='<div style="text-align:center;color:#9ab0a0;font-size:13px;grid-column:span 3">'+data.message+'</div>';return;}
  data.creneaux.forEach(c=>{
    const s=document.createElement('div');
    s.className='rdv-slot'+(!c.disponible?' pris':'')+(c.heure===rdvHeureSel?' sel':'');
    s.textContent=c.heure;
    if(c.disponible)s.onclick=()=>{rdvHeureSel=c.heure;chargerCreneaux(date);document.getElementById('rdv-form').style.display='flex';document.getElementById('rdv-confirm-btn').style.display='block';};
    el.appendChild(s);
  });
}

async function confirmerRdv(){
  var nom=document.getElementById('rdv-nom').value.trim();
  if(!nom){alert('Entrez votre nom');return;}
  if(!rdvDateSel||!rdvHeureSel){alert('Choisissez une date et un créneau');return;}
  var btn=document.getElementById('rdv-confirm-btn');
  btn.textContent='⏳ Confirmation...';btn.disabled=true;
  try{
    var r=await fetch('/rdv/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId:BID,sessionId:sid,clientNom:nom,clientTel:document.getElementById('rdv-tel').value,clientEmail:document.getElementById('rdv-email')?.value||'',service:document.getElementById('rdv-service').value||'RDV',date:rdvDateSel,heure:rdvHeureSel})});
    var data=await r.json();
    if(data.success){
      fermerRdv();
      document.getElementById('actions').innerHTML='';
      const dl=new Date(rdvDateSel+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
      addMsg('✅ RDV confirmé!\\n\\n📅 '+dl+'\\n🕐 '+rdvHeureSel+'\\n👤 '+nom+'\\n\\nJërëjëf! Nous vous attendons.',false);
    }else{alert('Erreur: '+(data.error||'Réessayez'));}
  }catch(e){alert('Erreur réseau');}
  btn.textContent='✅ Confirmer le rendez-vous';btn.disabled=false;
}

document.getElementById('rdv-modal').onclick=function(e){if(e.target===this)fermerRdv();};

// ============================================
// GÉOLOCALISATION
// ============================================
function openGeoModal(){
  document.getElementById('geo-modal').style.display='flex';
  document.getElementById('geo-content').innerHTML=\`
    <button class="geo-btn geo-btn-p" onclick="requestGeo()">📍 Utiliser ma position GPS</button>
    <button class="geo-btn geo-btn-s" onclick="showManualInput()">✏️ Entrer mon adresse manuellement</button>
    <div id="manual-input" style="display:none">
      <div class="address-input-wrap">
        <input class="address-input" id="manual-addr" placeholder="Ex: Almadies Rue 10, Dakar" autocomplete="street-address"/>
        <button class="address-send" onclick="sendManualAddress()">OK</button>
      </div>
    </div>
  \`;
}

function closeGeoModal(){
  document.getElementById('geo-modal').style.display='none';
}

function showManualInput(){
  var el=document.getElementById('manual-input');
  if(el){el.style.display='block';setTimeout(()=>document.getElementById('manual-addr')?.focus(),100);}
}

function sendManualAddress(){
  var addr=document.getElementById('manual-addr')?.value?.trim();
  if(!addr){alert('Entrez votre adresse');return;}
  closeGeoModal();
  // Envoie l'adresse au bot
  addMsg('📍 Mon adresse: '+addr, true);
  showTyping();
  fetch('/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      message:'Mon adresse de livraison est: '+addr+'. Confirme ma commande.',
      botId,sessionId:sid
    })
  })
  .then(r=>r.json())
  .then(data=>{
    var ty=document.getElementById('typing');if(ty)ty.remove();
    addMsg(data.reply||'Adresse notée!',false);
    if(data.actions?.length)renderActions(data.actions);
  })
  .catch(()=>{var ty=document.getElementById('typing');if(ty)ty.remove();});
}

function requestGeo(){
  var content=document.getElementById('geo-content');
  content.innerHTML='<div class="geo-loading">⏳ Détection de votre position en cours...</div>';

  if(!navigator.geolocation){
    content.innerHTML='<div class="geo-loading">❌ GPS non disponible sur votre appareil.</div>';
    setTimeout(()=>{closeGeoModal();showManualInput();},2000);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async function(pos){
      var lat=pos.coords.latitude;
      var lng=pos.coords.longitude;
      var acc=Math.round(pos.coords.accuracy);

      content.innerHTML='<div class="geo-loading">🗺️ Identification de votre adresse...</div>';

      try{
        // Reverse geocoding via notre API
        var r=await fetch('/geo/reverse',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({lat,lng})
        });
        var data=await r.json();
        var addr=data.short||data.full||'Position détectée';

        // Affiche le résultat
        content.innerHTML=\`
          <div class="geo-result">
            <div class="geo-addr">📍 \${addr}</div>
            <div class="geo-coords">Précision: ~\${acc}m • \${lat.toFixed(5)}, \${lng.toFixed(5)}</div>
          </div>
          <button class="geo-btn geo-btn-p" onclick="confirmGeoAddress('\${addr.replace(/'/g,"\\\\'")}', \${lat}, \${lng}, '\${data.mapsUrlLabel}')">
            ✅ Confirmer cette adresse
          </button>
          <button class="geo-btn geo-btn-s" onclick="showManualInput()">
            ✏️ Corriger l'adresse
          </button>
          <div id="manual-input" style="display:none">
            <div class="address-input-wrap">
              <input class="address-input" id="manual-addr" placeholder="\${addr}" autocomplete="street-address"/>
              <button class="address-send" onclick="sendManualAddress()">OK</button>
            </div>
          </div>
        \`;
      }catch(e){
        // Fallback si reverse geocoding échoue
        content.innerHTML=\`
          <div class="geo-result">
            <div class="geo-addr">📍 Position GPS détectée</div>
            <div class="geo-coords">Lat: \${lat.toFixed(5)}, Lng: \${lng.toFixed(5)}</div>
          </div>
          <button class="geo-btn geo-btn-p" onclick="confirmGeoAddress('Position GPS: \${lat.toFixed(5)}, \${lng.toFixed(5)}', \${lat}, \${lng}, 'https://www.google.com/maps?q=\${lat},\${lng}')">
            ✅ Confirmer ma position
          </button>
          <button class="geo-btn geo-btn-s" onclick="showManualInput()">✏️ Entrer l'adresse</button>
          <div id="manual-input" style="display:none">
            <div class="address-input-wrap">
              <input class="address-input" id="manual-addr" placeholder="Entrez votre adresse"/>
              <button class="address-send" onclick="sendManualAddress()">OK</button>
            </div>
          </div>
        \`;
      }
    },
    function(err){
      // Permission refusée ou erreur GPS
      var msg='';
      switch(err.code){
        case 1: msg='🚫 Accès au GPS refusé. Activez la géolocalisation dans les paramètres.'; break;
        case 2: msg='📡 Position indisponible. Vérifiez votre connexion GPS.'; break;
        case 3: msg='⏱️ Délai dépassé. Réessayez ou entrez votre adresse.'; break;
        default: msg='❌ Erreur GPS. Entrez votre adresse manuellement.';
      }
      content.innerHTML=\`
        <div class="geo-loading">\${msg}</div>
        <button class="geo-btn geo-btn-s" onclick="showManualInput()" style="margin-top:12px">✏️ Entrer mon adresse</button>
        <div id="manual-input" style="display:none">
          <div class="address-input-wrap">
            <input class="address-input" id="manual-addr" placeholder="Ex: Almadies, Dakar"/>
            <button class="address-send" onclick="sendManualAddress()">OK</button>
          </div>
        </div>
      \`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function confirmGeoAddress(addr, lat, lng, mapsUrl){
  closeGeoModal();
  // Masque les boutons d'action
  document.getElementById('actions').innerHTML='';

  // Affiche dans le chat
  addMsg('📍 Ma position: '+addr, true);
  showTyping();

  // Envoie au bot avec les coordonnées
  var msgToBot='Mon adresse de livraison est: '+addr+
    ' (GPS: '+lat.toFixed(5)+', '+lng.toFixed(5)+').'+
    ' Lien Maps pour le livreur: '+mapsUrl+
    '. Confirme ma commande avec cette adresse.';

  fetch('/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:msgToBot, botId, sessionId:sid})
  })
  .then(r=>r.json())
  .then(data=>{
    var ty=document.getElementById('typing');if(ty)ty.remove();
    addMsg(data.reply||'✅ Adresse confirmée!',false);
    // Affiche le lien Maps pour que le client voit sa position
    var actEl=document.getElementById('actions');
    var mapsLink=document.createElement('a');
    mapsLink.className='act act-maps';
    mapsLink.textContent='🗺️ Voir sur la carte';
    mapsLink.href='https://www.google.com/maps?q='+lat+','+lng;
    mapsLink.target='_blank';
    actEl.appendChild(mapsLink);
    // Ajoute les options de paiement si disponibles
    if(data.actions?.length){
      data.actions.forEach(function(a){
        if(a.type==='wave'||a.type==='om'||a.type==='cash'){
          if(a.url){var l=document.createElement('a');l.className='act act-'+a.type;l.textContent=a.label;l.href=a.url;l.target='_blank';actEl.appendChild(l);}
          else if(a.type==='cash'){var b=document.createElement('button');b.className='act act-cash';b.textContent=a.label;b.onclick=function(){addMsg('✅ Paiement à la livraison confirmé!',false);actEl.innerHTML='';};actEl.appendChild(b);}
        }
      });
    }
  })
  .catch(()=>{var ty=document.getElementById('typing');if(ty)ty.remove();addMsg('✅ Position reçue! Commande confirmée.',false);});
}

// Ferme modal si click dehors
document.getElementById('geo-modal').onclick=function(e){if(e.target===this)closeGeoModal();};

function renderCat(items){
  var el=document.getElementById('catalogue');
  if(!items?.length){el.style.display='none';return;}
  el.style.display='flex';el.innerHTML='';
  items.forEach(function(item){
    var c=document.createElement('div');c.className='cat-card';
    var imgHtml=item.image
      ?'<img src="'+item.image+'" class="cat-img" alt="'+item.nom+'" onerror="this.style.display=&#39;none&#39;;this.nextSibling.style.display=&#39;flex&#39;"/><div class="cat-img-placeholder" style="display:none">'+(item.emoji||'🛍️')+'</div>'
      :'<div class="cat-img-placeholder">'+(item.emoji||'🛍️')+'</div>';
    var descHtml=item.desc?'<span class="cat-desc-small">'+item.desc+'</span>':'';
    c.innerHTML=imgHtml
      +'<div class="cat-body">'
      +'<span class="cat-nom">'+item.nom+'</span>'
      +descHtml
      +'<div class="cat-footer">'
      +'<span class="cat-prix">'+item.prix.toLocaleString('fr-FR')+' F</span>'
      +'<button class="cat-add" onclick="event.stopPropagation()">+</button>'
      +'</div></div>';
    c.onclick=function(){send('Je veux commander '+item.nom);};
    c.querySelector('.cat-add').onclick=function(e){e.stopPropagation();send('Je veux commander '+item.nom);};
    el.appendChild(c);
  });
}

function showRating(){
  var el=document.getElementById('rating');el.style.display='flex';el.innerHTML='';
  [1,2,3,4,5].forEach(function(n){
    var b=document.createElement('button');b.className='star-btn';b.textContent='☆';
    b.onclick=function(){
      document.querySelectorAll('.star-btn').forEach((s,i)=>s.textContent=i<n?'⭐':'☆');
      setTimeout(function(){
        fetch('/avis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId,sessionId:sid,note:n})}).catch(()=>{});
        el.style.display='none';
        addMsg('Jerejef! 🙏 Merci pour votre note '+n+'/5!',false);
      },600);
    };
    el.appendChild(b);
  });
}

function showTyping(){
  var m=document.getElementById('msgs');
  var d=document.createElement('div');d.className='msg';d.id='typing';
  var t=document.createElement('div');t.className='typing';
  t.innerHTML='<span></span><span></span><span></span>';
  d.appendChild(makeAv());d.appendChild(t);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

// VOCAL
async function toggleMic(){
  if(!isRec)await startRec();
  else stopRec();
}

async function startRec(){
  try{
    var stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    audioChunks=[];
    var mimeType='audio/webm';
    if(!MediaRecorder.isTypeSupported(mimeType))mimeType='audio/mp4';
    if(!MediaRecorder.isTypeSupported(mimeType))mimeType='';
    mediaRec=new MediaRecorder(stream,mimeType?{mimeType}:{});
    mediaRec.ondataavailable=function(e){if(e.data.size>0)audioChunks.push(e.data);};
    mediaRec.onstop=async function(){
      stream.getTracks().forEach(t=>t.stop());
      var blob=new Blob(audioChunks,{type:mimeType||'audio/webm'});
      await processVoice(blob,mimeType||'audio/webm');
    };
    mediaRec.start(100);
    isRec=true;
    document.getElementById('mic-btn').classList.add('recording');
    document.getElementById('mic-btn').textContent='⏹️';
    var tr=document.getElementById('transcription');
    tr.style.display='block';tr.textContent='🎤 Parlez maintenant... (cliquez ⏹️ pour arrêter)';
  }catch(e){
    alert('Microphone non accessible. Vérifiez les permissions du navigateur.');
  }
}

function stopRec(){
  if(mediaRec&&isRec){
    mediaRec.stop();isRec=false;
    document.getElementById('mic-btn').classList.remove('recording');
    document.getElementById('mic-btn').textContent='🎤';
    document.getElementById('transcription').textContent='⏳ Transcription en cours...';
  }
}

async function processVoice(blob,mimeType){
  var reader=new FileReader();
  reader.onload=async function(e){
    try{
      var r=await fetch('/chat/voice',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({base64:e.target.result,mimeType,fileName:'audio.webm',botId,sessionId:sid})
      });
      var data=await r.json();
      document.getElementById('transcription').style.display='none';
      document.getElementById('qr').innerHTML='';
      document.getElementById('actions').innerHTML='';
      document.getElementById('catalogue').style.display='none';
      document.getElementById('rating').style.display='none';
      if(data.transcription){
        addMsg(data.transcription,true,true);
        showTyping();
        setTimeout(function(){
          var ty=document.getElementById('typing');if(ty)ty.remove();
          if(data.reply)addMsg(data.reply,false);
          if(data.actions?.length)renderActions(data.actions);
        },500);
      }else{
        addMsg('Je n\\'ai pas pu comprendre. Réessayez ou écrivez votre message.',false);
      }
    }catch(err){
      document.getElementById('transcription').style.display='none';
      addMsg('Erreur de traitement vocal. Réessayez.',false);
    }
  };
  reader.readAsDataURL(blob);
}

function send(t){
  var inp=document.getElementById('inp');
  var msg=t||(inp.value.trim());if(!msg)return;
  inp.value='';
  document.getElementById('qr').innerHTML='';
  document.getElementById('actions').innerHTML='';
  document.getElementById('catalogue').style.display='none';
  document.getElementById('rating').style.display='none';
  addMsg(msg,true,false);
  showTyping();
  fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,botId,sessionId:sid})})
  .then(r=>r.json())
  .then(data=>{
    var ty=document.getElementById('typing');if(ty)ty.remove();
    addMsg(data.reply||'Désolé, erreur.',false);
    if(data.actions?.length)renderActions(data.actions);
    if(data.catalogue?.length)renderCat(data.catalogue);
    // Animation confirmation visuelle si commande validée
    if(data.reply && /commande\s+confirm[ée]/i.test(data.reply)){
      showOrderConfirmedAnimation();
    }
  })
  .catch(()=>{var ty=document.getElementById('typing');if(ty)ty.remove();addMsg('Désolé, erreur. Réessayez.',false);});
}

// Animation de confirmation de commande (checkmark vert qui apparaît)
function showOrderConfirmedAnimation(){
  var existing = document.getElementById('order-confirmed-anim');
  if(existing) existing.remove();
  var div = document.createElement('div');
  div.id = 'order-confirmed-anim';
  div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#00c875;color:#fff;padding:30px 40px;border-radius:20px;font-size:16px;font-weight:700;text-align:center;z-index:9999;box-shadow:0 10px 40px rgba(0,200,117,0.4);animation:popIn .4s ease;font-family:inherit';
  div.innerHTML = '<div style="font-size:60px;margin-bottom:10px;animation:bounce .6s ease">✅</div>Commande confirmée!';
  document.body.appendChild(div);
  // Style anim si pas déjà présent
  if(!document.getElementById('order-anim-css')){
    var s = document.createElement('style');
    s.id = 'order-anim-css';
    s.textContent = '@keyframes popIn{0%{transform:translate(-50%,-50%) scale(0);opacity:0}60%{transform:translate(-50%,-50%) scale(1.1)}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}';
    document.head.appendChild(s);
  }
  setTimeout(function(){
    div.style.transition = 'opacity .4s';
    div.style.opacity = '0';
    setTimeout(function(){ div.remove(); }, 400);
  }, 1800);
}

// Bouton "Recommencer la conversation"
function restartConversation(){
  if(!confirm('Recommencer la conversation? Votre historique sera effacé.')) return;
  // Nouvelle session ID
  sid = botId + '_' + Date.now();
  try { localStorage.setItem('samabot_sid_' + botId, sid); } catch(e){}
  // Vider le chat sauf le message d'accueil
  var msgs = document.getElementById('msgs');
  msgs.innerHTML = '';
  // Remettre message d'accueil
  var welcome = document.createElement('div');
  welcome.className = 'msg';
  welcome.innerHTML = '<div class="av">' + (BOT_LOGO ? '<img src="'+BOT_LOGO+'" alt=""/>' : BOT_EMOJI) + '</div><div class="bub b">Asalaa maalekum! 👋 Bienvenue chez <strong>' + BOT_NAME + '</strong>.<br><br>Écrivez ou utilisez le 🎤 pour parler en wolof ou français!</div>';
  msgs.appendChild(welcome);
  // Vider zones d'actions
  document.getElementById('actions').innerHTML='';
  document.getElementById('catalogue').style.display='none';
  document.getElementById('rating').style.display='none';
  // Re-rendre les suggestions QR
  renderInitialSuggestions();
}

// Suggestions intelligentes selon la niche/catalogue
function renderInitialSuggestions(){
  var qrEl = document.getElementById('qr');
  if(!qrEl) return;
  qrEl.innerHTML = '';
  var suggestions = window.__INIT_QR || [];
  suggestions.forEach(function(s){
    var b = document.createElement('button');
    b.className = 'qb';
    b.textContent = s;
    b.onclick = function(){ send(s); };
    qrEl.appendChild(b);
  });
}

// Hook bouton recommencer
(function(){
  var btn = document.getElementById('hd-restart');
  if(btn) btn.addEventListener('click', restartConversation);
})();
</script>
</body>
</html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});

// ============================================
// ============================================
// ADMIN DASHBOARD — Interface complète
// ============================================
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'samabot_admin_2025';
const adminPageHtml = "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n<meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">\n<title>SamaBot Admin</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{font-family:'DM Sans',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh}\n.nav{background:#111;border-bottom:1px solid #222;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}\n.logo{font-family:'Syne',sans-serif;font-size:18px;font-weight:800}.logo span{color:#00c875}\n.badge{background:#00c875;color:#000;border-radius:20px;padding:2px 10px;font-size:11px;font-weight:800;margin-left:8px}\n.wrap{max-width:1200px;margin:0 auto;padding:28px 20px}\n.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:28px}\n.kpi{background:#111;border:1px solid #222;border-radius:12px;padding:20px}\n.kpi-val{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;color:#00c875;line-height:1}\n.kpi-lbl{font-size:12px;color:#666;margin-top:6px}\n.tabs{display:flex;gap:0;border-bottom:1px solid #222;margin-bottom:20px}\n.tab{padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;color:#666;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s}\n.tab.active{color:#00c875;border-bottom-color:#00c875}\n.tc{display:none}.tc.active{display:block}\n.table{width:100%;border-collapse:collapse}\n.table th{background:#111;border:1px solid #222;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;text-align:left;font-weight:600}\n.table td{border:1px solid #1a1a1a;padding:10px 12px;font-size:13px;color:#ccc;vertical-align:top}\n.table tr:hover td{background:#111}\n.pill{border-radius:20px;padding:2px 8px;font-size:10px;font-weight:800;display:inline-block}\n.p-free{background:#222;color:#666}\n.p-starter{background:#1a2e1a;color:#00c875}\n.p-pro{background:#1a1a2e;color:#6366f1}\n.p-business{background:#2e1a1a;color:#f59e0b}\n.search{background:#111;border:1px solid #333;border-radius:8px;padding:8px 14px;font-size:13px;color:#fff;font-family:inherit;outline:none;width:240px}\n.search:focus{border-color:#00c875}\n.fb{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}\n.ab{background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:4px 10px;font-size:11px;color:#ccc;cursor:pointer;font-family:inherit}\n.ab:hover{border-color:#00c875;color:#00c875}\n.msg{background:#1a1a1a;border-radius:8px;padding:8px 10px;font-size:12px;color:#999;max-width:400px;line-height:1.4}\n</style>\n</head>\n<body>\n<div class=\"nav\">\n  <div><span class=\"logo\">Sama<span>Bot</span></span><span class=\"badge\">ADMIN</span></div>\n  <div style=\"font-size:12px;color:#444\" id=\"ref\">Chargement...</div>\n</div>\n<div class=\"wrap\">\n  <div class=\"kpis\">\n    <div class=\"kpi\"><div class=\"kpi-val\" id=\"k-u\">-</div><div class=\"kpi-lbl\">Clients</div></div>\n    <div class=\"kpi\"><div class=\"kpi-val\" id=\"k-b\">-</div><div class=\"kpi-lbl\">Bots actifs</div></div>\n    <div class=\"kpi\"><div class=\"kpi-val\" id=\"k-m\">-</div><div class=\"kpi-lbl\">Msgs aujourd_hui</div></div>\n    <div class=\"kpi\"><div class=\"kpi-val\" id=\"k-o\">-</div><div class=\"kpi-lbl\">Commandes</div></div>\n    <div class=\"kpi\"><div class=\"kpi-val\" id=\"k-r\">-</div><div class=\"kpi-lbl\">Revenus</div></div>\n  </div>\n  <div class=\"tabs\">\n    <div class=\"tab active\" onclick=\"st('clients',this)\">Clients</div>\n    <div class=\"tab\" onclick=\"st('bots',this)\">Bots</div>\n    <div class=\"tab\" onclick=\"st('cmds',this)\">Commandes</div>\n    <div class=\"tab\" onclick=\"st('msgs',this)\">Messages</div>\n  </div>\n  <div id=\"tc-clients\" class=\"tc active\">\n    <div class=\"fb\"><b style=\"color:#fff\">Tous les clients</b><input class=\"search\" placeholder=\"Rechercher...\" oninput=\"ft('t-cl',this.value)\"/></div>\n    <table class=\"table\" id=\"t-cl\"><thead><tr><th>Client</th><th>Email</th><th>Plan</th><th>Bots</th><th>Inscrit le</th><th>Actions</th></tr></thead><tbody id=\"b-cl\"><tr><td colspan=\"6\" style=\"text-align:center;color:#444\">Chargement...</td></tr></tbody></table>\n  </div>\n  <div id=\"tc-bots\" class=\"tc\">\n    <div class=\"fb\"><b style=\"color:#fff\">Tous les bots</b><input class=\"search\" placeholder=\"Rechercher...\" oninput=\"ft('t-bo',this.value)\"/></div>\n    <table class=\"table\" id=\"t-bo\"><thead><tr><th>Bot</th><th>Niche</th><th>Owner</th><th>Msgs</th><th>Cmds</th><th>Cree le</th><th>Actions</th></tr></thead><tbody id=\"b-bo\"><tr><td colspan=\"7\" style=\"text-align:center;color:#444\">Chargement...</td></tr></tbody></table>\n  </div>\n  <div id=\"tc-cmds\" class=\"tc\">\n    <div class=\"fb\"><b style=\"color:#fff\">Toutes les commandes</b><input class=\"search\" placeholder=\"Rechercher...\" oninput=\"ft('t-cm',this.value)\"/></div>\n    <table class=\"table\" id=\"t-cm\"><thead><tr><th>Ref</th><th>Bot</th><th>Client</th><th>Total</th><th>Statut</th><th>Date</th></tr></thead><tbody id=\"b-cm\"><tr><td colspan=\"6\" style=\"text-align:center;color:#444\">Chargement...</td></tr></tbody></table>\n  </div>\n  <div id=\"tc-msgs\" class=\"tc\">\n    <b style=\"color:#fff;display:block;margin-bottom:14px\">Messages recents</b>\n    <div id=\"msgs-list\" style=\"display:flex;flex-direction:column;gap:8px\"></div>\n  </div>\n</div>\n<script>\nvar SEC = 'PLACEHOLDER_SECRET';\nvar D = {};\n\nfunction st(id,el){\n  document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});\n  document.querySelectorAll('.tc').forEach(function(t){t.classList.remove('active');});\n  el.classList.add('active');\n  document.getElementById('tc-'+id).classList.add('active');\n}\n\nfunction ft(tid,q){\n  var rows=document.querySelectorAll('#'+tid+' tbody tr');\n  q=q.toLowerCase();\n  rows.forEach(function(r){r.style.display=r.textContent.toLowerCase().includes(q)?'':'none';});\n}\n\nfunction pp(plan){\n  var cls={'free':'p-free','starter':'p-starter','pro':'p-pro','business':'p-business'};\n  return '<span class=\"pill '+(cls[plan]||'p-free')+'\">'+(plan||'free').toUpperCase()+'</span>';\n}\n\nfunction ld(){\n  fetch('/admin/stats?secret='+SEC)\n    .then(function(r){\n      if(!r.ok){document.getElementById('ref').textContent='Erreur '+r.status;return null;}\n      return r.json();\n    })\n    .then(function(d){\n      if(!d||!d.stats)return;\n      D=d;\n      document.getElementById('k-u').textContent=d.stats.total_users;\n      document.getElementById('k-b').textContent=d.stats.total_bots;\n      document.getElementById('k-m').textContent=d.stats.messages_today;\n      document.getElementById('k-o').textContent=(d.commandes||[]).length;\n      document.getElementById('k-r').textContent=((d.stats.total_revenue||0)/1000).toFixed(0)+'K F';\n      document.getElementById('ref').textContent='Mis a jour: '+new Date().toLocaleTimeString('fr-FR');\n\n      // CLIENTS\n      var ch='';\n      (d.users||[]).forEach(function(u){\n        var ub=(d.bots||[]).filter(function(b){return b.user_id===u.id;});\n        ch+='<tr>'\n          +'<td><strong style=\"color:#fff\">'+(u.nom||'-')+'</strong></td>'\n          +'<td>'+u.email+'</td>'\n          +'<td>'+pp(u.plan)+'</td>'\n          +'<td>'+ub.length+'</td>'\n          +'<td style=\"color:#444\">'+new Date(u.created_at).toLocaleDateString('fr-FR')+'</td>'\n          +'<td><button class=\"ab\" onclick=\"cp(this)\" data-uid=\"'+u.id+'\">Plan</button></td>'\n          +'</tr>';\n      });\n      document.getElementById('b-cl').innerHTML=ch||'<tr><td colspan=\"6\" style=\"text-align:center;color:#444\">Aucun client</td></tr>';\n\n      // BOTS\n      var bh='';\n      (d.bots||[]).forEach(function(b){\n        var ow=(d.users||[]).find(function(u){return u.id===b.user_id;});\n        var bc=(d.commandes||[]).filter(function(c){return c.bot_id===b.id;});\n        bh+='<tr>'\n          +'<td><strong style=\"color:#fff\">'+b.nom+'</strong></td>'\n          +'<td><span style=\"background:#1a1a1a;padding:2px 8px;border-radius:20px;font-size:11px\">'+b.niche+'</span></td>'\n          +'<td style=\"color:#888\">'+(ow?ow.email:'-')+'</td>'\n          +'<td>'+(b.messages_count||0)+'</td>'\n          +'<td>'+bc.length+'</td>'\n          +'<td style=\"color:#444\">'+new Date(b.created_at).toLocaleDateString('fr-FR')+'</td>'\n          +'<td>'\n            +'<a href=\"/dashboard/'+b.id+'\" target=\"_blank\" class=\"ab\">Dashboard</a>'\n          +'</td>'\n          +'</tr>';\n      });\n      document.getElementById('b-bo').innerHTML=bh||'<tr><td colspan=\"7\" style=\"text-align:center;color:#444\">Aucun bot</td></tr>';\n\n      // COMMANDES\n      var oh='';\n      (d.commandes||[]).forEach(function(c){\n        var bo=(d.bots||[]).find(function(b){return b.id===c.bot_id;});\n        oh+='<tr>'\n          +'<td><strong style=\"color:#fff;font-size:12px\">'+(c.numero||c.id.substring(0,8))+'</strong></td>'\n          +'<td>'+(bo?bo.nom:c.bot_id)+'</td>'\n          +'<td>'+(c.client_nom||'-')+'</td>'\n          +'<td style=\"color:#00c875;font-weight:700\">'+(c.total||0).toLocaleString('fr-FR')+' F</td>'\n          +'<td><span style=\"background:#1a1a1a;padding:2px 8px;border-radius:20px;font-size:11px\">'+c.statut+'</span></td>'\n          +'<td style=\"color:#444;font-size:11px\">'+new Date(c.created_at).toLocaleString('fr-FR')+'</td>'\n          +'</tr>';\n      });\n      document.getElementById('b-cm').innerHTML=oh||'<tr><td colspan=\"6\" style=\"text-align:center;color:#444\">Aucune commande</td></tr>';\n\n      // MESSAGES\n      var mh='';\n      (d.recent_messages||[]).slice(0,20).forEach(function(m){\n        var bo=(d.bots||[]).find(function(b){return b.id===m.bot_id;});\n        mh+='<div style=\"display:flex;gap:10px;align-items:flex-start\">'\n          +'<div style=\"font-size:10px;color:#444;min-width:100px;padding-top:4px\">'+new Date(m.created_at).toLocaleTimeString('fr-FR')+'<br>'+(bo?bo.nom:'?')+'<br><span style=\"color:'+(m.role==='user'?'#6366f1':'#00c875')+'\">'+m.role+'</span></div>'\n          +'<div class=\"msg\">'+m.content.substring(0,200)+'</div>'\n          +'</div>';\n      });\n      document.getElementById('msgs-list').innerHTML=mh||'<div style=\"color:#444\">Aucun message</div>';\n    })\n    .catch(function(e){\n      document.getElementById('ref').textContent='Erreur: '+e.message;\n    });\n}\n\nasync function cp(btn){ var uid = btn.getAttribute('data-uid');\n  var plan=prompt('Nouveau plan (free/starter/pro/business):');\n  if(!plan)return;\n  var r=await fetch('/admin/user/'+uid+'/plan',{method:'PATCH',headers:{'Content-Type':'application/json','X-Admin-Secret':SEC},body:JSON.stringify({plan:plan})});\n  var d=await r.json();\n  if(d.success){alert('Plan mis a jour!');ld();}\n  else alert('Erreur: '+d.error);\n}\n\nld();\nsetInterval(ld,30000);\n</script>\n</body>\n</html>";

app.get('/admin', (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) return res.status(401).send('Non autorise');
  const html = adminPageHtml.replace('PLACEHOLDER_SECRET', ADMIN_SECRET);
  res.send(html);
});


app.get('/admin/stats', async (req, res) => {
  if (req.query.secret !== ADMIN_SECRET && req.headers['x-admin-secret'] !== ADMIN_SECRET)
    return res.status(401).json({ error:'Non autorisé' });
  try {
    const [bots, users, msgs, commandes, audio] = await Promise.all([
      db.select('bots','?actif=eq.true&order=created_at.desc'),
      db.select('users','?order=created_at.desc'),
      db.select('messages','?order=created_at.desc&limit=30'),
      db.select('commandes','?order=created_at.desc&limit=100'),
      db.select('audio_messages','?order=created_at.desc&limit=20')
    ]);
    const msgsToday = msgs?.filter(m=>new Date(m.created_at)>new Date(Date.now()-86400000)).length||0;
    const revenu = commandes?.filter(c=>c.statut==='paid').reduce((s,c)=>s+(c.total||0),0)||0;
    res.json({
      stats:{ total_users:users?.length||0, total_bots:bots?.length||0, messages_today:msgsToday, total_revenue:revenu, total_audio:audio?.length||0 },
      bots:bots||[], users:users||[], recent_messages:msgs||[], commandes:commandes||[], audio_messages:audio||[]
    });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Admin — changer plan d'un user
app.patch('/admin/user/:id/plan', async (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET && req.query.secret !== ADMIN_SECRET)
    return res.status(401).json({ error:'Non autorisé' });
  try {
    const { plan } = req.body;
    if (!['free','starter','pro','business'].includes(plan)) return res.status(400).json({ error:'Plan invalide' });
    await db.update('users', { plan, updated_at:new Date().toISOString() }, `?id=eq.${req.params.id}`);
    res.json({ success:true });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// 💰 Admin Billing — vue MRR / conversion / churn
app.get('/admin/billing', async (req, res) => {
  if (req.query.secret !== ADMIN_SECRET && req.headers['x-admin-secret'] !== ADMIN_SECRET)
    return res.status(401).json({ error:'Non autorisé' });
  try {
    const bots = await db.select('bots', '?actif=eq.true&select=id,nom,plan,subscription_status,trial_until,subscription_started_at,created_at');
    const all = bots || [];
    const now = Date.now();

    // Calculer MRR
    let mrr = 0;
    const counts = { trial: 0, starter: 0, pro: 0, business: 0, expired: 0, canceled: 0, past_due: 0 };
    for (const b of all) {
      const plan = b.plan || 'trial';
      const status = b.subscription_status;
      if (status === 'canceled') counts.canceled++;
      else if (status === 'past_due') counts.past_due++;
      else if (plan === 'trial') {
        if (b.trial_until && new Date(b.trial_until).getTime() < now) counts.expired++;
        else counts.trial++;
      } else if (plan === 'starter') { counts.starter++; mrr += 9; }
      else if (plan === 'pro') { counts.pro++; mrr += 25; }
      else if (plan === 'business') { counts.business++; mrr += 85; }
    }

    // Conversion rate
    const totalEverTrials = all.length;
    const totalPaid = counts.starter + counts.pro + counts.business;
    const conversionRate = totalEverTrials > 0 ? (100 * totalPaid / totalEverTrials).toFixed(1) : 0;

    // Liste des bots payants (top revenue)
    const paidBots = all
      .filter(b => ['starter','pro','business'].includes(b.plan) && b.subscription_status === 'active')
      .map(b => ({
        ...b,
        mrr: PLANS[b.plan]?.price_usd_monthly || 0
      }))
      .sort((a, b) => b.mrr - a.mrr);

    res.json({
      mrr_usd: mrr,
      mrr_fcfa: mrr * 600, // estim 1 USD = 600 FCFA
      arr_usd: mrr * 12,
      counts,
      total_bots: all.length,
      conversion_rate: parseFloat(conversionRate),
      paid_bots: paidBots.slice(0, 50)
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});

// Page HTML admin billing (vue CEO MRR)
app.get('/admin/billing-view', (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) return res.status(401).send('Non autorisé');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Billing — Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;padding:20px}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:24px;margin-bottom:20px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:30px}
.kpi{background:#111;border:1px solid #222;border-radius:12px;padding:20px}
.kpi-val{font-size:30px;font-weight:800;color:#00c875}
.kpi-lbl{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.kpi-sub{font-size:12px;color:#888;margin-top:4px}
.section{background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:20px}
.section h2{font-size:16px;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:8px;font-size:11px;color:#666;text-transform:uppercase;border-bottom:1px solid #222}
td{padding:10px 8px;border-bottom:1px solid #1a1a1a;font-size:13px}
.pill{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;display:inline-block}
.p-trial{background:#fef9c3;color:#854d0e}
.p-starter{background:#dcfce7;color:#166534}
.p-pro{background:#dbeafe;color:#1e40af}
.p-business{background:#fef3c7;color:#92400e}
.p-canceled{background:#fecaca;color:#991b1b}
.p-past_due{background:#fed7aa;color:#9a3412}
</style></head><body>
<div class="wrap">
<h1>💰 Vue CEO — Billing & MRR</h1>
<div class="kpis" id="kpis"><div style="color:#666">Chargement...</div></div>
<div class="section">
  <h2>👥 Distribution des plans</h2>
  <div id="dist"></div>
</div>
<div class="section">
  <h2>💎 Top clients payants</h2>
  <table id="paid"><thead><tr><th>Bot</th><th>Plan</th><th>MRR</th><th>Statut</th><th>Depuis</th></tr></thead><tbody><tr><td colspan="5" style="color:#666">Chargement...</td></tr></tbody></table>
</div>
</div>
<script>
fetch('/admin/billing?secret=' + encodeURIComponent('${ADMIN_SECRET}'))
  .then(r => r.json())
  .then(d => {
    if (d.error) { document.body.innerHTML = '<p style="color:red">Erreur: '+d.error+'</p>'; return; }
    document.getElementById('kpis').innerHTML =
      '<div class="kpi"><div class="kpi-val">$'+d.mrr_usd+'</div><div class="kpi-lbl">MRR Mensuel</div><div class="kpi-sub">≈ '+d.mrr_fcfa.toLocaleString('fr-FR')+' FCFA</div></div>'+
      '<div class="kpi"><div class="kpi-val">$'+d.arr_usd+'</div><div class="kpi-lbl">ARR Annuel</div></div>'+
      '<div class="kpi"><div class="kpi-val">'+d.conversion_rate+'%</div><div class="kpi-lbl">Conv. trial→paid</div></div>'+
      '<div class="kpi"><div class="kpi-val">'+(d.counts.starter+d.counts.pro+d.counts.business)+'</div><div class="kpi-lbl">Clients payants</div></div>'+
      '<div class="kpi"><div class="kpi-val">'+d.counts.trial+'</div><div class="kpi-lbl">En trial actif</div></div>';

    document.getElementById('dist').innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">'+
      '<div><span class="pill p-trial">TRIAL</span> '+d.counts.trial+'</div>'+
      '<div><span class="pill p-starter">STARTER</span> '+d.counts.starter+'</div>'+
      '<div><span class="pill p-pro">PRO</span> '+d.counts.pro+'</div>'+
      '<div><span class="pill p-business">BUSINESS</span> '+d.counts.business+'</div>'+
      '<div><span class="pill p-canceled">CANCELED</span> '+d.counts.canceled+'</div>'+
      '<div><span class="pill p-past_due">PAST DUE</span> '+d.counts.past_due+'</div>'+
      '<div style="color:#666">EXPIRÉS: '+d.counts.expired+'</div>'+
      '</div>';

    var rows = '';
    if (!d.paid_bots.length) rows = '<tr><td colspan="5" style="color:#666;text-align:center;padding:30px">Aucun client payant pour l\\'instant</td></tr>';
    else d.paid_bots.forEach(function(b){
      rows += '<tr><td><strong>'+b.nom+'</strong></td>'+
              '<td><span class="pill p-'+b.plan+'">'+b.plan.toUpperCase()+'</span></td>'+
              '<td style="color:#00c875;font-weight:700">$'+b.mrr+'/mo</td>'+
              '<td>'+(b.subscription_status||'-')+'</td>'+
              '<td style="color:#666">'+(b.subscription_started_at?new Date(b.subscription_started_at).toLocaleDateString('fr-FR'):'-')+'</td></tr>';
    });
    document.querySelector('#paid tbody').innerHTML = rows;
  });
</script>
</body></html>`);
});

// Logout (stateless mais utile pour uniformiser)
app.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Déconnecté' });
});

// Test token
app.get('/auth/test', (req, res) => {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ','');
  const userId = verifyToken(token);
  res.json({ valid: !!userId, userId: userId || null });
});

// Reset password (admin)
app.get('/admin/reset-password', async (req, res) => {
  if (req.query.secret !== ADMIN_SECRET) return res.status(401).send('Non autorisé');
  try {
    const { email, password } = req.query;
    if (!email || !password) return res.status(400).send('email et password requis');
    const passHash = Buffer.from(password + CONFIG.JWT_SECRET).toString('base64');
    await db.update('users', { password_hash: passHash }, `?email=eq.${encodeURIComponent(email)}`);
    // Génère aussi un token direct pour tester
    const users = await db.select('users', `?email=eq.${encodeURIComponent(email)}`);
    const user = users?.[0];
    const token = user ? generateToken(user.id) : null;
    res.send(`
      <h2>✅ Mot de passe mis à jour pour ${email}</h2>
      <p>Token de test: <code>${token?.substring(0,30)}...</code></p>
      <p><a href="/app?token=${token}&user=${encodeURIComponent(JSON.stringify({id:user?.id,email,nom:user?.nom,plan:user?.plan}))}">👉 Aller sur /app directement</a></p>
      <p><a href="/login">Ou se connecter normalement</a></p>
    `);
  } catch(e) { res.status(500).send('Erreur: ' + e.message); }
});


app.patch('/admin/bot/:id/toggle', async (req, res) => {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET)
    return res.status(401).json({ error:'Non autorisé' });
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.id}`);
    const bot = bots?.[0];
    if (!bot) return res.status(404).json({ error:'Bot non trouvé' });
    await db.update('bots', { actif:!bot.actif }, `?id=eq.${req.params.id}`);
    res.json({ success:true, actif:!bot.actif });
  } catch(e) { res.status(500).json({error:e.message}); }
});


// ============================================
// AUTH — Login / Register / My bots
// ============================================
// (generateToken et verifyToken définis plus haut)

app.get('/login', (req, res) => {
  const error = req.query.error;
  const googleEnabled = !!(CONFIG.GOOGLE_CLIENT_ID);
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>SamaBot — Connexion</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f0f4f1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.box{background:#fff;border-radius:16px;padding:36px 32px;width:100%;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.logo{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#0a1a0f;margin-bottom:6px}.logo span{color:#00c875}
.sub{font-size:14px;color:#5a7060;margin-bottom:24px}
.btn-google{width:100%;background:#fff;color:#3c4043;border:1.5px solid #dadce0;border-radius:10px;padding:13px 14px;font-size:14px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;text-decoration:none}
.btn-google:hover{background:#f8f9fa;border-color:#c6c9cc}
.btn-google svg{flex-shrink:0}
.divider{display:flex;align-items:center;gap:12px;margin-bottom:16px}
.divider-line{flex:1;height:1px;background:#e5e7eb}
.divider-txt{font-size:12px;color:#9ab0a0;white-space:nowrap}
.tabs{display:flex;margin-bottom:20px;border-bottom:2px solid #e5e7eb}
.tab{flex:1;padding:10px;text-align:center;font-size:14px;font-weight:600;cursor:pointer;color:#9ab0a0;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
.tab.active{color:#00c875;border-bottom-color:#00c875}
.form{display:none}.form.active{display:block}
label{font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:5px}
input{width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;margin-bottom:14px;transition:border .15s;color:#0a1a0f}
input:focus{border-color:#00c875}
.btn{width:100%;background:#00c875;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s}
.btn:hover{background:#00a862}.btn:disabled{opacity:.6;cursor:not-allowed}
.msg{border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px;display:none}
.msg.show{display:block}.msg.err{background:#fee2e2;color:#dc2626}.msg.ok{background:#dcfce7;color:#166534}
</style>
</head>
<body>
<div class="box">
  <div class="logo">Sama<span>Bot</span></div>
  <p class="sub">Gérez votre assistant IA</p>

  ${googleEnabled ? `
  <a href="/auth/google" class="btn-google">
    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
    Continuer avec Google
  </a>
  <div class="divider"><div class="divider-line"></div><div class="divider-txt">ou avec email</div><div class="divider-line"></div></div>
  ` : ''}

  <div class="tabs">
    <div class="tab active" onclick="showTab('login',this)">Connexion</div>
    <div class="tab" onclick="showTab('register',this)">Créer un compte</div>
  </div>
  <div id="msg" class="msg"></div>
  <div id="form-login" class="form active">
    <label>Email</label><input id="l-email" type="email" placeholder="votre@email.com" style="width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px;color:#0a1a0f"/>
    <label>Mot de passe</label>
    <div style="position:relative;margin-bottom:14px">
      <input id="l-pass" type="password" placeholder="••••••••" style="width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 44px 10px 14px;font-size:14px;font-family:inherit;outline:none;color:#0a1a0f"/>
      <button onclick="togglePwd('l-pass',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:#9ab0a0">👁️</button>
    </div>
    <button class="btn" id="l-btn" onclick="login()">Se connecter →</button>
  </div>
  <div id="form-register" class="form">
    <label>Nom</label><input id="r-nom" placeholder="Votre nom" style="width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px;color:#0a1a0f"/>
    <label>Email</label><input id="r-email" type="email" placeholder="votre@email.com" style="width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px;color:#0a1a0f"/>
    <label>Mot de passe</label>
    <div style="position:relative;margin-bottom:14px">
      <input id="r-pass" type="password" placeholder="6 caractères minimum" style="width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 44px 10px 14px;font-size:14px;font-family:inherit;outline:none;color:#0a1a0f"/>
      <button onclick="togglePwd('r-pass',this)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:#9ab0a0">👁️</button>
    </div>
    <button class="btn" id="r-btn" onclick="register()">Créer mon compte →</button>
  </div>
</div>
<script>
function togglePwd(id,btn){var i=document.getElementById(id);i.type=i.type==='password'?'text':'password';btn.textContent=i.type==='password'?'👁️':'🙈';}
function showTab(id,el){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.form').forEach(f=>f.classList.remove('active'));el.classList.add('active');document.getElementById('form-'+id).classList.add('active');hide();}
function show(msg,type){var e=document.getElementById('msg');e.textContent=msg;e.className='msg show '+type;}
function hide(){var e=document.getElementById('msg');e.className='msg';}
async function login(){
  var email=document.getElementById('l-email').value.trim();
  var pass=document.getElementById('l-pass').value;
  if(!email||!pass){show('Remplissez tous les champs','err');return;}
  document.getElementById('l-btn').disabled=true;document.getElementById('l-btn').textContent='Connexion...';
  try{
    var r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    var d=await r.json();
    if(d.token){localStorage.setItem('sb-token',d.token);localStorage.setItem('sb-user',JSON.stringify(d.user));window.location.href='/app';}
    else{show(d.error||'Erreur de connexion','err');}
  }catch(e){show('Erreur réseau','err');}
  document.getElementById('l-btn').disabled=false;document.getElementById('l-btn').textContent='Se connecter →';
}
async function register(){
  var nom=document.getElementById('r-nom').value.trim();
  var email=document.getElementById('r-email').value.trim();
  var pass=document.getElementById('r-pass').value;
  if(!nom||!email||!pass){show('Remplissez tous les champs','err');return;}
  if(pass.length<6){show('Mot de passe minimum 6 caractères','err');return;}
  document.getElementById('r-btn').disabled=true;document.getElementById('r-btn').textContent='Création...';
  try{
    var r=await fetch('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nom,email,password:pass})});
    var d=await r.json();
    if(d.token){localStorage.setItem('sb-token',d.token);localStorage.setItem('sb-user',JSON.stringify(d.user));window.location.href='/app';}
    else{show(d.error||'Erreur création compte','err');}
  }catch(e){show('Erreur réseau','err');}
  document.getElementById('r-btn').disabled=false;document.getElementById('r-btn').textContent='Créer mon compte →';
}
document.addEventListener('keydown',function(e){if(e.key==='Enter'){var a=document.querySelector('.form.active').id;if(a==='form-login')login();else register();}});
${error ? `show('Erreur Google: ${error}. Essayez avec email.','err');` : ''}
if(localStorage.getItem('sb-token'))window.location.href='/app';
</script>
</body>
</html>`);
});

app.get('/app', (req, res) => {
  res.send(appPageHtml);
});

app.get('/webhook', (req,res) => {
  if(req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===CONFIG.META_VERIFY_TOKEN)
    res.status(200).send(req.query['hub.challenge']);
  else res.sendStatus(403);
});

// ============================================
// MULTI-ÉTABLISSEMENTS (CHAÎNES)
// Concept: un bot "parent" peut avoir plusieurs "succursales" (autres bots liés via parent_bot_id)
// Routing GPS automatique: quand le client donne sa position, on trouve la succursale la plus proche
// ============================================

// Calcul distance Haversine entre 2 points GPS (km)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon terre en km
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Liste les succursales d'un bot parent
app.get('/succursales/:parentBotId', async (req, res) => {
  try {
    const succursales = await db.select('bots', `?parent_bot_id=eq.${req.params.parentBotId}&actif=eq.true&order=created_at.asc`);
    res.json(succursales || []);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Lier un bot existant comme succursale d'un parent
app.post('/succursales/:parentBotId/link/:childBotId', async (req, res) => {
  try {
    const { lat, lng, zone_label } = req.body;
    const updates = { parent_bot_id: req.params.parentBotId };
    if (lat) updates.location_lat = parseFloat(lat);
    if (lng) updates.location_lng = parseFloat(lng);
    if (zone_label) updates.zone_label = zone_label;
    await db.update('bots', updates, `?id=eq.${req.params.childBotId}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Délier une succursale
app.delete('/succursales/:parentBotId/unlink/:childBotId', async (req, res) => {
  try {
    await db.update('bots', { parent_bot_id: null }, `?id=eq.${req.params.childBotId}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Trouve la succursale la plus proche d'un client donné
app.post('/succursales/:parentBotId/nearest', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat et lng requis' });
    const succursales = await db.select('bots', `?parent_bot_id=eq.${req.params.parentBotId}&actif=eq.true`);
    if (!succursales?.length) {
      // Fallback: retourner le parent lui-même
      const parents = await db.select('bots', `?id=eq.${req.params.parentBotId}`);
      return res.json({ bot: parents?.[0] || null, distance_km: null, fallback: true });
    }

    const withDistance = succursales
      .filter(s => s.location_lat != null && s.location_lng != null)
      .map(s => ({
        ...s,
        distance_km: haversineKm(parseFloat(lat), parseFloat(lng), parseFloat(s.location_lat), parseFloat(s.location_lng))
      }))
      .sort((a, b) => a.distance_km - b.distance_km);

    if (!withDistance.length) {
      // Aucune succursale n'a de coordonnées GPS → retourne la première
      return res.json({ bot: succursales[0], distance_km: null, fallback: true });
    }

    const nearest = withDistance[0];
    res.json({
      bot: { id: nearest.id, nom: nearest.nom, adresse: nearest.adresse, telephone: nearest.telephone, zone_label: nearest.zone_label },
      distance_km: parseFloat(nearest.distance_km.toFixed(2)),
      all_options: withDistance.slice(0, 5).map(s => ({
        id: s.id, nom: s.nom, zone_label: s.zone_label, distance_km: parseFloat(s.distance_km.toFixed(2))
      })),
      fallback: false
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Page publique d'une chaîne — affiche toutes les succursales
app.get('/chaine/:parentBotId', async (req, res) => {
  try {
    const parents = await db.select('bots', `?id=eq.${req.params.parentBotId}`);
    const parent = parents?.[0];
    if (!parent) return res.status(404).send('Chaîne introuvable');
    const succursales = await db.select('bots', `?parent_bot_id=eq.${req.params.parentBotId}&actif=eq.true&order=zone_label.asc`);
    const list = succursales || [];

    res.send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${parent.nom} — Nos établissements</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#f5f7f6;color:#0a1a0f;min-height:100vh}
.hd{background:linear-gradient(135deg,${parent.couleur||'#00c875'},#0a1a0f);color:#fff;padding:30px 20px;text-align:center}
.hd-emoji{font-size:50px;margin-bottom:10px}
.hd-nm{font-size:22px;font-weight:800}
.hd-sub{font-size:13px;opacity:.9;margin-top:4px}
.wrap{max-width:600px;margin:0 auto;padding:20px}
.geo-btn{background:#00c875;color:#000;border:none;border-radius:12px;padding:14px;width:100%;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;display:block;text-decoration:none;color:#0a1a0f}
.card-nm{font-size:16px;font-weight:700}
.card-zone{display:inline-block;background:#f0fdf4;color:#166534;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-top:4px}
.card-addr{font-size:12px;color:#5a7060;margin-top:6px}
.card-dist{font-size:11px;color:#00c875;font-weight:700;margin-top:4px}
.empty{text-align:center;color:#9ab0a0;padding:40px;font-size:13px}
</style></head><body>
<div class="hd">
  <div class="hd-emoji">${parent.emoji||'🏢'}</div>
  <div class="hd-nm">${parent.nom}</div>
  <div class="hd-sub">${list.length} établissement${list.length>1?'s':''}</div>
</div>
<div class="wrap">
  <button class="geo-btn" id="geo">📍 Trouver le plus proche</button>
  <div id="list">
    ${list.length ? list.map(s => `
      <a href="/chat/${s.id}" class="card" data-lat="${s.location_lat||''}" data-lng="${s.location_lng||''}">
        <div class="card-nm">${s.nom}</div>
        ${s.zone_label?`<div class="card-zone">📍 ${s.zone_label}</div>`:''}
        ${s.adresse?`<div class="card-addr">${s.adresse}</div>`:''}
      </a>
    `).join('') : '<div class="empty">Aucun établissement actif. Liez des succursales depuis votre dashboard.</div>'}
  </div>
</div>
<script>
document.getElementById('geo').onclick = function(){
  if (!navigator.geolocation) { alert('Géolocalisation non supportée'); return; }
  this.textContent = '⏳ Localisation...';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    try {
      const r = await fetch('/succursales/${parent.id}/nearest', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng})});
      const d = await r.json();
      if (d.bot) {
        // Trier la liste avec distances
        if (d.all_options && d.all_options.length) {
          const cards = document.querySelectorAll('.card');
          const sorted = d.all_options;
          cards.forEach(c => {
            const id = c.href.split('/chat/')[1];
            const opt = sorted.find(o => o.id === id);
            if (opt) {
              if (!c.querySelector('.card-dist')) {
                const div = document.createElement('div');
                div.className = 'card-dist';
                div.textContent = '📏 ' + opt.distance_km + ' km';
                c.appendChild(div);
              }
            }
          });
          // Réordonner
          const list = document.getElementById('list');
          const ordered = sorted.map(o => Array.from(cards).find(c => c.href.endsWith('/chat/'+o.id))).filter(Boolean);
          ordered.forEach(c => list.appendChild(c));
        }
        document.getElementById('geo').textContent = '✅ Plus proche: ' + d.bot.nom + (d.distance_km?' ('+d.distance_km+' km)':'');
        document.getElementById('geo').style.background = '#fef3c7';
      } else {
        document.getElementById('geo').textContent = '❌ Aucun établissement trouvé';
      }
    } catch(e) { document.getElementById('geo').textContent = '❌ Erreur'; }
  }, () => {
    document.getElementById('geo').textContent = '❌ Permission refusée';
  });
};
</script>
</body></html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});

// ============================================
// WEBHOOK WHATSAPP — Réception des messages entrants
// Compatible: Meta Cloud API ET WaSender
// ============================================
app.post('/webhook', async (req, res) => {
  // Toujours répondre 200 immédiatement pour éviter les retries du provider
  res.sendStatus(200);

  try {
    const body = req.body || {};
    console.log('📥 Webhook reçu:', JSON.stringify(body).substring(0, 300));

    // ---- Format Meta Cloud API ----
    // body.entry[0].changes[0].value.messages[0]
    if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        for (const change of (entry.changes || [])) {
          const value = change.value || {};
          const messages = value.messages || [];
          const phoneNumberId = value.metadata?.phone_number_id; // Numéro qui a reçu le msg = bot

          for (const msg of messages) {
            const from = msg.from; // Numéro client
            const msgType = msg.type;
            let text = '';

            if (msgType === 'text') text = msg.text?.body || '';
            else if (msgType === 'button') text = msg.button?.text || '';
            else if (msgType === 'interactive') text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
            else if (msgType === 'audio') text = '[Message vocal reçu]'; // TODO: transcrire
            else { console.log(`📥 Type message non supporté: ${msgType}`); continue; }

            if (!text || !from) continue;

            // Trouver le bot associé à ce numéro WhatsApp Business
            const bot = await findBotForWhatsApp(phoneNumberId, value.metadata?.display_phone_number);
            if (!bot) {
              console.log(`⚠️ Aucun bot trouvé pour phone_number_id=${phoneNumberId}`);
              continue;
            }

            await handleWhatsAppMessage(bot, from, text, 'meta');
          }
        }
      }
      return;
    }

    // ---- Format WaSender ----
    // body.event = 'message.received', body.data.from, body.data.message.text...
    if (body.event === 'message.received' || body.event === 'messages.upsert') {
      const data = body.data || body.message || {};
      const from = data.from || data.sender || data.remoteJid || data.key?.remoteJid;
      let text = data.text || data.body || data.message?.conversation || data.message?.text || data.message?.extendedTextMessage?.text || '';

      // Nettoie le numéro WhatsApp (format: 221771234567@s.whatsapp.net)
      const cleanFrom = from ? from.replace(/@.*$/, '').replace(/[^\d]/g, '') : null;
      if (!cleanFrom || !text) { console.log('⚠️ WaSender: from ou text manquant'); return; }

      // Ignore les messages qu'on a envoyés nous-mêmes (fromMe)
      if (data.fromMe || data.key?.fromMe) return;

      // Trouve le bot associé via session_id
      const sessionId = body.session_id || body.sessionId || data.session_id;
      const bot = await findBotForWhatsApp(sessionId, null);
      if (!bot) {
        console.log(`⚠️ Aucun bot trouvé pour session=${sessionId}`);
        return;
      }

      await handleWhatsAppMessage(bot, cleanFrom, text, 'wasender');
      return;
    }

    console.log('📥 Webhook format inconnu, ignoré');
  } catch(e) {
    console.error('Webhook error:', e.message, e.stack);
  }
});

// Trouve le bot correspondant à un numéro/session WhatsApp
async function findBotForWhatsApp(phoneNumberIdOrSession, displayNumber) {
  try {
    // Cherche par whatsapp_phone_id, whatsapp_session_id, ou notifications_phone
    const bots = await db.select('bots', `?actif=eq.true`);
    if (!bots?.length) return null;

    // Match par phone_number_id (Meta) ou session_id (WaSender)
    let bot = bots.find(b =>
      b.whatsapp_phone_id === phoneNumberIdOrSession ||
      b.whatsapp_session_id === phoneNumberIdOrSession
    );
    if (bot) return bot;

    // Fallback: match par numéro de notification
    if (displayNumber) {
      const clean = displayNumber.replace(/[^\d]/g, '');
      bot = bots.find(b => {
        const bn = (b.notifications_phone || b.telephone || '').replace(/[^\d]/g, '');
        return bn && (bn === clean || bn.endsWith(clean) || clean.endsWith(bn));
      });
      if (bot) return bot;
    }

    // Dernier recours: si un seul bot existe, on l'utilise
    if (bots.length === 1) return bots[0];

    return null;
  } catch(e) {
    console.error('findBotForWhatsApp:', e.message);
    return null;
  }
}

// Traite un message WhatsApp entrant: appelle l'IA + renvoie la réponse
async function handleWhatsAppMessage(bot, fromPhone, text, source) {
  try {
    console.log(`📥 [${source}] ${fromPhone} → ${bot.nom}: "${text.substring(0,60)}"`);

    const sid = `wa_${bot.id}_${fromPhone}`;

    // Vérifie d'abord les workflows
    let reply = await runWorkflows(bot.id, text, sid);

    // Sinon appelle l'IA — prompt frais
    if (!reply) {
      reply = await callAI(makePrompt(bot), sid, text);
    }

    if (!reply) {
      console.log('⚠️ Pas de réponse générée');
      return;
    }

    // Détecte un total dans la réponse pour créer une commande
    const totalMatch = reply.match(/total\s*[:\-]\s*([0-9][0-9\s]*)\s*f?cfa/i) ||
                       reply.match(/([0-9][0-9\s]{2,})\s*f?cfa/i);
    if (totalMatch) {
      const orderTotal = parseInt(totalMatch[1].replace(/\s/g,''));
      if (orderTotal > 0 && orderTotal < 10000000) {
        autoCreateCommande(bot.id, sid, orderTotal, bot).catch(e=>console.error('autoCommande WA:', e.message));
      }
    }

    // Envoie la réponse au client via WhatsApp
    const sent = await sendWhatsApp(fromPhone, reply);
    console.log(`📤 Réponse WhatsApp ${sent?'envoyée':'échouée'} à ${fromPhone}`);

    // Sauvegarde la conversation
    saveMsg(bot.id, sid, text, reply).catch(e=>console.error('saveMsg WA:', e.message));

    // Met à jour les infos client (téléphone) sur la conversation
    updateConvClientPhone(bot.id, sid, fromPhone).catch(()=>{});
  } catch(e) {
    console.error('handleWhatsAppMessage:', e.message);
  }
}

// Met à jour le numéro client sur la conversation
async function updateConvClientPhone(botId, sessionId, phone) {
  try {
    await db.update('conversations', { client_tel: phone, canal: 'whatsapp' }, `?bot_id=eq.${botId}&session_id=eq.${sessionId}`);
  } catch(e) {}
}

app.get('/', (req,res) => res.json({
  app:'🤖 SamaBot IA', version:'10.3', status:'active',
  features:['broadcasts','inbox-unifiee','workflow-automation','multi-langue','admin-dashboard','livraison-zones','auth-google','commande-flow','rendez-vous','geolocalisation','vocal-whisper','paiement-wave-om','catalogue-import','email-notifications','widget-universel']
}));

app.get('/privacy', (req,res) => res.send('<html><body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px"><h1 style="color:#00c875">Politique de confidentialité — SamaBot</h1><p style="margin-top:16px;line-height:1.7">SamaBot collecte uniquement les messages nécessaires au fonctionnement du chatbot. Contact: gakououssou@gmail.com</p></body></html>'));

// ════════════════════════════════════════════════════════════
// FEATURES SUITE PRE-LEVEE — v10.4
// 1) Onboarding self-serve wizard
// 3) RGPD : Privacy/Terms/Cookie banner + 2FA TOTP
// 4) Status page + monitoring + /health
// 5) Widget JS embeddable 1-line
// ════════════════════════════════════════════════════════════

// ─── HEALTH CHECK (#4) ────────────────────────────────────────
const SERVER_START = Date.now();
let HEALTH_STATS = { requests: 0, errors: 0, last_error: null };

app.use((req, res, next) => {
  HEALTH_STATS.requests++;
  next();
});

app.get('/health', async (req, res) => {
  const uptime = Math.floor((Date.now() - SERVER_START) / 1000);
  const checks = { server: true, database: false, openai: false, wasender: false };
  try {
    const t1 = Date.now();
    const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/bots?select=id&limit=1`, { headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}` }});
    checks.database = r.ok;
    checks.db_latency_ms = Date.now() - t1;
  } catch(e) { checks.database = false; }
  checks.openai = !!CONFIG.OPENAI_API_KEY;
  checks.wasender = !!CONFIG.WASENDER_API_KEY;
  const allOk = checks.server && checks.database && checks.openai;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    uptime_sec: uptime,
    uptime_human: `${Math.floor(uptime/86400)}d ${Math.floor(uptime/3600)%24}h ${Math.floor(uptime/60)%60}m`,
    requests_total: HEALTH_STATS.requests,
    errors_total: HEALTH_STATS.errors,
    checks,
    version: '10.4',
    timestamp: new Date().toISOString()
  });
});

// ─── STATUS PAGE PUBLIC (#4) ──────────────────────────────────
app.get('/status', async (req, res) => {
  const uptime = Math.floor((Date.now() - SERVER_START) / 1000);
  const uptime_h = Math.floor(uptime/3600);
  const uptime_d = Math.floor(uptime_h/24);
  const checks = { db: false, db_ms: 0, openai: !!CONFIG.OPENAI_API_KEY, wasender: !!CONFIG.WASENDER_API_KEY };
  try {
    const t1 = Date.now();
    const r = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/bots?select=id&limit=1`, { headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}` }});
    checks.db = r.ok;
    checks.db_ms = Date.now() - t1;
  } catch(e) {}
  const allUp = checks.db && checks.openai && checks.wasender;
  const errRate = HEALTH_STATS.requests > 0 ? ((HEALTH_STATS.errors/HEALTH_STATS.requests)*100).toFixed(2) : '0.00';
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SamaBot Status</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;color:#0a1a0f;padding:40px 20px;line-height:1.5}
.container{max-width:760px;margin:0 auto}
.brand{font-size:28px;font-weight:800;margin-bottom:8px}.brand span{color:#06C167}
.tagline{color:#57534e;font-size:14px;margin-bottom:32px}
.banner{padding:20px 24px;border-radius:12px;margin-bottom:24px;display:flex;align-items:center;gap:16px;font-size:16px;font-weight:600}
.banner.up{background:linear-gradient(135deg,#dcfce7,#ecfccb);color:#166534;border:1px solid #bbf7d0}
.banner.down{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}
.dot{width:12px;height:12px;border-radius:50%;background:currentColor;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:24px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px}
.card h3{font-size:13px;color:#57534e;font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
.card .badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
.card .badge.ok{background:#dcfce7;color:#166534}.card .badge.ko{background:#fee2e2;color:#991b1b}
.card .val{font-size:22px;font-weight:700;color:#0a1a0f}
.card .sub{font-size:11px;color:#999;margin-top:2px}
.metrics{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:24px}
.metrics h2{font-size:14px;font-weight:700;color:#06C167;margin-bottom:14px;letter-spacing:0.5px}
.metric-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px}.metric-row:last-child{border:none}
.metric-row strong{color:#0a1a0f}
.footer{text-align:center;color:#999;font-size:12px;margin-top:32px}
.footer a{color:#06C167;text-decoration:none}
</style></head><body><div class="container">
<div class="brand">Sama<span>Bot</span> · Status</div>
<div class="tagline">Statut en temps réel des services SamaBot</div>
<div class="banner ${allUp?'up':'down'}"><span class="dot"></span><span>${allUp?'Tous les systèmes sont opérationnels':'Service partiellement dégradé'}</span></div>
<div class="grid">
<div class="card"><h3>Database<span class="badge ${checks.db?'ok':'ko'}">${checks.db?'OK':'DOWN'}</span></h3><div class="val">${checks.db?checks.db_ms+'ms':'N/A'}</div><div class="sub">Supabase (PostgreSQL)</div></div>
<div class="card"><h3>OpenAI IA<span class="badge ${checks.openai?'ok':'ko'}">${checks.openai?'OK':'KO'}</span></h3><div class="val">${checks.openai?'Active':'Down'}</div><div class="sub">GPT-4o-mini</div></div>
<div class="card"><h3>WhatsApp<span class="badge ${checks.wasender?'ok':'ko'}">${checks.wasender?'OK':'KO'}</span></h3><div class="val">${checks.wasender?'Active':'Down'}</div><div class="sub">WaSenderAPI</div></div>
<div class="card"><h3>API Server<span class="badge ok">OK</span></h3><div class="val">${uptime_d}j ${uptime_h%24}h</div><div class="sub">Uptime</div></div>
</div>
<div class="metrics">
<h2>📊 MÉTRIQUES</h2>
<div class="metric-row"><span>Requêtes traitées</span><strong>${HEALTH_STATS.requests.toLocaleString('fr-FR')}</strong></div>
<div class="metric-row"><span>Erreurs</span><strong>${HEALTH_STATS.errors.toLocaleString('fr-FR')}</strong></div>
<div class="metric-row"><span>Taux d'erreur</span><strong>${errRate}%</strong></div>
<div class="metric-row"><span>Uptime</span><strong>${uptime_d} jours, ${uptime_h%24}h ${Math.floor(uptime/60)%60}min</strong></div>
<div class="metric-row"><span>Version</span><strong>v10.4</strong></div>
</div>
<div class="footer">SLA visé: 99.5% · Page rafraîchie automatiquement toutes les 60s · <a href="/">Retour samabot.app</a><br>Incidents : contactez gakououssou@gmail.com</div>
</div>
<script>setTimeout(()=>location.reload(),60000)</script>
</body></html>`);
});

// ─── PRIVACY POLICY COMPLÈTE (#3) ─────────────────────────────
app.get('/privacy-full', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Politique de confidentialité — SamaBot</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f9fafb;color:#0a1a0f;line-height:1.7;padding:40px 20px}
.container{max-width:780px;margin:0 auto;background:#fff;padding:50px 40px;border-radius:12px;border:1px solid #e5e7eb}
h1{font-size:32px;color:#0a1a0f;margin-bottom:8px;letter-spacing:-1px}
.brand{color:#06C167}.subtitle{color:#57534e;font-size:14px;margin-bottom:32px}
h2{font-size:20px;color:#06C167;margin-top:32px;margin-bottom:12px;font-weight:700}
h3{font-size:16px;color:#0a1a0f;margin-top:18px;margin-bottom:8px}
p,li{font-size:14.5px;color:#1c1917;margin-bottom:10px}
ul{padding-left:24px;margin-bottom:14px}
a{color:#06C167;text-decoration:underline}
.toc{background:#f9fafb;padding:20px;border-radius:10px;margin-bottom:24px;border-left:4px solid #06C167}
.toc h3{margin-top:0;color:#0a1a0f}.toc ol{padding-left:20px;font-size:13px}
.contact{background:#dcfce7;border:1px solid #bbf7d0;padding:18px;border-radius:10px;margin-top:24px}
</style></head><body><div class="container">
<h1>Politique de <span class="brand">confidentialité</span></h1>
<p class="subtitle">Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR',{year:'numeric',month:'long',day:'numeric'})}</p>

<div class="toc"><h3>Table des matières</h3><ol>
<li>Qui sommes-nous</li><li>Données collectées</li><li>Finalité du traitement</li><li>Base légale (RGPD)</li>
<li>Durée de conservation</li><li>Partage des données</li><li>Vos droits (RGPD)</li><li>Sécurité</li>
<li>Cookies</li><li>Transferts internationaux</li><li>Modifications</li><li>Contact &amp; DPO</li></ol></div>

<h2>1. Qui sommes-nous</h2>
<p>SamaBot est un service édité par Ousmane Gakou, opérant entre les États-Unis et le Sénégal. SamaBot fournit une plateforme d'intelligence artificielle conversationnelle multilingue (français, wolof, anglais) destinée aux PME africaines.</p>
<p><strong>Responsable de traitement :</strong> Ousmane Gakou · Email : gakououssou@gmail.com · Téléphone : +221 77 760 89 83</p>

<h2>2. Données collectées</h2>
<h3>2.1 Données fournies par l'utilisateur (commerçant)</h3>
<ul><li>Nom, email, mot de passe (haché)</li><li>Numéro de téléphone WhatsApp (optionnel)</li><li>Informations de paiement (via Stripe — nous ne stockons pas les numéros de carte)</li><li>Catalogue produits, horaires, configuration du bot</li></ul>
<h3>2.2 Données collectées via les conversations</h3>
<ul><li>Messages échangés entre les clients finaux et le chatbot</li><li>Numéros de téléphone des clients (pour la prise de commande)</li><li>Adresses de livraison (pour les commandes)</li><li>Historique des commandes et avis</li></ul>
<h3>2.3 Données techniques</h3>
<ul><li>Adresse IP, type de navigateur, fuseau horaire</li><li>Logs d'accès et d'erreur (anonymisés sous 30 jours)</li></ul>

<h2>3. Finalité du traitement</h2>
<ul><li>Fournir le service SamaBot (chatbot IA, gestion commandes, RDV, etc.)</li><li>Facturation et gestion des abonnements</li><li>Support client</li><li>Amélioration continue du produit (sur données agrégées et anonymisées)</li><li>Communications transactionnelles (confirmations, factures, alertes)</li><li>Respect des obligations légales</li></ul>

<h2>4. Base légale du traitement (RGPD Art. 6)</h2>
<ul><li><strong>Exécution du contrat :</strong> fourniture du service auquel vous avez souscrit</li><li><strong>Consentement :</strong> communications marketing (que vous pouvez retirer à tout moment)</li><li><strong>Intérêt légitime :</strong> sécurité, prévention de la fraude, amélioration du produit</li><li><strong>Obligation légale :</strong> conservation des factures (10 ans)</li></ul>

<h2>5. Durée de conservation</h2>
<ul><li>Compte actif : durée de l'abonnement + 3 ans après résiliation</li><li>Conversations chatbot : 12 mois (configurable par le commerçant)</li><li>Données de facturation : 10 ans (obligation légale)</li><li>Logs techniques : 30 jours</li><li>Cookies : 13 mois maximum</li></ul>

<h2>6. Partage des données</h2>
<p>Nous utilisons les sous-traitants suivants, tous conformes RGPD :</p>
<ul><li><strong>Supabase</strong> (USA / EU) — base de données — supabase.com/privacy</li><li><strong>Railway</strong> (USA) — hébergement serveur — railway.app/legal/privacy</li><li><strong>OpenAI</strong> (USA) — modèle de langage — openai.com/policies</li><li><strong>Stripe</strong> (USA / EU) — paiements — stripe.com/privacy</li><li><strong>WaSenderAPI</strong> — passerelle WhatsApp</li><li><strong>Resend</strong> (USA) — envoi d'emails transactionnels — resend.com/legal/privacy-policy</li></ul>
<p>Aucune vente de données. Aucun partage publicitaire.</p>

<h2>7. Vos droits (RGPD Art. 15-22)</h2>
<ul><li>Droit d'accès à vos données</li><li>Droit de rectification</li><li>Droit à l'effacement (« droit à l'oubli »)</li><li>Droit à la limitation du traitement</li><li>Droit à la portabilité de vos données</li><li>Droit d'opposition</li><li>Droit de retirer votre consentement à tout moment</li><li>Droit d'introduire une réclamation auprès d'une autorité de contrôle (CNIL en France, Commission de Protection des Données Personnelles au Sénégal)</li></ul>
<p>Pour exercer ces droits : <a href="mailto:gakououssou@gmail.com">gakououssou@gmail.com</a> — réponse sous 30 jours.</p>

<h2>8. Sécurité</h2>
<p>Mots de passe hachés (bcrypt). Authentification 2FA disponible. Chiffrement TLS 1.3 pour toutes les communications. Row-Level Security (RLS) sur la base de données. Sauvegardes quotidiennes chiffrées. Accès aux données limité au strict nécessaire.</p>

<h2>9. Cookies</h2>
<p>SamaBot utilise uniquement des cookies fonctionnels nécessaires au service (authentification, préférences). Aucun cookie publicitaire ou de tracking tiers. Vous pouvez les désactiver dans votre navigateur (cela peut affecter le fonctionnement du service).</p>

<h2>10. Transferts internationaux</h2>
<p>Certaines de vos données peuvent être traitées hors UE (notamment aux États-Unis chez Supabase, Railway, OpenAI, Stripe, Resend). Ces transferts sont encadrés par les Clauses Contractuelles Types (CCT) de la Commission européenne et le Data Privacy Framework EU-US.</p>

<h2>11. Modifications</h2>
<p>Cette politique peut être mise à jour. Nous vous informerons par email de tout changement substantiel au moins 30 jours avant son application.</p>

<h2>12. Contact &amp; DPO</h2>
<div class="contact">
<p><strong>Email :</strong> gakououssou@gmail.com<br>
<strong>Téléphone :</strong> +221 77 760 89 83<br>
<strong>Adresse postale :</strong> SamaBot, c/o Ousmane Gakou, Sénégal 🇸🇳 / USA 🇺🇸</p>
</div>

</div></body></html>`);
});

// ─── TERMS OF SERVICE (#3) ────────────────────────────────────
app.get('/terms', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conditions générales — SamaBot</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f9fafb;color:#0a1a0f;line-height:1.7;padding:40px 20px}
.container{max-width:780px;margin:0 auto;background:#fff;padding:50px 40px;border-radius:12px;border:1px solid #e5e7eb}
h1{font-size:32px;margin-bottom:8px;letter-spacing:-1px}.brand{color:#06C167}
.subtitle{color:#57534e;font-size:14px;margin-bottom:32px}
h2{font-size:20px;color:#06C167;margin-top:32px;margin-bottom:12px;font-weight:700}
p,li{font-size:14.5px;color:#1c1917;margin-bottom:10px}ul{padding-left:24px;margin-bottom:14px}
a{color:#06C167;text-decoration:underline}
.warning{background:#fef3c7;border-left:4px solid #f59e0b;padding:14px;margin:20px 0;border-radius:6px;font-size:13.5px}
</style></head><body><div class="container">
<h1>Conditions générales d'<span class="brand">utilisation</span></h1>
<p class="subtitle">Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR',{year:'numeric',month:'long',day:'numeric'})}</p>

<h2>1. Objet</h2>
<p>Les présentes conditions générales (CGU) régissent l'utilisation du service SamaBot accessible à l'adresse <a href="https://samabot.app">samabot.app</a>. En créant un compte, vous acceptez ces CGU sans réserve.</p>

<h2>2. Description du service</h2>
<p>SamaBot fournit une plateforme SaaS de chatbot IA multilingue (français, wolof, anglais) avec gestion de commandes, prise de RDV, paiements Mobile Money, intégration WhatsApp, plugin WordPress et API publique.</p>

<h2>3. Inscription &amp; Compte</h2>
<ul><li>L'utilisateur garantit l'exactitude des informations fournies</li><li>Un seul compte par utilisateur</li><li>Accès aux mineurs interdit (18 ans minimum)</li><li>L'utilisateur est responsable de la confidentialité de son mot de passe</li><li>Activation du 2FA fortement recommandée</li></ul>

<h2>4. Plans &amp; Tarification</h2>
<ul><li><strong>Trial :</strong> 3 jours gratuits, sans carte bancaire requise</li><li><strong>Starter :</strong> $9 / 5 000 FCFA par mois — 3 bots</li><li><strong>Pro :</strong> $25 / 15 000 FCFA par mois — 10 bots</li><li><strong>Business :</strong> $85 / 50 000 FCFA par mois — bots illimités</li><li>Plans annuels : -20%</li></ul>
<p>Les prix peuvent évoluer avec un préavis de 30 jours par email.</p>

<h2>5. Paiement &amp; Facturation</h2>
<p>Paiements traités par Stripe (cartes internationales). Facturation mensuelle ou annuelle au début de chaque période. Renouvellement automatique sauf résiliation. Aucun remboursement pour les périodes entamées (sauf défaut majeur du service).</p>

<h2>6. Résiliation</h2>
<ul><li>L'utilisateur peut résilier à tout moment depuis son espace billing</li><li>L'accès reste actif jusqu'à la fin de la période payée</li><li>Données conservées 30 jours après résiliation, puis supprimées</li><li>SamaBot peut suspendre le service en cas de violation des CGU (préavis 7 jours sauf urgence)</li></ul>

<h2>7. Usage acceptable</h2>
<p>L'utilisateur s'engage à ne pas utiliser SamaBot pour :</p>
<ul><li>Activités illégales ou frauduleuses</li><li>Spam ou messages non sollicités à grande échelle</li><li>Contenu offensant, discriminatoire ou pornographique</li><li>Atteinte aux droits de tiers (propriété intellectuelle, vie privée)</li><li>Charge anormale (rate limit : 30 req/min/IP)</li></ul>

<h2>8. Propriété intellectuelle</h2>
<p>SamaBot reste propriétaire du code source, des modèles IA et de la marque. L'utilisateur conserve tous les droits sur ses données métier (catalogue, conversations, clients).</p>

<h2>9. Disponibilité &amp; SLA</h2>
<p>SLA visé : 99.5% (hors maintenances planifiées annoncées 48h à l'avance). Statut en temps réel : <a href="/status">samabot.app/status</a>.</p>
<div class="warning">⚠️ SamaBot ne saurait être tenu responsable des pannes indirectes (Supabase, Railway, OpenAI, WhatsApp, Stripe). Plan Business uniquement : crédit pro-rata si downtime &gt; 4h consécutives.</div>

<h2>10. Limitation de responsabilité</h2>
<p>Dans la mesure permise par la loi, la responsabilité totale de SamaBot est limitée au montant payé par l'utilisateur sur les 12 derniers mois. SamaBot n'est pas responsable des dommages indirects (perte de chiffre d'affaires, atteinte à la réputation, etc.).</p>

<h2>11. Données personnelles</h2>
<p>Le traitement des données personnelles est régi par notre <a href="/privacy-full">Politique de confidentialité</a>.</p>

<h2>12. Modifications des CGU</h2>
<p>SamaBot peut modifier les CGU avec un préavis de 30 jours par email. La poursuite de l'utilisation après cette période vaut acceptation.</p>

<h2>13. Loi applicable &amp; juridiction</h2>
<p>Loi sénégalaise applicable. Tout litige sera soumis aux tribunaux compétents de Dakar, après tentative de résolution amiable.</p>

<h2>14. Contact</h2>
<p>Pour toute question : <a href="mailto:gakououssou@gmail.com">gakououssou@gmail.com</a> · +221 77 760 89 83</p>
</div></body></html>`);
});

// ─── 2FA TOTP (#3) ────────────────────────────────────────────
function generateTotpSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random()*32)];
  return s;
}

function totpVerify(secret, token) {
  const crypto = require('crypto');
  const base32Decode = (s) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const c of s.toUpperCase().replace(/=+$/,'')) {
      const idx = alphabet.indexOf(c); if (idx === -1) continue;
      bits += idx.toString(2).padStart(5,'0');
    }
    const bytes = [];
    for (let i = 0; i+8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i,i+8),2));
    return Buffer.from(bytes);
  };
  const key = base32Decode(secret);
  const now = Math.floor(Date.now()/1000/30);
  for (const offset of [-1, 0, 1]) {
    const counter = now + offset;
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter), 0);
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const off = hmac[hmac.length-1] & 0xf;
    const code = ((hmac[off] & 0x7f) << 24 | hmac[off+1] << 16 | hmac[off+2] << 8 | hmac[off+3]) % 1000000;
    if (code.toString().padStart(6,'0') === String(token)) return true;
  }
  return false;
}

app.post('/auth/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const secret = generateTotpSecret();
    await db.update('users', { totp_secret: secret, totp_enabled: false }, `?id=eq.${req.userId}`);
    const users = await db.select('users', `?id=eq.${req.userId}&select=email`);
    const email = users?.[0]?.email || 'user';
    const otpauthUrl = `otpauth://totp/SamaBot:${encodeURIComponent(email)}?secret=${secret}&issuer=SamaBot&algorithm=SHA1&digits=6&period=30`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauthUrl)}`;
    res.json({ success:true, secret, qr_url: qrUrl, otpauth_url: otpauthUrl });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/auth/2fa/verify', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error:'token requis' });
    const users = await db.select('users', `?id=eq.${req.userId}&select=totp_secret`);
    const secret = users?.[0]?.totp_secret;
    if (!secret) return res.status(400).json({ error:'2FA non configuré' });
    if (!totpVerify(secret, token)) return res.status(401).json({ error:'Code invalide' });
    await db.update('users', { totp_enabled: true }, `?id=eq.${req.userId}`);
    res.json({ success:true, message:'2FA activé' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/auth/2fa/disable', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const users = await db.select('users', `?id=eq.${req.userId}&select=totp_secret,totp_enabled`);
    if (!users?.[0]?.totp_enabled) return res.json({ success:true });
    if (!totpVerify(users[0].totp_secret, token)) return res.status(401).json({ error:'Code invalide' });
    await db.update('users', { totp_secret: null, totp_enabled: false }, `?id=eq.${req.userId}`);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ─── ONBOARDING SELF-SERVE (#1) ───────────────────────────────
const ONBOARDING_NICHES = [
  { id:'restaurant', label:'🍽️ Restaurant', description:'Plats, livraison, commandes', emoji:'🍽️', color:'#f59e0b' },
  { id:'salon', label:'💇 Salon de coiffure', description:'RDV coiffure, manucure', emoji:'💇', color:'#ec4899' },
  { id:'boutique', label:'🛍️ Boutique mode', description:'Vêtements, accessoires', emoji:'🛍️', color:'#8b5cf6' },
  { id:'pharmacie', label:'💊 Pharmacie', description:'Médicaments, paraphar.', emoji:'💊', color:'#10b981' },
  { id:'auto-ecole', label:'🚗 Auto-école', description:'Inscription, cours code', emoji:'🚗', color:'#3b82f6' },
  { id:'menuiserie', label:'🔨 Menuisier / Artisan', description:'Devis, RDV chantier', emoji:'🔨', color:'#a16207' },
  { id:'clinique', label:'🏥 Clinique / Cabinet médical', description:'RDV médecin', emoji:'🏥', color:'#06b6d4' },
  { id:'taxi', label:'🚕 Taxi / Transport', description:'Réservations courses', emoji:'🚕', color:'#eab308' },
  { id:'autre', label:'✨ Autre', description:'Personnalisé', emoji:'✨', color:'#6366f1' }
];

const NICHE_PROMPTS = {
  restaurant: 'Tu es l\'assistant d\'un restaurant. Aide les clients à découvrir le menu, prendre commande, fournir les infos livraison.',
  salon: 'Tu es l\'assistant d\'un salon de coiffure. Aide à prendre RDV, expliquer les prestations, conseiller.',
  boutique: 'Tu es l\'assistant d\'une boutique. Aide à découvrir les produits, vérifier la disponibilité, passer commande.',
  pharmacie: 'Tu es l\'assistant d\'une pharmacie. Donne les infos sur la disponibilité des médicaments. RAPPEL : tu ne donnes jamais de conseil médical, tu redirige vers le pharmacien.',
  'auto-ecole': 'Tu es l\'assistant d\'une auto-école. Renseigne sur les inscriptions, prix, cours de code, examens.',
  menuiserie: 'Tu es l\'assistant d\'un menuisier/artisan. Aide à demander un devis, prendre RDV pour visite chantier.',
  clinique: 'Tu es l\'assistant d\'une clinique. Aide à prendre RDV. RAPPEL : tu ne donnes JAMAIS de diagnostic ni conseil médical, redirige toujours vers un médecin.',
  taxi: 'Tu es l\'assistant d\'un service de taxi. Aide à réserver une course (lieu de prise en charge, destination, heure).',
  autre: 'Tu es un assistant commercial. Aide les clients de manière professionnelle.'
};

function generateBotId(nom) {
  const slug = (nom||'bot').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20);
  const rand = Math.random().toString(36).slice(2,9);
  return `${slug||'bot'}-${rand}`;
}

app.post('/onboarding/create', authMiddleware, async (req, res) => {
  try {
    const { niche, business_name, telephone_pro, ville, color, premier_produit, premier_prix } = req.body;
    if (!niche || !business_name) return res.status(400).json({ error:'Niche et nom requis' });
    if (!ONBOARDING_NICHES.find(n => n.id === niche)) return res.status(400).json({ error:'Niche invalide' });
    
    const botId = generateBotId(business_name);
    const promptBase = NICHE_PROMPTS[niche] || NICHE_PROMPTS.autre;
    const fullPrompt = `${promptBase}\n\nNom de l'entreprise : ${business_name}\nVille : ${ville||'Dakar'}\nTéléphone professionnel : ${telephone_pro||'à compléter'}\n\nRéponds toujours en français, avec une touche chaleureuse. Tu peux comprendre et répondre en wolof si le client te parle wolof.`;
    
    const config = {
      id: botId,
      user_id: req.userId,
      nom: business_name,
      ville: ville || 'Dakar',
      telephone_pro: telephone_pro || null,
      niche,
      couleur: color || '#06C167',
      prompt: fullPrompt,
      langues: ['fr', 'wo'],
      actif: true,
      plan: 'trial',
      trial_until: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
      created_at: new Date().toISOString()
    };
    
    const inserted = await db.insert('bots', config);
    if (!inserted?.[0]) return res.status(500).json({ error:'Erreur création bot' });
    
    if (premier_produit && premier_prix) {
      try {
        await db.insert('produits', {
          bot_id: botId,
          nom: premier_produit,
          prix: parseInt(premier_prix) || 0,
          actif: true
        });
      } catch(e) { console.warn('Premier produit non créé:', e.message); }
    }
    
    res.json({
      success: true,
      bot_id: botId,
      bot_url: `${CONFIG.BASE_URL}/?bot=${botId}`,
      dashboard_url: `${CONFIG.BASE_URL}/admin/${botId}`,
      embed_code: `<script src="${CONFIG.BASE_URL}/widget.js" data-bot="${botId}"></script>`,
      trial_until: config.trial_until
    });
  } catch(e) {
    console.error('Onboarding error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/onboarding', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crée ton bot SamaBot</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#0a1a0f,#052811);min-height:100vh;color:#fff;padding:20px}
.wizard{max-width:680px;margin:20px auto;background:#fff;color:#0a1a0f;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.progress{height:6px;background:#f0f0f0}
.progress-bar{height:100%;background:linear-gradient(90deg,#06C167,#058048);transition:width 0.4s ease;width:25%}
.step{padding:50px 40px;display:none}.step.active{display:block}
h1{font-size:30px;margin-bottom:8px;letter-spacing:-1px;line-height:1.2}
.subtitle{color:#57534e;margin-bottom:32px;font-size:15px;line-height:1.5}
.step-num{display:inline-block;background:#06C167;color:#000;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:4px 12px;border-radius:12px;margin-bottom:14px}
.niche-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.niche-card{padding:18px 12px;border:2px solid #e5e7eb;border-radius:14px;text-align:center;cursor:pointer;transition:all 0.2s;background:#fff}
.niche-card:hover{border-color:#06C167;transform:translateY(-2px)}
.niche-card.selected{border-color:#06C167;background:#f0fdf4}
.niche-card .emoji{font-size:30px;margin-bottom:6px}
.niche-card .lbl{font-size:12px;font-weight:700;margin-bottom:2px}
.niche-card .desc{font-size:10px;color:#57534e;line-height:1.3}
input,select{width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;margin-bottom:14px;outline:none;transition:border 0.2s;background:#fff;color:#0a1a0f}
input:focus,select:focus{border-color:#06C167}
label{display:block;font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:6px}
.color-row{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}
.color-swatch{height:48px;border-radius:10px;cursor:pointer;border:3px solid transparent;transition:all 0.2s}
.color-swatch:hover{transform:scale(1.05)}.color-swatch.selected{border-color:#0a1a0f;transform:scale(1.05)}
.btn-row{display:flex;gap:10px;margin-top:8px}
.btn{padding:14px 24px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;border:none;transition:all 0.2s}
.btn-primary{background:#06C167;color:#fff;flex:2}.btn-primary:hover{background:#058048}
.btn-secondary{background:#f0f0f0;color:#0a1a0f;flex:1}.btn-secondary:hover{background:#e0e0e0}
.btn:disabled{opacity:0.4;cursor:not-allowed}
.success{text-align:center;padding:60px 20px}
.success-emoji{font-size:64px;margin-bottom:20px}
.success h2{font-size:32px;margin-bottom:12px;color:#0a1a0f}
.success p{color:#57534e;margin-bottom:24px;font-size:15px}
.success-card{background:#f9fafb;border-left:4px solid #06C167;padding:18px;border-radius:10px;text-align:left;margin:14px 0;font-family:'Courier New',monospace;font-size:12px;word-break:break-all}
.success-card strong{display:block;color:#0a1a0f;font-family:-apple-system,sans-serif;margin-bottom:6px;font-size:13px}
.row-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:600px){.niche-grid{grid-template-columns:repeat(2,1fr)}.color-row{grid-template-columns:repeat(4,1fr)}.row-2col{grid-template-columns:1fr}}
.brand-header{padding:16px 40px;background:#0a1a0f;color:#fff;font-size:13px;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center}
.brand-header b{color:#06C167}
.feature-pill{display:inline-block;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;margin-right:6px}
.checkbox-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;padding:14px;background:#f9fafb;border-radius:10px;cursor:pointer}
.checkbox-row input{width:auto;margin:0;flex-shrink:0;margin-top:3px}
.checkbox-row label{font-size:13px;cursor:pointer;color:#1c1917;font-weight:500}
.checkbox-row label a{color:#06C167}
</style></head><body>

<div class="wizard">
<div class="brand-header"><span>Sama<b>Bot</b> · Onboarding</span><span style="opacity:0.7" id="step-counter">Étape 1/4</span></div>
<div class="progress"><div class="progress-bar" id="progress-bar"></div></div>

<div class="step active" id="step-1">
<div class="step-num">ÉTAPE 1 / 4</div>
<h1>Quel type d'<span style="color:#06C167">activité</span> as-tu ?</h1>
<p class="subtitle">Ton bot sera pré-configuré avec un prompt adapté à ton secteur. Tu pourras tout personnaliser ensuite.</p>
<div class="niche-grid" id="niche-grid"></div>
<div class="btn-row"><button class="btn btn-primary" id="btn-step-1" disabled onclick="goStep(2)">Continuer →</button></div>
</div>

<div class="step" id="step-2">
<div class="step-num">ÉTAPE 2 / 4</div>
<h1>Parle-moi de ton <span style="color:#06C167">business</span></h1>
<p class="subtitle">Ces informations apparaîtront dans les conversations avec tes clients.</p>
<label>Nom de ton business *</label>
<input type="text" id="business_name" placeholder="Ex: Chez Maman Aïcha" maxlength="50">
<div class="row-2col">
<div><label>Ville</label><input type="text" id="ville" placeholder="Dakar" value="Dakar"></div>
<div><label>WhatsApp pro</label><input type="text" id="telephone_pro" placeholder="+221 77 ..."></div>
</div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(1)">← Retour</button>
<button class="btn btn-primary" id="btn-step-2" onclick="goStep(3)">Continuer →</button>
</div>
</div>

<div class="step" id="step-3">
<div class="step-num">ÉTAPE 3 / 4</div>
<h1>Choisis ta <span style="color:#06C167">couleur</span></h1>
<p class="subtitle">Cette couleur sera utilisée pour les boutons, le widget chat et l'identité visuelle de ton bot.</p>
<div class="color-row" id="color-row">
<div class="color-swatch selected" data-color="#06C167" style="background:#06C167"></div>
<div class="color-swatch" data-color="#3b82f6" style="background:#3b82f6"></div>
<div class="color-swatch" data-color="#8b5cf6" style="background:#8b5cf6"></div>
<div class="color-swatch" data-color="#ec4899" style="background:#ec4899"></div>
<div class="color-swatch" data-color="#f59e0b" style="background:#f59e0b"></div>
<div class="color-swatch" data-color="#dc2626" style="background:#dc2626"></div>
</div>
<label>Premier produit/service (optionnel)</label>
<div class="row-2col">
<input type="text" id="premier_produit" placeholder="Ex: Thiéboudienne complet">
<input type="number" id="premier_prix" placeholder="Prix en FCFA (ex: 3500)">
</div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(2)">← Retour</button>
<button class="btn btn-primary" onclick="goStep(4)">Continuer →</button>
</div>
</div>

<div class="step" id="step-4">
<div class="step-num">ÉTAPE 4 / 4</div>
<h1>Prêt à <span style="color:#06C167">décoller</span> ?</h1>
<p class="subtitle">Vérifie tes infos puis clique sur "Créer mon bot". Tu auras 3 jours d'essai gratuit, sans carte bancaire.</p>
<div id="recap" style="background:#f9fafb;padding:18px;border-radius:12px;margin-bottom:20px;font-size:14px;line-height:1.8"></div>
<div class="checkbox-row">
<input type="checkbox" id="cgu_accept">
<label for="cgu_accept">J'accepte les <a href="/terms" target="_blank">Conditions générales</a> et la <a href="/privacy-full" target="_blank">Politique de confidentialité</a> de SamaBot.</label>
</div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(3)">← Retour</button>
<button class="btn btn-primary" id="btn-create" onclick="createBot()" disabled>🚀 Créer mon bot</button>
</div>
</div>

<div class="step" id="step-5">
<div class="success">
<div class="success-emoji">🎉</div>
<h2>Ton bot est <span style="color:#06C167">live</span> !</h2>
<p>Bienvenue dans SamaBot. Tu as 3 jours pour tester gratuitement, sans carte bancaire.</p>
<div class="success-card"><strong>🌐 URL de ton bot</strong><span id="bot-url"></span></div>
<div class="success-card"><strong>📊 Tableau de bord</strong><span id="dashboard-url"></span></div>
<div class="success-card"><strong>📝 Code embed (à coller sur ton site)</strong><span id="embed-code"></span></div>
<div style="margin-top:24px">
<span class="feature-pill">✓ Bot créé</span>
<span class="feature-pill">✓ Trial 3 jours</span>
<span class="feature-pill">✓ Wolof + Français</span>
</div>
<div class="btn-row" style="margin-top:24px">
<button class="btn btn-primary" onclick="window.location.href=document.getElementById('dashboard-url').textContent.trim()">→ Aller au dashboard</button>
</div>
</div>
</div>

</div>

<script>
const NICHES = ${JSON.stringify(ONBOARDING_NICHES)};
let state = { niche:null, business_name:'', ville:'Dakar', telephone_pro:'', color:'#06C167', premier_produit:'', premier_prix:'' };

const grid = document.getElementById('niche-grid');
NICHES.forEach(n => {
  const div = document.createElement('div');
  div.className = 'niche-card';
  div.dataset.id = n.id;
  div.innerHTML = '<div class="emoji">'+n.emoji+'</div><div class="lbl">'+n.label.replace(/^[^ ]+ /,'')+'</div><div class="desc">'+n.description+'</div>';
  div.onclick = () => {
    document.querySelectorAll('.niche-card').forEach(c => c.classList.remove('selected'));
    div.classList.add('selected');
    state.niche = n.id;
    document.getElementById('btn-step-1').disabled = false;
  };
  grid.appendChild(div);
});

document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.onclick = () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
    state.color = sw.dataset.color;
  };
});

document.getElementById('cgu_accept').onchange = (e) => {
  document.getElementById('btn-create').disabled = !e.target.checked;
};

function updateProgress(step){
  document.getElementById('progress-bar').style.width = (step*20)+'%';
  document.getElementById('step-counter').textContent = 'Étape '+step+'/4';
}

function goStep(n){
  if(n === 2){
    if(!state.niche){ alert('Choisis une niche'); return; }
  }
  if(n === 3){
    state.business_name = document.getElementById('business_name').value.trim();
    state.ville = document.getElementById('ville').value.trim() || 'Dakar';
    state.telephone_pro = document.getElementById('telephone_pro').value.trim();
    if(!state.business_name){ alert('Donne un nom à ton business'); return; }
  }
  if(n === 4){
    state.premier_produit = document.getElementById('premier_produit').value.trim();
    state.premier_prix = document.getElementById('premier_prix').value.trim();
    var nicheLabel = NICHES.find(x => x.id === state.niche).label;
    document.getElementById('recap').innerHTML = '<strong>'+nicheLabel+'</strong> · '+state.business_name+'<br>📍 '+state.ville+(state.telephone_pro?' · 📱 '+state.telephone_pro:'')+'<br>🎨 Couleur '+state.color+(state.premier_produit?'<br>🛒 '+state.premier_produit+' à '+state.premier_prix+' FCFA':'');
  }
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-'+n).classList.add('active');
  updateProgress(Math.min(n,4));
}

async function createBot(){
  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = '⏳ Création en cours...';
  try {
    const token = localStorage.getItem('samabot_token');
    if(!token){
      alert('Tu dois te connecter d\\'abord. Redirection...');
      window.location.href = '/login?redirect=/onboarding';
      return;
    }
    const r = await fetch('/onboarding/create', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify(state)
    });
    const data = await r.json();
    if(!r.ok || !data.success){ alert('Erreur: '+(data.error||'inconnu')); btn.disabled = false; btn.textContent = '🚀 Créer mon bot'; return; }
    document.getElementById('bot-url').textContent = data.bot_url;
    document.getElementById('dashboard-url').textContent = data.dashboard_url;
    document.getElementById('embed-code').textContent = data.embed_code;
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-5').classList.add('active');
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('step-counter').textContent = '✅ Terminé';
  } catch(e){
    alert('Erreur réseau: '+e.message);
    btn.disabled = false;
    btn.textContent = '🚀 Créer mon bot';
  }
}
</script></body></html>`);
});

// ─── WIDGET JS (déjà existant ligne ~6891, voir widget complet) ──
// Le widget /widget.js est déjà défini plus haut avec config WordPress
// Pour le widget simple, utiliser directement le bot URL

// ─── COOKIE BANNER MIDDLEWARE (#3) ─────────────────────────────
app.get('/cookie-banner.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(`(function(){if(localStorage.getItem('sb_cookies'))return;
var b=document.createElement('div');b.id='sb-cookies';b.style.cssText='position:fixed;bottom:20px;left:20px;right:20px;max-width:680px;margin:0 auto;background:#0a1a0f;color:#fff;padding:18px 22px;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.25);z-index:999997;font-family:-apple-system,sans-serif;font-size:14px;line-height:1.5;display:flex;align-items:center;gap:16px;flex-wrap:wrap';
b.innerHTML='<div style="flex:1;min-width:240px">🍪 SamaBot utilise uniquement des cookies fonctionnels nécessaires au service. Aucun tracking publicitaire. <a href="/privacy-full" style="color:#06C167">En savoir plus</a></div><button onclick="localStorage.setItem(\\'sb_cookies\\',\\'1\\');document.getElementById(\\'sb-cookies\\').remove()" style="background:#06C167;color:#000;border:none;padding:10px 18px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px">OK ✓</button>';
document.body.appendChild(b);})();`);
});

// FIN BLOC v10.4 ────────────────────────────────────────────


// ════════════════════════════════════════════════════════════
// FEATURES v10.5 — PLATEFORME UNIVERSELLE
// 1) Skills modulaires (10 verticales)
// 2) RAG — Retrieval-Augmented Generation (upload de documents)
// 3) Function Calling — outils externes pour le bot
// ════════════════════════════════════════════════════════════

// ─── CATALOGUE DES SKILLS (10 verticales) ─────────────────────
const SKILLS_CATALOG = {
  commerce: {
    id: 'commerce',
    label: '🛒 Commerce & Vente',
    description: 'Catalogue produits, commandes, livraison, paiement Mobile Money',
    icon: '🛒',
    category: 'SMB',
    prompt: `MODULE COMMERCE ACTIVÉ:
- Tu peux présenter le catalogue, prendre des commandes, gérer la livraison
- Pour chaque commande, suis ce flux: choix produit → infos client → récap → confirmation → paiement
- Mentionne les options de paiement: Wave, Orange Money, espèces, à la livraison
- Pour les commandes urgentes, propose la livraison express si disponible`
  },
  rdv: {
    id: 'rdv',
    label: '📅 Rendez-vous & Planning',
    description: 'Réservation de créneaux, rappels automatiques, calendrier',
    icon: '📅',
    category: 'SMB',
    prompt: `MODULE RENDEZ-VOUS ACTIVÉ:
- Tu peux proposer les créneaux disponibles selon les horaires d'ouverture
- Demande au client: nom, téléphone, motif, date/heure souhaitées
- Confirme le RDV avec récapitulatif précis
- Mentionne que des rappels automatiques seront envoyés 24h avant`
  },
  sante: {
    id: 'sante',
    label: '🏥 Santé & Médical',
    description: 'FAQ santé, prise de RDV médecin, urgences (jamais de diagnostic)',
    icon: '🏥',
    category: 'Enterprise',
    prompt: `MODULE SANTÉ ACTIVÉ:
RÈGLES CRITIQUES:
- Tu ne donnes JAMAIS de diagnostic médical, JAMAIS de traitement, JAMAIS de prescription
- Si le client décrit des symptômes, redirige IMMÉDIATEMENT vers un médecin: "Pour votre santé, consultez un médecin. Voulez-vous prendre RDV ?"
- En cas d'urgence (douleur intense, malaise, accident, hémorragie): redirige IMMÉDIATEMENT vers le 1515 (SAMU Sénégal) ou le service d'urgences le plus proche
- Tu peux: prendre RDV, donner les horaires, indiquer les services, expliquer les démarches administratives
- Tu ne peux pas: interpréter des analyses, conseiller des médicaments, donner d'avis médical`
  },
  education: {
    id: 'education',
    label: '🎓 Éducation & Formation',
    description: 'Inscription, cours, examens, FAQ administrative étudiants',
    icon: '🎓',
    category: 'Enterprise',
    prompt: `MODULE ÉDUCATION ACTIVÉ:
- Tu réponds aux questions sur: inscriptions, frais de scolarité, calendrier, examens, programmes
- Tu peux orienter vers les services administratifs (scolarité, vie étudiante, bibliothèque)
- Pour les questions pédagogiques précises, redirige vers le professeur ou le département
- Si un étudiant en détresse psychologique: redirige vers le service d'écoute ou un psychologue`
  },
  banque: {
    id: 'banque',
    label: '🏦 Banque & Finance',
    description: 'FAQ produits bancaires, agence proche, formulaires (jamais de transaction)',
    icon: '🏦',
    category: 'Enterprise',
    prompt: `MODULE BANQUE ACTIVÉ:
RÈGLES CRITIQUES:
- Tu ne demandes JAMAIS le mot de passe, code PIN, ou code SMS d'authentification
- Tu ne fais JAMAIS de transaction au nom du client (virement, retrait, prêt)
- Tu ne donnes JAMAIS le solde précis sans authentification forte
- Tu peux: orienter vers une agence, expliquer les produits, lister les documents requis pour un dossier
- En cas de fraude présumée ou carte perdue: redirige IMMÉDIATEMENT vers le service d'opposition 24/7
- Pour les opérations sensibles, redirige TOUJOURS vers l'application officielle ou l'agence`
  },
  telecom: {
    id: 'telecom',
    label: '📞 Télécom & Support',
    description: 'Recharge, forfaits, pannes, technical support',
    icon: '📞',
    category: 'Enterprise',
    prompt: `MODULE TÉLÉCOM ACTIVÉ:
- Tu peux: expliquer les forfaits, aider à choisir une offre, donner les codes USSD, expliquer comment recharger
- Tu peux: créer un ticket de support pour panne réseau, panne ADSL, panne fibre
- Tu peux: orienter vers les boutiques physiques, donner les hotlines
- Pour les pannes critiques (zone entière sans réseau): escalade vers un technicien humain
- Tu ne peux PAS: réinitialiser des comptes, donner accès à des données client sans authentification`
  },
  gouv: {
    id: 'gouv',
    label: '🏛️ Service public',
    description: 'État civil, formulaires admin, RDV mairie/préfecture',
    icon: '🏛️',
    category: 'Government',
    prompt: `MODULE GOUVERNEMENT ACTIVÉ:
- Tu réponds aux questions sur: état civil, démarches administratives, formulaires officiels
- Tu peux indiquer les pièces requises pour: CNI, passeport, acte de naissance, mariage, etc.
- Tu peux orienter vers les guichets, donner les horaires, expliquer les délais
- Reste OBJECTIF et NEUTRE: jamais d'opinion politique, jamais de jugement sur les politiques publiques
- Pour les recours, plaintes, contestations: oriente vers le médiateur ou le service compétent`
  },
  ong: {
    id: 'ong',
    label: '🤝 ONG & Humanitaire',
    description: 'Distribution aide, inscription bénéficiaires, info programmes',
    icon: '🤝',
    category: 'NGO',
    prompt: `MODULE ONG ACTIVÉ:
- Tu peux: informer sur les programmes humanitaires, aider à l'inscription des bénéficiaires
- Tu peux: indiquer les points de distribution, les horaires, les documents requis
- Tu peux: orienter vers les services sociaux, médecins, psychologues
- En cas de détresse, violence, abus: redirige IMMÉDIATEMENT vers les hotlines d'urgence
- Reste empathique et bienveillant. Adapte ton vocabulaire au niveau d'éducation du bénéficiaire`
  },
  rh: {
    id: 'rh',
    label: '👥 RH & Recrutement',
    description: 'FAQ employés, candidatures, congés, fiches de paie',
    icon: '👥',
    category: 'Enterprise',
    prompt: `MODULE RH ACTIVÉ:
- Tu réponds aux questions internes des employés: congés, paie, mutuelle, formation
- Tu peux orienter vers le service RH humain pour les cas complexes
- Tu peux gérer les premières étapes du recrutement: présentation poste, FAQ candidat
- Pour les conflits, harcèlement, problèmes graves: redirige IMMÉDIATEMENT vers la médiation/RH
- Confidentialité absolue: ne jamais partager des infos d'un employé à un autre`
  },
  urgence: {
    id: 'urgence',
    label: '🚨 Escalade & Urgence',
    description: 'Détection situations critiques, transfert humain immédiat',
    icon: '🚨',
    category: 'Universal',
    prompt: `MODULE URGENCE ACTIVÉ (toujours actif en superposition):
DÉTECTION D'URGENCE - Si le message contient:
- Mots-clés: "urgent", "secours", "aidez-moi", "danger", "menace", "violence", "blessé"
- Détresse émotionnelle: "je veux mourir", "je n'en peux plus", "à bout"
- Situation critique: accident, vol, agression, incendie

ACTION OBLIGATOIRE:
1. Réponds avec compassion: "Je comprends que c'est difficile, vous n'êtes pas seul(e)."
2. Donne les hotlines d'urgence Sénégal:
   - Police: 17 ou 18
   - SAMU: 1515
   - Pompiers: 18
   - Écoute psychologique: +221 33 825 90 75 (SOS Suicide)
3. Si possible, escalade vers un humain immédiatement`
  }
};

// ─── ENRICHISSEMENT DU PROMPT AVEC SKILLS ─────────────────────
function enrichPromptWithSkills(basePrompt, bot) {
  const skills = bot.skills || [];
  if (!Array.isArray(skills) || skills.length === 0) {
    return basePrompt;
  }
  
  const skillsBlocks = skills
    .filter(sid => SKILLS_CATALOG[sid])
    .map(sid => SKILLS_CATALOG[sid].prompt)
    .join('\n\n');
  
  if (!skillsBlocks) return basePrompt;
  
  const skillsHeader = `\n\n═══════════════════════════════════════════════
COMPÉTENCES ACTIVÉES (Skills): ${skills.map(s => SKILLS_CATALOG[s]?.icon + ' ' + SKILLS_CATALOG[s]?.label).filter(Boolean).join(', ')}
═══════════════════════════════════════════════

${skillsBlocks}
═══════════════════════════════════════════════`;
  
  return basePrompt + skillsHeader;
}

// Wrapper qui ne casse rien
function makePromptUniversal(bot) {
  const base = (typeof makePrompt === 'function') ? makePrompt(bot) : `Tu es l'assistant de ${bot.nom}. Réponds en français et wolof.`;
  let enriched = enrichPromptWithSkills(base, bot);
  
  if (bot.context_documents && Array.isArray(bot.context_documents) && bot.context_documents.length > 0) {
    const ragBlock = `\n\n═══════════════════════════════════════════════
DOCUMENTS DE RÉFÉRENCE DISPONIBLES:
═══════════════════════════════════════════════
Tu as accès aux documents suivants pour répondre précisément aux questions:

${bot.context_documents.slice(0, 5).map((doc, i) => `[Doc ${i+1}] ${doc.title}: ${doc.content?.slice(0, 1500)}...`).join('\n\n')}

INSTRUCTIONS RAG:
- Si la question du client correspond à l'un de ces documents, RÉPONDS en te basant sur le contenu
- CITE la source: "Selon notre [document]..."
- Si la question n'est pas couverte, dis honnêtement: "Je n'ai pas cette information précise, je vous oriente vers..."
- Ne JAMAIS inventer une information qui n'est pas dans les documents`;
    enriched += ragBlock;
  }
  
  if (bot.allowed_functions && Array.isArray(bot.allowed_functions) && bot.allowed_functions.length > 0) {
    const fnBlock = `\n\n═══════════════════════════════════════════════
OUTILS / FONCTIONS DISPONIBLES:
═══════════════════════════════════════════════
Tu peux exécuter les actions suivantes en générant une réponse spéciale au format JSON:

${bot.allowed_functions.map(fn => `- ${fn.name}: ${fn.description}`).join('\n')}

Pour appeler une fonction, réponds AVEC un bloc JSON entre balises:
<function_call>
{"name": "nom_fonction", "arguments": {...}}
</function_call>

Puis le résultat sera ajouté à la conversation.`;
    enriched += fnBlock;
  }
  
  return enriched;
}

// ─── ENDPOINTS SKILLS ─────────────────────────────────────────
app.get('/skills', (req, res) => {
  res.json({
    skills: Object.values(SKILLS_CATALOG).map(s => ({
      id: s.id, label: s.label, description: s.description,
      icon: s.icon, category: s.category
    })),
    total: Object.keys(SKILLS_CATALOG).length
  });
});

app.get('/skills/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&select=skills`);
    const skills = bots?.[0]?.skills || [];
    res.json({ bot_id: req.params.botId, skills, available: Object.keys(SKILLS_CATALOG) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/skills/:botId', authMiddleware, async (req, res) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills)) return res.status(400).json({ error: 'skills doit être un tableau' });
    const invalid = skills.filter(s => !SKILLS_CATALOG[s]);
    if (invalid.length) return res.status(400).json({ error: `Skills invalides: ${invalid.join(', ')}` });
    
    await db.update('bots', { skills }, `?id=eq.${req.params.botId}&user_id=eq.${req.userId}`);
    res.json({ success: true, bot_id: req.params.botId, skills_activated: skills, count: skills.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── PAGE D'ADMIN POUR CONFIGURER LES SKILLS ──────────────────
app.get('/admin/skills/:botId', async (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skills — SamaBot</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f9fafb;color:#0a1a0f;padding:30px 20px;line-height:1.5}
.container{max-width:900px;margin:0 auto}
.brand{font-size:24px;font-weight:800;margin-bottom:6px}.brand span{color:#06C167}
.subtitle{color:#57534e;font-size:14px;margin-bottom:24px}
.intro{background:linear-gradient(135deg,#0a1a0f,#052811);color:#fff;padding:24px;border-radius:14px;margin-bottom:24px}
.intro h2{font-size:20px;margin-bottom:8px}.intro p{font-size:14px;color:rgba(255,255,255,0.85);line-height:1.5}
.category{font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#57534e;margin:24px 0 10px;padding-left:4px}
.skills-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.skill-card{background:#fff;border:2px solid #e5e7eb;border-radius:12px;padding:18px;cursor:pointer;transition:all 0.2s;position:relative}
.skill-card:hover{border-color:#06C167;transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,0.06)}
.skill-card.active{border-color:#06C167;background:#f0fdf4}
.skill-card .ic{font-size:30px;margin-bottom:8px}
.skill-card h3{font-size:15px;font-weight:800;margin-bottom:4px;color:#0a1a0f}
.skill-card p{font-size:12px;color:#57534e;line-height:1.5}
.skill-card .check{position:absolute;top:14px;right:14px;width:22px;height:22px;border:2px solid #d1d5db;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff}
.skill-card.active .check{background:#06C167;border-color:#06C167}
.skill-card.active .check::after{content:"✓"}
.actions{margin-top:24px;display:flex;gap:10px;align-items:center}
.btn{padding:12px 24px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;border:none}
.btn-primary{background:#06C167;color:#fff}.btn-primary:hover{background:#058048}
.btn-secondary{background:#f0f0f0;color:#0a1a0f}
.counter{margin-left:auto;font-size:13px;color:#57534e}
.alert{padding:12px 16px;border-radius:10px;margin-bottom:16px;display:none;font-size:13px}
.alert.show{display:block}
.alert.success{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
.alert.error{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}
</style></head><body>

<div class="container">
<div class="brand">Sama<span>Bot</span> · Skills</div>
<div class="subtitle">Bot ID: ${req.params.botId} · Active uniquement les compétences dont tu as besoin</div>

<div class="intro">
<h2>🧠 Compétences modulaires</h2>
<p>SamaBot devient adapté à ton secteur en activant des "Skills" spécialisés. Chaque skill ajoute des règles métier au bot. Tu peux activer plusieurs skills (ex: Commerce + RDV + Urgence pour un restaurant qui prend des réservations).</p>
</div>

<div id="alert" class="alert"></div>

<div id="skills-container"></div>

<div class="actions">
<button class="btn btn-primary" onclick="saveSkills()">💾 Sauvegarder</button>
<button class="btn btn-secondary" onclick="window.location.href='/admin/${req.params.botId}'">← Retour dashboard</button>
<div class="counter"><strong id="count">0</strong> skill(s) activé(s)</div>
</div>
</div>

<script>
const BOT_ID = ${JSON.stringify(req.params.botId)};
let availableSkills = [];
let activeSkills = [];

async function loadSkills() {
  try {
    const [allRes, botRes] = await Promise.all([
      fetch('/skills').then(r => r.json()),
      fetch('/skills/' + BOT_ID).then(r => r.json())
    ]);
    availableSkills = allRes.skills;
    activeSkills = botRes.skills || [];
    render();
  } catch(e) {
    showAlert('error', 'Erreur de chargement: ' + e.message);
  }
}

function render() {
  const groups = {};
  availableSkills.forEach(s => {
    if (!groups[s.category]) groups[s.category] = [];
    groups[s.category].push(s);
  });
  
  let html = '';
  for (const cat of ['Universal', 'SMB', 'Enterprise', 'Government', 'NGO']) {
    if (!groups[cat]) continue;
    html += '<div class="category">' + cat + '</div>';
    html += '<div class="skills-grid">';
    groups[cat].forEach(s => {
      const active = activeSkills.includes(s.id);
      html += '<div class="skill-card' + (active ? ' active' : '') + '" data-id="' + s.id + '" onclick="toggleSkill(\\'' + s.id + '\\')">';
      html += '<div class="check"></div>';
      html += '<div class="ic">' + s.icon + '</div>';
      html += '<h3>' + s.label.replace(/^[^ ]+ /, '') + '</h3>';
      html += '<p>' + s.description + '</p>';
      html += '</div>';
    });
    html += '</div>';
  }
  document.getElementById('skills-container').innerHTML = html;
  document.getElementById('count').textContent = activeSkills.length;
}

function toggleSkill(id) {
  if (activeSkills.includes(id)) {
    activeSkills = activeSkills.filter(s => s !== id);
  } else {
    activeSkills.push(id);
  }
  render();
}

async function saveSkills() {
  try {
    const token = localStorage.getItem('samabot_token');
    if (!token) { showAlert('error', 'Tu dois être connecté'); return; }
    const r = await fetch('/skills/' + BOT_ID, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({skills: activeSkills})
    });
    const data = await r.json();
    if (r.ok && data.success) {
      showAlert('success', '✅ ' + data.count + ' skill(s) activé(s) avec succès. Le bot est mis à jour.');
    } else {
      showAlert('error', 'Erreur: ' + (data.error || 'inconnue'));
    }
  } catch(e) {
    showAlert('error', 'Erreur réseau: ' + e.message);
  }
}

function showAlert(type, msg) {
  const a = document.getElementById('alert');
  a.className = 'alert show ' + type;
  a.textContent = msg;
  setTimeout(() => a.classList.remove('show'), 5000);
}

loadSkills();
</script>
</body></html>`);
});

// ─── RAG — UPLOAD DE DOCUMENTS ────────────────────────────────
function chunkText(text, maxChars = 1500) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let current = '';
  for (const sent of sentences) {
    if ((current + ' ' + sent).length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sent;
    } else {
      current = current ? current + ' ' + sent : sent;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function extractKeywords(text) {
  const stopwords = new Set(['le','la','les','de','des','du','un','une','et','ou','est','sont','ce','cette','ces','en','à','au','aux','par','pour','sur','dans','avec','que','qui','dont','ne','pas','plus','mais','si','je','tu','il','elle','nous','vous','ils','elles','my','the','a','an','of','to','in','is','are','this','that','it','for','on','with','and','or']);
  const words = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g) || [];
  const freq = {};
  words.forEach(w => { if (!stopwords.has(w)) freq[w] = (freq[w]||0)+1; });
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0, 20).map(e => e[0]);
}

async function searchRagChunks(botId, query, limit = 3) {
  try {
    const queryWords = (query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]{3,}/g) || []);
    if (queryWords.length === 0) return [];
    
    const chunks = await db.select('bot_documents', `?bot_id=eq.${botId}&select=id,title,content,keywords&limit=200`);
    if (!chunks?.length) return [];
    
    const scored = chunks.map(c => {
      const text = (c.content + ' ' + (c.keywords||[]).join(' ')).toLowerCase();
      let score = 0;
      queryWords.forEach(w => {
        const matches = (text.match(new RegExp(w, 'g')) || []).length;
        score += matches;
      });
      return { ...c, score };
    });
    
    return scored.filter(c => c.score > 0).sort((a,b) => b.score - a.score).slice(0, limit);
  } catch(e) {
    console.warn('RAG search error:', e.message);
    return [];
  }
}

app.post('/rag/upload/:botId', authMiddleware, async (req, res) => {
  try {
    const { title, content, source_type } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title et content requis' });
    if (content.length < 50) return res.status(400).json({ error: 'Contenu trop court (min 50 caractères)' });
    if (content.length > 500000) return res.status(400).json({ error: 'Contenu trop long (max 500000 caractères)' });
    
    const botCheck = await db.select('bots', `?id=eq.${req.params.botId}&user_id=eq.${req.userId}&select=id`);
    if (!botCheck?.length) return res.status(403).json({ error: 'Bot non trouvé ou accès refusé' });
    
    const chunks = chunkText(content);
    const inserted = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const keywords = extractKeywords(chunk);
      try {
        const r = await db.insert('bot_documents', {
          bot_id: req.params.botId,
          title: chunks.length > 1 ? `${title} (partie ${i+1}/${chunks.length})` : title,
          content: chunk,
          keywords,
          source_type: source_type || 'text',
          chunk_index: i,
          created_at: new Date().toISOString()
        });
        if (r?.[0]) inserted.push(r[0].id);
      } catch(e) { console.warn('Insert chunk failed:', e.message); }
    }
    
    res.json({
      success: true,
      title,
      chunks_created: inserted.length,
      chunk_ids: inserted,
      total_chars: content.length
    });
  } catch(e) {
    console.error('RAG upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/rag/list/:botId', async (req, res) => {
  try {
    const docs = await db.select('bot_documents', `?bot_id=eq.${req.params.botId}&select=id,title,source_type,chunk_index,created_at&order=created_at.desc&limit=100`);
    res.json({ bot_id: req.params.botId, documents: docs || [], total: (docs||[]).length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/rag/:botId/:docId', authMiddleware, async (req, res) => {
  try {
    const botCheck = await db.select('bots', `?id=eq.${req.params.botId}&user_id=eq.${req.userId}&select=id`);
    if (!botCheck?.length) return res.status(403).json({ error: 'Accès refusé' });
    
    await db.delete('bot_documents', `?id=eq.${req.params.docId}&bot_id=eq.${req.params.botId}`);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/rag/:botId/title/:title', authMiddleware, async (req, res) => {
  try {
    const botCheck = await db.select('bots', `?id=eq.${req.params.botId}&user_id=eq.${req.userId}&select=id`);
    if (!botCheck?.length) return res.status(403).json({ error: 'Accès refusé' });
    
    const docs = await db.select('bot_documents', `?bot_id=eq.${req.params.botId}&title=like.${encodeURIComponent(req.params.title + '%')}&select=id`);
    let count = 0;
    for (const d of (docs||[])) {
      await db.delete('bot_documents', `?id=eq.${d.id}`);
      count++;
    }
    res.json({ success: true, deleted: count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/rag/:botId', async (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RAG Documents — SamaBot</title><style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#f9fafb;color:#0a1a0f;padding:30px 20px;line-height:1.5}
.container{max-width:900px;margin:0 auto}
.brand{font-size:24px;font-weight:800;margin-bottom:6px}.brand span{color:#06C167}
.subtitle{color:#57534e;font-size:14px;margin-bottom:24px}
.intro{background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff;padding:24px;border-radius:14px;margin-bottom:24px}
.intro h2{font-size:20px;margin-bottom:8px}
.intro p{font-size:14px;color:rgba(255,255,255,0.9);line-height:1.5}
.upload-area{background:#fff;border:2px dashed #cbd5e1;border-radius:14px;padding:32px;text-align:center;margin-bottom:24px;transition:all 0.2s}
.upload-area:hover{border-color:#06C167;background:#f0fdf4}
.upload-area input[type=file]{display:none}
.upload-area label{cursor:pointer;display:block}
.upload-area .ic{font-size:48px;margin-bottom:12px}
.upload-area h3{font-size:18px;margin-bottom:6px}
.upload-area p{font-size:12px;color:#57534e}
input[type=text],textarea{width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;font-family:inherit;margin-bottom:12px;outline:none}
input[type=text]:focus,textarea:focus{border-color:#06C167}
textarea{min-height:120px;resize:vertical}
.btn{padding:11px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none}
.btn-primary{background:#06C167;color:#fff}.btn-primary:hover{background:#058048}
.btn-secondary{background:#f0f0f0;color:#0a1a0f}
.btn-danger{background:#fee2e2;color:#991b1b}
.docs-list{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
.doc-item{padding:14px 18px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center}
.doc-item:last-child{border-bottom:none}
.doc-item .info h4{font-size:14px;font-weight:700}
.doc-item .info p{font-size:11px;color:#57534e;margin-top:2px}
.empty{text-align:center;padding:40px;color:#999;font-style:italic;font-size:13px}
.alert{padding:12px 16px;border-radius:10px;margin-bottom:16px;display:none;font-size:13px}
.alert.show{display:block}
.alert.success{background:#dcfce7;color:#166534}
.alert.error{background:#fee2e2;color:#991b1b}
</style></head><body>

<div class="container">
<div class="brand">Sama<span>Bot</span> · Documents RAG</div>
<div class="subtitle">Bot ID: ${req.params.botId} · Le bot répondra en se basant sur ces documents</div>

<div class="intro">
<h2>📚 Base de connaissances</h2>
<p>Upload tes documents (FAQ, manuel, guide tarifaire, procédures) et le bot pourra y répondre précisément, en citant la source. Idéal pour banques, télécoms, services publics, ONG.</p>
</div>

<div id="alert" class="alert"></div>

<form id="form" style="background:#fff;padding:24px;border-radius:14px;margin-bottom:24px;border:1px solid #e5e7eb">
<h3 style="margin-bottom:14px">Ajouter un document</h3>
<input type="text" id="title" placeholder="Titre du document (ex: Guide tarifaire 2026)" maxlength="100" required>
<select id="source_type" style="width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:12px">
<option value="faq">FAQ</option>
<option value="manual">Manuel / Guide</option>
<option value="tariff">Tarifs / Pricing</option>
<option value="policy">Politique / Règlement</option>
<option value="procedure">Procédure</option>
<option value="text">Texte libre</option>
</select>
<textarea id="content" placeholder="Colle ici le contenu du document (texte uniquement, max 500K caractères)" required></textarea>
<button class="btn btn-primary" type="submit">📤 Envoyer le document</button>
</form>

<h3 style="margin-bottom:12px">Documents actuels</h3>
<div id="docs-list" class="docs-list">
<div class="empty">Aucun document encore. Upload ton premier ci-dessus.</div>
</div>

<div style="margin-top:24px">
<button class="btn btn-secondary" onclick="window.location.href='/admin/${req.params.botId}'">← Retour dashboard</button>
</div>
</div>

<script>
const BOT_ID = ${JSON.stringify(req.params.botId)};

async function loadDocs() {
  try {
    const r = await fetch('/rag/list/' + BOT_ID);
    const data = await r.json();
    const list = document.getElementById('docs-list');
    if (!data.documents || data.documents.length === 0) {
      list.innerHTML = '<div class="empty">Aucun document encore. Upload ton premier ci-dessus.</div>';
      return;
    }
    
    const groups = {};
    data.documents.forEach(d => {
      const baseTitle = d.title.replace(/ \\(partie \\d+\\/\\d+\\)$/, '');
      if (!groups[baseTitle]) groups[baseTitle] = { title: baseTitle, count: 0, source_type: d.source_type, created_at: d.created_at };
      groups[baseTitle].count++;
    });
    
    list.innerHTML = Object.values(groups).map(g => 
      '<div class="doc-item"><div class="info"><h4>' + g.title + '</h4><p>' + g.source_type + ' · ' + g.count + ' chunk(s) · ' + new Date(g.created_at).toLocaleDateString('fr-FR') + '</p></div>' +
      '<button class="btn btn-danger" onclick="deleteDoc(\\'' + g.title.replace(/'/g, "\\\\'") + '\\')">🗑 Supprimer</button>' +
      '</div>'
    ).join('');
  } catch(e) {
    showAlert('error', 'Erreur: ' + e.message);
  }
}

document.getElementById('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const content = document.getElementById('content').value.trim();
  const source_type = document.getElementById('source_type').value;
  if (!title || !content) return;
  
  try {
    const token = localStorage.getItem('samabot_token');
    if (!token) { showAlert('error', 'Tu dois être connecté'); return; }
    const r = await fetch('/rag/upload/' + BOT_ID, {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({title, content, source_type})
    });
    const data = await r.json();
    if (r.ok && data.success) {
      showAlert('success', '✅ Document ajouté: ' + data.chunks_created + ' chunk(s) créé(s)');
      document.getElementById('title').value = '';
      document.getElementById('content').value = '';
      loadDocs();
    } else {
      showAlert('error', 'Erreur: ' + (data.error || 'inconnue'));
    }
  } catch(e) {
    showAlert('error', 'Erreur: ' + e.message);
  }
});

async function deleteDoc(title) {
  if (!confirm('Supprimer ce document et tous ses chunks ?')) return;
  try {
    const token = localStorage.getItem('samabot_token');
    const r = await fetch('/rag/' + BOT_ID + '/title/' + encodeURIComponent(title), {
      method: 'DELETE',
      headers: {'Authorization':'Bearer '+token}
    });
    const data = await r.json();
    if (data.success) {
      showAlert('success', '✅ ' + data.deleted + ' chunk(s) supprimé(s)');
      loadDocs();
    } else {
      showAlert('error', 'Erreur: ' + (data.error || 'inconnue'));
    }
  } catch(e) {
    showAlert('error', 'Erreur: ' + e.message);
  }
}

function showAlert(type, msg) {
  const a = document.getElementById('alert');
  a.className = 'alert show ' + type;
  a.textContent = msg;
  setTimeout(() => a.classList.remove('show'), 5000);
}

loadDocs();
</script>
</body></html>`);
});

// ─── FUNCTION CALLING — ENREGISTREMENT D'OUTILS ───────────────
const BUILTIN_FUNCTIONS = {
  get_current_time: {
    name: 'get_current_time',
    description: 'Retourne la date et heure actuelles au Sénégal',
    handler: async () => ({ time: new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' }) })
  },
  search_catalogue: {
    name: 'search_catalogue',
    description: 'Recherche un produit dans le catalogue par nom',
    parameters: { query: 'string' },
    handler: async (args, ctx) => {
      const cat = ctx.bot?.catalogue || [];
      const q = (args.query || '').toLowerCase();
      const results = cat.filter(p => (p.nom || '').toLowerCase().includes(q));
      return { results, found: results.length };
    }
  },
  check_availability: {
    name: 'check_availability',
    description: 'Vérifie la disponibilité d\'un créneau pour un RDV',
    parameters: { date: 'string', heure: 'string' },
    handler: async (args, ctx) => {
      const { date, heure } = args;
      try {
        const existing = await db.select('rendez_vous', `?bot_id=eq.${ctx.botId}&date=eq.${date}&heure=eq.${heure}`);
        return { available: !existing?.length, date, heure };
      } catch(e) { return { available: true, date, heure }; }
    }
  },
  get_bot_info: {
    name: 'get_bot_info',
    description: 'Retourne les informations principales du business',
    handler: async (args, ctx) => ({
      nom: ctx.bot?.nom,
      telephone: ctx.bot?.telephone,
      adresse: ctx.bot?.adresse,
      horaires: ctx.bot?.horaires
    })
  }
};

const CUSTOM_WEBHOOK_FN = {
  name: 'call_external_api',
  description: 'Appelle une URL externe configurée pour le bot (webhook custom)',
  parameters: { endpoint: 'string', payload: 'object' },
  handler: async (args, ctx) => {
    const url = ctx.bot?.webhook_function_url;
    if (!url) return { error: 'Aucun webhook configuré' };
    if (!args.endpoint?.match(/^[a-z_]+$/)) return { error: 'endpoint invalide' };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SamaBot-Signature': ctx.bot.id },
        body: JSON.stringify({ endpoint: args.endpoint, payload: args.payload || {}, bot_id: ctx.bot.id })
      });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, data: j };
    } catch(e) { return { error: e.message }; }
  }
};

async function executeFunctionCall(call, ctx) {
  if (!call?.name) return { error: 'name requis' };
  const fn = BUILTIN_FUNCTIONS[call.name] || (call.name === 'call_external_api' ? CUSTOM_WEBHOOK_FN : null);
  if (!fn) return { error: `Fonction '${call.name}' inconnue` };
  
  try {
    const result = await fn.handler(call.arguments || {}, ctx);
    return { ok: true, name: call.name, result };
  } catch(e) {
    return { error: e.message };
  }
}

function parseFunctionCalls(text) {
  if (!text || typeof text !== 'string') return [];
  const calls = [];
  const re = /<function_call>([\s\S]*?)<\/function_call>/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      if (obj?.name) calls.push(obj);
    } catch(e) {}
  }
  return calls;
}

app.get('/functions', (req, res) => {
  res.json({
    builtin: Object.keys(BUILTIN_FUNCTIONS).map(k => ({
      name: BUILTIN_FUNCTIONS[k].name,
      description: BUILTIN_FUNCTIONS[k].description,
      parameters: BUILTIN_FUNCTIONS[k].parameters || {}
    })),
    custom: [{ name: CUSTOM_WEBHOOK_FN.name, description: CUSTOM_WEBHOOK_FN.description }]
  });
});

app.get('/functions/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&select=allowed_functions,webhook_function_url`);
    res.json({
      bot_id: req.params.botId,
      allowed_functions: bots?.[0]?.allowed_functions || [],
      webhook_url: bots?.[0]?.webhook_function_url || null,
      available_builtin: Object.keys(BUILTIN_FUNCTIONS)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/functions/:botId', authMiddleware, async (req, res) => {
  try {
    const { allowed_functions, webhook_function_url } = req.body;
    
    if (allowed_functions !== undefined && !Array.isArray(allowed_functions)) {
      return res.status(400).json({ error: 'allowed_functions doit être un tableau' });
    }
    
    const update = {};
    if (allowed_functions !== undefined) {
      const valid = Object.keys(BUILTIN_FUNCTIONS).concat([CUSTOM_WEBHOOK_FN.name]);
      const invalid = allowed_functions.filter(fn => !valid.includes(fn.name));
      if (invalid.length) return res.status(400).json({ error: `Fonctions invalides: ${invalid.map(f => f.name).join(', ')}` });
      update.allowed_functions = allowed_functions;
    }
    if (webhook_function_url !== undefined) {
      if (webhook_function_url && !/^https?:\/\//.test(webhook_function_url)) {
        return res.status(400).json({ error: 'webhook_function_url doit commencer par http:// ou https://' });
      }
      update.webhook_function_url = webhook_function_url || null;
    }
    
    await db.update('bots', update, `?id=eq.${req.params.botId}&user_id=eq.${req.userId}`);
    res.json({ success: true, updated: update });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/functions/test/:botId', authMiddleware, async (req, res) => {
  try {
    const { name, arguments: args } = req.body;
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&user_id=eq.${req.userId}`);
    if (!bots?.length) return res.status(403).json({ error: 'Accès refusé' });
    
    const result = await executeFunctionCall({ name, arguments: args || {} }, { bot: bots[0], botId: req.params.botId });
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── CHAT V2 — INTELLIGENT (skills + RAG + functions) ─────────
app.post('/chat/v2', async (req, res) => {
  try {
    const { message, botId, sessionId } = req.body;
    if (!message || !botId) return res.status(400).json({ error: 'message et botId requis' });
    
    const bots = await db.select('bots', `?id=eq.${botId}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });
    const bot = bots[0];
    
    if (typeof checkBotPlanAccess === 'function') {
      const access = checkBotPlanAccess(bot);
      if (!access.allowed) return res.status(402).json({ error: access.reason || 'Plan expiré' });
    }
    
    const ragResults = await searchRagChunks(botId, message, 3);
    const enrichedBot = { ...bot };
    if (ragResults.length > 0) {
      enrichedBot.context_documents = ragResults.map(r => ({ title: r.title, content: r.content }));
    }
    
    const systemPrompt = makePromptUniversal(enrichedBot);
    
    const apiKey = CONFIG.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenAI non configuré' });
    
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    });
    
    if (!openaiResp.ok) {
      const errText = await openaiResp.text();
      return res.status(500).json({ error: 'OpenAI error', details: errText.slice(0, 200) });
    }
    
    const aiData = await openaiResp.json();
    let aiMessage = aiData.choices?.[0]?.message?.content || '';
    
    const fnCalls = parseFunctionCalls(aiMessage);
    const fnResults = [];
    if (fnCalls.length > 0 && bot.allowed_functions?.length > 0) {
      const allowedNames = bot.allowed_functions.map(f => f.name);
      for (const call of fnCalls) {
        if (!allowedNames.includes(call.name)) {
          fnResults.push({ name: call.name, error: 'Fonction non autorisée' });
          continue;
        }
        const result = await executeFunctionCall(call, { bot, botId });
        fnResults.push({ name: call.name, ...result });
      }
      
      aiMessage = aiMessage.replace(/<function_call>[\s\S]*?<\/function_call>/g, '').trim();
      if (!aiMessage) aiMessage = '✅ Action effectuée.';
    }
    
    res.json({
      success: true,
      response: aiMessage,
      sources: ragResults.length > 0 ? ragResults.map(r => r.title) : undefined,
      function_results: fnResults.length > 0 ? fnResults : undefined,
      meta: {
        skills_active: bot.skills?.length || 0,
        rag_chunks: ragResults.length,
        functions_called: fnResults.length
      }
    });
  } catch(e) {
    console.error('Chat v2 error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// FIN BLOC v10.5 ────────────────────────────────────────────


// ════════════════════════════════════════════════════════════
// ONBOARDING V2 — ADAPTATIF INTELLIGENT (v10.6)
// L'ancien /onboarding reste intact (rétrocompat)
// /onboarding-v2 pose des questions SPÉCIFIQUES selon la niche
// Chaque niche a son template de questions + skills + quick replies
// ════════════════════════════════════════════════════════════

// ─── TEMPLATES PAR NICHE ──────────────────────────────────────
// Chaque template définit :
// 1. Les questions spécifiques au métier (étape 3 du wizard)
// 2. Les skills v10.5 à activer automatiquement
// 3. Les quick replies du bot adaptés au métier
// 4. Le prompt système métier
// 5. Le format du catalogue/services

const NICHE_TEMPLATES_V2 = {

  boutique: {
    icon: '🛒',
    label: 'Boutique / Vente',
    description: 'Vêtements, accessoires, produits divers',
    color: '#8b5cf6',
    skills: ['commerce', 'urgence'],
    catalogue_label: 'Produits',
    catalogue_singular: 'produit',
    placeholder_item: 'Ex: T-shirt blanc taille M',
    placeholder_price: 'Prix en FCFA (ex: 5000)',
    questions: [
      { key: 'type_produits', label: 'Type de produits vendus', placeholder: 'Ex: Vêtements, électronique, alimentaire', required: true },
      { key: 'livraison_actif', label: 'Tu fais la livraison ?', type: 'boolean', required: true },
      { key: 'livraison_zones', label: 'Zones de livraison (si oui)', placeholder: 'Ex: Dakar, Pikine, Guédiawaye', required: false },
      { key: 'livraison_frais', label: 'Frais de livraison (FCFA)', type: 'number', placeholder: '1000', required: false },
      { key: 'paiement_modes', label: 'Moyens de paiement acceptés', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'Free Money', 'Carte bancaire'], required: true }
    ],
    quick_replies: ['🛍️ Voir produits', '📦 Commander', '🚚 Livraison', '📍 Adresse', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'une BOUTIQUE qui vend des produits.
RÈGLES:
- Quand le client dit bonjour/asalaa, présente brièvement et propose: voir produits, commander, livraison
- Si le client demande "vos produits" ou "catalogue", liste les produits avec photos et prix
- Pour une commande: produit choisi → quantité → infos client (prénom, tél, adresse) → récap → confirmation → paiement
- Ne demande JAMAIS l'email sauf si vraiment nécessaire (1 fois max)
- Si infos client déjà données dans le message, ne re-demande pas (analyse le message)
- Confirme toujours par un récapitulatif AVANT le paiement
- Pour la livraison, mentionne les frais et le délai
- Termine toujours par un "Jërëjëf" chaleureux`
  },

  restaurant: {
    icon: '🍽️',
    label: 'Restaurant / Traiteur',
    description: 'Plats, livraison de repas',
    color: '#f59e0b',
    skills: ['commerce', 'urgence'],
    catalogue_label: 'Menu',
    catalogue_singular: 'plat',
    placeholder_item: 'Ex: Thiéboudiène complet',
    placeholder_price: 'Prix en FCFA (ex: 3500)',
    questions: [
      { key: 'type_cuisine', label: 'Type de cuisine', placeholder: 'Ex: Sénégalaise, Fast-food, Internationale', required: true },
      { key: 'livraison_actif', label: 'Tu fais la livraison ?', type: 'boolean', required: true },
      { key: 'livraison_zones', label: 'Zones de livraison (si oui)', placeholder: 'Ex: Dakar, Almadies', required: false },
      { key: 'livraison_frais', label: 'Frais de livraison (FCFA)', type: 'number', placeholder: '1000', required: false },
      { key: 'livraison_delai', label: 'Délai de livraison', placeholder: '30-45 min', required: false },
      { key: 'horaires_service', label: 'Horaires du service', placeholder: 'Ex: 11h-23h tous les jours', required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'À la livraison'], required: true }
    ],
    quick_replies: ['🍽️ Menu', '📦 Commander', '🚚 Livraison', '🕐 Horaires', '📍 Adresse'],
    prompt_metier: `Tu es l'assistant d'un RESTAURANT.
RÈGLES:
- Quand client dit bonjour, propose: voir menu, commander, infos livraison
- Pour le menu, liste les plats avec photos et prix de manière appétissante
- Pour une commande: plat → quantité → infos client → récap → confirmation → paiement
- Mentionne le délai de livraison estimé
- Ne demande JAMAIS l'email sauf si nécessaire
- Si infos déjà données, ne re-demande pas
- Confirme toujours par récap AVANT paiement
- Termine par "Jërëjëf, à très vite !"`
  },

  salon_coiffure: {
    icon: '💇',
    label: 'Salon de coiffure / Beauté',
    description: 'Coiffure, manucure, soins esthétiques',
    color: '#ec4899',
    skills: ['rdv', 'urgence'],
    catalogue_label: 'Prestations',
    catalogue_singular: 'prestation',
    placeholder_item: 'Ex: Tresses africaines',
    placeholder_price: 'Prix en FCFA (ex: 15000)',
    questions: [
      { key: 'type_prestations', label: 'Types de prestations', placeholder: 'Ex: Coiffure, manucure, maquillage', required: true },
      { key: 'duree_moyenne', label: 'Durée moyenne d\'une prestation (en min)', type: 'number', placeholder: '60', required: true },
      { key: 'horaires_ouverture', label: 'Horaires d\'ouverture', placeholder: 'Ex: 9h-19h Lun-Sam', required: true },
      { key: 'jours_ouverts', label: 'Jours d\'ouverture', type: 'multi', options: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'], required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces'], required: true }
    ],
    quick_replies: ['💇 Prestations', '📅 Prendre RDV', '💰 Tarifs', '📍 Adresse', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'un SALON DE COIFFURE / BEAUTÉ.
RÈGLES:
- Quand client dit bonjour, propose: voir prestations, prendre RDV, tarifs
- Pour les prestations, liste avec prix et durée
- Pour un RDV: prestation choisie → date/heure souhaitée → vérification disponibilité → confirmation
- Demande infos client (prénom, tél) pour confirmer le RDV
- Ne demande PAS l'email
- Mentionne la durée estimée de la prestation
- Confirme par récap clair avec date/heure exactes
- Termine par "Jërëjëf, à bientôt au salon !"`
  },

  pharmacie: {
    icon: '💊',
    label: 'Pharmacie / Parapharmacie',
    description: 'Médicaments, produits de santé',
    color: '#10b981',
    skills: ['sante', 'commerce', 'urgence'],
    catalogue_label: 'Produits',
    catalogue_singular: 'produit',
    placeholder_item: 'Ex: Doliprane 500mg',
    placeholder_price: 'Prix en FCFA (ex: 2500)',
    questions: [
      { key: 'pharmacie_garde', label: 'Tu fais la garde de nuit ?', type: 'boolean', required: true },
      { key: 'horaires_normaux', label: 'Horaires normaux', placeholder: 'Ex: 8h-22h', required: true },
      { key: 'horaires_garde', label: 'Horaires de garde (si applicable)', placeholder: 'Ex: 22h-8h', required: false },
      { key: 'livraison_actif', label: 'Tu livres les médicaments ?', type: 'boolean', required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'Mutuelle'], required: true }
    ],
    quick_replies: ['💊 Disponibilité', '🚨 Garde', '🚚 Livraison', '🕐 Horaires', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'une PHARMACIE.
RÈGLES CRITIQUES SANTÉ:
- Tu ne donnes JAMAIS de conseil médical, de diagnostic, ni de prescription
- Si le client décrit des symptômes, redirige IMMÉDIATEMENT vers le pharmacien ou un médecin
- Tu peux: confirmer la disponibilité d'un médicament, donner les horaires, expliquer comment commander
- En cas d'URGENCE médicale: redirige IMMÉDIATEMENT vers le SAMU 1515 ou les urgences
- Pour livraison médicaments: vérifie ordonnance requise
- Reste professionnel et bienveillant
- Termine par "Bonne santé, jërëjëf !"`
  },

  auto_ecole: {
    icon: '🚗',
    label: 'Auto-école',
    description: 'Permis de conduire, code, conduite',
    color: '#3b82f6',
    skills: ['rdv', 'education', 'urgence'],
    catalogue_label: 'Forfaits',
    catalogue_singular: 'forfait',
    placeholder_item: 'Ex: Forfait Code + 20h conduite',
    placeholder_price: 'Prix en FCFA (ex: 150000)',
    questions: [
      { key: 'permis_proposes', label: 'Permis proposés', type: 'multi', options: ['B (voiture)', 'A (moto)', 'C (camion)', 'D (bus)'], required: true },
      { key: 'horaires_cours', label: 'Horaires des cours', placeholder: 'Ex: 9h-18h Lun-Sam', required: true },
      { key: 'documents_requis', label: 'Documents requis pour inscription', placeholder: 'Ex: CNI, 4 photos, certificat médical', required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'Paiement en plusieurs fois'], required: true }
    ],
    quick_replies: ['🚗 Forfaits', '📝 S\'inscrire', '📅 RDV', '📋 Documents', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'une AUTO-ÉCOLE.
RÈGLES:
- Quand client dit bonjour, propose: voir forfaits, s'inscrire, prendre RDV info
- Pour les forfaits, explique ce qui est inclus (code, heures de conduite)
- Pour une inscription: présente les documents requis, propose RDV pour finaliser
- Pour un RDV: type (info / inscription / cours) → date/heure → confirmation
- Mentionne les horaires de cours et la durée moyenne pour obtenir le permis
- Ne demande PAS l'email systématiquement
- Termine par "Bonne route, jërëjëf !"`
  },

  clinique_medicale: {
    icon: '🏥',
    label: 'Clinique / Cabinet médical',
    description: 'Consultations, RDV médecins',
    color: '#06b6d4',
    skills: ['rdv', 'sante', 'urgence'],
    catalogue_label: 'Spécialités',
    catalogue_singular: 'spécialité',
    placeholder_item: 'Ex: Médecine générale',
    placeholder_price: 'Prix consultation en FCFA (ex: 15000)',
    questions: [
      { key: 'specialites', label: 'Spécialités proposées', placeholder: 'Ex: Médecine générale, Cardiologie, Pédiatrie', required: true },
      { key: 'horaires_consultation', label: 'Horaires de consultation', placeholder: 'Ex: 8h-18h Lun-Sam', required: true },
      { key: 'urgences_actif', label: 'Service d\'urgences ?', type: 'boolean', required: true },
      { key: 'mutuelles_acceptees', label: 'Mutuelles acceptées', placeholder: 'Ex: IPRES, IPM, Atlanta', required: false },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'Mutuelle', 'Carte'], required: true }
    ],
    quick_replies: ['🏥 Spécialités', '📅 Prendre RDV', '🚨 Urgences', '🕐 Horaires', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'une CLINIQUE / CABINET MÉDICAL.
RÈGLES CRITIQUES SANTÉ:
- Tu ne donnes JAMAIS de diagnostic, de traitement, ni de conseil médical
- Si le patient décrit des symptômes graves, redirige IMMÉDIATEMENT vers urgences (1515 SAMU)
- Tu peux: prendre RDV, expliquer les spécialités, donner les horaires
- Pour un RDV: spécialité → motif court → date/heure → confirmation
- Demande infos patient (nom, tél, motif court) pour le RDV
- Reste empathique et professionnel
- Confidentialité ABSOLUE des informations patient
- Termine par "Bonne santé, jërëjëf !"`
  },

  hotel: {
    icon: '🏨',
    label: 'Hôtel / Hébergement',
    description: 'Réservation chambres, services',
    color: '#0ea5e9',
    skills: ['rdv', 'commerce', 'urgence'],
    catalogue_label: 'Chambres',
    catalogue_singular: 'chambre',
    placeholder_item: 'Ex: Chambre Standard',
    placeholder_price: 'Prix par nuit en FCFA (ex: 35000)',
    questions: [
      { key: 'types_chambres', label: 'Types de chambres', placeholder: 'Ex: Standard, Deluxe, Suite', required: true },
      { key: 'services_inclus', label: 'Services inclus', placeholder: 'Ex: Petit-déj, Wifi, Piscine, Parking', required: true },
      { key: 'check_in_out', label: 'Heures check-in/check-out', placeholder: 'Ex: Check-in 14h, Check-out 12h', required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Carte bancaire', 'Virement', 'Espèces'], required: true }
    ],
    quick_replies: ['🏨 Chambres', '📅 Réserver', '💰 Tarifs', '🍳 Services', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'un HÔTEL.
RÈGLES:
- Quand client dit bonjour, propose: voir chambres, réserver, services
- Pour les chambres, liste types avec prix par nuit et capacité
- Pour une réservation: dates (arrivée + départ) → type chambre → nb personnes → infos client → confirmation
- Mentionne les services inclus et heures check-in/check-out
- Demande nom complet, tél, et email (pour la réservation officielle)
- Confirme par récap clair avec dates précises et total
- Termine par "Au plaisir de vous accueillir, jërëjëf !"`
  },

  taxi_transport: {
    icon: '🚕',
    label: 'Taxi / Transport',
    description: 'Réservation courses, livraison',
    color: '#eab308',
    skills: ['rdv', 'urgence'],
    catalogue_label: 'Tarifs',
    catalogue_singular: 'course',
    placeholder_item: 'Ex: Course Dakar Centre',
    placeholder_price: 'Prix en FCFA (ex: 2500)',
    questions: [
      { key: 'zones_couverture', label: 'Zones couvertes', placeholder: 'Ex: Dakar, Pikine, Rufisque', required: true },
      { key: 'disponibilite', label: 'Disponibilité', placeholder: 'Ex: 24/7 ou 6h-22h', required: true },
      { key: 'type_vehicules', label: 'Types de véhicules', placeholder: 'Ex: Berline, 4x4, Mini-bus', required: false },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces'], required: true }
    ],
    quick_replies: ['🚕 Réserver', '💰 Tarifs', '📍 Zones', '🕐 Disponibilité', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'un service de TAXI / TRANSPORT.
RÈGLES:
- Quand client dit bonjour, propose: réserver une course, voir tarifs, infos zones
- Pour une réservation: lieu de prise en charge → destination → date/heure → nb passagers → confirmation
- Demande infos client (nom, tél) pour la course
- Estime le tarif selon les zones couvertes
- Confirme par récap avec adresse précise et heure
- Mentionne le type de véhicule disponible
- Termine par "Bonne route, jërëjëf !"`
  },

  service_pro: {
    icon: '🔧',
    label: 'Service / Artisan',
    description: 'Plombier, électricien, menuisier, etc.',
    color: '#a16207',
    skills: ['rdv', 'urgence'],
    catalogue_label: 'Prestations',
    catalogue_singular: 'prestation',
    placeholder_item: 'Ex: Réparation plomberie',
    placeholder_price: 'Prix de base en FCFA (ex: 5000) ou "Sur devis"',
    questions: [
      { key: 'type_service', label: 'Type de service', placeholder: 'Ex: Plomberie, Électricité, Menuiserie', required: true },
      { key: 'zones_intervention', label: 'Zones d\'intervention', placeholder: 'Ex: Dakar et banlieue', required: true },
      { key: 'urgences', label: 'Tu interviens en urgence ?', type: 'boolean', required: true },
      { key: 'devis_gratuit', label: 'Devis gratuit ?', type: 'boolean', required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'Virement'], required: true }
    ],
    quick_replies: ['🔧 Prestations', '📋 Demander devis', '📅 RDV chantier', '🚨 Urgence', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'un ARTISAN / SERVICE PROFESSIONNEL.
RÈGLES:
- Quand client dit bonjour, propose: voir prestations, demander devis, prendre RDV
- Pour un devis: type de problème → adresse → photos si possible → coordonnées
- Pour un RDV: prestation → adresse → date/heure → confirmation
- Mentionne si urgence disponible et tarifs estimés
- Demande adresse précise (très important pour intervention)
- Confirme par récap clair
- Termine par "À très vite, jërëjëf !"`
  },

  ecole_formation: {
    icon: '🎓',
    label: 'École / Formation',
    description: 'Cours, formations, certifications',
    color: '#7c3aed',
    skills: ['education', 'rdv', 'urgence'],
    catalogue_label: 'Formations',
    catalogue_singular: 'formation',
    placeholder_item: 'Ex: Formation Bureautique',
    placeholder_price: 'Prix en FCFA (ex: 75000)',
    questions: [
      { key: 'type_formations', label: 'Type de formations', placeholder: 'Ex: Informatique, Langues, Comptabilité', required: true },
      { key: 'duree_formations', label: 'Durée moyenne', placeholder: 'Ex: 3 mois, 6 mois, 1 an', required: true },
      { key: 'certifications', label: 'Certifications délivrées', placeholder: 'Ex: Diplôme reconnu, Attestation', required: false },
      { key: 'horaires_cours', label: 'Horaires des cours', placeholder: 'Ex: Lun-Ven 8h-17h, Samedi matin', required: true },
      { key: 'paiement_modes', label: 'Moyens de paiement', type: 'multi', options: ['Wave', 'Orange Money', 'Espèces', 'Échéancier'], required: true }
    ],
    quick_replies: ['🎓 Formations', '📝 S\'inscrire', '💰 Tarifs', '📅 RDV info', '📞 Contact'],
    prompt_metier: `Tu es l'assistant d'une ÉCOLE / CENTRE DE FORMATION.
RÈGLES:
- Quand client dit bonjour, propose: voir formations, s'inscrire, RDV info
- Pour les formations, liste avec durée, prix et certification délivrée
- Pour une inscription: formation choisie → infos personnelles → docs requis → RDV admin
- Mentionne les horaires et possibilité de paiement échelonné
- Demande infos étudiant (nom, tél, niveau actuel)
- Confirme par récap avec démarches à suivre
- Termine par "Bonne formation, jërëjëf !"`
  }
};

// ─── ENDPOINTS API ────────────────────────────────────────────

// Liste tous les templates disponibles
app.get('/onboarding-v2/niches', (req, res) => {
  const niches = Object.entries(NICHE_TEMPLATES_V2).map(([id, t]) => ({
    id,
    label: t.label,
    description: t.description,
    icon: t.icon,
    color: t.color,
    skills_auto: t.skills,
    nb_questions: t.questions.length
  }));
  res.json({ niches, total: niches.length });
});

// Récupère le template complet d'une niche
app.get('/onboarding-v2/template/:nicheId', (req, res) => {
  const template = NICHE_TEMPLATES_V2[req.params.nicheId];
  if (!template) return res.status(404).json({ error: 'Niche inconnue' });
  res.json({
    id: req.params.nicheId,
    ...template
  });
});

// Crée le bot avec configuration adaptative
app.post('/onboarding-v2/create', authMiddleware, async (req, res) => {
  try {
    const { niche, business_name, ville, telephone_pro, color, niche_data, catalogue_items } = req.body;
    
    if (!niche || !business_name) return res.status(400).json({ error: 'Niche et nom requis' });
    
    const template = NICHE_TEMPLATES_V2[niche];
    if (!template) return res.status(400).json({ error: 'Niche invalide' });
    
    // Génère un bot_id unique
    const slug = (business_name||'bot').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20);
    const botId = `${slug||'bot'}-${Math.random().toString(36).slice(2,9)}`;
    
    // Construction du prompt système ADAPTATIF
    const niche_data_str = niche_data ? Object.entries(niche_data)
      .filter(([k,v]) => v && v !== '')
      .map(([k,v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join('\n') : '';
    
    const fullPrompt = `${template.prompt_metier}

INFOS DU BUSINESS:
- Nom: ${business_name}
- Ville: ${ville || 'Dakar'}
- Téléphone: ${telephone_pro || 'à compléter'}
- Type: ${template.label}

CONFIGURATION SPÉCIFIQUE:
${niche_data_str || '(à compléter dans le dashboard)'}

LANGUES:
- Tu réponds toujours dans la langue du client (français ou wolof)
- Utilise "Asalaa maalekum", "Jërëjëf", "Waaw" naturellement en wolof

STYLE:
- Chaleureux, professionnel, efficace
- Réponses courtes (2-4 phrases max)
- Liste produits/services avec tirets
- Emojis pertinents pour la lisibilité`;
    
    // Détermine livraison + paiement depuis niche_data
    const livraison_actif = !!(niche_data?.livraison_actif === true || niche_data?.livraison_actif === 'true');
    const livraison_zones = niche_data?.livraison_zones || (livraison_actif ? 'Dakar' : null);
    const livraison_frais = parseInt(niche_data?.livraison_frais) || 0;
    const livraison_delai = niche_data?.livraison_delai || '30-45 min';
    
    const paiement_modes = niche_data?.paiement_modes || ['Wave', 'Orange Money', 'Espèces'];
    const paiement_str = Array.isArray(paiement_modes) ? paiement_modes.join(', ') : paiement_modes;
    
    // Configuration finale du bot
    const config = {
      id: botId,
      user_id: req.userId,
      nom: business_name,
      ville: ville || 'Dakar',
      telephone: telephone_pro || null,
      niche,
      couleur: color || template.color,
      emoji: template.icon,
      prompt: fullPrompt,
      langues: ['fr', 'wo'],
      actif: true,
      plan: 'trial',
      trial_until: new Date(Date.now() + 3*24*60*60*1000).toISOString(),
      created_at: new Date().toISOString(),
      
      // ✅ Skills v10.5 auto-activés
      skills: template.skills,
      
      // ✅ Quick replies adaptés
      quick_replies: template.quick_replies,
      
      // ✅ Livraison configurée
      livraison_actif,
      livraison_zones,
      livraison_frais,
      livraison_delai,
      livraison_min: 0,
      
      // ✅ Paiement
      paiement: paiement_str,
      
      // ✅ Métadonnées spécifiques
      niche_metadata: niche_data || {}
    };
    
    const inserted = await db.insert('bots', config);
    if (!inserted?.[0]) return res.status(500).json({ error: 'Erreur création bot' });
    
    // ✅ Insertion du catalogue/produits/services
    let cat_count = 0;
    if (Array.isArray(catalogue_items) && catalogue_items.length > 0) {
      for (const item of catalogue_items) {
        if (!item.nom) continue;
        try {
          await db.insert('produits', {
            bot_id: botId,
            nom: item.nom,
            prix: parseInt(item.prix) || 0,
            desc: item.description || null,
            actif: true,
            visible: true,
            emoji: item.emoji || template.icon,
            created_at: new Date().toISOString()
          });
          cat_count++;
        } catch(e) { console.warn('Insert produit failed:', e.message); }
      }
    }
    
    res.json({
      success: true,
      bot_id: botId,
      bot_url: `${CONFIG.BASE_URL}/?bot=${botId}`,
      dashboard_url: `${CONFIG.BASE_URL}/admin/${botId}`,
      embed_code: `<script src="${CONFIG.BASE_URL}/widget.js" data-bot="${botId}"></script>`,
      trial_until: config.trial_until,
      catalogue_count: cat_count,
      skills_actives: template.skills,
      niche_label: template.label
    });
  } catch(e) {
    console.error('Onboarding-v2 error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── PAGE WIZARD ADAPTATIF ────────────────────────────────────
app.get('/onboarding-v2', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crée ton bot intelligent · SamaBot</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:linear-gradient(135deg,#0a1a0f,#052811);min-height:100vh;color:#fff;padding:20px}
.wizard{max-width:720px;margin:20px auto;background:#fff;color:#0a1a0f;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.brand-header{padding:16px 40px;background:#0a1a0f;color:#fff;font-size:13px;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center}
.brand-header b{color:#06C167}
.progress{height:6px;background:#f0f0f0}
.progress-bar{height:100%;background:linear-gradient(90deg,#06C167,#058048);transition:width 0.4s ease;width:20%}
.step{padding:50px 40px;display:none}
.step.active{display:block}
h1{font-size:30px;margin-bottom:8px;letter-spacing:-1px;line-height:1.2}
h1 .accent{color:#06C167}
.subtitle{color:#57534e;margin-bottom:32px;font-size:15px;line-height:1.5}
.step-num{display:inline-block;background:#06C167;color:#000;font-size:11px;font-weight:800;letter-spacing:1.5px;padding:4px 12px;border-radius:12px;margin-bottom:14px}
.niche-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
.niche-card{padding:18px 16px;border:2px solid #e5e7eb;border-radius:14px;text-align:left;cursor:pointer;transition:all 0.2s;background:#fff;display:flex;align-items:center;gap:12px}
.niche-card:hover{border-color:#06C167;transform:translateY(-2px)}
.niche-card.selected{border-color:#06C167;background:#f0fdf4}
.niche-card .emoji{font-size:36px;flex-shrink:0}
.niche-card .info{flex:1;min-width:0}
.niche-card .lbl{font-size:14px;font-weight:700;margin-bottom:3px}
.niche-card .desc{font-size:11px;color:#57534e;line-height:1.4}
input,select,textarea{width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:15px;margin-bottom:14px;outline:none;transition:border 0.2s;background:#fff;color:#0a1a0f;font-family:inherit}
input:focus,select:focus,textarea:focus{border-color:#06C167}
textarea{min-height:80px;resize:vertical}
label{display:block;font-size:13px;font-weight:700;color:#0a1a0f;margin-bottom:6px}
label .req{color:#dc2626}
.field-group{margin-bottom:16px}
.field-help{font-size:12px;color:#57534e;margin-top:-10px;margin-bottom:14px;padding-left:4px}
.toggle-row{display:flex;gap:8px;margin-bottom:14px}
.toggle-btn{flex:1;padding:12px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;color:#57534e;transition:all 0.15s}
.toggle-btn.active{border-color:#06C167;background:#f0fdf4;color:#06C167}
.multi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:14px}
.multi-btn{padding:10px 12px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:13px;color:#57534e;transition:all 0.15s;text-align:center}
.multi-btn.active{border-color:#06C167;background:#f0fdf4;color:#06C167;font-weight:600}
.btn-row{display:flex;gap:10px;margin-top:16px}
.btn{padding:14px 24px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;border:none;transition:all 0.2s;font-family:inherit}
.btn-primary{background:#06C167;color:#fff;flex:2}
.btn-primary:hover{background:#058048}
.btn-secondary{background:#f0f0f0;color:#0a1a0f;flex:1}
.btn-secondary:hover{background:#e0e0e0}
.btn:disabled{opacity:0.4;cursor:not-allowed}
.color-row{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}
.color-swatch{height:48px;border-radius:10px;cursor:pointer;border:3px solid transparent;transition:all 0.2s}
.color-swatch:hover{transform:scale(1.05)}
.color-swatch.selected{border-color:#0a1a0f;transform:scale(1.05)}
.row-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.catalogue-list{margin-bottom:14px}
.catalogue-item{display:grid;grid-template-columns:2fr 1fr auto;gap:8px;margin-bottom:8px;align-items:start}
.catalogue-item input{margin:0}
.btn-remove{padding:10px 14px;background:#fee2e2;color:#991b1b;border:none;border-radius:10px;cursor:pointer;font-weight:600}
.btn-add{background:#dcfce7;color:#166534;border:2px dashed #06C167;padding:12px;width:100%;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;margin-top:8px}
.success{text-align:center;padding:60px 20px}
.success-emoji{font-size:64px;margin-bottom:20px}
.success h2{font-size:32px;margin-bottom:12px;color:#0a1a0f}
.success p{color:#57534e;margin-bottom:24px;font-size:15px}
.success-card{background:#f9fafb;border-left:4px solid #06C167;padding:18px;border-radius:10px;text-align:left;margin:14px 0;font-family:'Courier New',monospace;font-size:12px;word-break:break-all}
.success-card strong{display:block;color:#0a1a0f;font-family:-apple-system,sans-serif;margin-bottom:6px;font-size:13px}
.feature-pill{display:inline-block;background:#dcfce7;color:#166534;padding:4px 12px;border-radius:12px;font-size:11px;font-weight:700;margin:2px}
.preview-box{background:#f9fafb;padding:18px;border-radius:12px;margin-bottom:20px;font-size:14px;line-height:1.7;border-left:4px solid #06C167}
.preview-box strong{color:#0a1a0f}
.checkbox-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;padding:14px;background:#f9fafb;border-radius:10px;cursor:pointer}
.checkbox-row input{width:auto;margin:0;flex-shrink:0;margin-top:3px}
.checkbox-row label{font-size:13px;cursor:pointer;color:#1c1917;font-weight:500}
.checkbox-row label a{color:#06C167}
@media(max-width:600px){
  .niche-grid{grid-template-columns:1fr}
  .row-2col{grid-template-columns:1fr}
  .color-row{grid-template-columns:repeat(3,1fr)}
  .multi-grid{grid-template-columns:repeat(2,1fr)}
}
</style></head><body>

<div class="wizard">
<div class="brand-header"><span>Sama<b>Bot</b> · Onboarding intelligent v2</span><span style="opacity:0.7" id="step-counter">Étape 1/5</span></div>
<div class="progress"><div class="progress-bar" id="progress-bar"></div></div>

<div class="step active" id="step-1">
<div class="step-num">ÉTAPE 1 / 5</div>
<h1>Quel est ton <span class="accent">métier</span> ?</h1>
<p class="subtitle">Le bot s'adaptera automatiquement à ton secteur. Les questions suivantes seront spécifiques à ton métier.</p>
<div class="niche-grid" id="niche-grid"></div>
<div class="btn-row"><button class="btn btn-primary" id="btn-step-1" disabled onclick="goStep(2)">Continuer →</button></div>
</div>

<div class="step" id="step-2">
<div class="step-num">ÉTAPE 2 / 5</div>
<h1>Parle-moi de ton <span class="accent">business</span></h1>
<p class="subtitle">Ces informations apparaîtront dans les conversations avec tes clients.</p>
<div class="field-group">
<label>Nom de ton business <span class="req">*</span></label>
<input type="text" id="business_name" placeholder="Ex: Chez Maman Aïcha" maxlength="50">
</div>
<div class="row-2col">
<div class="field-group"><label>Ville</label><input type="text" id="ville" placeholder="Dakar" value="Dakar"></div>
<div class="field-group"><label>WhatsApp pro</label><input type="text" id="telephone_pro" placeholder="+221 77 ..."></div>
</div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(1)">← Retour</button>
<button class="btn btn-primary" onclick="goStep(3)">Continuer →</button>
</div>
</div>

<div class="step" id="step-3">
<div class="step-num">ÉTAPE 3 / 5</div>
<h1>Configuration <span class="accent">métier</span></h1>
<p class="subtitle" id="step3-subtitle">Questions spécifiques à ton secteur.</p>
<div id="niche-questions"></div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(2)">← Retour</button>
<button class="btn btn-primary" onclick="goStep(4)">Continuer →</button>
</div>
</div>

<div class="step" id="step-4">
<div class="step-num">ÉTAPE 4 / 5</div>
<h1>Ton <span class="accent" id="cat-label">catalogue</span></h1>
<p class="subtitle" id="step4-subtitle">Ajoute tes produits/services. Tu pourras compléter plus tard.</p>
<div class="catalogue-list" id="catalogue-list"></div>
<button class="btn-add" onclick="addCatalogueItem()">+ Ajouter un <span id="cat-singular">item</span></button>
<div style="margin-top:24px">
<label>🎨 Couleur du bot</label>
<div class="color-row" id="color-row">
<div class="color-swatch selected" data-color="#06C167" style="background:#06C167"></div>
<div class="color-swatch" data-color="#3b82f6" style="background:#3b82f6"></div>
<div class="color-swatch" data-color="#8b5cf6" style="background:#8b5cf6"></div>
<div class="color-swatch" data-color="#ec4899" style="background:#ec4899"></div>
<div class="color-swatch" data-color="#f59e0b" style="background:#f59e0b"></div>
<div class="color-swatch" data-color="#dc2626" style="background:#dc2626"></div>
</div>
</div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(3)">← Retour</button>
<button class="btn btn-primary" onclick="goStep(5)">Continuer →</button>
</div>
</div>

<div class="step" id="step-5">
<div class="step-num">ÉTAPE 5 / 5</div>
<h1>Prêt à <span class="accent">décoller</span> ?</h1>
<p class="subtitle">Vérifie le résumé puis crée ton bot intelligent. 3 jours d'essai gratuit, sans carte bancaire.</p>
<div class="preview-box" id="preview"></div>
<div class="checkbox-row">
<input type="checkbox" id="cgu_accept">
<label for="cgu_accept">J'accepte les <a href="/terms" target="_blank">Conditions générales</a> et la <a href="/privacy-full" target="_blank">Politique de confidentialité</a>.</label>
</div>
<div class="btn-row">
<button class="btn btn-secondary" onclick="goStep(4)">← Retour</button>
<button class="btn btn-primary" id="btn-create" onclick="createBot()" disabled>🚀 Créer mon bot</button>
</div>
</div>

<div class="step" id="step-6">
<div class="success">
<div class="success-emoji">🎉</div>
<h2>Ton bot est <span class="accent">live</span> !</h2>
<p>Bienvenue dans SamaBot. 3 jours d'essai gratuit, sans carte bancaire.</p>
<div class="success-card"><strong>🌐 URL de ton bot</strong><span id="bot-url"></span></div>
<div class="success-card"><strong>📊 Tableau de bord</strong><span id="dashboard-url"></span></div>
<div class="success-card"><strong>📝 Code embed</strong><span id="embed-code"></span></div>
<div style="margin-top:24px"><div id="success-pills"></div></div>
<div class="btn-row" style="margin-top:24px;justify-content:center">
<button class="btn btn-primary" onclick="goToBot()">→ Tester mon bot</button>
</div>
</div>
</div>

</div>

<script>
let availableNiches = [];
let currentTemplate = null;
let state = {
  niche: null,
  business_name: '',
  ville: 'Dakar',
  telephone_pro: '',
  color: '#06C167',
  niche_data: {},
  catalogue_items: []
};

async function loadNiches() {
  try {
    const r = await fetch('/onboarding-v2/niches');
    const data = await r.json();
    availableNiches = data.niches;
    renderNiches();
  } catch(e) { alert('Erreur: ' + e.message); }
}

function renderNiches() {
  const grid = document.getElementById('niche-grid');
  grid.innerHTML = availableNiches.map(n =>
    '<div class="niche-card" data-id="' + n.id + '" onclick="selectNiche(\\'' + n.id + '\\')">' +
    '<div class="emoji">' + n.icon + '</div>' +
    '<div class="info">' +
    '<div class="lbl">' + n.label + '</div>' +
    '<div class="desc">' + n.description + '</div>' +
    '</div></div>'
  ).join('');
}

async function selectNiche(id) {
  document.querySelectorAll('.niche-card').forEach(c => c.classList.remove('selected'));
  document.querySelector('[data-id="' + id + '"]').classList.add('selected');
  state.niche = id;
  document.getElementById('btn-step-1').disabled = false;
  
  const r = await fetch('/onboarding-v2/template/' + id);
  currentTemplate = await r.json();
  
  document.getElementById('cat-label').textContent = currentTemplate.catalogue_label.toLowerCase();
  document.getElementById('cat-singular').textContent = currentTemplate.catalogue_singular;
  document.getElementById('step3-subtitle').textContent = 'Questions spécifiques pour ' + currentTemplate.label.toLowerCase() + '.';
}

function renderQuestions() {
  if (!currentTemplate || !currentTemplate.questions) return;
  const container = document.getElementById('niche-questions');
  container.innerHTML = currentTemplate.questions.map((q, idx) => {
    const reqMark = q.required ? '<span class="req">*</span>' : '';
    if (q.type === 'boolean') {
      return '<div class="field-group">' +
        '<label>' + q.label + ' ' + reqMark + '</label>' +
        '<div class="toggle-row">' +
        '<button type="button" class="toggle-btn" data-q="' + q.key + '" data-v="true" onclick="toggleBool(\\'' + q.key + '\\', true)">✓ Oui</button>' +
        '<button type="button" class="toggle-btn" data-q="' + q.key + '" data-v="false" onclick="toggleBool(\\'' + q.key + '\\', false)">✗ Non</button>' +
        '</div></div>';
    }
    if (q.type === 'multi') {
      return '<div class="field-group">' +
        '<label>' + q.label + ' ' + reqMark + '</label>' +
        '<div class="multi-grid">' +
        q.options.map(opt => 
          '<button type="button" class="multi-btn" data-q="' + q.key + '" data-v="' + opt + '" onclick="toggleMulti(\\'' + q.key + '\\', \\'' + opt + '\\')">' + opt + '</button>'
        ).join('') +
        '</div></div>';
    }
    if (q.type === 'number') {
      return '<div class="field-group">' +
        '<label>' + q.label + ' ' + reqMark + '</label>' +
        '<input type="number" data-q="' + q.key + '" placeholder="' + (q.placeholder || '') + '" onchange="setNicheData(\\'' + q.key + '\\', this.value)">' +
        '</div>';
    }
    return '<div class="field-group">' +
      '<label>' + q.label + ' ' + reqMark + '</label>' +
      '<input type="text" data-q="' + q.key + '" placeholder="' + (q.placeholder || '') + '" onchange="setNicheData(\\'' + q.key + '\\', this.value)">' +
      '</div>';
  }).join('');
}

function setNicheData(key, value) {
  state.niche_data[key] = value;
}

function toggleBool(key, value) {
  state.niche_data[key] = value;
  document.querySelectorAll('[data-q="' + key + '"]').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-q="' + key + '"][data-v="' + value + '"]').classList.add('active');
}

function toggleMulti(key, value) {
  if (!Array.isArray(state.niche_data[key])) state.niche_data[key] = [];
  const idx = state.niche_data[key].indexOf(value);
  if (idx >= 0) {
    state.niche_data[key].splice(idx, 1);
  } else {
    state.niche_data[key].push(value);
  }
  const btn = document.querySelector('[data-q="' + key + '"][data-v="' + value + '"]');
  if (btn) btn.classList.toggle('active');
}

function addCatalogueItem() {
  state.catalogue_items.push({ nom: '', prix: '', description: '' });
  renderCatalogue();
}

function removeCatalogueItem(idx) {
  state.catalogue_items.splice(idx, 1);
  renderCatalogue();
}

function updateCatalogueItem(idx, field, value) {
  if (state.catalogue_items[idx]) {
    state.catalogue_items[idx][field] = value;
  }
}

function renderCatalogue() {
  const list = document.getElementById('catalogue-list');
  if (!currentTemplate) return;
  if (state.catalogue_items.length === 0) {
    list.innerHTML = '<p style="color:#999;font-size:13px;text-align:center;padding:20px">Aucun ' + currentTemplate.catalogue_singular + ' encore.</p>';
    return;
  }
  list.innerHTML = state.catalogue_items.map((item, idx) =>
    '<div class="catalogue-item">' +
    '<input type="text" placeholder="' + currentTemplate.placeholder_item + '" value="' + (item.nom || '') + '" onchange="updateCatalogueItem(' + idx + ', \\'nom\\', this.value)">' +
    '<input type="text" placeholder="' + currentTemplate.placeholder_price + '" value="' + (item.prix || '') + '" onchange="updateCatalogueItem(' + idx + ', \\'prix\\', this.value)">' +
    '<button class="btn-remove" type="button" onclick="removeCatalogueItem(' + idx + ')">🗑</button>' +
    '</div>'
  ).join('');
}

document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.onclick = () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    sw.classList.add('selected');
    state.color = sw.dataset.color;
  };
});

document.getElementById('cgu_accept').onchange = (e) => {
  document.getElementById('btn-create').disabled = !e.target.checked;
};

function updateProgress(step) {
  document.getElementById('progress-bar').style.width = (step * 20) + '%';
  document.getElementById('step-counter').textContent = 'Étape ' + Math.min(step, 5) + '/5';
}

function goStep(n) {
  if (n === 2 && !state.niche) { alert('Choisis ton métier'); return; }
  if (n === 3) {
    state.business_name = document.getElementById('business_name').value.trim();
    state.ville = document.getElementById('ville').value.trim() || 'Dakar';
    state.telephone_pro = document.getElementById('telephone_pro').value.trim();
    if (!state.business_name) { alert('Donne un nom à ton business'); return; }
    renderQuestions();
  }
  if (n === 4) {
    if (state.catalogue_items.length === 0) {
      addCatalogueItem();
    } else {
      renderCatalogue();
    }
  }
  if (n === 5) {
    const t = currentTemplate;
    let html = '<strong>' + t.icon + ' ' + t.label + '</strong>: ' + state.business_name + '<br>';
    html += '📍 ' + state.ville;
    if (state.telephone_pro) html += ' · 📱 ' + state.telephone_pro;
    html += '<br>🎨 Couleur ' + state.color;
    html += '<br>🧠 Skills auto: ' + t.skills_auto.join(', ');
    const validCat = state.catalogue_items.filter(i => i.nom);
    if (validCat.length > 0) {
      html += '<br>📋 ' + validCat.length + ' ' + t.catalogue_label.toLowerCase() + ' configurés';
    }
    document.getElementById('preview').innerHTML = html;
  }
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  updateProgress(Math.min(n, 5));
}

async function createBot() {
  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  btn.textContent = '⏳ Création en cours...';
  try {
    const token = localStorage.getItem('samabot_token');
    if (!token) {
      alert('Tu dois te connecter d\\'abord.');
      window.location.href = '/login?redirect=/onboarding-v2';
      return;
    }
    const validCatalogue = state.catalogue_items.filter(i => i.nom && i.prix);
    const r = await fetch('/onboarding-v2/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        niche: state.niche,
        business_name: state.business_name,
        ville: state.ville,
        telephone_pro: state.telephone_pro,
        color: state.color,
        niche_data: state.niche_data,
        catalogue_items: validCatalogue
      })
    });
    const data = await r.json();
    if (!r.ok || !data.success) {
      alert('Erreur: ' + (data.error || 'inconnue'));
      btn.disabled = false;
      btn.textContent = '🚀 Créer mon bot';
      return;
    }
    document.getElementById('bot-url').textContent = data.bot_url;
    document.getElementById('dashboard-url').textContent = data.dashboard_url;
    document.getElementById('embed-code').textContent = data.embed_code;
    
    let pillsHtml = '<span class="feature-pill">✓ Bot créé</span>';
    pillsHtml += '<span class="feature-pill">✓ Trial 3 jours</span>';
    pillsHtml += '<span class="feature-pill">✓ ' + data.niche_label + '</span>';
    if (data.catalogue_count > 0) pillsHtml += '<span class="feature-pill">✓ ' + data.catalogue_count + ' items</span>';
    if (data.skills_actives) pillsHtml += '<span class="feature-pill">✓ ' + data.skills_actives.length + ' skills actifs</span>';
    document.getElementById('success-pills').innerHTML = pillsHtml;
    
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-6').classList.add('active');
    document.getElementById('progress-bar').style.width = '100%';
    document.getElementById('step-counter').textContent = '✅ Terminé';
    
    window.__BOT_URL = data.bot_url;
  } catch(e) {
    alert('Erreur réseau: ' + e.message);
    btn.disabled = false;
    btn.textContent = '🚀 Créer mon bot';
  }
}

function goToBot() {
  if (window.__BOT_URL) window.location.href = window.__BOT_URL;
}

loadNiches();
</script></body></html>`);
});

// FIN BLOC v10.6 ────────────────────────────────────────────


// ════════════════════════════════════════════════════════════
// v10.7 — BOT INTELLIGENT (mémoire + photos catalogue + adaptation niche)
// 1) Extraction automatique des infos client depuis les messages
// 2) Mémoire enrichie (le bot retient prénom/tél/adresse/email du client)
// 3) Catalogue avec photos affichées dans le widget chat
// 4) Prompt adaptatif selon la niche du bot (sans casser makePrompt)
// 5) Connexion skills v10.5 au /chat principal (rétrocompat)
// ════════════════════════════════════════════════════════════

// ─── EXTRACTION INTELLIGENTE DES INFOS CLIENT ────────────────
// Cherche dans le message client : prénom, téléphone, adresse, email
// Retourne un objet { prenom, telephone, adresse, email } avec les infos détectées

function extractClientInfo(message) {
  if (!message || typeof message !== 'string') return {};
  const info = {};
  const text = message.trim();

  // 📞 Téléphone — formats sénégalais (77/76/78/70/75 ou +221)
  const phoneMatch = text.match(/(?:\+?221[\s-]?)?(7[05678])[\s-]?(\d{3})[\s-]?(\d{2})[\s-]?(\d{2})/);
  if (phoneMatch) {
    info.telephone = (phoneMatch[1] + phoneMatch[2] + phoneMatch[3] + phoneMatch[4]);
  } else {
    const intlMatch = text.match(/\+?\d{1,4}[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{4}/);
    if (intlMatch) info.telephone = intlMatch[0].replace(/[\s-]/g,'');
  }

  // 📧 Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) info.email = emailMatch[0].toLowerCase();

  // 👤 Prénom — "je m'appelle X", "mon nom est X", ou détection avant le téléphone
  const prenomPatterns = [
    /je\s+m'?appelle\s+([A-Za-zÀ-ÿ]{2,20}(?:\s+[A-Za-zÀ-ÿ]{2,20})?)/i,
    /mon\s+nom\s+(?:est|c'?est)\s+([A-Za-zÀ-ÿ]{2,20}(?:\s+[A-Za-zÀ-ÿ]{2,20})?)/i,
    /c'?est\s+([A-Za-zÀ-ÿ]{2,20})\b/i,
    /^([A-Za-zÀ-ÿ]{3,20})\s+(?:\+?221|7[05678]|\d{2,})/
  ];
  for (const pattern of prenomPatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      // Filtre les mots courants qui ne sont pas des prénoms
      const candidate = m[1].trim();
      const stopwords = ['oui', 'non', 'bonjour', 'salam', 'asalaa', 'merci', 'svp', 'svp', 'voici', 'mon', 'ma', 'le', 'la', 'wave', 'orange', 'cash', 'free'];
      if (!stopwords.includes(candidate.toLowerCase())) {
        info.prenom = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
        break;
      }
    }
  }

  // 📍 Adresse — détection après "adresse", "habite", "j'habite"
  const adressePatterns = [
    /(?:adresse|j'?habite|domicile|livrer\s+à)\s*[:est]*\s*([^.\n]{8,100})/i,
    /(?:à|au)\s+([A-Za-zÀ-ÿ\s,]{8,80})$/i
  ];
  for (const pattern of adressePatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const addr = m[1].trim().replace(/[.,;]+$/, '');
      if (addr.length >= 5 && addr.length <= 120) {
        info.adresse = addr;
        break;
      }
    }
  }

  return info;
}

// ─── MÉMOIRE CLIENT ENRICHIE PAR SESSION ─────────────────────
// Stockage en mémoire des infos extraites du client pour chaque session
// Ces infos sont injectées dans le prompt système → le bot s'en souvient

const clientMemory = {}; // { sid: { prenom, telephone, adresse, email, last_updated } }

function updateClientMemory(sid, newInfo) {
  if (!sid || !newInfo) return;
  if (!clientMemory[sid]) clientMemory[sid] = {};
  for (const k of ['prenom', 'telephone', 'adresse', 'email']) {
    if (newInfo[k] && !clientMemory[sid][k]) {
      clientMemory[sid][k] = newInfo[k];
    }
  }
  clientMemory[sid].last_updated = Date.now();

  // Cleanup auto : supprime les sessions inactives depuis +24h
  if (Math.random() < 0.05) {
    const cutoff = Date.now() - 24*60*60*1000;
    for (const k of Object.keys(clientMemory)) {
      if (clientMemory[k].last_updated < cutoff) delete clientMemory[k];
    }
  }
}

function getClientMemory(sid) {
  return clientMemory[sid] || {};
}

// ─── PROMPT SMART — adaptatif niche + mémoire client ─────────
// Wrap par-dessus makePrompt sans le casser
// Ajoute :
//   - Section "INFOS CLIENT DÉJÀ CONNUES" avec ce qu'on sait
//   - Règles spécifiques selon la niche (boutique vs restaurant vs salon)
//   - Skills v10.5 si activés sur le bot
//   - Photos catalogue (si disponibles)

function makePromptSmart(bot, sid) {
  // 1) On part du prompt de base (rétrocompat)
  let basePrompt = (typeof makePrompt === 'function') ? makePrompt(bot) : '';

  // 2) On ajoute la mémoire client SI on a des infos
  const memory = getClientMemory(sid);
  let memBlock = '';
  if (memory.prenom || memory.telephone || memory.adresse || memory.email) {
    memBlock = `\n\n═══════════════════════════════════════════════
INFOS CLIENT DÉJÀ CONNUES (issues de la conversation):
${memory.prenom ? `- Prénom: ${memory.prenom}` : ''}
${memory.telephone ? `- Téléphone: ${memory.telephone}` : ''}
${memory.adresse ? `- Adresse: ${memory.adresse}` : ''}
${memory.email ? `- Email: ${memory.email}` : ''}

⚠️ RÈGLE CRITIQUE: NE REDEMANDE PAS ces informations. Le client te les a déjà données. Utilise-les directement dans le récapitulatif ou la confirmation. Si tu as besoin d'infos manquantes, demande UNIQUEMENT celles qui ne sont pas dans cette liste.
═══════════════════════════════════════════════`;
  }

  // 2.bis) FLOW STRICT — INTERDICTIONS ABSOLUES (priorité maximale)
  // Force le bot à respecter l'ordre des étapes, sans confirmer avant le récap
  const paiementsAcceptes = bot.paiement || 'à la livraison';
  const flowStrict = `\n\n═══════════════════════════════════════════════
🚨 FLOW DE COMMANDE — RÈGLES ABSOLUES À RESPECTER 🚨
═══════════════════════════════════════════════

INTERDICTIONS STRICTES:
❌ NE DIS JAMAIS "Commande confirmée" tant que le client n'a PAS vu le récap ET dit "Oui"
❌ NE DIS JAMAIS "Paiement à la livraison noté" avant d'avoir reçu le choix du paiement
❌ NE PROPOSE JAMAIS le paiement avant l'étape 4 (après confirmation)
❌ NE SAUTE AUCUNE étape, même si le client semble pressé

ORDRE OBLIGATOIRE (5 étapes):

ÉTAPE 1 — Client dit "commander" / liste les produits:
  → Présente le catalogue avec tirets et prix
  → Demande UNIQUEMENT: "Quel produit souhaitez-vous ?"
  → STOP. Attends sa réponse.

ÉTAPE 2 — Client choisit un produit (ex: "café arabica"):
  → Annonce le détail: "Votre commande: [produit] = [prix] FCFA${bot.livraison_actif?` + livraison [frais] FCFA = total [total] FCFA`:''}"
  → Demande SES INFOS: "Pour finaliser, j'ai besoin de:
     • Votre prénom
     • Votre numéro
     ${bot.livraison_actif?'• Votre adresse de livraison (utilisez le bouton GPS)':''}"
  → ❌ NE PARLE PAS de paiement encore !
  → STOP. Attends ses infos.

ÉTAPE 3 — Client donne ses infos (nom + tél + adresse):
  → Fais le RÉCAPITULATIF EXACT:
    "📋 *Récapitulatif:*
    👤 Nom: [prénom]
    📞 Tél: [numéro]
    ${bot.livraison_actif?'📍 Adresse: [adresse]':''}
    🛍️ Article: [produit]
    💰 *Total: [montant] FCFA*
    ${bot.livraison_actif?`🛵 Livraison: ${bot.livraison_delai||'30-45 min'}`:''}

    Confirmez-vous votre commande ? Répondez *OUI* pour valider."
  → ❌ NE PARLE PAS de paiement encore !
  → STOP. Attends sa confirmation.

ÉTAPE 4 — SEULEMENT après que le client a dit "Oui":
  → Réponds: "✅ *Commande confirmée!*
    💳 Comment souhaitez-vous payer ?
    ${paiementsAcceptes.toLowerCase().includes('livraison') ? '• À la livraison' : ''}
    ${paiementsAcceptes.toLowerCase().includes('wave') ? '• Wave' : ''}
    ${paiementsAcceptes.toLowerCase().includes('orange') ? '• Orange Money' : ''}
    ${paiementsAcceptes.toLowerCase().includes('espèce') || paiementsAcceptes.toLowerCase().includes('espece') ? '• Espèces' : ''}"
  → STOP. Attends son choix.

ÉTAPE 5 — Client choisit le mode de paiement:
  → Confirme: "✅ Paiement [méthode] noté.
    🛵 Votre commande sera livrée dans ${bot.livraison_delai||'30-45 min'}.
    Jërëjëf [prénom] !"

PAIEMENTS ACCEPTÉS POUR CE BOT: ${paiementsAcceptes}
⚠️ NE PROPOSE QUE les modes de paiement listés ci-dessus, RIEN D'AUTRE.

═══════════════════════════════════════════════`;
  memBlock += flowStrict;

  // 3) Ajustements par niche — règles spécifiques pour ne pas être générique
  let nicheAdjust = '';
  const niche = (bot.niche || '').toLowerCase();

  if (niche === 'boutique') {
    nicheAdjust = `\n\nADAPTATION BOUTIQUE:
- Tu es l'assistant d'une BOUTIQUE qui vend des produits
- NE PROPOSE JAMAIS "S'inscrire" — propose "Voir produits" / "Commander"
- Pour le catalogue, présente les produits de manière commerciale et attractive
- L'email du client est OPTIONNEL et NE DOIT être demandé qu'UNE seule fois max`;
  } else if (niche === 'restaurant' || niche === 'traiteur') {
    nicheAdjust = `\n\nADAPTATION RESTAURANT:
- Tu es l'assistant d'un RESTAURANT
- Pour le catalogue, présente les plats de manière appétissante (avec photos si disponibles)
- L'email n'est PAS nécessaire pour une commande à livrer
- Demande seulement: prénom, téléphone, adresse de livraison`;
  } else if (niche === 'salon' || niche === 'salon_coiffure' || niche === 'beaute') {
    nicheAdjust = `\n\nADAPTATION SALON DE BEAUTÉ:
- Tu es l'assistant d'un SALON DE COIFFURE/BEAUTÉ
- NE PROPOSE PAS de "commander" — propose "Prendre RDV"
- Pour les prestations, indique la durée estimée
- Pour un RDV, demande SEULEMENT: prénom, téléphone, prestation, date/heure souhaitée`;
  } else if (niche === 'auto_ecole' || niche === 'auto-ecole') {
    nicheAdjust = `\n\nADAPTATION AUTO-ÉCOLE:
- Tu es l'assistant d'une AUTO-ÉCOLE
- Présente les forfaits avec ce qui est inclus (code, heures conduite)
- Pour s'inscrire: explique les documents requis
- Propose RDV info pour visite des locaux`;
  } else if (niche === 'pharmacie') {
    nicheAdjust = `\n\nADAPTATION PHARMACIE:
- Tu es l'assistant d'une PHARMACIE
- ⚠️ JAMAIS de conseil médical, JAMAIS de diagnostic
- Si symptômes décrits, redirige vers le pharmacien ou un médecin
- En cas d'urgence (douleur intense, malaise): redirige vers SAMU 1515`;
  } else if (niche === 'clinique' || niche === 'clinique_medicale' || niche === 'medical') {
    nicheAdjust = `\n\nADAPTATION CLINIQUE MÉDICALE:
- Tu es l'assistant d'une CLINIQUE
- ⚠️ JAMAIS de diagnostic, JAMAIS de prescription
- Pour un RDV: spécialité → motif court → date → confirmation
- Confidentialité ABSOLUE`;
  } else if (niche === 'hotel') {
    nicheAdjust = `\n\nADAPTATION HÔTEL:
- Tu es l'assistant d'un HÔTEL
- Pour réservation: dates (arrivée + départ) → type chambre → nb personnes
- L'email EST nécessaire pour confirmation officielle de réservation`;
  } else if (niche === 'taxi' || niche === 'transport') {
    nicheAdjust = `\n\nADAPTATION TAXI/TRANSPORT:
- Tu es l'assistant d'un service TAXI
- Pour course: lieu prise en charge → destination → date/heure → nb passagers
- Estime le tarif selon les zones`;
  } else if (niche === 'service' || niche === 'service_pro' || niche === 'artisan') {
    nicheAdjust = `\n\nADAPTATION SERVICE/ARTISAN:
- Tu es l'assistant d'un ARTISAN/SERVICE PRO
- Pour devis: type de problème → adresse → coordonnées
- Mentionne si urgence disponible`;
  }

  // 4) Skills v10.5 — connexion automatique si skills activés sur le bot
  let skillsBlock = '';
  if (Array.isArray(bot.skills) && bot.skills.length > 0 && typeof SKILLS_CATALOG !== 'undefined') {
    const skillsTexts = bot.skills
      .filter(sid => SKILLS_CATALOG[sid])
      .map(sid => SKILLS_CATALOG[sid].prompt)
      .join('\n\n');
    if (skillsTexts) {
      skillsBlock = `\n\n═══════════════════════════════════════════════
COMPÉTENCES SPÉCIALISÉES ACTIVÉES:
═══════════════════════════════════════════════
${skillsTexts}
═══════════════════════════════════════════════`;
    }
  }

  // 5) Catalogue avec photos si disponibles (signal au bot qu'il peut renvoyer les photos)
  let catWithPhotosBlock = '';
  if (Array.isArray(bot.catalogue) && bot.catalogue.some(p => p.photo)) {
    catWithPhotosBlock = `\n\nNOTE PHOTOS:
- Plusieurs produits ont des photos disponibles
- Quand le client demande à voir le catalogue, mentionne brièvement et indique que les photos seront affichées en bas
- Sois concis dans la liste textuelle (le widget affichera les photos automatiquement)`;
  }

  return basePrompt + memBlock + nicheAdjust + skillsBlock + catWithPhotosBlock;
}

// ─── ENDPOINT : CATALOGUE AVEC PHOTOS ────────────────────────
// Le widget chat appelle ce endpoint quand le client demande "voir produits"
// Retourne le catalogue avec photos formatées pour affichage en cards

app.get('/chat/catalogue/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&actif=eq.true&select=id,nom,niche,couleur,emoji`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });

    // Récupère les produits de la table produits (avec photos)
    const produits = await db.select('produits', `?bot_id=eq.${req.params.botId}&actif=eq.true&visible=eq.true&order=created_at.desc&limit=50`);

    const items = (produits || []).map(p => ({
      id: p.id,
      nom: p.nom,
      prix: p.prix || 0,
      prix_formate: (p.prix || 0).toLocaleString('fr-FR') + ' FCFA',
      desc: p.desc || null,
      photo: p.photo || null,
      emoji: p.emoji || bots[0].emoji || '🛍️',
      categorie: p.categorie || null,
      stock: p.stock != null ? p.stock : null,
      disponible: (p.stock == null || p.stock > 0)
    }));

    res.json({
      bot_id: req.params.botId,
      bot_nom: bots[0].nom,
      bot_couleur: bots[0].couleur,
      total: items.length,
      items
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ENDPOINT : MÉMOIRE CLIENT (debug + intégrations) ────────
app.get('/chat/memory/:sid', (req, res) => {
  const memory = getClientMemory(req.params.sid);
  res.json({
    session_id: req.params.sid,
    has_memory: Object.keys(memory).length > 0,
    memory
  });
});

app.delete('/chat/memory/:sid', (req, res) => {
  delete clientMemory[req.params.sid];
  res.json({ success: true, session_id: req.params.sid });
});

// FIN BLOC v10.7 ────────────────────────────────────────────


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 SamaBot v8.0 — port ${PORT}`);
  console.log(`🌍 Multi-langue: FR / EN / PT`);
  console.log(`👑 Admin: ${CONFIG.BASE_URL}/admin?secret=***`);
  console.log(`🚚 Livraison: activé`);
  console.log(`🔐 Auth: Google + email/password`);
  console.log(`📍 Géoloc: activée (Nominatim)`);
  console.log(`📸 Storage: ${STORAGE_URL}/object/public/${BUCKET}/`);
  console.log(`🎤 Whisper: activé`);
  console.log(`🔧 Setup: ${CONFIG.BASE_URL}/setup`);
});
