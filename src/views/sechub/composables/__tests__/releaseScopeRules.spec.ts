/**
 * 「发版范围筛选」纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseCoverageRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { ReleaseScopeSelection } from '../releaseScopeRules'
import type { ReleaseScopeOptions } from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildProductLineQuery,
  buildScopeQuery,
  businessAreaOptionsOf,
  cascadeDomainOf,
  defaultIterationIdOf,
  domainOptionsOf,
  iterationOptionsOf,
  locateProjectGroup,
  normalizeScopeSelection,
  productLineOptionsOf,
  projectGroupOptionsOf,
  resetOnFieldChange,
  scopeSummaryText,
} from '../releaseScopeRules'

function fixture(): ReleaseScopeOptions {
  return {
    product_lines: [
      { value: 'gan', label: '星瀚', is_default: true },
      { value: 'gal', label: '星空', is_default: false },
    ],
    product_line: 'gan',
    envs: [{ id: 'env-1', name: '测试环境', api_total: 10 }],
    env_id: 'env-1',
    env_error: null,
    iterations: [
      { id: 'it-2', code: '2610', name: '2026年10月', start_date: '2026-10-01', end_date: '2026-10-31', is_current: true },
      { id: 'it-1', code: '2609', name: '2026年9月', start_date: '2026-09-01', end_date: '2026-09-30', is_current: false },
    ],
    current_id: 'it-2',
    domains: [
      {
        name: '集团财务',
        business_areas: [
          { value: '共享', label: '共享', project_groups: [{ code: 'PM013', name: '财务共享项目组' }] },
          { value: '__none__', label: '未分业务领域', project_groups: [{ code: 'PM1111', name: '集团财务技术测试组' }] },
        ],
      },
      {
        name: '供应链',
        business_areas: [
          { value: '采购', label: '采购', project_groups: [{ code: 'SRM', name: 'SRM项目组' }] },
        ],
      },
    ],
  }
}

function selection(overrides: Partial<ReleaseScopeSelection> = {}): ReleaseScopeSelection {
  return {
    productLine: 'gan',
    iterationId: 'it-2',
    productDomain: '',
    businessArea: '',
    projectGroup: '',
    appNumber: '',
    handler: '',
    mine: false,
    ...overrides,
  }
}

test('下拉选项：产品线/迭代来自选项，迭代标签带编码', () => {
  assert.deepEqual(productLineOptionsOf(fixture()), [
    { value: 'gan', label: '星瀚' },
    { value: 'gal', label: '星空' },
  ])
  assert.deepEqual(iterationOptionsOf(fixture()), [
    { value: 'it-2', label: '2026年10月（2610）' },
    { value: 'it-1', label: '2026年9月（2609）' },
  ])
  assert.deepEqual(iterationOptionsOf(null), [])
})

test('领域级联：产品领域 → 业务领域 → 项目组只列上级子项', () => {
  const options = fixture()
  assert.deepEqual(domainOptionsOf(options), [
    { value: '集团财务', label: '集团财务' },
    { value: '供应链', label: '供应链' },
  ])
  assert.deepEqual(businessAreaOptionsOf(options, '集团财务'), [
    { value: '共享', label: '共享' },
    { value: '__none__', label: '未分业务领域' },
  ])
  assert.deepEqual(projectGroupOptionsOf(options, '集团财务', '共享'), [
    { value: 'PM013', label: '财务共享项目组' },
  ])
  assert.deepEqual(businessAreaOptionsOf(options, ''), [], '未选产品领域时业务领域为空')
  assert.deepEqual(projectGroupOptionsOf(options, '集团财务', ''), [], '未选业务领域时项目组为空')
  assert.deepEqual(projectGroupOptionsOf(options, '未知', '共享'), [])
})

test('级联领域：显式选择优先；唯一默认领域视为已选；多个默认领域或未知领域返回空', () => {
  const options = fixture()
  assert.equal(cascadeDomainOf(options, '供应链', ['集团财务']), '供应链')
  assert.equal(cascadeDomainOf(options, '', ['集团财务']), '集团财务')
  assert.equal(cascadeDomainOf(options, '', ['集团财务', '供应链']), '')
  assert.equal(cascadeDomainOf(options, '', ['不存在']), '')
  assert.equal(cascadeDomainOf(options, '', []), '')
  const single = { ...options, domains: options.domains.slice(0, 1) }
  assert.equal(cascadeDomainOf(single, '', []), '集团财务')
})

test('缺省迭代取 current_id，没有当前迭代取首项', () => {
  assert.equal(defaultIterationIdOf(fixture()), 'it-2')
  assert.equal(defaultIterationIdOf({ ...fixture(), current_id: null }), 'it-2')
  assert.equal(defaultIterationIdOf(null), '')
})

test('联动清空：产品线清全部并重置迭代；领域清业务领域与项目组；业务领域清项目组', () => {
  assert.deepEqual(resetOnFieldChange('productLine', fixture()), {
    iterationId: 'it-2',
    productDomain: '',
    businessArea: '',
    projectGroup: '',
    appNumber: '',
    handler: '',
  })
  assert.deepEqual(resetOnFieldChange('productDomain', fixture()), {
    businessArea: '',
    projectGroup: '',
    appNumber: '',
  })
  assert.deepEqual(resetOnFieldChange('businessArea', fixture()), { projectGroup: '', appNumber: '' })
  assert.deepEqual(resetOnFieldChange('projectGroup', fixture()), { appNumber: '' })
  assert.deepEqual(resetOnFieldChange('iterationId', fixture()), {})
  assert.deepEqual(resetOnFieldChange('appNumber', fixture()), {})
  assert.deepEqual(resetOnFieldChange('handler', fixture()), {})
})

test('范围 query：空值不下发，其余按后端字段名输出', () => {
  assert.deepEqual(buildScopeQuery(selection()), {
    product_line: 'gan',
    iteration_id: 'it-2',
  })
  assert.deepEqual(buildScopeQuery(selection({
    productDomain: '集团财务',
    businessArea: '__none__',
    projectGroup: 'PM1111',
  })), {
    product_line: 'gan',
    iteration_id: 'it-2',
    product_domains: '集团财务',
    business_area: '__none__',
    project_group: 'PM1111',
  })
})

test('范围 query：应用 / 处理人下发，mine 只在 true 时下发', () => {
  assert.deepEqual(buildScopeQuery(selection({
    appNumber: 'XYZ',
    handler: 'alice',
    mine: true,
  })), {
    product_line: 'gan',
    iteration_id: 'it-2',
    app_number: 'XYZ',
    handler: 'alice',
    mine: true,
  })
  assert.deepEqual(buildScopeQuery(selection({ mine: false })), {
    product_line: 'gan',
    iteration_id: 'it-2',
  })
})

test('仅产品线的查询：空值与空白不下发', () => {
  assert.deepEqual(buildProductLineQuery('星瀚'), { product_line: '星瀚' })
  assert.deepEqual(buildProductLineQuery('  '), {})
  assert.deepEqual(buildProductLineQuery(''), {})
})

test('按项目组反查上级领域：用于路由预填与统计表点选', () => {
  assert.deepEqual(locateProjectGroup(fixture(), 'PM013'), {
    productDomain: '集团财务',
    businessArea: '共享',
    group: { code: 'PM013', name: '财务共享项目组' },
  })
  assert.equal(locateProjectGroup(fixture(), 'NOPE'), null)
  assert.equal(locateProjectGroup(null, 'PM013'), null)
})

test('路由预填校正：只给项目组时补齐上级，领域/业务领域一致时保留', () => {
  const groupOnly = normalizeScopeSelection(selection({ iterationId: '', projectGroup: 'PM013' }), fixture())
  assert.equal(groupOnly.productDomain, '集团财务')
  assert.equal(groupOnly.businessArea, '共享')
  assert.equal(groupOnly.projectGroup, 'PM013')
  assert.equal(groupOnly.iterationId, 'it-2', '空迭代回退 current_id')

  const areaAndGroup = normalizeScopeSelection(selection({
    productDomain: '',
    businessArea: '共享',
    projectGroup: 'PM013',
  }), fixture())
  assert.equal(areaAndGroup.productDomain, '集团财务', '先按项目组补齐领域，不能先清掉业务领域')
  assert.equal(areaAndGroup.businessArea, '共享')
  assert.equal(areaAndGroup.projectGroup, 'PM013')
})

test('路由预填校正：无效领域 / 迭代 / 项目组回退或清空', () => {
  const invalid = normalizeScopeSelection(selection({
    iterationId: 'gone',
    productDomain: '不存在',
    businessArea: '共享',
    projectGroup: 'PM013',
  }), fixture())
  assert.equal(invalid.productDomain, '集团财务', '无效领域清空后由项目组反查补齐')
  assert.equal(invalid.iterationId, 'it-2')

  const unknownGroup = normalizeScopeSelection(selection({ projectGroup: 'NOPE' }), fixture())
  assert.equal(unknownGroup.projectGroup, '')
  assert.equal(unknownGroup.productDomain, '')
})

test('路由预填校正：`__none__` 产品领域 / 项目组视为合法，不清空', () => {
  const noneDomain = normalizeScopeSelection(selection({ productDomain: '__none__' }), fixture())
  assert.equal(noneDomain.productDomain, '__none__')
  assert.equal(noneDomain.projectGroup, '')

  const noneGroup = normalizeScopeSelection(selection({ iterationId: '', projectGroup: '__none__' }), fixture())
  assert.equal(noneGroup.projectGroup, '__none__')
  assert.equal(noneGroup.businessArea, '')
  assert.equal(noneGroup.iterationId, 'it-2')

  const withExtra = normalizeScopeSelection(selection({
    productDomain: '__none__',
    projectGroup: '__none__',
    appNumber: 'XYZ',
    handler: 'alice',
    mine: true,
  }), fixture())
  assert.equal(withExtra.productDomain, '__none__')
  assert.equal(withExtra.projectGroup, '__none__')
  assert.equal(withExtra.appNumber, 'XYZ')
  assert.equal(withExtra.handler, 'alice')
  assert.equal(withExtra.mine, true)

  const allNone = normalizeScopeSelection(selection({
    productDomain: '__none__',
    businessArea: '__none__',
    projectGroup: '__none__',
  }), fixture())
  assert.equal(allNone.productDomain, '__none__')
  assert.equal(allNone.businessArea, '__none__')
  assert.equal(allNone.projectGroup, '__none__')
})

test('范围说明：`__none__` 显示「未归属」', () => {
  const text = scopeSummaryText(selection({
    productDomain: '__none__',
    projectGroup: '__none__',
  }), fixture(), [])
  assert.match(text, /产品领域：未归属/)
  assert.match(text, /项目组：未归属/)
})

test('范围说明：未选领域时回显后端生效领域，选中时展示各级名称', () => {
  const text = scopeSummaryText(selection(), fixture(), ['集团财务'])
  assert.match(text, /星瀚/)
  assert.match(text, /2026年10月/)
  assert.match(text, /产品领域：集团财务（默认）/)

  const selected = scopeSummaryText(selection({
    productDomain: '集团财务',
    businessArea: '__none__',
    projectGroup: 'PM1111',
  }), fixture(), ['集团财务'])
  assert.match(selected, /产品领域：集团财务/)
  assert.match(selected, /业务领域：未分业务领域/)
  assert.match(selected, /项目组：集团财务技术测试组/)

  assert.equal(scopeSummaryText(selection({ productLine: '', iterationId: '' }), null, []), '全部范围')
})
