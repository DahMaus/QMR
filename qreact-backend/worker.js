const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

const USER_RE = /^[a-z0-9_]{1,15}$/;
const POST_RE = /^\d{1,25}$/;

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (url.pathname === '/counts' && req.method === 'GET') {
      const posts = (url.searchParams.get('posts') || '').split(',').filter(p => POST_RE.test(p)).slice(0, 50);
      const user = (url.searchParams.get('user') || '').toLowerCase();
      if (!posts.length) return json({ counts: {}, mine: [] });
      const ph = posts.map(() => '?').join(',');
      const c = await env.DB.prepare(`SELECT post, COUNT(*) AS n FROM reacts WHERE post IN (${ph}) GROUP BY post`)
        .bind(...posts).all();
      const counts = {};
      for (const r of c.results) counts[r.post] = r.n;
      let mine = [];
      if (USER_RE.test(user)) {
        const m = await env.DB.prepare(`SELECT post FROM reacts WHERE user = ? AND post IN (${ph})`)
          .bind(user, ...posts).all();
        mine = m.results.map(r => r.post);
      }
      return json({ counts, mine });
    }

    if (url.pathname === '/react' && req.method === 'POST') {
      let b;
      try { b = await req.json(); } catch { return json({ ok: false }, 400); }
      const user = String(b.user || '').toLowerCase();
      const post = String(b.post || '');
      if (!USER_RE.test(user) || !POST_RE.test(post)) return json({ ok: false }, 400);
      if (b.on) await env.DB.prepare('INSERT OR IGNORE INTO reacts (user, post) VALUES (?, ?)').bind(user, post).run();
      else await env.DB.prepare('DELETE FROM reacts WHERE user = ? AND post = ?').bind(user, post).run();
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  },
};
