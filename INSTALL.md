# bazi-ziwei — install (Skill + MCP)

One folder, three ways in. Python 3.9+, **no dependencies** — nothing to `pip install`.

```
bazi-ziwei/
  SKILL.md          the agent skill
  mcp_server.py     MCP server (stdio, four tools)
  mingli/           the engine
  pyproject.toml
  README.md
```

---

## 1. As an agent skill

Copy this whole folder into your skills directory:

```bash
# Claude Code / Codex
cp -R bazi-ziwei ~/.claude/skills/

# WorkBuddy
cp -R bazi-ziwei ~/.workbuddy/skills/
```

Restart the client. The skill triggers on a birth date plus a question about
personality, career timing, marriage, health, a specific year, or compatibility.

## 2. As an MCP server

Add to your MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS, or the equivalent for your client):

```json
{
  "mcpServers": {
    "bazi-ziwei": {
      "command": "python3",
      "args": ["/ABSOLUTE/PATH/TO/bazi-ziwei/mcp_server.py"]
    }
  }
}
```

Use an absolute path — a relative one is resolved against the client's working
directory, not yours. If `python3` is not on the client's `PATH` (common with
nvm/pyenv), use the full interpreter path instead.

Four tools: `chart`, `annual`, `backtest`, `synastry`.

## 3. As a CLI

```bash
cd bazi-ziwei
python3 -m mingli chart --date 1993-06-14 --time 17:31 --gender male --lon 116.65
python3 -m mingli year 2028 --date 1993-06-14 --time 17:31 --gender male --lon 116.65
python3 -m mingli serve          # the web UI on localhost
```

`python -m mingli` resolves the package from the working directory, so run it
from inside the folder (or set `PYTHONPATH` to it).

---

## Check that it works

```bash
cd bazi-ziwei
python3 -m unittest discover -s tests -q        # 64 tests, no network
```

Or hand-shake the MCP server directly:

```bash
printf '%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
'{"jsonrpc":"2.0","method":"notifications/initialized"}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| python3 mcp_server.py
```

You should get two JSON lines back, the second listing the four tools.

## What it is good at, and what it is not

Worth knowing before you rely on it:

- **Exact and checkable:** the calendar (3,000 random moments against
  `lunar-python`, zero error on all four pillars), star placement (700 charts
  against `iztro`), and an audit trail behind every judgement.
- **Not validated:** the annual score. Five separate benchmarks — including a
  fitted model on the same data — put it at AUC 0.5. Treat it as a ruler for
  ranking years inside one chart, not a forecast. The README says so at length.

MIT licensed. Fork it, and change the weights — then run the benchmarks and see
whether yours do better.
