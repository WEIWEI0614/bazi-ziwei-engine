#!/usr/bin/env python3
"""Check that each language builds a single-language page.

    python tools/check_lang.py            # both languages, exits 1 on leftovers
    python tools/check_lang.py --show     # print every hit

Why a browser and not grep: the page builds almost all of its text at runtime.
A string can sit in the source and never reach the screen, or reach the screen
from a template that no grep would attribute to the right language. This renders
the real DOM and walks its text nodes.

Requires Chrome (set CHROME=/path/to/chrome if it is not in the default place).

Leftovers that are allowed on purpose: proper nouns and standard numbers that
must not be translated (VSOP87, FK5, GB/T 33661-2017, lunar-python, iztro), and
the language switch button itself.
"""
from __future__ import annotations

import functools
import http.server
import os
import re
import socketserver
import subprocess
import sys
import tempfile
import threading
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, "web")
CHROME = os.environ.get(
    "CHROME",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if sys.platform == "darwin" else "google-chrome",
)

SKIP = {"script", "style", "noscript", "code", "pre"}
# 专名与标准号：翻了反而错
ALLOW_ZH = {
    "EN", "GitHub", "OpenAI", "PNG", "VSOP87", "FK5", "Meeus", "GB/T",
    "33661-2017", "lunar-python", "iztro", "JS", "Python", "build",
    # 模型厂商名与数据集名：中文界面保留原名才是对的
    "DeepSeek", "GLM", "Kimi", "Qwen", "MingLi-Bench", "BaziQA", "AUC",
    # 命令行路径：中文版里写 `python tools/x.py` 也是对的
    "python", "tools", "bench_mingli", "py", "bench_celebrity", "bench_ziwei",
    "tools/bench_mingli.py", "tools/bench_celebrity.py", "tools/bench_ziwei.py",
    "bench_celebrity.py", "bench_ziwei.py", "App",
}
# 语言切换按钮在英文界面显示「中」，是唯一应当保留的汉字
ALLOW_EN = {"中", "命理引擎"}


class TextWalker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.path: list[str] = []
        self.out: list[tuple[str, str]] = []

    def handle_starttag(self, tag, attrs):
        self.stack.append(tag)
        if tag not in SKIP:
            a = dict(attrs)
            cls = a.get("class", "")
            eid = a.get("id", "")
            self.path.append(f"{tag}.{cls}#{eid}" if (cls or eid) else tag)

    def handle_endtag(self, tag):
        if self.stack:
            self.stack.pop()
        if tag not in SKIP and self.path:
            self.path.pop()

    def handle_data(self, data):
        if any(t in SKIP for t in self.stack):
            return
        t = data.strip()
        if t:
            self.out.append((self.path[-1] if self.path else "", t))


def render(lang: str) -> str:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as srv:
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        out = tempfile.NamedTemporaryFile(delete=False, suffix=".html").name
        try:
            subprocess.run(
                [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox",
                 "--virtual-time-budget=7000", "--dump-dom",
                 f"http://127.0.0.1:{port}/?lang={lang}"],
                stdout=open(out, "w", encoding="utf-8"),
                stderr=subprocess.DEVNULL, check=True,
            )
            return open(out, encoding="utf-8", errors="replace").read()
        finally:
            srv.shutdown()
            if os.path.exists(out):
                os.unlink(out)


def scan(html: str, lang: str) -> list[tuple[str, str]]:
    w = TextWalker()
    w.feed(html)
    hits: list[tuple[str, str]] = []
    for where, text in w.out:
        if lang == "zh":
            words = [x for x in re.findall(r"[A-Za-z][A-Za-z0-9'_.\-/]{1,}", text)
                     if x not in ALLOW_ZH]
            if words:
                hits.append((where, text))
        else:
            if re.search(r"[\u4e00-\u9fff]", text) and text not in ALLOW_EN:
                hits.append((where, text))
    return hits


def main() -> int:
    show = "--show" in sys.argv
    if not os.path.exists(CHROME) and not CHROME.startswith("google-chrome"):
        print(f"chrome not found at {CHROME}; set CHROME=/path/to/chrome")
        return 2
    failed = False
    for lang in ("zh", "en"):
        hits = scan(render(lang), lang)
        label = "中文版残留英文" if lang == "zh" else "英文版残留汉字"
        if not hits:
            print(f"{lang}: clean")
            continue
        failed = True
        print(f"{lang}: {len(hits)} leftover(s) — {label}")
        seen = set()
        for where, text in hits:
            key = text[:60]
            if key in seen:
                continue
            seen.add(key)
            if show or len(seen) <= 12:
                print(f"  [{where}] {text[:140]}")
        if not show and len(seen) > 12:
            print(f"  … {len(seen) - 12} more (run with --show)")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
