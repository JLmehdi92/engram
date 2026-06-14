// lessons.mjs — leçons structurées (apprentissage des erreurs).
// Phase 1 : parsing en lecture. (L'écriture/dédup arrive en Phase 4.)
//
// Format d'un bloc dans lessons.md :
//   ### [L-001] Titre court
//   - trigger: quand …
//   - symptom: message/erreur
//   - root_cause: le pourquoi
//   - fix: le correctif
//   - rule: la règle généralisable
//   - meta: importance=8 · helpful=0 · harmful=0 · status=active · created=2026-06-14 · last_used= · refs=[a,b]

const FIELD_KEYS = ['trigger', 'symptom', 'root_cause', 'fix', 'rule'];

function parseMeta(value) {
  const meta = {};
  if (!value) return meta;
  // séparateurs tolérés : ·  |  ;  ,(hors crochets)
  const parts = value.split(/\s*[·|;]\s*|\s{2,}/).filter(Boolean);
  for (const p of parts) {
    const m = /^([A-Za-z_]+)\s*=\s*(.*)$/.exec(p.trim());
    if (!m) continue;
    let [, k, v] = m;
    v = v.trim();
    if (k === 'importance' || k === 'helpful' || k === 'harmful') meta[k] = Number(v) || 0;
    else if (k === 'refs') meta[k] = v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    else meta[k] = v;
  }
  return meta;
}

export function parseLessons(content) {
  if (!content) return [];
  // Retire un frontmatter éventuel.
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const lessons = [];
  const re = /^###\s*\[(L-[\w.-]+)\]\s*(.*)$/gm;
  const matches = [...body.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const id = m[1];
    const title = (m[2] || '').trim();
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const blockBody = body.slice(start, end);
    const fields = {};
    const meta = {};
    for (const line of blockBody.split(/\r?\n/)) {
      const mm = /^\s*-\s*([A-Za-z_]+)\s*:\s*(.*)$/.exec(line);
      if (!mm) continue;
      const key = mm[1].toLowerCase();
      const val = mm[2].trim();
      if (key === 'meta') Object.assign(meta, parseMeta(val));
      else if (FIELD_KEYS.includes(key)) fields[key] = val;
      else if (['superseded_by', 'valid_to', 'status'].includes(key)) meta[key] = val;
    }
    lessons.push({
      id, title, fields, meta,
      raw: m[0] + blockBody.replace(/\s+$/, ''),
    });
  }
  return lessons;
}

// Texte de matching pour l'indexation/rappel d'une leçon.
export function lessonMatchText(lesson) {
  const f = lesson.fields || {};
  return [lesson.title, f.trigger, f.symptom, f.root_cause, f.rule, (lesson.meta.refs || []).join(' ')]
    .filter(Boolean).join('\n');
}

// Prochain id libre (L-001, L-002, …).
export function nextLessonId(lessons) {
  let max = 0;
  for (const l of lessons) {
    const m = /^L-(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `L-${String(max + 1).padStart(3, '0')}`;
}
