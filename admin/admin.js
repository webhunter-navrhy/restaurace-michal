/* =====================================================================
   Administrace Restaurant Michal
   Obsah webu je v repozitáři (_data/*.json). Uložení = jeden commit přes backend
   webhunter-admin (Cloudflare Worker, přihlášení heslem); GitHub Action pak web
   přegeneruje (~1 min). Rezervace a poptávky z webu ukládá backend (KV), čtou se přes /forms.
   Texty jsou v 7 jazycích: přepínač jazyka nahoře upravuje vždy jen zvolený jazyk.
   ===================================================================== */
'use strict';
(() => {
const CFG = {
  id: 'restaurace-michal', site: '../',
  api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.search.includes('local') ? 'http://localhost:8787' : 'https://webhunter-admin.webhunter.workers.dev',
};
const FILES = { balicky: '_data/balicky.json', menu: '_data/menu.json', texty: '_data/texty.json', sbirka: '_data/sbirka.json', fotky: '_data/fotky.json', site: '_data/site.json', gdpr: '_data/gdpr.json', popup: '_data/popup.json' };
const LABEL = { balicky: 'Balíčky', menu: 'Menu', texty: 'Texty', sbirka: 'Folklórní sbírka', fotky: 'Fotky', site: 'Kontakty', gdpr: 'Ochrana údajů', popup: 'Pop-up okno' };
const LANGS = ['cs', 'en', 'de', 'fr', 'es', 'it', 'zh'];
const LANG_NAME = { cs: 'Čeština', en: 'Angličtina', de: 'Němčina', fr: 'Francouzština', es: 'Španělština', it: 'Italština', zh: 'Čínština' };
const LANG_SHORT = { cs: 'CZ', en: 'EN', de: 'DE', fr: 'FR', es: 'ES', it: 'IT', zh: '中文' };
const SK = 'restaurace_michal_admin';

const S = { sess: null, def: false, D: {}, snap: {}, pending: {}, preview: {}, saving: false, lib: null, lang: localStorage.getItem('restaurace_michal_lang') || 'cs', forms: null };


/* ---------------------------------------------------------------- ikony */
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  phone: I('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  tag: I('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  bed: I('<path d="M3 19V6M3 13h18v6M21 13v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10" r="1.6"/>'),
  text: I('<path d="M5 6h14M5 11h14M5 16h9"/>'),
  pages: I('<rect x="4" y="3" width="13" height="16" rx="1.5"/><path d="M8 21h11a1 1 0 0 0 1-1V7"/><path d="M8 8h5M8 12h5"/>'),
  map: I('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  star: I('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
  q: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h0"/>'),
  doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.8 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.8-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 3.3 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.8 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 10 3.3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.8 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 20.7 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.3 1z"/>'),
  help: I('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h0"/>'),
  popup: I('<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="7" y="8" width="10" height="8" rx="1"/><path d="m14.5 9.5-1 1M13.5 9.5l1 1"/>'),
  ext: I('<path d="M14 4h6v6M20 4L10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  menu: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  x: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  up: I('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  left: I('<path d="M15 18l-6-6 6-6"/>'),
  right: I('<path d="M9 18l6-6-6-6"/>'),
  trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  chev: I('<path d="M6 9l6 6 6-6"/>'),
  eye: I('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
  upload: I('<path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  image: I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h0"/>'),
  logout: I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>'),
  cal: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
};
const LOGO = '<img src="../assets/img/logo.png" alt="" style="height:30px;width:auto">';
/* ---------------------------------------------------------------- utils */
const $ = (s, c = document) => c.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8);
const slugify = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const imgSrc = (p) => !p ? '' : S.preview[p] || (/^(https?:|blob:|data:)/.test(p) ? p : CFG.site + p);
const kc = (v) => { const s = String(v ?? '').trim(); if (!s) return '–'; return /^\d[\d\s]*$/.test(s) ? (+s.replace(/\s/g, '')).toLocaleString('cs-CZ') + ' Kč' : (s.includes('Kč') ? s : s + ' Kč'); };

/** h('div.class', {attr}, ...children) — malý DOM helper */
function h(sel, props = {}, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

function toast(title, sub = '', type = '') {
  const el = h('div.toast' + (type ? '.' + type : ''), {}, h('b', {}, title), sub ? h('small', {}, sub) : null);
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 450); }, type === 'err' ? 7000 : 4000);
}
function modal({ title, body, actions = [] }) {
  return new Promise((resolve) => {
    const close = (v) => { bg.remove(); resolve(v); };
    const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true' }, h('h2', {}, title));
    if (typeof body === 'string') box.append(h('div', { html: body })); else if (body) box.append(body);
    box.append(h('div.modal-actions', {}, actions.map((a) => h('button.btn' + (a.cls ? '.' + a.cls : ''), { type: 'button', onclick: () => close(typeof a.value === 'function' ? a.value(box) : a.value) }, a.label))));
    const bg = h('div.modal-bg', { onclick: (e) => { if (e.target === bg) close(null); } }, box);
    $('#modal-root').append(bg);
    const f = box.querySelector('input,textarea,select,button.btn-primary'); if (f) setTimeout(() => f.focus(), 50);
  });
}
const confirmDlg = (title, text, ok = 'Smazat', cls = 'btn-dark') => modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: 'Zrušit', value: false }, { label: ok, cls, value: true }] }).then((v) => v === true);

/* ---------------------------------------------------------------- API */
const b64e = (bytes) => { let s = ''; bytes = new Uint8Array(bytes); for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const utf8b64 = (str) => b64e(new TextEncoder().encode(str));
function saveSess() { localStorage.setItem(SK, JSON.stringify({ t: S.sess, def: S.def, exp: Date.now() + 11.5 * 3600e3 })); }
async function api(path, opt = {}, retried = false) {
  const headers = { ...(typeof opt.body === 'string' ? { 'Content-Type': 'application/json' } : {}) };
  if (S.sess) headers.Authorization = 'Bearer ' + S.sess;
  let r;
  try { r = await fetch(`${CFG.api}/api/${CFG.id}${path}`, { ...opt, headers, cache: 'no-store' }); }
  catch { throw new Error('Nelze se spojit se serverem. Zkontrolujte připojení k internetu.'); }
  if (r.status === 401 && path !== '/login' && !retried && S.D.site) { if (await reauth()) return api(path, opt, true); }
  if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch {} const e = new Error(m); e.status = r.status; throw e; }
  return opt.raw ? r.text() : r.json();
}
const readFile = (p) => api('/file?path=' + encodeURIComponent(p) + '&t=' + Date.now(), { raw: true });
async function commit(files, message) {
  const out = []; const queue = [...files];
  const worker = async () => { while (queue.length) { const f = queue.shift(); const { sha } = await api('/blob', { method: 'POST', body: JSON.stringify({ content: f.b64 ?? utf8b64(f.content), encoding: 'base64' }) }); out.push({ path: f.path, sha }); } };
  await Promise.all([worker(), worker(), worker()]);
  return (await api('/commit', { method: 'POST', body: JSON.stringify({ files: out, message }) })).sha;
}
async function reauth() {
  const inp = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Heslo' });
  const pw = await modal({ title: 'Přihlášení vypršelo', body: h('div', {}, h('p', {}, 'Zadejte prosím heslo znovu — rozdělaná práce zůstane zachovaná.'), inp), actions: [{ label: 'Zrušit', value: null }, { label: 'Přihlásit', cls: 'btn-primary', value: () => inp.value }] });
  if (!pw) return false;
  try { const r = await api('/login', { method: 'POST', body: JSON.stringify({ password: pw }) }); S.sess = r.token; S.def = r.def; saveSess(); return true; }
  catch (e) { toast('Přihlášení se nepovedlo', e.message, 'err'); return false; }
}

/* ---------------------------------------------------------------- data */
async function loadAll() {
  const keys = Object.keys(FILES);
  const res = await Promise.all(keys.map((k) => readFile(FILES[k]).then(JSON.parse)));
  keys.forEach((k, i) => { S.D[k] = res[i]; });
  snapshot();
}
function snapshot(keys = Object.keys(FILES)) { keys.forEach((k) => { S.snap[k] = JSON.stringify(S.D[k]); }); }
const dirtyKeys = () => Object.keys(FILES).filter((k) => S.D[k] && JSON.stringify(S.D[k]) !== S.snap[k]);
const changed = debounce(() => updateSavebar(), 100);
window.addEventListener('beforeunload', (e) => { if (dirtyKeys().length) { e.preventDefault(); e.returnValue = ''; } });

