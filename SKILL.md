---
name: bazi-ziwei
description: Cast and interpret BaZi (Four Pillars) and Zi Wei Dou Shu charts together, then back-test the reading against the user's real life before giving advice. Use when the user supplies a birth date and asks about personality, career timing, wealth, marriage, health, a specific year's fortune, or compatibility between two people; also use when asked to verify or sanity-check an astrology reading.
---

# BaZi + Zi Wei, with a back-test

Two Chinese systems that are usually sold separately, here cast from the same
birth moment and cross-checked against each other. The point is not more
prediction — it is a reading that can be shown to be wrong.

## Why this one

Every other tool tells the user what will happen. This one will, on request,
compare its own past scores against what actually happened, print the hit rate
and the years it got wrong, and refit its weights if they disagree.

**Do the back-test before giving advice.** A reading the user helped calibrate
is worth far more than a confident one they cannot check.

## Run it

Two entry points, same engine, no dependencies.

```bash
# CLI
python -m mingli chart --date 1993-06-14 --time 17:31 --gender male --lon 116.65
python -m mingli month 2027 --date ... --events events.json

# MCP (add to your client config)
{"mcpServers": {"bazi-ziwei": {
  "command": "python",
  "args": ["/absolute/path/to/bazi-ziwei-engine/mcp_server.py"]}}}
```

MCP tools:

| tool | use for |
|---|---|
| `chart` | full chart, grade audit, element shares, shensha, twelve palaces |
| `annual` | year-by-year and month-by-month scores with components |
| `backtest` | hit rate, Pearson, misses, refitted weights |
| `synastry` | two charts, six relationship types |

## Workflow

1. **Get an exact birth moment.** Date, clock time, and birthplace. Ask for the
   city if the timezone or longitude is unclear — true solar time can shift the
   hour pillar by up to two hours across China, and that changes the chart.
2. **Cast `chart` first.** Read the four pillars, the structure, and the grade
   audit. Note whether the grade is upper/middle/low and which conditions are
   broken or rescued.
3. **If the user offers any real events, run `backtest` before interpreting.**
   Ask for at least three years with what happened and roughly how good or bad
   it was (−3 to +3). Then quote the hit rate, and quote the misses.
4. **Interpret, citing the chart.** Every claim should trace to a stem, a god,
   a palace or a clash. If you cannot name the evidence, do not make the claim.
5. **For timing questions, use `annual`.** Say which components drive the score
   rather than only the number.

## Reading conventions

- **Grade and strength are two different numbers, never average them.** The
  grade (上格/中格/下格) judges whether the structure holds — setup conditions,
  what breaks it, what rescues it. Strength is a seven-dimension weighted score
  of raw force. A "following" structure can be physically weak and still
  upper-grade; a strong chart can be structurally low. Averaging the two is the
  most common error in this field.
- **Rescues count for more than breaks.** A chart with a flaw and a remedy is
  ranked above one that is merely unblemished.
- **Shensha never outrank the five elements.** They are texture, not verdict.
- **Annual scores are tendencies on a 40–88 scale, not verdicts.** Never present
  a year as determined, and never quote a single number without its components.

## Guardrails

- No medical, legal or investment determination. Describe tendencies and
  timing; do not diagnose or advise on specific transactions.
- Say "uncertain" when the chart is ambiguous rather than filling the gap.
  Ambiguity is common and admitting it is part of the method.
- Never claim the engine is validated beyond what it measured: it was checked
  against reference implementations for *calculation*, and against the user's
  own report for *judgement*. Those are different claims.
- Do not read a chart for a third party who has not consented to having their
  birth data analysed.

## Output shape

Lead with the structural finding, then the evidence, then the timing, then what
would change the conclusion. Keep it under 400 words unless asked to expand.
The demo at https://weiwei0614.github.io/bazi-ziwei-engine/ shows the intended
density — charts, not paragraphs of mysticism.
