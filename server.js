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
};

const STORAGE_URL = `${CONFIG.SUPABASE_URL}/storage/v1`;
const BUCKET = 'samabot-media';

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
const sessions = {};
function getHist(sid) { if(!sessions[sid]) sessions[sid]=[]; return sessions[sid]; }
function addHist(sid, role, content) { const h=getHist(sid); h.push({role,content}); if(h.length>14) h.shift(); }

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

async function callAI(prompt, sid, message, retries=2) {
  addHist(sid, 'user', message);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${CONFIG.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role:'system', content:prompt }, ...getHist(sid)],
        max_tokens: 400, temperature: 0.7
      })
    });
    const data = await res.json();
    if (!data.choices?.[0]) throw new Error('No response');
    const reply = data.choices[0].message.content;
    addHist(sid, 'assistant', reply);
    return reply;
  } catch(err) {
    if (retries > 0) { await new Promise(r=>setTimeout(r,1200)); return callAI(prompt,sid,message,retries-1); }
    throw err;
  }
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
    const sid = sessionId || `${botId}_${Date.now()}`;
    const intents = detectIntent(message, bot);

    const reply = await callAI(bot.prompt, sid, message);

    // Extrait le total si commande
    let orderTotal = 0;
    const totalMatch = reply.match(/total\s*[:\-]?\s*([0-9][0-9\s]*)\s*f?cfa/i) ||
                       reply.match(/([0-9][0-9\s]{2,})\s*f?cfa/i);
    if (totalMatch && (intents.includes('order')||intents.includes('payment'))) {
      orderTotal = parseInt(totalMatch[1].replace(/\s/g,'')) || 0;
    }

    if (orderTotal > 0) intents.push('payment');

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
    db.insert('audio_messages', { bot_id:botId, session_id:sid, transcription, langue_detectee:detectLang(transcription) }).catch(()=>{});

    // Réponse IA
    const intents = detectIntent(transcription, bot);
    const reply = await callAI(bot.prompt, sid, transcription);

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
    await db.update('commandes', { statut:req.body.statut, updated_at:new Date().toISOString() }, `?id=eq.${req.params.id}`);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// AVIS
