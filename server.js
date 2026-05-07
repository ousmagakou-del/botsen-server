const express = require('express');
const app = express();
app.use(express.json());

const CONFIG = {
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'botsen_verify_2025',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
  OPENAI_API_KEY:    process.env.OPENAI_API_KEY,
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
};

const BOTS = {
  restaurant_teranga: {
    niche: 'restaurant',
    nom: 'Restaurant Teranga',
    pageId: process.env.PAGE_ID_RESTAURANT,
    prompt: `Tu es le bot WhatsApp/Instagram de Restaurant Teranga à Dakar, Sénégal.
Tu parles français et wolof naturellement. Détecte la langue du client et réponds dans sa langue.
Tu es chaleureux, professionnel et efficace.

Informations:
- Adresse: Dakar Plateau
- Horaires: Lundi-Vendredi 11h-22h, Weekend 10h-23h
- Livraison: disponible, frais 500 FCFA, délai 30-45 min

Menu:
- Thiéboudienne: 2 500 FCFA
- Yassa poulet: 2 000 FCFA
- Mafé: 2 200 FCFA
- Thiébou dieun: 2 800 FCFA
- Salade Teranga: 1 500 FCFA

Tu peux: donner le menu, prendre les commandes, donner les horaires, informer sur la livraison, prendre des réservations.
Si le client commande, récapitule la commande et le total.
Réponds toujours en moins de 3 phrases courtes.`,
    canal: 'instagram'
  },

  salon_fatou: {
    niche: 'salon',
    nom: 'Salon Fatou Beauty',
    pageId: process.env.PAGE_ID_SALON,
    prompt: `Tu es le bot Instagram de Salon Fatou Beauty à Dakar, Sénégal.
Tu parles français et wolof. Tu es accueillant et professionnel.

Informations:
- Adresse: Almadies, Rue 10
- Horaires: 9h-20h, 7 jours/7

Services:
- Coupe simple: 5 000 FCFA
- Coiffure complète: 12 000 FCFA
- Tressage: dès 10 000 FCFA
- Soin cheveux: 8 000 FCFA
- Manucure: 3 000 FCFA

Réponds en moins de 3 phrases. Propose toujours de prendre RDV.`,
    canal: 'instagram'
  },

  clinique_sante: {
    niche: 'clinique',
    nom: 'Clinique Santé Plus',
    pageId: process.env.PAGE_ID_CLINIQUE,
    prompt: `Tu es le bot WhatsApp de Clinique Santé Plus à Dakar, Sénégal.
Tu parles français et wolof. Tu es professionnel et rassurant.

Informations:
- Adresse: Mermoz, Dakar
- Consultations: 8h-20h
- Urgences: 24h/24 — Tel: +221 33 xxx xxxx

Services:
- Médecine générale: 10 000 FCFA
- Dentiste: 15 000 FCFA
- Pédiatrie: 12 000 FCFA

IMPORTANT: Pour toute urgence grave, donne immédiatement le numéro d'urgence.
Réponds en moins de 3 phrases. Propose toujours de prendre RDV.`,
    canal: 'whatsapp'
  }
};

const conversations = {};

function getHistory(userId) {
  if (!conversations[userId]) conversations[userId] = [];
  return conversations[userId];
}

function addToHistory(userId, role, content) {
  const history = getHistory(userId);
  history.push({ role, content });
  if (history.length > 10) history.shift();
}

async function callOpenAI(botConfig, userId, userMessage) {
  const history = getHistory(userId);
  addToHistory(userId, 'user', userMessage);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: botConfig.prompt },
        ...history
      ],
      max_tokens: 300,
      temperature: 0.7
    })
  });

  const data = await response.json();
  const reply = data.choices[0].message.content;
  addToHistory(userId, 'assistant', reply);
  return reply;
}

