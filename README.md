# Krishna AI Pro — Super Powerful Upgrade

This version upgrades the previous package into a stronger AI assistant product while keeping the same simple run flow.

## Added in this upgrade

- ChatGPT-style chat with sidebar history
- Voice input and AI speaking replies
- AI Tutor, Streamer, Coding, Research, Website Generator modes
- Copy button for messages
- Local memory saved in `data/memory/profile.json`
- Calculator tool
- Nepal date/time tool
- Live web-search-ready agent flow
- PDF reading support
- DOCX reading support
- Text/code/CSV/JSON file reading support
- Image understanding support through OpenAI vision
- `/api/search` endpoint for real web search when a search key is added
- Stronger system prompt for safer, cleaner, more practical answers

## Setup

```bash
npm install
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and add your fresh OpenAI API key:

```env
OPENAI_API_KEY=sk-proj-your-new-key-here
```

Never share your real API key in screenshots or chat. If you already shared one, delete/rotate it and create a new key.

## Optional: enable real live web search

Add one of these keys in `.env`:

```env
TAVILY_API_KEY=your_tavily_key_here
```

or

```env
SERPAPI_KEY=your_serpapi_key_here
```

After that, questions like “search latest AI news” or “latest cricket score” will use the web-search tool and pass results to the AI.

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8787
```

## Build

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:8787
```

## File upload support

Supported directly:

- `.txt`, `.md`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`, `.css`, `.json`, `.csv`, `.xml`, `.py`, `.java`, `.cpp`, `.c`, `.sql`, `.log`, `.env`
- `.pdf`
- `.docx`
- `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

For images, `OPENAI_API_KEY` must be active because the assistant uses AI vision.

## Useful commands

Reset saved memory:

```bash
npm run reset:memory
```

Run only backend:

```bash
npm run server
```

Run only frontend:

```bash
npm run client
```


## Jarvis Operator Upgrade

This package now includes a safer real-life Jarvis-style command center.

### What it can do locally

- Voice command mode through the browser
- Open safe allowed apps: Calculator, Notepad, VS Code, Chrome, Terminal
- Open websites, for example: `open youtube.com`
- Show PC system status: CPU, RAM, uptime, platform
- Save and list notes: `save note: call UK student tomorrow`
- Keep normal AI chat, tutor, coding, research, website generator, file reading, image reading, and TTS

### Jarvis example commands

```text
open calculator
open notepad
open youtube.com
system status
save note: follow up interested UK students today
list notes
```

### Important safety limit

This is not full Iron Man J.A.R.V.I.S. It is a realistic advanced local assistant. It only runs safe allow-listed actions and does not execute dangerous random terminal commands.


## Advanced Cyber / Jarvis UI Upgrade

This version includes a cinematic dark neon Jarvis interface with glass panels, animated grid background, operator sidebar, voice wave style, system widgets, memory, upload, chat history and Jarvis command mode.

### Windows run
```powershell
cd "$env:USERPROFILE\Downloads\krishna-ai-jarvis-hacker-ui-pro\krishna-ai-assistant-pro"
npm install
npm run dev
```

Open: http://localhost:5173

## Ultra Jarvis Upgrade

Added modules:
- Real-time web search scaffold through Tavily or SerpAPI
- Screen understanding through browser screen capture + vision model
- Vision camera AI through webcam snapshot + vision model
- Safe autonomous task agent planner
- Allowlisted desktop control only: calculator, notepad, VS Code, Chrome, terminal, safe website open
- Wake word: “Hey Jarvis” using Chrome/Edge Web Speech API
- Long-term local memory JSON, ready to migrate to Supabase/vector DB
- Live trading/news analysis mode with risk warnings
- Multi-model routing: OpenAI, Groq, or Ollama
- Live voice conversation through browser speech recognition + TTS
- Mobile connection through Vite network URL

Use `.env.example` to choose your provider.
