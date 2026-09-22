# Security Policy · 安全策略

Tavern Fengyue runs **fully local**: the dsh host, the web UI, the workspace files, and the saves never leave your machine — except for the LLM requests the host itself makes (to the endpoint you configure, with the key you provide).

## Scope · 范围

In scope:

- The dsh profile packages in `packages/` (engine, UI, bundle, client-runtime, api, mock) and their composition with the dsh host
- Workspace / save handling (`tavern_workspace/`, `savings/`): prompt-injection-resistant boundaries between card content and tool execution
- Anything in `bin/dev.mjs`, `scripts/`, and the tavern presets' script surface

Out of scope:

- The upstream **dsh host itself** (`@deepseek-ai/dsh` and friends) — report those in [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- Vulnerabilities in third-party cards/content you import — importing a card runs its scripts **on your machine**; treat untrusted cards like untrusted code, same as any script you'd download

## Credentials · 凭证

Your API key is stored locally by the dsh host (settings in the profile home, e.g. `~/.dsh-tavern-fengyue/`; `.env` at the repo root for dev). It is never sent anywhere but your configured LLM endpoint. **Never paste keys into issues.**

## Reporting a vulnerability · 报告漏洞

**Please use GitHub's private security advisory on this repository** (Security tab → "Report a vulnerability"), or open a regular GitHub issue **without sensitive details** asking a maintainer for a contact channel first.

Please include a description, reproduction steps, and affected versions (`git rev-parse HEAD`, dsh version, OS). We aim to respond within a week during the release-candidate phase.

**漏洞报告请通过本仓库的 GitHub 私有安全通报**(Security 页 → "Report a vulnerability"),或先提交一个不含敏感细节的 issue 向维护者索要联系渠道。说明应包含描述、复现步骤与受影响版本(`git rev-parse HEAD`、dsh 版本、操作系统)。
