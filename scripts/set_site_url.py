#!/usr/bin/env python3
"""Point the site's public URL at one host, everywhere it is declared.

    python3 scripts/set_site_url.py --to https://marketing-app-navy.vercel.app
    python3 scripts/set_site_url.py --to https://sidekick.penntechsolutions.com --dry-run

WHY THIS EXISTS. The site is one repo published to TWO hosts:

  GitHub Pages  zed0minat0r.github.io/marketing-app  - marketing page only. `deploy.yml` copies a
                hand-picked list of files, which is why data-deletion-status.html 404s there.
  Vercel        marketing-app-navy.vercel.app        - the actual product. Serves the repo root plus
                the SMS endpoint, the jobs API and a daily cron. Cannot be dropped.

Both work, so nothing looked broken - but Twilio's packet cites the Pages URL and Meta's data-deletion
callback cites the Vercel one, and they do not serve the same files. A reviewer following the wrong one
lands on a 404, which is a rejection.

Matt chose Vercel as the public URL on 2026-09-04. This script exists rather than a hand sweep because
there were 25 references across 13 files, and because it has to happen AGAIN the day
sidekick.penntechsolutions.com is bought. One command, not another archaeology session.

WHAT IT DELIBERATELY DOES NOT TOUCH, and both matter:

  api/waitlist.js   ALLOWED_ORIGINS is a CORS allowlist, not a declaration of identity. It must keep
                    listing every host the form can be submitted from - Pages included, or the Pages
                    site silently stops working. There is already a note in this project about a
                    waitlist row being created while the browser was blocked from reading the
                    response because of this exact list.
  scripts/*.py      The URLs in these files are prose explaining the two-host split.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Every host the site has ever declared itself as. Any of them is rewritten to --to.
KNOWN_HOSTS = [
    "https://zed0minat0r.github.io/marketing-app",
    "https://marketing-app-navy.vercel.app",
    "https://sidekick.penntechsolutions.com",
]

SKIP_FILES = {"api/waitlist.js"}
SKIP_DIRS = {".git", "node_modules", "scripts", "docs"}
SUFFIXES = {".html", ".md", ".xml", ".txt", ".js", ".json"}


def targets() -> list[Path]:
    out = []
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file() or p.suffix not in SUFFIXES:
            continue
        rel = p.relative_to(ROOT)
        if set(rel.parts) & SKIP_DIRS or str(rel) in SKIP_FILES:
            continue
        out.append(p)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", required=True, help="the canonical base URL, no trailing slash")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    to = a.to.rstrip("/")
    if not to.startswith("https://"):
        print("refusing: --to must be an https:// URL")
        return 1

    others = [h for h in KNOWN_HOSTS if h.rstrip("/") != to]
    pattern = re.compile("|".join(re.escape(h) for h in others))

    total, touched = 0, []
    for p in targets():
        try:
            s = p.read_text()
        except UnicodeDecodeError:
            continue
        n = len(pattern.findall(s))
        if not n:
            continue
        total += n
        touched.append((p.relative_to(ROOT), n))
        if not a.dry_run:
            p.write_text(pattern.sub(to, s))

    verb = "would rewrite" if a.dry_run else "rewrote"
    for rel, n in touched:
        print(f"  {verb} {n:2d} in {rel}")
    print(f"\n{verb} {total} reference(s) across {len(touched)} file(s) -> {to}")
    if not touched:
        print("  (nothing to do - already canonical)")
    print("\nNOT touched, on purpose: api/waitlist.js (CORS allowlist must keep every host), "
          "scripts/ and docs/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
