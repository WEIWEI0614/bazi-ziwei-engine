"""导出一个人命盘的全部读数：JSON（原始）+ HTML（可读档案）。

用法：python tools/export_report.py [年 月 日 时 分 经度 性别]
默认导出 1993-06-14 17:31 北京（东八区，真太阳时）。
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime

ROOT = "/Users/davidwei/Desktop/孵化器/mingli-engine"
sys.path.insert(0, ROOT)

from mingli.reading import build_reading                      # noqa: E402
from mingli.bazi.luck import (luck_cycles, year_period,       # noqa: E402
                              month_periods)
from mingli.bazi import gexi                                   # noqa: E402
from mingli.ziwei.patterns import PATTERNS                     # noqa: E402

OUT_DIR = os.path.join(ROOT, "exports")
os.makedirs(OUT_DIR, exist_ok=True)

Y, M, D, H, MI, LON, GENDER = 1993, 6, 14, 17, 31, 116.65, "male"

r = build_reading("魏威", GENDER, Y, M, D, H, MI, LON, 8.0, True,
                  "zi_start", "sanhe", "split", 2026)
c, z = r.chart, r.ziwei
sysd = gexi.useful_system(c)
cy = luck_cycles(c, 12, 2026)

# ---------- 流年 / 流月 ----------
years = []
for y in range(Y, Y + 92):
    lc = next((x for x in cy if x.start_year <= y <= x.end_year), None)
    p = year_period(c, y, lc)
    years.append({
        "year": y, "ganzhi": p.label, "age": y - Y + 1,
        "luck": lc.label if lc else "", "score": p.score, "band": p.band,
        "percentile": getattr(p, "percentile", None),
        "components": p.components,
        "shishen": [p.shishen_gan, p.shishen_zhi],
        "themes": p.themes,
        "relations": p.relations,
        "merge": getattr(p, "merge", None),
    })

months = []
for y in (2026, 2027):
    lc = next((x for x in cy if x.start_year <= y <= x.end_year), None)
    yp = year_period(c, y, lc)
    for m in month_periods(c, y, yp):
        months.append({"year": y, "month": m.label, "score": m.score,
                       "band": m.band, "components": m.components})

# ---------- 紫微 12 宫 ----------
palaces = []
for p in z.palaces:
    palaces.append({
        "name": p.name, "branch": p.branch, "gan": p.gan,
        "decade": list(p.decade),
        "majors": [{"n": s.name, "hua": s.hua, "b": s.brightness}
                   for s in p.stars if s.kind == "主星"],
        "aux": [{"n": s.name, "hua": s.hua}
                for s in p.stars if s.kind in ("辅星", "煞星")],
        "minor": [s.name for s in p.stars if s.kind == "杂曜"],
        "changsheng": p.changsheng, "boshi": p.boshi,
        "suiqian": p.suiqian, "jiangqian": p.jiangqian,
        "is_body": p.is_body,
    })

data = {
    "generated": datetime.now().strftime("%Y-%m-%d %H:%M"),
    "build": "v=23",
    "input": {"y": Y, "m": M, "d": D, "h": H, "mi": MI, "lon": LON,
              "gender": GENDER, "true_solar": True},
    "birth": {"local": c.birth_local, "true_solar": c.true_solar,
              "lunar": c.lunar_date},
    "pillars": [{"pos": p.position, "gz": p.gan + p.zhi,
                 "ss": [p.shishen_gan, p.shishen_zhi],
                 "hidden": list(p.hidden), "nayin": p.nayin,
                 "stage": p.stage, "kong": list(p.kong)}
                for p in c.pillars],
    "elements": c.element_scores,
    "strength": {"value": c.strength, "label": c.strength_label,
                 "season": c.seasonal_state},
    "structure": c.structure,
    "tiaohou": c.tiaohou,
    "useful": {k: sysd[k] for k in
               ("primary", "primary_class", "favor", "avoid", "neutral",
                "rescue", "why", "ge", "strong")},
    "shensha": {k: v for k, v in c.shensha.items()},
    "relations": [{"kind": x.kind, "zhis": list(x.zhis), "pos": list(x.pos),
                   "element": x.element, "strength": round(x.strength, 3),
                   "label": x.label, "note": x.note,
                   "transforms": x.transforms}
                  for x in c.relations_model.items],
    "scores": r.scores,
    "grade": r.grade,
    "ziwei": {"ming_branch": z.ming_branch, "shen_branch": z.shen_branch,
              "ju": z.ju, "ming_zhu": z.ming_zhu, "shen_zhu": z.shen_zhu,
              "dou_jun": z.dou_jun, "sihua": z.sihua,
              "palaces": palaces},
    "patterns": r.zsummary["patterns"],
    "pattern_summary": {
        "total": len(PATTERNS),
        "hits": r.zsummary.get("patternHits", []),
        "bad": r.zsummary.get("patternBad", []),
    },
    "cycles": [{"gz": x.gan + x.zhi, "age": [x.start_age, x.end_age],
                "year": [x.start_year, x.end_year], "ss": x.shishen_gan}
               for x in cy],
    "years": years,
    "months": months,
}

jp = os.path.join(OUT_DIR, "命盘全量-1993-06-14.json")
with open(jp, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=1, default=str)

print("JSON ->", jp, "%.1f KB" % (os.path.getsize(jp) / 1024))
print("流年", len(years), "| 流月", len(months), "| 格局", len(data["patterns"]),
      "| 神煞", len(data["shensha"]))
print("整体", r.scores["overall"], r.scores["tier"],
      "| 分位", r.scores["percentile"])


# ============================ HTML 档案 ============================
import html as _html                                          # noqa: E402

E = lambda x: _html.escape(str(x))                            # noqa: E731
BAND_C = {"凶": "#e05c5c", "偏弱": "#c98a4b", "小凶": "#c98a4b",
          "平": "#8b93a3", "小吉": "#5aa9a0", "吉": "#4f9d8e",
          "大吉": "#3f8f7f"}

def cls(score):
    return "s-hi" if score >= 62 else "s-mid" if score >= 50 else "s-lo"


parts = []
A = parts.append

A(f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>命盘全量档案 · {E(data['birth']['local'])}</title>
<style>
:root{{--bg:#0f1115;--card:#171a21;--line:#262a33;--tx:#c9cdd6;--tx2:#9aa1b0;
--tx3:#6f7686;--amber:#e8a33d;--amber2:#f2bd6a;--teal:#4f9d8e;--red:#e05c5c}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--tx);
font:13px/1.75 -apple-system,"PingFang SC","Noto Sans SC",sans-serif}}
.wrap{{max-width:1080px;margin:0 auto;padding:34px 28px 80px}}
h1{{font-size:23px;margin:0 0 4px;color:var(--amber2);font-weight:600;letter-spacing:.02em}}
h2{{font-size:14px;margin:34px 0 10px;color:var(--amber);letter-spacing:.12em;font-weight:600;
border-left:3px solid var(--amber);padding-left:9px}}
h3{{font-size:12.5px;margin:16px 0 6px;color:var(--tx2);font-weight:600}}
.sub{{color:var(--tx3);font-size:12px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:14px 16px;margin:9px 0}}
table{{width:100%;border-collapse:collapse;font-size:12px}}
th,td{{padding:5px 7px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}}
th{{color:var(--tx3);font-weight:500;font-size:11px;letter-spacing:.06em}}
tr:last-child td{{border-bottom:none}}
.num{{text-align:right;font-variant-numeric:tabular-nums}}
.gz{{font-family:"Songti SC",serif;font-size:14px;color:var(--amber2);letter-spacing:.1em}}
.tag{{display:inline-block;padding:0 5px;border-radius:4px;font-size:10.5px;line-height:17px;
margin-right:3px;background:#20242d;color:var(--tx2)}}
.tag.g{{background:rgba(79,157,142,.16);color:#7fc4b6}}
.tag.b{{background:rgba(224,92,92,.14);color:#e58b8b}}
.tag.m{{background:rgba(232,163,61,.13);color:var(--amber2)}}
.bar{{height:7px;border-radius:4px;background:#20242d;overflow:hidden;min-width:70px}}
.bar > i{{display:block;height:100%;background:linear-gradient(90deg,#e8a33d,#f2bd6a)}}
.s-hi{{color:#7fc4b6}}.s-mid{{color:var(--tx)}}.s-lo{{color:#e58b8b}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.note{{color:var(--tx3);font-size:11.5px;line-height:1.8}}
.warn{{background:rgba(232,163,61,.07);border:1px dashed rgba(232,163,61,.4);
border-radius:8px;padding:11px 14px;margin:10px 0;font-size:12px;line-height:1.85}}
.warn b{{color:var(--amber2)}}
.mono{{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}}
@media print{{
 body{{background:#fff;color:#222}} .card{{background:#fff;border-color:#ddd}}
 h2{{color:#a86a12;border-color:#a86a12}} .gz,.tag{{color:#333}}
 .bar{{background:#eee}} .bar>i{{background:#a86a12}}
 .s-hi,.s-mid{{color:#222}} .s-lo{{color:#b03030}} .note,.sub{{color:#666}}
}}
</style></head><body><div class="wrap">""")

