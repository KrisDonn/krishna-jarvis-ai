const fs = require("fs");
const p = "server/index.js";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("import multer")) {
  s = s.replace(
    `import os from 'os';`,
    `import os from 'os';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import path from 'path';`
  );
}

if (!s.includes("const upload = multer")) {
  s = s.replace(
    `const app = express();`,
    `const app = express();
const upload = multer({ dest: "uploads/" });`
  );
}

if (!s.includes("/api/list-files")) {
  s += `

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
`;
}

fs.writeFileSync(p, s);
console.log("? Coding agent + file reader APIs added");
