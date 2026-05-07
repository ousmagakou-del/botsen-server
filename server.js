const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));

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
  BASE_URL:             process.env.BASE_URL || 'https://botsen-server-production.up.railway.app',
};

// ============================================
// SUPABASE
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
  upsert: (t,d) => sb(t,'POST',d,'?on_conflict=id'),
  rpc: async (fn, params) => {
    const key = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method:'POST', headers:{'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`},
      body: JSON.stringify(params)
    });
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
};

// ============================================
// SESSIONS & OPENAI
// ============================================
const sessions = {};
function getHist(sid) { if(!sessions[sid]) sessions[sid]=[]; return sessions[sid]; }
function addHist(sid,role,content) { const h=getHist(sid); h.push({role,content}); if(h.length>14) h.shift(); }

async function callAI(prompt, sid, message, retries=2) {
  addHist(sid,'user',message);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${CONFIG.OPENAI_API_KEY}`},
      body: JSON.stringify({
        model:'gpt-4o-mini',
        messages:[{role:'system',content:prompt},...getHist(sid)],
        max_tokens:400, temperature:0.7
      })
    });
    const data = await res.json();
    if(!data.choices?.[0]) throw new Error('No AI response');
    const reply = data.choices[0].message.content;
    addHist(sid,'assistant',reply);
    return reply;
  } catch(err) {
    if(retries>0) { await new Promise(r=>setTimeout(r,1200)); return callAI(prompt,sid,message,retries-1); }
    throw err;
  }
}

// ============================================
// PAIEMENT — Wave & Orange Money via lien direct
// ============================================
function generatePaymentActions(bot, total, orderRef) {
  const actions = [];
  const totalStr = total.toLocaleString('fr-FR');

  // Wave — lien de paiement direct
  if (bot.wave_number) {
    const waveNum = bot.wave_number.replace(/[\s+]/g,'').replace(/^00/,'');
    const waveMsg = encodeURIComponent(`Paiement commande ${orderRef} - ${totalStr} FCFA - ${bot.nom}`);
    actions.push({
      type: 'wave',
      label: `💙 Payer ${totalStr} F par Wave`,
      url: `https://pay.wave.com/m/${waveNum}?amount=${total}&note=${waveMsg}`,
      amount: total
    });
  }

  // Orange Money — lien de paiement
  if (bot.om_number) {
    const omNum = bot.om_number.replace(/[\s+]/g,'');
    actions.push({
      type: 'om',
      label: `🟠 Payer ${totalStr} F par Orange Money`,
      url: `orangemoney://send?to=${omNum}&amount=${total}&note=Commande+${orderRef}`,
      url_fallback: `tel:${omNum}`,
      amount: total
    });
  }

  // Paiement à la livraison
  actions.push({
    type: 'cash',
    label: '💵 Payer à la livraison',
    url: null,
    amount: total
  });

  return actions;
}

// ============================================
// DÉTECTION D'INTENTION ENRICHIE
// ============================================
function detectIntent(msg, bot) {
  const l = msg.toLowerCase();
  const intents = [];
  if (/adresse|où|localisation|trouver|venir|plan|chemin|maps/.test(l)) intents.push('maps');
  if (/numéro|téléphone|appeler|contact|tel|phone/.test(l)) intents.push('phone');
  if (/whatsapp|wa|wsp/.test(l)) intents.push('whatsapp');
  if (/partager|lien|link/.test(l)) intents.push('share');
  if (/horaire|heure|ouvert|fermé|quand/.test(l)) intents.push('hours');
  if (/commander|commande|prendre|acheter|vouloir|bëgg/.test(l)) intents.push('order');
  if (/payer|paiement|wave|orange|om|prix|total/.test(l)) intents.push('payment');
  if (/catalogue|produit|menu|service|quoi|qu'est/.test(l)) intents.push('catalogue');
  if (/note|avis|satisfaction|comment c'était|bien|nul/.test(l)) intents.push('rating');
  if (/suivi|commande|statut|livraison|où en est/.test(l)) intents.push('tracking');
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
    const m = encodeURIComponent(`Bonjour ${bot.nom}!`);
    actions.push({ type:'whatsapp', label:'💬 WhatsApp', url:`https://wa.me/${n}?text=${m}` });
  }

  if (intents.includes('payment') && orderTotal > 0) {
    actions.push(...generatePaymentActions(bot, orderTotal, orderRef));
  }

  if (intents.includes('rating')) {
    actions.push({ type:'rating', label:'⭐ Donner un avis', url:null });
  }

  if (intents.includes('share')) {
    actions.push({ type:'share', label:'🔗 Partager ce bot', url:null });
  }

  if (intents.includes('hours') && bot.horaires) {
    actions.push({ type:'hours', label:`🕐 ${bot.horaires}`, url:null });
  }

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

    // Détecte si c'est une commande pour extraire le total
    const intents = detectIntent(message, bot);
    let orderTotal = 0;
    let orderRef = '';

    // Génère la réponse IA
    const reply = await callAI(bot.prompt, sid, message);

    // Extrait un total si la réponse contient un total
    const totalMatch = reply.match(/total[:\s]+([0-9\s]+)\s*f?cfa/i) ||
                       reply.match(/([0-9\s]+)\s*f?cfa/i);
    if (totalMatch && intents.includes('order')) {
      orderTotal = parseInt(totalMatch[1].replace(/\s/g,'')) || 0;
      orderRef = 'CMD-' + Date.now().toString(36).toUpperCase();
    }

    // Si paiement détecté dans la réponse
    if (orderTotal > 0 || intents.includes('payment')) {
      intents.push('payment');
    }

    const actions = buildActions(intents, bot, orderTotal, orderRef);

    // Catalogue si demandé
    let catalogue = null;
    if (intents.includes('catalogue') && bot.catalogue?.length > 0) {
      catalogue = bot.catalogue.slice(0, 6);
    }

    // Sauvegarde async
    saveMsg(botId, sid, message, reply).catch(()=>{});

    res.json({ reply, actions, catalogue, intents });

  } catch(err) {
    console.error('Chat error:', err);
    res.status(500).json({
      reply: 'Désolé, une erreur est survenue. Réessayez dans un instant. 🙏',
      actions: []
    });
  }
});

