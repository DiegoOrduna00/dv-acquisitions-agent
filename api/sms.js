const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAKE_WEBHOOK = "https://hook.us2.make.com/nyopjdofnk8r7rnfy5rksj6qbwd9et";

const conversations = {};

const SYSTEM = `You are Sofia, a friendly acquisition assistant for D&O Property Group, a real estate company in Houston TX run by Diego. Your only job is to qualify sellers and book a 15-minute call with Diego. Ask ONE question at a time. Keep every message 2-3 sentences max. Sound like a real human texting. Never mention ARV, MAO, formulas, or make any offer. Collect in order: name, address, motivation, timeline, condition, asking price, mortgage balance. Then book the call. Confirm a specific time and end with: "Perfect! Diego will call you at [TIME]. No pressure at all, just a quick chat."

When call is confirmed output this at the END of your message:
[LEAD name=X address=X motivation=X timeline=X condition=X asking=X owed=X calltime=X]`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const from = req.body.From;
  const message = req.body.Body;

  if (!conversations[from]) {
    conversations[from] = [];
  }

  conversations[from].push({ role: "user", content: message });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM,
      messages: conversations[from],
    });

    const reply = response.content[0].text;
    conversations[from].push({ role: "assistant", content: reply });

    // Check if lead was booked
    const leadMatch = reply.match(/\[LEAD([^\]]+)\]/);
    if (leadMatch) {
      const raw = leadMatch[1];
      const get = k => { const r = raw.match(new RegExp(k+"=([^=\\[\\]]+?)(?=\\s+\\w+=|$)")); return r?r[1].trim():null; };
      const lead = {
        date: new Date().toLocaleDateString(),
        name: get("name"),
        address: get("address"),
        motivation: get("motivation"),
        timeline: get("timeline"),
        condition: get("condition"),
        asking: get("asking"),
        owed: get("owed"),
        calltime: get("calltime"),
        phone: from,
      };

      // Fire Make webhook
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    }

    const cleanReply = reply.replace(/\[LEAD[^\]]*\]/g, "").trim();

    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${cleanReply}</Message>
</Response>`);

  } catch (e) {
    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Hey! We're experiencing a technical issue. Please try again in a moment.</Message>
</Response>`);
  }
}
