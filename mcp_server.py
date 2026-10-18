#!/usr/bin/env python3
"""Minimal stdio MCP server for the mingli engine — no dependencies.

Speaks JSON-RPC 2.0 over stdin/stdout, newline-delimited, which is what the
Model Context Protocol stdio transport expects. Written by hand so that
`python mcp_server.py` works without `pip install mcp`.

    {"mcpServers": {"bazi-ziwei": {"command": "python",
      "args": ["/abs/path/to/mcp_server.py"]}}}

Four tools are exposed: chart, annual, backtest, synastry. Each returns a
compact text report rather than raw JSON — the caller is a language model, and
a 40 KB object costs it more than it learns.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from mingli.reading import build_reading          # noqa: E402
from mingli import gua as gua_mod                   # noqa: E402
from mingli.synastry import RELATIONS as SYNASTRY_RELATIONS  # noqa: E402
from mingli.synastry import compare as syn_compare  # noqa: E402

PROTOCOL = "2024-11-05"
SERVER = {"name": "bazi-ziwei", "version": "0.2.0"}

BIRTH_SCHEMA = {
    "type": "object",
    "properties": {
        "year": {"type": "integer", "description": "Gregorian year, e.g. 1993"},
        "month": {"type": "integer", "description": "Gregorian month 1-12"},
        "day": {"type": "integer", "description": "Gregorian day"},
        "hour": {"type": "integer", "description": "Hour 0-23 in the given timezone"},
        "minute": {"type": "integer", "description": "Minute 0-59"},
        "gender": {"type": "string", "enum": ["male", "female"]},
        "longitude": {"type": "number",
                      "description": "Birth longitude in degrees east; drives true solar time. Beijing 116.4, Shanghai 121.47, Chengdu 104.07, Urumqi 87.6"},
        "tz_offset": {"type": "number", "description": "UTC offset in hours, default 8"},
        "true_solar": {"type": "boolean", "description": "Apply true solar time correction, default true"},
        "name": {"type": "string"},
    },
    "required": ["year", "month", "day"],
}

TOOLS = [
    {
        "name": "chart",
        "description": (
            "Cast a full BaZi (Four Pillars) + Zi Wei Dou Shu chart for a birth moment and return "
            "the grade audit (成格/破格/救应), the seven-dimension strength score, element shares, "
            "useful elements, 45 shensha, the twelve Zi Wei palaces, and the current ten-year cycle. "
            "Use whenever the user supplies a birth date and asks about their chart, structure, "
            "personality, or life direction."
        ),
        "inputSchema": BIRTH_SCHEMA,
    },
    {
        "name": "annual",
        "description": (
            "Score the annual (流年) and monthly (流月) fortunes of a chart, with the components "
            "broken out (favourable elements, ten gods, clashes, decade tone). Use for questions "
            "like 'is next year good for a job change' or 'which year should I be careful'."
        ),
        "inputSchema": {
            "type": "object",
            "properties": dict(BIRTH_SCHEMA["properties"], **{
                "from_year": {"type": "integer", "description": "First year to score"},
                "years": {"type": "integer", "description": "How many years, default 8"},
                "monthly_year": {"type": "integer", "description": "Also score the twelve months of this year"},
            }),
            "required": ["year", "month", "day"],
        },
    },
    {
        "name": "backtest",
        "description": (
            "Back-test the engine against the user's real life. Give a birth moment plus a list of "
            "years with what actually happened and a -3..+3 impact, and get back the hit rate, the "
            "Pearson correlation, the years the model got wrong, and ridge-refitted component "
            "weights. Use this before giving advice, so the reading is calibrated rather than asserted."
        ),
        "inputSchema": {
            "type": "object",
            "properties": dict(BIRTH_SCHEMA["properties"], **{
                "events": {
                    "type": "array",
                    "description": "Real events, at least 3 for a meaningful correlation",
                    "items": {
                        "type": "object",
                        "properties": {
                            "year": {"type": "integer"},
                            "kind": {"type": "string",
                                     "enum": ["career", "study", "love", "money", "health", "family", "move"]},
                            "impact": {"type": "integer",
                                       "description": "-3 disaster .. +3 excellent, 0 neutral"},
                            "note": {"type": "string"},
                        },
                        "required": ["year", "impact"],
                    },
                },
            }),
            "required": ["year", "month", "day", "events"],
        },
    },
    {
        "name": "synastry",
        "description": (
            "Compare two charts for compatibility across six weighted layers (day master, spouse "
            "palace, element complement, useful-god exchange, Zi Wei feel, relationship stars). "
            "Use for romance, marriage, business partnership, parent-child or manager-report questions."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "a": BIRTH_SCHEMA,
                "b": BIRTH_SCHEMA,
                "relation": {"type": "string",
                             "enum": ["couple", "romance", "friend", "partner", "parent", "boss"],
                             "description": "Default couple"},
            },
            "required": ["a", "b"],
        },
    },
]


def _birth(args: dict) -> dict:
    """Validate before computing: a caller that gets back `KeyError: 'year'`
    has learned nothing, and an LLM caller will simply retry the same call."""
    missing = [k for k in ("year", "month", "day") if k not in args]
    if missing:
        raise ValueError("missing required field(s): " + ", ".join(missing)
                         + ". Need year, month, day; hour and longitude are optional.")
    try:
        y, mo, d = int(args["year"]), int(args["month"]), int(args["day"])
        hh, mi = int(args.get("hour", 12)), int(args.get("minute", 0))
    except (TypeError, ValueError):
        raise ValueError("year, month, day, hour and minute must be whole numbers")
    try:
        _dt.date(y, mo, d)
    except ValueError as exc:
        raise ValueError(f"{y}-{mo}-{d} is not a valid date ({exc})")
    if not 1900 <= y <= 2100:
        # 提示而非拒绝：远期仍可算，但节气与朔望会漂
        pass
    if not (0 <= hh <= 23 and 0 <= mi <= 59):
        raise ValueError(f"time {hh:02d}:{mi:02d} is out of range")
    gender = args.get("gender", "male")
    if gender not in ("male", "female"):
        raise ValueError("gender must be 'male' or 'female'")
    return {
        "name": args.get("name", ""),
        "gender": gender,
        "year": y, "month": mo, "day": d,
        "hour": hh, "minute": mi,
        "longitude": float(args.get("longitude", 116.40)),
        "tz_offset": float(args.get("tz_offset", 8.0)),
        "use_true_solar": bool(args.get("true_solar", True)),
    }


def _reading(args: dict, events=None) -> "object":
    b = _birth(args)
    return build_reading(b["name"], b["gender"], b["year"], b["month"], b["day"],
                         b["hour"], b["minute"], b["longitude"], b["tz_offset"],
                         b["use_true_solar"], "zi_start", "sanhe", "split",
                         args.get("focus_year"), events)


def tool_chart(args: dict) -> str:
    r = _reading(args)
    c, z, g = r.chart, r.ziwei, r.grade
    bz, zw = g.get("bazi", {}), g.get("ziwei", {})
    ue = _useful(c)
    out = [
        f"# {c.name or 'Chart'} · {c.gender}",
        "",
        f"True solar time: {c.true_solar:%Y-%m-%d %H:%M}  ·  lunar {c.lunar_date.month}/{c.lunar_date.day}"
        + (" (leap)" if c.lunar_date.is_leap else ""),
        "",
        f"## Four pillars",
        "   ".join(f"{p.gan}{p.zhi}" for p in c.pillars),
        "   ".join(f"{p.shishen_gan}/{p.shishen_zhi}" for p in c.pillars),
        "",
        f"Day master {c.day_master}{c.day_master_wx} — {c.strength_label} ({c.strength:.1f}% allies)",
        f"Structure: {c.structure['name']} — {c.structure['basis']}",
        f"Climate god: {c.tiaohou.get('sequence') or '—'}  (present {''.join(c.tiaohou.get('satisfied') or []) or 'none'},"
        f" missing {''.join(c.tiaohou.get('missing') or []) or 'none'})",
        f"Favourable {''.join(ue[0])} · avoid {''.join(ue[1])}",
        "",
        "## Element shares",
        "  ".join(f"{k} {v:.1f}%" for k, v in c.element_scores.items()),
        "",
        f"## Grade (rank): {g.get('grade')} {g.get('score')}",
        f"  BaZi {bz.get('grade')} {bz.get('score')} — setup {bz.get('setup_score')}/{bz.get('setup_max')},"
        f" breaks −{bz.get('broken')}, rescues +{bz.get('rescued')}",
        f"  Zi Wei {zw.get('grade')} {zw.get('score')}",
    ]
    for i in (bz.get("items") or []):
        if i.get("ok") and i.get("kind") in ("break", "rescue"):
            out.append(f"    [{i['kind']}] {i['name']} — {i['note']}")
    out += [
        "",
        f"## Strength (seven dimensions): {r.scores['overall']} · above {r.scores['percentile']}% of sampled charts",
        "  " + "  ".join(f"{k} {v}" for k, v in r.scores["dimensions"].items()),
        "",
        "## Shensha (45)",
    ]
    groups = {"吉": [], "中": [], "凶": []}
    for k, v in c.shensha.items():
        groups[v["nature"]].append(f"{k}({'/'.join(v['positions'])})")
    for nat, label in (("吉", "auspicious"), ("中", "neutral"), ("凶", "inauspicious")):
        if groups[nat]:
            out.append(f"  {label}: {'、'.join(groups[nat])}")
    out += [
        "",
        f"## Zi Wei — life palace {z.ming_branch}, body {z.shen_branch}, bureau {z.ju}",
        f"  rulers {z.ming_zhu} / {z.shen_zhu} · sihua " +
        " ".join(f"{k}→{v}" for k, v in z.sihua.items()),
    ]
    for p in z.palaces:
        maj = " ".join(f"{s.name}{'(' + s.brightness + ')' if s.brightness else ''}"
                       f"{'化' + s.hua if s.hua else ''}"
                       for s in p.stars if s.kind == "主星") or "—"
        out.append(f"  {p.gan}{p.branch} {p.name:<3} [{p.decade[0]}-{p.decade[1]}] {maj}")
    cyc = next((x for x in r.cycles if x.active), r.cycles[0] if r.cycles else None)
    if cyc:
        out += ["", f"## Current decade: {cyc.label} {cyc.start_age}-{cyc.end_age} "
                    f"({cyc.start_year}-{cyc.end_year})"]
    return "\n".join(out)


def _useful(chart):
    from mingli.bazi.luck import useful_elements
    u = useful_elements(chart)
    return u[0], u[1]


def tool_annual(args: dict) -> str:
    r = _reading(args)
    cyc = next((x for x in r.cycles if x.active), None)
    start = int(args.get("from_year", 2026))
    n = int(args.get("years", 8))
    out = [f"# Annual scores {start}-{start + n - 1}",
           f"Decade: {cyc.label if cyc else '—'}"]
    for t in r.timeline:
        if not (start <= int(t["name"]) < start + n):
            continue
        out.append(f"\n{t['name']} {t['label']} ({t['shishen_gan']}/{t['shishen_zhi']}) "
                   f"{t['score']} — {t['band']}")
        comp = t.get("components") or {}
        out.append("  " + "  ".join(f"{k} {v}" for k, v in comp.items()
                                    if k not in ("base", "raw")))
        if t.get("themes"):
            out.append(f"  themes: {' · '.join(t['themes'][:4])}")
        if t.get("cautions"):
            out.append(f"  watch: {'; '.join(map(str, t['cautions'][:2]))}")
        if t.get("opportunities"):
            out.append(f"  open: {'; '.join(map(str, t['opportunities'][:2]))}")
    my = args.get("monthly_year")
    if my:
        months = [m for m in r.months if str(m.name).startswith(str(my))]
        if months:
            out.append(f"\n## Months of {my}")
            for m in months:
                out.append(f"  {m.name} {m.label} {m.score} {m.band}")
    return "\n".join(out)


def tool_backtest(args: dict) -> str:
    ev = []
    for e in args.get("events") or []:
        ev.append({"year": int(e["year"]), "kind": e.get("kind", "career"),
                   "impact": int(e.get("impact", 0)), "note": e.get("note", "")})
    r = _reading(args, events=ev)
    ev_r = r.events
    out = [
        f"# Back-test on {ev_r.get('n')} events",
        f"Hit rate {ev_r.get('hit_rate')}%  ·  Pearson {ev_r.get('correlation')}"
        f"  ·  calibrated {ev_r.get('calibrated_correlation')}",
        f"Verdict: {ev_r.get('verdict')}",
        "",
        "| year | pillar | impact | predicted | calibrated | agree |",
        "|---|---|---|---|---|---|",
    ]
    for row in ev_r.get("rows") or []:
        out.append(f"| {row['year']} | {row['ganzhi']} | {row['impact']:+.0f} | "
                   f"{row['predicted']} | {row['calibrated']} | {'yes' if row['agree'] else 'NO'} |")
    w = ev_r.get("weights") or {}
    if w:
        # 样本少于六个时岭回归退化成先验，四个成分会一起显示 +1.00 —
        # 这会让读者误以为「权重被重新拟合过」，必须说清楚。
        flat = all(abs(v - 1.0) < 1e-6 for v in w.values())
        if flat and int(ev_r.get("n") or 0) < 6:
            out += ["", "Weights left at prior — fewer than six events, nothing to refit yet."]
        else:
            out += ["", "Refitted weights: " + "  ".join(f"{k} {v:+.2f}" for k, v in w.items())]
    if ev_r.get("misses"):
        yrs = [m.get("year") if isinstance(m, dict) else m for m in ev_r["misses"]]
        out += ["", "Years the model got wrong: " + ", ".join(str(y) for y in yrs)]
    return "\n".join(out)


def _pair(args: dict) -> tuple[dict, dict]:
    """Pull the two births out of `{a: {...}, b: {...}}`.

    Callers that flatten the two sides into one object get a sentence telling
    them the shape, not `KeyError: 'a'` — an LLM caller cannot act on a bare
    KeyError, it can act on "wrap each side under a and b".
    """
    missing = [k for k in ("a", "b") if not isinstance(args.get(k), dict)]
    if missing:
        raise ValueError(
            "synastry needs both births nested, as {\"a\": {...}, \"b\": {...}}; "
            f"missing or not an object: {', '.join(missing)}. "
            "Each side needs year, month, day; gender, hour and longitude are optional."
        )
    return args["a"], args["b"]


def tool_synastry(args: dict) -> str:
    aa, bb = _pair(args)
    a, b = _birth(aa), _birth(bb)
    rel = args.get("relation", "couple")
    if rel not in SYNASTRY_RELATIONS:
        raise ValueError(f"unknown relation {rel!r}; choose from "
                         + ", ".join(sorted(SYNASTRY_RELATIONS)))
    ra = _reading(aa)
    rb = _reading(bb)
    res = syn_compare(ra.chart, rb.chart, rel, ra.ziwei, rb.ziwei)
    out = [f"# Synastry — {res.get('relationZh')} · {res.get('score')} ({res.get('band')})",
           f"A {res['a']['four']} ({res['a']['dm']})  ·  B {res['b']['four']} ({res['b']['dm']})", ""]
    for item in res.get("items") or []:
        out.append(f"## {item['zh']} — {item['score']}  (weight {res['weights'].get(item['key'], 0):.0%})")
        for nt in item.get("notes") or []:
            out.append(f"  · {nt['note']}")
        out.append("")
    return "\n".join(out)


HANDLERS = {
    "chart": tool_chart,
    "annual": tool_annual,
    "backtest": tool_backtest,
    "synastry": tool_synastry,
}


def _ok(req_id, result):
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _err(req_id, code, message):
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def handle(msg: dict):
    method = msg.get("method")
    req_id = msg.get("id")
    params = msg.get("params") or {}

    if method == "initialize":
        return _ok(req_id, {"protocolVersion": PROTOCOL,
                            "capabilities": {"tools": {}},
                            "serverInfo": SERVER})
    if method in ("notifications/initialized", "initialized", "notifications/cancelled"):
        return None
    if method == "ping":
        return _ok(req_id, {})
    if method == "tools/list":
        return _ok(req_id, {"tools": TOOLS})
    if method == "tools/call":
        name = params.get("name")
        fn = HANDLERS.get(name)
        if not fn:
            return _err(req_id, -32602, f"unknown tool: {name}")
        try:
            text = fn(params.get("arguments") or {})
            return _ok(req_id, {"content": [{"type": "text", "text": text}], "isError": False})
        except ValueError as exc:
            # 参数问题只需原文，加个 ValueError: 前缀只是噪音
            return _ok(req_id, {"content": [{"type": "text", "text": str(exc)}],
                                "isError": True})
        except Exception as exc:                        # noqa: BLE001
            return _ok(req_id, {"content": [{"type": "text",
                                             "text": f"{type(exc).__name__}: {exc}"}],
                                "isError": True})
    return _err(req_id, -32601, f"method not found: {method}")


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            sys.stdout.write(json.dumps(_err(None, -32700, "parse error")) + "\n")
            sys.stdout.flush()
            continue
        resp = handle(msg)
        if resp is not None:
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
