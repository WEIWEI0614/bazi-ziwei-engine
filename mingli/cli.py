"""Command line interface.

    python -m mingli chart  --date 1993-06-14 --time 17:31 --gender male --lon 116.65
    python -m mingli year   2027 --date ... 
    python -m mingli month  2027 --date ...
    python -m mingli md     --date ... -o report.md
    python -m mingli json   --date ... -o chart.json
    python -m mingli serve  --port 8788
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from .bazi import luck as bz
from .calendar import astro
from .reading import build_reading

BAR = "─"


def _parse(argv):
    p = argparse.ArgumentParser(prog="mingli", description="BaZi + Zi Wei Dou Shu engine")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--date", required=True, help="YYYY-MM-DD (Gregorian)")
        sp.add_argument("--time", default="12:00", help="HH:MM clock time")
        sp.add_argument("--gender", default="male", choices=["male", "female"])
        sp.add_argument("--lon", type=float, default=116.40, help="longitude East")
        sp.add_argument("--name", default="—")
        sp.add_argument("--no-true-solar", action="store_true")
        sp.add_argument("--zi-mid", action="store_true", help="day changes at 00:00")
        sp.add_argument("--feixing", action="store_true", help="Feixing sihua table")
        sp.add_argument("--leap-same", action="store_true", help="leap month = same month")
        sp.add_argument("--focus", type=int, default=None)
        sp.add_argument("--events", help="JSON file: [{year,kind,impact,note}]")

    c = sub.add_parser("chart", help="print the full reading")
    common(c)
    y = sub.add_parser("year", help="print annual detail")
    common(y)
    y.add_argument("span", nargs="?", type=int, default=12)
    m = sub.add_parser("month", help="print monthly detail")
    common(m)
    m.add_argument("year_num", type=int)
    md = sub.add_parser("md", help="write a Markdown report")
    common(md)
    md.add_argument("-o", "--out", default="report.md")
    js = sub.add_parser("json", help="write the reading as JSON")
    common(js)
    js.add_argument("-o", "--out", default="chart.json")
    sv = sub.add_parser("serve", help="serve the web UI locally")
    sv.add_argument("--port", type=int, default=8788)
    return p.parse_args(argv)


def _opts(a):
    y, m, d = (int(x) for x in a.date.split("-"))
    hh, mm = (int(x) for x in (a.time or "12:00").split(":"))
    ev = None
    if getattr(a, "events", None):
        with open(a.events, encoding="utf-8") as f:
            ev = json.load(f)
    return dict(name=a.name, gender=a.gender, year=y, month=m, day=d,
                hour=hh, minute=mm, longitude=a.lon, tz_offset=8.0,
                use_true_solar=not a.no_true_solar,
                zi_boundary="zi_mid" if a.zi_mid else "zi_start",
                sihua_school="feixing" if a.feixing else "sanhe",
                leap_policy="same" if a.leap_same else "split",
                focus_year=a.focus, events=ev)


def _head(t):
    print(f"\n{t}\n{BAR * min(76, max(24, len(t) * 2))}")


def cmd_chart(r):
    c, z = r.chart, r.ziwei
    print(f"\n  {c.name} · {r.chart.gender} · 公历 {c.birth_local:%Y-%m-%d %H:%M}")
    off = (c.true_solar - c.birth_local).total_seconds() / 60.0
    print(f"  真太阳时 {c.true_solar:%Y-%m-%d %H:%M:%S}  ({off:+.1f} 分钟)")
    ld = c.lunar_date
    print(f"  农历 {ld.year} 年 {'闰' if ld.is_leap else ''}{ld.month} 月 {ld.day} 日 · {z.hour_branch} 时")

    _head("四柱")
    print("       年柱    月柱    日柱    时柱")
    print("  干   " + "    ".join(f"{p.gan}({p.shishen_gan})" for p in c.pillars))
    print("  支   " + "    ".join(f"{p.zhi}({p.shishen_zhi})" for p in c.pillars))
    print("  藏干 " + "  ".join("".join(p.hidden) for p in c.pillars))
    print("  纳音 " + " ".join(p.nayin for p in c.pillars))
    print("  长生 " + "  ".join(p.stage for p in c.pillars))
    print("  空亡 " + "  ".join("".join(p.kong) for p in c.pillars))

    _head("命局")
    es = c.element_scores
    print("  五行  " + "  ".join(f"{k} {v:5.1f}%" for k, v in es.items()))
    print(f"  日主  {c.day_master}（{c.day_master_wx}）  {c.strength:.1f}%  {c.strength_label}")
    print(f"  格局  {c.structure['name']} — {c.structure['basis']}")
    th = c.tiaohou
    print(f"  调候  {th['sequence']}  已见 {''.join(th['satisfied']) or '无'}  缺 {''.join(th['missing']) or '无'}")
    favor, avoid, why = bz.useful_elements(c)
    print(f"  喜用  {' '.join(favor)}    忌 {' '.join(avoid)}")
    print(f"        {why['strength_based']}")

    if c.shensha:
        _head("神煞")
        for nature in ("吉", "中", "凶"):
            hits = [(k, v) for k, v in c.shensha.items() if v["nature"] == nature]
            if not hits:
                continue
            print(f"  [{nature}]")
            for k, v in hits:
                print(f"    {k:8s} {'/'.join(v['positions']):8s} {v['basis']}")
    if c.relations:
        _head("刑冲合害")
        for k, v in c.relations.items():
            print(f"  {k:4s} " + "  ".join(x["pair"] + "(" + x["type"] + ")" for x in v))

    _head("紫微斗数")
    print(f"  命宫 {z.ming_branch}   身宫 {z.shen_branch}   五行局 {z.ju}   紫微星 {z.ziwei_branch}")
    print(f"  命主 {z.ming_zhu}   身主 {z.shen_zhu}   斗君 {z.dou_jun}")
    print(f"  生年干 {z.year_gan}  大限{z.decade_direction > 0 and '顺行' or '逆行'}  四化 "
          + " ".join(f"{k}化{v}" for k, v in z.sihua.items()))
    print()
    for p in z.palaces:
        majors = " ".join(
            s.name + (f"化{s.hua}" if s.hua else "") + (f"[{s.brightness}]" if s.brightness else "")
            for s in p.stars if s.kind == "主星") or "（空宫）"
        minors = " ".join(
            s.name + (f"化{s.hua}" if s.hua else "")
            for s in p.stars if s.kind in ("辅星", "煞星"))
        adj = " ".join(s.name for s in p.stars if s.kind == "杂曜")
        mark = "◆" if p.is_body else " "
        print(f"  {p.gan}{p.branch} {p.name:4s}{mark} 大限{p.decade[0]:>3d}-{p.decade[1]:<3d} "
              f"小限{p.ages[0] if p.ages else '-'}")
        print(f"      主星 {majors}")
        if minors:
            print(f"      辅煞 {minors}")
        if adj:
            print(f"      杂曜 {adj}")
        print(f"      十二神 {p.changsheng}·{p.boshi}·{p.suiqian}·{p.jiangqian}"
              + (f"   自化 {' '.join(n + h for n, h in p.self_hua)}" if p.self_hua else ""))
    zs = r.zsummary
    print(f"\n  命宫星 {''.join(zs['ming_stars']) or '空宫'}   格局 "
          + ("、".join(x["name"] for x in zs["patterns"]) or "无"))
    for p in zs["patterns"]:
        print(f"    · {p['name']}：{p['desc']}")

    _head("评分")
    s = r.scores
    print(f"  综合 {s['overall']} / 100  {s['tier']}")
    for k, v in s["dimensions"].items():
        print(f"    {k:10s} {v:5.1f}  {'█' * int(v / 4)}")
    print("  六领域 " + "  ".join(f"{k} {v:.0f}" for k, v in s["areas"].items()))

    _head("大运")
    for cyc in r.cycles:
        tag = "←当前" if cyc.active else ""
        print(f"  {cyc.label}  {cyc.start_age:>3d}-{cyc.end_age:<3d}岁  "
              f"{cyc.start_year}-{cyc.end_year}  {cyc.shishen_gan}/{cyc.shishen_zhi} {tag}")

    _head("流年")
    for d in r.timeline:
        print(f"  {d['name']} {d['label']} v{d['age']:<3d} 运{d['luck_cycle'] or '—':4s} "
              f"{d['score']:5.1f} {d['band']:3s}  {' · '.join(d['themes'][:2])}")
        for x in d["cautions"][:1]:
            print(f"        ! {x}")
    if r.events:
        _head("经历对照")
        e = r.events
        print(f"  吻合率 {e['hit_rate']}%   相关系数 {e['correlation']}   "
              f"校准后 {e['calibrated_correlation']}")
        print(f"  {e['verdict']}")
        for row in e["rows"]:
            print(f"  {row['year']} {row['ganzhi']} {row['kind_label']:4s} "
                  f"自评{row['impact']:+.0f}  引擎{row['predicted']:5.1f} "
                  f"校准{row['calibrated']:5.1f}  {'吻合' if row['agree'] else '不符'}")
    print()


def cmd_year(r, span):
    _head(f"流年 · {r.chart.name}")
    for d in r.timeline[:span]:
        print(f"\n  {d['name']} {d['label']}  {d['age']}岁  运 {d['luck_cycle'] or '—'}")
        print(f"  评分 {d['score']:.1f} {d['band']}   十神 {d['shishen_gan']}/{d['shishen_zhi']}")
        print(f"  主题 {' · '.join(d['themes'])}")
        if d["opportunities"]:
            print("  机会 " + "；".join(d["opportunities"]))
        if d["cautions"]:
            print("  注意 " + "；".join(d["cautions"]))
    print()


def cmd_month(r, year):
    cyc = next((c for c in r.cycles if c.start_year <= year <= c.end_year), None)
    ps = bz.month_periods(r.chart, year, cyc)
    _head(f"流月 · {year}")
    for p in ps:
        print(f"  {p.name} {p.label}  {p.score:5.1f} {p.band:3s}  "
              f"{' · '.join(p.themes[:2])}")
        if p.cautions:
            print(f"        ! {p.cautions[0]}")
    print()


def cmd_md(r, out):
    L = []
    c, z, s = r.chart, r.ziwei, r.scores
    L.append(f"# {c.name} · 命理报告\n")
    L.append(f"- 公历：{c.birth_local:%Y-%m-%d %H:%M}（真太阳时 {c.true_solar:%H:%M:%S}）")
    ld = c.lunar_date
    L.append(f"- 农历：{ld.year} 年 {'闰' if ld.is_leap else ''}{ld.month} 月 {ld.day} 日")
    L.append(f"- 四柱：**{c.four()}**")
    L.append(f"- 综合评分：**{s['overall']}**（{s['tier']}）\n")
    L.append("## 一、八字\n")
    L.append("| | 年柱 | 月柱 | 日柱 | 时柱 |\n|---|---|---|---|---|")
    L.append("| 天干 | " + " | ".join(f"{p.gan} {p.shishen_gan}" for p in c.pillars) + " |")
    L.append("| 地支 | " + " | ".join(f"{p.zhi} {p.shishen_zhi}" for p in c.pillars) + " |")
    L.append("| 藏干 | " + " | ".join("".join(p.hidden) for p in c.pillars) + " |")
    L.append("| 纳音 | " + " | ".join(p.nayin for p in c.pillars) + " |")
    L.append("| 长生 | " + " | ".join(p.stage for p in c.pillars) + " |\n")
    L.append(f"五行：{'、'.join(f'{k} {v:.1f}%' for k, v in c.element_scores.items())}\n")
    L.append(f"- 日主 **{c.day_master}**（{c.day_master_wx}），{c.strength:.1f}% · {c.strength_label}")
    L.append(f"- 格局 **{c.structure['name']}**：{c.structure['basis']}")
    th = c.tiaohou
    L.append(f"- 调候 {th['sequence']}（已见 {''.join(th['satisfied']) or '无'}，缺 {''.join(th['missing']) or '无'}）")
    favor, avoid, why = bz.useful_elements(c)
    L.append(f"- 喜用 **{' '.join(favor)}**，忌 {' '.join(avoid)}")
    L.append(f"- {why['strength_based']}")
    L.append(f"- {why['tiaohou']}\n")
    L.append("## 二、紫微斗数\n")
    L.append(f"命宫 {z.ming_branch} · 身宫 {z.shen_branch} · {z.ju} · 紫微在 {z.ziwei_branch}\n")
    L.append("| 宫位 | 地支 | 主星 | 辅煞 | 大限 |\n|---|---|---|---|---|")
    for p in z.palaces:
        maj = " ".join(x.name + (f"化{x.hua}" if x.hua else "") + f"[{x.brightness}]"
                       for x in p.stars if x.kind == "主星")
        oth = " ".join(x.name + (f"化{x.hua}" if x.hua else "")
                       for x in p.stars if x.kind != "主星")
        L.append(f"| {p.name} | {p.gan}{p.branch} | {maj} | {oth} | {p.decade[0]}-{p.decade[1]} |")
    L.append("")
    L.append(f"格局：{'、'.join(x['name'] for x in r.zsummary['patterns']) or '无'}\n")
    L.append("## 三、评分\n")
    L.append("| 维度 | 分数 |\n|---|---|")
    for k, v in s["dimensions"].items():
        L.append(f"| {k} | {v} |")
    L.append("")
    L.append("| 领域 | 分数 |\n|---|---|")
    for k, v in s["areas"].items():
        L.append(f"| {k} | {v} |")
    L.append("")
    L.append("## 四、大运\n")
    L.append("| 大运 | 年龄 | 区间 | 十神 |\n|---|---|---|---|")
    for cyc in r.cycles:
        L.append(f"| {cyc.label} | {cyc.start_age}-{cyc.end_age} | {cyc.start_year}-{cyc.end_year} "
                 f"| {cyc.shishen_gan}/{cyc.shishen_zhi}{' ←当前' if cyc.active else ''} |")
    L.append("")
    L.append("## 五、流年\n")
    L.append("| 年份 | 干支 | 大运 | 评分 | 评级 | 主题 | 注意事项 |\n|---|---|---|---|---|---|---|")
    for d in r.timeline:
        L.append(f"| {d['name']} | {d['label']} | {d['luck_cycle']} | {d['score']} | {d['band']} "
                 f"| {' · '.join(d['themes'][:3])} | {'；'.join(d['cautions']) or '—'} |")
    L.append("")
    L.append("## 六、流月\n")
    L.append("| 月份 | 干支 | 评分 | 评级 | 主题 | 机会 | 注意事项 |\n|---|---|---|---|---|---|---|")
    for p in r.months:
        L.append(f"| {p.name} | {p.label} | {p.score} | {p.band} | {' · '.join(p.themes[:2])} "
                 f"| {'；'.join(p.opportunities[:1]) or '—'} | {'；'.join(p.cautions[:1]) or '—'} |")
    L.append("")
    if r.events:
        e = r.events
        L.append("## 七、经历对照\n")
        L.append(f"- 吻合率 **{e['hit_rate']}%**，相关系数 **{e['correlation']}**，校准后 **{e['calibrated_correlation']}**")
        L.append(f"- {e['verdict']}\n")
        L.append("| 年份 | 干支 | 类型 | 自评 | 引擎 | 校准 | 吻合 | 说明 |\n|---|---|---|---|---|---|---|---|")
        for row in e["rows"]:
            L.append(f"| {row['year']} | {row['ganzhi']} | {row['kind_label']} | {row['impact']:+.0f} "
                     f"| {row['predicted']} | {row['calibrated']} | {'✓' if row['agree'] else '✗'} | {row['note']} |")
    L.append("\n---\n")
    L.append("> 本报告由 mingli-engine 生成。评分为相对刻度，不构成任何决策建议。")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print(f"written {out}")


def cmd_json(r, out):
    c, z = r.chart, r.ziwei
    data = {
        "input": {"name": c.name, "gender": c.gender,
                  "birth": c.birth_local.isoformat(),
                  "true_solar": c.true_solar.isoformat(),
                  "longitude": c.longitude, "zi_boundary": c.zi_boundary},
        "lunar": {"year": c.lunar_date.year, "month": c.lunar_date.month,
                  "day": c.lunar_date.day, "is_leap": c.lunar_date.is_leap},
        "pillars": [{"position": p.position, "gan": p.gan, "zhi": p.zhi,
                     "shishen_gan": p.shishen_gan, "shishen_zhi": p.shishen_zhi,
                     "hidden": list(p.hidden), "nayin": p.nayin,
                     "stage": p.stage, "kong": list(p.kong)} for p in c.pillars],
        "day_master": c.day_master, "strength": c.strength,
        "strength_label": c.strength_label,
        "element_scores": c.element_scores,
        "structure": c.structure, "tiaohou": c.tiaohou,
        "shensha": c.shensha, "relations": c.relations,
        "ziwei": {
            "ming": z.ming_branch, "shen": z.shen_branch, "ju": z.ju,
            "ziwei": z.ziwei_branch, "year_gan": z.year_gan,
            "sihua": z.sihua,
            "palaces": [{"name": p.name, "branch": p.branch, "gan": p.gan,
                         "decade": list(p.decade), "is_body": p.is_body,
                         "stars": [{"name": s.name, "kind": s.kind, "hua": s.hua,
                                    "brightness": s.brightness} for s in p.stars]}
                        for p in z.palaces],
            "summary": r.zsummary,
        },
        "scores": r.scores,
        "cycles": [{"label": cyc.label, "start_age": cyc.start_age,
                    "end_age": cyc.end_age, "start_year": cyc.start_year,
                    "end_year": cyc.end_year, "active": cyc.active} for cyc in r.cycles],
        "timeline": r.timeline,
        "months": [p.__dict__ for p in r.months],
        "events": {k: v for k, v in r.events.items() if k != "rows"} if r.events else None,
        "event_rows": r.events["rows"] if r.events else None,
    }
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"written {out}")


def cmd_serve(port):
    import functools
    import http.server
    import socketserver

    web = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=web)
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {web} on http://127.0.0.1:{port}/  (Ctrl-C to stop)")
        httpd.serve_forever()


def main(argv=None):
    a = _parse(argv if argv is not None else sys.argv[1:])
    if a.cmd == "serve":
        cmd_serve(a.port)
        return
    r = build_reading(**_opts(a))
    if a.cmd == "chart":
        cmd_chart(r)
    elif a.cmd == "year":
        cmd_year(r, a.span)
    elif a.cmd == "month":
        cmd_month(r, a.year_num)
    elif a.cmd == "md":
        cmd_md(r, a.out)
    elif a.cmd == "json":
        cmd_json(r, a.out)


if __name__ == "__main__":
    main()
