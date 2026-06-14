// stdin.mjs — lit le payload JSON envoyé par Claude Code sur stdin d'un hook.
export async function readStdinJson() {
  return new Promise((resolve) => {
    let data = '';
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try { resolve(data.trim() ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    };
    if (process.stdin.isTTY) { resolve({}); return; }
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', done);
    process.stdin.on('error', done);
    // Filet de sécurité : ne jamais bloquer un hook indéfiniment.
    setTimeout(done, 2000).unref?.();
  });
}
