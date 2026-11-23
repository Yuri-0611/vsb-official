#!/usr/bin/env python3
"""Check that site/ is an allowlist publish root: links resolve, and internal files are absent."""

from __future__ import annotations

import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
ORIGIN = "https://vsb-consulting.jp"

REQUIRED = [
    "",
    "omniops/",
    "omniops/index.html",
    "omniops/lp.html",
    "service.html",
    "flow.html",
    "instructor.html",
    "company.html",
    "faq.html",
    "contact.html",
    "thanks.html",
    "privacy.html",
    "health-management.html",
    "taiji.html",
    "404.html",
    "start/",
    "start/index.html",
    "scan/",
    "scan/index.html",
    "scan/admin/",
    "scan/result/",
    "robots.txt",
    "sitemap.xml",
    "CNAME",
    ".nojekyll",
]

# Present on purpose, even when no other page links to them.
ENTRY_POINTS = {
    "404.html",
    "CNAME",
    ".nojekyll",
    "robots.txt",
    "sitemap.xml",
    "index.html",
    "omniops/index.html",
    "omniops/lp.html",
    "start/index.html",
    "scan/index.html",
    "scan/admin/index.html",
    "scan/result/index.html",
    "scan/404.html",
    "scan/robots.txt",
}

FORBIDDEN_PARTS = [
    "demo",
    "menu.html",
    "google-apps-script",
    "vsb-consulting",
    "archive",
    "instagram_story_悩み相談",
    "_ranking_snip.html",
    "公開メモ.txt",
    "名刺_",
    "会議議事",
    "note_",
    "note付随",
    "code.gs",
]

CLAIM_PATTERNS = [
    "6時間",
    "2,400",
    "2400時間",
    "500万",
    "約23名",
    "約30名",
    "約35名",
    "約15名",
    "実績ベース",
    "導入実績",
    "実証済み",
    "運用可能",
    "工数削減",
    "人件費換算",
    "実際の支援",
]

ATTRS = {
    "a": ("href",),
    "link": ("href",),
    "script": ("src",),
    "img": ("src", "srcset"),
    "source": ("src", "srcset"),
    "video": ("src", "poster"),
    "audio": ("src",),
    "iframe": ("src",),
    "form": ("action",),
    "use": ("href",),
    "meta": ("content",),
}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        wanted = ATTRS.get(tag)
        if not wanted:
            return
        attr_map = {k: v for k, v in attrs if v is not None}
        for name in wanted:
            value = attr_map.get(name)
            if not value:
                continue
            if name == "srcset":
                for part in value.split(","):
                    url = part.strip().split()[0] if part.strip() else ""
                    if url:
                        self.refs.append((f"{tag}[{name}]", url))
            elif name == "content":
                if value.startswith("/") or value.startswith(ORIGIN) or value.startswith("."):
                    self.refs.append((f"{tag}[{name}]", value))
            else:
                self.refs.append((f"{tag}[{name}]", value))


CSS_URL = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", re.I)
JS_PATH = re.compile(r"""['"]((?:/|\./|\.\./)[^'"]+\.[A-Za-z0-9]{1,5}(?:\?[^'"]*)?)['"]""")
JS_ASSET = re.compile(r"""['"](assets/[^'"]+)['"]""")


