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

// ---------------------------------------------------------------------------
// Écriture par delta (jamais de réécriture globale du fichier).
// ---------------------------------------------------------------------------

const FIELD_ORDER = ['trigger', 'symptom', 'root_cause', 'fix', 'rule'];
const META_ORDER = ['importance', 'helpful', 'harmful', 'status', 'created', 'last_used', 'refs', 'superseded_by', 'valid_to'];

function renderMeta(meta = {}) {
  const m = { importance: 6, helpful: 0, harmful: 0, status: 'active', ...meta };
  const parts = [];
  for (const k of META_ORDER) {
    if (m[k] === undefined || m[k] === null) { if (['created', 'last_used'].includes(k)) parts.push(`${k}=`); continue; }
    let v = m[k];
    if (k === 'refs') v = `[${(Array.isArray(v) ? v : [v]).join(',')}]`;
    parts.push(`${k}=${v}`);
  }
  return parts.join(' · ');
}

// Sérialise une leçon en bloc markdown.
export function renderLesson(lesson) {
  const lines = [`### [${lesson.id}] ${lesson.title || ''}`.trimEnd()];
  for (const k of FIELD_ORDER) {
    if (lesson.fields && lesson.fields[k] !== undefined && lesson.fields[k] !== '') {
      lines.push(`- ${k}: ${lesson.fields[k]}`);
    }
  }
  lines.push(`- meta: ${renderMeta(lesson.meta)}`);
  return lines.join('\n');
}

// Localise [start,end[ du bloc d'une leçon par id dans le contenu, ou null.
function blockRange(content, id) {
  const re = new RegExp(`^###\\s*\\[${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'm');
  const m = re.exec(content);
  if (!m) return null;
  const start = m.index;
  const after = content.slice(start + m[0].length);
  const nextRel = /^###\s*\[/m.exec(after);
  const end = nextRel ? start + m[0].length + nextRel.index : content.length;
  return [start, end];
}

// Squelette de fichier lessons.md si absent.
export function lessonsScaffold(today) {
  return `---\ntitle: Leçons & dépannage\ntype: lessons\nupdated: ${today}\n---\n\n`
    + '# Leçons & dépannage\n\n'
    + '> **Avant de proposer une solution à un problème, consulte ce fichier.**\n'
    + '> Les leçons sont enregistrées APRÈS vérification que le correctif marche.\n\n';
}

// Ajoute une leçon (delta : append d'un bloc). Retourne { content, id }.
export function addLesson(content, { title, fields, meta }, today) {
  const lessons = parseLessons(content);
  const id = nextLessonId(lessons);
  const block = renderLesson({ id, title, fields, meta: { created: today, ...meta } });
  const sep = content.endsWith('\n\n') ? '' : (content.endsWith('\n') ? '\n' : '\n\n');
  return { content: content + sep + block + '\n', id };
}

// Applique une transformation fn(lesson) à un bloc existant (delta : remplace ce bloc).
export function modifyLesson(content, id, fn) {
  const range = blockRange(content, id);
  if (!range) return content;
  const [start, end] = range;
  const slice = content.slice(start, end);
  const parsed = parseLessons(slice)[0];
  if (!parsed) return content;
  fn(parsed);
  const rendered = renderLesson(parsed);
  const trailing = slice.endsWith('\n\n') ? '\n\n' : (slice.endsWith('\n') ? '\n' : '');
  return content.slice(0, start) + rendered + trailing + content.slice(end);
}

// Incrémente un compteur (helpful/harmful) + met à jour last_used.
export function bumpCounter(content, id, field, today, delta = 1) {
  return modifyLesson(content, id, (l) => {
    l.meta[field] = (Number(l.meta[field]) || 0) + delta;
    if (today) l.meta.last_used = today;
  });
}

// Marque une leçon comme remplacée (bi-temporel, non destructif).
export function supersedeLesson(content, oldId, newId, today) {
  return modifyLesson(content, oldId, (l) => {
    l.meta.status = 'superseded';
    l.meta.superseded_by = newId;
    if (today) l.meta.valid_to = today;
  });
}

// Trouve les leçons les plus proches d'un texte candidat (pour décider ADD/UPDATE/NOOP).
export function findSimilarLessons(lessons, text, topN = 3) {
  // import paresseux pour éviter un cycle.
  return import('./textsearch.mjs').then(({ buildBM25, searchBM25 }) => {
    const idx = buildBM25(lessons.map((l) => ({ id: l.id, text: lessonMatchText(l) })));
    return searchBM25(idx, text).slice(0, topN)
      .map((r) => ({ id: r.id, score: Number(r.score.toFixed(3)),
        title: (lessons.find((l) => l.id === r.id) || {}).title }));
  });
}
