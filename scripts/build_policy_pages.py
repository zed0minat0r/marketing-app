#!/usr/bin/env python3
"""Generate privacy.html and terms.html from the policy text already in index.html.

    python3 scripts/build_policy_pages.py          # write the pages
    python3 scripts/build_policy_pages.py --check  # fail if they are out of date (CI)

WHY THIS EXISTS. The Privacy Policy and Terms only ever existed as JavaScript modals behind
`href="#"`. Clicking them opened a box, but there was no page underneath: open in a new tab, copy the
link, or fetch it without JavaScript and you got nothing.

That is not cosmetic. `docs/META-APP-REVIEW.md` lists "App settings complete: privacy policy URL" and
"Privacy policy missing the data-deletion path: ours has it, double check the URL resolves" - and it
did not resolve, because there was no URL to resolve. Meta App Review requires a reachable privacy
policy URL, and the Meta app is the unlock for Sidekick's publishing. Twilio's toll-free reviewers ask
for the policy linked beside the opt-in consent for the same reason (reject reason 30513).

ONE SOURCE OF TRUTH, WHICH IS THE POINT. The obvious fix is to paste the policy text into two new
files, and then there are three copies to keep in step and they drift the first time anyone edits one.
These pages are GENERATED from the `modalContent` registry in index.html, so the modal and the page
cannot disagree. `--check` in CI fails the build if someone edits the policy and forgets to regenerate.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

PAGES = {"privacy": "privacy.html", "terms": "terms.html"}

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Sidekick</title>
<meta name="description" content="{title} for Sidekick, a product of Pennsylvania Technology Solutions LLC.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230e0d0b'/%3E%3Ccircle cx='32' cy='32' r='14' fill='%23d4f53c'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
:root{{
  --bg:#0e0d0b; --surface:#1c1917; --border:#332f29;
  --text:#f0ebe0; --text-muted:#9a9080; --accent:#d4f53c;
  --font:'Geist',system-ui,sans-serif;
}}
html{{font-size:16px}}
body{{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.65;
     -webkit-font-smoothing:antialiased}}
a{{color:var(--accent)}}
.wrap{{max-width:720px;margin:0 auto;padding:56px 24px 96px}}
.back{{display:inline-block;margin-bottom:40px;font-size:0.9rem;color:var(--text-muted)}}
.back:hover{{color:var(--accent)}}
h1{{font-size:2rem;font-weight:600;letter-spacing:-0.02em;margin-bottom:8px}}
h3{{font-size:1.05rem;font-weight:600;margin:32px 0 8px}}
p,li{{color:var(--text-muted);margin-bottom:12px}}
ul{{padding-left:22px;margin-bottom:12px}}
strong{{color:var(--text);font-weight:600}}
hr{{border:0;border-top:1px solid var(--border);margin:48px 0 24px}}
footer{{font-size:0.85rem;color:var(--text-muted)}}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="./">&larr; Sidekick</a>
  <h1>{title}</h1>
  {body}
  <hr>
  <footer>
    Sidekick is a product of <strong>Pennsylvania Technology Solutions LLC</strong>.
    Questions? Email <a href="mailto:mmodica3@gmail.com">mmodica3@gmail.com</a>.
  </footer>
</div>
</body>
</html>
"""

# NO CANONICAL TAG. Two hosts serve this site - GitHub Pages
# (zed0minat0r.github.io/marketing-app) and Vercel (marketing-app-navy.vercel.app) - and
# they are not the same build: Pages publishes an allowlist, Vercel serves the repo root.
# The Twilio packet cites the Pages URL, Meta's data-deletion callback cites the Vercel
# one. Asserting a canonical would be picking a winner on no evidence, and a wrong
# canonical is worse than none, so the pages simply do not claim one.


def extract() -> dict[str, tuple[str, str]]:
    """Pull {key: (title, body_html)} out of index.html's modalContent registry."""
    src = INDEX.read_text()
    start = src.index("const modalContent = {")
    block = src[start:src.index("\n};", start)]
    out: dict[str, tuple[str, str]] = {}
    for key in PAGES:
        m = re.search(rf"{key}:\s*\{{\s*title:\s*'([^']+)',\s*body:\s*`(.*?)`\s*\}}", block, re.S)
        if not m:
            raise SystemExit(f"could not find the '{key}' entry in index.html's modalContent")
        out[key] = (m.group(1), m.group(2).strip())
    return out


def render(key: str, title: str, body: str) -> str:
    return TEMPLATE.format(title=html.escape(title), body=body)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit non-zero if a page is missing or out of date")
    a = ap.parse_args()

    stale = []
    for key, (title, body) in extract().items():
        path = ROOT / PAGES[key]
        want = render(key, title, body)
        have = path.read_text() if path.exists() else None
        if have == want:
            print(f"  {PAGES[key]}: up to date ({len(body)} chars of policy)")
            continue
        if a.check:
            stale.append(PAGES[key])
            print(f"  {PAGES[key]}: OUT OF DATE")
        else:
            path.write_text(want)
            print(f"  {PAGES[key]}: written ({len(body)} chars of policy)")

    if stale:
        print(f"\n{len(stale)} page(s) out of date with index.html. "
              "Run: python3 scripts/build_policy_pages.py")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