def is_external(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in {"http", "https", "mailto", "tel", "javascript", "data"}


def strip_url(url: str) -> str:
    parsed = urlparse(url)
    return unquote(parsed.path)


def resolve(from_file: Path, url: str) -> str | None:
    raw = url.strip()
    if not raw or raw.startswith("#"):
        return None
    if raw.startswith(("mailto:", "tel:", "javascript:", "data:")):
        return None
    if raw.startswith(ORIGIN):
        path = strip_url(raw)
    elif is_external(raw):
        return None
    else:
        path = strip_url(raw)
        if not path.startswith("/"):
            # Bare "assets/..." in JS is loaded against the page URL (site root).
            if path.startswith("assets/") and from_file.suffix.lower() == ".js":
                path = "/" + path
            else:
                base = from_file.parent.relative_to(SITE).as_posix()
                if base == ".":
                    base = ""
                joined = f"{base}/{path}" if base else path
                path = "/" + os.path.normpath(joined)
    if path != "/" and path.endswith("/"):
        path = path[:-1] + "/"
    while "//" in path:
        path = path.replace("//", "/")
    if path.startswith("/"):
        path = path[1:]
    if path.startswith("../") or path == "..":
        return "OUTSIDE"
    return path


def locate(rel: str) -> Path | None:
    """Map a site-relative URL to a file, using GitHub Pages file rules."""
    if rel == "OUTSIDE":
        return None
    if rel in {"", "/"}:
        candidate = SITE / "index.html"
        return candidate if candidate.is_file() else None
    rel = rel[1:] if rel.startswith("/") else rel
    if rel.endswith("/"):
        candidate = SITE / rel / "index.html"
        return candidate if candidate.is_file() else None
    direct = SITE / rel
    if direct.is_file():
        return direct
    html = SITE / f"{rel}.html"
    if html.is_file():
        return html
    index = SITE / rel / "index.html"
    if index.is_file():
        return index
    return None


def pages_target(rel: str) -> str | None:
    """Return the canonical file path a GitHub Pages URL would serve, or None."""
    found = locate(rel if rel != "" else "")
    if found is None:
        return None
    return found.relative_to(SITE).as_posix()


def iter_files() -> list[Path]:
    files = []
    for dirpath, dirnames, filenames in os.walk(SITE):
        dirnames[:] = [d for d in dirnames if d != ".git"]
        for name in filenames:
            files.append(Path(dirpath) / name)
    return files


def main() -> int:
    errors: list[str] = []
    if not SITE.is_dir():
        print("site/ is missing", file=sys.stderr)
        return 1

    cname = (SITE / "CNAME").read_text(encoding="utf-8").strip()
    if cname != "vsb-consulting.jp":
        errors.append(f"CNAME is {cname!r}, expected vsb-consulting.jp")
    if not (SITE / ".nojekyll").is_file():
        errors.append(".nojekyll is missing from site/")

    referenced: set[str] = set()
    for rel in REQUIRED:
        target = pages_target(rel.rstrip("/") if rel not in {"", "omniops/", "start/", "scan/", "scan/admin/", "scan/result/"} else rel)
        # REQUIRED entries that are directories must resolve via index.html
        if rel.endswith("/") or rel == "":
            target = pages_target(rel)
        else:
            target = pages_target(rel)
        if target is None:
            errors.append(f"required URL missing: /{rel}")
        else:
            referenced.add(target)

    # Directory URL without trailing slash must be a real directory with index.html
    # so GitHub Pages can redirect /omniops -> /omniops/.
    for directory in ["omniops", "start", "scan", "scan/admin", "scan/result"]:
        index = SITE / directory / "index.html"
        if not index.is_file():
            errors.append(f"directory redirect target missing: /{directory} -> /{directory}/")

    for path in iter_files():
        rel = path.relative_to(SITE).as_posix()
        lower = rel.lower()
        for part in FORBIDDEN_PARTS:
            if part.lower() in lower:
                errors.append(f"forbidden path in publish folder: {rel}")
        text = path.read_text(encoding="utf-8", errors="replace")
        if path.suffix.lower() in {".html", ".xml", ".txt"} or path.name in {"CNAME"}:
            for phrase in CLAIM_PATTERNS:
                if phrase in text:
                    errors.append(f"effect/track-record phrase {phrase!r} in {rel}")

        refs: list[tuple[str, str]] = []
        if path.suffix.lower() == ".html":
            parser = LinkParser()
            try:
                parser.feed(text)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"HTML parse failed for {rel}: {exc}")
            refs.extend(parser.refs)
        elif path.suffix.lower() == ".css":
            refs.extend((f"css:{m.start()}", m.group(1)) for m in CSS_URL.finditer(text))
        elif path.suffix.lower() == ".js" and "scan/assets/" not in rel:
            refs.extend((f"js:{m.start()}", m.group(1)) for m in JS_PATH.finditer(text))
            refs.extend((f"js:{m.start()}", m.group(1)) for m in JS_ASSET.finditer(text))

        for kind, url in refs:
            resolved = resolve(path, url)
            if resolved is None:
                continue
            if resolved == "OUTSIDE":
                errors.append(f"{rel} {kind} points outside site/: {url}")
                continue
            target = pages_target(resolved)
            if target is None:
                errors.append(f"{rel} {kind} -> {url} (resolved /{resolved}) is 404")
            else:
                referenced.add(target)

    for path in iter_files():
        rel = path.relative_to(SITE).as_posix()
        if rel not in referenced and rel not in ENTRY_POINTS:
            errors.append(f"published file is not linked from any public page: {rel}")

    sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
    for loc in re.findall(r"<loc>\s*([^<]+)\s*</loc>", sitemap):
        if not loc.startswith(ORIGIN):
            errors.append(f"sitemap loc is not on the custom domain: {loc}")
            continue
        rel = strip_url(loc)
        rel = rel[1:] if rel.startswith("/") else rel
        if pages_target(rel) is None:
            errors.append(f"sitemap loc does not resolve: {loc}")

    # menu.html and /demo/ must not be servable from site/
    for blocked in ["omniops/menu.html", "demo/index.html", "internal/公開メモ.txt"]:
        if (SITE / blocked).exists():
            errors.append(f"blocked URL would be published: /{blocked}")

    if errors:
        print(f"{len(errors)} problem(s):")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"OK: {len(list(iter_files()))} published files, internal links resolve, CNAME={cname}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
