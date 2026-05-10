import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI from 'openai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');
const uploadDir = path.join(__dirname, 'uploads');
const generatedDir = path.join(root, 'generated');
const memoryPath = path.join(root, 'data', 'memory', 'profile.json');
const notesPath = path.join(root, 'data', 'memory', 'jarvis-notes.json');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(generatedDir, { recursive: true });
fs.mkdirSync(path.dirname(memoryPath), { recursive: true });

if (!fs.existsSync(memoryPath)) fs.writeFileSync(memoryPath, JSON.stringify({ facts: [], updatedAt: new Date().toISOString() }, null, 2));
if (!fs.existsSync(notesPath)) fs.writeFileSync(notesPath, JSON.stringify({ notes: [], updatedAt: new Date().toISOString() }, null, 2));

const app = express();
const upload = multer({ dest: uploadDir, limits: { fileSize: 20 * 1024 * 1024 } });
app.use(cors());
app.use(express.json({ limit: '30mb' }));

const AI_NAME = process.env.AI_NAME || 'Krishna AI Pro';
const OWNER_NAME = process.env.OWNER_NAME || 'Krishna Dotel';
const OWNER_ROLE = process.env.OWNER_ROLE || 'ISMT Student and UK Counsellor';
const MODEL = process.env.MODEL || 'gpt-4.1-mini';
const TTS_MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts';
const PROVIDER = (process.env.PROVIDER || 'openai').toLowerCase();
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const SEARCH_PROVIDER = process.env.SEARCH_PROVIDER || 'none';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing' });


function readNotes() {
  try { return JSON.parse(fs.readFileSync(notesPath, 'utf8')); }
  catch { return { notes: [], updatedAt: new Date().toISOString() }; }
}

function saveNotes(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(notesPath, JSON.stringify(data, null, 2));
}

function safeOpen(target) {
  const value = String(target || '').trim();
  if (!value) throw new Error('Nothing to open.');
  const platform = process.platform;
  if (platform === 'win32') spawn('cmd', ['/c', 'start', '', value], { detached: true, stdio: 'ignore' }).unref();
  else if (platform === 'darwin') spawn('open', [value], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [value], { detached: true, stdio: 'ignore' }).unref();
  return true;
}

const allowedApps = {
  calculator: { win32: 'calc.exe', darwin: 'Calculator', linux: 'gnome-calculator' },
  notepad: { win32: 'notepad.exe', darwin: 'TextEdit', linux: 'gedit' },
  vscode: { win32: 'code', darwin: 'Visual Studio Code', linux: 'code' },
  chrome: { win32: 'chrome', darwin: 'Google Chrome', linux: 'google-chrome' },
  terminal: { win32: 'powershell.exe', darwin: 'Terminal', linux: 'gnome-terminal' }
};

function openAllowedApp(appName) {
  const key = String(appName || '').toLowerCase().trim();
  const appDef = allowedApps[key];
  if (!appDef) throw new Error(`App not allowed. Allowed apps: ${Object.keys(allowedApps).join(', ')}`);
  const platform = process.platform;
  const target = appDef[platform] || appDef.linux;
  if (platform === 'darwin') spawn('open', ['-a', target], { detached: true, stdio: 'ignore' }).unref();
  else spawn(target, [], { detached: true, stdio: 'ignore', shell: platform === 'win32' }).unref();
  return true;
}

function getSystemInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    platform: process.platform,
    arch: os.arch(),
    hostname: os.hostname(),
    uptimeMinutes: Math.round(os.uptime() / 60),
    cpu: os.cpus()?.[0]?.model || 'Unknown CPU',
    cores: os.cpus()?.length || 0,
    ramTotalGB: +(total / 1024 / 1024 / 1024).toFixed(2),
    ramFreeGB: +(free / 1024 / 1024 / 1024).toFixed(2),
    node: process.version
  };
}

