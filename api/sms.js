const MAKE_WEBHOOK = "https://hook.us2.make.com/nyopjdofnk8r7rnfy5rksj6qbwd9et";

const conversations = {};
const followUpSchedule = {};

const SYSTEM = `You are Sofia, a friendly acquisition assistant for D&O Property Group, a real estate company in Houston TX run by Diego. Your only job is to qualify sellers and either book a call with Diego OR close a deal over text.

LANGUAGE RULE: Detect the language of the seller's very first message and respond in that exact language for the ENTIRE conversation. Spanish stays Spanish. English stays English. Never mix. Never ask.

Ask ONE question at a time. 2-3 sentences max. Sound like a real human texting. Never mention ARV, MAO, or formulas to the seller.

OPENING FLOW:
STEP A — Seller gives their name (or confirms it).
STEP B — Ask ONLY: "Quick question — are you the owner of the property, or are you a property manager or agent?"

IF OWNER: Collect address, motivation, timeline, condition, asking price, mortgage balance. Then ask if they prefer a call with Diego or a text offer.
IF AGENT/MANAGER: Ask if owner is open to cash offer below market. Collect contact info. Output LEAD tag with preference=AGENT-REFERRAL.

PHONE CALL PATH: Confirm time, end with "Perfect! Diego will call you at [TIME]."
TEXT OFFER PATH: Offer MAO_LOW=asking x 0.55 to MAO_HIGH=asking x 0.65. Negotiate, make seller say no 3 times before giving up.

When deal confirmed output: [LEAD name=X address=X motivation=X timeline=X condition=X asking=X owed=X calltime=X preference=X email=X]`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const from = req.body.From;
  const message = req.body.Body;

  if (!from || !message) return res.status(400).end();

  if (!conversations[from]) conversations[from] = [];
  conversations[from].push({ role: "user", content: message });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: SYSTEM,
        messages: conversations[from]
      })
    });

    const data = await response.json();
    const reply = data.content[0].text;
    conversations[from].push({ role: "assistant", content: reply });

    const leadMatch = reply.match(/\[LEAD([^\]]+)\]/);
    if (leadMatch) {
      const raw = leadMatch[1];
      const get = k => { const r = raw.match(new RegExp(k + "=([^=\\[\\]]+?)(?=\\s+\\w+=|$)")); return r ? r[1].trim() : null; };
      const lead = {
        date: new Date().toLocaleDateString(),
        name:
