module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(200).json({ reply: "API is working. Send POST request." });
  }

  try {
    const body = req.body || {};
    const text =
      body.message ||
      body.text ||
      body.prompt ||
      body.messages?.filter(m => m.role === "user").at(-1)?.content ||
      body.messages?.filter(m => m.role === "user").at(-1)?.text ||
      "hello";

    if (!process.env.GROQ_API_KEY) {
      return res.status(200).json({ reply: "Missing GROQ_API_KEY in Vercel Environment Variables." });
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
          { role: "system", content: "You are Krishna AI Pro, a helpful AI assistant." },
          { role: "user", content: text }
        ]
      })
    });

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || data.error?.message || "No response from Groq.";
    return res.status(200).json({ reply, text: reply, message: reply });
  } catch (e) {
    return res.status(200).json({ reply: "Server error: " + e.message });
  }
}
