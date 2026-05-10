export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const userText =
      body.message ||
      body.prompt ||
      body.text ||
      body.messages?.filter(m => m.role === "user").at(-1)?.content ||
      body.messages?.filter(m => m.role === "user").at(-1)?.text ||
      "";

    const messages = [
      {
        role: "system",
        content: "You are Krishna AI Pro, a helpful advanced AI assistant."
      },
      ...(body.messages || []).map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content || m.text || ""
      })),
    ];

    if (!body.messages && userText) {
      messages.push({ role: "user", content: userText });
    }

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages
      })
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(500).json({
        reply: data.error?.message || "Groq API error"
      });
    }

    const reply = data.choices?.[0]?.message?.content || "No response.";
    return res.status(200).json({ reply, text: reply, message: reply });
  } catch (e) {
    return res.status(500).json({ reply: e.message });
  }
}
