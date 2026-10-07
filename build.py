#!/usr/bin/env python3
"""Sestaví web Restaurant Michal (7 jazyků) z _data/*.json + src/*.html do složky site/.

Spouští ho GitHub Action po každém uložení v administraci (webhunter-admin),
lokálně:  python3 build.py  a pak  python3 -m http.server -d site 8793
(adresa webu je /restaurace-michal/, dokud v repozitáři není soubor CNAME – pak /).

Jazyky: cs (kořen), en, de, fr, es, it, zh. Texty jsou v _data/texty.json po jazycích,
položky (menu, balíčky, sbírka, fotky) mají přeložitelná pole jako {"cs": …, "en": …}.
Chybějící překlad se doplní z angličtiny, pak z češtiny.
"""
import hashlib, json, os, re, shutil, datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'site'
CNAME = (ROOT / 'CNAME').read_text().strip() if (ROOT / 'CNAME').exists() else ''
B = '/' if CNAME else '/restaurace-michal/'

LANGS = ['cs', 'en', 'de', 'fr', 'es', 'it', 'zh']
HREFLANG = {'cs': 'cs', 'en': 'en', 'de': 'de', 'fr': 'fr', 'es': 'es', 'it': 'it', 'zh': 'zh-Hans'}
OG_LOCALE = {'cs': 'cs_CZ', 'en': 'en_GB', 'de': 'de_DE', 'fr': 'fr_FR', 'es': 'es_ES', 'it': 'it_IT', 'zh': 'zh_CN'}
LANG_NAME = {'cs': 'Čeština', 'en': 'English', 'de': 'Deutsch', 'fr': 'Français', 'es': 'Español', 'it': 'Italiano', 'zh': '中文'}
LANG_SHORT = {'cs': 'CZ', 'en': 'EN', 'de': 'DE', 'fr': 'FR', 'es': 'ES', 'it': 'IT', 'zh': '中文'}
# adresy stránek v jednotlivých jazycích (bez lomítka na konci; '' = úvod)
SLUGS = {
    'home':        {l: '' for l in LANGS},
    'predstaveni': {'cs': 'folklorni-predstaveni', 'en': 'folklore-show', 'de': 'folklore-show', 'fr': 'spectacle-folklorique', 'es': 'espectaculo-folclorico', 'it': 'spettacolo-folcloristico', 'zh': 'folklore-show'},
    'sbirka':      {'cs': 'folklorni-sbirka', 'en': 'folklore-collection', 'de': 'folklore-sammlung', 'fr': 'collection-folklorique', 'es': 'coleccion-folclorica', 'it': 'collezione-folcloristica', 'zh': 'folklore-collection'},
    'menu':        {'cs': 'menu', 'en': 'menu', 'de': 'menu', 'fr': 'menu', 'es': 'menu', 'it': 'menu', 'zh': 'menu'},
    'galerie':     {'cs': 'fotogalerie', 'en': 'gallery', 'de': 'galerie', 'fr': 'galerie', 'es': 'galeria', 'it': 'galleria', 'zh': 'gallery'},
    'balicky':     {'cs': 'balicky', 'en': 'packages', 'de': 'angebote', 'fr': 'forfaits', 'es': 'paquetes', 'it': 'pacchetti', 'zh': 'packages'},
    'rezervace':   {'cs': 'rezervace', 'en': 'reservation', 'de': 'reservierung', 'fr': 'reservation', 'es': 'reserva', 'it': 'prenotazione', 'zh': 'reservation'},
    'kontakt':     {'cs': 'kontakt', 'en': 'contact', 'de': 'kontakt', 'fr': 'contact', 'es': 'contacto', 'it': 'contatti', 'zh': 'contact'},
    'gdpr':        {'cs': 'ochrana-osobnich-udaju', 'en': 'privacy', 'de': 'datenschutz', 'fr': 'confidentialite', 'es': 'privacidad', 'it': 'privacy', 'zh': 'privacy'},
}
NAV = ['home', 'predstaveni', 'sbirka', 'menu', 'balicky', 'galerie', 'kontakt']


def load(name):
    return json.loads((ROOT / '_data' / name).read_text(encoding='utf-8'))


