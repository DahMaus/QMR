// After deploying the worker, paste its URL here (no trailing slash)
const API = 'https://qreact.melodiecum.workers.dev';

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    try {
      if (msg.type === 'counts') {
        const u = `${API}/counts?user=${encodeURIComponent(msg.user || '')}&posts=${msg.posts.join(',')}`;
        respond(await (await fetch(u)).json());
      } else if (msg.type === 'react') {
        const r = await fetch(`${API}/react`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user: msg.user, post: msg.post, on: msg.on }),
        });
        respond({ ok: r.ok });
      }
    } catch (e) {
      respond(null);
    }
  })();
  return true; // keep channel open for async response
});
