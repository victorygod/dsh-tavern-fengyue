#!/usr/bin/env node
/**
 * typert 生成物的仓内重生成（REGENERATE.md 流程的脚本化）。
 *
 * 生成器只在「protocol 属于同 workspace」时承认 @Remote——临时把上游 protocol
 * 源码 vendor 进 workspace + 接线 paths/host 引用，跑一次 0.1.7 生成器把
 * `packages/api/lib/typert.{host,remote-client}.{js,d.ts}` 四件写回，然后
 * 全部接线原样回退（diff 干净）。`checkDiagnostics: false`：生成器自带的
 * tsc 诊断对 ctx 服务增强与嵌套 cordis 会误报；面正确性由 `pnpm typecheck`
 * 独立背书。
 *
 * 用法：node scripts/gen-typert.mjs [上游检出路径]
 *   默认 ~/Desktop/learn_code/deepseek-harness-master；上游 generator 版本
 *   与本仓宿主版本不一致时警告（生成物烙着生成器的协议版本）。
 * 跨平台：纯 node API，零 shell 拼接。
 * @module dsh-tavern-fengyue/scripts/gen-typert
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const say = (...a) => console.log('[gen-typert]', ...a)
const fail = (m) => { console.error('[gen-typert] ✗', m); process.exit(1) }

const UPSTREAM = resolve(process.argv[2] ?? join(homedir(), 'Desktop', 'learn_code', 'deepseek-harness-master'))
const PROTOCOL_SRC = join(UPSTREAM, 'packages', 'typert', 'protocol', 'src')
const GENERATOR_SRC = join(UPSTREAM, 'packages', 'typert', 'generator', 'src')
for (const dir of [PROTOCOL_SRC, GENERATOR_SRC]) {
  if (!existsSync(dir)) fail(`上游缺 ${dir}——检查检出路径与版本`)
}

// 版本对齐警告：生成器协议版本应与本仓宿主一致。
const upstreamGenVersion = JSON.parse(readFileSync(join(UPSTREAM, 'packages', 'typert', 'generator', 'package.json'), 'utf8')).version
const hostVersion = JSON.parse(readFileSync(join(REPO, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8')).version
if (upstreamGenVersion !== hostVersion) {
  say(`⚠ 上游 generator ${upstreamGenVersion} ≠ 本仓宿主 ${hostVersion}——产物协议版本可能错配，先对齐再发布`)
}

/** 与 build 无关的临时接线，全部在 finally 里还原。 */
const WIRING = [
  { path: join(REPO, 'tsconfig.host.json'), kind: 'jsonc-host' },
  { path: join(REPO, 'tsconfig.base.json'), kind: 'jsonc-paths' },
]
const originals = new Map(WIRING.map(w => [w.path, readFileSync(w.path, 'utf8')]))
const PROTOCOL_DIR = join(REPO, 'packages', 'typert-protocol')
const GEN_DIR = join(REPO, '.tmp-typert-gen')

const writeOnce = (path, text) => { if (readFileSync(path, 'utf8') !== text) writeFileSync(path, text) }

