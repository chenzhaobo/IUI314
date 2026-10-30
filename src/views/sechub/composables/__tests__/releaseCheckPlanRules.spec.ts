/**
 * 「发版检查计划」纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseScopeRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { ReleaseCheckPlanResponse } from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildReleasePlanQuery,
  confirmLines,
  durationText,
  estimateText,
  excludedPlanItems,
  includedPlanItems,
  planItemDetail,
  planRangeParts,
  ruleMap,
  ruleTip,
} from '../releaseCheckPlanRules'

function planFixture(): ReleaseCheckPlanResponse {
  return {
    product_line: '星瀚',
    env: { id: 'env-1', name: '星瀚测试环境' },
    env_error: null,
    iteration: {
      id: 'it-2',
      code: '2610',
      name: '2026年10月',
      start_date: '2026-10-01',
      end_date: '2026-10-31',
      days_left: 2,
    },
    scope: { product_domains: ['集团财务'], business_areas: [], project_groups: ['PM013'] },
    suite: {
      exists: true,
      suite_code: 'RELEASE-XH',
      name: '星瀚发版回归',
      schedule_cron: '0 30 3 * * *',
      schedule_enabled: '1',
      next_run_at: null,
    },
    items: [
      {
        code: 'A1',
        family: 'api',
        name: 'OpenAPI 自动检测',
        included: false,
        reason: '不在发版回归套件内',
      },
      {
        code: 'A2',
        family: 'api',
        name: '编排用例',
        included: true,
        description: '按断言判定',
        verdicts: 'PASS/FAIL',
        case_count: 12,
      },
      {
        code: 'A4',
        family: 'config',
        name: '清单配置检查',
        included: true,
        description: '只看清单字段',
        rules: ['C01', 'C02'],
      },
      {
        code: 'F3',
        family: 'form',
        name: '元数据扫描',
        included: true,
        description: '读元数据库',
        rules: ['M01'],
      },
    ],
    rules: [
      { code: 'C01', title: '游客可访问', severity: 'high', in_conclusion: true, description: '接口未登录可访问' },
      { code: 'M01', title: '匿名访问', severity: 'high', in_conclusion: true, description: '元数据匿名可访问' },
    ],
    last_run: {
      run_id: 'run-1',
      status: 'success',
      started_at: '2026-10-28T10:00:00+08:00',
      finished_at: '2026-10-28T10:31:00+08:00',
      duration_ms: 1_860_000,
    },
    estimate_minutes: 31,
    notes: ['C03/C04/C06/C07 在生成发版报告时计算'],
  }
}

test('计划查询：产品线 trim 后下发，空值不下发', () => {
  assert.deepEqual(buildReleasePlanQuery(' 星瀚 '), { product_line: '星瀚' })
  assert.deepEqual(buildReleasePlanQuery(''), {})
  assert.deepEqual(buildReleasePlanQuery('   '), {})
})

test('范围一行：产品线 / 环境 / 迭代剩余天数 / 领域 / 业务领域 / 项目组', () => {
  const parts = planRangeParts(planFixture())
  assert.deepEqual(parts.map(part => part.label), ['产品线', '环境', '迭代', '产品领域', '业务领域', '项目组'])
  assert.equal(parts[0]?.value, '星瀚')
  assert.equal(parts[1]?.value, '星瀚测试环境')
  assert.equal(parts[2]?.value, '2026年10月（2610）· 剩余 2 天')
  assert.equal(parts[3]?.value, '集团财务')
  assert.equal(parts[4]?.value, '全部')
  assert.equal(parts[5]?.value, 'PM013')
})

test('范围一行：缺少环境与迭代时给出占位文案', () => {
  const plan = planFixture()
  plan.env = null
  plan.env_error = '产品线「星空」还没有配置测试环境'
  plan.iteration = null
  const parts = planRangeParts(plan)
  assert.equal(parts[1]?.value, '未配置')
  assert.equal(parts[2]?.value, '-')
})

test('会执行 / 不执行按 included 拆分', () => {
  const plan = planFixture()
  assert.deepEqual(includedPlanItems(plan).map(item => item.code), ['A2', 'A4', 'F3'])
  assert.deepEqual(excludedPlanItems(plan).map(item => item.code), ['A1'])
})

test('测试项明细：用例数优先，其次规则编号，最后判定口径', () => {
  const plan = planFixture()
  const [a2, a4, f3] = plan.items.filter(item => item.included)
  assert.equal(a2 ? planItemDetail(a2) : '', '用例 12 条')
  assert.equal(a4 ? planItemDetail(a4) : '', '规则 C01、C02')
  assert.equal(f3 ? planItemDetail(f3) : '', '规则 M01')

  const noCount = planFixture().items[1]
  if (noCount)
    noCount.case_count = null
  assert.equal(noCount ? planItemDetail(noCount) : '', '用例数未统计')
})

test('预计耗时：null 为首次执行文案，否则按分钟', () => {
  assert.equal(estimateText(null), '首次执行，暂无历史耗时')
  assert.equal(estimateText(undefined), '首次执行，暂无历史耗时')
  assert.equal(estimateText(31), '约 31 分钟')
})

test('耗时格式化：不足一分钟按秒，其余向上取整到分钟', () => {
  assert.equal(durationText(null), '-')
  assert.equal(durationText(45_000), '45 秒')
  assert.equal(durationText(1_860_000), '31 分钟')
  assert.equal(durationText(90_000), '2 分钟')
})

test('规则提示：有规则时拼接标题与说明，缺失时回退', () => {
  const index = ruleMap(planFixture().rules)
  assert.equal(ruleTip(index.C01), '游客可访问：接口未登录可访问')
  assert.equal(ruleTip(index.C02), '')
})

test('确认框文案：包含会执行项目、用例数/规则与预计耗时', () => {
  const lines = confirmLines(planFixture())
  assert.equal(lines[0], '本次将执行 3 项：')
  assert.equal(lines[1], 'A2 编排用例 · 用例 12 条')
  assert.equal(lines[2], 'A4 清单配置检查 · 规则 C01、C02')
  assert.equal(lines.at(-1), '预计耗时：约 31 分钟')
  assert.ok(lines.every(line => !line.includes('A1')), '不执行项不进确认框')
})