function validate() {
  const slugs = new Set();
  for (const b of S.D.balicky) {
    if (!String(b.nazev?.cs || '').trim()) return 'Jeden balíček nemá český název.';
    if (!b.slug) b.slug = slugify(b.nazev.cs) || 'balicek-' + uid();
    b.slug = slugify(b.slug) || 'balicek-' + uid();
    while (slugs.has(b.slug)) b.slug = b.slug + '-' + uid();
    slugs.add(b.slug);
  }
  for (const s of S.D.menu.sady) { if (!String(s.nazev?.cs || '').trim()) return 'Jedno menu nemá český název.'; if (!s.id) s.id = slugify(s.nazev.cs) || 'menu-' + uid(); }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.D.site.email || '')) return 'E-mail v Kontaktech nevypadá správně.';
  if (!S.D.fotky.hero.length) return 'Přidejte alespoň jednu úvodní fotku (Fotky).';
  return null;
}
async function saveAll() {
  const keys = dirtyKeys();
  if (!keys.length || S.saving) return;
  const err = validate(); if (err) return toast('Nelze uložit', err, 'err');
  S.saving = true; updateSavebar();
  const bar = h('div.progress-line'); document.body.append(bar);
  try {
    const keys2 = dirtyKeys();
    const files = keys2.map((k) => ({ path: FILES[k], content: JSON.stringify(S.D[k], null, 2) + '\n' }));
    const used = JSON.stringify(S.D);
    const imgs = Object.keys(S.pending).filter((p) => used.includes(p));
    imgs.forEach((p) => files.push({ path: p, b64: S.pending[p] }));
    const sha = await commit(files, keys2.map((k) => LABEL[k]).join(', ') + (imgs.length ? ` (+${imgs.length} foto)` : ''));
    imgs.forEach((p) => delete S.pending[p]);
    snapshot(keys2);
    toast('Uloženo', 'Změny se na webu objeví přibližně za minutu.', 'ok');
    watchPublish(sha);
  } catch (e) { toast('Uložení se nepovedlo', e.message, 'err'); }
  finally { S.saving = false; bar.remove(); updateSavebar(); }
}
function discard() { dirtyKeys().forEach((k) => { S.D[k] = JSON.parse(S.snap[k]); }); updateSavebar(); route(); toast('Změny zahozeny'); }

/* publikace — čeká, až version.json na webu obsahuje nový commit */
let pubTimer = null;
function setPub(state, text) { const el = $('.pub'); if (el) { el.className = 'pub ' + state; el.innerHTML = `<i></i><span>${esc(text)}</span>`; } }
function watchPublish(sha) {
  localStorage.setItem(SK + '_pub', JSON.stringify({ sha, t: Date.now() }));
  clearInterval(pubTimer); setPub('busy', 'Zveřejňuji změny…');
  const t0 = Date.now();
  pubTimer = setInterval(async () => {
    try {
      const v = await fetch(CFG.site + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
      if (v.sha === sha) { clearInterval(pubTimer); localStorage.removeItem(SK + '_pub'); setPub('', 'Web je aktuální'); toast('Změny jsou na webu', 'Web byl právě aktualizován.', 'ok'); return; }
    } catch {}
    if (Date.now() - t0 > 8 * 60000) { clearInterval(pubTimer); setPub('warn', 'Zveřejnění trvá déle'); }
  }, 6000);
}
function initPub() { const p = JSON.parse(localStorage.getItem(SK + '_pub') || 'null'); if (p && Date.now() - p.t < 10 * 60000) watchPublish(p.sha); else setPub('', 'Web je aktuální'); }

/* ---------------------------------------------------------------- fotky */
async function compress(file, max = 1800) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { throw new Error(`Soubor „${file.name}“ nejde načíst. Použijte fotku JPG, PNG nebo WebP (fotky z iPhonu ve formátu HEIC nejdřív uložte jako JPG).`); }
  const sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.82)), ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86)); ext = 'jpg'; }
  return { blob, ext, w: c.width, h: c.height };
}
async function upload(file, hint, max) {
  const { blob, ext, w, h: hh } = await compress(file, max);
  const d = new Date();
  const name = (slugify(hint) || slugify(file.name.replace(/\.[^.]+$/, '')) || 'foto').slice(0, 40);
  const path = `img/uploads/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${name}-${uid()}.${ext}`;
  S.pending[path] = b64e(await blob.arrayBuffer());
  S.preview[path] = URL.createObjectURL(blob);
  return { src: path, w, h: hh };
}
async function library() {
  if (!S.lib) { try { S.lib = await fetch(CFG.site + 'admin/images.json?t=' + Date.now()).then((r) => r.json()); } catch { S.lib = []; } }
  return [...Object.keys(S.pending), ...S.lib];
}
/** výběr fotky z webu (vrátí cestu nebo null) */
async function pickFromLibrary(title = 'Vybrat fotku z webu') {
  const list = await library();
  return new Promise((resolve) => {
    let done = false;
    const grid = h('div.lib', {}, list.map((p) => h('button', { type: 'button', onclick: () => { done = true; resolve(p); document.querySelector('.modal-bg')?.remove(); } }, h('img', { src: imgSrc(p), loading: 'lazy', alt: '' }))));
    modal({ title, body: grid, actions: [{ label: 'Zavřít', value: null }] }).then(() => { if (!done) resolve(null); });
  });
}
const setPhoto = (obj, r) => { obj.src = r.src; if (r.w) { obj.w = r.w; obj.h = r.h; } else { delete obj.w; delete obj.h; } delete obj.m; delete obj.sm; };

