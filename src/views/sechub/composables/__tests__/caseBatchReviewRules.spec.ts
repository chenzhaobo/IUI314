/**
 * 批量评审入参校验的单测（纯函数，无 Vue 依赖）。
 *
 * 仓库没有 vitest 配置，沿用 src/utils/__tests__/perfFormat.spec.ts 的做法：
 * 用 node:test + node:assert，由 tsc 编译到临时目录后交给 node 运行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BATCH_REVIEW_MAX, validateBatchReview } from '../caseBatchReviewRules'

test('未勾选任何用例时提示先勾选', () => {
  assert.equal(validateBatchReview(0, 'approved', ''), '请先勾选用例')
})

test('超过单次上限时提示分批', () => {
  const message = validateBatchReview(BATCH_REVIEW_MAX + 1, 'approved', '')
  assert.ok(message && message.includes(String(BATCH_REVIEW_MAX)))
})

test('驳回必须填写意见，纯空白也算未填', () => {
  assert.equal(validateBatchReview(3, 'rejected', ''), '驳回必须填写意见')
  assert.equal(validateBatchReview(3, 'rejected', '   \n\t '), '驳回必须填写意见')
})

test('驳回填写意见后通过校验', () => {
  assert.equal(validateBatchReview(3, 'rejected', '断言过弱，需补响应码校验'), null)
})

test('通过时意见选填：留空可提交', () => {
  assert.equal(validateBatchReview(3, 'approved', ''), null)
})

test('上限边界值可提交', () => {
  assert.equal(validateBatchReview(BATCH_REVIEW_MAX, 'approved', ''), null)
})
