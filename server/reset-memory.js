import fs from 'fs';
import path from 'path';
const memoryPath = path.join(process.cwd(), 'data', 'memory', 'profile.json');
fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
fs.writeFileSync(memoryPath, JSON.stringify({ facts: [], updatedAt: new Date().toISOString() }, null, 2));
console.log('Memory reset:', memoryPath);