birth = data["birth"]
A(f"""<h1>命盘全量档案</h1>
<div class="sub">{E(birth['local'])}　真太阳时 {E(birth['true_solar'])}　
农历 {E(birth['lunar'])}　经度 {LON}　{('男' if GENDER=='male' else '女')}
　生成于 {E(data['generated'])}（{data['build']}）</div>""")

# 四柱
A("<h2>一、四柱</h2><div class='card'><table><tr><th>柱</th><th>干支</th>"
  "<th>天干十神</th><th>地支十神</th><th>藏干</th><th>纳音</th><th>长生</th><th>空亡</th></tr>")
for p in data["pillars"]:
    pos = {"year": "年", "month": "月", "day": "日", "hour": "时"}[p["pos"]]
    A(f"<tr><td>{pos}{'（日主）' if p['pos']=='day' else ''}</td>"
      f"<td class='gz'>{E(p['gz'])}</td><td>{E(p['ss'][0])}</td><td>{E(p['ss'][1])}</td>"
      f"<td>{E(' '.join(p['hidden']))}</td><td>{E(p['nayin'])}</td>"
      f"<td>{E(p['stage'])}</td><td>{E(''.join(p['kong']))}</td></tr>")
A("</table></div>")

# 五行
A("<h2>二、五行与强弱</h2><div class='card'>")
for el, v in sorted(data["elements"].items(), key=lambda x: -x[1]):
    A(f"<div style='display:flex;align-items:center;gap:9px;margin:5px 0'>"
      f"<span style='width:16px;color:var(--tx2)'>{el}</span>"
      f"<span class='bar' style='flex:1'><i style='width:{v:.1f}%'></i></span>"
      f"<span class='num mono' style='width:52px;text-align:right'>{v:.1f}%</span></div>")
