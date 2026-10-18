"""导出一张盘的完整读数，用于人工核对分布是否合理。"""
import sys, statistics, collections

sys.path.insert(0, "/Users/davidwei/Desktop/孵化器/mingli-engine")
from mingli.reading import build_reading
from mingli.bazi.luck import luck_cycles, year_period, month_periods
from mingli.bazi import gexi

Y, M, D, H, MI, LON = 1993, 6, 14, 17, 31, 116.65
r = build_reading("t", "male", Y, M, D, H, MI, LON, 8.0, True,
                  "zi_start", "sanhe", "split", 2026)
c = r.chart

print("=" * 68)
print("四柱", " ".join(p.gan + p.zhi for p in c.pillars))
print("日主", c.day_master, c.day_master_wx, "|", c.strength, c.strength_label,
      "|", c.structure["name"])
print("五行", {k: round(v, 1) for k, v in c.element_scores.items()})
s = gexi.useful_system(c)
print("用神", s["primary"], s["primary_class"], "| 喜", s["favor"],
      "| 忌", s["avoid"], "| 闲", s["neutral"])
for w in s["why"]:
    print("   ·", w)

print("=" * 68)
sc = r.scores
print("整体", sc["overall"], "分位", sc["percentile"], sc["tier"])
for k in sc["dimensions"]:
    print("  %-10s %5.1f  w=%.2f" % (k, sc["dimensions"][k], sc["weights"][k]))

cy = luck_cycles(c, 12, 2026)
print("=" * 68)
print("大运：")
for x in cy:
    mark = " ←当前" if x.start_year <= 2026 <= x.end_year else ""
    print("  %s %s %d-%d 岁 %d-%d%s"
          % (x.label, x.shishen_gan, x.start_age, x.end_age,
             x.start_year, x.end_year, mark))

ys, ms = [], []
rows = []
for y in range(Y, 2085):
    lc = next((x for x in cy if x.start_year <= y <= x.end_year), None)
    p = year_period(c, y, lc)
    ys.append(p.score)
    rows.append((y, p.label, p.score, p.band, p.components))
    if 2020 <= y <= 2040:
        for m in month_periods(c, y, p):
            ms.append(m.score)


def rep(name, v):
    v = sorted(v)
    n = len(v)
    q = lambda f: v[int(f * (n - 1))]
    b = collections.Counter()
    for x in v:
        b["凶<40" if x < 40 else "弱40-48" if x < 48 else "平48-56"
          if x < 56 else "吉56-68" if x < 68 else "大吉>=68"] += 1
    print("%s n=%d mean %.1f sd %.1f p5 %.0f p50 %.0f p95 %.0f"
          % (name, n, statistics.mean(v), statistics.pstdev(v),
             q(.05), q(.5), q(.95)))
    print("   ", {k: "%d%%" % (100 * x / n) for k, x in b.items()})


print("=" * 68)
rep("流年 1993-2084", ys)
rep("流月 2020-2040", ms)

print("=" * 68)
print("逐年明细（2020-2040）：")
for y, lab, sco, band, comp in rows:
    if not (2020 <= y <= 2040):
        continue
    print("  %d %s %5.1f %-4s  用%6.1f 十%5.1f 冲%5.1f 运%5.1f 煞%4.1f"
          % (y, lab, sco, band, comp.get("用神", 0), comp.get("十神", 0),
             comp.get("冲合", 0), comp.get("大运", 0), comp.get("神煞", 0)))
