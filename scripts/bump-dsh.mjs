#!/usr/bin/env node
/**
 * dsh 版本升级的机械面一键化：bump 伞包精确钉 + 子包范围锚点 + 兼容清单 +
 * lockfile 重解析。语义级迁移（API 破坏面）永远是人工判断——本脚本只负责
 * 「版本号层面的全部机械动作」，跑完后按提示做 bootstrap / build / test /
 * （涉及 RPC 面或 client-ui 时）gen-typert / re-vendor。
 *
 * 用法：node scripts/bump-dsh.mjs <version | latest | next>
 *   latest/next = 读 npm dist-tags 解析；显式版本 = 直接使用（校验存在）。
 * 幂等：对已在位版本重跑是无害 no-op（重写同值 + 快速 install）。
 * 跨平台：纯 node API + 显式参数 spawn，零 shell 拼接。
 * @module dsh-tavern-fengyue/scripts/bump-dsh
 */
import { copyFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const say = (...a) => console.log('[bump-dsh]', ...a)
const fail = (m) => { console.error('[bump-dsh] ✗', m); process.exit(1) }

const arg = process.argv[2]
if (arg === undefined || arg === '') fail('用法：node scripts/bump-dsh.mjs <version | latest | next>')

/** 跨平台解析 pnpm 可执行名（win32 需要 .cmd shim，显式参数不含 shell 拼接）。 */
const pnpm = () => (process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm')

/** 解析目标版本：dist-tag 走 `pnpm view`（镜像源照常生效），显式版本验证存在。 */
function resolveTarget() {
  if (arg === 'latest' || arg === 'next') {
    const out = spawnSync(pnpm(), ['view', '@deepseek-ai/dsh', 'dist-tags', '--json'], { encoding: 'utf8' })
    if (out.status !== 0) fail(`dist-tags 读取失败：${out.stderr}`)
    const version = JSON.parse(out.stdout)[arg]
    if (typeof version !== 'string' || version === '') fail(`dist-tag ${arg} 无值`)
    return version
  }
  const out = spawnSync(pnpm(), ['view', `@deepseek-ai/dsh@${arg}`, 'version', '--json'], { encoding: 'utf8' })
  if (out.status !== 0) fail(`版本 ${arg} 不存在或 registry 不可达：${out.stderr}`)
  return JSON.parse(out.stdout)
}

const target = resolveTarget()
say(`目标版本：@deepseek-ai/dsh@${target}`)

// 1) root 伞包精确钉。
const rootManifestPath = join(REPO, 'package.json')
const rootManifest = JSON.parse(readFileSync(rootManifestPath, 'utf8'))
const before = rootManifest.devDependencies?.['@deepseek-ai/dsh']
rootManifest.devDependencies['@deepseek-ai/dsh'] = target
writeFileSync(rootManifestPath, `${JSON.stringify(rootManifest, null, 2)}\n`)
say(`root pin：${before} → ${target}`)

// 2) 子包锚点：一切 `>=0.1.x <0.2` 形态的 @deepseek-ai/dsh-* 范围重锚到目标
//    版本。范围语义保持「0.1.x 内自动收小版本」——只动锚点，不动上界。
const anchor = `>=${target} <0.2`
const rewriteAnchors = (manifestPath) => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  let touched = 0
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = manifest[section]
    if (deps === undefined) continue
    for (const name of Object.keys(deps)) {
      if (!name.startsWith('@deepseek-ai/dsh-')) continue
      if (!/^>=0\.1\.[^ ]+ <0\.2$/.test(deps[name])) continue
      if (deps[name] === anchor) continue
      deps[name] = anchor
      touched += 1
    }
  }
  if (touched > 0) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    say(`子包锚点 ${touched} 处 → ${anchor}（${manifestPath.replace(`${REPO}/`, '')}）`)
  }
}
for (const entry of readdirSync(join(REPO, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const manifestPath = join(REPO, 'packages', entry.name, 'package.json')
  try { if (statSync(manifestPath).isFile()) rewriteAnchors(manifestPath) } catch { /* 无 manifest 的目录跳过 */ }
}

// 3) 兼容清单：verified 追加（去重保序）+ bundle 镜像同步。
const compatPath = join(REPO, 'config', 'dsh-compatibility.json')
const compat = JSON.parse(readFileSync(compatPath, 'utf8'))
if (!Array.isArray(compat.verified)) fail('config/dsh-compatibility.json 缺 verified 数组')
if (!compat.verified.includes(target)) {
  compat.verified.push(target)
  writeFileSync(compatPath, `${JSON.stringify(compat, null, 2)}\n`)
  say(`verified 白名单 += ${target}`)
} else {
  say(`verified 白名单已含 ${target}`)
}
copyFileSync(compatPath, join(REPO, 'packages', 'bundle', 'dsh-compatibility.json'))
say('bundle 兼容镜像已同步')

// 4) lockfile 重解析（继承 stdio，失败即响）。
const install = spawnSync(pnpm(), ['install'], { cwd: REPO, stdio: 'inherit' })
if (install.status !== 0) fail('pnpm install 失败——检查上方输出')

say('机械面完成。后续人工步骤：')
say('  1. pnpm bootstrap        # profile 的 dsh-base/web-app 升到 verified 最新')
say('  2. pnpm build && pnpm test')
say('  3. node scripts/gen-typert.mjs <上游检出路径>   # RPC/typert 协议面变动时')
say('  4. node scripts/re-vendor.mjs <上游检出路径>    # client-ui 源码面变动时')
say('  5. 语义破坏面（open→retain 这类）按迁移笔记逐条判——脚本无法替你迁移')