SITE, T, MENU, BAL, SB, F, G = (load(n + '.json') for n in ('site', 'texty', 'menu', 'balicky', 'sbirka', 'fotky', 'gdpr'))
DOM = SITE['domena'].rstrip('/')


# ---------------------------------------------------------------- pomocníci
def tr(v, lang):
    """přeložitelné pole {"cs": …, "en": …} → text v jazyce (záloha en, pak cs)"""
    if isinstance(v, dict) and any(k in v for k in LANGS):
        for l in (lang, 'en', 'cs'):
            x = v.get(l)
            if x not in (None, '', []):
                return x
        return ''
    return v if v is not None else ''


def merge(base, over):
    """texty jazyka doplněné o chybějící klíče z angličtiny/češtiny"""
    if isinstance(base, dict) and isinstance(over, dict):
        out = dict(base)
        for k, v in over.items():
            out[k] = merge(base.get(k), v) if k in base else v
        return out
    if over in (None, '', []):
        return base
    return over


def nb(s, lang='cs'):
    """nezlomitelné mezery (čeština: jednopísmenné předložky; všude: čísla a jednotky)"""
    s = str(s or '')
    if lang == 'cs':
        for _ in range(2):
            s = re.sub(r'(^|\s)([ksvzouaiKSVZOUAI])\s', '\\1\\2\u00a0', s)
    if lang == 'fr':
        s = re.sub(r' ([:;!?»])', '\u202f\\1', s)
    s = re.sub(r'(\d) (?=\d{3}\b)', '\\1\u00a0', s)
    s = re.sub(r'(\d) (?=(?:Kč|km|m|h|hod\.?|%)\b)', '\\1\u00a0', s)
    return s


def odstavce(s):
    if isinstance(s, list):
        return [p for p in s if str(p).strip()]
    return [p.strip() for p in str(s or '').split('\n') if p.strip()]


def tel_href(c):
    d = re.sub(r'[^\d+]', '', c)
    if not d.startswith('+'):
        d = '+420' + d.lstrip('0') if len(d) == 9 else d
    return 'tel:' + d


_dims = {}
def dims(src):
    if src in _dims:
        return _dims[src]
    w = h = None
    try:
        from PIL import Image
        with Image.open(ROOT / src) as im:
            w, h = im.size
    except Exception:
        pass
    _dims[src] = (w, h)
    return w, h


def fix_img(f, dw=1600, dh=1067):
    if not f or not f.get('src'):
        return f
    if not f.get('w') or not f.get('h'):
        w, h = dims(f['src'])
        f['w'], f['h'] = w or dw, h or dh
    return f


def md5(p):
    return hashlib.md5(Path(p).read_bytes()).hexdigest()[:10]


def slugify(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:50]


def url(page, lang, extra=''):
    """relativní adresa stránky (bez B) – např. 'en/folklore-show/'"""
    p = ('' if lang == 'cs' else lang + '/') + (SLUGS[page][lang] + '/' if SLUGS[page][lang] else '')
    return p + (extra + '/' if extra else '')


# ---------------------------------------------------------------- odvozená data
for k in list(F.keys()):
    if isinstance(F[k], list) and k != 'kategorie':
        F[k] = [fix_img(f) for f in F[k] if isinstance(f, dict) and f.get('src')]
for r in SB.get('regiony', []):
    r['fotky'] = [fix_img(f, 1000, 1500) for f in r.get('fotky', []) if f.get('src')]
for s in MENU.get('sady', []):
    if s.get('foto', {}).get('src'):
        fix_img(s['foto'])
used = set()
for b in BAL:
    if not b.get('slug'):
        b['slug'] = slugify(tr(b.get('nazev'), 'cs')) or 'balicek'
    base, i = b['slug'], 2
    while b['slug'] in used:
        b['slug'] = f'{base}-{i}'; i += 1
    used.add(b['slug'])
    if b.get('foto', {}).get('src'):
        fix_img(b['foto'])
BAL_VIS = [b for b in BAL if not b.get('skryty')]

tels = [{'cislo': t, 'href': tel_href(t)} for t in SITE.get('telefony', []) if t]


