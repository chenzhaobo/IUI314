/**
 * 「接口覆盖」页纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `caseBatchReviewRules.spec.ts` 的做法：
 * 用临时 tsconfig 交给 tsc 编译到 /tmp，再由 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apiSelectionKey,
  coverageRateText,
  formatTestTypes,
  groupSelectedApis,
  isSelectable,
} from '../releaseCoverageRules'

test('勾选键 = api_path|方法，方法 trim 后大写，空方法保留竖线', () => {
  assert.equal(apiSelectionKey('/gl/Total/List', ' get '), '/gl/Total/List|GET')
  assert.equal(apiSelectionKey('/gl/Total/List', null), '/gl/Total/List|')
  assert.equal(apiSelectionKey('/gl/Total/List', undefined), '/gl/Total/List|')
})

test('只有未覆盖与待评审允许勾选', () => {
  assert.equal(isSelectable('uncovered'), true)
  assert.equal(isSelectable('pending_review'), true)
  for (const status of ['exempt', 'not_run', 'partial', 'passed', 'failed', 'review', 'blocked'] as const)
    assert.equal(isSelectable(status), false, `${status} 不应允许勾选`)
})

test('勾选接口按项目组聚合：组内按 api_path 去重并保持顺序', () => {
  const selected = groupSelectedApis([
    { api_path: '/gl/a', project_group_code: 'GL' },
    { api_path: '/ar/x', project_group_code: 'AR' },
    { api_path: '/gl/b', project_group_code: 'GL' },
    { api_path: '/gl/a', project_group_code: 'GL' },
  ])
  assert.deepEqual(selected, {
    GL: ['/gl/a', '/gl/b'],
    AR: ['/ar/x'],
  })
})

test('覆盖率保留 1 位小数，总数为 0 显示占位符', () => {
  assert.equal(coverageRateText(3, 8), '37.5%')
  assert.equal(coverageRateText(2, 2), '100.0%')
  assert.equal(coverageRateText(0, 0), '-')
  assert.equal(coverageRateText(0, 5), '0.0%')
})

test('测试类型展示：空数组显示占位符，多值用分隔符', () => {
  assert.equal(formatTestTypes([]), '-')
  assert.equal(formatTestTypes(['authz', 'inject']), 'authz / inject')
})
