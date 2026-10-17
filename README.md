# 命理引擎 · mingli-engine

**八字（四柱）与紫微斗数的双系统排盘与运势引擎 —— 零依赖、天文历法自算、可用真实经历反推校准。**

> English | [简体中文](README.zh-CN.md)

<p align="center">
  <a href="https://weiwei0614.github.io/bazi-ziwei/"><img alt="live demo" src="https://img.shields.io/badge/LIVE_DEMO-open_in_browser-e8a33d?style=for-the-badge"></a>
  <img alt="python" src="https://img.shields.io/badge/python-3.9%2B-3776AB?style=for-the-badge&logo=python&logoColor=white">
  <img alt="deps" src="https://img.shields.io/badge/dependencies-zero-5dcaa5?style=for-the-badge">
  <img alt="tests" src="https://img.shields.io/badge/tests-19_passing-5dcaa5?style=for-the-badge">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-a99ce8?style=for-the-badge">
</p>

![chart](docs/img/chart.png)

---

## Why this one

Most open-source Chinese astrology projects do **either** BaZi **or** Zi Wei, and stop at
drawing the chart. This one is built around three ideas the others skip:

1. **No lookup tables for the calendar.** Solar terms come from a truncated VSOP87 series
   with nutation, aberration and FK5 correction, solved by Newton iteration; new moons come
   from Meeus ch. 49. A 200-year table is a copy of somebody else's decisions — a computed
   ephemeris is an argument you can check.
2. **Two systems, one reading.** BaZi gives the element structure, Zi Wei gives the twelve
   palaces. They are scored separately and then combined, so a claim has to survive both.
3. **Back-testing against your own life.** Every other tool tells you what *will* happen.
   This one asks what *did*, compares its own past scores against your report, prints the
   hit rate and correlation, and **refits the component weights** if they disagree.

---

## Quick start

```bash
git clone https://github.com/WEIWEI0614/bazi-ziwei.git
cd bazi-ziwei

python -m mingli chart --date 1993-06-14 --time 17:31 --gender male --lon 116.65
python -m mingli year  2027 --date 1993-06-14 --time 17:31 --gender male
python -m mingli month 2027 --date 1993-06-14 --time 17:31 --gender male
python -m mingli md    --date 1993-06-14 --time 17:31 --gender male -o report.md
python -m mingli serve            # http://127.0.0.1:8788
```

No `pip install`, no virtualenv, no network. Python 3.9+ standard library only.

Browser version (same engine, ported 1:1):

```bash
cd docs && python3 -m http.server 8000     # http://127.0.0.1:8000
```

or just open the hosted demo: **https://weiwei0614.github.io/bazi-ziwei/**

---

## What it computes

| Layer | Output |
|---|---|
| **Calendar** | Apparent solar longitude (VSOP87 truncated), 24 solar terms to the second, new moons (Meeus 49), lunisolar calendar with the no-zhongqi leap rule, true solar time (longitude + equation of time) |
| **Four Pillars** | Year/month/day/hour pillars, 10 gods, hidden stems, nayin, twelve stages, void branches, seasonal state (旺相休囚死), quantitative element shares, day-master strength, structure (格局), climate god (调候), shensha, all 合/冲/刑/害/破 interactions |
| **Luck cycles** | Direction, starting age (3 days = 1 year), ten 10-year cycles, annual pillars, monthly pillars on the 12 *jie* |
| **Zi Wei** | Twelve palaces, five-element bureau, 14 majors with brightness grades, 13 auxiliaries, birth-year sihua (Sanhe **and** Feixing tables), decade limits, annual palace |
| **Scoring** | Six dimensions → overall 0-100 and tier; six life areas (career / wealth / love / health / study / network), each with its components exposed |
| **Timeline** | Per-year score with themes, cautions and openings; per-month the same, scaled |
| **Back-test** | Hit rate, Pearson correlation, ridge-refitted weights, per-event disagreement list |

![score](docs/img/score.png)
![month](docs/img/month.png)

---

## Accuracy: what was actually verified

Nothing here is asserted from memory. Two independent libraries were used as oracles and
every disagreement was chased down.

| Check | Sample | Result |
|---|---|---|
| Solar terms vs `lunar_python` | 24 terms × 13 years, 1900-2100 | max deviation **30 s**, all dates identical |
| Lunar date vs `lunar_python` | 4,008 dates × 4 times of day | 44 mismatches = **0.27 %**, all at two knife-edge new moons within seconds of midnight |
| Four pillars vs `lunar_python` | 3,000 random instants 1902-2098 | **0 errors** on year / month / day / hour |
| Zi Wei vs `iztro` | 700 charts 1920-2030 | **0 errors** on life palace, bureau, palace stems, 14 majors, 13 auxiliaries; 1 chart differs by a major star (same knife-edge) |
| Browser JS vs Python | 60 charts, 15 field groups | identical; differences only from rounding convention (±0.1) |

Two bugs found this way and worth recording, because both are common in other projects:

* **Month length must be decided at day granularity, not at the instant.** In 2025 the new
  moon falls at 14:06 on Aug 23 and 处暑 at 04:33 the same day. Comparing instants makes
  处暑 belong to the *previous* month, which pushes the leap month one slot late. The
  standard (GB/T 33661-2017) compares civil days.
