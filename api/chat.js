const MAKE_WEBHOOK = "https://hook.us2.make.com/5hdgapnpzhimd9ktarrovfkkc695krxx";

const SYSTEM = `You are Sofia, a friendly AI acquisition assistant for D&O Property Group, a real estate wholesaling company in Houston TX run by Diego Orduna. You qualify motivated sellers one question at a time.

LANGUAGE RULE: Detect seller's language from first message. Respond in that language for the entire conversation. Never mix languages.

Ask ONE question at a time. Keep messages short — 2-3 sentences max. Sound like a real human texting. Never mention ARV, MAO, or any formulas.

OPENING FLOW:
STEP A: Greet and confirm who you're speaking with.
STEP B: Ask ONLY: "Quick question — are you the owner of the property, or are you a property manager or agent?"

IF OWNER: Collect in order: property address, motivation for selling, timeline, condition (great/good/needs work/major repairs), asking price, mortgage balance. Then ask: "Would you prefer a quick 15-minute call with Diego, or would you like me to put together a ballpark offer right here over text?"

PHONE CALL PATH: Confirm time. End with "Perfect! Diego will call you at [TIME]. No pressure at all."
TEXT OFFER PATH: Offer MAO_LOW = asking x 0.55 to MAO_HIGH = asking x 0.65. Negotiate. Make seller say no at least 3 times before giving up.
If seller unhappy with numbers: Get Diego on the phone urgently.

IF AGENT/MANAGER: Ask if owner open to cash offer below market. Collect contact info. Output LEAD tag with preference=AGENT-REFERRAL.

When deal confirmed output at end of message:
[LEAD name=X address=X motivation=X timeline=X condition=X asking=X owed=X calltime=X preference=X email=X]`;

module.exports = async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).end();

    const { messages, leadData } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "Invalid messages" });

    try {
          const systemPrompt = leadData
            ? `${SYSTEM}\n\nLEAD CONTEXT: ${JSON.stringify(leadData)}`
                  : SYSTEM;

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
                        system: systemPrompt,
                        messages: messages
              })
      });

      const data = await response.json();

      if (!data.content || !data.content[0]) {
              return res.status(500).json({ error: "No response from AI" });
      }

      const reply = data.content[0].text;
          const isHotAlert = reply.includes("URGENT") || reply.includes("CALL NOW");

      const leadMatch = reply.match(/\[LEAD([^\]]+)\]/);
          if (leadMatch) {
                  const raw = leadMatch[1];
                  const get = k => { const r = raw.match(new RegExp(k + "=([^=\\[\\]]+?)(?=\\s+\\w+=|$)")); return r ? r[1].trim() : null; };
                  const lead = {
                            date: new Date().toLocaleDateString(),
                            name: get("name"), address: get("address"), motivation: get("motivation"),
                            timeline: get("timeline"), condition: get("condition"), asking: get("asking"),
                            owed: get("owed"), calltime: get("calltime"), preference: get("preference"), email: get("email"),
                            source: "web"
                  };
                  fetch(MAKE_WEBHOOK, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(lead)
                  }).catch(() => {});
          }

      res.status(200).json({
              reply,
              isHotAlert,
              delayedReply: null
      });

    } catch (e) {
          console.error("Chat error:", e);
          res.status(500).json({ error: e.message });
    }
};
