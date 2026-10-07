# Restaurant Michal – web (návrh WebHunter / Weboviny)

Statický web v 7 jazycích (cs, en, de, fr, es, it, zh) z `_data/*.json` + `src/*.html`, `python3 build.py` → `site/`.
Push do `main` → GitHub Actions → GitHub Pages. Administrace `admin/` přes backend webhunter-admin (web id `restaurace-michal`, heslo „admin“ během realizace).
Rezervace a poptávky balíčků: POST webhunter-admin `/api/restaurace-michal/form` → uloží do KV (formStore) + e-mail na formTo; přehled v administraci (Rezervace).
Spuštění na doméně: soubor `CNAME` (restaurant-michal.cz / www), `_data/site.json` indexovat: true, formTo na adresu restaurace.