function interpretJarvisCommand(command = '') {
  const text = String(command || '').trim();
  const lower = text.toLowerCase();
  if (!text) return { type: 'empty' };
  if (/^(open|launch|start)\s+(calculator|notepad|vscode|chrome|terminal)$/i.test(text)) {
    return { type: 'open_app', app: text.match(/(calculator|notepad|vscode|chrome|terminal)/i)[1].toLowerCase() };
  }
  const urlMatch = text.match(/(?:open|go to|launch)\s+((?:https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:\/\S*)?)/i);
  if (urlMatch) {
    let url = urlMatch[1];
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return { type: 'open_url', url };
  }
  if (/\b(system|pc|computer)\s+(info|status|health)\b/i.test(lower) || /\bram|cpu|uptime\b/i.test(lower)) return { type: 'system_info' };
  const noteMatch = text.match(/(?:remember note|save note|note)\s*[:\-]?\s*(.+)$/i);
  if (noteMatch) return { type: 'save_note', note: noteMatch[1].trim() };
  if (/\b(list|show)\s+(my\s+)?notes\b/i.test(lower)) return { type: 'list_notes' };
  return { type: 'chat', message: text };
}

function readMemory() {
  try { return JSON.parse(fs.readFileSync(memoryPath, 'utf8')); }
  catch { return { facts: [], updatedAt: new Date().toISOString() }; }
}

function saveMemory(memory) {
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
}


function basicCalculatorExpression(text = '') {
  const match = String(text).match(/(?:calculate|calculator|calc|solve|what is|=)?\s*([0-9+\-*/().%\s]+)$/i);
  if (!match) return null;
  const expr = match[1].replace(/%/g, '/100');
  if (!expr || !/[0-9]/.test(expr) || /[^0-9+\-*/().\s]/.test(expr)) return null;
  try {
    // Restricted to numbers and arithmetic operators only by regex above.
    const value = Function(`"use strict"; return (${expr})`)();
    if (!Number.isFinite(value)) return null;
    return { expr: match[1].trim(), value };
  } catch { return null; }
}


function wantsLiveWeb(message = '') {
  return /\b(search|google|web|internet|latest|today news|current news|recent|price now|live score|2026|now)\b/i.test(String(message));
}

async function searchWeb(query = '') {
  const q = String(query || '').trim();
  if (!q) return { enabled: false, results: [], note: 'Search query is empty.' };

  if (TAVILY_API_KEY) {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query: q, search_depth: 'basic', max_results: 5 })
    });
    if (!r.ok) throw new Error(`Tavily search failed: ${r.status}`);
    const data = await r.json();
    return { enabled: true, provider: 'tavily', results: (data.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.content })) };
  }

  if (SERPAPI_KEY) {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', q);
    url.searchParams.set('api_key', SERPAPI_KEY);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`SerpAPI search failed: ${r.status}`);
    const data = await r.json();
    return { enabled: true, provider: 'serpapi', results: (data.organic_results || []).slice(0, 5).map(x => ({ title: x.title, url: x.link, snippet: x.snippet })) };
  }

  return {
    enabled: false,
    results: [],
    note: 'Live web search is ready, but no search API key is set. Add TAVILY_API_KEY or SERPAPI_KEY in .env to enable real latest information.'
  };
}

async function localToolAnswer(message = '') {
  const m = String(message).toLowerCase();
  const now = new Date();
  if (/\b(today|date|time|current time|current date|what day)\b/.test(m)) {
    return `Today is ${now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Kathmandu' })}. Current Nepal time is ${now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'Asia/Kathmandu' })}.`;
  }
  if (/\b(calculate|calculator|calc|solve|what is)\b/.test(m)) {
    const result = basicCalculatorExpression(message);
    if (result) return `${result.expr} = ${result.value}`;
  }
  return null;
}

function systemPrompt(mode = 'normal') {
  const memory = readMemory();
  return `You are ${AI_NAME}, a realistic advanced personal AI assistant made for ${OWNER_NAME}, who is an ${OWNER_ROLE}.

Identity and style:
- Speak clearly, confidently, and practically.
- Give step-by-step help for beginners.
- Be honest about limits. When web results are provided, cite/link them in the answer. If no web results are provided, do not pretend to browse live internet.
- When helping with UK counselling, admissions, visas, or universities, give general guidance and tell the user to verify official rules.
- For coding, provide complete files or exact replacement blocks when possible.
- For debugging, identify the exact cause, then give commands that can be copied.
- Refuse unsafe, illegal, or harmful requests briefly and redirect safely.

Useful saved memory about the owner/user:
${memory.facts.length ? memory.facts.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'No saved facts yet.'}

Mode behavior:
- If mode is tutor: teach like a patient personal tutor. Ask one short checking question after explanations, solve step by step, and never just give answers without explanation.
- If mode is streamer: act like a friendly virtual influencer/streamer. Be energetic, short, entertaining, and useful. Good for MLBB content, livestream scripts, and audience replies.
- If mode is normal: be a helpful everyday assistant with practical steps.
- If mode is jarvis operator: act like a realistic Jarvis-style operator: concise, command-focused, careful, and useful. You can explain PC actions, automation plans, notes, system status, app launching, web opening, coding, and research. Never claim you can physically do unsafe or unrestricted actions.

Current real date/time context: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' })} Nepal time.
Current mode: ${mode}`;
}

