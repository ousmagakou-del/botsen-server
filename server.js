const express = require('express');
const app = express();
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  OPENAI_API_KEY:      process.env.OPENAI_API_KEY,
  SUPABASE_URL:        process.env.SUPABASE_URL || 'https://qymbvpevaobeadslmjah.supabase.co',
  SUPABASE_ANON_KEY:   process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  META_VERIFY_TOKEN:   process.env.META_VERIFY_TOKEN || 'samabot_verify_2025',
  META_ACCESS_TOKEN:   process.env.META_ACCESS_TOKEN,
};

// ============================================
// SUPABASE CLIENT
// ============================================
async function supabase(table, method = 'GET', data = null, query = '') {
  const key = CONFIG.SUPABASE_SERVICE_KEY || CONFIG.SUPABASE_ANON_KEY;
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/${table}${query}`;

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': method === 'POST' ? 'return=representation' : 'return=representation'
    }
  };

  if (data) opts.body = JSON.stringify(data);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Helpers Supabase
const db = {
  select: (table, query = '') => supabase(table, 'GET', null, query),
  insert: (table, data) => supabase(table, 'POST', data),
  update: (table, data, query) => supabase(table, 'PATCH', data, query),
  delete: (table, query) => supabase(table, 'DELETE', null, query),
  upsert: (table, data) => supabase(table, 'POST', data, '?on_conflict=id'),
};

// ============================================
// HISTORIQUE CONVERSATIONS (en mémoire pour la session)
// Les messages sont aussi sauvés en DB
// ============================================
const sessionHistory = {};

function getHistory(sessionId) {
  if (!sessionHistory[sessionId]) sessionHistory[sessionId] = [];
  return sessionHistory[sessionId];
}

function addToHistory(sessionId, role, content) {
  const h = getHistory(sessionId);
  h.push({ role, content });
  if (h.length > 12) h.shift();
}

// ============================================
// OPENAI
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
  if (!data.choices?.[0]) throw new Error('OpenAI: ' + JSON.stringify(data));
  const reply = data.choices[0].message.content;
  addToHistory(sessionId, 'assistant', reply);
  return reply;
}

// ============================================
// HELPERS
// ============================================
function getNicheEmoji(niche) {
  const map = { restaurant:'🍽️', salon:'💈', clinique:'🏥', boutique:'🛍️', 'auto-ecole':'🚗', pharmacie:'💊', immobilier:'🏠', default:'🤖' };
  return map[niche] || map.default;
}

function getQuickReplies(niche) {
  const map = {
    restaurant: ['🍛 Menu', '📦 Commander', '🛵 Livraison', '🕐 Horaires'],
    salon: ['📅 RDV', '💅 Services', '💰 Tarifs', '📍 Adresse'],
    clinique: ['🚨 Urgence', '📅 RDV', '👨‍⚕️ Médecins', '💰 Tarifs'],
    boutique: ['✨ Nouveautés', '🔥 Promos', '📦 Commander', '🚚 Livraison'],
    'auto-ecole': ['📝 Inscription', '💰 Tarifs', '📅 Calendrier', '📍 Adresse'],
    pharmacie: ['💊 Médicament', '🕐 Horaires', '📍 Adresse', '📞 Contact'],
  };
  return map[niche] || ['💬 Aide', 'ℹ️ Infos', '📞 Contact'];
}

function generateBotId(nom) {
  return nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-').substring(0, 30) + '-' + Date.now().toString(36);
}

function generatePrompt(nom, niche, adresse, horaires, services) {
  return `Tu es le bot IA de ${nom} à Dakar, Sénégal.
Tu parles français et wolof naturellement. Détecte la langue du client et réponds dans sa langue.
Tu es professionnel, chaleureux et efficace. Réponds toujours en 2-3 phrases maximum.

Informations:
- Nom: ${nom}
- Secteur: ${niche}
${adresse ? `- Adresse: ${adresse}` : ''}
${horaires ? `- Horaires: ${horaires}` : ''}
${services ? `- Services/Produits: ${services}` : ''}

Aide les clients avec leurs questions. Si tu ne sais pas, dis-le poliment.`;
}

// ============================================
// API CHAT — Le cœur du système
// ============================================
app.post('/chat', async (req, res) => {
  try {
    const { message, botId, sessionId } = req.body;
    if (!message || !botId) return res.status(400).json({ error: 'message et botId requis' });

    // Récupère le bot depuis Supabase
    const bots = await db.select('bots', `?id=eq.${botId}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });

    const bot = bots[0];
    const sid = sessionId || `${botId}_${Date.now()}`;

    // Génère la réponse IA
    const reply = await callOpenAI(bot.prompt, sid, message);

    // Sauvegarde en DB (async, ne bloque pas la réponse)
    saveMessage(botId, sid, message, reply).catch(e => console.error('Save error:', e));

    res.json({
      reply,
      bot: { nom: bot.nom, emoji: bot.emoji, couleur: bot.couleur }
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

async function saveMessage(botId, sessionId, userMsg, botReply) {
  try {
    // Trouve ou crée la conversation
    let convs = await db.select('conversations', `?bot_id=eq.${botId}&session_id=eq.${sessionId}`);
    let convId;

    if (!convs?.length) {
      const newConv = await db.insert('conversations', {
        bot_id: botId,
        session_id: sessionId,
        canal: 'web',
        messages_count: 0
      });
      convId = newConv?.[0]?.id;
    } else {
      convId = convs[0].id;
      await db.update('conversations', { last_message_at: new Date().toISOString() }, `?id=eq.${convId}`);
    }

    if (!convId) return;

    // Sauvegarde les messages
    await db.insert('messages', { conversation_id: convId, bot_id: botId, role: 'user', content: userMsg });
    await db.insert('messages', { conversation_id: convId, bot_id: botId, role: 'assistant', content: botReply });

    // Incrémente le compteur
    await db.update('bots', { messages_count: undefined }, `?id=eq.${botId}`);

  } catch (e) {
    console.error('saveMessage error:', e.message);
  }
}

// ============================================
// API BOT — Infos publiques
// ============================================
app.get('/bot/:id', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.id}&actif=eq.true`);
    if (!bots?.length) return res.status(404).json({ error: 'Bot non trouvé' });

    const bot = bots[0];
    res.json({
      nom: bot.nom,
      emoji: bot.emoji,
      couleur: bot.couleur,
      niche: bot.niche,
      welcome: `Asalaa maalekum! 👋 Bienvenue chez ${bot.nom}. Comment puis-je vous aider?`,
      quickReplies: getQuickReplies(bot.niche)
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// API ONBOARDING — Créer un bot
// ============================================
app.post('/bot/create', async (req, res) => {
  try {
    const { nom, niche, adresse, horaires, services, couleur, email, userId } = req.body;
    if (!nom || !niche) return res.status(400).json({ error: 'nom et niche requis' });

    const id = generateBotId(nom);
    const emoji = getNicheEmoji(niche);
    const prompt = generatePrompt(nom, niche, adresse, horaires, services);

    // Si email fourni → crée ou trouve l'utilisateur
    let user_id = userId || '00000000-0000-0000-0000-000000000001';
    if (email && !userId) {
      const existing = await db.select('users', `?email=eq.${email}`);
      if (existing?.length) {
        user_id = existing[0].id;
      } else {
        const newUser = await db.insert('users', {
          email, nom: nom + ' (owner)', plan: 'free'
        });
        user_id = newUser?.[0]?.id || user_id;
      }
    }

    await db.insert('bots', {
      id, user_id, nom, niche,
      couleur: couleur || '#00c875',
      emoji, prompt, actif: true,
      adresse: adresse || null,
      horaires: horaires || null,
      services: services || null,
    });

    console.log(`✅ Bot créé: ${nom} (${id})`);

    const baseUrl = 'https://botsen-server-production.up.railway.app';
    res.json({
      success: true,
      botId: id,
      chatUrl: `${baseUrl}/chat/${id}`,
      widgetCode: `<!-- SamaBot Widget — ${nom} -->\n<script>\n  window.SamaBotConfig = { botId: '${id}', couleur: '${couleur || '#00c875'}' };\n</script>\n<script src="${baseUrl}/widget.js" async></script>`
    });

  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({ error: 'Erreur création: ' + error.message });
  }
});

