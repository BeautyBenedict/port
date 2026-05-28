const fs = require('fs');
const path = require('path');
const files = JSON.parse(fs.readFileSync('./port-files.json', 'utf8'));
Object.entries(files).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Written: ' + filePath);
});
console.log('All files restored!');