function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('put_your') && process.env.OPENAI_API_KEY !== 'missing');
}

function hasAnyAIProvider() {
  if (PROVIDER === 'ollama') return true;
  if (PROVIDER === 'groq') return Boolean(GROQ_API_KEY);
  return hasOpenAIKey();
}

function noKeyReply(extra = '') {
  return `Krishna AI Pro backend is working ✅

To enable real advanced AI replies, add your OPENAI_API_KEY in the .env file, then restart the server.

${extra}`.trim();
}

function needKey(res) {
  if (!hasAnyAIProvider()) {
    res.json({ reply: noKeyReply('Your app is not broken. It is only missing the API key. You can also set PROVIDER=ollama if Ollama is running locally.') });
    return true;
  }
  return false;
}

function outputText(response) {
  if (response.output_text) return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    for (const c of item.content || []) if (c.text) parts.push(c.text);
  }
  return parts.join('\n') || JSON.stringify(response, null, 2);
}

async function webSearch(query) {
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
  return (data.results || []).map(x => x.title + "\n" + x.url + "\n" + x.content).join("\n\n");
}

async function askAI({ mode, messages, instruction = '' }) {
  let searchContext = "";
  const lastUser = messages?.filter(m => m.role === "user").at(-1)?.content || messages?.filter(m => m.role === "user").at(-1)?.text || "";
  if (/latest|today|news|current|search|google|recent|2026/i.test(lastUser)) {
    searchContext = await webSearch(lastUser);
  }

  const chatMessages = [
    { role: 'system', content: systemPrompt(mode) + (instruction ? `\n\nExtra instruction:\n${instruction}` : '') },
    ...messages
  ];

  if (PROVIDER === 'groq') {
    if (!GROQ_API_KEY) return noKeyReply('Missing GROQ_API_KEY in .env. Set PROVIDER=groq and GROQ_API_KEY=your_key.');
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL || 'llama-3.3-70b-versatile',
        messages: chatMessages,
        temperature: 0.7
      })
    });
    const data = await r.json();
    if (!r.ok) return data.error?.message || 'Groq request failed. Check your GROQ_API_KEY and model name.';
    return data.choices?.[0]?.message?.content || 'No response from Groq.';
  }

  if (PROVIDER === 'ollama') {
    try {
      const r = await fetch(OLLAMA_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages: chatMessages, stream: false })
      });
      const data = await r.json();
      return data.message?.content || 'No response from Ollama.';
    } catch (e) {
      return 'Ollama is selected but not running. Start Ollama or set PROVIDER=groq in .env.';
    }
  }

  if (!hasOpenAIKey()) {
    const last = messages?.[messages.length - 1]?.content || '';
    return noKeyReply(`You asked: ${String(last).slice(0, 500)}\n\nTemporary local mode is active. Set PROVIDER=groq with GROQ_API_KEY for real AI replies.`);
  }

  const response = await client.responses.create({ model: MODEL, input: chatMessages });
  return outputText(response);
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ai: AI_NAME, owner: OWNER_NAME, model: PROVIDER === 'ollama' ? OLLAMA_MODEL : PROVIDER === 'groq' ? GROQ_MODEL : MODEL, provider: PROVIDER, keyReady: hasAnyAIProvider(), searchReady: Boolean(TAVILY_API_KEY || SERPAPI_KEY), networkUrl: 'http://' + getLocalIP() + ':5173' });
});

app.get('/api/memory', (req, res) => res.json(readMemory()));

app.post('/api/memory', (req, res) => {
  const { fact } = req.body;
  if (!fact || !fact.trim()) return res.status(400).json({ error: 'Memory fact is empty.' });
  const memory = readMemory();
  memory.facts = [...new Set([...(memory.facts || []), fact.trim()])].slice(-50);
  saveMemory(memory);
  res.json(memory);
});

