/**
 * 安全测试域穿透跳转规则单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `testResultsRules.spec.ts` 的做法：
 * tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  caseResultLink,
  firstQueryText,
  formNumberFromEntityNumber,
  isFormCaseType,
  toApiResult,
  toFormResult,
  toRunResults,
  toSuite,
  toSuiteRuns,
  toTask,
  toTaskRuns,
} from '../secNavigation'

test('toRunResults 带 run_id；空 id 只打开列表', () => {
  assert.deepEqual(toRunResults('run-1'), { name: 'scan-runs', query: { run_id: 'run-1' } })
  assert.deepEqual(toRunResults(''), { name: 'scan-runs', query: {} })
  assert.deepEqual(toRunResults(null), { name: 'scan-runs', query: {} })
})

test('toTask / toTaskRuns / toSuite 使用对应路由名', () => {
  assert.deepEqual(toTask('task-1'), { name: 'scan-task-list', query: { task_id: 'task-1' } })
  assert.deepEqual(toTask(undefined), { name: 'scan-task-list', query: {} })
  assert.deepEqual(toTaskRuns('task-1'), { name: 'scan-runs', query: { task_id: 'task-1' } })
  assert.deepEqual(toSuite('SUITE_A'), { name: 'regression-suites', query: { suite_code: 'SUITE_A' } })
  assert.deepEqual(toSuite(''), { name: 'regression-suites', query: {} })
})

test('toSuiteRuns 可带套件名做页面提示', () => {
  assert.deepEqual(toSuiteRuns('sid-1', '财务回归'), {
    name: 'scan-runs',
    query: { suite_id: 'sid-1', suite_name: '财务回归' },
  })
  assert.deepEqual(toSuiteRuns('sid-1'), { name: 'scan-runs', query: { suite_id: 'sid-1' } })
})

test('toApiResult 归一化方法大小写，缺路径返回 null', () => {
  assert.deepEqual(toApiResult('/api/x', 'get', 'env-1'), {
    name: 'api-test-results',
    query: { api_path: '/api/x', http_method: 'GET', env_id: 'env-1' },
  })
  assert.deepEqual(toApiResult('/api/x'), {
    name: 'api-test-results',
    query: { api_path: '/api/x' },
  })
  assert.equal(toApiResult(''), null)
})

test('toFormResult 缺表单编码返回 null', () => {
  assert.deepEqual(toFormResult('AR_receivable'), {
    name: 'form-results',
    query: { form_number: 'AR_receivable' },
  })
  assert.equal(toFormResult('  '), null)
})

test('formNumberFromEntityNumber 取冒号前部分', () => {
  assert.equal(formNumberFromEntityNumber('AR_receivable:001'), 'AR_receivable')
  assert.equal(formNumberFromEntityNumber('  AR_receivable  '), 'AR_receivable')
  assert.equal(formNumberFromEntityNumber(''), '')
})

test('isFormCaseType 只认表单域与元数据检查', () => {
  assert.equal(isFormCaseType('form_perm'), true)
  assert.equal(isFormCaseType('meta_perm_check'), true)
  assert.equal(isFormCaseType('openapi_perm'), false)
  assert.equal(isFormCaseType(null), false)
})

test('caseResultLink：API 优先，其次表单用例，其余不可跳', () => {
  assert.deepEqual(
    caseResultLink({ api_path: '/api/x', http_method: 'post', case_type: 'openapi_perm' }),
    { name: 'api-test-results', query: { api_path: '/api/x', http_method: 'POST' } },
  )
  assert.deepEqual(
    caseResultLink({ api_path: '', http_method: null, case_type: 'form_perm', entity_number: 'AR:1' }),
    { name: 'form-results', query: { form_number: 'AR' } },
  )
  assert.equal(caseResultLink({ api_path: null, case_type: 'script', entity_number: 'x' }), null)
})

test('firstQueryText 兼容数组并裁剪空白', () => {
  assert.equal(firstQueryText('  x '), 'x')
  assert.equal(firstQueryText(['a', 'b']), 'a')
  assert.equal(firstQueryText(undefined), '')
  assert.equal(firstQueryText(123), '')
})