// ============================================
app.post('/avis', async (req, res) => {
  try {
    const { botId, sessionId, note, commentaire } = req.body;
    await db.insert('avis', { bot_id:botId, session_id:sessionId, note, commentaire:commentaire||null });
    const allAvis = await db.select('avis', `?bot_id=eq.${botId}&select=note`);
    if (allAvis?.length) {
      const avg = allAvis.reduce((s,a)=>s+a.note,0)/allAvis.length;
      await db.update('bots', { avg_rating:parseFloat(avg.toFixed(2)) }, `?id=eq.${botId}`);
    }
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// NOTIFICATIONS
// ============================================
async function notifyPatron(botId, commande) {
  const bots = await db.select('bots', `?id=eq.${botId}&select=nom,notifications_phone`);
  const bot = bots?.[0];
  if (!bot) return;
  console.log(`🔔 Commande ${commande.numero} — ${bot.nom} — ${commande.total} FCFA`);
}

// ============================================
// SAUVEGARDE MESSAGES
// ============================================
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
  } catch(e) { console.error('saveMsg:', e.message); }
}

// ============================================
// HELPERS
// ============================================
function getEmoji(n) {
  return {restaurant:'🍽️',salon:'💈',clinique:'🏥',boutique:'🛍️','auto-ecole':'🚗',pharmacie:'💊',immobilier:'🏠',traiteur:'🍲',boulangerie:'🥖',default:'🤖'}[n]||'🤖';
}
function getQR(n) {
  return {
    restaurant:['🍛 Voir le menu','📦 Commander','🛵 Livraison','📍 Adresse','🕐 Horaires'],
    salon:['📅 Prendre RDV','💅 Services','💰 Tarifs','📍 Adresse','📞 Nous appeler'],
    clinique:['🚨 Urgence','📅 RDV médecin','👨‍⚕️ Médecins','💰 Tarifs','📍 Adresse'],
    boutique:['✨ Nouveautés','🔥 Promotions','📦 Commander','🚚 Livraison','📍 Adresse'],
    'auto-ecole':['📝 S\'inscrire','💰 Tarifs','📅 Calendrier','📍 Adresse'],
    pharmacie:['💊 Médicament','🕐 Horaires','📍 Adresse','📞 Urgence'],
  }[n]||['💬 Aide','ℹ️ Infos','📍 Adresse','📞 Contact'];
}
function makePrompt(bot) {
  const cat = bot.catalogue?.length ? `\nCATALOGUE:\n${bot.catalogue.map(p=>`- ${p.nom}: ${p.prix} FCFA${p.desc?' ('+p.desc+')':''}`).join('\n')}` : '';
  return `Tu es l'assistant IA officiel de "${bot.nom}" à Dakar, Sénégal.
Tu parles français et wolof naturellement. Réponds toujours dans la même langue que le client.
Tu es chaleureux, professionnel et très utile. Réponds en 2-3 phrases max.

INFOS:
- Nom: ${bot.nom} | Secteur: ${bot.niche}
${bot.adresse?`- Adresse: ${bot.adresse}`:''}
${bot.horaires?`- Horaires: ${bot.horaires}`:''}
${bot.telephone?`- Téléphone: ${bot.telephone}`:''}
${bot.services?`- Services: ${bot.services}`:''}
${bot.paiement?`- Paiement: ${bot.paiement}`:'- Paiement: Wave, Orange Money, espèces'}
${cat}

RÈGLES:
- Adresse → mentionne que le lien Maps apparaît ci-dessous
- Téléphone → mentionne le bouton d'appel ci-dessous
- Commande → récapitule AVEC le total exact en FCFA (ex: "Total: 3 000 FCFA")
- Message vocal → réponds naturellement comme si c'était du texte
- Toujours proposer de l'aide supplémentaire`;
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
    res.json({
      nom:b.nom, emoji:b.emoji, couleur:b.couleur, niche:b.niche,
      logo:b.logo_url||null, adresse:b.adresse, telephone:b.telephone,
      horaires:b.horaires, wave_number:b.wave_number, om_number:b.om_number,
      catalogue:b.catalogue||[],
      welcome: b.custom_welcome || `Asalaa maalekum! 👋 Bienvenue chez *${b.nom}*.\n\nComment puis-je vous aider aujourd'hui?`,
      quickReplies: getQR(b.niche),
      voiceEnabled: true
    });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// CRÉER UN BOT
// ============================================
app.post('/bot/create', async (req, res) => {
  try {
    const { nom, niche, adresse, horaires, services, telephone, paiement, maps_url,
            wave_number, om_number, couleur, email, logo_url, catalogue,
            notifications_phone, custom_welcome } = req.body;
    if (!nom||!niche) return res.status(400).json({ error:'nom et niche requis' });

    const id = makeBotId(nom);
    const botData = {
      id, nom, niche, couleur:couleur||'#00c875', emoji:getEmoji(niche), actif:true,
      adresse:adresse||null, horaires:horaires||null, services:services||null,
      telephone:telephone||null, paiement:paiement||'Wave, Orange Money, espèces',
      maps_url:maps_url||null, wave_number:wave_number||null, om_number:om_number||null,
      logo_url:logo_url||null, catalogue:catalogue||[],
      notifications_phone:notifications_phone||null, custom_welcome:custom_welcome||null,
      user_id:'00000000-0000-0000-0000-000000000001'
    };
    botData.prompt = makePrompt(botData);

    if (email) {
      const ex = await db.select('users', `?email=eq.${email}`);
      if (!ex?.length) {
        const nu = await db.insert('users', { email, nom:nom+' (owner)', plan:'starter' });
        if (nu?.[0]?.id) botData.user_id = nu[0].id;
      } else botData.user_id = ex[0].id;
    }

    await db.insert('bots', botData);
    console.log(`✅ Bot créé: ${nom} (${id})`);

    const base = CONFIG.BASE_URL;
    res.json({
      success:true, botId:id,
      chatUrl:`${base}/chat/${id}`,
      dashUrl:`${base}/dashboard/${id}`,
      widgetCode:`<!-- SamaBot — ${nom} -->\n<script>\n  window.SamaBotConfig = { botId: '${id}', couleur: '${couleur||'#00c875'}' };\n</script>\n<script src="${base}/widget.js" async></script>`
    });
  } catch(e) { console.error('Create:', e); res.status(500).json({ error:e.message }); }
});

// ============================================
// DASHBOARD CLIENT
// ============================================
app.get('/dashboard/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}`);
    const bot = bots?.[0];
    if (!bot) return res.status(404).send('Bot non trouvé');

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
    const statusColors = {pending:'#f59e0b',paid:'#10b981',preparing:'#3b82f6',ready:'#8b5cf6',delivered:'#6b7280',cancelled:'#ef4444'};
    const statusLabels = {pending:'En attente',paid:'Payé ✅',preparing:'En prépa 👨‍🍳',ready:'Prêt ✅',delivered:'Livré 🛵',cancelled:'Annulé ❌'};

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${bot.nom} — Dashboard</title>
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
  <div class="live"><span class="live-dot"></span>En direct</div>
</div>

<div class="wrap">
  <div class="actions">
    <a class="btn btn-p" href="/chat/${bot.id}" target="_blank">💬 Chat</a>
    <button class="btn btn-g" onclick="copyLink()">🔗 Lien</button>
    <button class="btn btn-g" onclick="document.getElementById('wm').style.display='flex'">📋 Widget</button>
    <button class="btn btn-g" onclick="location.reload()">🔄</button>
  </div>

  ${cmdsPending>0?`<div class="alert">⚠️ ${cmdsPending} commande${cmdsPending>1?'s':''} en attente !</div>`:''}

  <div class="stats">
    <div class="stat"><div class="stat-val">${msgsToday}</div><div class="stat-lbl">Msgs aujourd'hui</div></div>
    <div class="stat"><div class="stat-val">${commandes?.length||0}</div><div class="stat-lbl">Commandes</div><div class="stat-sub">⏳ ${cmdsPending} en attente</div></div>
    <div class="stat"><div class="stat-val">${(revenuTotal/1000).toFixed(0)}K</div><div class="stat-lbl">FCFA revenus</div></div>
    <div class="stat"><div class="stat-val">${avgNote}${avgNote!=='—'?'⭐':''}</div><div class="stat-lbl">Note moy.</div><div class="stat-sub">${allAvis?.length||0} avis</div></div>
    <div class="stat"><div class="stat-val">${audioMsgs?.length||0}</div><div class="stat-lbl">Msgs vocaux</div><div class="stat-sub">🎤 Wolof/FR</div></div>
  </div>

  <div class="tab-btns">
    <button class="tab-btn active" onclick="showTab('cmd',this)">📦 Commandes (${commandes?.length||0})</button>
    <button class="tab-btn" onclick="showTab('msgs',this)">💬 Messages (${msgs?.length||0})</button>
    <button class="tab-btn" onclick="showTab('audio',this)">🎤 Vocaux (${audioMsgs?.length||0})</button>
    <button class="tab-btn" onclick="showTab('avis',this)">⭐ Avis (${allAvis?.length||0})</button>
    <button class="tab-btn" onclick="showTab('partage',this)">🔗 Partage</button>
  </div>

  <!-- COMMANDES -->
  <div id="tab-cmd" class="tab active">
    <div class="card">
      <div class="card-title">📦 Commandes récentes</div>
      ${commandes?.length?commandes.map(c=>`
        <div class="row">
          <div>
            <div class="row-main">${c.numero||'#'} ${c.client_nom?'— '+c.client_nom:''}</div>
            <div class="row-sub">${new Date(c.created_at).toLocaleString('fr-FR')}</div>
            ${c.adresse_livraison?`<div class="row-sub">📍 ${c.adresse_livraison}</div>`:''}
            ${c.methode_paiement?`<div class="row-sub">💳 ${c.methode_paiement}</div>`:''}
          </div>
          <div class="row-right">
            <div class="price">${(c.total||0).toLocaleString('fr-FR')} F</div>
            <span class="badge" style="background:${statusColors[c.statut]||'#ccc'}22;color:${statusColors[c.statut]||'#666'}">${statusLabels[c.statut]||c.statut}</span>
            <br><select onchange="updateStatut('${c.id}',this.value)">
              ${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}"${c.statut===k?' selected':''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>
      `).join(''):`<div class="empty">Aucune commande encore. Partagez votre lien de chat !</div>`}
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
      ${allAvis?.length?allAvis.map(a=>`
        <div class="row">
          <div>
            <div class="stars">${'⭐'.repeat(a.note)}${'☆'.repeat(5-a.note)}</div>
            ${a.commentaire?`<div class="msg-text" style="margin-top:4px">"${a.commentaire}"</div>`:''}
            <div class="msg-time">${new Date(a.created_at).toLocaleString('fr-FR')}</div>
          </div>
        </div>
      `).join(''):`<div class="empty">Aucun avis encore.</div>`}
    </div>
  </div>

  <!-- PARTAGE -->
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
          <div class="copy-area" id="wcode-inline">&lt;script&gt;window.SamaBotConfig={botId:'${bot.id}',couleur:'${bot.couleur}'}&lt;/script&gt;&lt;script src="${CONFIG.BASE_URL}/widget.js" async&gt;&lt;/script&gt;</div>
          <button class="cp" onclick="copyWidget()">📋 Copier widget</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- MODAL WIDGET -->
<div id="wm" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)this.style.display='none'">
  <div style="background:#fff;border-radius:16px;padding:22px;max-width:480px;width:100%">
    <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:14px">📋 Code widget</div>
    <div class="copy-area">&lt;script&gt;\n  window.SamaBotConfig = { botId: '${bot.id}', couleur: '${bot.couleur}' };\n&lt;/script&gt;\n&lt;script src="${CONFIG.BASE_URL}/widget.js" async&gt;&lt;/script&gt;</div>
    <button class="cp" onclick="copyWidget()">📋 Copier</button>
    <button onclick="document.getElementById('wm').style.display='none'" style="margin-left:10px;background:none;border:none;cursor:pointer;font-size:13px;color:#5a7060">Fermer</button>
  </div>
</div>

<script>
function showTab(id,btn){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active');}
function copyLink(){navigator.clipboard.writeText('${CONFIG.BASE_URL}/chat/${bot.id}').then(()=>alert('✅ Lien copié!'));}
function copyWidget(){navigator.clipboard.writeText('<script>\\nwindow.SamaBotConfig={botId:\\'${bot.id}\\',couleur:\\'${bot.couleur}\\'};\\n<\\/script>\\n<script src="${CONFIG.BASE_URL}/widget.js" async><\\/script>').then(()=>alert('✅ Code copié!'));}
async function updateStatut(id,s){await fetch('/commande/'+id+'/statut',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut:s})});setTimeout(()=>location.reload(),500);}
setTimeout(()=>location.reload(),60000);
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
.cat-items{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.cat-item{display:grid;grid-template-columns:1fr 80px 80px auto;gap:6px;align-items:center}
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

  <!-- 3 -->
  <div class="card">
    <div class="ctitle"><span class="num">3</span> Catalogue & Services</div>
    <div class="f"><label>Description générale</label><textarea id="srv" placeholder="Décrivez vos services..."></textarea></div>
    <div class="f">
      <label>Articles du catalogue</label>
      <div style="font-size:11px;color:#9ab0a0;margin-bottom:6px">Nom • Prix • Description (optionnel)</div>
      <div class="cat-items" id="cat-items">
        <div class="cat-item">
          <input placeholder="Nom de l'article" class="cat-nom"/>
          <input placeholder="Prix F" class="cat-prix" type="number" min="0"/>
          <input placeholder="Desc." class="cat-desc"/>
          <button class="rm" onclick="this.closest('.cat-item').remove()">✕</button>
        </div>
      </div>
      <div class="add-cat" onclick="addItem()">+ Ajouter un article</div>
    </div>
  </div>

  <!-- 4 -->
  <div class="card">
    <div class="ctitle"><span class="num">4</span> Paiement</div>
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
    <div class="ctitle"><span class="num">5</span> Notifications & Design</div>
    <div class="row2">
      <div class="f"><label>WhatsApp notifs commandes</label><input id="notif" placeholder="+221 77 xxx xxxx"/></div>
      <div class="f"><label>Email</label><input id="eml" type="email" placeholder="votre@email.com"/></div>
    </div>
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

function selN(e){document.querySelectorAll('.n').forEach(x=>x.classList.remove('s'));e.classList.add('s');nv=e.dataset.val;}
function selC(e){document.querySelectorAll('.co').forEach(x=>x.classList.remove('s'));e.classList.add('s');cv=e.dataset.val;}
function tPay(e){e.classList.toggle('s');payOpts=Array.from(document.querySelectorAll('.pay-opt.s')).map(x=>x.dataset.val);}

function addItem(){
  var d=document.createElement('div');d.className='cat-item';
  d.innerHTML='<input placeholder="Nom" class="cat-nom"/><input placeholder="Prix F" class="cat-prix" type="number" min="0"/><input placeholder="Desc." class="cat-desc"/><button class="rm" onclick="this.closest(\\'.cat-item\\').remove()">✕</button>';
  document.getElementById('cat-items').appendChild(d);
}

function getCat(){
  return Array.from(document.querySelectorAll('.cat-item')).map(i=>{
    var n=i.querySelector('.cat-nom')?.value?.trim();
    var p=i.querySelector('.cat-prix')?.value;
    var d=i.querySelector('.cat-desc')?.value?.trim();
    return n&&p?{nom:n,prix:parseInt(p),desc:d||'',emoji:'🛍️'}:null;
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
      email:document.getElementById('eml').value,
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
.catalogue{display:flex;gap:8px;padding:6px 12px;overflow-x:auto;scrollbar-width:none;border-top:1px solid #e5e7eb}
.catalogue::-webkit-scrollbar{display:none}
.cat-card{min-width:90px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px 6px;text-align:center;cursor:pointer;flex-shrink:0}
.cat-card:active{border-color:${bot.couleur}}
.cat-emoji{font-size:20px;display:block;margin-bottom:3px}
.cat-nom{font-size:11px;font-weight:600;color:#111;display:block}
.cat-prix{font-size:12px;font-weight:700;color:${bot.couleur};display:block;margin-top:1px}
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
  <div>
    <div class="hd-nm">${bot.nom}</div>
    <div class="hd-st"><span class="hd-dot"></span>En ligne — wolof & français 🎤</div>
  </div>
  <a href="/dashboard/${bot.id}" class="hd-dash" target="_blank">📊</a>
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
var sid='p_'+Math.random().toString(36).substr(2,9);
var botId='${req.params.botId}';
var logoSrc='${bot.logo_url||''}';
var botEmoji='${bot.emoji}';
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
    if(a.type==='share'){var b=document.createElement('button');b.className='act act-share';b.textContent=a.label;b.onclick=function(){if(navigator.share)navigator.share({title:'${bot.nom}',url:window.location.href});else{navigator.clipboard.writeText(window.location.href);alert('✅ Lien copié!');}};el.appendChild(b);return;}
    if(a.type==='cash'){var b=document.createElement('button');b.className='act act-cash';b.textContent=a.label;b.onclick=function(){addMsg('✅ Paiement à la livraison noté! Votre commande est confirmée.',false);el.innerHTML='';};el.appendChild(b);return;}
    if(!a.url&&a.type==='hours'){var s=document.createElement('span');s.className='act act-hours';s.textContent=a.label;el.appendChild(s);return;}
    if(a.url){var l=document.createElement('a');l.className='act act-'+a.type;l.textContent=a.label;l.href=a.url;l.target='_blank';l.rel='noopener';el.appendChild(l);}
  });
}

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
    c.innerHTML='<span class="cat-emoji">'+(item.emoji||'🛍️')+'</span><span class="cat-nom">'+item.nom+'</span><span class="cat-prix">'+item.prix.toLocaleString('fr-FR')+' F</span>';
    c.onclick=function(){send('Je veux commander '+item.nom);};
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
  })
  .catch(()=>{var ty=document.getElementById('typing');if(ty)ty.remove();addMsg('Désolé, erreur. Réessayez.',false);});
}
</script>
</body>
</html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});