app.delete('/api/memory', (req, res) => {
  saveMemory({ facts: [], updatedAt: new Date().toISOString() });
  res.json(readMemory());
});


app.post('/api/jarvis/action', async (req, res) => {
  try {
    const { type, app, url, note } = req.body || {};
    if (type === 'open_app') {
      openAllowedApp(app);
      return res.json({ ok: true, message: `Opening ${app}...` });
    }
    if (type === 'open_url') {
      let cleanUrl = String(url || '').trim();
      if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = `https://${cleanUrl}`;
      safeOpen(cleanUrl);
      return res.json({ ok: true, message: `Opening ${cleanUrl}...` });
    }
    if (type === 'system_info') return res.json({ ok: true, message: 'System info ready.', info: getSystemInfo() });
    if (type === 'save_note') {
      if (!String(note || '').trim()) return res.status(400).json({ error: 'Note is empty.' });
      const notes = readNotes();
      notes.notes = [{ text: String(note).trim(), createdAt: new Date().toISOString() }, ...(notes.notes || [])].slice(0, 100);
      saveNotes(notes);
      return res.json({ ok: true, message: 'Note saved.', notes: notes.notes });
    }
    if (type === 'list_notes') return res.json({ ok: true, message: 'Notes loaded.', notes: readNotes().notes || [] });
    return res.status(400).json({ error: 'Unknown Jarvis action.' });
  } catch (err) { res.status(500).json({ error: err.message || 'Jarvis action failed.' }); }
});

app.post('/api/jarvis/command', async (req, res) => {
  try {
    const command = String(req.body?.command || '');
    const action = interpretJarvisCommand(command);
    if (action.type === 'open_app') { openAllowedApp(action.app); return res.json({ ok: true, action, reply: `Opening ${action.app}.` }); }
    if (action.type === 'open_url') { safeOpen(action.url); return res.json({ ok: true, action, reply: `Opening ${action.url}.` }); }
    if (action.type === 'system_info') return res.json({ ok: true, action, reply: 'System status ready.', info: getSystemInfo() });
    if (action.type === 'save_note') {
      const notes = readNotes();
      notes.notes = [{ text: action.note, createdAt: new Date().toISOString() }, ...(notes.notes || [])].slice(0, 100);
      saveNotes(notes);
      return res.json({ ok: true, action, reply: 'I saved that note.', notes: notes.notes });
    }
    if (action.type === 'list_notes') return res.json({ ok: true, action, reply: 'Here are your notes.', notes: readNotes().notes || [] });
    if (action.type === 'chat') {
      const reply = await askAI({ mode: 'jarvis operator', messages: [{ role: 'user', content: command }], instruction: 'Answer like a practical Jarvis-style personal operator. Give concise steps and mention when a real-world action needs user permission.' });
      return res.json({ ok: true, action, reply });
    }
    return res.json({ ok: true, reply: 'Command received.' });
  } catch (err) { res.status(500).json({ error: err.message || 'Jarvis command failed.' }); }
});


app.post('/api/vision', async (req, res) => {
  try {
    const { imageDataUrl, prompt } = req.body || {};
    if (!imageDataUrl || !String(imageDataUrl).startsWith('data:image/')) return res.status(400).json({ error: 'No screen/camera image received.' });
    const reply = await analyzeImageWithAI({ imageDataUrl, prompt });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message || 'Vision analysis failed.' }); }
});

app.post('/api/agent', async (req, res) => {
  try {
    const { goal } = req.body || {};
    if (!String(goal || '').trim()) return res.status(400).json({ error: 'Agent goal is empty.' });
    const reply = await askAI({
      mode: 'jarvis operator',
      instruction: 'Create a safe autonomous task plan. Split into observe, plan, execute-with-permission, verify. Do not perform dangerous actions. Ask permission before PC control, purchases, messages, deletes, installs, or security testing.',
      messages: [{ role: 'user', content: `Autonomous agent goal: ${goal}` }]
    });
    res.json({ reply, stepsReady: true });
  } catch (err) { res.status(500).json({ error: err.message || 'Agent planning failed.' }); }
});

