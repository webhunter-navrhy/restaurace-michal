/* Restaurant Michal — interakce webu (bez knihoven, nativní scroll) */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const RM = window.RM || {};
  const doc = document.documentElement;

  /* hlavička: průhledná nad fotkou, plná po odscrollování / na stránkách bez fotky */
  const hdr = $('#hdr'), mbar = $('#mbar');
  const first = $('main > section');
  const overPhoto = first && (first.classList.contains('hero') || (first.classList.contains('phero') && !first.classList.contains('phero--plain')));
  if (!overPhoto) hdr.classList.add('hdr--solid');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    hdr.classList.toggle('is-solid', y > 40);
    if (mbar) mbar.classList.toggle('on', y > window.innerHeight * .6);
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* mobilní menu */
  const burger = $('.burger');
  burger?.addEventListener('click', () => {
    const open = !doc.classList.contains('menu-open');
    doc.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && doc.classList.contains('menu-open')) burger.click();
  });

  /* přepínač jazyků */
  const lang = $('#lang');
  if (lang) {
    const btn = $('button', lang);
    btn.addEventListener('click', (e) => { e.stopPropagation(); const o = lang.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    document.addEventListener('click', (e) => { if (!lang.contains(e.target)) { lang.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
  }

  /* nadpisy po slovech + odhalování při scrollu */
  requestAnimationFrame(() => $$('.split').forEach((el) => el.classList.add('is-in')));
  /* po doběhnutí animace už slova neořezávat (kurzíva přesahuje svůj rámeček) */
  setTimeout(() => $$('.split').forEach((el) => el.classList.add('is-done')), 2600);
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); if (en.target.querySelector('[data-count]')) count(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  $$('.rv').forEach((el) => io.observe(el));
  /* clip-path: inset(100%) má nulovou plochu, IntersectionObserver by ho nikdy neviděl → sleduje se rodič */
  const io2 = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { $$(':scope > .clip', en.target).forEach((c) => c.classList.add('is-in')); io2.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .05 });
  $$('.clip').forEach((el) => io2.observe(el.parentElement));

  /* počítadla (jen čistá čísla, např. 1997, 70) */
  function count(root) {
    $$('[data-count]', root).forEach((el) => {
      const raw = el.dataset.count;
      if (!/^\d+$/.test(raw) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const to = +raw, from = to > 1000 ? to - 60 : 0, t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* lightbox */
  const lb = $('#lb');
  let set = [], idx = 0;
  const show = (i) => {
    idx = (i + set.length) % set.length;
    const a = set[idx];
    $('img', lb).src = a.getAttribute('href');
    $('img', lb).alt = a.dataset.cap || '';
    $('p', lb).textContent = a.dataset.cap || '';
  };
  const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lb] a');
    if (!a) return;
    e.preventDefault();
    set = $$('a', a.closest('[data-lb]')).filter((x) => !x.hidden);
    show(set.indexOf(a));
    lb.classList.add('open'); document.body.style.overflow = 'hidden';
  });
  if (lb) {
    $('.lb-x', lb).addEventListener('click', close);
    $('.lb-p', lb).addEventListener('click', () => show(idx - 1));
    $('.lb-n', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(idx + (d < 0 ? 1 : -1)); });
  }

  /* pop-up z administrace: jednou za návštěvu (sessionStorage), ?popup = ukázat vždy */
  const pop = $('#pop');
  if (pop) {
    const key = 'rm_pop_' + pop.dataset.key;
    const force = /[?&]popup\b/.test(location.search);
    let seen = false;
    try { seen = !!sessionStorage.getItem(key); } catch (e) { /* soukromý režim */ }
    let back = null;
    const focusables = () => $$('a[href], button', pop);
    const openPop = () => {
      if (doc.classList.contains('menu-open') || lb?.classList.contains('open') || lang?.classList.contains('open') || document.activeElement?.matches('input, textarea, select')) { setTimeout(openPop, 4000); return; }
      try { sessionStorage.setItem(key, '1'); } catch (e) { /* nic */ }
      back = document.activeElement;
      pop.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => pop.classList.add('open')));
      document.body.style.overflow = 'hidden';
      $('.pop__x', pop).focus({ preventScroll: true });
    };
    const closePop = () => {
      pop.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => { pop.hidden = true; }, 400);
      back?.focus?.({ preventScroll: true });
    };
    $('.pop__x', pop).addEventListener('click', closePop);
    pop.addEventListener('click', (e) => { if (e.target === pop) closePop(); });
    $('a.btn', pop)?.addEventListener('click', () => { document.body.style.overflow = ''; });
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePop(); }
      if (e.key === 'Tab') {
        const f = focusables(), i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    if (!seen || force) setTimeout(openPop, force ? 600 : (+pop.dataset.delay || 0) * 1000);
  }

  /* galerie: filtr kategorií */
  $$('.gtabs button').forEach((b) => b.addEventListener('click', () => {
    $$('.gtabs button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    const k = b.dataset.k;
    $$('.masonry a').forEach((a) => { a.hidden = !!k && a.dataset.k !== k; });
  }));

  /* formuláře → webhunter-admin (uloží rezervaci do administrace + e-mail) */
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $$('input[type=date]').forEach((i) => { i.min = today; });
  const LBL = { jmeno: 'Jméno', prijmeni: 'Příjmení', email: 'E-mail', telefon: 'Telefon', datum: 'Datum', cas: 'Čas', osob: 'Počet osob', predstaveni: 'Folklórní představení', poznamka: 'Poznámka' };
  $$('form[data-form]').forEach((form) => {
    const t0 = Date.now();
    const msg = $('.form__msg', form);
    const err = (m, el) => { msg.textContent = m; msg.className = 'form__msg err'; el?.focus(); };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.textContent = ''; msg.className = 'form__msg';
      const E = RM.err || {};
      for (const el of $$('[required]', form)) {
        const bad = el.type === 'checkbox' ? !el.checked : !String(el.value).trim();
        if (bad) return err(el.type === 'checkbox' ? E.souhlas : E.povinne, el);
      }
      const em = form.elements.email;
      if (em && em.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) return err(E.email, em);
      const fd = new FormData(form), fields = {};
      for (const [k, v] of fd.entries()) {
        if (!LBL[k] || !String(v).trim()) continue;
        let val = String(v).trim();
        if (k === 'datum') { const [y, m, d] = val.split('-'); val = `${+d}. ${+m}. ${y}`; }
        if (k === 'predstaveni') val = val === 'ano' ? 'ano' : 'ne';
        fields[LBL[k]] = val;
      }
      if (fields['Příjmení']) { fields['Jméno'] = `${fields['Jméno'] || ''} ${fields['Příjmení']}`.trim(); delete fields['Příjmení']; }
      fields['Jazyk webu'] = (RM.lang || 'cs').toUpperCase();
      const body = { type: form.dataset.form, fields, page: location.href, lang: RM.lang, hp: form.elements.web?.value || '', ms: Date.now() - t0 };
      if (form.dataset.listing) body.listing = JSON.parse(form.dataset.listing);
      const btn = $('button[type=submit]', form), label = btn.innerHTML;
      btn.disabled = true; btn.textContent = RM.sending || '…';
      try {
        const r = await fetch(`${RM.api}/api/${RM.id}/form`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(RM.lang === 'cs' && j.error ? j.error : E.odeslani);
        form.closest('.formbox')?.classList.add('sent');
        form.closest('.formbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (ex) {
        err(ex.message && ex.message !== 'Failed to fetch' ? ex.message : E.odeslani);
      } finally { btn.disabled = false; btn.innerHTML = label; }
    });
  });
})();