// ============================================
// COMMANDES
// ============================================
app.post('/commande/create', async (req, res) => {
  try {
    const { botId, sessionId, items, total, methode, adresse, clientNom, clientTel } = req.body;
    const commande = await db.insert('commandes', {
      bot_id: botId, session_id: sessionId,
      items: items||[], total: total||0,
      statut: methode==='cash' ? 'pending' : 'paid',
      methode_paiement: methode,
      adresse_livraison: adresse||null,
      client_nom: clientNom||null,
      client_tel: clientTel||null
    });
    const cmd = commande?.[0];
    if (cmd) {
      // Notifie le patron
      notifyPatron(botId, cmd).catch(()=>{});
    }
    res.json({ success:true, commande: cmd, numero: cmd?.numero });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/commande/:id', async (req, res) => {
  try {
    const cmds = await db.select('commandes', `?id=eq.${req.params.id}`);
    res.json(cmds?.[0] || null);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.patch('/commande/:id/statut', async (req, res) => {
  try {
    await db.update('commandes', { statut:req.body.statut, updated_at:new Date().toISOString() }, `?id=eq.${req.params.id}`);
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// AVIS CLIENTS
// ============================================
app.post('/avis', async (req, res) => {
  try {
    const { botId, sessionId, note, commentaire } = req.body;
    await db.insert('avis', { bot_id:botId, session_id:sessionId, note, commentaire:commentaire||null });

    // Met à jour la note moyenne
    const allAvis = await db.select('avis', `?bot_id=eq.${botId}&select=note`);
    if (allAvis?.length) {
      const avg = allAvis.reduce((s,a)=>s+a.note,0)/allAvis.length;
      await db.update('bots', { avg_rating:avg.toFixed(2) }, `?id=eq.${botId}`);
    }
    res.json({ success:true });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ============================================
// NOTIFICATIONS AU PATRON (via email simple)
// ============================================
async function notifyPatron(botId, commande) {
  const bots = await db.select('bots', `?id=eq.${botId}&select=nom,notifications_email,notifications_phone`);
  const bot = bots?.[0];
  if (!bot) return;

  console.log(`🔔 Nouvelle commande ${commande.numero} pour ${bot.nom} — Total: ${commande.total} FCFA`);
  // En production: envoyer un email ou SMS ici
  // Pour l'instant: log + WhatsApp si numéro configuré
  if (bot.notifications_phone) {
    const n = bot.notifications_phone.replace(/[\s+]/g,'');
    const msg = encodeURIComponent(`🔔 Nouvelle commande ${commande.numero}\nTotal: ${commande.total} FCFA\nStatut: ${commande.statut}\nAdresse: ${commande.adresse_livraison||'Non spécifiée'}`);
    console.log(`📱 Notif WhatsApp: https://wa.me/${n}?text=${msg}`);
  }
}

// ============================================
// SAUVEGARDER MESSAGES
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
Tu parles français et wolof naturellement. Détecte la langue et réponds dans la même langue.
Tu es chaleureux, professionnel et très utile. Réponds en 2-3 phrases max.

INFOS:
- Nom: ${bot.nom}
- Secteur: ${bot.niche}
${bot.adresse?`- Adresse: ${bot.adresse}`:''}
${bot.horaires?`- Horaires: ${bot.horaires}`:''}
${bot.telephone?`- Téléphone: ${bot.telephone}`:''}
${bot.services?`- Services/Produits: ${bot.services}`:''}
${bot.paiement?`- Paiement: ${bot.paiement}`:'- Paiement: Wave, Orange Money, espèces'}
${cat}

RÈGLES:
- Adresse demandée → donne adresse + mentionne lien Maps ci-dessous
- Téléphone demandé → donne numéro + mentionne bouton appel
- Commande → récapitule les articles ET le total en FCFA clairement (ex: "Total: 3 000 FCFA")
- RDV → confirme et demande date/heure préférée
- Toujours rester utile et proposer de l'aide supplémentaire`;
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
      quickReplies: getQR(b.niche)
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
      id, nom, niche,
      couleur: couleur||'#00c875',
      emoji: getEmoji(niche),
      actif: true,
      adresse: adresse||null, horaires: horaires||null, services: services||null,
      telephone: telephone||null, paiement: paiement||'Wave, Orange Money, espèces',
      maps_url: maps_url||null, wave_number: wave_number||null, om_number: om_number||null,
      logo_url: logo_url||null, catalogue: catalogue||[],
      notifications_phone: notifications_phone||null,
      custom_welcome: custom_welcome||null,
      user_id: '00000000-0000-0000-0000-000000000001'
    };
    botData.prompt = makePrompt(botData);

    // Gère l'utilisateur
    if (email) {
      const ex = await db.select('users', `?email=eq.${email}`);
      if (!ex?.length) {
        const nu = await db.insert('users', { email, nom:nom+' (owner)', plan:'starter' });
        if (nu?.[0]?.id) botData.user_id = nu[0].id;
      } else {
        botData.user_id = ex[0].id;
      }
    }

    await db.insert('bots', botData);
    console.log(`✅ Bot créé: ${nom} (${id})`);

    const base = CONFIG.BASE_URL;
    res.json({
      success: true, botId: id,
      chatUrl: `${base}/chat/${id}`,
      dashUrl: `${base}/dashboard/${id}`,
      widgetCode: `<!-- SamaBot — ${nom} -->\n<script>\n  window.SamaBotConfig = { botId: '${id}', couleur: '${couleur||'#00c875'}' };\n</script>\n<script src="${base}/widget.js" async></script>`
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

    const [convs, msgs, commandes, allAvis] = await Promise.all([
      db.select('conversations', `?bot_id=eq.${req.params.botId}&order=last_message_at.desc&limit=30`),
      db.select('messages', `?bot_id=eq.${req.params.botId}&role=eq.user&order=created_at.desc&limit=50`),
      db.select('commandes', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=20`),
      db.select('avis', `?bot_id=eq.${req.params.botId}&order=created_at.desc&limit=10`)
    ]);

    const now = Date.now();
    const msgsToday = msgs?.filter(m=>new Date(m.created_at)>new Date(now-86400000)).length||0;
    const cmdsPending = commandes?.filter(c=>c.statut==='pending').length||0;
    const revenuTotal = commandes?.filter(c=>c.statut==='paid').reduce((s,c)=>s+c.total,0)||0;
    const avgNote = allAvis?.length ? (allAvis.reduce((s,a)=>s+a.note,0)/allAvis.length).toFixed(1) : '—';

    const statusColors = { pending:'#f59e0b', paid:'#10b981', preparing:'#3b82f6', ready:'#8b5cf6', delivered:'#6b7280', cancelled:'#ef4444' };
    const statusLabels = { pending:'En attente', paid:'Payé', preparing:'En préparation', ready:'Prêt', delivered:'Livré', cancelled:'Annulé' };

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${bot.nom} — Dashboard SamaBot</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#f0f4f1;min-height:100vh;color:#0a1a0f}
.topbar{background:#0a1a0f;padding:0 20px;display:flex;align-items:center;gap:12px;height:58px;position:sticky;top:0;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.logo{font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:#fff}.logo span{color:#00c875}
.bot-badge{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.07);border-radius:20px;padding:5px 12px}
${bot.logo_url?`.bot-logo{width:26px;height:26px;border-radius:6px;object-fit:cover}`:''}
.bot-ava{width:28px;height:28px;border-radius:50%;background:${bot.couleur};display:flex;align-items:center;justify-content:center;font-size:14px}
.bot-nm{font-size:13px;font-weight:600;color:#fff}
.live{display:flex;align-items:center;gap:5px;font-size:12px;color:#4ade80;font-weight:600;margin-left:auto}
.live-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:p 2s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.4}}
.wrap{padding:20px;max-width:1100px;margin:0 auto}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:none;border:none;transition:all .15s}
.btn-p{background:${bot.couleur};color:#fff}.btn-p:hover{opacity:.9}
.btn-g{background:#fff;color:#0a1a0f;border:1px solid #d1e5d8}.btn-g:hover{background:#f0f4f1}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.stat{background:#fff;border-radius:12px;padding:16px;border:1px solid rgba(0,200,117,.1)}
.stat-val{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;line-height:1;color:#0a1a0f}
.stat-lbl{font-size:12px;color:#5a7060;margin-top:5px;font-weight:500}
.stat-sub{font-size:11px;font-weight:600;margin-top:3px;color:#00c875}
.alert{background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:#92400e}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.card{background:#fff;border-radius:12px;padding:18px;border:1px solid rgba(0,200,117,.1)}
.card-title{font-size:14px;font-weight:700;color:#0a1a0f;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.card-title-left{display:flex;align-items:center;gap:6px}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700}
.row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid #f0f4f1}
.row:last-child{border-bottom:none}
.row-title{font-size:13px;font-weight:600;color:#0a1a0f}
.row-sub{font-size:11px;color:#9ab0a0;margin-top:2px}
.row-right{text-align:right;flex-shrink:0}
.price{font-size:14px;font-weight:700;color:#0a1a0f}
.empty{text-align:center;color:#9ab0a0;font-size:13px;padding:24px;font-style:italic}
.status-btn{border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif}
.msg-text{font-size:13px;color:#2a3a2a;line-height:1.5}
.msg-time{font-size:11px;color:#9ab0a0;margin-top:2px}
.stars{color:#f59e0b;font-size:14px;letter-spacing:1px}
.qr-wrap{text-align:center;padding:12px}
#qr{width:140px;height:140px;margin:0 auto;display:block;border-radius:8px}
.copy-area{background:#f0f4f1;border-radius:8px;padding:10px 12px;font-size:11px;color:#3a5040;word-break:break-all;margin-top:8px;font-family:monospace;line-height:1.6}
.cp{background:rgba(0,200,117,.12);color:#00a862;border:1px solid rgba(0,200,117,.25);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:6px}
.tab-btns{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.tab-btn{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid #d1e5d8;background:#fff;color:#5a7060;font-family:'DM Sans',sans-serif;transition:all .15s}
.tab-btn.active{background:${bot.couleur};color:#fff;border-color:${bot.couleur}}
.tab{display:none}.tab.active{display:block}
@media(max-width:768px){.stats{grid-template-columns:repeat(2,1fr)}.grid2{grid-template-columns:1fr}.wrap{padding:12px}}
</style>
</head>
<body>
<div class="topbar">
  <div class="logo">Sama<span>Bot</span></div>
  <div class="bot-badge">
    ${bot.logo_url ? `<img class="bot-logo" src="${bot.logo_url}" alt="${bot.nom}"/>` : `<div class="bot-ava">${bot.emoji}</div>`}
    <span class="bot-nm">${bot.nom}</span>
  </div>
  <div class="live"><span class="live-dot"></span>En direct</div>
</div>

<div class="wrap">
  <div class="actions">
    <a class="btn btn-p" href="/chat/${bot.id}" target="_blank">💬 Voir le chat</a>
    <button class="btn btn-g" onclick="copyLink()">🔗 Copier lien</button>
    <button class="btn btn-g" onclick="document.getElementById('widget-modal').style.display='flex'">📋 Widget</button>
    <button class="btn btn-g" onclick="location.reload()">🔄 Actualiser</button>
  </div>

  ${cmdsPending > 0 ? `<div class="alert">⚠️ ${cmdsPending} commande${cmdsPending>1?'s':''} en attente de traitement !</div>` : ''}

  <div class="stats">
    <div class="stat">
      <div class="stat-val">${msgsToday}</div>
      <div class="stat-lbl">Messages aujourd'hui</div>
      <div class="stat-sub">↑ Actif</div>
    </div>
    <div class="stat">
      <div class="stat-val">${commandes?.length||0}</div>
      <div class="stat-lbl">Commandes totales</div>
      <div class="stat-sub ${cmdsPending>0?'':''}">⏳ ${cmdsPending} en attente</div>
    </div>
    <div class="stat">
      <div class="stat-val">${(revenuTotal/1000).toFixed(0)}K</div>
      <div class="stat-lbl">Revenus FCFA</div>
      <div class="stat-sub">💰 Confirmés</div>
    </div>
    <div class="stat">
      <div class="stat-val">${avgNote}${avgNote!=='—'?'⭐':''}</div>
      <div class="stat-lbl">Note clients</div>
      <div class="stat-sub">${allAvis?.length||0} avis</div>
    </div>
  </div>

  <!-- TABS -->
  <div class="tab-btns">
    <button class="tab-btn active" onclick="showTab('commandes',this)">📦 Commandes</button>
    <button class="tab-btn" onclick="showTab('messages',this)">💬 Messages</button>
    <button class="tab-btn" onclick="showTab('avis',this)">⭐ Avis</button>
    <button class="tab-btn" onclick="showTab('partage',this)">🔗 Partage & QR</button>
  </div>

  <!-- TAB COMMANDES -->
  <div id="tab-commandes" class="tab active">
    <div class="card">
      <div class="card-title"><div class="card-title-left">📦 Commandes récentes</div></div>
      ${commandes?.length ? commandes.map(c => `
        <div class="row">
          <div>
            <div class="row-title">${c.numero||'Commande'} ${c.client_nom?'— '+c.client_nom:''}</div>
            <div class="row-sub">${new Date(c.created_at).toLocaleString('fr-FR')} • ${c.methode_paiement||'—'}</div>
            ${c.adresse_livraison?`<div class="row-sub">📍 ${c.adresse_livraison}</div>`:''}
          </div>
          <div class="row-right">
            <div class="price">${(c.total||0).toLocaleString('fr-FR')} F</div>
            <span class="badge" style="background:${statusColors[c.statut]||'#ccc'}22;color:${statusColors[c.statut]||'#666'}">${statusLabels[c.statut]||c.statut}</span>
            <br><select onchange="updateStatut('${c.id}',this.value)" style="margin-top:4px;font-size:11px;border-radius:6px;border:1px solid #d1e5d8;padding:3px 6px;cursor:pointer">
              ${['pending','paid','preparing','ready','delivered','cancelled'].map(s=>`<option value="${s}" ${c.statut===s?'selected':''}>${statusLabels[s]}</option>`).join('')}
            </select>
          </div>
        </div>
      `).join('') : '<div class="empty">Aucune commande encore. Partagez votre lien de chat !</div>'}
    </div>
  </div>

  <!-- TAB MESSAGES -->
  <div id="tab-messages" class="tab">
    <div class="card">
      <div class="card-title"><div class="card-title-left">💬 Messages des clients</div></div>
      ${msgs?.length ? msgs.slice(0,15).map(m=>`
        <div class="row">
          <div>
            <div class="msg-text">${m.content}</div>
            <div class="msg-time">${new Date(m.created_at).toLocaleString('fr-FR')}</div>
          </div>
        </div>
      `).join('') : '<div class="empty">Aucun message encore.</div>'}
    </div>
  </div>

  <!-- TAB AVIS -->
  <div id="tab-avis" class="tab">
    <div class="card">
      <div class="card-title">
        <div class="card-title-left">⭐ Avis clients</div>
        <span style="font-size:22px;font-weight:800;color:#f59e0b">${avgNote !== '—' ? avgNote+'⭐' : '—'}</span>
      </div>
      ${allAvis?.length ? allAvis.map(a=>`
        <div class="row">
          <div>
            <div class="stars">${'⭐'.repeat(a.note)}${'☆'.repeat(5-a.note)}</div>
            ${a.commentaire?`<div class="msg-text" style="margin-top:4px">"${a.commentaire}"</div>`:''}
            <div class="msg-time">${new Date(a.created_at).toLocaleString('fr-FR')}</div>
          </div>
        </div>
      `).join('') : '<div class="empty">Aucun avis encore. Le bot demande automatiquement après chaque interaction !</div>'}
    </div>
  </div>

  <!-- TAB PARTAGE -->
  <div id="tab-partage" class="tab">
    <div class="grid2">
      <div class="card">
        <div class="card-title"><div class="card-title-left">📱 QR Code</div></div>
        <div class="qr-wrap">
          <img id="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(CONFIG.BASE_URL+'/chat/'+bot.id)}&color=0a1a0f&bgcolor=ffffff" alt="QR"/>
          <p style="font-size:12px;color:#5a7060;margin-top:8px">Imprimez et affichez dans votre commerce</p>
          <a href="https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(CONFIG.BASE_URL+'/chat/'+bot.id)}&color=0a1a0f&bgcolor=ffffff" download="qr-${bot.id}.png" class="cp" style="display:inline-block;text-decoration:none;margin-top:6px">⬇️ Télécharger HD</a>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><div class="card-title-left">🔗 Liens de partage</div></div>
        <div style="margin-bottom:12px">
          <div style="font-size:12px;font-weight:600;color:#5a7060;margin-bottom:4px">Lien chat client</div>
          <div class="copy-area">${CONFIG.BASE_URL}/chat/${bot.id}</div>
          <button class="cp" onclick="navigator.clipboard.writeText('${CONFIG.BASE_URL}/chat/${bot.id}').then(()=>alert('✅ Copié!'))">📋 Copier</button>
        </div>
        <div>
          <div style="font-size:12px;font-weight:600;color:#5a7060;margin-bottom:4px">Code widget site web</div>
          <div class="copy-area">&lt;script&gt;window.SamaBotConfig={botId:'${bot.id}',couleur:'${bot.couleur}'}&lt;/script&gt;\n&lt;script src="${CONFIG.BASE_URL}/widget.js" async&gt;&lt;/script&gt;</div>
          <button class="cp" onclick="copyWidget()">📋 Copier le code</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- MODAL WIDGET -->
<div id="widget-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)this.style.display='none'">
  <div style="background:#fff;border-radius:16px;padding:24px;max-width:480px;width:100%">
    <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;margin-bottom:16px">📋 Code widget</div>
    <div class="copy-area" id="wcode">&lt;script&gt;\n  window.SamaBotConfig = { botId: '${bot.id}', couleur: '${bot.couleur}' };\n&lt;/script&gt;\n&lt;script src="${CONFIG.BASE_URL}/widget.js" async&gt;&lt;/script&gt;</div>
    <button class="cp" onclick="copyWidget()">📋 Copier le code</button>
    <button onclick="document.getElementById('widget-modal').style.display='none'" style="margin-left:10px;background:none;border:none;cursor:pointer;font-size:13px;color:#5a7060">Fermer</button>
  </div>
</div>

<script>
function showTab(id,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
function copyLink(){navigator.clipboard.writeText('${CONFIG.BASE_URL}/chat/${bot.id}').then(()=>alert('✅ Lien copié!'));}
function copyWidget(){
  var t='<script>\\n  window.SamaBotConfig = { botId: \\'${bot.id}\\', couleur: \\'${bot.couleur}\\' };\\n<\\/script>\\n<script src="${CONFIG.BASE_URL}/widget.js" async><\\/script>';
  navigator.clipboard.writeText(t).then(()=>alert('✅ Code copié!'));
}
async function updateStatut(id,statut){
  await fetch('/commande/'+id+'/statut',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({statut})});
  setTimeout(()=>location.reload(),500);
}
setTimeout(()=>location.reload(),60000);
</script>
</body>
</html>`);
  } catch(e) { res.status(500).send('Erreur: '+e.message); }
});

// ============================================
// PAGE SETUP v4
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
.wrap{max-width:600px;margin:0 auto;padding:28px 20px}
h1{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#0a1a0f;margin-bottom:6px}
.sub{font-size:14px;color:#5a7060;margin-bottom:24px}
.card{background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;border:1px solid rgba(0,200,117,.15)}
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
.logo-preview{width:80px;height:80px;border-radius:12px;object-fit:cover;display:none;border:2px solid #d1e5d8;margin-top:6px}
.logo-preview.show{display:block}
.pay-opts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.pay-opt{padding:6px 14px;border-radius:20px;border:1.5px solid #d1e5d8;font-size:13px;font-weight:600;cursor:pointer;color:#5a7060;transition:all .15s;background:#fff}
.pay-opt.s{background:#00c875;color:#fff;border-color:#00c875}
.cat-items{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.cat-item{display:grid;grid-template-columns:2fr 1fr auto;gap:8px;align-items:center}
.cat-item input{padding:8px 10px;font-size:13px}
.remove-btn{background:#fee2e2;border:none;border-radius:8px;padding:8px 10px;cursor:pointer;font-size:14px;color:#dc2626}
.add-btn{background:rgba(0,200,117,.1);border:1.5px dashed rgba(0,200,117,.4);border-radius:10px;padding:10px;text-align:center;cursor:pointer;font-size:13px;font-weight:600;color:#00a862;margin-top:6px;transition:all .15s}
.add-btn:hover{background:rgba(0,200,117,.15)}
.sbtn{width:100%;background:#00c875;color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;margin-top:4px}
.sbtn:hover{background:#00a862}.sbtn:disabled{opacity:.6;cursor:not-allowed}
.res{background:#0a1a0f;border-radius:14px;padding:22px;display:none;margin-top:16px}
.res.show{display:block}
.rt{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:16px}
.ri{margin-bottom:14px}
.rl{font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
.rv{background:rgba(255,255,255,.07);border-radius:8px;padding:10px 12px;font-size:12px;color:#fff;word-break:break-all;font-family:monospace;line-height:1.7}
.cp{background:rgba(0,200,117,.15);color:#00c875;border:1px solid rgba(0,200,117,.3);border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:5px}
.rbtns{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}
.rb{flex:1;min-width:140px;padding:11px;border-radius:10px;font-size:13px;font-weight:700;text-align:center;cursor:pointer;font-family:'DM Sans',sans-serif;text-decoration:none;border:none}
.rb-g{background:#00c875;color:#fff}.rb-o{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.2)}
@media(max-width:500px){.row2{grid-template-columns:1fr}.niches{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="hd"><div class="logo">Sama<span>Bot</span></div></div>
<div class="wrap">
  <h1>Créez votre bot IA 🤖</h1>
  <p class="sub">Configurez votre assistant en 3 minutes. Sans technique, sans code.</p>

  <!-- 1. BUSINESS -->
  <div class="card">
    <div class="ctitle"><span class="num">1</span> Votre business</div>
    <div class="f"><label>Nom du business *</label><input id="nom" placeholder="Ex: Restaurant Teranga, Salon Aminata..."/></div>
    <div class="f"><label>Logo (URL d'image)</label><input id="logo" placeholder="https://... (URL de votre logo)" oninput="previewLogo(this.value)"/><img id="logo-preview" class="logo-preview" alt="Logo preview"/></div>
    <div class="f">
      <label>Type de business *</label>
      <div class="niches" id="niches">
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

  <!-- 2. COORDONNÉES -->
  <div class="card">
    <div class="ctitle"><span class="num">2</span> Coordonnées</div>
    <div class="f"><label>Adresse complète</label><input id="adr" placeholder="Ex: Almadies, Rue 10, Dakar"/></div>
    <div class="row2">
      <div class="f"><label>Lien Google Maps</label><input id="maps" placeholder="https://maps.google.com/..."/></div>
      <div class="f"><label>Téléphone</label><input id="tel" placeholder="+221 77 xxx xxxx" type="tel"/></div>
    </div>
    <div class="f"><label>Horaires d'ouverture</label><input id="hor" placeholder="Ex: Lun-Ven 9h-20h, Sam-Dim 10h-18h"/></div>
  </div>

  <!-- 3. SERVICES -->
  <div class="card">
    <div class="ctitle"><span class="num">3</span> Catalogue / Services</div>
    <div class="f"><label>Description générale</label><textarea id="srv" placeholder="Décrivez vos services, votre spécialité..."></textarea></div>
    <div class="f">
      <label>Articles du catalogue (avec prix)</label>
      <div class="cat-items" id="cat-items">
        <div class="cat-item">
          <input placeholder="Nom du produit/service" class="cat-nom"/>
          <input placeholder="Prix FCFA" class="cat-prix" type="number"/>
          <button class="remove-btn" onclick="this.closest('.cat-item').remove()">✕</button>
        </div>
      </div>
      <div class="add-btn" onclick="addCatItem()">+ Ajouter un article</div>
    </div>
  </div>

  <!-- 4. PAIEMENT -->
  <div class="card">
    <div class="ctitle"><span class="num">4</span> Paiement</div>
    <div class="f">
      <label>Moyens de paiement acceptés</label>
      <div class="pay-opts">
        <div class="pay-opt s" data-val="Wave" onclick="togglePay(this)">💙 Wave</div>
        <div class="pay-opt s" data-val="Orange Money" onclick="togglePay(this)">🟠 Orange Money</div>
        <div class="pay-opt s" data-val="Espèces" onclick="togglePay(this)">💵 Espèces</div>
        <div class="pay-opt" data-val="Free Money" onclick="togglePay(this)">🟢 Free Money</div>
        <div class="pay-opt" data-val="Carte bancaire" onclick="togglePay(this)">💳 Carte</div>
      </div>
    </div>
    <div class="row2">
      <div class="f"><label>Numéro Wave du business</label><input id="wave" placeholder="77 xxx xx xx"/></div>
      <div class="f"><label>Numéro Orange Money</label><input id="om" placeholder="77 xxx xx xx"/></div>
    </div>
  </div>

  <!-- 5. NOTIFICATIONS -->
  <div class="card">
    <div class="ctitle"><span class="num">5</span> Notifications & Apparence</div>
    <div class="row2">
      <div class="f"><label>WhatsApp pour notifications commandes</label><input id="notif_phone" placeholder="+221 77 xxx xxxx"/></div>
      <div class="f"><label>Email de contact</label><input id="email" type="email" placeholder="votre@email.com"/></div>
    </div>
    <div class="f">
      <label>Couleur principale</label>
      <div class="cols" id="cols">
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

  <button class="sbtn" id="sbtn" onclick="create()">🚀 Créer mon bot SamaBot gratuitement</button>

  <div class="res" id="res">
    <div class="rt">🎉 Votre bot est prêt !</div>
    <div class="ri"><div class="rl">🔗 Lien de chat à partager</div><div class="rv" id="r-chat"></div><button class="cp" onclick="cp('r-chat')">📋 Copier</button></div>
    <div class="ri"><div class="rl">📊 Votre dashboard</div><div class="rv" id="r-dash"></div><button class="cp" onclick="cp('r-dash')">📋 Copier</button></div>
    <div class="ri"><div class="rl">📦 Code widget site web</div><div class="rv" id="r-widget"></div><button class="cp" onclick="cp('r-widget')">📋 Copier</button></div>
    <div class="rbtns">
      <a class="rb rb-g" id="r-link" href="#" target="_blank">💬 Tester le bot →</a>
      <a class="rb rb-o" id="r-dlink" href="#" target="_blank">📊 Dashboard →</a>
    </div>
  </div>
</div>

<script>
var nv='restaurant', cv='#00c875';
var paySelected=['Wave','Orange Money','Espèces'];

function selN(e){document.querySelectorAll('.n').forEach(x=>x.classList.remove('s'));e.classList.add('s');nv=e.dataset.val;}
function selC(e){document.querySelectorAll('.co').forEach(x=>x.classList.remove('s'));e.classList.add('s');cv=e.dataset.val;}
function togglePay(e){e.classList.toggle('s');paySelected=Array.from(document.querySelectorAll('.pay-opt.s')).map(x=>x.dataset.val);}
function previewLogo(url){var img=document.getElementById('logo-preview');if(url){img.src=url;img.classList.add('show');}else{img.classList.remove('show');}}
function addCatItem(){
  var div=document.createElement('div');div.className='cat-item';
  div.innerHTML='<input placeholder="Nom du produit/service" class="cat-nom"/><input placeholder="Prix FCFA" class="cat-prix" type="number"/><button class="remove-btn" onclick="this.closest(\\'.cat-item\\').remove()">✕</button>';
  document.getElementById('cat-items').appendChild(div);
}
function cp(id){
  var t=document.getElementById(id).textContent;
  navigator.clipboard.writeText(t).then(()=>alert('✅ Copié!')).catch(()=>{var ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ Copié!');});
}
function getCatalogue(){
  return Array.from(document.querySelectorAll('.cat-item')).map(item=>{
    var nom=item.querySelector('.cat-nom')?.value?.trim();
    var prix=item.querySelector('.cat-prix')?.value;
    if(nom&&prix)return{nom,prix:parseInt(prix)};
    return null;
  }).filter(Boolean);
}
async function create(){
  var nom=document.getElementById('nom').value.trim();
  if(!nom){alert('⚠️ Entrez le nom de votre business');return;}
  var btn=document.getElementById('sbtn');btn.textContent='⏳ Création...';btn.disabled=true;
  try{
    var r=await fetch('/bot/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      nom,niche:nv,
      logo_url:document.getElementById('logo').value||null,
      adresse:document.getElementById('adr').value,
      maps_url:document.getElementById('maps').value,
      telephone:document.getElementById('tel').value,
      horaires:document.getElementById('hor').value,
      services:document.getElementById('srv').value,
      catalogue:getCatalogue(),
      paiement:paySelected.join(', '),
      wave_number:document.getElementById('wave').value,
      om_number:document.getElementById('om').value,
      notifications_phone:document.getElementById('notif_phone').value,
      email:document.getElementById('email').value,
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
    }else{alert('❌ Erreur: '+(d.error||'Réessayez'));}
  }catch(e){alert('❌ Erreur réseau');}
  btn.textContent='🚀 Créer mon bot SamaBot gratuitement';btn.disabled=false;
}
</script>
</body>
</html>`);
});

// ============================================
// WIDGET.JS v4
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

// Styles minifiés
var css=document.createElement('style');
css.textContent='.sb-btn{position:fixed;bottom:24px;right:24px;width:58px;height:58px;border-radius:50%;background:'+couleur+';display:flex;align-items:center;justify-content:center;font-size:26px;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:2147483647;border:none;transition:transform .2s;animation:sbIn 1s ease 1.5s both}.sb-btn:hover{transform:scale(1.1)}.sb-notif{position:absolute;top:-2px;right:-2px;width:18px;height:18px;background:#22c55e;border-radius:50%;border:2px solid #fff;font-size:9px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}.sb-win{position:fixed;bottom:94px;right:24px;width:350px;max-height:540px;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.2);z-index:2147483646;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,sans-serif}.sb-win.open{display:flex;animation:sbSlide .3s ease}@keyframes sbSlide{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes sbIn{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}.sb-head{background:'+couleur+';padding:14px 16px;display:flex;align-items:center;gap:10px}.sb-logo{width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid rgba(255,255,255,.3)}.sb-ava{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;border:2px solid rgba(255,255,255,.3)}.sb-hn{font-size:14px;font-weight:700;color:#fff}.sb-hs{font-size:11px;color:rgba(255,255,255,.8);margin-top:2px;display:flex;align-items:center;gap:4px}.sb-hd{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:sbP 2s infinite}@keyframes sbP{0%,100%{opacity:1}50%{opacity:.4}}.sb-x{margin-left:auto;background:rgba(255,255,255,.15);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}.sb-msgs{flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;background:#f8faf8}.sb-msg{display:flex;gap:7px;align-items:flex-end}.sb-msg.u{flex-direction:row-reverse}.sb-bub{padding:9px 13px;font-size:13px;line-height:1.5;max-width:82%;border-radius:14px}.sb-bub.b{background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:3px 14px 14px 14px;box-shadow:0 1px 4px rgba(0,0,0,.05)}.sb-bub.u{background:'+couleur+';color:#fff;border-radius:14px 14px 3px 14px}.sb-av{width:26px;height:26px;border-radius:50%;background:'+couleur+';display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}.sb-actions{display:flex;flex-wrap:wrap;gap:5px;padding:0 12px 8px}.sb-act{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:18px;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s}.sb-maps{background:#e8f5e9;color:#1b5e20}.sb-phone{background:#e3f2fd;color:#0d47a1}.sb-whatsapp{background:#dcfce7;color:#166534}.sb-wave{background:#dbeafe;color:#1e40af}.sb-om{background:#ffedd5;color:#9a3412}.sb-cash{background:#f0fdf4;color:#15803d}.sb-share{background:#f3e5f5;color:#4a148c}.sb-hours{background:#fff8e1;color:#e65100}.sb-rating{background:#fef9c3;color:#ca8a04}.sb-act:active{transform:scale(.97)}.sb-cat{display:flex;gap:8px;padding:8px 12px;overflow-x:auto;scrollbar-width:none}.sb-cat::-webkit-scrollbar{display:none}.sb-cat-item{min-width:110px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 8px;text-align:center;cursor:pointer;flex-shrink:0;transition:all .15s}.sb-cat-item:hover{border-color:'+couleur+';transform:translateY(-1px)}.sb-cat-emoji{font-size:24px;display:block;margin-bottom:4px}.sb-cat-nom{font-size:11px;font-weight:600;color:#111;display:block}.sb-cat-prix{font-size:12px;font-weight:700;color:'+couleur+';display:block;margin-top:2px}.sb-rating-stars{display:flex;gap:6px;padding:8px 12px;justify-content:center}.sb-star{font-size:24px;cursor:pointer;transition:transform .15s;background:none;border:none}.sb-star:hover{transform:scale(1.2)}.sb-qr{padding:8px 12px;display:flex;flex-wrap:wrap;gap:5px;background:#fff;border-top:1px solid #f0f0f0}.sb-qb{padding:5px 11px;border-radius:14px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid '+couleur+'33;background:'+couleur+'0d;color:'+couleur+';font-family:inherit;transition:all .15s}.sb-qb:hover{background:'+couleur+';color:#fff}.sb-inp{padding:10px 12px;display:flex;gap:7px;background:#fff;border-top:1px solid #f0f0f0}.sb-input{flex:1;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:18px;padding:8px 14px;font-size:13px;font-family:inherit;outline:none}.sb-input:focus{border-color:'+couleur+'}.sb-send{width:36px;height:36px;border-radius:50%;background:'+couleur+';border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 10px '+couleur+'44}.sb-pw{text-align:center;padding:4px;font-size:10px;color:#b0b8b0;background:#fff;border-top:1px solid #f5f5f5}@media(max-width:480px){.sb-win{width:calc(100vw - 28px);right:14px;bottom:84px}}';
document.head.appendChild(css);

var btn=document.createElement('button');
btn.className='sb-btn';
btn.innerHTML='<span id="sb-ico">💬</span><div class="sb-notif" id="sb-notif">1</div>';
btn.onclick=function(){toggle();};

var win=document.createElement('div');
win.className='sb-win';
win.innerHTML='<div class="sb-head"><div id="sb-head-logo"></div><div style="flex:1"><div class="sb-hn" id="sb-hn">SamaBot</div><div class="sb-hs"><span class="sb-hd"></span>En ligne — wolof & français</div></div><button class="sb-x" onclick="document.querySelector(\\'.sb-win\\').classList.remove(\\'open\\')">✕</button></div><div class="sb-msgs" id="sb-msgs"></div><div class="sb-actions" id="sb-actions"></div><div class="sb-cat" id="sb-cat" style="display:none"></div><div class="sb-rating-stars" id="sb-rating" style="display:none"></div><div class="sb-qr" id="sb-qr"></div><div class="sb-inp"><input class="sb-input" id="sb-inp" placeholder="Écrivez en français ou wolof..."/><button class="sb-send" onclick="sbSend()">➤</button></div><div class="sb-pw">Propulsé par <strong style="color:'+couleur+'">SamaBot IA</strong></div>';

document.body.appendChild(btn);
document.body.appendChild(win);
document.getElementById('sb-inp').onkeydown=function(e){if(e.key==='Enter')sbSend();};

fetch(base+'/bot/'+botId).then(r=>r.json()).then(function(d){
  if(!d.nom)return;
  botInfo=d;
  document.getElementById('sb-hn').textContent=d.nom;
  document.getElementById('sb-ico').textContent=d.emoji||'💬';
  var headLogo=document.getElementById('sb-head-logo');
  if(d.logo){var img=document.createElement('img');img.className='sb-logo';img.src=d.logo;img.alt=d.nom;headLogo.appendChild(img);}
  else{var av=document.createElement('div');av.className='sb-ava';av.textContent=d.emoji||'🤖';headLogo.appendChild(av);}
  addBot(d.welcome||('Asalaa maalekum! 👋 Bienvenue chez '+d.nom+'.'));
  if(d.quickReplies)renderQR(d.quickReplies);
}).catch(function(){addBot('Asalaa maalekum! 👋 Comment puis-je vous aider?');});

function toggle(){open=!open;win.classList.toggle('open',open);if(open)document.getElementById('sb-notif').style.display='none';}

function addBot(t){
  var m=document.getElementById('sb-msgs');
  var d=document.createElement('div');d.className='sb-msg';
  var logoSrc=botInfo?.logo;
  var av=document.createElement('div');
  if(logoSrc){var img=document.createElement('img');img.style='width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0';img.src=logoSrc;av.appendChild(img);}
  else{av.className='sb-av';av.textContent=botInfo?.emoji||'🤖';}
  var b=document.createElement('div');b.className='sb-bub b';b.innerHTML=t.replace(/\\n/g,'<br>').replace(/\\*(.*?)\\*/g,'<strong>$1</strong>');
  d.appendChild(av);d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

function addUser(t){
  var m=document.getElementById('sb-msgs');
  var d=document.createElement('div');d.className='sb-msg u';
  var b=document.createElement('div');b.className='sb-bub u';b.textContent=t;
  d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

function renderActions(actions){
  var el=document.getElementById('sb-actions');
  el.innerHTML='';
  document.getElementById('sb-rating').style.display='none';
  if(!actions?.length)return;
  actions.forEach(function(a){
    if(a.type==='rating'){
      showRating();return;
    }
    if(a.type==='share'){
      var b=document.createElement('button');b.className='sb-act sb-share';b.textContent=a.label;
      b.onclick=function(){if(navigator.share)navigator.share({title:botInfo?.nom,url:base+'/chat/'+botId});else{navigator.clipboard.writeText(base+'/chat/'+botId);alert('Lien copié! ✅');}};
      el.appendChild(b);return;
    }
    if(a.type==='cash'){
      var b=document.createElement('button');b.className='sb-act sb-cash';b.textContent=a.label;
      b.onclick=function(){addBot('✅ Paiement à la livraison noté! Nous confirmons votre commande.');};
      el.appendChild(b);return;
    }
    if(!a.url&&a.type==='hours'){
      var s=document.createElement('span');s.className='sb-act sb-hours';s.textContent=a.label;el.appendChild(s);return;
    }
    if(a.url){
      var l=document.createElement('a');l.className='sb-act sb-'+a.type;l.textContent=a.label;l.href=a.url;l.target='_blank';l.rel='noopener';el.appendChild(l);
    }
  });
}

function renderCatalogue(items){
  var el=document.getElementById('sb-cat');
  if(!items?.length){el.style.display='none';return;}
  el.style.display='flex';el.innerHTML='';
  items.forEach(function(item){
    var d=document.createElement('div');d.className='sb-cat-item';
    d.innerHTML='<span class="sb-cat-emoji">'+(item.emoji||'🛍️')+'</span><span class="sb-cat-nom">'+item.nom+'</span><span class="sb-cat-prix">'+item.prix.toLocaleString('fr-FR')+' F</span>';
    d.onclick=function(){sbSend('Je veux commander '+item.nom);};
    el.appendChild(d);
  });
}

function showRating(){
  var el=document.getElementById('sb-rating');
  el.style.display='flex';el.innerHTML='';
  [1,2,3,4,5].forEach(function(n){
    var b=document.createElement('button');b.className='sb-star';b.textContent='☆';
    b.onclick=function(){
      document.querySelectorAll('.sb-star').forEach((s,i)=>s.textContent=i<n?'⭐':'☆');
      setTimeout(function(){
        fetch(base+'/avis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botId,sessionId:sid,note:n,commentaire:''})}).catch(()=>{});
        el.style.display='none';
        addBot('Jerejef! 🙏 Merci pour votre note '+n+'/5. Votre avis nous aide à nous améliorer!');
      },500);
    };
    el.appendChild(b);
  });
}

function renderQR(rs){
  var qr=document.getElementById('sb-qr');qr.innerHTML='';
  rs.forEach(function(r){var b=document.createElement('button');b.className='sb-qb';b.textContent=r;b.onclick=function(){sbSend(r);};qr.appendChild(b);});
}

window.sbSend=function(t){
  var inp=document.getElementById('sb-inp');
  var msg=t||(inp?inp.value.trim():'');if(!msg)return;
  if(inp)inp.value='';
  document.getElementById('sb-qr').innerHTML='';
  document.getElementById('sb-actions').innerHTML='';
  document.getElementById('sb-cat').style.display='none';
  document.getElementById('sb-rating').style.display='none';
  addUser(msg);

  var m=document.getElementById('sb-msgs');
  var ty=document.createElement('div');ty.className='sb-msg';ty.id='sb-ty';
  var av2=document.createElement('div');
  if(botInfo?.logo){var i=document.createElement('img');i.style='width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0';i.src=botInfo.logo;av2.appendChild(i);}
  else{av2.className='sb-av';av2.textContent=botInfo?.emoji||'🤖';}
  var tb=document.createElement('div');tb.className='sb-bub b';tb.style='padding:12px 16px';
  tb.innerHTML='<span style="display:flex;gap:4px"><span style="width:7px;height:7px;border-radius:50%;background:#ccc;animation:sbD 1.2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:#ccc;animation:sbD 1.2s .2s infinite"></span><span style="width:7px;height:7px;border-radius:50%;background:#ccc;animation:sbD 1.2s .4s infinite"></span></span>';
  if(!document.getElementById('sb-ds')){var s=document.createElement('style');s.id='sb-ds';s.textContent='@keyframes sbD{0%,80%,100%{opacity:.25}40%{opacity:1}}';document.head.appendChild(s);}
  ty.appendChild(av2);ty.appendChild(tb);m.appendChild(ty);m.scrollTop=m.scrollHeight;

  fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,botId,sessionId:sid})})
  .then(r=>r.json())
  .then(function(data){
    var t=document.getElementById('sb-ty');if(t)t.remove();
    addBot(data.reply||'Désolé, erreur.');
    if(data.actions?.length)renderActions(data.actions);
    if(data.catalogue?.length)renderCatalogue(data.catalogue);
  })
  .catch(function(){var t=document.getElementById('sb-ty');if(t)t.remove();addBot('Désolé, une erreur est survenue. Réessayez.');});
};

setTimeout(function(){if(!open){btn.style.transform='scale(1.15)';setTimeout(()=>btn.style.transform='',350);}},5000);
})();`);
});

// ============================================
// PAGE CHAT v4
// ============================================
app.get('/chat/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&actif=eq.true`);
    const bot = bots?.[0] || { nom:'SamaBot', couleur:'#00c875', emoji:'🤖', niche:'default', id:req.params.botId };
    const qr = getQR(bot.niche);

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<meta property="og:title" content="${bot.nom}"/>
<meta property="og:description" content="Chattez avec ${bot.nom} — Disponible 24h/24 en wolof et français"/>
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
.hd-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.hd-right{margin-left:auto;display:flex;gap:6px}
.hd-btn{background:rgba(255,255,255,.15);border:none;border-radius:8px;padding:6px 10px;color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none}
.msgs{flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;min-height:0}
.msg{display:flex;gap:8px;align-items:flex-end}
.msg.u{flex-direction:row-reverse}
.bub{padding:10px 14px;font-size:14px;line-height:1.5;max-width:82%;border-radius:16px}
.bub.b{background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:3px 16px 16px 16px;box-shadow:0 2px 6px rgba(0,0,0,.05)}
.bub.u{background:${bot.couleur};color:#fff;border-radius:16px 16px 3px 16px}
.av{width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;background:${bot.couleur};display:flex;align-items:center;justify-content:center;font-size:16px}
.av img{width:100%;height:100%;object-fit:cover}
.actions{display:flex;flex-wrap:wrap;gap:7px;padding:4px 12px 6px 52px}
.act{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;text-decoration:none;transition:all .15s}
.act-maps{background:#e8f5e9;color:#1b5e20}.act-phone{background:#e3f2fd;color:#0d47a1}.act-whatsapp{background:#dcfce7;color:#166534}.act-wave{background:#dbeafe;color:#1e40af}.act-om{background:#ffedd5;color:#9a3412}.act-cash{background:#f0fdf4;color:#15803d}.act-share{background:#f3e5f5;color:#4a148c}.act-hours{background:#fff8e1;color:#e65100}
.catalogue{display:flex;gap:8px;padding:6px 12px;overflow-x:auto;scrollbar-width:none}
.catalogue::-webkit-scrollbar{display:none}
.cat-card{min-width:100px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px;text-align:center;cursor:pointer;flex-shrink:0;transition:all .15s}
.cat-card:hover{border-color:${bot.couleur};transform:translateY(-1px)}
.cat-emoji{font-size:22px;display:block;margin-bottom:3px}
.cat-nom{font-size:11px;font-weight:600;color:#111;display:block}
.cat-prix{font-size:12px;font-weight:700;color:${bot.couleur};display:block;margin-top:2px}
.rating-stars{display:flex;justify-content:center;gap:8px;padding:8px 12px}
.star-btn{font-size:26px;background:none;border:none;cursor:pointer;transition:transform .15s}
.star-btn:hover{transform:scale(1.2)}
.qr{padding:8px 12px;display:flex;flex-wrap:wrap;gap:7px;background:#fff;border-top:1px solid #e5e7eb;flex-shrink:0}
.qb{padding:7px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid ${bot.couleur}33;background:${bot.couleur}0d;color:${bot.couleur};font-family:inherit}
.qb:active{background:${bot.couleur};color:#fff}
.ir{padding:10px 12px;display:flex;gap:8px;background:#fff;border-top:1px solid #e5e7eb;flex-shrink:0}
.inp{flex:1;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:24px;padding:10px 16px;font-size:14px;font-family:inherit;outline:none}
.inp:focus{border-color:${bot.couleur}}
.snd{width:42px;height:42px;border-radius:50%;background:${bot.couleur};border:none;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px ${bot.couleur}55}
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
  ${bot.logo_url ? `<img class="hd-logo" src="${bot.logo_url}" alt="${bot.nom}"/>` : `<div class="hd-ava">${bot.emoji}</div>`}
  <div>
    <div class="hd-nm">${bot.nom}</div>
    <div class="hd-st"><span class="hd-dot"></span>En ligne — wolof & français</div>
  </div>
  <div class="hd-right">
    <a href="/dashboard/${bot.id}" class="hd-btn" target="_blank">📊</a>
  </div>
</div>

<div class="msgs" id="msgs">
  <div class="msg">
    <div class="av">${bot.logo_url?`<img src="${bot.logo_url}" alt="${bot.nom}"/>`:`${bot.emoji}`}</div>
    <div class="bub b">Asalaa maalekum! 👋 Bienvenue chez <strong>${bot.nom}</strong>.<br><br>Comment puis-je vous aider aujourd'hui?</div>
  </div>
</div>

<div class="actions" id="actions"></div>
<div class="catalogue" id="catalogue" style="display:none"></div>
<div class="rating-stars" id="rating" style="display:none"></div>

<div class="qr" id="qr">
  ${qr.map(r=>`<button class="qb" onclick="send('${r.replace(/'/g,"\\'")}')">${r}</button>`).join('')}
</div>

<div class="ir">
  <input class="inp" id="inp" placeholder="Écrivez en français ou wolof..." autocomplete="off"/>
  <button class="snd" onclick="send()">➤</button>
</div>
<div class="pw">Propulsé par <a href="${base}" target="_blank">SamaBot IA</a></div>

<script>
var sid='p_'+Math.random().toString(36).substr(2,9);
var botId='${req.params.botId}';
var logoSrc='${bot.logo_url||''}';
var botEmoji='${bot.emoji}';
document.getElementById('inp').onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};

function makeAv(){
  var av=document.createElement('div');av.className='av';
  if(logoSrc){var img=document.createElement('img');img.src=logoSrc;img.alt='';av.appendChild(img);}
  else av.textContent=botEmoji;
  return av;
}

function addMsg(t,isUser){
  var m=document.getElementById('msgs');
  var d=document.createElement('div');d.className='msg'+(isUser?' u':'');
  var b=document.createElement('div');b.className='bub '+(isUser?'u':'b');
  if(isUser)b.textContent=t;
  else b.innerHTML=t.replace(/\\n/g,'<br>').replace(/\\*(.*?)\\*/g,'<strong>$1</strong>');
  if(!isUser)d.appendChild(makeAv());
  d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}

function renderActions(actions){
  var el=document.getElementById('actions');el.innerHTML='';
  if(!actions?.length)return;
  actions.forEach(function(a){
    if(a.type==='rating'){showRating();return;}
    if(a.type==='share'){
      var b=document.createElement('button');b.className='act act-share';b.textContent=a.label;
      b.onclick=function(){if(navigator.share)navigator.share({title:'${bot.nom}',url:window.location.href});else{navigator.clipboard.writeText(window.location.href);alert('✅ Lien copié!');}};
      el.appendChild(b);return;
    }
    if(a.type==='cash'){
      var b=document.createElement('button');b.className='act act-cash';b.textContent=a.label;
      b.onclick=function(){addMsg('✅ Paiement à la livraison noté!',false);el.innerHTML='';};
      el.appendChild(b);return;
    }
    if(!a.url&&a.type==='hours'){var s=document.createElement('span');s.className='act act-hours';s.textContent=a.label;el.appendChild(s);return;}
    if(a.url){var l=document.createElement('a');l.className='act act-'+a.type;l.textContent=a.label;l.href=a.url;l.target='_blank';l.rel='noopener';el.appendChild(l);}
  });
}

function renderCatalogue(items){
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

function send(t){
  var inp=document.getElementById('inp');
  var msg=t||(inp.value.trim());if(!msg)return;
  inp.value='';
  document.getElementById('qr').innerHTML='';
  document.getElementById('actions').innerHTML='';
  document.getElementById('catalogue').style.display='none';
  document.getElementById('rating').style.display='none';
  addMsg(msg,true);
  showTyping();
  fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,botId,sessionId:sid})})
  .then(r=>r.json())
  .then(data=>{
    var ty=document.getElementById('typing');if(ty)ty.remove();
    addMsg(data.reply||'Désolé, erreur.',false);
    if(data.actions?.length)renderActions(data.actions);
    if(data.catalogue?.length)renderCatalogue(data.catalogue);
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
    const [bots, users, msgs] = await Promise.all([
      db.select('bots','?actif=eq.true&order=created_at.desc'),
      db.select('users','?order=created_at.desc'),
      db.select('messages','?order=created_at.desc&limit=20')
    ]);
    const commandes = await db.select('commandes','?order=created_at.desc&limit=50');
    const msgsToday = msgs?.filter(m=>new Date(m.created_at)>new Date(Date.now()-86400000)).length||0;
    const revenu = commandes?.filter(c=>c.statut==='paid').reduce((s,c)=>s+c.total,0)||0;
    res.json({ stats:{total_users:users?.length||0,total_bots:bots?.length||0,messages_today:msgsToday,total_revenue:revenu}, bots:bots||[], users:users||[], recent_messages:msgs||[], commandes:commandes||[] });
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ============================================
// WEBHOOK META
// ============================================
app.get('/webhook', (req, res) => {
  if(req.query['hub.mode']==='subscribe'&&req.query['hub.verify_token']===CONFIG.META_VERIFY_TOKEN)
    res.status(200).send(req.query['hub.challenge']);
  else res.sendStatus(403);
});
app.post('/webhook', (req, res) => { res.sendStatus(200); });

// ============================================
// STATUS
// ============================================
app.get('/', (req, res) => res.json({
  app:'🤖 SamaBot IA', version:'4.0', status:'active',
  features:['paiement-wave','paiement-om','logo-client','catalogue-produits','dashboard-client','avis-clients','qr-code','commandes','notifications','widget-universel','wolof-francais']
}));

app.get('/privacy', (req, res) => res.send('<html><body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px"><h1 style="color:#00c875">Politique de confidentialité — SamaBot</h1><p style="margin-top:16px;line-height:1.7">SamaBot collecte uniquement les messages nécessaires au fonctionnement du chatbot. Les données ne sont jamais revendues. Contact: gakououssou@gmail.com</p></body></html>'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 SamaBot v4.0 — port ${PORT}`);
  console.log(`🔧 Setup: ${CONFIG.BASE_URL}/setup`);
  console.log(`📊 Admin: ${CONFIG.BASE_URL}/admin/stats`);
});