app.post('/api/live-news', async (req, res) => {
  try {
    const { query } = req.body || {};
    const web = await searchWeb(query || 'latest AI technology news');
    const sourceText = web.results?.length
      ? web.results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
      : web.note;
    const reply = await askAI({
      mode: 'deep research',
      instruction: 'Summarize the live search results. Clearly say if live search is not enabled. For trading/finance, do not give guaranteed profit claims; explain risk.',
      messages: [{ role: 'user', content: `Query: ${query}\n\nSearch results:\n${sourceText}` }]
    });
    res.json({ reply, web });
  } catch (err) { res.status(500).json({ error: err.message || 'Live news failed.' }); }
});

app.post('/api/chat', async (req, res) => {
  try {
    if (needKey(res)) return;
    const { message, history = [], mode = 'normal', fileText = '' } = req.body;
    if (!message?.trim() && !fileText?.trim()) return res.status(400).json({ error: 'Message is empty.' });
    const localAnswer = await localToolAnswer(message || '');
    if (localAnswer && !fileText?.trim()) return res.json({ reply: localAnswer, tool: true });
    const safeHistory = history.slice(-16).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 12000) }));
    const userContent = `${fileText ? `Attached file/content:\n${fileText.slice(0, 20000)}\n\n` : ''}${message}`;
    const reply = await askAI({ mode, messages: [...safeHistory, { role: 'user', content: userContent }] });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message || 'AI request failed.' }); }
});

app.post('/api/research', async (req, res) => {
  try {
    if (needKey(res)) return;
    const { topic } = req.body;
    const reply = await askAI({
      mode: 'deep research',
      instruction: 'Create a deep research-style answer with overview, key points, step-by-step plan, risks, checklist, and official sources the user should verify. Do not invent live facts.',
      messages: [{ role: 'user', content: topic || 'Research this topic.' }]
    });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message || 'Research failed.' }); }
});

app.post('/api/code', async (req, res) => {
  try {
    if (needKey(res)) return;
    const { task, language = 'auto' } = req.body;
    const reply = await askAI({
      mode: 'senior coding assistant',
      instruction: `Return clean, working code. Language/framework: ${language}. Include exact run commands and explain where to place files.`,
      messages: [{ role: 'user', content: task || 'Write code.' }]
    });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message || 'Code generation failed.' }); }
});

app.post('/api/website', async (req, res) => {
  try {
    if (needKey(res)) return;
    const { idea } = req.body;
    const html = await askAI({
      mode: 'website generator',
      instruction: 'Return ONLY one complete production-ready HTML file with embedded CSS and JS. It must be responsive, modern, and realistic. No markdown fences.',
      messages: [{ role: 'user', content: idea || 'Create a modern landing page.' }]
    });
    const filename = `website-${Date.now()}.html`;
    fs.writeFileSync(path.join(generatedDir, filename), html);
    res.json({ code: html, filename });
  } catch (err) { res.status(500).json({ error: err.message || 'Website generation failed.' }); }
});


app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body;
    const web = await searchWeb(query);
    res.json(web);
  } catch (err) { res.status(500).json({ error: err.message || 'Search failed.' }); }
});

async function analyzeImageWithAI(original, raw) {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('put_your')) {
    return `Image uploaded: ${original}. Add OPENAI_API_KEY in .env to enable image understanding.`;
  }
  const ext = path.extname(original).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' ? 'jpeg' : (ext || 'png');
  const dataUrl = `data:image/${mime};base64,${raw.toString('base64')}`;
  const response = await client.responses.create({
    model: MODEL,
    input: [{ role: 'user', content: [
      { type: 'input_text', text: 'Analyze this uploaded image clearly. Describe what is visible and mention useful suggestions if it is a design, screenshot, code error, or document photo.' },
      { type: 'input_image', image_url: dataUrl }
    ] }]
  });
  return outputText(response);
}

async function extractUploadedText(original, raw) {
  if (/\.(txt|md|js|jsx|ts|tsx|html|css|json|csv|xml|py|java|cpp|c|sql|log|env)$/i.test(original)) {
    return raw.toString('utf8').slice(0, 60000);
  }
  if (/\.pdf$/i.test(original)) {
    const data = await pdfParse(raw);
    return (data.text || '').slice(0, 60000) || `PDF uploaded: ${original}, but no readable text was found.`;
  }
  if (/\.(docx)$/i.test(original)) {
    const data = await mammoth.extractRawText({ buffer: raw });
    return (data.value || '').slice(0, 60000) || `DOCX uploaded: ${original}, but no readable text was found.`;
  }
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(original)) {
    return await analyzeImageWithAI(original, raw);
  }
  return `File uploaded: ${original}. This file type is saved, but automatic reading is not supported yet. Supported: txt/code/csv/json/pdf/docx/png/jpg/webp.`;
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const original = req.file.originalname || 'uploaded-file';
    const raw = fs.readFileSync(req.file.path);
    const text = await extractUploadedText(original, raw);
    fs.unlinkSync(req.file.path);
    res.json({ filename: original, text });
  } catch (err) { res.status(500).json({ error: err.message || 'Upload failed.' }); }
});

