#!/usr/bin/env node
/**
 * client-ui 源码快照的上游 re-vendor（0.1.7 起 vendor-ui-* 的更新通道）。
 *
 * 发布包只带 `./client` 类型面与浏览器闭包、不带 `./src/*` 源码，而
 * `packages/client-runtime`（jsdom slot 测试运行时）运行时 import client-ui
 * 源码——node 里唯一可运行的源码来源就是本仓的 vendor 快照。本脚本把上游
 * `packages/client/ui-{renderer,session}/src` 与 ui-chat 的 client 契约
 * 整目录拷回（逐字节，不打补丁——定制必须落在上游，见 CLAUDE.md 依赖侧纪律）。
 *
 * 用法：node scripts/re-vendor.mjs [上游检出路径]
 *   默认 ~/Desktop/learn_code/deepseek-harness-master。
 * 跨平台：纯 node API，零 shell 拼接。
 * @module dsh-tavern-fengyue/scripts/re-vendor
 */
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const say = (...a) => console.log('[re-vendor]', ...a)
const fail = (m) => { console.error('[re-vendor] ✗', m); process.exit(1) }

const UPSTREAM = resolve(process.argv[2] ?? join(homedir(), 'Desktop', 'learn_code', 'deepseek-harness-master'))

/** 上游目录 → 本仓目录的整树替换；拷前校验双方存在。 */
const mirrors = [
  { from: join(UPSTREAM, 'packages', 'client', 'ui-renderer', 'src'), to: join(REPO, 'packages', 'vendor-ui-renderer', 'src') },
  { from: join(UPSTREAM, 'packages', 'client', 'ui-session', 'src'), to: join(REPO, 'packages', 'vendor-ui-session', 'src') },
  { from: join(UPSTREAM, 'packages', 'client', 'ui-chat', 'src', 'client', 'contract'), to: join(REPO, 'packages', 'vendor-ui-chat', 'client', 'contract') },
]
for (const { from, to } of mirrors) {
  if (!existsSync(from)) fail(`上游缺 ${from}`)
  if (!existsSync(dirname(to))) fail(`本仓缺 ${dirname(to)}——vendor 包结构变了，本脚本需跟进`)
}

// 版本对齐提示：上游 package.json 版本 vs 本仓宿主。
const upstreamVersion = JSON.parse(readFileSync(join(UPSTREAM, 'package.json'), 'utf8')).version
const hostVersion = JSON.parse(readFileSync(join(REPO, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8')).version
if (upstreamVersion !== hostVersion) {
  say(`⚠ 上游 ${upstreamVersion} ≠ 本仓宿主 ${hostVersion}——快照与类型面可能错配`)
}

for (const { from, to } of mirrors) {
  rmSync(to, { recursive: true, force: true })
  cpSync(from, to, { recursive: true })
  say(`已同步 ${from.replace(UPSTREAM, '<upstream>')} → ${to.replace(REPO, '')}`)
}

// 拷后体检：exports 指到的入口文件必须真实存在（0.1.5→0.1.7 曾有 .tsx→.ts 的
// 扩展名漂移，exports 指到不存在文件时解析静默落到坏处）。
const checkExport = (manifestPath, subpath) => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const target = manifest.exports?.[subpath]
  if (typeof target !== 'string') return
  const file = join(dirname(manifestPath), target)
  if (!existsSync(file)) fail(`${manifestPath.replace(REPO, '')} exports["${subpath}"] 指向不存在的 ${target}——改 exports 扩展名`)
}
checkExport(join(REPO, 'packages', 'vendor-ui-renderer', 'package.json'), './client')
checkExport(join(REPO, 'packages', 'vendor-ui-session', 'package.json'), './client')

say('完成。后续：pnpm typecheck && pnpm test；vendor 包的 devDeps 锚点若落后一并用 bump-dsh 对齐')