def jsonld(lang, TT, extra=None):
    biz = {
        '@type': 'Restaurant', '@id': DOM + '/#restaurace', 'name': SITE['nazev'], 'url': DOM + '/' + url('home', lang),
        'telephone': tels[0]['cislo'] if tels else None, 'email': SITE.get('email'),
        'image': [DOM + '/' + f['src'] for f in F.get('hero', [])[:3]],
        'logo': DOM + '/' + SITE.get('logo', 'assets/logo.png'),
        'description': TT['home']['description'],
        'servesCuisine': SITE.get('kuchyne', ['Czech', 'International']),
        'acceptsReservations': True,
        'address': {'@type': 'PostalAddress', 'streetAddress': SITE['ulice'], 'addressLocality': 'Praha', 'postalCode': SITE['psc'], 'addressCountry': 'CZ'},
        'geo': {'@type': 'GeoCoordinates', 'latitude': SITE['gps']['lat'], 'longitude': SITE['gps']['lon']} if SITE.get('gps') else None,
        'hasMap': SITE.get('mapy_url'),
        'sameAs': [v for v in SITE.get('socialni', {}).values() if v],
        'inLanguage': HREFLANG[lang],
    }
    g = [{k: v for k, v in biz.items() if v not in (None, [], '')}] + (extra or [])
    return json.dumps({'@context': 'https://schema.org', '@graph': g}, ensure_ascii=False).replace('</', '<\\/')


