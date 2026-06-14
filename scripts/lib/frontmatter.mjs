// frontmatter.mjs — lecture/écriture minimale de frontmatter YAML.
// Volontairement limité aux clés scalaires qu'Engram utilise
// (title, type, updated, source_commit, stale). Pas de YAML complet.

export function parseFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(content || '');
  if (!m) return { data: {}, body: content || '' };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!mm) continue;
    let v = mm[2].trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    if (v === 'true') v = true;
    else if (v === 'false') v = false;
    data[mm[1]] = v;
  }
  return { data, body: m[2] };
}

export function buildFrontmatter(data) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    lines.push(`${k}: ${v}`);
  }
  lines.push('---');
  return lines.join('\n');
}
