KRISHNA JARVIS PRO MAX - 50%+ UPGRADE

Added practical high-power modules:
- Realtime voice conversation UI using browser speech recognition + speech synthesis
- Hey Jarvis wake-word listener in Chrome
- Screen AI: shares screen, captures screenshot, sends to /api/vision for error analysis
- Camera Vision AI: captures webcam frame and sends to /api/vision
- Coding Agent Workspace: lists files, reads files, writes with backup, asks coding agent
- Long Memory: save facts and search memory
- Live Web Search hooks: Tavily/SerpAPI ready via .env
- Desktop control: safe app/website opening and system status
- Mobile connection: network URL shown in dashboard
- Smart notifications: browser Notification permission
- Multi-agent dashboard: research, screen, coding, memory, desktop, vision agents

IMPORTANT:
For true advanced AI vision/chat, add OPENAI_API_KEY in .env.
For web search, add TAVILY_API_KEY or SERPAPI_KEY in .env.
For free local mode, run Ollama and set PROVIDER=ollama.

Run:
cd "$env:USERPROFILE\Downloads\krishna-ai-jarvis-pro-max-50\krishna-ai-assistant-pro"
npm install
Copy-Item .env.example .env -Force
notepad .env
npm run desktop

Browser mode:
npm run dev
Open http://localhost:5173