A(f"<p class='note' style='margin:9px 0 0'>同党（印 + 比劫）合计 "
  f"<b style='color:var(--amber2)'>{data['strength']['value']:.1f}%</b>，判"
  f"「{E(data['strength']['label'])}」。月令 {E(data['pillars'][1]['gz'][1])}，"
  f"旺相休囚死：" + "、".join(f"{k}{v}" for k, v in data["strength"]["season"].items())
  + "</p></div>")

# 用神
u = data["useful"]
A(f"<h2>三、用神体系</h2><div class='card'>"
  f"<p style='margin:0 0 8px'>用神 <b style='color:var(--amber2);font-size:15px'>{E(u['primary'])}</b>"
  f"（{E(u['primary_class'])}）　喜 "
  f"<span class='tag g'>{E(' '.join(u['favor']))}</span>　忌 "
  f"<span class='tag b'>{E(' '.join(u['avoid']) or '—')}</span>　闲 "
  f"<span class='tag'>{E(' '.join(u['neutral']) or '—')}</span></p>")
for w in u["why"]:
    A(f"<div class='note'>· {E(w)}</div>")
A("</div>")

# 格位
g = data["grade"]["bazi"]
A(f"<h2>四、子平格位（{E(g['structure'])}）</h2><div class='card'>"
  f"<p class='note' style='margin:0 0 8px'>格位分 <b style='color:var(--amber2)'>{g['score']}</b>"
  f"（{E(g['grade'])}）　成格度 {g['setup_ratio']*100:.0f}%　"
  f"破 {g['broken']} 分　救 {g['rescued']} 分</p>"
  "<table><tr><th>类</th><th>条目</th><th>成立</th><th>说明</th></tr>")
