"""Copy the web app into docs/ for GitHub Pages."""
import os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "web")
DST = os.path.join(ROOT, "docs")

def main():
    os.makedirs(DST, exist_ok=True)
    for f in ("index.html", "app.js", "engine.js", "data.js", "extra.js"):
        shutil.copy2(os.path.join(SRC, f), os.path.join(DST, f))
    # 日主形象图
    img_src = os.path.join(SRC, "img")
    if os.path.isdir(img_src):
        shutil.copytree(img_src, os.path.join(DST, "img"), dirs_exist_ok=True)
    for extra in ("CNAME", "robots.txt"):
        p = os.path.join(SRC, extra)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(DST, extra))
    print("docs/ synced")

if __name__ == "__main__":
    main()