app.post('/api/tts', async (req, res) => {
  try {
    if (needKey(res)) return;
    const { text, voice = 'alloy' } = req.body;
    const allowedVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    const selectedVoice = allowedVoices.includes(voice) ? voice : 'alloy';
    const audio = await client.audio.speech.create({ model: TTS_MODEL, voice: selectedVoice, input: String(text || '').slice(0, 4000), format: 'mp3' });
    const buffer = Buffer.from(await audio.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) { res.status(500).json({ error: err.message || 'Voice failed.' }); }
});


const safeWorkspaceRoots = [
  root,
  path.join(root, 'client'),
  path.join(root, 'server'),
  generatedDir,
  path.join(root, 'data')
].map(p => path.resolve(p));

function resolveSafeWorkspacePath(relativePath = '') {
  const cleaned = String(relativePath || '').replace(/^[/\\]+/, '');
  const resolved = path.resolve(root, cleaned);
  const allowed = safeWorkspaceRoots.some(base => resolved === base || resolved.startsWith(base + path.sep));
  if (!allowed) throw new Error('Blocked: path is outside this Jarvis project workspace.');
  return resolved;
}

function listFilesRecursive(dir, base = dir, limit = 220, out = []) {
  if (out.length >= limit) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (out.length >= limit) break;
    if (['node_modules', '.git', 'dist', 'uploads'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replaceAll('\\', '/');
    if (entry.isDirectory()) listFilesRecursive(full, base, limit, out);
    else out.push({ path: rel, size: fs.statSync(full).size });
  }
  return out;
}

app.get('/api/workspace/files', (req, res) => {
  try {
    const sub = String(req.query.path || '').trim();
    const target = resolveSafeWorkspacePath(sub);
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'Path is not a folder.' });
    res.json({ root: path.relative(root, target) || '.', files: listFilesRecursive(target, target) });
  } catch (err) { res.status(500).json({ error: err.message || 'Could not list files.' }); }
});

app.post('/api/workspace/read', (req, res) => {
  try {
    const file = resolveSafeWorkspacePath(req.body?.path);
    const stat = fs.statSync(file);
    if (!stat.isFile()) return res.status(400).json({ error: 'Path is not a file.' });
    if (stat.size > 700_000) return res.status(400).json({ error: 'File too large to read safely.' });
    res.json({ path: path.relative(root, file).replaceAll('\\','/'), content: fs.readFileSync(file, 'utf8') });
  } catch (err) { res.status(500).json({ error: err.message || 'Could not read file.' }); }
});

