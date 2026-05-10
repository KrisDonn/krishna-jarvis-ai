export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(200).json({ reply: "API working. Send POST request." });
  }

  try {
    const body = req.body || {};
    const text = body.message || body.text || body.prompt || "hello";

    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes("your_new")) {
      return res.status(200).json({ reply: "Missing real GROQ_API_KEY in Vercel Environment Variables." });
    }

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Krishna AI Pro." },
          { role: "user", content: text }
        ]
      })
    });

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || data.error?.message || "No Groq response.";
    return res.status(200).json({ reply, text: reply, message: reply });
  } catch (e) {
    return res.status(200).json({ reply: "Server error: " + e.message });
  }
}
