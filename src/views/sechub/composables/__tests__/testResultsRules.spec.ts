/**
 * 「API / 表单测试结果」纯规则单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseDashboardRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { ApiResultRow, ApiResultSummary } from '@/types/sechub-test-results'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  apiDetailSeed,
  CASE_TYPE_OPTIONS,
  caseTypeLabel,
  defectLink,
  formNumberFromQuery,
  nextStatusFilter,
  scopeQuery,
  summaryCards,
  tabFromQuery,
  testStatusMeta,
  testTypeOptions,
} from '../testResultsRules'

function row(overrides: Partial<ApiResultRow> = {}): ApiResultRow {
  return {
    api_path: '/api/demo',
    http_method: 'GET',
    api_version: null,
    app_number: null,
    app_name: null,
    project_group_code: null,
    project_group_name: null,
    business_area: null,
    product_domain: null,
    test_status: 'untested',
    case_total: 0,
    case_passed: 0,
    case_failed: 0,
    by_type: [],
    last_tested_at: null,
    last_fail_detail: null,
    open_defect_cnt: 0,
    ...overrides,
  }
}

test('testStatusMeta 覆盖四种状态并对未知值兜底', () => {
  assert.deepEqual(testStatusMeta('passed'), { label: '通过', color: 'green' })
  assert.deepEqual(testStatusMeta('failed'), { label: '失败', color: 'red' })
  assert.deepEqual(testStatusMeta('testing'), { label: '测试中', color: 'blue' })
  assert.deepEqual(testStatusMeta('untested'), { label: '未测', color: 'gray' })
  assert.deepEqual(testStatusMeta(null), { label: '未测', color: 'gray' })
  assert.deepEqual(testStatusMeta('weird'), { label: 'weird', color: 'gray' })
})

test('scopeQuery 按维度把左树节点映射成后端查询参数', () => {
  assert.deepEqual(scopeQuery('project_group', { kind: 'group', code: 'PG01' }), { project_group: 'PG01' })
  assert.deepEqual(scopeQuery('business_area', { kind: 'group', code: '财务' }), { business_area: '财务' })
  assert.deepEqual(scopeQuery('product_domain', { kind: 'group', code: '供应链' }), { product_domain: '供应链' })
  assert.deepEqual(scopeQuery('app', { kind: 'group', code: 'APP01' }), { keyword: 'APP01' })
  assert.deepEqual(scopeQuery('app', { kind: 'app', code: 'APP02' }), { keyword: 'APP02' })
  assert.deepEqual(scopeQuery('project_group', { kind: 'api', code: '/api/a' }), { keyword: '/api/a' })
  assert.deepEqual(scopeQuery('project_group', { kind: 'all', code: '' }), {})
  assert.deepEqual(scopeQuery('project_group', null), {})
})

test('summaryCards 顺序与值来自后端 summary', () => {
  const summary: ApiResultSummary = { total: 40, untested: 10, testing: 2, passed: 22, failed: 6 }
  const cards = summaryCards(summary)
  assert.deepEqual(cards.map(card => card.key), ['total', 'untested', 'testing', 'passed', 'failed'])
  assert.deepEqual(cards.map(card => card.value), [40, 10, 2, 22, 6])
  assert.deepEqual(cards.map(card => card.filter), ['', 'untested', 'testing', 'passed', 'failed'])
  assert.deepEqual(summaryCards(null).map(card => card.value), [0, 0, 0, 0, 0])
})

test('nextStatusFilter：点当前状态再点一次取消，点总数清空', () => {
  assert.equal(nextStatusFilter('failed', 'failed'), '')
  assert.equal(nextStatusFilter('', 'failed'), 'failed')
  assert.equal(nextStatusFilter('passed', 'total'), '')
  assert.equal(nextStatusFilter('passed', ''), '')
})

test('testTypeOptions 合并常量表与列表里出现过的类型，按 label 去重', () => {
  const options = testTypeOptions([
    row({ by_type: [{ test_type: 'form_url', label: '表单URL直达', verdict: null, case_cnt: 1 }] }),
    row({ by_type: [{ test_type: 'perm', label: '功能越权', verdict: 'PASS', case_cnt: 2 }] }),
  ])
  const byValue = new Map(options.map(option => [option.value, option.label]))
  assert.equal(byValue.get('form_url'), '表单URL直达')
  assert.equal(byValue.get('perm'), '功能越权')
  assert.equal(byValue.get('injection'), '注入')
  assert.equal(new Set(options.map(option => option.value)).size, options.length)
})

test('apiDetailSeed 只吃完整接口路径，支持数组 query', () => {
  assert.deepEqual(apiDetailSeed({ api_path: '/api/a', http_method: 'post', env_id: 'E1' }), {
    apiPath: '/api/a',
    httpMethod: 'POST',
    envId: 'E1',
  })
  assert.deepEqual(apiDetailSeed({ api_path: ['/api/b'], http_method: ['GET'] }), {
    apiPath: '/api/b',
    httpMethod: 'GET',
    envId: '',
  })
  assert.equal(apiDetailSeed({}), null)
  assert.equal(apiDetailSeed({ api_path: '   ' }), null)
})

test('tabFromQuery / formNumberFromQuery 只接受已知取值', () => {
  assert.equal(tabFromQuery({ tab: 'runs' }), 'runs')
  assert.equal(tabFromQuery({ tab: ['runs'] }), 'runs')
  assert.equal(tabFromQuery({ tab: 'whatever' }), 'apis')
  assert.equal(tabFromQuery({}), 'apis')
})

test('formNumberFromQuery 去空白，空值返回 null', () => {
  assert.equal(formNumberFromQuery({ form_number: '  BD01  ' }), 'BD01')
  assert.equal(formNumberFromQuery({ form_number: '' }), null)
  assert.equal(formNumberFromQuery({}), null)
})

test('caseTypeLabel 覆盖 F4 表单URL直达', () => {
  assert.equal(caseTypeLabel('form_url'), '表单URL直达')
  assert.equal(caseTypeLabel('form_perm'), '表单权限')
  assert.equal(caseTypeLabel(''), '--')
  assert.ok(CASE_TYPE_OPTIONS.some(option => option.value === 'form_url'))
})

test('defectLink 把缺陷编号带进发版缺陷页 query', () => {
  assert.equal(defectLink('SEC-0001'), '/sechub/release/release-defects?keyword=SEC-0001')
  assert.equal(defectLink('A B'), '/sechub/release/release-defects?keyword=A%20B')
})
