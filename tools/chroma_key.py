"""从绿幕图抠出透明背景的角色立绘。

难点：日主形象本身会穿同色系衣服（甲木穿墨绿、壬水穿深蓝），
按「绿色像素」直接抠会把衣服一起抠掉。所以做法是

1. 从四条边的多个种子点做 flood fill，只标记**与画布边缘连通**的背景；
2. 边缘做 1px 羽化，避免锯齿；
3. despill：半透明边缘上残留的绿色分量压到 max(R,B)，防止绿边；
4. 裁掉四周透明留白，按统一高度缩放，保证 20 张图人物比例一致。

用法：
    python tools/chroma_key.py raw.png out.png
    python tools/chroma_key.py --all        # 批量处理 tools/raw/*.png
"""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(os.path.dirname(HERE), "web", "img", "dz")

TARGET_H = 900          # 统一输出高度
PAD = 8


def _auto_thresh(im: Image.Image) -> int:
    """背景渐变幅度每张不同，固定阈值会漏抠或吃掉衣服。

    从 64 起逐档尝试，取「背景覆盖够多、但人物中心区没被误抠」的第一档。
    """
    small = im.resize((im.width // 4, im.height // 4), Image.NEAREST)
    w, h = small.size
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1)]
    x0, x1 = int(w * 0.34), int(w * 0.66)
    y0, y1 = int(h * 0.16), int(h * 0.62)
    best = 64
    for t in range(64, 145, 8):
        wk = small.copy()
        for sd in seeds:
            try:
                ImageDraw.floodfill(wk, sd, (255, 0, 255), thresh=t)
            except Exception:
                pass
        a = np.asarray(wk)
        bg = (a[:, :, 0] > 240) & (a[:, :, 1] < 15) & (a[:, :, 2] > 240)
        inner = bg[y0:y1, x0:x1].mean()
        ratio = bg.mean()
        best = t
        if ratio > 0.30 and inner < 0.04:
            return t
    return best


def _coverage(im: Image.Image, t: int) -> float:
    w, h = im.size
    small = im.resize((w // 4, h // 4), Image.NEAREST)
    sw, sh = small.size
    wk = small.copy()
    for sd in [(0, 0), (sw - 1, 0), (0, sh - 1), (sw - 1, sh - 1),
               (sw // 2, 0), (sw // 2, sh - 1)]:
        try:
            ImageDraw.floodfill(wk, sd, (255, 0, 255), thresh=t)
        except Exception:
            pass
    a = np.asarray(wk)
    bg = (a[:, :, 0] > 240) & (a[:, :, 1] < 15) & (a[:, :, 2] > 240)
    return float(bg.mean())


def key_one(src: str, dst: str, thresh: int | None = None) -> None:
    im = Image.open(src).convert("RGB")
    w, h = im.size

    # 水印在右下角，先抹成背景色，否则 flood fill 会绕开它留下一块不透明
    d = ImageDraw.Draw(im)
    d.rectangle([int(w * 0.62), int(h * 0.90), w, h],
                fill=_corner_color(im, w, h))

    if thresh is None:
        # 先按 72 试一次：够就不动。只有背景覆盖率明显不足时才升档，
        # 否则对深色衣袍的图会把衣服一起吃掉（壬水那张就是这么黑的）。
        thresh = 72
        probe = _coverage(im, 72)
        if probe < 0.30:
            thresh = _auto_thresh(im)
    work = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        try:
            ImageDraw.floodfill(work, s, (255, 0, 255), thresh=thresh)
        except Exception:
            pass

    arr = np.asarray(work)
    bg = (arr[:, :, 0] > 240) & (arr[:, :, 1] < 15) & (arr[:, :, 2] > 240)

    # 背景是「树影式」深绿渐变时，flood fill 只能吃掉一部分。
    # 此时退回色相判定：绿幕就是绿幕，而这一批人物都不穿绿，安全的。
    if bg.mean() < 0.45:
        # 只认「亮而饱和的绿」（绿幕），不认人物身上的深绿纹样（V 低）；
        # 再要求这块绿与画布边缘连通，避免抠掉被人物包住的深色图案。
        hsv = np.asarray(im.convert("HSV")).astype(np.int32)
        H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        green = (H >= 62) & (H <= 118) & (S >= 70) & (V >= 92)
        mask = Image.fromarray((green * 255).astype(np.uint8), "L")
        reach = mask.copy()
        for sd in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                   (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
            if reach.getpixel(sd) == 255:
                try:
                    ImageDraw.floodfill(reach, sd, 128, thresh=0)
                except Exception:
                    pass
        bg = bg | (np.asarray(reach) == 128)

    # 边缘羽化：先收缩 1px 去掉残留绿边，再用模糊做软过渡
    alpha = (~bg).astype(np.uint8) * 255
    a_img = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3))
    a_img = a_img.filter(ImageFilter.GaussianBlur(0.8))

    rgba = np.dstack([np.asarray(im), np.asarray(a_img)]).astype(np.float32)

    # despill：把所有偏绿的像素（含半透明边缘与透出背景的薄纱）的绿分量
    # 压到 R/B 的最大值附近，否则深色底上会浮出一层绿雾
    rgb = rgba[:, :, :3]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    greenish = g > np.maximum(r, b) * 1.04 + 4
    lim = np.maximum(r, b)
    rgb[:, :, 1] = np.where(greenish, lim * 0.94 + g * 0.06, g)
    # 半透明区域再压一次，去掉背景透出的绿
    soft = (np.asarray(a_img) < 250) & (np.asarray(a_img) > 4)
    rgb[:, :, 1] = np.where(soft & greenish, lim * 0.88 + g * 0.12, rgb[:, :, 1])
    rgba[:, :, :3] = rgb

    out = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")

    # 裁掉透明留白
    bbox = out.split()[3].getbbox()
    if bbox:
        out = out.crop(bbox)

    # 统一高度，保持比例，底部对齐
    ratio = TARGET_H / out.height
    out = out.resize((max(1, int(out.width * ratio)), TARGET_H), Image.LANCZOS)

    canvas = Image.new("RGBA", (out.width + PAD * 2, TARGET_H + PAD * 2), (0, 0, 0, 0))
    canvas.paste(out, (PAD, PAD), out)
    canvas.save(dst, "PNG", optimize=True)
    print(f"{os.path.basename(src)} -> {os.path.basename(dst)} "
          f"{canvas.width}x{canvas.height}")


def _corner_color(im: Image.Image, w: int, h: int):
    px = im.load()
    pts = [(3, 3), (w - 4, 3), (3, h - 4), (w - 4, h - 4)]
    cols = [px[p] for p in pts]
    return tuple(sum(c[i] for c in cols) // len(cols) for i in range(3))


def main():
    os.makedirs(OUT, exist_ok=True)
    if len(sys.argv) >= 3:
        key_one(sys.argv[1], sys.argv[2])
        return
    files = sorted(f for f in os.listdir(RAW) if f.lower().endswith(".png"))
    if not files:
        print("no raw images in", RAW)
        return
    for f in files:
        name = os.path.splitext(f)[0]
        key_one(os.path.join(RAW, f), os.path.join(OUT, name + ".png"))


if __name__ == "__main__":
    main()
