import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import { standardDecoratorPlugin, vitestAlias, vitestExecArgv } from './vitest.shared.ts'

// Resolution facade shared by every plugin instance below: tsconfig.base.json
// has no include, which vite-tsconfig-paths treats as match-all, so its paths
// map applies to every test file. Own-package src paths win over package files
// so tests compile against sources; host packages resolve from node_modules.
export default defineConfig({
  plugins: [tsconfigPaths({ projects: ['./tsconfig.base.json'] }), standardDecoratorPlugin()],
  resolve: { alias: vitestAlias },
  test: {
    execArgv: vitestExecArgv,
    // 内核 ui 原语包带 .module.css 与未声明依赖——SSR native 加载必然炸,inline 交给 vite 转换
    server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } },
    // Forked workers: process-global state (cordis singletons, Web Storage via
    // jsdom) cannot leak across suites.
    pool: 'forks',
    // Browser-bound suites opt into jsdom with a per-file @vitest-environment pragma.
    // KNOWN GAP: packages/*/tests-client-plane/** carries the client-plane UI
    // specs — present since extraction, never matched by this glob, and at
    // wiring time they die at module load: the session-controller browser
    // client.js needs the host's window.__ModuleLoader__ prelude. Wiring them
    // in requires a test shim for that prelude (follow-up, see devlog).
    include: ['packages/*/tests/**/*.{spec,test}.{ts,tsx}'],
    // Hooks here do real work: a REAL-composition teardown disposes a cordis
    // fiber, waits out the subprocesses that fiber spawned, and rm's a real
    // workspace — so vitest's 10s default is a tight budget. The wait is real,
    // not hypothetical: on Linux a cancelled card-tool child can outlive the
    // cancel, and `fiber.dispose()` waits it out. That produced four ubuntu-only
    // hook timeouts, each reported against whichever test was in flight while
    // macOS and Windows stayed green on identical code. The two sleeper cases in
    // loader-composition now bound their child to 10s, so teardown costs at most
    // that; this budget sits comfortably above it rather than at its edge. Tests
    // keep the default timeout; only hooks move.
    hookTimeout: 30_000,
  },
})