def crumbs(lang, TT, *items):
    lst = [(TT['ui']['nav']['home'], url('home', lang))] + list(items)
    return {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': f'{DOM}/{p}'} for i, (n, p) in enumerate(lst)]}


# ---------------------------------------------------------------- sestavení
def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for d in ('img', 'assets'):
        if (ROOT / d).exists():
            shutil.copytree(ROOT / d, OUT / d, ignore=shutil.ignore_patterns('*.psd', 'src-*'))
    V = {'css': md5(ROOT / 'assets/css/web.css'), 'js': md5(ROOT / 'assets/js/web.js')}

    env = Environment(loader=FileSystemLoader(ROOT / 'src'), autoescape=select_autoescape(['html']), trim_blocks=True, lstrip_blocks=True)
    env.globals.update(B=B, SITE=SITE, F=F, SB=SB, MENU=MENU, BAL=BAL_VIS, V=V, LANGS=LANGS, LANG_NAME=LANG_NAME,
                       LANG_SHORT=LANG_SHORT, HREFLANG=HREFLANG, NAV=NAV, tels=tels, url=url, year=datetime.date.today().year,
                       G=G, DOM=DOM)
    sitemap = []

    def render(tpl, page, lang, TT, extra='', **kw):
        rel = url(page, lang, extra)
        out = OUT / rel / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        alts = {l: url(page, l, extra) for l in LANGS}
        env.filters['nb'] = lambda s: nb(s, lang)
        env.filters['t'] = lambda v: tr(v, lang)
        env.filters['odstavce'] = odstavce
        ctx = dict(lang=lang, T=TT, U=TT['ui'], page=page, rel=rel, alts=alts, hreflang=HREFLANG[lang], og_locale=OG_LOCALE[lang])
        ctx.update(kw)
        ctx.setdefault('jsonld', jsonld(lang, TT))
        out.write_text(env.get_template(tpl).render(**ctx), encoding='utf-8')
        sitemap.append(alts)

    for lang in LANGS:
        TT = merge(merge(T['cs'], T.get('en', {})), T.get(lang, {})) if lang != 'cs' else T['cs']
        P = lambda k: TT[k]
        render('index.html', 'home', lang, TT, title=P('home')['title'], description=P('home')['description'],
               preload=[F['hero'][0]['src']] if F.get('hero') else [])
        for key in ('predstaveni', 'sbirka', 'menu', 'galerie', 'balicky', 'rezervace', 'kontakt'):
            render(key + '.html', key, lang, TT, title=P(key)['title'], description=P(key)['description'],
                   jsonld=jsonld(lang, TT, [crumbs(lang, TT, (P(key)['h1'], url(key, lang)))]))
        for b in BAL_VIS:
            name = tr(b['nazev'], lang)
            render('balicek.html', 'balicky', lang, TT, extra=b['slug'], b=b,
                   title=f"{name} – {SITE['nazev']}", description=tr(b.get('perex'), lang)[:300] or P('balicky')['description'],
                   jsonld=jsonld(lang, TT, [crumbs(lang, TT, (P('balicky')['h1'], url('balicky', lang)), (name, url('balicky', lang, b['slug'])))]))
        render('gdpr.html', 'gdpr', lang, TT, title=P('gdpr')['title'], description=P('gdpr')['description'])

    # 404 (česky + odkazy na jazyky)
    env.filters['nb'] = lambda s: nb(s, 'cs'); env.filters['t'] = lambda v: tr(v, 'cs')
    (OUT / '404.html').write_text(env.get_template('404.html').render(lang='cs', T=T['cs'], U=T['cs']['ui'], page='404', rel='404.html',
        alts={l: url('home', l) for l in LANGS}, hreflang='cs', og_locale='cs_CZ', title='404 – ' + SITE['nazev'], description='', jsonld=None, noindex=True), encoding='utf-8')
    # staré adresy Wixu → nové (menu-1 byla druhá stránka menu)
    for old, new in (('menu-1', url('menu', 'cs')), ('o-restauraci', '')):
        d = OUT / old; d.mkdir(parents=True, exist_ok=True)
        (d / 'index.html').write_text(f'<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="{DOM}/{new}"><meta http-equiv="refresh" content="0;url={B}{new}"><script>location.replace("{B}{new}")</script>', encoding='utf-8')

    # administrace (cache busting jako na webu)
    if (ROOT / 'admin').exists():
        shutil.copytree(ROOT / 'admin', OUT / 'admin')
        idx = (OUT / 'admin/index.html').read_text(encoding='utf-8')
        idx = idx.replace('__V_ACSS__', md5(ROOT / 'admin/admin.css')).replace('__V_AJS__', md5(ROOT / 'admin/admin.js'))
        (OUT / 'admin/index.html').write_text(idx, encoding='utf-8')
        imgs = sorted(str(p.relative_to(ROOT)) for p in (ROOT / 'img').rglob('*') if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp') and '-sm.' not in p.name)
        (OUT / 'admin/images.json').write_text(json.dumps(imgs, ensure_ascii=False), encoding='utf-8')

    # SEO soubory: sitemap s hreflang alternativami
    today = datetime.date.today().isoformat()
    xs = []
    for alts in sitemap:
        links = ''.join(f'<xhtml:link rel="alternate" hreflang="{HREFLANG[l]}" href="{DOM}/{alts[l]}"/>' for l in LANGS) + f'<xhtml:link rel="alternate" hreflang="x-default" href="{DOM}/{alts["cs"]}"/>'
        for l in LANGS:
            xs.append(f'  <url><loc>{DOM}/{alts[l]}</loc><lastmod>{today}</lastmod>{links}</url>\n')
    seen = set(); xs = [x for x in xs if not (x in seen or seen.add(x))]
    (OUT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + ''.join(xs) + '</urlset>\n', encoding='utf-8')
    (OUT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: {DOM}/sitemap.xml\n' if SITE.get('indexovat')
                                    else 'User-agent: *\nDisallow: /\n', encoding='utf-8')
    H = T['cs']['home']
    (OUT / 'llms.txt').write_text(
        f"# {SITE['nazev']}\n\n> {H['description']}\n\n- Adresa: {SITE['ulice']}, {SITE['psc']} {SITE['mesto']}\n"
        + ''.join(f"- Telefon: {t['cislo']}\n" for t in tels) + f"- E-mail: {SITE['email']}\n"
        + f"- Jazyky webu: {', '.join(LANG_NAME[l] for l in LANGS)}\n\n## Stránky\n"
        + ''.join(f"- {DOM}/{a['cs']}\n" for a in sitemap), encoding='utf-8')
    (OUT / '.nojekyll').write_text('')
    if CNAME:
        (OUT / 'CNAME').write_text(CNAME + '\n')
    (OUT / 'version.json').write_text(json.dumps({'sha': os.environ.get('GITHUB_SHA', 'local'), 'built': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}))
    print(f'Hotovo: {sum(1 for _ in OUT.rglob("*.html"))} stránek, základ {B}')


if __name__ == '__main__':
    build()
