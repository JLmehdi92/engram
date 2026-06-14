// redact.mjs — masque les secrets avant écriture dans la mémoire/sessions.
// Conservateur : préfère masquer un peu trop que fuiter un secret.

const RULES = [
  // Blocs de clé privée PEM (multilignes).
  { type: 'private-key', re: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g },
  // Clés API connues par préfixe. NB : la règle Anthropic (sk-ant-…) doit passer
  // AVANT la règle OpenAI générique (sk-…) qui sinon l'avalerait.
  { type: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/g },
  { type: 'openai-key', re: /\bsk-(?!ant-)[A-Za-z0-9_-]{16,}\b/g },
  { type: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{16,}\b/g },
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { type: 'google-key', re: /\bAIza[A-Za-z0-9_-]{20,}\b/g },
  { type: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'stripe-key', re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  // Bearer / Authorization headers.
  { type: 'bearer', re: /\b[Bb]earer\s+[A-Za-z0-9._-]{12,}/g },
  // URLs avec credentials : scheme://user:pass@host
  { type: 'url-credentials', re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s:@/]+@/gi },
  // Affectations sensibles : FOO_SECRET=..., API_KEY: "...", PASSWORD=...
  {
    type: 'secret-assignment',
    re: /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|PWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"'#,;]{4,})/gi,
  },
];

export function redactText(input) {
  if (input == null) return input;
  let s = String(input);
  for (const { type, re } of RULES) {
    if (type === 'url-credentials') {
      s = s.replace(re, (_m, scheme) => `${scheme}«REDACTED:url-credentials»@`);
    } else if (type === 'secret-assignment') {
      s = s.replace(re, (_m, key) => `${key}=«REDACTED:secret»`);
    } else {
      s = s.replace(re, `«REDACTED:${type}»`);
    }
  }
  return s;
}

// Redaction récursive sur structures JSON (strings uniquement).
export function redactDeep(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}