async function sendInstagramMessage(recipientId, message) {
  const url = `https://graph.facebook.com/v18.0/me/messages`;
  console.log(`📤 Envoi Instagram à ${recipientId}`);
  console.log(`🔑 Token: ${CONFIG.META_ACCESS_TOKEN ? CONFIG.META_ACCESS_TOKEN.substring(0,20) + '...' : 'MANQUANT!'}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.META_ACCESS_TOKEN}`
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message }
    })
  });

  const result = await response.json();
  console.log(`📤 Meta résultat:`, JSON.stringify(result));
  return result;
}

async function sendWhatsAppMessage(to, message) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${CONFIG.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.META_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    }
  );
  const result = await response.json();
  console.log(`📤 WhatsApp résultat:`, JSON.stringify(result));
  return result;
}

function findBot(pageId) {
  return Object.values(BOTS).find(b => b.pageId === pageId) || BOTS.restaurant_teranga;
}

app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.META_VERIFY_TOKEN) {
    console.log('✅ Webhook vérifié par Meta');
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
      const entry     = body.entry?.[0];
      const messaging = entry?.messaging?.[0];

      if (messaging?.message?.text) {
        const senderId = messaging.sender.id;
        const message  = messaging.message.text;
        const pageId   = entry.id;

        console.log(`📩 Instagram [${pageId}] de ${senderId}: ${message}`);

        const botConfig = findBot(pageId);
        const reply     = await callOpenAI(botConfig, senderId, message);
        console.log(`✅ Réponse OpenAI: ${reply}`);
        await sendInstagramMessage(senderId, reply);
      }
    }

    if (body.object === 'whatsapp_business_account') {
      const entry   = body.entry?.[0];
      const change  = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      if (message?.type === 'text') {
        const from   = message.from;
        const text   = message.text.body;
        const pageId = change?.value?.metadata?.phone_number_id;

        console.log(`📩 WhatsApp [${pageId}] de ${from}: ${text}`);

        const botConfig = findBot(pageId);
        const reply     = await callOpenAI(botConfig, from, text);
        console.log(`✅ Réponse OpenAI: ${reply}`);
        await sendWhatsAppMessage(from, reply);
      }
    }

  } catch (error) {
    console.error('❌ Erreur complète:', error.message, error.stack);
  }
});

app.get('/', (req, res) => {
  res.json({
    status: '🚀 BotSen Server actif',
    bots: Object.keys(BOTS).length,
    message: 'Plateforme chatbots IA — Sénégal'
  });
});

app.get('/bots', (req, res) => {
  res.json(Object.entries(BOTS).map(([id, bot]) => ({
    id, nom: bot.nom, niche: bot.niche, canal: bot.canal
  })));
});

app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Politique de confidentialité — BotSen</title>
      <style>
        body { font-family: sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
        h1 { color: #00c875; }
        h2 { margin-top: 30px; }
      </style>
    </head>
    <body>
      <h1>Politique de confidentialité — BotSen</h1>
      <p>Dernière mise à jour : Mai 2025</p>
      <h2>1. Collecte des données</h2>
      <p>BotSen collecte uniquement les messages nécessaires au fonctionnement du chatbot.</p>
      <h2>2. Utilisation des données</h2>
      <p>Les données sont utilisées exclusivement pour générer des réponses automatiques.</p>
      <h2>3. Partage des données</h2>
      <p>Les données ne sont pas partagées avec des tiers, sauf OpenAI pour la génération de réponses.</p>
      <h2>4. Conservation des données</h2>
      <p>Les conversations sont supprimées automatiquement après chaque session.</p>
      <h2>5. Contact</h2>
      <p>Email: <a href="mailto:gakououssou@gmail.com">gakououssou@gmail.com</a></p>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 BotSen démarré sur port ${PORT}`);
  console.log(`📡 Webhook: https://TON-APP.railway.app/webhook`);
  console.log(`🤖 Bots: ${Object.keys(BOTS).length}`);
});
