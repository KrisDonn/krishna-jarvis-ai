const fs = require("fs");

const main = "client/src/main.jsx";
let s = fs.readFileSync(main, "utf8");

// backup
fs.writeFileSync("client/src/main.backup.jsx", s);

// add saved chat + voice reply state
s = s.replace(
`const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello Krishna. Jarvis is ready. Ask anything, code, search, screen/camera, memory, and tools are all in the left sidebar.' }
  ]);`,
`const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('krishna_jarvis_chat');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ role: 'assistant', text: 'Hello Krishna. Jarvis is ready. Ask anything, code, search, screen/camera, memory, and tools are all in the left sidebar.' }];
  });`
);

s = s.replace(
`const [toolPanel, setToolPanel] = useState('tools');
  const bottomRef = useRef(null);`,
`const [toolPanel, setToolPanel] = useState('tools');
  const [voiceReply, setVoiceReply] = useState(false);
  const bottomRef = useRef(null);`
);

// save chat automatically
s = s.replace(
`useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);`,
`useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

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
  }`
);

// voice reply when assistant answers
s = s.replace(
`function pushAssistant(text) {
    setMessages(m => [...m, { role: 'assistant', text: String(text || '') }]);
  }`,
`function pushAssistant(text) {
    const t = String(text || '');
    setMessages(m => [...m, { role: 'assistant', text: t }]);
    speak(t);
  }`
);

// better new chat
s = s.replace(
`function newChat() {
    setMessages([{ role: 'assistant', text: 'New chat started. What do you want to build or fix now?' }]);
    setInput('');
  }`,
`function newChat() {
    speechSynthesis?.cancel?.();
    setMessages([{ role: 'assistant', text: 'New chat started. What do you want to build or fix now?' }]);
    setInput('');
    try { localStorage.removeItem('krishna_jarvis_chat'); } catch {}
  }`
);

// add voice toggle button near tools
s = s.replace(
`<button className="side-btn" onClick={agentPlan}><Zap size={16}/> Agent plan</button>`,
`<button className="side-btn" onClick={agentPlan}><Zap size={16}/> Agent plan</button>
        <button className="side-btn" onClick={() => setVoiceReply(v => !v)}><Mic size={16}/> Voice reply: {voiceReply ? 'ON' : 'OFF'}</button>`
);

fs.writeFileSync(main, s);
console.log("? Jarvis upgraded: saved chats + voice replies + better chat memory");