try {
  // 1) vendor protocol 源码（包名必须恰为 @deepseek-ai/dsh-typert-protocol，
  //    生成器按注册名识别；deps 用已发布的 dsh-brand 承接类型）。
  rmSync(PROTOCOL_DIR, { recursive: true, force: true })
  mkdirSync(join(PROTOCOL_DIR, 'src'), { recursive: true })
  cpSync(PROTOCOL_SRC, join(PROTOCOL_DIR, 'src'), { recursive: true })
  writeFileSync(join(PROTOCOL_DIR, 'package.json'), `${JSON.stringify({
    name: '@deepseek-ai/dsh-typert-protocol',
    version: upstreamGenVersion,
    private: true,
    type: 'module',
    exports: { '.': './src/index.ts', './src/*': './src/*', './types': './src/types.ts', './package.json': './package.json' },
    dependencies: { '@deepseek-ai/dsh-brand': `>=${hostVersion} <0.2` },
  }, null, 2)}\n`)
  writeFileSync(join(PROTOCOL_DIR, 'tsconfig.json'), `${JSON.stringify({
    extends: '../../tsconfig.base.json',
    compilerOptions: { rootDir: 'src', outDir: 'lib/types' },
    include: ['src'],
  }, null, 2)}\n`)
  say('protocol 源码已 vendor（packages/typert-protocol）')

  // 2) 拷生成器源码（tsx 直跑，免去上游 build；typescript/gen-mapping 走本仓依赖）。
  rmSync(GEN_DIR, { recursive: true, force: true })
  mkdirSync(GEN_DIR, { recursive: true })
  for (const file of readdirSync(GENERATOR_SRC)) cpSync(join(GENERATOR_SRC, file), join(GEN_DIR, file))
  say('generator 源码已就位（.tmp-typert-gen）')

  // 3) 接线：host 引用（并 extends base 使 paths 生效——否则 Remote 解析到
  //    node_modules 的发布 d.ts、invocations 恒 0）+ base paths 键。
  const hostPath = join(REPO, 'tsconfig.host.json')
  const host = JSON.parse(originals.get(hostPath))
  host.extends = './tsconfig.base.json'
  const hostRefs = host.references.map(r => r.path)
  if (!hostRefs.includes('./packages/typert-protocol')) host.references.push({ path: './packages/typert-protocol' })
  writeOnce(hostPath, `${JSON.stringify(host, null, 2)}\n`)

  const basePath = join(REPO, 'tsconfig.base.json')
  const baseText = originals.get(basePath)
  const pathsKey = '"@deepseek-ai/dsh-typert-protocol"'
  if (!baseText.includes(pathsKey)) {
    const anchor = '"dsh-tavern-fengyue-api"'
    const at = baseText.indexOf(anchor)
    if (at < 0) fail('tsconfig.base.json 找不到 paths 注入锚点')
    const lineStart = baseText.lastIndexOf('\n', at) + 1
    const indent = /^\s*/.exec(baseText.slice(lineStart))?.[0] ?? '      '
    const insert = `${pathsKey}: ["./packages/typert-protocol/src/index.ts"],\n${indent}`
    writeOnce(basePath, baseText.slice(0, lineStart) + insert + baseText.slice(lineStart))
  }
  say('tsconfig 接线完成（host extends+reference / base paths）')

  // 4) 生成并写回四件。
  const driver = join(GEN_DIR, 'run-gen.mts')
  writeFileSync(driver, [
    "import { WorkspaceTypertGenerator } from './workspace.ts'",
    "import { writeFileSync } from 'node:fs'",
    "import { join } from 'node:path'",
    "const g = new WorkspaceTypertGenerator(process.cwd(), { checkDiagnostics: false })",
    "const [r] = g.generate(['dsh-tavern-fengyue-api'])",
    "if (r === undefined) throw new Error('generator produced no artifact for dsh-tavern-fengyue-api')",
    "const lib = join(process.cwd(), 'packages', 'api', 'lib')",
    "const out = { 'typert.host.js': r.js, 'typert.host.d.ts': r.dts, 'typert.remote-client.js': r.remote.js, 'typert.remote-client.d.ts': r.remote.dts }",
    "for (const [name, text] of Object.entries(out)) { writeFileSync(join(lib, name), text); console.log('WROTE', name, text.length) }",
  ].join('\n'))
  const run = spawnSync(process.execPath, ['--import', 'tsx', driver], { cwd: REPO, encoding: 'utf8' })
  if (run.status !== 0) fail(`生成失败：\n${run.stdout}\n${run.stderr}`)
  say(run.stdout.trim())
} finally {
  // 5) 一切临时件还原：接线按内存原文回写，vendor/生成器目录删除。
  for (const [path, text] of originals) writeFileSync(path, text)
  rmSync(PROTOCOL_DIR, { recursive: true, force: true })
  rmSync(GEN_DIR, { recursive: true, force: true })
  say('临时接线与目录已全部回退')
}
say('完成。后续：pnpm typecheck && pnpm test（wire-face conforms 断言与产物互证）')