for it in g["items"]:
    kind = {"setup": "成格", "break": "破格", "rescue": "救应"}[it["kind"]]
    mark = "✓" if it["ok"] else "·"
    color = "var(--teal)" if it["ok"] and it["kind"] != "break" else \
            ("var(--red)" if it["ok"] and it["kind"] == "break" else "var(--tx3)")
    A(f"<tr><td>{kind}</td><td>{E(it['name'])}</td>"
      f"<td style='color:{color}'>{mark}</td><td class='note'>{E(it['note'])}</td></tr>")
A("</table></div>")

# 神煞
A(f"<h2>五、神煞（共 {len(data['shensha'])} 颗）</h2><div class='card'><table>"
  "<tr><th>吉凶</th><th>神煞</th><th>落宫</th><th>依据</th></tr>")
order = {"吉": 0, "中": 1, "凶": 2}
for k, v in sorted(data["shensha"].items(), key=lambda x: (order[x[1]["nature"]], x[0])):
    tc = {"吉": "g", "中": "m", "凶": "b"}[v["nature"]]
    A(f"<tr><td><span class='tag {tc}'>{v['nature']}</span></td><td>{E(k)}</td>"
      f"<td>{E(''.join(v['positions']))}</td><td class='note'>{E(v['basis'])}</td></tr>")
A("</table></div>")

# 关系
A("<h2>六、合冲刑害（原局）</h2><div class='card'><table>"
  "<tr><th>类型</th><th>地支</th><th>强度</th><th>化神</th><th>说明</th></tr>")
for r0 in data["relations"]:
    A(f"<tr><td>{E(r0['kind'])}</td><td class='gz'>{E(''.join(r0['zhis']))}</td>"
      f"<td class='num mono'>{r0['strength']:.2f}</td>"
      f"<td>{E(r0['element'] or '—')}</td><td class='note'>{E(r0['note'] or '')}</td></tr>")
A("</table></div>")

# 紫微 12 宫
zw = data["ziwei"]
A(f"<h2>七、紫微斗数（命宫 {E(zw['ming_branch'])}，身宫 {E(zw['shen_branch'])}，{E(zw['ju'])}）</h2>"
  f"<div class='card'><p class='note' style='margin:0 0 8px'>命主 {E(zw['ming_zhu'])}　"
  f"身主 {E(zw['shen_zhu'])}　斗君 {E(zw['dou_jun'])}　生年四化 "
  + "、".join(f"{k}化{v}" for k, v in zw["sihua"].items()) + "</p><table>"
  "<tr><th>宫位</th><th>干支</th><th>主星（亮度/四化）</th><th>辅煞</th><th>杂曜</th><th>大限</th></tr>")
for p in zw["palaces"]:
    maj = "、".join(f"{m['n']}{'化'+m['hua'] if m['hua'] else ''}"
                    f"{'['+m['b']+']' if m['b'] else ''}" for m in p["majors"]) or "（空宫）"
    aux = "、".join(a["n"] + ("化" + a["hua"] if a["hua"] else "") for a in p["aux"]) or "—"
    A(f"<tr><td><b style='color:var(--amber2)'>{E(p['name'])}</b>"
      f"{'（身宫）' if p['is_body'] else ''}</td>"
      f"<td class='gz'>{E(p['gan']+p['branch'])}</td><td>{E(maj)}</td>"
      f"<td>{E(aux)}</td><td class='note'>{E(' '.join(p['minor']))}</td>"
      f"<td class='num mono'>{p['decade'][0]}–{p['decade'][1]}</td></tr>")
A("</table></div>")

# 紫微格局
hits = [x for x in data["patterns"] if x["status"] == "成立"]
miss = [x for x in data["patterns"] if x["status"] != "成立"]
A(f"<h2>八、紫微格局（成立 {len(hits)} / 全表 {len(data['patterns'])}）</h2>"
  "<div class='card'><table><tr><th>吉凶</th><th>格局</th><th>依据</th><th>瑕疵</th></tr>")
for x in hits:
    tc = {"吉": "g", "中": "m", "凶": "b"}[x["tier"]]
    A(f"<tr><td><span class='tag {tc}'>{x['tier']}</span></td><td><b>{E(x['name'])}</b></td>"
      f"<td class='note'>{E(x['note'] or x['desc'])}</td>"
      f"<td class='note' style='color:var(--amber2)'>{E(x.get('flaw') or '')}</td></tr>")
