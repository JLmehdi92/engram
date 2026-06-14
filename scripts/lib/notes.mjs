// notes.mjs — transforme .engram/ en une liste de "memory items" indexables.
// Un item = une note (.md entière), un bloc de leçon, ou une session.
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';
import { parseLessons, lessonMatchText } from './lessons.mjs';
import { parseWikilinks, normalizeLinkKey } from './graph.mjs';
import { exists } from './paths.mjs';

const IMPORTANCE_BY_TYPE = {
  overview: 8, architecture: 8, decisions: 8, conventions: 6, module: 6,
  reference: 5, glossary: 4, session: 3, lesson: 6, state: 9,
};

function listMarkdown(dir, { includeArchive = false } = {}) {
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const abs = path.join(d, e.name);
      const rel = path.relative(dir, abs).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (e.name === '.index') continue;
        if (e.name === 'archive' && !includeArchive) continue;
        walk(abs);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push({ abs, rel });
      }
    }
  };
  walk(dir);
  return out;
}

function snippet(body, n = 280) {
  return body.replace(/\s+/g, ' ').trim().slice(0, n);
}

function firstDefined(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
}

export function loadItems(engramDir, opts = {}) {
  if (!exists(engramDir)) return [];
  const files = listMarkdown(engramDir, opts);
  const items = [];

  for (const { abs, rel } of files) {
    let content;
    try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    const { data, body } = parseFrontmatter(content);

    // lessons.md → un item par bloc de leçon (pas un item "note").
    if (rel === 'lessons.md' || /(^|\/)lessons\.md$/.test(rel)) {
      for (const l of parseLessons(content)) {
        items.push({
          id: `lesson:${l.id}`,
          type: 'lesson',
          path: rel,
          title: l.title || l.id,
          text: lessonMatchText(l),
          snippet: snippet(l.raw),
          tags: [], keywords: [],
          importance: Number(l.meta.importance) || IMPORTANCE_BY_TYPE.lesson,
          created: l.meta.created || data.updated,
          updated: l.meta.last_used || l.meta.created || data.updated,
          last_used: l.meta.last_used || l.meta.created || data.updated,
          helpful: Number(l.meta.helpful) || 0,
          harmful: Number(l.meta.harmful) || 0,
          status: l.meta.status || 'active',
          valid_to: l.meta.valid_to || null,
          superseded_by: l.meta.superseded_by || null,
          links: parseWikilinks(l.raw),
        });
      }
      continue;
    }

    const type = data.type || (rel.startsWith('sessions/') ? 'session' : 'reference');
    const title = firstDefined(data.title, path.basename(rel, '.md'));
    const tags = Array.isArray(data.tags) ? data.tags
      : (typeof data.tags === 'string' ? data.tags.split(/[,\s]+/).filter(Boolean) : []);
    const keywords = Array.isArray(data.keywords) ? data.keywords
      : (typeof data.keywords === 'string' ? data.keywords.split(/[,\s]+/).filter(Boolean) : []);

    items.push({
      id: `note:${rel}`,
      type,
      path: rel,
      title,
      text: [title, keywords.join(' '), tags.join(' '), body].filter(Boolean).join('\n'),
      snippet: snippet(body),
      tags, keywords,
      importance: Number(data.importance) || IMPORTANCE_BY_TYPE[type] || 5,
      created: data.created || data.updated,
      updated: data.updated,
      last_used: data.last_used || data.updated,
      helpful: 0, harmful: 0,
      status: data.stale ? 'stale' : (data.status || 'active'),
      valid_to: data.valid_to || null,
      superseded_by: data.superseded_by || null,
      links: parseWikilinks(content),
    });
  }
  return items;
}
