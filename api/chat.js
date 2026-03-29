export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": req.headers["x-api-key"],
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: req.body.model || "claude-haiku-4-5-20251001",
        max_tokens: req.body.max_tokens || 300,
        system: req.body.system,
        messages: req.body.messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);

  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
}