* **起紫微訣 is not "always step backwards"**. The mnemonic is: advance by the quotient,
  then move *forward* by the borrow if the borrow is even, *backward* if it is odd. Getting
  this wrong shifts half of all charts by four palaces and looks plausible.

Run them yourself:

```bash
python -m unittest discover -s tests -v      # 19 tests, zero dependencies
node tools/parity.js cases.json out.json     # optional JS/Python parity harness
```

---

## Schools covered

A single "correct" answer does not exist in this field. Where schools disagree, the
difference is exposed as an option and documented, never silently averaged.

| Domain | Implemented | Notes |
|---|---|---|
| 子平格局 | month-command structure, transparent-stem priority, 建禄 / 月刃, 从格, 专旺 | `structure.name` + `structure.basis` explains the rule used |
| 调候 | 窮通寶鑑 table, 120 entries, satisfied/missing stems | alternative editions differ; table marked as 徐樂吾 注本 |
| 旺衰 | weighted stems/branches (month 24 %) × 旺相休囚死, 三合/三会 bonuses | weights are declared in code, not hidden |
| 神煞 | 天乙 / 文昌 / 驿马 / 桃花 / 华盖 / 将星 / 羊刃 / 禄 / 空亡 / 魁罡 | 十神-based, no invented stars |
| 紫微安星 | 三合派 (iztro-compatible) | verified star by star |
| 四化 | 三合派 / 中州派 (default) **and** 飛星派 | 庚、壬 two stems differ; switch with `--feixing` |
| 闰月 | split at the 15th (default) / whole month / next month | `--leap-same` for the whole-month reading |
| 换日 | 子初 (23:00, default) / 子正 (00:00) | `--zi-mid` |
| 真太阳时 | longitude + equation of time, on by default | `--no-true-solar` to disable |

---

## The back-test, and why it matters

Every fortune-telling tool is unfalsifiable by construction. This one is not, at least
locally:

```bash
cat > events.json <<'JSON'
[
  {"year": 2016, "kind": "study",  "impact":  2, "note": "left for grad school"},
  {"year": 2020, "kind": "career", "impact": -1},
  {"year": 2023, "kind": "career", "impact": -2, "note": "hardest year"},
  {"year": 2025, "kind": "career", "impact":  1}
]
JSON
python -m mingli chart --date 1993-06-14 --time 17:31 --gender male --events events.json
```

The engine re-scores those years blind, then reports:

* **hit rate** — did the sign of the score match the sign of your report,
* **Pearson r** — does the magnitude track too,
* **refitted weights** — ridge least squares on the four score components (用神 / 冲合 / 神煞 / 大运),
* **disagreements** — the specific years it got wrong, with the interaction it relied on.

If the hit rate is low the tool says so, and tells you the three things to check first
(birth time, 立春 vs lunar-new-year year boundary, non-astrological variables). A model that
can lose is worth more than one that cannot.

---

## Architecture

```
mingli/
  calendar/astro.py     Julian day, ΔT, nutation, VSOP87 sun, solar terms, new moons, EoT
  calendar/lunar.py     sui-based lunisolar calendar, five pillars
  calendar/ganzhi.py    all classical lookup tables (hidden stems, nayin, shensha, ...)
  bazi/chart.py         chart + element weighting + structure + climate + interactions
  bazi/luck.py          ten-year cycles, annual and monthly scoring
  ziwei/chart.py        full star placement (verified against iztro)
  ziwei/analysis.py     trine-and-opposite, patterns, decades, annual palace
  reading.py            overall score, life areas, back-test + calibration
  cli.py                chart / year / month / md / json / serve
web/                    index.html + app.js + engine.js + data.js   (browser build)
docs/                   published copy of web/ for GitHub Pages
tools/gen_js_data.py    emits data.js from the Python tables  <- keeps both engines honest
tools/parity.js         JS/Python field-by-field comparison
tests/                  19 unit tests, no third-party dependencies
```

`web/data.js` is **generated**, never hand-written: every table (VSOP terms, hidden stems,
nayin, 調候, brightness grades, sihua) is dumped from the Python modules by
`tools/gen_js_data.py`. That is why the two engines cannot drift apart.

---

## Limitations (read before trusting a number)

1. ΔT after ~2050 is a *prediction*; solar terms in the far future may move by tens of seconds.
2. If a new moon falls within seconds of local midnight the lunar day can be off by one
   (≈ once per 30 years; two such cases exist in 1900-2100).
3. The weighting scheme is heuristic. It is declared and testable, not derived — which is
   exactly why the back-test exists.
4. This is a structural model of tendencies, **not** a prediction of events. Nothing here
   is medical, financial or legal advice.
5. Zi Wei years use the lunar-year stem (正月初一), the classical convention; some software
   uses 立春 instead, which shifts charts born between the two dates.

---

## Contributing

The most useful contributions are *counter-examples*: a chart where a classical rule gives
a different structure, a school whose tables differ, a date where the calendar disagrees
with an official almanac. Open an issue with the input, the expected output and the source.
Please do not add stars or rules without a citation — the point of this project is that
every claim traces back to a text or an algorithm.

## License

MIT. Traditional texts referenced (《淵海子平》《窮通寶鑑》《紫微斗數全書》) are public domain.
