/**
 * 「质量看板 / 发版检查」纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseCoverageRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type {
  ReleaseCoverageMetrics,
  ReleaseExecutionMetrics,
  ReleaseIssueInputs,
  ReleaseTargetCheck,
} from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  agentMinutesText,
  blockReasonRows,
  buildKpiCards,
  conclusionMeta,
  daysLeftText,
  rateText,
  reviewStatusMeta,
  runStatusMeta,
  targetTone,
} from '../releaseDashboardRules'

function coverage(overrides: Partial<ReleaseCoverageMetrics> = {}): ReleaseCoverageMetrics {
  return {
    covered: 4,
    coverage_rate: 0.8,
    new_covered: 2,
    new_coverage_rate: 0.6667,
    high_risk_total: 1,
    high_risk_covered: 1,
    high_risk_rate: 1,
    minimal_complete: 3,
    minimal_rate: 0.75,
    new_minimal_complete: 2,
    new_minimal_rate: 1,
    pending_review: 1,
    exempt: 0,
    new_exempt: 0,
    ...overrides,
  }
}

function execution(overrides: Partial<ReleaseExecutionMetrics> = {}): ReleaseExecutionMetrics {
  return {
    valid_cases: 10,
    executed: 8,
    exec_rate: 0.8,
    verdicts: { pass: 6, fail: 1, review: 0, blocked: 1, error: 0 },
    pass_rate: 0.8571,
    block_rate: 0.125,
    pending_review: 0,
    api_executed: 5,
    api_passed: 4,
    api_pass_rate: 0.8,
    block_reasons: {},
    ...overrides,
  }
}

function issues(overrides: Partial<ReleaseIssueInputs> = {}): ReleaseIssueInputs {
  return {
    open_defects: 2,
    open_high_defects: 1,
    new_defects: 2,
    legacy_defects: 0,
    new_high_config_open: 3,
    legacy_high_config_open: 4,
    config_open: 7,
    config_waived: 1,
    config_new: 3,
    config_fixed: 2,
    ...overrides,
  }
}

function target(overrides: Partial<ReleaseTargetCheck>): ReleaseTargetCheck {
  return {
    key: 'exec_rate',
    label: '有效用例执行率',
    actual: 0.8,
    target: null,
    met: null,
    ...overrides,
  }
}

test('rateText 保留 1 位小数，null 显示 -', () => {
  assert.equal(rateText(null), '-')
  assert.equal(rateText(undefined), '-')
  assert.equal(rateText(0), '0.0%')
  assert.equal(rateText(0.8234), '82.3%')
  assert.equal(rateText(1), '100.0%')
})

test('conclusionMeta 覆盖三种结论并有未知兜底', () => {
  assert.deepEqual(conclusionMeta('blocked'), { key: 'blocked', label: '阻断', color: 'red' })
  assert.deepEqual(conclusionMeta('risky'), { key: 'risky', label: '有风险', color: 'orange' })
  assert.deepEqual(conclusionMeta('passed'), { key: 'passed', label: '通过', color: 'green' })
  assert.equal(conclusionMeta('').label, '未评估')
  assert.equal(conclusionMeta(null).color, 'gray')
})

test('targetTone：达标绿 / 未达标红 / 无判定灰', () => {
  assert.equal(targetTone(target({ met: true })), 'ok')
  assert.equal(targetTone(target({ met: false })), 'bad')
  assert.equal(targetTone(target({ met: null })), 'muted')
  assert.equal(targetTone(undefined), 'muted')
})

test('buildKpiCards 输出 6 个指标并映射目标线与着色', () => {
  const targets: ReleaseTargetCheck[] = [
    target({ key: 'new_coverage', actual: 0.6667, target: 0.8, met: false }),
    target({ key: 'open_high_defects', actual: 1, target: 0, met: false }),
    target({ key: 'new_high_config', actual: 3, target: 5, met: true }),
    target({ key: 'block_rate', actual: 0.125, target: 0.2, met: true }),
  ]
  const cards = buildKpiCards(coverage(), execution(), issues(), targets)
  assert.deepEqual(cards.map(card => card.label), [
    '接口覆盖率',
    '新增接口覆盖率',
    '用例通过率',
    '阻塞率',
    '未关闭高危缺陷',
    '本迭代新增高危配置',
  ])
  assert.equal(cards[0].value, '80.0%')
  assert.equal(cards[0].tone, 'muted', '接口覆盖率没有目标线')
  assert.equal(cards[1].value, '66.7%')
  assert.equal(cards[1].target, '目标 ≥ 80.0%')
  assert.equal(cards[1].tone, 'bad')
  assert.equal(cards[2].value, '85.7%')
  assert.equal(cards[2].tone, 'muted', '通过率没有目标线')
  assert.equal(cards[3].target, '目标 ≤ 20.0%')
  assert.equal(cards[3].tone, 'ok')
  assert.equal(cards[4].value, '1')
  assert.equal(cards[4].target, '目标 ≤ 0')
  assert.equal(cards[4].tone, 'bad')
  assert.equal(cards[5].value, '3')
  assert.equal(cards[5].tone, 'ok')
})

test('buildKpiCards 在比率为 null 时显示 - 且目标判定为灰', () => {
  const cards = buildKpiCards(
    coverage({ coverage_rate: null, new_coverage_rate: null }),
    execution({ pass_rate: null, block_rate: null }),
    issues({ open_high_defects: 0, new_high_config_open: 0 }),
    [target({ key: 'new_coverage', actual: null, target: 0.9, met: null })],
  )
  assert.equal(cards[0].value, '-')
  assert.equal(cards[1].value, '-')
  assert.equal(cards[2].value, '-')
  assert.equal(cards[3].value, '-')
  assert.equal(cards[1].target, '目标 ≥ 90.0%', '有目标线就显示目标值')
  assert.equal(cards[1].tone, 'muted')
  assert.equal(cards[4].value, '0')
})

test('blockReasonRows 按接口数倒序，未知归类回退编码', () => {
  const rows = blockReasonRows({ env: 3, auth_603: 5, custom: 1 })
  assert.deepEqual(rows.map(row => row.code), ['auth_603', 'env', 'custom'])
  assert.equal(rows[0].label, '第三方应用授权')
  assert.equal(rows[1].label, '环境不可达或服务未部署')
  assert.equal(rows[2].label, 'custom')
  assert.equal(rows[0].count, 5)
  assert.deepEqual(blockReasonRows(undefined), [])
})

test('agentMinutesText 把毫秒换算成分钟并保留 1 位小数', () => {
  assert.equal(agentMinutesText(90_000), '1.5')
  assert.equal(agentMinutesText(0), '0.0')
  assert.equal(agentMinutesText(-1), '-')
})

test('daysLeftText 覆盖已结束 / 当天 / 剩余', () => {
  assert.equal(daysLeftText(-2), '已结束 2 天')
  assert.equal(daysLeftText(0), '今天结束')
  assert.equal(daysLeftText(5), '剩余 5 天')
  assert.equal(daysLeftText(undefined), '-')
})

test('runStatusMeta 覆盖套件运行状态并有未知兜底', () => {
  assert.deepEqual(runStatusMeta('running'), { label: '运行中', color: 'blue' })
  assert.deepEqual(runStatusMeta('success'), { label: 'PASS', color: 'green' })
  assert.deepEqual(runStatusMeta('failed'), { label: 'FAIL', color: 'red' })
  assert.deepEqual(runStatusMeta('weird'), { label: 'weird', color: 'gray' })
})

test('reviewStatusMeta 覆盖未复核 / 复核中 / 成功 / 失败', () => {
  assert.deepEqual(reviewStatusMeta(null), { label: '未复核', color: 'gray' })
  assert.deepEqual(reviewStatusMeta('running'), { label: '复核中', color: 'blue' })
  assert.deepEqual(reviewStatusMeta('succeeded'), { label: '已复核', color: 'green' })
  assert.deepEqual(reviewStatusMeta('failed'), { label: '复核失败', color: 'red' })
  assert.deepEqual(reviewStatusMeta('other'), { label: 'other', color: 'gray' })
})