A("</table>")
if miss:
    by = {}
    for x in miss:
        by.setdefault(x["tier"], []).append(x["name"])
    A("<div class='note' style='margin-top:9px'>未成立：" +
      "；".join(f"{t} {'、'.join(v)}" for t, v in by.items()) + "</div>")
A("</div>")

# 大运
A("<h2>九、大运</h2><div class='card'><table>"
  "<tr><th>大运</th><th>十神</th><th>岁数</th><th>年份</th></tr>")
for x in data["cycles"]:
    cur = " ←当前" if x["year"][0] <= 2026 <= x["year"][1] else ""
    A(f"<tr><td class='gz'>{E(x['gz'])}</td><td>{E(x['ss'])}</td>"
      f"<td class='num'>{x['age'][0]}–{x['age'][1]}</td>"
      f"<td class='num'>{x['year'][0]}–{x['year'][1]}{cur}</td></tr>")
A("</table></div>")

# 流年
A("<h2>十、流年（1993–2084）</h2><div class='card'><table>"
  "<tr><th>年</th><th>干支</th><th>岁</th><th>大运</th><th class='num'>分</th>"
  "<th class='num'>位置</th><th>档</th><th>用神</th><th>十神</th><th>冲合</th>"
  "<th>大运</th><th>神煞</th></tr>")
for y in data["years"]:
    comp = y["components"] or {}
    pct = y.get("percentile")
    pos = "—" if pct is None else (f"前{100-pct:.0f}%" if pct >= 50 else f"后{pct:.0f}%")
    A(f"<tr><td>{y['year']}</td><td class='gz'>{E(y['ganzhi'])}</td>"
      f"<td class='num'>{y['age']}</td><td>{E(y['luck'])}</td>"
      f"<td class='num {cls(y['score'])}'>{y['score']:.1f}</td>"
      f"<td class='num note'>{pos}</td><td class='note'>{E(y['band'])}</td>"
      f"<td class='num mono'>{comp.get('用神',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('十神',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('冲合',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('大运',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('神煞',0):+.1f}</td></tr>")
A("</table></div>")

# 流月
A("<h2>十一、流月（2026–2027）</h2><div class='card'><table>"
  "<tr><th>年</th><th>月</th><th class='num'>分</th><th>档</th>"
  "<th>用神</th><th>十神</th><th>冲合</th><th>大运</th></tr>")
for m in data["months"]:
    comp = m["components"] or {}
    A(f"<tr><td>{m['year']}</td><td class='gz'>{E(m['month'])}</td>"
      f"<td class='num {cls(m['score'])}'>{m['score']:.1f}</td>"
      f"<td class='note'>{E(m['band'])}</td>"
      f"<td class='num mono'>{comp.get('用神',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('十神',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('冲合',0):+.1f}</td>"
      f"<td class='num mono'>{comp.get('大运',0):+.1f}</td></tr>")
A("</table></div>")

# 八维
sc = data["scores"]
A(f"<h2>十二、整体评分（{sc['overall']} 分，分位 {sc['percentile']:.0f}，{E(sc['tier'])}）</h2>"
  "<div class='card'><table><tr><th>维度</th><th class='num'>分</th><th class='num'>权重</th><th>条形</th></tr>")
for k, v in sc["dimensions"].items():
    w = sc["weights"][k]
    zh = {"structure": "格局层次", "flow": "五行流通", "climate": "调候得宜",
          "root": "年月根基", "ming": "紫微命宫", "sanfang": "三方四正",
          "shensha": "神煞吉凶", "relations": "合冲刑害"}[k]
    A(f"<tr><td>{zh}</td><td class='num'>{v:.1f}</td><td class='num note'>{w:.2f}</td>"
      f"<td><span class='bar' style='display:block;width:180px'><i style='width:{v:.0f}%'></i></span></td></tr>")
A("</table></div>")

A("""<div class="warn"><b>免责声明：</b>AI 算命仅供自我性格观察与娱乐参考，
不构成医疗、法律、投资或任何实际决策依据。本档案中的分数是「同一张盘内排序用的尺子」，
不是事件预测——详见项目方法页的实测章节。</div>""")
A("</div></body></html>")

hp = os.path.join(OUT_DIR, "命盘全量-1993-06-14.html")
with open(hp, "w", encoding="utf-8") as f:
    f.write("".join(parts))
print("HTML ->", hp, "%.1f KB" % (os.path.getsize(hp) / 1024))
