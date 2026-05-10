const fs = require("fs");
const p = "server/index.js";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("async function webSearch")) {
s = s.replace(
"async function askAI",
`async function webSearch(query) {
  if (!process.env.TAVILY_API_KEY) return "";
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5
    })
  });
  const data = await r.json();
  return (data.results || []).map(x => x.title + "\\n" + x.url + "\\n" + x.content).join("\\n\\n");
}

async function askAI`
);
}

s = s.replace(
`const chatMessages = [`,
`let searchContext = "";
  const lastUser = messages?.filter(m => m.role === "user").at(-1)?.content || messages?.filter(m => m.role === "user").at(-1)?.text || "";
  if (/latest|today|news|current|search|google|recent|2026/i.test(lastUser)) {
    searchContext = await webSearch(lastUser);
  }

  const chatMessages = [`
);

s = s.replace(
`{ role: "system", content: systemPrompt(mode) + (instruction ? "\\n\\nExtra instruction:\\n" + instruction : "") },`,
`{ role: "system", content: systemPrompt(mode) + (instruction ? "\\n\\nExtra instruction:\\n" + instruction : "") + (searchContext ? "\\n\\nLive web search results:\\n" + searchContext : "") },`
);

fs.writeFileSync(p, s);
console.log("? Web search added with Tavily");
