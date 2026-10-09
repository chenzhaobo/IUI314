/**
 * 性能测试菜单路由常量。
 *
 * 路由由菜单 path 逐级拼接（`sys_menu` 根 `perf` + 分组 + 页面），
 * 例如 `perf` + `benchmark` + `task` = `/perf/benchmark/task`。
 * 页面之间的跳转统一引用这里，后端菜单重组时只改这一处，不再散落硬编码。
 */
// ── 测试资产 ──────────────────────────────────
export const PERF_SCRIPT_PATH = '/perf/asset/script'
export const PERF_SCRIPT_BINDING_PATH = '/perf/asset/script-binding'

// ── 基准自动化 ──────────────────────────────────
export const PERF_TEST_PLAN_PATH = '/perf/benchmark/test-plan'
export const PERF_TASK_PATH = '/perf/benchmark/task'
export const PERF_BENCHMARK_REPORT_PATH = '/perf/benchmark/benchmark-report'
export const PERF_COMPARISON_REPORT_PATH = '/perf/benchmark/comparison-report'
// 新增比对 / 比对详情不占菜单，由 src/router/perfStaticRoutes.ts 注册静态路由
export const PERF_COMPARISON_CREATE_PATH = '/perf/benchmark/comparison-report/create'
export const PERF_COMPARISON_DETAIL_PATH = '/perf/benchmark/comparison-report/detail'
export const PERF_SUMMARY_PATH = '/perf/benchmark/summary'
export const PERF_TXN_MANAGE_PATH = '/perf/benchmark/txn-manage'

// ── 压力测试 ──────────────────────────────────
export const PERF_PROBE_PLAN_PATH = '/perf/stress/probe-plan'
export const PERF_RUN_PATH = '/perf/stress/run'

// ── 报告 / 覆盖率 ──────────────────────────────────
export const PERF_REPORT_PATH = '/perf/report'
export const PERF_COVERAGE_DASHBOARD_PATH = '/perf/coverage-dashboard'
// 覆盖率明细不占菜单，由 src/router/perfStaticRoutes.ts 注册静态路由
export const PERF_COVERAGE_DETAIL_PATH = '/perf/coverage-detail'

// ── 执行资源 ──────────────────────────────────
export const PERF_LOAD_NODE_PATH = '/perf/resource/load-node'
export const PERF_METRIC_TEMPLATE_PATH = '/perf/resource/metric-template'
