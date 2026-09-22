import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/**
 * pnpm 隔离下,内核包(dsh-client-ui-primitives 等)经 .pnpm 真实路径解析,看不到根提升的
 * 传递性依赖(kernel 自己的 dependencies 声明为空,却 import 了 anser/clsx/katex/mdast 全家)。
 * 配置期扫描内核 lib 的裸导入,凡根 node_modules 有实体的就别名列到根——kernel 零接触,
 * 新增依赖自动纳入,不再逐个 whack-a-mole。
 */
function kernelPeerAliases(): { find: RegExp; replacement: string }[] {
  try {
    const root = fileURLToPath(new URL('./node_modules/', import.meta.url))
    const src = existsSync(new URL('./node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js', import.meta.url))
      ? fileURLToPath(new URL('./node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js', import.meta.url))
      : return0()
    const bare = new Set(
      Array.from(src.matchAll(/from\s*"([^".][^"]*)"/g), m => m[1])
        .map(id => id.startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0]),
    )
    return Array.from(bare).sort()
      .filter(id => existsSync(new URL(`./node_modules/${id}/package.json`, import.meta.url)))
      .map(id => ({
        find: new RegExp(`^${id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|/)`),
        replacement: `${root}${id}/`,
      }))
    function return0(): string { return '' }
  } catch { return [] }
}

export const vitestAlias = kernelPeerAliases()

/**
 * Worker arguments that keep process-wide Web Storage from shadowing jsdom storage.
 * Node lists the positive spelling in `allowedNodeEnvironmentFlags` for this negatable flag.
 */
export const vitestExecArgv = process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : []

/**
 * Transform standard TypeScript decorators before Vite's default parser sees source files.
 * Snapshot from deepseek-harness `tavern-extraction-2026-09-17` (078257c), vitest.shared.ts.
 * @returns a pre-transform Vite plugin shared by source-mode test configurations.
 */
export function standardDecoratorPlugin() {
  return {
    name: 'dsh-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText
          .replace(
            /^(\s*)(__esDecorate\()/gmu,
            '$1/* v8 ignore next -- compiler-synthetic decorator accessors have no source behavior */ $2',
          )
          .replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}
