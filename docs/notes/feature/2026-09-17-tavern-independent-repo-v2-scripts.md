# Agent Note: Tavern independent repo + card-script contract v2 (.mjs) + repo-wide cross-platform

Status: implemented

English | [中文](2026-09-17-tavern-independent-repo-v2-scripts.zh.md)

Date: 2026-09-17 · Surface: repo-wide (engine / api / ui / bundle / scripts / tests)

## Background

Card script v1 = bash texts (`.sh`) executed as `bash "path" 'args'` through the host shell seam — the engine hard-coded bash, leaving Windows with no usable execution face; quote-escaping bash from the write-card agent was a classic LLM failure mode. A repo-wide cross-platform re-audit also surfaced the spawn EINVAL face (`.cmd` shims), Windows `URL.pathname` leading slashes, and CRLF-corrupted external formats.

## Decisions

1. **Card-script contract v2**: a card script is a node module (`.mjs`), executed as
   `node -e '<decoder>' -- <base64 script> <base64 args payload>`
   — the decoder injects the decoded payload as global `argv` (JSON) with `args` as an alias (both naming styles work); the line contains **zero single quotes** (byte-identical on every shell face). The schema declaration moves from line comments to a leading block-comment JSON (`/** @tavern-schema … */`), parsed by marker + `*/` boundary (a `$`-anchored regex would sail past the close — real bug caught during this work).
2. **`.sh` 全部退役**：模板/ fixtures 的 bash 卡脚本按行为等价改写 `.mjs`（get_weather / get_turn / roll / get_state）；ST 导入器生成物 persona/lorebook.mjs 同步；`tavern_presets` 里 DND 186 行 roll.sh 结算器忠实转译（含 rolls.log 流水、crit-pending 翻倍链、DC 标尺、成长分支）。
3. **Write-card agent guide synced**: writer-guide.md sections rewritten to the node runner contract (args/argv decoded upfront — do not re-decode; existsSync degrade; multi-line output via log/join).

## Code

- `packages/engine/src/tools.ts`: `NODE_RUNNER` + `cardScriptCommand(scriptText, argsPayloadJson)`; the schema parser uses the marker + `*/` boundary.
- `packages/engine/src/prompting.ts`: placeholders and `runCardScript` share the same v2 channel (cwd = `runtime/` preserved).
- `packages/ui/src/client/st-import.ts`: generates persona/lorebook `.mjs` (lorebook scan in pure JS, dropping the jq dependency).
- Assets: template / fixture / `tavern_presets` `.sh` scripts all ported to `.mjs`; originals removed.

## Cross-platform close-out (same batch)

- dev.mjs: pure-Node pidAlive/stop (`process.kill(0)`, SIGTERM, Atomics sync sleep); bootstrap's pnpm install goes through the host CLI invoked by node (bypassing the Windows `.cmd` spawn EINVAL); `start` runs the host in the FOREGROUND (Ctrl-C ends it, `--bg` keeps the detached form).
- setup.mjs (bundle bin): the win32 dsh probe / pnpm install take shell-form commands; LOCAL link targets slash-normalized.
- cleanup: `node scripts/cleanup.mjs` (netstat+taskkill / lsof+pkill dual paths); the sh version retired into it.
- vitest dropped the win32 bash gate: the v2 card-script execution path is all node, so tests have no platform fork.
- `.gitattributes`: `*.sh` / `.mjs` / `.ps1` forced LF — a CRLF checkout breaks the bash-shebang contract of legacy card scripts.

## Known edges

- A v1 bash card brought in from outside needs a manual port to `.mjs` (thin runner contract: `args` global + stdout-as-reply).
- The win32 shell surfaces of `setup.mjs` are untested on a real Windows machine; Linux is same-family but has also not run the full gate.