// ============================================
// ADMIN
// ============================================
app.get('/admin/stats', async (req, res) => {
  try {
    const [bots, users, msgs, commandes, audio] = await Promise.all([
      db.select('bots','?actif=eq.true&order=created_at.desc'),
      db.select('users','?order=created_at.desc'),
      db.select('messages','?order=created_at.desc&limit=20'),
      db.select('commandes','?order=created_at.desc&limit=50'),
      db.select('audio_messages','?order=created_at.desc&limit=20')
    ]);
    const msgsToday = msgs?.filter(m=>new Date(m.created_at)>new Date(Date.now()-86400000)).length||0;
    const revenu = commandes?.filter(c=>c.statut==='paid').reduce((s,c)=>s+c.total,0)||0;
    res.json({ stats:{total_users:users?.length||0,total_bots:bots?.length||0,messages_today:msgsToday,total_revenue:revenu,total_audio:audio?.length||0}, bots:bots||[], users:users||[], recent_messages:msgs||[], commandes:commandes||[], audio_messages:audio||[] });
  } catch(e) { res.status(500).json({error:e.message}); }
});

app.get('/webhook', (req,res) => {
  if(req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===CONFIG.META_VERIFY_TOKEN)
    res.status(200).send(req.query['hub.challenge']);
  else res.sendStatus(403);
});
app.post('/webhook', (req,res) => res.sendStatus(200));

app.get('/', (req,res) => res.json({
  app:'🤖 SamaBot IA', version:'5.1', status:'active',
  features:['geolocalisation-gps','reverse-geocoding','upload-images-supabase','vocal-whisper-wolof','paiement-wave-om','logo-client','catalogue-photos','dashboard-5tabs','avis-clients','qr-code','commandes','widget-universel']
}));

app.get('/privacy', (req,res) => res.send('<html><body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px"><h1 style="color:#00c875">Politique de confidentialité — SamaBot</h1><p style="margin-top:16px;line-height:1.7">SamaBot collecte uniquement les messages nécessaires au fonctionnement du chatbot. Contact: gakououssou@gmail.com</p></body></html>'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 SamaBot v5.1 — port ${PORT}`);
  console.log(`📍 Géoloc: activée (Nominatim)`);
  console.log(`📸 Storage: ${STORAGE_URL}/object/public/${BUCKET}/`);
  console.log(`🎤 Whisper: activé`);
  console.log(`🔧 Setup: ${CONFIG.BASE_URL}/setup`);
});
