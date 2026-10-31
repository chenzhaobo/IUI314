/**
 * 「发版左树」纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseScopeRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { ReleaseScopeTreeNode } from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  ancestorKeys,
  countsText,
  defaultExpandedKeys,
  filterTreeByKeyword,
  findNodeByScope,
  sameScope,
  treeQueryOf,
} from '../releaseScopeTreeRules'

function node(
  key: string,
  title: string,
  level: ReleaseScopeTreeNode['level'],
  scope: ReleaseScopeTreeNode['scope'],
  total: number,
  focus: number,
  children: ReleaseScopeTreeNode[] = [],
): ReleaseScopeTreeNode {
  return { key, title, level, scope, counts: { total, focus }, children }
}

function fixture(): ReleaseScopeTreeNode {
  const rule = node(
    'pg:FC_007/app:XYZ/h:alice/rule:R1',
    '规则 R1',
    'rule',
    { project_group: 'FC_007', app_number: 'XYZ', handler: 'alice', rule_code: 'R1' },
    10,
    1,
  )
  const handler = node(
    'pg:FC_007/app:XYZ/h:alice',
    'alice',
    'handler',
    { project_group: 'FC_007', app_number: 'XYZ', handler: 'alice' },
    20,
    2,
    [rule],
  )
  const app = node(
    'pg:FC_007/app:XYZ',
    '应用 XYZ',
    'app',
    { project_group: 'FC_007', app_number: 'XYZ' },
    40,
    4,
    [handler],
  )
  const group = node(
    'pg:FC_007',
    '财务共享项目组',
    'project_group',
    { project_group: 'FC_007' },
    60,
    6,
    [app],
  )
  const domain = node(
    'pd:集团财务',
    '集团财务',
    'product_domain',
    { product_domain: '集团财务' },
    40,
    4,
  )
  return node('root', '全部', 'root', {}, 100, 10, [group, domain])
}

test('treeQueryOf：去掉结构键、分页键与空值，追加 mode', () => {
  const query = {
    product_line: 'gan',
    product_domains: '集团财务',
    business_area: '__none__',
    project_group: 'PM013',
    app_number: 'XYZ',
    handler: 'alice',
    rule_code: 'R1',
    page_num: 2,
    page_size: 20,
    keyword: 'abc',
    new_only: true,
    empty: '',
  }
  assert.deepEqual(treeQueryOf(query, 'rule'), {
    product_line: 'gan',
    keyword: 'abc',
    new_only: true,
    mode: 'rule',
  })
  assert.deepEqual(treeQueryOf({}, 'product_group'), { mode: 'product_group' })
})

test('sameScope：忽略空值，非空字段必须全等', () => {
  assert.equal(sameScope({ product_domain: '集团财务' }, { product_domain: '集团财务', app_number: '' }), true)
  assert.equal(sameScope({}, {}), true)
  assert.equal(sameScope({ project_group: 'FC_007' }, {}), false)
  assert.equal(sameScope({ project_group: 'FC_007' }, { project_group: 'FC_008' }), false)
  assert.equal(sameScope({ project_group: 'FC_007' }, { project_group: 'FC_007', app_number: 'XYZ' }), false)
})

test('findNodeByScope：返回最深匹配，空 scope 返回根，找不到返回 null', () => {
  const root = fixture()
  assert.equal(findNodeByScope(root, {})?.key, 'root')
  assert.equal(findNodeByScope(root, { project_group: 'FC_007' })?.key, 'pg:FC_007')
  assert.equal(
    findNodeByScope(root, { project_group: 'FC_007', app_number: 'XYZ' })?.key,
    'pg:FC_007/app:XYZ',
  )
  assert.equal(
    findNodeByScope(root, { project_group: 'FC_007', app_number: 'XYZ', handler: 'alice' })?.key,
    'pg:FC_007/app:XYZ/h:alice',
  )
  assert.equal(
    findNodeByScope(root, { project_group: 'FC_007', app_number: 'XYZ', handler: 'alice', rule_code: 'R1' })?.key,
    'pg:FC_007/app:XYZ/h:alice/rule:R1',
  )
  assert.equal(findNodeByScope(root, { project_group: 'NOPE' }), null)
})

test('ancestorKeys：由近到远返回祖先，不含自身', () => {
  const root = fixture()
  assert.deepEqual(
    ancestorKeys(root, 'pg:FC_007/app:XYZ/h:alice'),
    ['pg:FC_007/app:XYZ', 'pg:FC_007', 'root'],
  )
  assert.deepEqual(ancestorKeys(root, 'root'), [])
  assert.deepEqual(ancestorKeys(root, 'missing'), [])
})

test('defaultExpandedKeys：根 + 第一层', () => {
  const root = fixture()
  assert.deepEqual(defaultExpandedKeys(root), ['root', 'pg:FC_007', 'pd:集团财务'])
  assert.deepEqual(defaultExpandedKeys(null), [])
})

test('filterTreeByKeyword：命中节点及其祖先保留，大小写不敏感', () => {
  const root = fixture()
  const byApp = filterTreeByKeyword(root, 'xyz')
  assert.ok(byApp)
  assert.equal(byApp.children.length, 1)
  assert.equal(byApp.children[0]?.key, 'pg:FC_007')
  assert.equal(byApp.children[0]?.children[0]?.key, 'pg:FC_007/app:XYZ')

  const byDomain = filterTreeByKeyword(root, '集团财务')
  assert.ok(byDomain)
  assert.equal(byDomain.children.length, 1)
  assert.equal(byDomain.children[0]?.key, 'pd:集团财务')

  assert.equal(filterTreeByKeyword(root, '不存在'), null)
  assert.equal(filterTreeByKeyword(root, '')?.key, 'root')
})

test('countsText：focus 在前，labels 由后端提供', () => {
  assert.equal(
    countsText({ total: 30, focus: 12 }, { total: '检查项', focus: '待处理' }),
    '待处理 12 / 检查项 30',
  )
})
