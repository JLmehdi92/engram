// gitignore.mjs — matcher .gitignore pragmatique pour le fallback hors-git.
// Couvre l'essentiel : commentaires, négation (!), ancrage (/), dossiers (/ final),
// jokers * et **. Pas une réimplémentation complète de la spec gitignore, mais
// suffisant pour exclure correctement les fichiers usuels.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_EXCLUDES = [
  '.git/', '.engram/', 'node_modules/', 'dist/', 'build/', 'out/', 'coverage/',
  '.next/', '.nuxt/', '.svelte-kit/', '.turbo/', '.cache/', '.venv/', 'venv/',
  '__pycache__/', '.pytest_cache/', 'target/', 'vendor/', '.idea/', '.vscode/',
  '.DS_Store', 'Thumbs.db',
];

export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff', '.svgz',
  '.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.jar', '.war',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a', '.class', '.pyc',
  '.mp3', '.mp4', '.mov', '.avi', '.mkv', '.wav', '.flac', '.webm',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.lock', '.wasm', '.node', '.db', '.sqlite', '.sqlite3',
]);

function patternToRegExp(pattern) {
  let p = pattern.trim();
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);

  // Échappe les caractères regex sauf nos jokers.
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') { re += '.*'; i++; if (p[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  const prefix = anchored ? '^' : '(^|/)';
  const suffix = dirOnly ? '(/|$)' : '($|/)';
  return new RegExp(prefix + re + suffix);
}

export function loadGitignore(rootDir) {
  const rules = [];
  for (const pat of DEFAULT_EXCLUDES) rules.push({ re: patternToRegExp(pat), negate: false });
  const giPath = path.join(rootDir, '.gitignore');
  try {
    const text = fs.readFileSync(giPath, 'utf8');
    for (let line of text.split(/\r?\n/)) {
      line = line.replace(/(?<!\\)#.*$/, '').trim();
      if (!line) continue;
      const negate = line.startsWith('!');
      if (negate) line = line.slice(1);
      rules.push({ re: patternToRegExp(line), negate });
    }
  } catch { /* pas de .gitignore */ }
  return rules;
}

// relPath utilise des '/' (séparateurs POSIX).
export function isIgnored(relPath, rules) {
  let ignored = false;
  for (const { re, negate } of rules) {
    if (re.test(relPath)) ignored = !negate;
  }
  return ignored;
}

export function isBinaryPath(relPath) {
  return BINARY_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}