app.post('/api/workspace/write', (req, res) => {
  try {
    const file = resolveSafeWorkspacePath(req.body?.path);
    const content = String(req.body?.content ?? '');
    if (!/\.(jsx?|tsx?|css|html|json|md|txt|env|cjs|mjs)$/i.test(file)) return res.status(400).json({ error: 'Blocked: unsupported file type.' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) fs.copyFileSync(file, file + `.bak-${Date.now()}`);
    fs.writeFileSync(file, content, 'utf8');
    res.json({ ok: true, path: path.relative(root, file).replaceAll('\\','/'), message: 'File written. Backup created if file existed.' });
  } catch (err) { res.status(500).json({ error: err.message || 'Could not write file.' }); }
});

app.post('/api/workspace/code-agent', async (req, res) => {
  try {
    const { task, files = [] } = req.body || {};
    const snippets = [];
    for (const f of files.slice(0, 6)) {
      try {
        const file = resolveSafeWorkspacePath(f);
        const stat = fs.statSync(file);
        if (stat.isFile() && stat.size < 250_000) snippets.push(`FILE: ${path.relative(root, file)}\n${fs.readFileSync(file, 'utf8').slice(0, 12000)}`);
      } catch {}
    }
    const reply = await askAI({
      mode: 'senior coding assistant',
      instruction: 'You are Jarvis Desktop Pro coding agent. Return exact safe file changes, commands, and warnings. Never delete user files. Prefer full replacement blocks when requested.',
      messages: [{ role: 'user', content: `Task:\n${task}\n\nProject snippets:\n${snippets.join('\n\n---\n\n')}` }]
    });
    res.json({ reply });
  } catch (err) { res.status(500).json({ error: err.message || 'Code agent failed.' }); }
});



// Jarvis Pro Max extra APIs: notifications, memory search, safe command explain, and capability map.
app.get('/api/jarvis/capabilities', (req, res) => {
  res.json({
    level: '50%+ Jarvis-feeling foundation',
    modules: ['realtime voice UI', 'wake word', 'screen AI', 'camera vision', 'coding agent', 'long memory', 'web search hooks', 'desktop actions', 'mobile URL', 'multi-agent planner'],
    safety: 'Desktop actions are allowlisted. File writes are restricted to this project and create backups.'
  });
});

app.post('/api/memory/search', (req, res) => {
  const q = String(req.body?.query || '').toLowerCase();
  const mem = readMemory();
  const matches = (mem.facts || []).filter(x => String(x).toLowerCase().includes(q)).slice(0, 20);
  res.json({ query: q, matches });
});

app.post('/api/notify', (req, res) => {
  const title = String(req.body?.title || 'Jarvis Pro Max');
  const body = String(req.body?.body || 'Notification created. Browser permission is handled on the frontend.');
  res.json({ ok: true, title, body, createdAt: new Date().toISOString() });
});

app.post('/api/desktop/safe-command', async (req, res) => {
  try {
    const command = String(req.body?.command || '').trim();
    const blocked = /(format|del\s+\/|rm\s+-rf|shutdown|reg\s+delete|cipher|diskpart|bcdedit|netsh|powershell\s+-enc)/i.test(command);
    if (blocked) return res.status(400).json({ error: 'Blocked dangerous command. Jarvis will not run destructive system commands.' });
    const reply = await askAI({
      mode: 'jarvis operator',
      instruction: 'Explain what this command does, risks, and whether the user should run it manually. Do not execute it.',
      messages: [{ role: 'user', content: command }]
    });
    res.json({ ok: true, reply });
  } catch (err) { res.status(500).json({ error: err.message || 'Safe command review failed.' }); }
});

app.use('/generated', express.static(generatedDir));
const clientDist = path.join(root, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`${AI_NAME} server running at http://localhost:${port}`));


app.get("/api/list-files", async (req, res) => {
  const root = process.cwd();
  const ignore = ["node_modules", ".git", "dist", "uploads"];
  function walk(dir, depth = 0) {
    if (depth > 3) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(x => {
      if (ignore.includes(x.name)) return [];
      const full = path.join(dir, x.name);
      const rel = path.relative(root, full);
      if (x.isDirectory()) return walk(full, depth + 1);
      return rel;
    });
  }
  res.json({ files: walk(root) });
});

app.post("/api/read-file", express.json(), async (req, res) => {
  const file = req.body.file;
  if (!file) return res.status(400).json({ error: "file required" });
  const full = path.join(process.cwd(), file);
  if (!full.startsWith(process.cwd())) return res.status(403).json({ error: "blocked" });
  if (!fs.existsSync(full)) return res.status(404).json({ error: "not found" });
  const text = fs.readFileSync(full, "utf8").slice(0, 30000);
  res.json({ file, text });
});

app.post("/api/write-file", express.json({ limit: "5mb" }), async (req, res) => {
  const { file, content } = req.body;
  if (!file) return res.status(400).json({ error: "file required" });
  const full = path.join(process.cwd(), file);
  if (!full.startsWith(process.cwd())) return res.status(403).json({ error: "blocked" });
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content || "");
  res.json({ success: true, file });
});

app.post("/api/upload-read", upload.single("file"), async (req, res) => {
  try {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "No file uploaded" });

    let text = "";
    const original = f.originalname.toLowerCase();

    if (original.endsWith(".pdf")) {
      const data = await pdfParse(fs.readFileSync(f.path));
      text = data.text;
    } else if (original.endsWith(".docx")) {
      const data = await mammoth.extractRawText({ path: f.path });
      text = data.value;
    } else {
      text = fs.readFileSync(f.path, "utf8");
    }

    res.json({
      filename: f.originalname,
      text: text.slice(0, 40000)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
