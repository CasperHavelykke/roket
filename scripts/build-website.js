// Build script: reads legal texts from src/legal/texts.ts and embeds them
// into website HTML files, replacing Firestore SDK + fetch logic.
//
// Usage: node scripts/build-website.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTS_FILE = path.join(ROOT, 'src', 'legal', 'texts.ts');
const WEBSITE_DIR = path.join(ROOT, 'website');

// --- Parse texts.ts ---
// Strip TypeScript syntax and evaluate to get the text objects.
function loadTexts() {
  let src = fs.readFileSync(TEXTS_FILE, 'utf8');
  // Remove the comment header
  src = src.replace(/\/\/.*\n/g, '\n');
  // Remove 'export' keywords
  src = src.replace(/export\s+/g, '');
  // Remove type annotations like ': Record<string, string>'
  src = src.replace(/:\s*Record<[^>]+>/g, '');
  // Wrap in a function to capture the consts
  const fn = new Function(src + '\nreturn { privacyPolicy, termsConditions, deleteAccount };');
  return fn();
}

// --- Build a single HTML file ---
function buildHtml(filename, texts, elementPrefix) {
  const filePath = path.join(WEBSITE_DIR, filename);
  let html = fs.readFileSync(filePath, 'utf8');

  // Serialize texts as a JS object literal with escaped strings
  const textsJs = serializeTexts(texts);

  // Build replacement script block (no Firebase, direct render)
  const newScript = `<script>
var langs = ['en', 'da', 'es', 'de', 'fr', 'pt'];
var lang = 'en';
var theme = localStorage.getItem('roket-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
if (theme === 'dark') document.body.classList.add('dark');
document.getElementById('btn-theme').textContent = theme === 'dark' ? '\\u2600\\uFE0F' : '\\uD83C\\uDF19';

function setLang(l) {
  lang = l;
  document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('visible'); });
  document.getElementById('content-' + l).classList.add('visible');
  document.querySelectorAll('.lang-toggle button').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('btn-' + l).classList.add('active');
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.body.classList.toggle('dark');
  document.getElementById('btn-theme').textContent = theme === 'dark' ? '\\u2600\\uFE0F' : '\\uD83C\\uDF19';
  localStorage.setItem('roket-theme', theme);
}

var texts = ${textsJs};

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function formatText(text) {
  var lines = text.split('\\n');
  var html = '';
  var inList = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var isListItem = /^[\\-\\u2022]\\s/.test(line);
    if (!isListItem && inList) { html += '</ul>'; inList = false; }
    if (/^#\\s+/.test(line)) {
      html += '<h3>' + esc(line.replace(/^#\\s+/, '')) + '</h3>';
    } else if (isListItem) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + esc(line.replace(/^[\\-\\u2022]\\s+/, '')) + '</li>';
    } else if (line.trim() === '') {
      continue;
    } else {
      html += '<p>' + esc(line) + '</p>';
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function renderText(elementId, text) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.className = 'formatted-text';
  el.innerHTML = formatText(text);
}

langs.forEach(function(l) {
  renderText('${elementPrefix}-' + l, texts[l]);
});
</script>`;

  // Replace: from first Firebase SDK script tag to closing </script> before </body>
  // Pattern: <script src="https://www.gstatic.com/firebasejs/...">...all scripts...</script>
  html = html.replace(
    /<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[\s\S]*<\/script>\s*(?=<\/body>)/,
    newScript + '\n'
  );

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ${filename}: done`);
}

// Serialize a Record<string, string> as a JS object literal
function serializeTexts(texts) {
  const entries = Object.entries(texts).map(([lang, text]) => {
    // Escape for embedding in a JS string literal (single quotes)
    const escaped = text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
    return `  ${lang}: '${escaped}'`;
  });
  return '{\n' + entries.join(',\n') + '\n}';
}

// --- Main ---
console.log('Loading texts from src/legal/texts.ts...');
const { privacyPolicy, termsConditions, deleteAccount } = loadTexts();
console.log(`  privacyPolicy: ${Object.keys(privacyPolicy).length} languages`);
console.log(`  termsConditions: ${Object.keys(termsConditions).length} languages`);
console.log(`  deleteAccount: ${Object.keys(deleteAccount).length} languages`);

console.log('Building website files...');
buildHtml('privacy.html', privacyPolicy, 'policy');
buildHtml('terms.html', termsConditions, 'terms');
buildHtml('legal.html', deleteAccount, 'delete');

console.log('Done!');
