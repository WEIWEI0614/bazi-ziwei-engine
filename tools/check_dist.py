"""流年分布抽检：确认没有系统性偏低。"""
import sys, random, statistics, collections

sys.path.insert(0, "/Users/davidwei/Desktop/孵化器/mingli-engine")
from mingli.bazi.chart import build_chart
from mingli.bazi.luck import luck_cycles, year_period

random.seed(7)
allsc, per = [], []
for _ in range(40):
    y = random.randint(1955, 2005)
    m = random.randint(1, 12)
    d = random.randint(1, 28)
    h = random.choice([0, 4, 8, 12, 16, 20])
    c = build_chart("t", random.choice(["male", "female"]), y, m, d, h, 0,
                    longitude=116.4)
    cy = luck_cycles(c, 1, 2100)
    sc = []
    for yy in range(y + 10, y + 60):
        lc = next((x for x in cy if x.start_year <= yy <= x.end_year), None)
        sc.append(year_period(c, yy, lc).score)
    allsc += sc
    per.append(statistics.mean(sc))

print("40 盘 x 50 年 = %d 个年分: mean %.1f sd %.1f"
      % (len(allsc), statistics.mean(allsc), statistics.pstdev(allsc)))
per_s = sorted(per)
print("每盘均分: min %.1f p25 %.1f median %.1f p75 %.1f max %.1f"
      % (per_s[0], per_s[10], statistics.median(per), per_s[30], per_s[-1]))
b = collections.Counter()
for x in allsc:
    b["凶<40" if x < 40 else "弱40-48" if x < 48 else "平48-56" if x < 56
      else "吉56-68" if x < 68 else "大吉>=68"] += 1
n = len(allsc)
print({k: "%d%%" % (100 * v / n) for k, v in b.items()})
print("均分低于 45 的盘:", sum(1 for x in per if x < 45), "/", len(per))
