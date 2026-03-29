const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const conversations = {};

const SYSTEM = `You are a friendly acquisition assistant for D&O Property Group, a real estate company in Houston TX run by Diego. Your only job is to qualify sellers and book a 15-minute call with Diego. Ask ONE question at a time. Keep every message 2-3 sentences max. Sound like a real human texting. Never mention ARV, MAO, formulas, or make any offer. Collect in order: name, address, motivation, timeline, condition, asking price, mortgage balance. Then book the call. Confirm a specific time and end with: "Perfect! Diego will call you at [TIME]. No pressure at all, just a quick chat."`;

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

    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);

  } catch (e) {
    res.setHeader("Content-Type", "text/xml");
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Hey! We're experiencing a technical issue. Please try again in a moment.</Message>
</Response>`);
  }
}