/* ---------------------------------------------------------------- pole formulářů */
const bump = () => changed();
function fText(obj, key, label, o = {}) {
  const inp = o.multi
    ? h('textarea', { rows: o.rows || 4, placeholder: o.ph || '', oninput: (e) => { obj[key] = e.target.value; bump(); o.on?.(); } })
    : h('input', { type: o.type || 'text', placeholder: o.ph || '', inputmode: o.inputmode, autocomplete: 'off', oninput: (e) => { obj[key] = o.type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value; bump(); o.on?.(); } });
  inp.value = obj[key] ?? '';
  return h('label.field', {}, h('span', {}, label), inp, o.hint ? h('small', {}, o.hint) : null);
}
function fSelect(obj, key, label, options, o = {}) {
  if (obj[key] != null && !options.some(([v]) => String(v) === String(obj[key]))) options = [[obj[key], String(obj[key])], ...options];
  const sel = h('select', { onchange: (e) => { obj[key] = e.target.value; bump(); o.on?.(); } }, options.map(([v, t]) => h('option', { value: v }, t)));
  sel.value = String(obj[key] ?? options[0][0]);
  return h('label.field', {}, h('span', {}, label), sel);
}
function fCheck(obj, key, label, on) {
  return h('label.check', {}, h('input', { type: 'checkbox', checked: obj[key], onchange: (e) => { obj[key] = e.target.checked; bump(); on?.(); } }), h('span', {}, label));
}
/** jedna fotka; obj[key] = cesta (pole s w/h volitelně v objektu dims) */
function fImage(obj, key, label, hint = '', o = {}) {
  const prev = h('img.prev', { src: imgSrc(obj[key]), alt: '' });
  const set = (r) => { obj[key] = r.src; if (key === 'src') delete obj.sm; if (o.dims) { if (r.w) { obj[o.dims[0]] = r.w; obj[o.dims[1]] = r.h; } else { delete obj[o.dims[0]]; delete obj[o.dims[1]]; } } prev.src = imgSrc(r.src); bump(); o.on?.(); };
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { set(await upload(f, hint)); toast('Fotka připravena', 'Na web se nahraje po uložení.'); } catch (er) { toast('Fotku se nepodařilo načíst', er.message, 'err'); }
    e.target.value = '';
  } });
  return h('div.field', {}, h('span', {}, label),
    h('div.img-field', {}, prev, h('div.acts', {},
      h('button.btn.btn-sm', { type: 'button', onclick: () => file.click(), html: IC.upload + 'Nahrát novou' }),
      h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: async () => { const p = await pickFromLibrary(); if (p) set({ src: p }); }, html: IC.image + 'Vybrat z webu' }), file)),
    o.hint ? h('small', {}, o.hint) : null);
}
/** mřížka fotek: nahrát více najednou, popis, pořadí, mazání */
function fPhotos(arr, o = {}) {
  const wrap = h('div');
  const render = () => {
    const grid = h('div.photos');
    arr.forEach((p, i) => {
      if (!p.alt || typeof p.alt !== 'object') p.alt = { cs: p.alt || '' };
      const alt = h('textarea', { rows: 2, placeholder: (S.lang !== 'cs' && p.alt.cs) ? 'Česky: ' + p.alt.cs : (o.altPh || `Popis fotky (${LANG_NAME[S.lang]})`), 'aria-label': 'Popis fotky', oninput: (e) => { p.alt[S.lang] = e.target.value; bump(); } }); alt.value = p.alt[S.lang] || '';
      const extra = [];
      if (o.popisek) { const pp = h('input', { type: 'text', placeholder: 'Popisek pod fotkou', style: 'border:0;border-top:1px solid var(--line);border-radius:0;font-size:.8rem', oninput: (e) => { p.popisek = e.target.value; bump(); } }); pp.value = p.popisek || ''; extra.push(pp); }
      if (o.extra) extra.push(o.extra(p));
      if (o.koupelna) extra.push(h('label.check', { style: 'padding:.3rem .5rem;font-size:.78rem' }, h('input', { type: 'checkbox', checked: !!p.koupelna, onchange: (e) => { if (e.target.checked) p.koupelna = true; else delete p.koupelna; bump(); } }), h('span', {}, 'koupelna (ne jako náhled)')));
      const img = h('img', { src: imgSrc(p.m && !S.preview[p.src] ? p.m : p.src), alt: '', title: 'Vyměnit fotku', onclick: () => replace(i) });
      grid.append(h('div.photo', {}, img, (o.first && i === 0) ? h('span.ph-first', {}, o.first) : null,
        h('div.ph-tools', {},
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunout dopředu', 'aria-label': 'Posunout dopředu', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.left }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Smazat fotku', 'aria-label': 'Smazat fotku', onclick: async () => { if (await confirmDlg('Smazat fotku?', 'Fotka zmizí z webu (po uložení).')) { arr.splice(i, 1); bump(); render(); } }, html: IC.trash }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunout dozadu', 'aria-label': 'Posunout dozadu', disabled: i === arr.length - 1, onclick: () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.right })),
        alt, ...extra));
    });
    if (!o.max || arr.length < o.max) {
      const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async (e) => {
        const fs = [...e.target.files]; e.target.value = '';
        for (const f of fs) {
          try { const r = await upload(f, o.hint || 'foto', o.maxPx); const it = { src: r.src, alt: { cs: '' }, w: r.w, h: r.h }; if (o.make) Object.assign(it, o.make()); arr.push(it); bump(); }
          catch (er) { toast('Fotku se nepodařilo načíst', er.message, 'err'); }
        }
        render(); if (fs.length) toast(fs.length === 1 ? 'Fotka přidána' : `Přidáno ${fs.length} fotek`, 'Doplňte popis a uložte změny.');
      } });
      grid.append(h('button.photo-add', { type: 'button', onclick: () => file.click(), html: IC.upload + '<span>Nahrát fotky<br><small>můžete vybrat víc najednou</small></span>' }), file);
      grid.append(h('button.photo-add', { type: 'button', onclick: async () => { const p = await pickFromLibrary(); if (p) { const it = { src: p, alt: { cs: '' } }; if (o.make) Object.assign(it, o.make()); arr.push(it); bump(); render(); } }, html: IC.image + '<span>Vybrat z fotek na webu</span>' }));
    }
    wrap.replaceChildren(grid);
  };
  const replace = async (i) => {
    const r = await modal({ title: 'Vyměnit fotku', body: '<p>Nahrajte novou fotku, nebo vyberte některou z fotek, které už na webu jsou. Popis fotky zůstane.</p>', actions: [{ label: 'Zrušit', value: null }, { label: 'Vybrat z webu', value: 'lib' }, { label: 'Nahrát novou', cls: 'btn-primary', value: 'up' }] });
    if (r === 'lib') { const p = await pickFromLibrary(); if (p) { setPhoto(arr[i], { src: p }); bump(); render(); } }
    if (r === 'up') {
      const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { setPhoto(arr[i], await upload(f, o.hint || 'foto', o.maxPx)); bump(); render(); toast('Fotka vyměněna', 'Na web se nahraje po uložení.'); } catch (er) { toast('Fotku se nepodařilo načíst', er.message, 'err'); }
      } });
      document.body.append(file); file.click(); setTimeout(() => file.remove(), 60000);
    }
  };
  render();
  return wrap;
}
/** seznam položek s rozbalováním, řazením a mazáním */
function fList(arr, o) {
  const wrap = h('div');
  const render = (openIdx = -1) => {
    wrap.replaceChildren();
    const items = h('div.items');
    if (!arr.length) items.append(h('p.empty', {}, o.empty || 'Zatím tu nic není.'));
    arr.forEach((it, i) => {
      const title = h('b'), sub = h('small'), thumb = o.thumb ? h('img.thumb', { alt: '' }) : null;
      const refresh = () => { title.textContent = o.title(it) || '(bez názvu)'; sub.textContent = o.sub ? o.sub(it) : ''; if (thumb) thumb.src = imgSrc(o.thumb(it)); };
      const body = h('div.item-body');
      let built = false;
      const el = h('div.item');
      const toggle = () => { if (!built) { o.body(it, body, refresh); built = true; } el.classList.toggle('open'); };
      const head = h('div.item-head', {},
        thumb, h('div.t', { onclick: toggle }, title, sub),
        h('div.item-tools', {},
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunout nahoru', 'aria-label': 'Posunout nahoru', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.up }),
          h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Posunout dolů', 'aria-label': 'Posunout dolů', disabled: i === arr.length - 1, onclick: () => { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.down }),
          o.noDelete ? null : h('button.btn.btn-icon.btn-ghost', { type: 'button', title: 'Smazat', 'aria-label': 'Smazat', onclick: async () => { if (await confirmDlg('Smazat položku?', `„${o.title(it) || 'bez názvu'}“ bude odstraněna.`)) { arr.splice(i, 1); bump(); render(); } }, html: IC.trash }),
          h('button.btn.btn-icon.btn-ghost.chev', { type: 'button', 'aria-label': 'Rozbalit', onclick: toggle, html: IC.chev })));
      el.append(head, body); items.append(el); refresh();
      if (i === openIdx) toggle();
    });
    wrap.append(...[items, o.make ? h('button.btn.add', { type: 'button', onclick: () => { arr.push(o.make()); bump(); render(arr.length - 1); }, html: IC.plus + (o.addLabel || 'Přidat') }) : null].filter(Boolean));
  };
  render();
  return wrap;
}
/** seznam textů (odrážky) */
function fStrList(arr, label, o = {}) {
  const box = h('div.field', {}, h('span', {}, label));
  const list = h('div');
  const render = () => {
    list.replaceChildren(...arr.map((v, i) => {
      const inp = o.multi ? h('textarea', { rows: 2 }) : h('input', { type: 'text' });
      inp.value = v; inp.addEventListener('input', (e) => { arr[i] = e.target.value; bump(); });
      return h('div', { style: 'display:flex;gap:.4rem;align-items:flex-start;margin-bottom:.45rem' }, inp,
        h('button.btn.btn-icon.btn-ghost', { type: 'button', 'aria-label': 'Posunout nahoru', disabled: i === 0, onclick: () => { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); bump(); render(); }, html: IC.up }),
        h('button.btn.btn-icon.btn-ghost', { type: 'button', 'aria-label': 'Smazat', onclick: () => { arr.splice(i, 1); bump(); render(); }, html: IC.trash }));
    }), h('button.btn.btn-sm', { type: 'button', onclick: () => { arr.push(''); bump(); render(); }, html: IC.plus + (o.add || 'Přidat') }));
  };
  render(); box.append(...[list, o.hint ? h('small', {}, o.hint) : null].filter(Boolean));
  return box;
}
/** tabulka řádků (ceník): cols = [[klíč, popisek, placeholder, typ]] */
function fRows(arr, cols, o = {}) {
  const box = h('div');
  const cls = cols.length > 2 ? '.t3' : '';
  const render = () => {
    box.replaceChildren(h('div.trow.thead' + cls, {}, ...cols.map((c) => h('span', {}, c[1])), h('span')),
      ...arr.map((r, i) => h('div.trow' + cls, {},
        ...cols.map(([k, l, ph, t]) => {
          const inp = h('input', { type: 'text', placeholder: ph || '', 'aria-label': l, inputmode: t === 'cena' ? 'text' : undefined, oninput: (e) => { r[k] = e.target.value; bump(); } });
          inp.value = r[k] ?? '';
          return t === 'cena' ? h('div.price-in', {}, inp) : inp;
        }),
        h('button.btn.btn-icon.btn-ghost', { type: 'button', 'aria-label': 'Smazat řádek', onclick: () => { arr.splice(i, 1); bump(); render(); }, html: IC.trash }))),
      h('button.btn.btn-sm', { type: 'button', style: 'margin-top:.3rem', onclick: () => { arr.push(Object.fromEntries(cols.map(([k]) => [k, '']))); bump(); render(); }, html: IC.plus + (o.add || 'Přidat řádek') }));
  };
  render();
  return box;
}
const card = (title, hint, ...kids) => h('section.card', {}, title ? h('h2', {}, title) : null, hint ? h('p.hint', {}, hint) : null, ...kids);
const row2 = (...kids) => h('div.row2', {}, ...kids);
const view = (title, lead, ...kids) => { const m = $('main.view'); m.replaceChildren(h('div.view-head', {}, h('h1', {}, title), lead ? h('p', {}, lead) : null), ...kids); window.scrollTo(0, 0); };
const plural = (n, a, b, c) => (n === 1 ? a : n >= 2 && n <= 4 ? b : c);

