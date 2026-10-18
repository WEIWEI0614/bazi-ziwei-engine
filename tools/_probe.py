"""探查 build_reading 返回的字段，供导出脚本使用。"""
import sys

sys.path.insert(0, "/Users/davidwei/Desktop/孵化器/mingli-engine")
from mingli.reading import build_reading

r = build_reading("t", "male", 1993, 6, 14, 17, 31, 116.65, 8.0, True,
                  "zi_start", "sanhe", "split", 2026)

print("top keys:", [k for k in r.__dict__])
for k in ("chart", "ziwei", "zsummary", "scores", "meta"):
    v = getattr(r, k, None)
    if v is None:
        print(k, "None")
        continue
    keys = list(v.keys()) if isinstance(v, dict) else [a for a in dir(v) if not a.startswith("_")]
    print("%-9s %s" % (k, keys[:26]))

c = r.chart
print("\nchart 属性:", [a for a in dir(c) if not a.startswith("_")][:40])
print("\npillar:", c.pillars[0].__dict__ if hasattr(c.pillars[0], "__dict__") else dir(c.pillars[0]))
print("\nshensha 样例:", list(c.shensha.items())[:2])
print("\ncycles[0]:", r.cycles[0] if r.cycles else None)
print("\ntimeline 类型:", type(r.timeline), len(r.timeline) if hasattr(r.timeline, "__len__") else "")
print("\ngrade:", r.grade if hasattr(r, "grade") else None)
