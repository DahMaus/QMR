const SVG_NS = 'http://www.w3.org/2000/svg';

// Built with the DOM API instead of string parsing: markup is static, but AMO
// rejects HTML-string assignments outright. Styling (stroke/fill/size) all
// comes from style.css, so only the geometry attributes live here.
function makeIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M7.8 8.4a4.3 4.3 0 1 1 6.1 3.9c-1.2.6-1.9 1.4-1.9 2.6v.6');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '20');
  circle.setAttribute('r', '1.7');
  svg.append(path, circle);
  return svg;
}

const state = {};          // postId -> { n, mine }
let me = null;
let queue = new Set();
let timer = null;

const send = msg => new Promise(res =>
  chrome.runtime.sendMessage(msg, r => res(chrome.runtime.lastError ? null : r)));

function getMe() {
  if (me) return me;
  const el = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  const m = el && el.textContent.match(/@([A-Za-z0-9_]{1,15})/);
  if (m) me = m[1].toLowerCase();
  return me;
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function render(btn) {
  const s = state[btn.dataset.id] || { n: 0, mine: false };
  btn.classList.toggle('qr-on', s.mine);
  btn.querySelector('.qr-count').textContent = s.n > 0 ? fmt(s.n) : '';
  btn.setAttribute('aria-pressed', s.mine);
}
const renderAll = () => document.querySelectorAll('.qr-btn[data-id]').forEach(render);

function want(id) {
  if (state[id]) return;
  queue.add(id);
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

async function flush(retries = 5) {
  if (!getMe() && retries > 0) { timer = setTimeout(() => flush(retries - 1), 1000); return; }
  const ids = [...queue].slice(0, 50);
  ids.forEach(i => queue.delete(i));
  if (!ids.length) return;
  const r = await send({ type: 'counts', user: me, posts: ids });
  if (r && r.counts) {
    const mine = new Set(r.mine || []);
    ids.forEach(id => { state[id] = { n: r.counts[id] || 0, mine: mine.has(id) }; });
    renderAll();
  }
  if (queue.size) timer = setTimeout(flush, 300);
}

function tweetId(article) {
  const t = article.querySelector('a[href*="/status/"] time');
  const a = t ? t.closest('a') : article.querySelector('a[href*="/status/"]');
  const m = a && a.href.match(/status\/(\d+)/);
  return m ? m[1] : null;
}

function inject(article) {
  const bar = article.querySelector('div[role="group"]');
  if (!bar || bar.querySelector('.qr-wrap')) return;
  const id = tweetId(article);
  if (!id) return;

  const wrap = document.createElement('div');
  wrap.className = 'qr-wrap';
  const btn = document.createElement('button');
  btn.className = 'qr-btn';
  btn.setAttribute('aria-label', 'Question react');
  btn.setAttribute('title', '?');
  const icon = document.createElement('span');
  icon.className = 'qr-icon';
  icon.appendChild(makeIcon());
  const count = document.createElement('span');
  count.className = 'qr-count';
  btn.append(icon, count);
  wrap.appendChild(btn);
  btn.dataset.id = id;
  render(btn);
  want(id);

  btn.addEventListener('click', async e => {
    e.preventDefault(); e.stopPropagation();
    if (!getMe()) return;
    const s = state[id] || (state[id] = { n: 0, mine: false });
    const on = !s.mine;
    s.mine = on; s.n = Math.max(0, s.n + (on ? 1 : -1));
    renderAll();
    btn.classList.remove('qr-pop'); void btn.offsetWidth;
    if (on) btn.classList.add('qr-pop');
    const r = await send({ type: 'react', user: me, post: id, on });
    if (!r || !r.ok) {            // revert on failure
      s.mine = !on; s.n = Math.max(0, s.n + (on ? -1 : 1));
      renderAll();
    }
  });

  const like = bar.querySelector('[data-testid="like"], [data-testid="unlike"]');
  let anchor = like;
  while (anchor && anchor.parentElement !== bar) anchor = anchor.parentElement;
  if (anchor) {
    wrap.className = anchor.className + ' qr-wrap';
    const src = like.querySelector('[data-testid="app-text-transition-container"]') || like.querySelector('span');
    if (src) {
      const cs = getComputedStyle(src);
      const c = btn.querySelector('.qr-count');
      c.style.fontFamily = cs.fontFamily;
      c.style.fontSize = cs.fontSize;
      c.style.fontWeight = cs.fontWeight;
      c.style.lineHeight = cs.lineHeight;
    }
    anchor.after(wrap);
  } else {
    wrap.style.flex = '1';
    bar.appendChild(wrap);
  }
}

function scan() {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(inject);
}

let pending = false;
new MutationObserver(() => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; scan(); });
}).observe(document.body, { childList: true, subtree: true });
scan();