// ============================================
// API ADMIN — Stats et gestion
// ============================================

// Stats globales
app.get('/admin/stats', async (req, res) => {
  try {
    const [users, bots, msgs] = await Promise.all([
      db.select('users', '?select=count'),
      db.select('bots', '?actif=eq.true&select=count'),
      db.select('messages', `?created_at=gte.${new Date(Date.now() - 86400000).toISOString()}&select=count`)
    ]);

    const allBots = await db.select('bots', '?actif=eq.true&select=id,nom,niche,messages_count,couleur,emoji,created_at');
    const allUsers = await db.select('users', '?select=id,nom,email,plan,actif,created_at&order=created_at.desc');
    const recentMsgs = await db.select('messages', '?select=content,role,created_at,bot_id&order=created_at.desc&limit=20');

    res.json({
      stats: {
        total_users: allUsers?.length || 0,
        total_bots: allBots?.length || 0,
        messages_today: recentMsgs?.filter(m => new Date(m.created_at) > new Date(Date.now() - 86400000)).length || 0,
      },
      bots: allBots || [],
      users: allUsers || [],
      recent_messages: recentMsgs || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stats d'un bot spécifique
app.get('/admin/bot/:id/stats', async (req, res) => {
  try {
    const [bot, convs, msgs] = await Promise.all([
      db.select('bots', `?id=eq.${req.params.id}`),
      db.select('conversations', `?bot_id=eq.${req.params.id}&order=last_message_at.desc&limit=20`),
      db.select('messages', `?bot_id=eq.${req.params.id}&order=created_at.desc&limit=50`)
    ]);

    res.json({
      bot: bot?.[0] || null,
      conversations: convs || [],
      messages: msgs || [],
      total_conversations: convs?.length || 0,
      total_messages: msgs?.length || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liste tous les bots
app.get('/admin/bots', async (req, res) => {
  try {
    const bots = await db.select('bots', '?order=created_at.desc');
    res.json(bots || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activer/désactiver un bot
app.patch('/admin/bot/:id', async (req, res) => {
  try {
    await db.update('bots', req.body, `?id=eq.${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WIDGET.JS — Script universel
// ============================================
app.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  const baseUrl = 'https://botsen-server-production.up.railway.app';

  res.send(`
(function() {
  var cfg = window.SamaBotConfig || window.BotSenConfig || {};
  var botId = cfg.botId || cfg.bot_id || 'default';
  var couleur = cfg.couleur || '#00c875';
  var base = '${baseUrl}';
  var sid = 'w_' + Math.random().toString(36).substr(2,9);
  var botInfo = null;
  var open = false;

  var css = document.createElement('style');
  css.textContent = '.sb-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:' + couleur + ';display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.2);z-index:2147483647;border:none;transition:transform .2s;animation:sbBounce 1s ease 2s both}.sb-btn:hover{transform:scale(1.1)}.sb-notif{position:absolute;top:-2px;right:-2px;width:16px;height:16px;background:#22c55e;border-radius:50%;border:2px solid #fff}.sb-win{position:fixed;bottom:90px;right:24px;width:340px;max-height:480px;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,0.18);z-index:2147483646;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,sans-serif}.sb-win.open{display:flex;animation:sbSlide .3s ease}@keyframes sbSlide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes sbBounce{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}.sb-head{background:' + couleur + ';padding:14px 16px;display:flex;align-items:center;gap:10px}.sb-ava{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px}.sb-hn{font-size:14px;font-weight:700;color:#fff}.sb-hs{font-size:11px;color:rgba(255,255,255,.8);margin-top:2px}.sb-x{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:18px;padding:2px}.sb-msgs{flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;background:#f8f9fa}.sb-msg{display:flex;gap:6px;align-items:flex-end}.sb-msg.u{flex-direction:row-reverse}.sb-bub{padding:9px 13px;font-size:13px;line-height:1.5;max-width:80%;border-radius:14px}.sb-bub.b{background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:3px 14px 14px 14px}.sb-bub.u{background:' + couleur + ';color:#fff;border-radius:14px 14px 3px 14px}.sb-av{width:26px;height:26px;border-radius:50%;background:' + couleur + ';display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}.sb-qr{padding:8px 10px;display:flex;flex-wrap:wrap;gap:5px;background:#fff;border-top:1px solid #e5e7eb}.sb-qb{padding:4px 10px;border-radius:14px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ' + couleur + '44;background:' + couleur + '11;color:' + couleur + ';font-family:inherit;transition:all .15s}.sb-qb:hover{background:' + couleur + ';color:#fff}.sb-inp{padding:10px;display:flex;gap:8px;border-top:1px solid #e5e7eb;background:#fff}.sb-input{flex:1;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:18px;padding:8px 14px;font-size:13px;font-family:inherit;outline:none}.sb-input:focus{border-color:' + couleur + '}.sb-send{width:34px;height:34px;border-radius:50%;background:' + couleur + ';border:none;cursor:pointer;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.sb-pw{text-align:center;padding:5px;font-size:10px;color:#9ca3af;background:#fff;border-top:1px solid #f3f4f6}@media(max-width:480px){.sb-win{width:calc(100vw - 32px);right:16px;bottom:88px}}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'sb-btn';
  btn.innerHTML = '<span id="sb-ico">💬</span><div class="sb-notif" id="sb-notif"></div>';
  btn.onclick = function() {
    open = !open;
    win.classList.toggle('open', open);
    document.getElementById('sb-notif').style.display = 'none';
  };

  var win = document.createElement('div');
  win.className = 'sb-win';
  win.innerHTML = '<div class="sb-head"><div class="sb-ava" id="sb-ava">🤖</div><div><div class="sb-hn" id="sb-hn">SamaBot</div><div class="sb-hs">● En ligne — wolof & français</div></div><button class="sb-x" onclick="document.querySelector(\'.sb-win\').classList.remove(\'open\')">✕</button></div><div class="sb-msgs" id="sb-msgs"></div><div class="sb-qr" id="sb-qr"></div><div class="sb-inp"><input class="sb-input" id="sb-inp" placeholder="Écrivez en français ou wolof..."/><button class="sb-send" onclick="sbSend()">➤</button></div><div class="sb-pw">Propulsé par <strong style="color:' + couleur + '">SamaBot IA</strong></div>';

  document.body.appendChild(btn);
  document.body.appendChild(win);

  document.getElementById('sb-inp').onkeydown = function(e) { if(e.key==='Enter') sbSend(); };

  fetch(base + '/bot/' + botId).then(function(r){return r.json();}).then(function(d){
    if(d.nom){
      botInfo = d;
      document.getElementById('sb-hn').textContent = d.nom;
      document.getElementById('sb-ava').textContent = d.emoji||'🤖';
      document.getElementById('sb-ico').textContent = d.emoji||'💬';
      addB(d.welcome||('Asalaa maalekum! 👋 Bienvenue chez '+d.nom+'. Comment puis-je vous aider?'));
      if(d.quickReplies) renderQR(d.quickReplies);
    }
  }).catch(function(){addB('Asalaa maalekum! 👋 Comment puis-je vous aider aujourd\\'hui?');});

  function addB(t){
    var m=document.getElementById('sb-msgs');
    var d=document.createElement('div');d.className='sb-msg';
    var a=document.createElement('div');a.className='sb-av';a.textContent=botInfo?.emoji||'🤖';
    var b=document.createElement('div');b.className='sb-bub b';b.innerHTML=t.replace(/\\n/g,'<br>');
    d.appendChild(a);d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
  }
  function addU(t){
    var m=document.getElementById('sb-msgs');
    var d=document.createElement('div');d.className='sb-msg u';
    var b=document.createElement('div');b.className='sb-bub u';b.textContent=t;
    d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
  }
  function renderQR(rs){
    var qr=document.getElementById('sb-qr');qr.innerHTML='';
    rs.forEach(function(r){var b=document.createElement('button');b.className='sb-qb';b.textContent=r;b.onclick=function(){sbSend(r);};qr.appendChild(b);});
  }
  window.sbSend=function(t){
    var inp=document.getElementById('sb-inp');
    var msg=t||(inp?inp.value.trim():'');
    if(!msg)return;
    if(inp)inp.value='';
    document.getElementById('sb-qr').innerHTML='';
    addU(msg);
    var m=document.getElementById('sb-msgs');
    var ty=document.createElement('div');ty.className='sb-msg';ty.id='sb-ty';
    ty.innerHTML='<div class="sb-av">'+(botInfo?.emoji||'🤖')+'</div><div class="sb-bub b" style="padding:12px 16px"><span style="display:flex;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#ccc;animation:sbD 1s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ccc;animation:sbD 1s .2s infinite"></span><span style="width:6px;height:6px;border-radius:50%;background:#ccc;animation:sbD 1s .4s infinite"></span></span></div>';
    if(!document.getElementById('sb-d-css')){var s=document.createElement('style');s.id='sb-d-css';s.textContent='@keyframes sbD{0%,80%,100%{opacity:.3}40%{opacity:1}}';document.head.appendChild(s);}
    m.appendChild(ty);m.scrollTop=m.scrollHeight;
    fetch(base+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,botId:botId,sessionId:sid})})
    .then(function(r){return r.json();})
    .then(function(d){var t=document.getElementById('sb-ty');if(t)t.remove();addB(d.reply||'Désolé, erreur.');})
    .catch(function(){var t=document.getElementById('sb-ty');if(t)t.remove();addB('Désolé, une erreur est survenue.');});
  };
})();
  `);
});

// ============================================
// PAGE CHAT DÉDIÉE
// ============================================
app.get('/chat/:botId', async (req, res) => {
  try {
    const bots = await db.select('bots', `?id=eq.${req.params.botId}&actif=eq.true`);
    const bot = bots?.[0] || { nom: 'SamaBot', couleur: '#00c875', emoji: '🤖', niche: 'default' };
    const qr = getQuickReplies(bot.niche);

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0">
<title>${bot.nom} — SamaBot IA</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'DM Sans',sans-serif;background:#f0f2f0;display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto}
.hd{background:${bot.couleur};padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.hd-av{width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px}
.hd-nm{font-size:16px;font-weight:700;color:#fff}
.hd-st{font-size:12px;color:rgba(255,255,255,.8);margin-top:2px;display:flex;align-items:center;gap:5px}
.hd-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.msgs{flex:1;padding:14px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.msg{display:flex;gap:8px;align-items:flex-end}
.msg.u{flex-direction:row-reverse}
.bub{padding:10px 14px;font-size:14px;line-height:1.5;max-width:80%;border-radius:16px}
.bub.b{background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:3px 16px 16px 16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.bub.u{background:${bot.couleur};color:#fff;border-radius:16px 16px 3px 16px}
.av{width:30px;height:30px;border-radius:50%;background:${bot.couleur};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.qr{padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px;background:#fff;border-top:1px solid #e5e7eb}
.qb{padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1.5px solid ${bot.couleur}44;background:${bot.couleur}11;color:${bot.couleur};font-family:inherit;transition:all .15s}
.qb:hover{background:${bot.couleur};color:#fff}
.ir{padding:12px;display:flex;gap:8px;background:#fff;border-top:1px solid #e5e7eb}
.inp{flex:1;background:#f3f4f6;border:1.5px solid #e5e7eb;border-radius:24px;padding:10px 18px;font-size:14px;font-family:inherit;outline:none}
.inp:focus{border-color:${bot.couleur}}
.snd{width:42px;height:42px;border-radius:50%;background:${bot.couleur};border:none;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pw{text-align:center;padding:6px;font-size:11px;color:#9ca3af;background:#fff}
.pw span{color:${bot.couleur};font-weight:700}
</style>
</head>
<body>
<div class="hd">
  <div class="hd-av">${bot.emoji}</div>
  <div>
    <div class="hd-nm">${bot.nom}</div>
    <div class="hd-st"><span class="hd-dot"></span>En ligne — wolof & français</div>
  </div>
</div>
<div class="msgs" id="msgs">
  <div class="msg">
    <div class="av">${bot.emoji}</div>
    <div class="bub b">Asalaa maalekum! 👋 Bienvenue chez ${bot.nom}.<br><br>Comment puis-je vous aider aujourd'hui?</div>
  </div>
</div>
<div class="qr" id="qr">
  ${qr.map(r => `<button class="qb" onclick="send('${r}')">${r}</button>`).join('')}
</div>
<div class="ir">
  <input class="inp" id="inp" placeholder="Écrivez en français ou wolof..."/>
  <button class="snd" onclick="send()">➤</button>
</div>
<div class="pw">Propulsé par <span>SamaBot IA</span></div>
<script>
var sid='p_'+Math.random().toString(36).substr(2,8);
document.getElementById('inp').onkeydown=function(e){if(e.key==='Enter')send();};
function addM(t,u){
  var m=document.getElementById('msgs');
  var d=document.createElement('div');d.className='msg'+(u?' u':'');
  var b=document.createElement('div');b.className='bub '+(u?'u':'b');
  b.innerHTML=u?t:t.replace(/\\n/g,'<br>');
  if(!u){var a=document.createElement('div');a.className='av';a.textContent='${bot.emoji}';d.appendChild(a);}
  d.appendChild(b);m.appendChild(d);m.scrollTop=m.scrollHeight;
}
function send(t){
  var inp=document.getElementById('inp');
  var msg=t||(inp.value.trim());if(!msg)return;
  inp.value='';document.getElementById('qr').innerHTML='';
  addM(msg,true);
  fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,botId:'${req.params.botId}',sessionId:sid})})
  .then(r=>r.json()).then(d=>addM(d.reply||'Désolé, erreur.',false))
  .catch(()=>addM('Désolé, une erreur est survenue.',false));
}
</script>
</body>
</html>`);
  } catch (error) {
    res.status(500).send('Erreur serveur');
  }
});

// ============================================
// PAGE SETUP — Onboarding self-service
// ============================================
app.get('/setup', (req, res) => {
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
.logo{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff}
.logo span{color:#00c875}
.wrap{max-width:560px;margin:0 auto;padding:28px 20px}
h1{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:#0a1a0f;margin-bottom:6px}
.sub{font-size:14px;color:#5a7060;margin-bottom:28px}
.card{background:#fff;border-radius:16px;padding:22px;margin-bottom:18px;border:1px solid rgba(0,200,117,.15)}
.ctitle{font-size:15px;font-weight:700;color:#0a1a0f;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.num{width:26px;height:26px;border-radius:50%;background:#00c875;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
label{font-size:12px;font-weight:600;color:#3a5040;display:block;margin-bottom:5px}
input,select,textarea{width:100%;border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 14px;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;color:#0a1a0f;transition:border .15s}
input:focus,select:focus,textarea:focus{border-color:#00c875}
textarea{min-height:90px;resize:vertical}
.f{margin-bottom:12px}
.niches{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.n{border:1.5px solid #d1e5d8;border-radius:10px;padding:10px 6px;text-align:center;cursor:pointer;transition:all .15s}
.n:hover{border-color:#00c875;background:#f0faf4}
.n.s{border-color:#00c875;background:rgba(0,200,117,.1)}
.ne{font-size:22px;display:block;margin-bottom:3px}
.nn{font-size:11px;font-weight:600;color:#0a1a0f}
.cols{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.co{width:34px;height:34px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:all .15s}
.co.s{border-color:#0a1a0f;transform:scale(1.15)}
.sbtn{width:100%;background:#00c875;color:#fff;border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;margin-top:6px}
.sbtn:hover{background:#00a862}
.sbtn:disabled{opacity:.6;cursor:not-allowed}
.res{background:#0a1a0f;border-radius:16px;padding:22px;display:none}
.res.show{display:block}
.rt{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:16px}
.rl{font-size:11px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}
.rv{background:rgba(255,255,255,.07);border-radius:8px;padding:10px 12px;font-size:12px;color:#fff;word-break:break-all;line-height:1.6}
.cp{background:rgba(0,200,117,.15);color:#00c875;border:1px solid rgba(0,200,117,.3);border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:6px}
.tb{display:block;background:#00c875;color:#fff;text-decoration:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;text-align:center;margin-top:14px}
.ri{margin-bottom:12px}
</style>
</head>
<body>
<div class="hd"><div class="logo">Sama<span>Bot</span></div></div>
<div class="wrap">
  <h1>Créez votre bot IA</h1>
  <p class="sub">Configurez votre assistant en 2 minutes. Sans technique.</p>

  <div class="card">
    <div class="ctitle"><span class="num">1</span> Votre business</div>
    <div class="f"><label>Nom du business *</label><input id="nom" placeholder="Ex: Restaurant Teranga, Salon Aminata..."/></div>
    <div class="f">
      <label>Type de business *</label>
      <div class="niches" id="niches">
        <div class="n s" data-val="restaurant" onclick="selN(this)"><span class="ne">🍽️</span><div class="nn">Restaurant</div></div>
        <div class="n" data-val="salon" onclick="selN(this)"><span class="ne">💈</span><div class="nn">Salon beauté</div></div>
        <div class="n" data-val="clinique" onclick="selN(this)"><span class="ne">🏥</span><div class="nn">Clinique</div></div>
        <div class="n" data-val="boutique" onclick="selN(this)"><span class="ne">🛍️</span><div class="nn">Boutique</div></div>
        <div class="n" data-val="auto-ecole" onclick="selN(this)"><span class="ne">🚗</span><div class="nn">Auto-école</div></div>
        <div class="n" data-val="autre" onclick="selN(this)"><span class="ne">🏢</span><div class="nn">Autre</div></div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="ctitle"><span class="num">2</span> Informations</div>
    <div class="f"><label>Adresse</label><input id="adr" placeholder="Ex: Dakar Plateau, Almadies..."/></div>
    <div class="f"><label>Horaires</label><input id="hor" placeholder="Ex: Lun-Ven 9h-18h, Weekend 10h-16h"/></div>
    <div class="f"><label>Services / Menu / Produits</label><textarea id="srv" placeholder="Ex: Thiéboudienne 2500F, Yassa 2000F..."></textarea></div>
  </div>

  <div class="card">
    <div class="ctitle"><span class="num">3</span> Couleur du bot</div>
    <div class="cols" id="cols">
      <div class="co s" data-val="#00c875" style="background:#00c875" onclick="selC(this)"></div>
      <div class="co" data-val="#e8531a" style="background:#e8531a" onclick="selC(this)"></div>
      <div class="co" data-val="#d4507a" style="background:#d4507a" onclick="selC(this)"></div>
      <div class="co" data-val="#1a6ab1" style="background:#1a6ab1" onclick="selC(this)"></div>
      <div class="co" data-val="#7c3aed" style="background:#7c3aed" onclick="selC(this)"></div>
      <div class="co" data-val="#0d9488" style="background:#0d9488" onclick="selC(this)"></div>
    </div>
  </div>

  <div class="f"><label style="font-size:13px;color:#5a7060">Email (notifications)</label><input id="eml" type="email" placeholder="votre@email.com"/></div>

  <button class="sbtn" id="sbtn" onclick="create()">🚀 Créer mon bot SamaBot</button>

  <div class="res" id="res">
    <div class="rt">🎉 Votre bot est prêt!</div>
    <div class="ri"><div class="rl">Lien de chat à partager</div><div class="rv" id="r-chat"></div><button class="cp" onclick="cp('r-chat')">📋 Copier le lien</button></div>
    <div class="ri"><div class="rl">Code widget (coller sur votre site)</div><div class="rv" id="r-widget"></div><button class="cp" onclick="cp('r-widget')">📋 Copier le code</button></div>
    <a class="tb" id="r-link" href="#" target="_blank">💬 Tester mon bot maintenant →</a>
  </div>
</div>
<script>
var nv='restaurant', cv='#00c875';
function selN(e){document.querySelectorAll('.n').forEach(x=>x.classList.remove('s'));e.classList.add('s');nv=e.dataset.val;}
function selC(e){document.querySelectorAll('.co').forEach(x=>x.classList.remove('s'));e.classList.add('s');cv=e.dataset.val;}
function cp(id){navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>alert('Copié! ✅'));}
async function create(){
  var nom=document.getElementById('nom').value.trim();
  if(!nom){alert('Entrez le nom de votre business');return;}
  var btn=document.getElementById('sbtn');
  btn.textContent='⏳ Création...';btn.disabled=true;
  try{
    var r=await fetch('/bot/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nom,niche:nv,adresse:document.getElementById('adr').value,horaires:document.getElementById('hor').value,services:document.getElementById('srv').value,couleur:cv,email:document.getElementById('eml').value})});
    var d=await r.json();
    if(d.success){
      document.getElementById('r-chat').textContent=d.chatUrl;
      document.getElementById('r-widget').textContent=d.widgetCode;
      document.getElementById('r-link').href=d.chatUrl;
      var res=document.getElementById('res');res.classList.add('show');res.scrollIntoView({behavior:'smooth'});
    }else{alert('Erreur: '+(d.error||'Réessayez'));}
  }catch(e){alert('Erreur réseau');}
  btn.textContent='🚀 Créer mon bot SamaBot';btn.disabled=false;
}
</script>
</body>
</html>`);
});

// ============================================
// WEBHOOK META
// ============================================
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === CONFIG.META_VERIFY_TOKEN) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object === 'instagram' || body.object === 'page') {
      const messaging = body.entry?.[0]?.messaging?.[0];
      if (messaging?.message?.text) {
        const senderId = messaging.sender.id;
        const message = messaging.message.text;
        console.log(`📩 Instagram de ${senderId}: ${message}`);
      }
    }
  } catch (e) { console.error('Webhook error:', e); }
});

// ============================================
// STATUS & PRIVACY
// ============================================
app.get('/', (req, res) => {
  res.json({
    app: '🤖 SamaBot IA',
    version: '2.0',
    status: 'active',
    endpoints: {
      chat: 'POST /chat',
      widget: 'GET /widget.js',
      setup: 'GET /setup',
      chatPage: 'GET /chat/:botId',
      createBot: 'POST /bot/create',
      botInfo: 'GET /bot/:id',
      adminStats: 'GET /admin/stats'
    }
  });
});

app.get('/privacy', (req, res) => {
  res.send('<h1 style="font-family:sans-serif;color:#00c875">SamaBot — Politique de confidentialité</h1><p style="font-family:sans-serif;max-width:600px;margin:20px auto">SamaBot collecte uniquement les messages nécessaires au fonctionnement du chatbot. Les données ne sont jamais partagées avec des tiers sauf OpenAI pour la génération de réponses. Contact: gakououssou@gmail.com</p>');
});

// ============================================
// DÉMARRAGE
// ============================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🤖 SamaBot v2.0 démarré sur port ${PORT}`);
  console.log(`🗄️  Supabase: ${CONFIG.SUPABASE_URL}`);
  console.log(`🔧 Setup: https://botsen-server-production.up.railway.app/setup`);
});