/* ---------------------------------------------------------------- jazyky */
Object.assign(IC, {
  gift: I('<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13M12 8S10 3 7.5 4 9 8 12 8zm0 0s2-5 4.5-4S15 8 12 8z"/>'),
  fork: I('<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M17 3c-2 2-2 6 0 8v10"/>'),
  inbox: I('<path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  music: I('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  refresh: I('<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>'),
});
/** přeložitelné pole položky: obj[key] = {cs, en, …}; edituje se zvolený jazyk */
function fT(obj, key, label, o = {}) {
  if (!obj[key] || typeof obj[key] !== 'object' || Array.isArray(obj[key])) obj[key] = { cs: obj[key] || '' };
  const cs = obj[key].cs || '';
  const ph = S.lang !== 'cs' && cs ? 'Česky: ' + cs.slice(0, 140) : (o.ph || '');
  const hint = [o.hint, S.lang !== 'cs' ? 'Když políčko necháte prázdné, web použije angličtinu, případně češtinu.' : ''].filter(Boolean).join(' ');
  return fText(obj[key], S.lang, `${label} · ${LANG_SHORT[S.lang]}`, { ...o, ph, hint: o.noHint ? o.hint : hint });
}
/** seznam textů v jazyce: obj[key] = {cs: [...], en: [...]} */
function fTList(obj, key, label, o = {}) {
  if (!obj[key] || typeof obj[key] !== 'object' || Array.isArray(obj[key])) obj[key] = { cs: Array.isArray(obj[key]) ? obj[key] : [] };
  if (!Array.isArray(obj[key][S.lang])) obj[key][S.lang] = S.lang === 'cs' ? [] : [];
  const cs = obj[key].cs || [];
  return fStrList(obj[key][S.lang], `${label} · ${LANG_SHORT[S.lang]}`, { ...o, hint: S.lang !== 'cs' && cs.length ? 'Česky: ' + cs.join(' | ').slice(0, 300) : o.hint });
}
/** texty stránek: S.D.texty[jazyk][stránka] */
function tPage(page) {
  const T = S.D.texty;
  T[S.lang] = T[S.lang] || {};
  T[S.lang][page] = T[S.lang][page] || {};
  return T[S.lang][page];
}
const csPage = (page) => (S.D.texty.cs || {})[page] || {};
function langBar(onChange) {
  return h('div.langbar', {}, h('span', {}, 'Jazyk úprav:'),
    LANGS.map((l) => h('button.btn.btn-sm' + (l === S.lang ? '.btn-dark' : '.btn-ghost'), { type: 'button', onclick: () => { S.lang = l; localStorage.setItem('restaurace_michal_lang', l); (onChange || route)(); } }, LANG_SHORT[l])),
    h('small', {}, LANG_NAME[S.lang]));
}
/* pole textů stránky: [klíč, popisek, typ] — typ: t text, m víceřádkový, l seznam řádků, cisla/citace/fakta */
const IKONY = [['music', 'Hudba'], ['leaf', 'Bylinky / čerstvé'], ['bread', 'Pečivo'], ['fish', 'Ryby'], ['wine', 'Víno'], ['users', 'Lidé'], ['gift', 'Dárek'], ['clock', 'Čas'], ['pin', 'Místo'], ['check', 'Fajfka']];
function pageFields(page, defs) {
  const p = tPage(page), cs = csPage(page);
  return defs.map(([k, label, type, hint]) => {
    const ph = S.lang !== 'cs' && typeof cs[k] === 'string' ? 'Česky: ' + cs[k].slice(0, 140) : '';
    if (type === 't' || type === 'm') { if (p[k] === undefined) p[k] = ''; return fText(p, k, label, { multi: type === 'm', rows: type === 'm' ? 4 : undefined, ph, hint: hint || (type === 'm' ? 'Nový řádek = nový odstavec.' : '') }); }
    if (type === 'l') { if (!Array.isArray(p[k])) p[k] = S.lang === 'cs' ? [] : JSON.parse(JSON.stringify(cs[k] || [])); return fStrList(p[k], label, { add: 'Přidat', hint }); }
    if (!Array.isArray(p[k])) p[k] = S.lang === 'cs' ? [] : JSON.parse(JSON.stringify(cs[k] || []));
    if (type === 'cisla') return h('div.field', {}, h('span', {}, label), fList(p[k], { title: (x) => `${x.cislo}${x.plus || ''}`, sub: (x) => x.popis, addLabel: 'Přidat číslo', make: () => ({ cislo: '', plus: '', popis: '' }),
      body: (x, b, r) => b.append(row2(fText(x, 'cislo', 'Číslo', { on: r, ph: '1997' }), fText(x, 'plus', 'Za číslem (nepovinné)', { on: r, ph: '+' })), fText(x, 'popis', 'Popis', { on: r })) }));
    if (type === 'citace') return h('div.field', {}, h('span', {}, label), fList(p[k], { title: (x) => x.zdroj, sub: (x) => x.text, addLabel: 'Přidat citaci', make: () => ({ text: '', zdroj: '' }),
      body: (x, b, r) => b.append(fText(x, 'text', 'Text', { multi: true, rows: 3, on: r }), fText(x, 'zdroj', 'Zdroj', { on: r, ph: 'TripAdvisor.com' })) }));
    if (type === 'fakta') return h('div.field', {}, h('span', {}, label), fList(p[k], { title: (x) => x.nadpis, sub: (x) => x.text, addLabel: 'Přidat', make: () => ({ ikona: 'check', nadpis: '', text: '' }),
      body: (x, b, r) => b.append(row2(fText(x, 'nadpis', 'Nadpis', { on: r }), fSelect(x, 'ikona', 'Ikona', IKONY)), fText(x, 'text', 'Text', { multi: true, rows: 2, on: r })) }));
    return null;
  });
}
const seo = (page) => h('details', { style: 'margin-top:.6rem' }, h('summary', { style: 'cursor:pointer;color:var(--muted);font-size:.88rem' }, 'Vyhledávače (titulek a popis stránky)'),
  h('div', { style: 'margin-top:.8rem' }, ...pageFields(page, [['title', 'Titulek', 't', 'Ideálně do 60 znaků.'], ['description', 'Popis', 'm', 'Ideálně 120–160 znaků.']])));

/* ---------------------------------------------------------------- pohledy */
const NAV = [
  ['', 'Přehled', 'home'], ['rezervace', 'Rezervace a poptávky', 'inbox'], ['-'],
  ['balicky', 'Balíčky (Silvestr, večírky…)', 'gift', 'balicky'], ['popup', 'Pop-up okno', 'popup', 'popup'], ['menu', 'Menu', 'fork', 'menu'], ['texty', 'Texty stránek', 'text', 'texty'],
  ['sbirka', 'Folklórní sbírka', 'music', 'sbirka'], ['fotky', 'Fotky a galerie', 'image', 'fotky'], ['seo', 'Vyhledávače (SEO)', 'search', 'texty'],
  ['kontakty', 'Kontakty a rezervace', 'phone', 'site'], ['gdpr', 'Ochrana osobních údajů', 'doc', 'gdpr'], ['-'],
  ['napoveda', 'Návod', 'help'], ['nastaveni', 'Heslo a odhlášení', 'gear'],
];

function vDash() {
  const tiles = [['rezervace', 'Rezervace', 'inbox', 'Přehled rezervací z webu'], ['balicky', 'Balíčky', 'gift', 'Silvestr, firemní večírky…'], ['popup', 'Pop-up okno', 'popup', 'Upoutávka na akci'], ['menu', 'Menu', 'fork', 'Menu s představením'],
    ['texty', 'Texty', 'text', 'Všech 7 jazyků'], ['fotky', 'Fotky', 'image', 'Úvod, galerie, záhlaví'], ['kontakty', 'Kontakty', 'phone', 'Telefony, adresa, časy']]
    .map(([id, label, ic, sub]) => h('a.tile', { href: '#/' + id }, h('span', { html: IC[ic] }), h('b', {}, label), h('small', {}, sub)));
  const newBox = h('div');
  view('Dobrý den 👋', 'Tady upravujete web Restaurant Michal: balíčky, menu, texty ve všech jazycích, fotky i kontakty. Rezervace z webu najdete v sekci Rezervace. Změny uložíte tlačítkem „Uložit změny“ dole – na webu se objeví zhruba za minutu.',
    newBox, h('div.tiles', {}, tiles),
    card('Jak to funguje', null, h('div.help', { html: '<ol><li>Vlevo (na mobilu v menu ☰) vyberte, co chcete upravit.</li><li>U textů nahoře zvolte jazyk (CZ, EN, DE, FR, ES, IT, 中文) – upravujete vždy jen ten jeden.</li><li>Dole se objeví lišta – klikněte na <b>Uložit změny</b>.</li><li>Nahoře uvidíte „Zveřejňuji změny…“ a za chvíli „Web je aktuální“.</li></ol>' })),
    h('a.btn.btn-dark', { href: CFG.site, target: '_blank', rel: 'noopener', style: 'margin-top:.5rem', html: IC.ext + 'Otevřít web' }));
  loadForms().then((d) => { const n = d.forms.filter((f) => f.s === 'nova').length; if (n) newBox.replaceChildren(h('a.alert', { href: '#/rezervace' }, h('span', { html: IC.inbox }), h('b', {}, `${n} ${plural(n, 'nová rezervace / poptávka', 'nové rezervace / poptávky', 'nových rezervací / poptávek')}`), h('small', {}, 'Zobrazit →'))); }).catch(() => {});
}

/* ---------------------------------------------------------------- rezervace (backend KV) */
async function loadForms(force) { if (!S.forms || force) S.forms = await api('/forms'); return S.forms; }
const fmtD = (iso) => { try { const d = new Date(iso); return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } };
async function vRezervace() {
  const list = h('div', {}, h('p.empty', {}, 'Načítám…'));
  const filt = { s: '' };
  view('Rezervace a poptávky', 'Všechno, co návštěvníci odešlou z webu (rezervace stolu a poptávky balíčků). Kliknutím otevřete detail, změníte stav nebo připíšete poznámku.',
    h('div', { style: 'display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center' },
      ...[['', 'Vše'], ['nova', 'Nové'], ['potvrzena', 'Potvrzené'], ['vyrizena', 'Vyřízené'], ['zrusena', 'Zrušené']].map(([v, t]) => h('button.btn.btn-sm' + (v === '' ? '.btn-dark' : '.btn-ghost'), { type: 'button', 'data-f': v, onclick: (e) => { filt.s = v; e.target.parentNode.querySelectorAll('[data-f]').forEach((b) => { b.className = 'btn btn-sm ' + (b === e.target ? 'btn-dark' : 'btn-ghost'); }); render(); } }, t)),
      h('button.btn.btn-sm', { type: 'button', style: 'margin-left:auto', onclick: async () => { await loadForms(true).catch((e) => toast('Nepodařilo se načíst', e.message, 'err')); render(); }, html: IC.refresh + 'Obnovit' })),
    card(null, null, list));
  let D;
  const render = () => {
    if (!D) return;
    const STAT = D.statuses || {};
    const rows = D.forms.filter((f) => !filt.s || f.s === filt.s);
    if (!rows.length) return list.replaceChildren(h('p.empty', {}, D.forms.length ? 'V tomto stavu nic není.' : 'Zatím žádné rezervace. Jakmile někdo odešle formulář na webu, objeví se tady.'));
    list.replaceChildren(h('div.forms', {}, rows.map((f) => h('button.frow' + (f.s === 'nova' ? '.new' : ''), { type: 'button', onclick: () => detail(f.key) },
      h('span.fst.st-' + f.s, {}, STAT[f.s] || f.s), h('b', {}, f.n || '(bez jména)'),
      h('span', {}, f.t === 'balicek' ? 'Poptávka balíčku' : 'Rezervace'), h('span', {}, f.w ? 'termín ' + f.w : ''), h('small', {}, fmtD(f.d))))));
  };
  const detail = async (key) => {
    let r; try { r = await api('/forms?key=' + encodeURIComponent(key)); } catch (e) { return toast('Nepodařilo se načíst', e.message, 'err'); }
    const st = { status: r.status, note: r.note || '' };
    const body = h('div', {},
      h('table.ftable', {}, h('tbody', {}, ...(r.listing && r.listing.title ? [h('tr', {}, h('th', {}, 'Balíček'), h('td', {}, r.listing.title))] : []),
        ...r.fields.map(([k, v]) => h('tr', {}, h('th', {}, k), h('td', {}, k === 'E-mail' ? h('a', { href: 'mailto:' + v }, v) : /^Telefon/.test(k) ? h('a', { href: 'tel:' + v.replace(/\s/g, '') }, v) : v))),
        h('tr', {}, h('th', {}, 'Odesláno'), h('td', {}, fmtD(r.created))))),
      fSelect(st, 'status', 'Stav', Object.entries(S.forms.statuses)), fText(st, 'note', 'Poznámka (vidíte jen vy)', { multi: true, rows: 3 }));
    const res = await modal({ title: r.typeLabel || 'Rezervace', body, actions: [{ label: 'Smazat', value: 'del', cls: 'btn-ghost' }, { label: 'Zavřít', value: null }, { label: 'Uložit', cls: 'btn-primary', value: 'save' }] });
    try {
      if (res === 'save') { await api('/forms', { method: 'POST', body: JSON.stringify({ key, status: st.status, note: st.note }) }); toast('Uloženo', '', 'ok'); }
      if (res === 'del' && await confirmDlg('Smazat záznam?', 'Rezervace bude z přehledu trvale odstraněna.')) { await api('/forms', { method: 'POST', body: JSON.stringify({ key, delete: true }) }); toast('Smazáno'); }
      if (res) { D = await loadForms(true); render(); }
    } catch (e) { toast('Nepodařilo se uložit', e.message, 'err'); }
  };
  try { D = await loadForms(true); render(); } catch (e) { list.replaceChildren(h('p.empty', {}, 'Rezervace se nepodařilo načíst: ' + e.message)); }
}

/* ---------------------------------------------------------------- balíčky */
function vBalicky() {
  view('Balíčky', 'Vlastní balíčky a akce (Silvestr, firemní večírky, …). Každý balíček má na webu svou stránku s formulářem poptávky. Zaškrtnutím „Skrýt na webu“ balíček schováte, aniž byste ho mazali. Pořadí zde = pořadí na webu.',
    langBar(),
    fList(S.D.balicky, {
      title: (b) => (b.nazev?.cs || '(bez názvu)') + (b.skryty ? ' · skrytý' : ''), sub: (b) => [b.termin?.cs, b.cena?.cs || 'cena na dotaz'].filter(Boolean).join(' · '), thumb: (b) => b.foto?.src,
      addLabel: 'Přidat balíček',
      make: () => ({ slug: '', skryty: true, foto: { src: '' }, stitek: { cs: '' }, nazev: { cs: 'Nový balíček' }, perex: { cs: '' }, text: { cs: '' }, termin: { cs: '' }, cena: { cs: '' }, kapacita: { cs: '' }, polozky_nadpis: { cs: '' }, polozky: { cs: [] }, bloky: [], pozn: { cs: '' } }),
      body: (b, el, r) => el.append(
        fCheck(b, 'skryty', 'Skrýt na webu (balíček zatím nebude vidět)', r),
        fT(b, 'nazev', 'Název', { on: r, ph: 'Silvestr 2026' }), fT(b, 'stitek', 'Štítek na fotce (nepovinné)', { ph: 'Novinka' }),
        fT(b, 'perex', 'Krátký popis (na kartě a nahoře na stránce)', { multi: true, rows: 2 }),
        fT(b, 'text', 'Text stránky balíčku', { multi: true, rows: 6, hint: 'Nový řádek = nový odstavec.' }),
        row2(fT(b, 'termin', 'Termín', { on: r, ph: '31. 12. 2026' }), fT(b, 'cena', 'Cena', { on: r, ph: 'např. 2 490 Kč / osoba – prázdné = „cena na dotaz“' })),
        fT(b, 'kapacita', 'Kapacita (nepovinné)', { ph: 'až 120 hostů' }),
        fT(b, 'polozky_nadpis', 'Nadpis seznamu (nepovinné)', { ph: 'V ceně balíčku' }), fTList(b, 'polozky', 'Co balíček obsahuje (odrážky)'),
        h('div.field', {}, h('span', {}, 'Další bloky na stránce (menu, nápoje, podmínky…)'), fList(b.bloky = b.bloky || [], {
          title: (x) => x.nadpis?.cs || '(blok bez nadpisu)', sub: (x) => `${(x.polozky?.cs || []).length} řádků`, addLabel: 'Přidat blok', make: () => ({ nadpis: { cs: '' }, polozky: { cs: [] } }),
          body: (x, b2, r2) => b2.append(fT(x, 'nadpis', 'Nadpis bloku', { on: r2, ph: 'Menu' }), fTList(x, 'polozky', 'Řádky bloku')) })),
        fT(b, 'pozn', 'Poznámka (rámeček pod textem)', { multi: true, rows: 2 }),
        fImage(b.foto, 'src', 'Hlavní fotka', b.nazev?.cs || 'balicek', { dims: ['w', 'h'], on: r }),
        h('div.field', {}, h('span', {}, 'Další fotky na stránce balíčku'), fPhotos(b.fotky = b.fotky || [], { hint: b.slug || 'balicek' })),
        fText(b, 'slug', 'Adresa stránky (bez diakritiky)', { ph: 'silvestr', hint: b.slug ? `Stránka: ${new URL(CFG.site, location.href).href}balicky/${b.slug}/ (v ostatních jazycích /en/packages/${b.slug}/ …)` : 'Vyplní se samo z názvu.' })),
    }));
}

/* ---------------------------------------------------------------- pop-up */
function vPopup() {
  const P = S.D.popup;
  if (!P.foto || typeof P.foto !== 'object') P.foto = { src: '' };
  const opts = [['', '— vlastní obsah (bez balíčku) —'], ...S.D.balicky.map((b) => [b.slug, (b.nazev?.cs || b.slug) + (b.skryty ? ' (skrytý – pop-up se neukáže)' : '')])];
  view('Pop-up okno', 'Okno, které se návštěvníkovi ukáže chvíli po příchodu na web – jednou za návštěvu, zavře se křížkem. Na stránce rezervace a na stránce samotného balíčku se neukazuje. Nejjednodušší je vybrat balíček: nadpis, text, fotka, termín a cena se převezmou z něj ve všech jazycích.',
    langBar(),
    card('Zobrazení', null,
      fCheck(P, 'zapnuto', 'Zobrazovat pop-up na webu'),
      fSelect(P, 'balicek', 'Co pop-up ukazuje', opts, { on: () => route() }),
      fText(P, 'zpozdeni', 'Zobrazit po kolika sekundách', { type: 'number', inputmode: 'numeric', hint: 'Doporučujeme 3–5 sekund.' })),
    card('Vlastní obsah (nepovinné)', P.balicek ? 'Prázdné políčko = text z balíčku. Vyplňte jen to, co chcete mít v pop-upu jinak.' : 'Bez balíčku vyplňte nadpis, text a kam má vést tlačítko.',
      fT(P, 'nadpis', 'Nadpis', { ph: P.balicek ? 'z balíčku' : 'Silvestr 2026' }), fT(P, 'text', 'Text', { multi: true, rows: 3 }),
      fT(P, 'tlacitko', 'Text tlačítka', { ph: 'Zobrazit nabídku' }),
      P.balicek ? null : fText(P, 'odkaz', 'Kam vede tlačítko', { ph: 'https://… nebo např. menu/' }),
      fImage(P.foto, 'src', P.balicek ? 'Fotka (prázdné = fotka balíčku)' : 'Fotka (nepovinné)', 'popup', { dims: ['w', 'h'] }),
      P.foto.src ? h('button.btn.btn-sm.btn-ghost', { type: 'button', onclick: () => { P.foto = { src: '' }; bump(); route(); } }, 'Odebrat fotku') : null),
    h('p.hint', { html: `Náhled po uložení: <a href="${CFG.site}?popup" target="_blank" rel="noopener">otevřít web s pop-upem</a> (s ?popup v adrese se ukáže vždy, i když jste ho už zavřela).` }));
}

/* ---------------------------------------------------------------- menu */
function vMenu() {
  const t = tPage('menu');
  view('Menu', 'Menu „večeře + folklórní představení“. Každé menu má chody; cenu můžete nechat prázdnou – na webu se ukáže „cena na dotaz“.',
    langBar(),
    card('Úvod stránky Menu', null, ...pageFields('menu', [['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['text', 'Úvodní text', 'm'], ['cena_text', 'Rámeček o ceně', 'm'], ['poznamka', 'Poznámka dole (alergeny apod.)', 'm']]), seo('menu')),
    card('Menu', null, fList(S.D.menu.sady, {
      title: (s) => (s.nazev?.cs || '(bez názvu)') + (s.skryta ? ' · skryté' : ''), sub: (s) => `${(s.chody || []).length} chodů · ${s.cena?.cs || 'cena na dotaz'}`, thumb: (s) => s.foto?.src,
      addLabel: 'Přidat menu', make: () => ({ id: '', skryta: false, nazev: { cs: 'Nové menu' }, popis: { cs: '' }, cena: { cs: '' }, pozn: { cs: '' }, foto: { src: '' }, chody: [] }),
      body: (s, el, r) => el.append(fCheck(s, 'skryta', 'Skrýt na webu', r), fT(s, 'nazev', 'Název', { on: r }), fT(s, 'popis', 'Popis (nepovinné)', { multi: true, rows: 2 }),
        row2(fT(s, 'cena', 'Cena', { on: r, ph: 'prázdné = cena na dotaz' }), fT(s, 'pozn', 'Poznámka u ceny', { ph: 'za osobu, včetně představení' })),
        fImage(s.foto = s.foto || { src: '' }, 'src', 'Fotka (nepovinné)', s.id || 'menu', { dims: ['w', 'h'] }),
        h('div.field', {}, h('span', {}, 'Chody'), fList(s.chody, { title: (c) => c.nazev?.cs || '(chod)', sub: (c) => (c.text?.cs || '').replace(/\n/g, ' · ').slice(0, 90), addLabel: 'Přidat chod', make: () => ({ nazev: { cs: '' }, text: { cs: '' } }),
          body: (c, b2, r2) => b2.append(fT(c, 'nazev', 'Chod', { on: r2, ph: 'Předkrm' }), fT(c, 'text', 'Jídlo', { multi: true, rows: 3, on: r2, hint: 'Více jídel = každé na nový řádek.' })) }))),
    })));
  void t;
}

/* ---------------------------------------------------------------- texty stránek */
const PAGES = {
  home: ['Úvodní stránka', [['hero_kicker', 'Řádek nad hlavním nadpisem', 't'], ['h1', 'Hlavní nadpis', 't', 'Slovo mezi hvězdičkami *takto* se zvýrazní.'], ['hero_text', 'Text pod nadpisem', 'm'],
    ['karta_nadpis', 'Karta vpravo – nadpis', 't'], ['karta_cas', 'Karta vpravo – čas', 't'], ['karta_text', 'Karta vpravo – text', 'm'], ['marquee', 'Běžící pás pod úvodem', 'l'],
    ['onas_kicker', 'O restauraci – štítek', 't'], ['onas_h2', 'O restauraci – nadpis', 't'], ['onas_text', 'O restauraci – text', 'm'], ['onas_citat', 'O restauraci – zvýrazněná věta', 'm'], ['ahr', 'Text u loga AHR', 't'],
    ['show_kicker', 'Představení – štítek', 't'], ['show_h2', 'Představení – nadpis', 't'], ['show_text', 'Představení – text', 'm'], ['cisla', 'Čísla', 'cisla'],
    ['pruh_text', 'Velká fotka – text', 'm'], ['pruh_popisek', 'Velká fotka – popisek', 't'],
    ['kuchyne_kicker', 'Kuchyně – štítek', 't'], ['kuchyne_h2', 'Kuchyně – nadpis', 't'], ['kuchyne_text', 'Kuchyně – text', 'm'], ['fakta', 'Kuchyně – body', 'fakta'],
    ['sbirka_kicker', 'Sbírka – štítek', 't'], ['sbirka_h2', 'Sbírka – nadpis', 't'], ['sbirka_text', 'Sbírka – text', 'm'],
    ['balicky_kicker', 'Balíčky – štítek', 't'], ['balicky_h2', 'Balíčky – nadpis', 't'], ['balicky_text', 'Balíčky – text', 'm'],
    ['galerie_kicker', 'Galerie – štítek', 't'], ['galerie_h2', 'Galerie – nadpis', 't'], ['galerie_text', 'Galerie – text', 'm'],
    ['cta_kicker', 'Výzva k rezervaci – štítek', 't'], ['cta_h2', 'Výzva k rezervaci – nadpis', 't'], ['cta_text', 'Výzva k rezervaci – text', 'm'], ['partneri', 'Nadpis partnerů', 't'], ['paticka', 'Text v patičce', 'm']]],
  predstaveni: ['Folklórní představení', [['kicker', 'Štítek', 't'], ['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['cas_nadpis', 'Čas představení (štítek)', 't'], ['h2', 'Nadpis textu', 't'], ['text', 'Text', 'm'],
    ['soubor_kicker', 'Soubor – štítek', 't'], ['soubor_h2', 'Soubor – nadpis', 't'], ['soubor_text', 'Soubor – text', 'm'], ['citace_nadpis', 'Nadpis citací', 't'], ['citace', 'Hosté o představení', 'citace']]],
  sbirka: ['Folklórní sbírka', [['kicker', 'Štítek', 't'], ['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['kicker2', 'Štítek textu', 't'], ['h2', 'Nadpis textu', 't'], ['text', 'Text', 'm'], ['upra_text', 'Velká fotka – text', 'm'], ['upra_popisek', 'Velká fotka – popisek', 't'], ['muzeum', 'Poznámka (rámeček)', 'm'], ['regiony_kicker', 'Regiony – štítek', 't'], ['regiony_h2', 'Regiony – nadpis', 't']]],
  galerie: ['Fotogalerie', [['kicker', 'Štítek', 't'], ['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['vse', 'Filtr „vše“', 't'], ['flickr', 'Tlačítko Flickr', 't']]],
  balicky: ['Balíčky (stránka)', [['kicker', 'Štítek', 't'], ['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['prazdne', 'Text, když žádný balíček není', 'm'], ['na_miru_h2', 'Akce na míru – nadpis', 't'], ['na_miru_text', 'Akce na míru – text', 'm'], ['poptat_h', 'Formulář – nadpis', 't'], ['odeslat', 'Formulář – tlačítko', 't']]],
  rezervace: ['Rezervace', [['kicker', 'Štítek', 't'], ['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['form_h', 'Formulář – nadpis', 't'], ['form_text', 'Formulář – text', 'm'], ['odeslat', 'Tlačítko', 't'], ['side_h', 'Vpravo – nadpis', 't'], ['side_text', 'Vpravo – upozornění', 'm']]],
  kontakt: ['Kontakt', [['kicker', 'Štítek', 't'], ['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm'], ['adresa_h', 'Adresa – nadpis', 't'], ['poloha', 'Text o poloze', 'm'], ['upozorneni_h', 'Upozornění – nadpis', 't'], ['upozorneni', 'Upozornění – text', 'm'], ['rezervace_h', 'Rezervace – nadpis', 't']]],
};
function vTexty(arg) {
  const key = PAGES[arg] ? arg : 'home';
  const [title, defs] = PAGES[key];
  view('Texty stránek', 'Vyberte stránku a jazyk. Upravujete vždy jen zvolený jazyk – ostatní jazyky zůstanou beze změny.',
    langBar(), h('div', { style: 'display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem' }, Object.entries(PAGES).map(([k, [t]]) => h('a.btn.btn-sm' + (k === key ? '.btn-dark' : '.btn-ghost'), { href: '#/texty/' + k }, t))),
    card(`${title} · ${LANG_NAME[S.lang]}`, S.lang !== 'cs' ? 'Šedý text v prázdném políčku je česká předloha.' : null, ...pageFields(key, defs), seo(key)));
}
function vSeo() {
  view('Vyhledávače (SEO)', 'Titulek a popis každé stránky, které vidí Google a další vyhledávače. Každý jazyk má vlastní. Odkazy mezi jazyky (hreflang) a mapa webu se tvoří automaticky.',
    langBar(), ...['home', 'predstaveni', 'sbirka', 'menu', 'galerie', 'balicky', 'rezervace', 'kontakt', 'gdpr'].map((k) => card((PAGES[k] || ['Ochrana osobních údajů'])[0], null, ...pageFields(k, [['title', 'Titulek', 't', 'Ideálně do 60 znaků.'], ['description', 'Popis', 'm', 'Ideálně 120–160 znaků.']]))));
}

/* ---------------------------------------------------------------- sbírka */
function vSbirka() {
  view('Folklórní sbírka', 'Regiony a kroje, které jsou právě k vidění v restauraci. Pořadí zde = pořadí na webu (první čtyři jsou i na úvodní stránce).',
    langBar(),
    fList(S.D.sbirka.regiony, { title: (r) => r.nazev?.cs, sub: (r) => r.podnazev?.cs || '', thumb: (r) => r.fotky?.[0]?.src, addLabel: 'Přidat region',
      make: () => ({ id: 'region-' + uid(), nazev: { cs: 'Nový region' }, podnazev: { cs: '' }, text: { cs: '' }, kroj_nadpis: { cs: 'Kroj' }, kroj: { cs: '' }, fotky: [] }),
      body: (r, el, rf) => el.append(fT(r, 'nazev', 'Název', { on: rf }), fT(r, 'podnazev', 'Podnázev (nepovinné)', { on: rf }), fT(r, 'text', 'Text o regionu', { multi: true, rows: 5 }),
        fT(r, 'kroj_nadpis', 'Nadpis popisu kroje'), fT(r, 'kroj', 'Popis kroje', { multi: true, rows: 3 }),
        h('div.field', {}, h('span', {}, 'Fotky (první dvě se zobrazují)'), fPhotos(r.fotky, { hint: r.id }))) }));
}

/* ---------------------------------------------------------------- fotky */
function vFotky() {
  const f = S.D.fotky;
  const kats = () => [['', '— bez kategorie —'], ...(f.kategorie || []).map((k) => [k.id, k.nazev?.cs || k.id])];
  const kat = (p) => { const s = h('select', { style: 'border:0;border-top:1px solid var(--line);border-radius:0;font-size:.8rem', onchange: (e) => { p.kat = e.target.value; bump(); } }, kats().map(([v, t]) => h('option', { value: v }, t))); s.value = p.kat || ''; return s; };
  const ZAHL = [['predstaveni', 'Folklórní představení'], ['sbirka', 'Folklórní sbírka'], ['menu', 'Menu'], ['galerie', 'Fotogalerie'], ['balicky', 'Balíčky'], ['rezervace', 'Rezervace'], ['kontakt', 'Kontakt']];
  f.zahlavi = f.zahlavi || [];
  view('Fotky a galerie', 'Fotky se po nahrání samy zmenší pro web. Popis fotky (pro vyhledávače a nevidomé) se píše v jazyce zvoleném nahoře.',
    langBar(),
    card('Velká fotka na úvodní stránce', 'První fotka je přes celou obrazovku. Ideálně na šířku.', fPhotos(f.hero, { hint: 'uvod', first: 'úvodní', maxPx: 2400 })),
    card('Fotogalerie', 'Všechny fotky stránky Fotogalerie. Kategorie slouží k filtrování.', fPhotos(f.galerie, { hint: 'galerie', extra: kat })),
    card('Galerie na úvodní stránce', 'Pět fotek v mozaice na úvodní stránce (první je velká).', fPhotos(f.uvod_galerie, { hint: 'galerie', max: 5 })),
    card('Fotky sekcí úvodní stránky', null,
      h('div.field', {}, h('span', {}, 'O restauraci (oblouk)'), fPhotos(f.onas, { hint: 'restaurace', max: 1 })),
      h('div.field', {}, h('span', {}, 'Folklórní představení (první = oblouk na stránce představení, další do mozaiky)'), fPhotos(f.predstaveni, { hint: 'predstaveni' })),
      h('div.field', {}, h('span', {}, 'Velká fotka přes celou šířku'), fPhotos(f.pruh, { hint: 'muzika', max: 1, maxPx: 2400 })),
      h('div.field', {}, h('span', {}, 'Kuchyně (velká a malá fotka)'), fPhotos(f.kuchyne, { hint: 'kuchyne', max: 2 })),
      h('div.field', {}, h('span', {}, 'Folklórní sbírka – velká fotka'), fPhotos(f.sbirka, { hint: 'sbirka', max: 1, maxPx: 2400 })),
      h('div.field', {}, h('span', {}, 'Rezervace – fotka v oblouku'), fPhotos(f.rezervace, { hint: 'rezervace', max: 1 }))),
    card('Fotky v záhlaví podstránek', null, ...ZAHL.map(([k, t]) => {
      let ph = f.zahlavi.find((x) => x.stranka === k);
      if (!ph) { ph = { stranka: k, src: '', alt: { cs: '' } }; f.zahlavi.push(ph); }
      return fImage(ph, 'src', t, k, { dims: ['w', 'h'] });
    })),
    card('Kategorie galerie', null, fList(f.kategorie, { title: (k) => k.nazev?.cs, addLabel: 'Přidat kategorii', make: () => ({ id: 'kat-' + uid(), nazev: { cs: '' } }), body: (k, el, r) => el.append(fT(k, 'nazev', 'Název', { on: r })) })));
}

/* ---------------------------------------------------------------- kontakty */
function vKontakty() {
  const s = S.D.site;
  view('Kontakty a rezervace', 'Telefony, e-mail a adresa – zobrazují se v hlavičce, patičce, na kontaktu i u rezervace.',
    card('Telefony a e-mail', 'Poslední telefon je na tlačítku „Zavolat“ na mobilu.', fStrList(s.telefony, 'Telefony', { add: 'Přidat telefon' }),
      fText(s, 'email', 'E-mail', { type: 'email' })),
    card('Adresa', null, fText(s, 'ulice', 'Ulice a číslo'), row2(fText(s, 'psc', 'PSČ'), fText(s, 'mesto', 'Město / čtvrť')), fText(s, 'mapy_url', 'Odkaz na mapu', { type: 'url' })),
    card('Rezervační formulář', `Rezervace se ukládají sem do administrace (sekce Rezervace)${S.forms?.to ? ' a upozornění chodí e-mailem na ' + S.forms.to : ''}. Kam chodí upozornění, nastavujeme my – stačí napsat.`,
      fStrList(s.formular.casy, 'Časy na výběr', { add: 'Přidat čas', hint: 'Např. 18:00, 18:30, 19:00 …' }), fText(s.formular, 'max_osob', 'Nejvyšší počet osob v jedné rezervaci', { type: 'number', inputmode: 'numeric' })),
    card('Sociální sítě', null, fText(s.socialni, 'facebook', 'Facebook', { type: 'url' }), fText(s.socialni, 'instagram', 'Instagram', { type: 'url' }), fText(s.socialni, 'tripadvisor', 'TripAdvisor', { type: 'url' }), fText(s.socialni, 'flickr', 'Flickr', { type: 'url' })),
    card('Partneři', 'Loga v pruhu „Naši partneři“ na úvodní stránce.', fList(s.partneri, { title: (p) => p.nazev, sub: (p) => p.url, thumb: (p) => p.logo, addLabel: 'Přidat partnera', make: () => ({ nazev: '', url: '', logo: '' }),
      body: (p, el, r) => el.append(row2(fText(p, 'nazev', 'Název', { on: r }), fText(p, 'url', 'Odkaz', { type: 'url', on: r })), fImage(p, 'logo', 'Logo', p.nazev || 'partner', { on: r })) })),
    card('Provozovatel (patička)', null, fText(s, 'provozovatel', 'Firma'), row2(fText(s, 'ico', 'IČO'), fText(s, 'dic', 'DIČ'))));
}

function vGdpr() {
  const g = S.D.gdpr;
  view('Ochrana osobních údajů', 'Text stránky o ochraně osobních údajů (odkaz je u formulářů a v patičce). Řádek začínající „## “ je mezinadpis.',
    langBar(), card(null, null, ...pageFields('gdpr', [['h1', 'Nadpis', 't'], ['perex', 'Text pod nadpisem', 'm']]), fT(g, 'text', 'Text', { multi: true, rows: 18, hint: 'Nový řádek = nový odstavec.' })));
}

function vNapoveda() {
  view('Návod', null,
    card('Nový balíček (např. Silvestr)', null, h('div.help', { html: '<ol><li>Otevřete <b>Balíčky</b> a klikněte na <b>Přidat balíček</b>.</li><li>Vyplňte název, krátký popis, text, termín a cenu (prázdná cena = „cena na dotaz“). Nahrajte fotku.</li><li>Nový balíček je nejdřív skrytý – až bude hotový, odškrtněte <b>Skrýt na webu</b>.</li><li>Uložte změny. Balíček dostane vlastní stránku s formulářem poptávky.</li><li>Překlady: nahoře přepněte jazyk (EN, DE…) a vyplňte texty. Co nevyplníte, web ukáže anglicky, případně česky.</li></ol>' })),
    card('Pop-up okno', null, h('div.help', { html: '<ol><li>Otevřete <b>Pop-up okno</b>.</li><li>Zaškrtněte <b>Zobrazovat pop-up na webu</b> a vyberte balíček (např. Silvestr) – texty a fotka se převezmou z něj ve všech jazycích.</li><li>Chcete-li v pop-upu jiný text nebo fotku, vyplňte je níže. Pop-up vypnete odškrtnutím.</li><li>Uložte změny.</li></ol>' })),
    card('Rezervace', null, h('div.help', { html: '<ol><li>Rezervace z webu najdete v sekci <b>Rezervace a poptávky</b>.</li><li>Kliknutím otevřete detail, nastavíte stav (Potvrzená, Vyřízená…) a můžete si připsat poznámku.</li><li>Hostovi odpovězte e-mailem nebo telefonem – kontakty jsou v detailu.</li></ol>' })),
    card('Úprava textu', null, h('div.help', { html: '<ol><li>V menu vyberte <b>Texty stránek</b>, nahoře stránku a jazyk.</li><li>Přepište text. Slovo mezi *hvězdičkami* se v nadpisu zvýrazní kurzívou.</li><li>Dole klikněte na <b>Uložit změny</b>. Za minutu je změna na webu.</li></ol>' })),
    card('Něco nejde?', null, h('p', {}, 'Napište nám na weboviny@email.cz – rádi pomůžeme.')));
}
function vSettings() {
  const f = { old: '', pw: '', pw2: '' };
  const msg = h('p', { style: 'color:var(--err);font-size:.9rem;min-height:1.2rem' });
  const pwInput = (key, label, ac) => h('label.field', {}, h('span', {}, label), h('input', { type: 'password', autocomplete: ac, oninput: (e) => { f[key] = e.target.value; } }));
  view('Heslo a odhlášení', null,
    card('Změnit heslo', 'Po změně hesla se odhlásí všechna ostatní zařízení. Heslo musí mít alespoň 8 znaků.',
      pwInput('old', 'Současné heslo', 'current-password'), pwInput('pw', 'Nové heslo', 'new-password'), pwInput('pw2', 'Nové heslo znovu', 'new-password'), msg,
      h('button.btn.btn-primary', { type: 'button', onclick: async (e) => {
        msg.textContent = '';
        if (f.pw.length < 8) return (msg.textContent = 'Nové heslo musí mít alespoň 8 znaků.');
        if (f.pw !== f.pw2) return (msg.textContent = 'Nová hesla se neshodují.');
        e.target.disabled = true;
        try { const r = await api('/password', { method: 'POST', body: JSON.stringify({ old: f.old, password: f.pw }) }); S.sess = r.token; S.def = false; saveSess(); toast('Heslo změněno', 'Příště se přihlaste novým heslem.', 'ok'); route(); }
        catch (er) { msg.textContent = er.message; } finally { e.target.disabled = false; }
      } }, 'Uložit nové heslo')),
    card('Odhlásit se', null, h('button.btn', { type: 'button', onclick: logout, html: IC.logout + 'Odhlásit' })));
}

/* ---------------------------------------------------------------- shell */
function renderShell() {
  const nav = h('nav.nav', { id: 'nav', 'aria-label': 'Sekce administrace' },
    h('button.btn.btn-icon.btn-ghost.nav-close', { type: 'button', 'aria-label': 'Zavřít menu', onclick: () => nav.classList.remove('open'), html: IC.x }),
    NAV.map(([id, label, ic, key]) => id === '-' ? h('hr') : h('a', { href: '#/' + id, 'data-id': id, 'data-key': key || '', onclick: () => nav.classList.remove('open'), html: IC[ic] + `<span>${esc(label)}</span>` })),
    h('hr'), h('a', { href: CFG.site, target: '_blank', rel: 'noopener', html: IC.ext + '<span>Zobrazit web</span>' }));
  const bar = h('div.savebar', { id: 'savebar' }, h('span', {}, ''),
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: async () => { if (await confirmDlg('Zahodit změny?', 'Neuložené úpravy se ztratí.', 'Zahodit')) discard(); } }, 'Zahodit'),
    h('button.btn.btn-primary', { type: 'button', onclick: saveAll }, 'Uložit změny'));
  $('#app').replaceChildren(h('div.shell', {},
    h('header.top', {},
      h('button.btn.btn-icon.btn-ghost.menu-btn', { type: 'button', 'aria-label': 'Menu', onclick: () => nav.classList.add('open'), html: IC.menu }),
      h('a.top-logo.brand', { href: '#/', html: LOGO + '<b>Restaurant Michal</b><span>Administrace</span>' }),
      h('div.pub'), h('a.btn.btn-sm', { href: CFG.site, target: '_blank', rel: 'noopener', html: IC.eye + '<span>Web</span>' })),
    h('div.layout', {}, nav, h('main.view'))), bar);
  initPub();
}
function updateSavebar() {
  const keys = dirtyKeys(); const bar = $('#savebar'); if (!bar) return;
  bar.classList.toggle('on', keys.length > 0 || S.saving);
  bar.querySelector('span').textContent = S.saving ? 'Ukládám…' : `Neuložené změny: ${keys.map((k) => LABEL[k]).join(', ')}`;
  bar.querySelectorAll('button').forEach((b) => { b.disabled = S.saving; });
  document.querySelectorAll('.nav a[data-key]').forEach((a) => { a.querySelector('.dot')?.remove(); if (keys.includes(a.dataset.key)) a.append(h('i.dot')); });
}
const VIEWS = { '': vDash, rezervace: vRezervace, balicky: vBalicky, popup: vPopup, menu: vMenu, texty: vTexty, seo: vSeo, sbirka: vSbirka, fotky: vFotky, kontakty: vKontakty, gdpr: vGdpr, napoveda: vNapoveda, nastaveni: vSettings };
function route() {
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  (VIEWS[id] || vDash)(arg);
  document.querySelectorAll('.nav a[data-id]').forEach((a) => a.classList.toggle('on', a.dataset.id === (VIEWS[id] ? id : '')));
  updateSavebar();
}
window.addEventListener('hashchange', route);

/* ---------------------------------------------------------------- přihlášení */
function renderLogin(msg = '') {
  const inp = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', placeholder: 'Heslo', required: true });
  const err = h('p.login-err', {}, msg);
  const btn = h('button.btn.btn-primary', { type: 'submit' }, 'Přihlásit se');
  const form = h('form.login-card', { onsubmit: async (e) => {
    e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Přihlašuji…';
    try {
      const r = await api('/login', { method: 'POST', body: JSON.stringify({ password: inp.value }) });
      S.sess = r.token; S.def = r.def; saveSess(); await start();
    } catch (er) { err.textContent = er.message; btn.disabled = false; btn.textContent = 'Přihlásit se'; inp.select(); }
  } },
  h('div.brand', { html: LOGO + '<span>Restaurant Michal</span>' }), h('h1', {}, 'Administrace webu'), h('p', {}, 'Přihlaste se heslem k administraci.'),
  h('label.field', {}, h('span', {}, 'Heslo'), h('div.pw-wrap', {}, inp, h('button.pw-eye', { type: 'button', 'aria-label': 'Zobrazit heslo', onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; }, html: IC.eye }))),
  btn, err);
  $('#app').replaceChildren(h('div.login', {}, form));
  setTimeout(() => inp.focus(), 50);
}
function logout() {
  if (dirtyKeys().length && !confirm('Máte neuložené změny. Opravdu se odhlásit?')) return;
  localStorage.removeItem(SK); S.sess = null; S.D = {}; renderLogin();
}
async function start() {
  $('#app').innerHTML = `<div class="boot"><div class="brand">${LOGO}<span>Restaurant Michal</span></div><span class="spin"></span></div>`;
  try { await loadAll(); } catch (e) {
    if (e.status === 401) { localStorage.removeItem(SK); S.sess = null; return renderLogin('Přihlášení vypršelo, přihlaste se prosím znovu.'); }
    return renderLogin('Obsah webu se nepodařilo načíst: ' + e.message);
  }
  renderShell(); route();
}
function boot() {
  const s = JSON.parse(localStorage.getItem(SK) || 'null');
  if (s && s.exp > Date.now()) { S.sess = s.t; S.def = s.def; start(); } else renderLogin();
}
boot();
})();
