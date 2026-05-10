import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Camera, Code2, Database, FileCode2, Globe2, HardDrive, Menu, Mic, Monitor, Plus, Power, Save, Search, Send, Settings, Sparkles, Terminal, Trash2, Wifi, X, Zap } from 'lucide-react';
import './style.css';

const API = 'http://localhost:8787';
const modes = ['Jarvis Operator', 'Live Ops', 'Vision', 'Senior Coding Assistant', 'Deep Research', 'Agent'];

function App() {
  const [health, setHealth] = useState(null);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('krishna_jarvis_chat');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ role: 'assistant', text: 'Hello Krishna. Jarvis is ready. Ask anything, code, search, screen/camera, memory, and tools are all in the left sidebar.' }];
  });
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('jarvis operator');
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [mobileUrl, setMobileUrl] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toolPanel, setToolPanel] = useState('tools');
  const [voiceReply, setVoiceReply] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(API + '/api/health')
      .then(r => r.json())
      .then(d => { setHealth(d); setMobileUrl(d.networkUrl || ''); })
      .catch(() => setHealth({ ok: false, keyReady: false }));
    loadMemory();
    loadFiles();
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    try { localStorage.setItem('krishna_jarvis_chat', JSON.stringify(messages)); } catch {}
  }, [messages]);

  function speak(text) {
    if (!voiceReply || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(String(text).slice(0, 800));
    u.rate = 1;
    u.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  async function post(path, body = {}) {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('Server returned non-JSON. Restart with npm run dev.'); }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function newChat() {
    speechSynthesis?.cancel?.();
    setMessages([{ role: 'assistant', text: 'New chat started. What do you want to build or fix now?' }]);
    setInput('');
    try { localStorage.removeItem('krishna_jarvis_chat'); } catch {}
  }

  async function ask(custom = input) {
    const msg = String(custom || '').trim();
    if (!msg || loading) return;
    setInput('');
    const nextHistory = [...messages, { role: 'user', text: msg }];
    setMessages(nextHistory);
    setLoading(true);
    try {
      let data;
      if (/^(open|system status|save note|list notes)/i.test(msg)) {
        data = await post('/api/jarvis/command', { command: msg });
      } else {
        data = await post('/api/chat', {
          mode,
          message: msg,
          history: messages.map(x => ({ role: x.role, content: x.text }))
        });
      }
      pushAssistant(data.reply || data.message || 'Done.');
    } catch (e) {
      pushAssistant('Error: ' + e.message);
    }
    setLoading(false);
  }

  function pushAssistant(text) {
    const t = String(text || '');
    setMessages(m => [...m, { role: 'assistant', text: t }]);
    speak(t);
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return pushAssistant('Voice recognition is not supported in this browser. Use Chrome.');
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = e => ask(e.results[0][0].transcript);
    rec.start();
  }

  async function runCommand(command) {
    setLoading(true);
    try { const d = await post('/api/jarvis/command', { command }); pushAssistant(d.reply || d.message || 'Command executed.'); }
    catch (e) { pushAssistant('Command error: ' + e.message); }
    setLoading(false);
  }

  async function analyzeScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream; await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const imageDataUrl = canvas.toDataURL('image/png');
      const d = await post('/api/vision', { imageDataUrl, prompt: 'Analyze this screen. If there is an error, explain the root cause and exact fix.' });
      pushAssistant(d.reply);
    } catch (e) { pushAssistant('Screen AI error: ' + e.message); }
  }

  async function analyzeCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream; await video.play();
      await new Promise(r => setTimeout(r, 800));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const imageDataUrl = canvas.toDataURL('image/png');
      const d = await post('/api/vision', { imageDataUrl, prompt: 'Analyze the camera image clearly.' });
      pushAssistant(d.reply);
    } catch (e) { pushAssistant('Camera AI error: ' + e.message); }
  }

  async function webSearch() {
    const q = input.trim() || 'latest AI technology';
    setMessages(m => [...m, { role: 'user', text: 'Search: ' + q }]);
    setLoading(true);
    try { const d = await post('/api/live-news', { query: q }); pushAssistant(d.reply || JSON.stringify(d.web, null, 2)); }
    catch (e) { pushAssistant('Web search error: ' + e.message); }
    setLoading(false);
  }

  async function agentPlan() {
    const goal = input.trim() || 'Make this Jarvis AI more powerful';
    setMessages(m => [...m, { role: 'user', text: 'Agent goal: ' + goal }]);
    setLoading(true);
    try { const d = await post('/api/agent', { goal }); pushAssistant(d.reply); }
    catch (e) { pushAssistant('Agent error: ' + e.message); }
    setLoading(false);
  }

  async function loadMemory() { try { const d = await fetch(API + '/api/memory').then(r => r.json()); setMemory(d.facts || []); } catch {} }
  async function saveMemory() {
    if (!input.trim()) return pushAssistant('Write memory text in the chat box first.');
    try { const d = await post('/api/memory', { fact: input.trim() }); setMemory(d.facts || []); setInput(''); pushAssistant('Memory saved.'); }
    catch (e) { pushAssistant(e.message); }
  }
  async function loadFiles() { try { const d = await fetch(API + '/api/workspace/files').then(r => r.json()); setFiles(d.files || []); } catch {} }
  async function readFile(path) { setSelectedFile(path); setToolPanel('files'); try { const d = await post('/api/workspace/read', { path }); setFileContent(d.content || ''); } catch (e) { pushAssistant(e.message); } }
  async function saveFile() { if (!selectedFile) return pushAssistant('Select a file first.'); try { const d = await post('/api/workspace/write', { path: selectedFile, content: fileContent }); pushAssistant(d.message || 'File saved.'); loadFiles(); } catch(e) { pushAssistant(e.message); } }
  async function codeAgent() { const task = input.trim() || 'Improve this file safely'; setLoading(true); try { const d = await post('/api/workspace/code-agent', { task, files: selectedFile ? [selectedFile] : [] }); pushAssistant(d.reply); } catch(e){ pushAssistant('Code agent error: ' + e.message); } setLoading(false); }

  return <div className="app">
    <aside className={`sidebar ${sidebarOpen ? '' : 'closed'}`}>
      <div className="brand">
        <div className="logo"><Bot size={24}/></div>
        <div><h1>Krishna AI Pro</h1><p>{health?.provider || 'loading'} • {health?.model || 'model'}</p></div>
        <button className="icon close" onClick={() => setSidebarOpen(false)}><X size={18}/></button>
      </div>

      <button className="new-chat" onClick={newChat}><Plus size={18}/> New chat</button>

      <div className="side-section">
        <p className="label">Modes</p>
        {modes.map(m => <button key={m} className={mode === m.toLowerCase() ? 'active side-btn' : 'side-btn'} onClick={() => setMode(m.toLowerCase())}><Sparkles size={16}/>{m}</button>)}
      </div>

      <div className="side-section">
        <p className="label">Tools</p>
        <button className="side-btn" onClick={() => runCommand('system status')}><Terminal size={16}/> System status</button>
        <button className="side-btn" onClick={analyzeScreen}><Monitor size={16}/> Screen AI</button>
        <button className="side-btn" onClick={analyzeCamera}><Camera size={16}/> Camera AI</button>
        <button className="side-btn" onClick={webSearch}><Globe2 size={16}/> Web search</button>
        <button className="side-btn" onClick={agentPlan}><Zap size={16}/> Agent plan</button>
        <button className="side-btn" onClick={() => setVoiceReply(v => !v)}><Mic size={16}/> Voice reply: {voiceReply ? 'ON' : 'OFF'}</button>
        <button className="side-btn" onClick={() => runCommand('open notepad')}><FileCode2 size={16}/> Open Notepad</button>
      </div>

      <div className="side-tabs">
        <button className={toolPanel === 'tools' ? 'active' : ''} onClick={() => setToolPanel('tools')}><Settings size={15}/> Info</button>
        <button className={toolPanel === 'files' ? 'active' : ''} onClick={() => setToolPanel('files')}><HardDrive size={15}/> Files</button>
        <button className={toolPanel === 'memory' ? 'active' : ''} onClick={() => setToolPanel('memory')}><Database size={15}/> Memory</button>
      </div>

      {toolPanel === 'tools' && <div className="tool-card">
        <div className={health?.keyReady ? 'status ok' : 'status bad'}><Wifi size={16}/>{health?.keyReady ? 'AI key ready' : 'API key missing'}</div>
        <p><b>Frontend:</b> http://localhost:5173</p>
        <p><b>Backend:</b> http://localhost:8787</p>
        {mobileUrl && <p><b>Mobile:</b> {mobileUrl}</p>}
      </div>}

      {toolPanel === 'memory' && <div className="tool-card list-card">
        <button className="mini" onClick={saveMemory}><Save size={15}/> Save chat box as memory</button>
        {memory.length ? memory.slice(0, 20).map((x,i) => <p className="list-item" key={i}>{x}</p>) : <p className="muted">No saved memory yet.</p>}
      </div>}

      {toolPanel === 'files' && <div className="tool-card file-card">
        <div className="file-actions"><button className="mini" onClick={loadFiles}>Refresh</button><button className="mini" onClick={codeAgent}>Ask Coding Agent</button></div>
        <div className="file-list">{files.slice(0,80).map(f => <button key={f.path} className={selectedFile === f.path ? 'active' : ''} onClick={() => readFile(f.path)}>{f.path}</button>)}</div>
        <textarea value={fileContent} onChange={e => setFileContent(e.target.value)} placeholder="Select a project file..." />
        <button className="mini save" onClick={saveFile}><Save size={15}/> Save selected file</button>
      </div>}
    </aside>

    <main className="main">
      <header className="topbar">
        <button className="icon menu" onClick={() => setSidebarOpen(true)}><Menu size={21}/></button>
        <div>
          <h2>{mode.replace(/\b\w/g, c => c.toUpperCase())}</h2>
          <p>{health?.keyReady ? 'Real AI connected' : 'Backend running, API key needed'} • ChatGPT-style layout</p>
        </div>
        <button className="icon danger" onClick={() => setMessages([])} title="Clear chat"><Trash2 size={19}/></button>
      </header>

      <section className="chat-area">
        <div className="messages">
          {messages.map((m, i) => <div key={i} className={`message-row ${m.role}`}><div className="avatar">{m.role === 'user' ? 'K' : <Bot size={18}/>}</div><div className="bubble">{m.text}</div></div>)}
          {loading && <div className="message-row assistant"><div className="avatar"><Bot size={18}/></div><div className="bubble typing">Thinking...</div></div>}
          <div ref={bottomRef}/>
        </div>

        <div className="composer-wrap">
          <div className="quick-row">
            <button onClick={() => ask('What can you do?')}>What can you do?</button>
            <button onClick={() => ask('Help me fix my project step by step')}>Fix project</button>
            <button onClick={() => ask('Write code like ChatGPT with full files')}>Coding mode</button>
          </div>
          <div className="composer">
            <button className="round" onClick={startVoice}><Mic size={19}/></button>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ask anything..." />
            <button className="send" onClick={() => ask()}><Send size={19}/></button>
          </div>
        </div>
      </section>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
