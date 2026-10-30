/**
 * 「缺陷草稿」页纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseCoverageRules.spec.ts` 的做法：
 * 用临时 tsconfig 交给 tsc 编译到 /tmp，再由 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { DefectFilters, DefectStatus } from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  canTransition,
  defectActions,
  defectContentText,
  defectExportPath,
  defectQueryOf,
  defectSourceLabel,
  defectStatusColor,
  defectStatusLabel,
  defectTitleText,
} from '../defectDraftRules'

test('状态流转与后端 can_transition 矩阵一致', () => {
  const statuses: DefectStatus[] = ['draft', 'submitted', 'fixed', 'closed']
  for (const from of statuses) {
    for (const to of statuses) {
      const expected = (from === 'draft' && to === 'submitted')
        || (from === 'submitted' && to === 'draft')
        || (from === 'submitted' && to === 'fixed')
        || to === 'closed'
      assert.equal(canTransition(from, to), expected, `${from} -> ${to}`)
    }
  }
  assert.equal(canTransition('weird' as DefectStatus, 'fixed'), false)
})

test('行操作只给出合法流转，且不包含自我流转', () => {
  assert.deepEqual(defectActions('draft').map(action => action.target), ['submitted', 'closed'])
  assert.deepEqual(defectActions('submitted').map(action => action.key), ['fix', 'draft', 'close'])
  assert.deepEqual(defectActions('fixed').map(action => action.key), ['close'])
  assert.deepEqual(defectActions('closed'), [])

  const submit = defectActions('draft').find(action => action.key === 'submit')
  assert.equal(submit?.needsExternalNo, true)
  assert.equal(submit?.label, '标记已提交')
  assert.equal(defectActions('submitted').find(action => action.key === 'fix')?.needsExternalNo, false)
})

test('查询参数省略空值，关键词与项目组 trim 后下发', () => {
  const filters: DefectFilters = {
    iterationId: 'ITER1',
    projectGroup: ' GL ',
    status: '',
    source: 'release_api',
    keyword: ' 越权 ',
  }
  assert.deepEqual(defectQueryOf(filters, 2, 50), {
    iteration_id: 'ITER1',
    project_group: 'GL',
    source: 'release_api',
    keyword: '越权',
    page_num: 2,
    page_size: 50,
  })

  const empty = defectQueryOf({ iterationId: '', projectGroup: '', status: '', source: '', keyword: '  ' }, 1, 20)
  assert.deepEqual(empty, { page_num: 1, page_size: 20 })
})

test('查询参数带产品线：空值不下发', () => {
  const filters: DefectFilters = {
    productLine: '星瀚',
    iterationId: 'ITER1',
    projectGroup: 'PM013',
    status: '',
    source: '',
    keyword: '',
  }
  assert.deepEqual(defectQueryOf(filters, 1, 20), {
    product_line: '星瀚',
    iteration_id: 'ITER1',
    project_group: 'PM013',
    page_num: 1,
    page_size: 20,
  })

  const noLine = defectQueryOf({ iterationId: 'ITER1', status: '', source: '', keyword: '' }, 1, 20)
  assert.equal('product_line' in noLine, false)
})

test('导出路径保留筛选条件并做 URL 编码，翻页参数不下发', () => {
  const base = '/sechub/release/defects/export.md'
  assert.equal(defectExportPath(base, { page_num: 1, page_size: 20 }), base)
  assert.equal(
    defectExportPath(base, { status: 'draft', keyword: '越权', page_num: 1, page_size: 20 }),
    `${base}?status=draft&keyword=%E8%B6%8A%E6%9D%83`,
  )
  assert.equal(
    defectExportPath(base, { product_line: '星瀚', project_group: 'PM013', page_num: 1, page_size: 20 }),
    `${base}?product_line=%E6%98%9F%E7%80%9A&project_group=PM013`,
  )
})

test('状态与来源的中文名、颜色映射，未知来源回退占位符', () => {
  assert.equal(defectStatusLabel('draft'), '草稿')
  assert.equal(defectStatusLabel('submitted'), '已提交')
  assert.equal(defectStatusLabel('fixed'), '已修复')
  assert.equal(defectStatusLabel('closed'), '已关闭')
  assert.equal(defectStatusColor('draft'), 'gray')
  assert.equal(defectStatusColor('submitted'), 'arcoblue')
  assert.equal(defectStatusColor('fixed'), 'green')

  assert.equal(defectSourceLabel('release_api'), 'API 测试')
  assert.equal(defectSourceLabel('release_config'), '配置检查')
  assert.equal(defectSourceLabel(''), '-')
})

test('复制文本：标题 trim，内容为空时返回空串', () => {
  assert.equal(defectTitleText({ title: ' [安全][GL] 越权 ' }), '[安全][GL] 越权')
  assert.equal(defectTitleText({ title: '   ' }), '')
  assert.equal(defectContentText({ content: '## 问题概述\n\n正文' }), '## 问题概述\n\n正文')
  assert.equal(defectContentText({ content: null }), '')
})
