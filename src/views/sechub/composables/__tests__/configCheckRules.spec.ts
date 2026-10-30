/**
 * 「配置检查 / 白名单」页纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseCoverageRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type {
  ConfigGroupStat,
  ConfigItem,
  ConfigRuleDef,
  ConfigRuleStat,
  ConfigTotals,
  ReleaseWaiver,
} from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  activeSummaryCellOf,
  configDefectLink,
  configEventLabel,
  configFieldsMapOf,
  configHandlingMeta,
  configItemsQueryOf,
  configRuleGroupsOf,
  configSeverityMeta,
  configStateMeta,
  configSummaryQueryOf,
  exemptKeyOf,
  exemptRequestOf,
  groupDistributionOf,
  latestScanAt,
  matchTypeLabel,
  ruleRowsOf,
  ruleTooltipText,
  summaryCellPresetOf,
  validateExemptForm,
  validateWaiverReason,
  waiverRequestOf,
  waiverStatusMeta,
} from '../configCheckRules'

function rule(code: string, family: 'meta' | 'api'): ConfigRuleDef {
  return {
    code,
    family,
    object_type: 'form',
    title: `${code} 标题`,
    severity: 'high',
    description: `${code} 说明`,
    fix_hint: `${code} 修复`,
    in_conclusion: true,
  }
}

function waiver(patch: Partial<ReleaseWaiver>): ReleaseWaiver {
  return {
    id: 'W1',
    env_id: null,
    rule_code: 'M01',
    match_type: 'exact',
    object_key: 'F1',
    reason: '合规豁免',
    expires_at: null,
    created_by: 'u1',
    created_at: null,
    revoked_by: null,
    revoked_at: null,
    revoke_reason: null,
    active: true,
    ...patch,
  }
}

function item(patch: Partial<ConfigItem>): ConfigItem {
  return {
    id: 'I1',
    env_id: ' env-1 ',
    product_line: 'PL',
    rule_code: ' M01 ',
    object_type: 'form',
    object_key: ' F1 ',
    object_name: null,
    app_number: null,
    app_name: null,
    project_group_code: null,
    project_group_name: null,
    product_domain: null,
    state: 'open',
    severity: 'high',
    evidence_json: {},
    evidence_digest: 'd1',
    first_seen_at: '2026-10-01T00:00:00+08:00',
    last_seen_at: '2026-10-02T00:00:00+08:00',
    resolved_at: null,
    last_run_id: null,
    created_at: null,
    updated_at: null,
    is_new: false,
    rule_title: null,
    rule_description: null,
    fix_hint: null,
    object_type_label: '表单',
    handling: 'pending',
    handling_label: '待处理',
    defect: null,
    ...patch,
  }
}

function ruleStat(patch: Partial<ConfigRuleStat> = {}): ConfigRuleStat {
  return {
    rule_code: 'M01',
    title: 'M01 标题',
    severity: 'high',
    description: 'M01 说明',
    fix_hint: 'M01 修复',
    open: 0,
    waived: 0,
    resolved: 0,
    pending: 0,
    defect_filed: 0,
    new_open: 0,
    fixed_in_iteration: 0,
    ...patch,
  }
}

function groupStat(patch: Partial<ConfigGroupStat> = {}): ConfigGroupStat {
  return {
    project_group_code: 'GL',
    project_group_name: '总账项目组',
    open: 0,
    waived: 0,
    high_open: 0,
    new_open: 0,
    ...patch,
  }
}

function totals(patch: Partial<ConfigTotals> = {}): ConfigTotals {
  return {
    open: 0,
    waived: 0,
    high_open: 0,
    pending: 0,
    defect_filed: 0,
    new_open: 0,
    fixed_in_iteration: 0,
    ...patch,
  }
}

test('规则行：按规则定义顺序合并统计，未命中规则计数为 0', () => {
  const rows = ruleRowsOf(
    [rule('M01', 'meta'), rule('M02', 'meta'), rule('C01', 'api')],
    [ruleStat({
      rule_code: 'M01',
      title: '后端统计标题',
      severity: 'low',
      description: '统计说明',
      fix_hint: '统计修复',
      open: 3,
      pending: 2,
      defect_filed: 1,
      new_open: 1,
    })],
  )
  assert.deepEqual(rows.map(row => row.code), ['M01', 'M02', 'C01'])
  assert.equal(rows[0].pending, 2)
  assert.equal(rows[0].defect_filed, 1)
  assert.equal(rows[0].new_open, 1)
  assert.equal(rows[0].title, 'M01 标题', '标题 / 说明以规则定义为准')
  assert.equal(rows[0].description, 'M01 说明')
  assert.equal(rows[0].fix_hint, 'M01 修复')
  assert.equal(rows[1].pending, 0)
  assert.equal(rows[2].family, 'api')
})

test('规则分组：元数据规则在前、清单规则在后', () => {
  const groups = configRuleGroupsOf(ruleRowsOf(
    [rule('M01', 'meta'), rule('C01', 'api')],
    [],
  ))
  assert.deepEqual(groups.map(group => group.family), ['meta', 'api'])
  assert.deepEqual(groups.map(group => group.label), ['元数据规则（M）', '清单规则（C）'])
  assert.deepEqual(groups[0].rows.map(row => row.code), ['M01'])
  assert.deepEqual(groups[1].rows.map(row => row.code), ['C01'])
})

test('明细查询：范围与筛选按后端字段下发，空值不下发', () => {
  const query = configItemsQueryOf(
    { ruleCode: ' M01 ', handling: 'open', severity: '', keyword: '  总账 ', newOnly: true },
    {
      product_line: 'gan',
      iteration_id: 'it-1',
      product_domains: '集团财务',
      business_area: '共享',
      project_group: 'PM013',
    },
    2,
    50,
  )
  assert.deepEqual(query, {
    product_line: 'gan',
    iteration_id: 'it-1',
    product_domains: '集团财务',
    business_area: '共享',
    project_group: 'PM013',
    rule_code: 'M01',
    handling: 'open',
    keyword: '总账',
    new_only: true,
    page_num: 2,
    page_size: 50,
  })
  assert.equal('severity' in query, false)
})

test('明细查询：空范围与空筛选不下发', () => {
  const query = configItemsQueryOf(
    { ruleCode: '', handling: 'pending', severity: 'high', keyword: '', newOnly: false },
    {},
    1,
    20,
  )
  assert.deepEqual(query, {
    handling: 'pending',
    severity: 'high',
    page_num: 1,
    page_size: 20,
  })
})

test('汇总查询：domain 口径 + 范围字段', () => {
  assert.deepEqual(
    configSummaryQueryOf({ product_line: 'gan', iteration_id: 'it-1' }),
    { scope: 'domain', product_line: 'gan', iteration_id: 'it-1' },
  )
  assert.deepEqual(configSummaryQueryOf({}), { scope: 'domain' })
})

test('汇总点击映射明细筛选：新增=未关闭+只看新增，修复=已修复', () => {
  assert.deepEqual(summaryCellPresetOf('pending'), { handling: 'pending', newOnly: false })
  assert.deepEqual(summaryCellPresetOf('defect_filed'), { handling: 'defect_filed', newOnly: false })
  assert.deepEqual(summaryCellPresetOf('new_open'), { handling: 'open', newOnly: true })
  assert.deepEqual(summaryCellPresetOf('fixed_in_iteration'), { handling: 'resolved', newOnly: false })
})

test('当前汇总高亮：只有与预设一致的组合才高亮', () => {
  assert.equal(activeSummaryCellOf({ handling: 'open', newOnly: false }), '')
  assert.equal(activeSummaryCellOf({ handling: 'open', newOnly: true }), 'new_open')
  assert.equal(activeSummaryCellOf({ handling: 'pending', newOnly: false }), 'pending')
  assert.equal(activeSummaryCellOf({ handling: 'waived', newOnly: false }), 'waived')
  assert.equal(activeSummaryCellOf({ handling: 'resolved', newOnly: false }), 'fixed_in_iteration')
  assert.equal(activeSummaryCellOf({ handling: 'resolved', newOnly: true }), '')
})

test('项目组分布：只保留有待处理的小组，未归属组不可点', () => {
  const rows = groupDistributionOf([
    groupStat({ project_group_code: 'GL', project_group_name: '总账项目组', open: 3, high_open: 1, new_open: 2 }),
    groupStat({ project_group_code: '', project_group_name: '', open: 2 }),
    groupStat({ project_group_code: 'AR', project_group_name: '应收项目组', open: 0, waived: 5 }),
  ])
  assert.deepEqual(rows.map(row => row.code), ['GL', ''])
  assert.equal(rows[0].name, '总账项目组')
  assert.equal(rows[0].selectable, true)
  assert.equal(rows[0].high_open, 1)
  assert.equal(rows[0].new_open, 2)
  assert.equal(rows[1].name, '未分类')
  assert.equal(rows[1].selectable, false)
})

test('缺陷跳转：编码转义，产品线非空才带', () => {
  assert.equal(
    configDefectLink('REL-0001', 'gan'),
    '/sechub/release/release-defects?keyword=REL-0001&product_line=gan',
  )
  assert.equal(
    configDefectLink('A B', ''),
    '/sechub/release/release-defects?keyword=A%20B',
  )
})

test('最近检查时间：取两个维度的最大值', () => {
  assert.equal(
    latestScanAt({ meta: '2026-10-01T09:00:00+08:00', api: '2026-10-03T09:00:00+08:00' }),
    '2026-10-03T09:00:00+08:00',
  )
  assert.equal(latestScanAt({ meta: null, api: '2026-10-03T09:00:00+08:00' }), '2026-10-03T09:00:00+08:00')
  assert.equal(latestScanAt({ meta: null, api: null }), null)
  assert.equal(latestScanAt(null), null)
})

test('字段说明表：按 key 建索引', () => {
  const map = configFieldsMapOf([
    { key: 'object', label: '对象', description: '命中的对象' },
    { key: 'handling', label: '处理状态', description: '待处理 / 已提缺陷' },
  ])
  assert.equal(map.object?.label, '对象')
  assert.equal(map.handling?.description, '待处理 / 已提缺陷')
})

test('处理状态文案：四种状态与未知值', () => {
  assert.deepEqual(configHandlingMeta('pending'), { label: '待处理', color: 'orange' })
  assert.deepEqual(configHandlingMeta('defect_filed'), { label: '已提缺陷', color: 'arcoblue' })
  assert.deepEqual(configHandlingMeta('waived'), { label: '已加白', color: 'gray' })
  assert.deepEqual(configHandlingMeta('resolved'), { label: '已修复', color: 'green' })
  assert.deepEqual(configHandlingMeta('other'), { label: 'other', color: 'gray' })
})

test('汇总计数：待处理与已提缺陷分开', () => {
  const value = totals({ pending: 3, defect_filed: 2, new_open: 1, fixed_in_iteration: 4 })
  assert.equal(value.pending, 3)
  assert.equal(value.defect_filed, 2)
  assert.equal(value.new_open, 1)
  assert.equal(value.fixed_in_iteration, 4)
})

test('白名单原因至少 4 个字符，纯空白算未填', () => {
  assert.equal(validateWaiverReason(''), '白名单原因至少 4 个字符')
  assert.equal(validateWaiverReason('   '), '白名单原因至少 4 个字符')
  assert.equal(validateWaiverReason('abc'), '白名单原因至少 4 个字符')
  assert.equal(validateWaiverReason('  合规豁免 '), null)
})

test('加白入参：trim 规则与对象，环境取检查项，到期为空不下发', () => {
  const created = waiverRequestOf(item({}), { matchType: 'exact', reason: '  合规豁免 ', expiresAt: '' })
  assert.deepEqual(created, {
    env_id: 'env-1',
    rule_code: 'M01',
    match_type: 'exact',
    object_key: 'F1',
    reason: '合规豁免',
  })

  const withExpiry = waiverRequestOf(item({}), {
    matchType: 'app',
    reason: '应用整体豁免',
    expiresAt: '2027-01-01T00:00:00.000Z',
  })
  assert.equal(withExpiry.match_type, 'app')
  assert.equal(withExpiry.expires_at, '2027-01-01T00:00:00.000Z')
})

test('接口免测 key = PATH|METHOD，方法 trim 后大写', () => {
  assert.equal(exemptKeyOf(' /a/b ', ' get '), '/a/b|GET')
  assert.equal(exemptKeyOf('/a', 'Delete'), '/a|DELETE')
})

test('接口免测表单校验：路径 / 方法 / 原因', () => {
  assert.equal(validateExemptForm({ path: '  ', method: 'GET', reason: '合规豁免', expiresAt: '' }), '接口路径不能为空')
  assert.equal(validateExemptForm({ path: '/a', method: 'PATCH', reason: '合规豁免', expiresAt: '' }), '不支持的 HTTP 方法：PATCH')
  assert.equal(validateExemptForm({ path: '/a', method: 'GET', reason: 'abc', expiresAt: '' }), '接口免测原因至少 4 个字符')
  assert.equal(validateExemptForm({ path: '/a', method: 'POST', reason: '本迭代不回归', expiresAt: '' }), null)
})

test('接口免测入参固定为 API_EXEMPT + exact', () => {
  const req = exemptRequestOf({
    path: ' /order/list ',
    method: ' get ',
    reason: ' 本迭代不回归 ',
    expiresAt: '2027-01-01T00:00:00.000Z',
  })
  assert.deepEqual(req, {
    rule_code: 'API_EXEMPT',
    match_type: 'exact',
    object_key: '/order/list|GET',
    reason: '本迭代不回归',
    expires_at: '2027-01-01T00:00:00.000Z',
  })
  assert.equal('env_id' in req, false)
})

test('状态 / 级别 / 事件文案：已知映射，未知原样返回', () => {
  assert.deepEqual(configStateMeta('open'), { label: '待处理', color: 'red' })
  assert.deepEqual(configStateMeta('waived'), { label: '已加白', color: 'orange' })
  assert.deepEqual(configStateMeta('resolved'), { label: '已修复', color: 'green' })
  assert.deepEqual(configStateMeta('legacy'), { label: 'legacy', color: 'gray' })

  assert.deepEqual(configSeverityMeta('high'), { label: '高', color: 'red' })
  assert.deepEqual(configSeverityMeta('info'), { label: '提示', color: 'gray' })

  assert.equal(configEventLabel('opened'), '首次发现')
  assert.equal(configEventLabel('reopened'), '重新出现')
  assert.equal(configEventLabel('unwaived'), '撤销加白')
  assert.equal(configEventLabel('custom'), 'custom')
})

test('白名单状态：撤销优先，其次是有效与过期', () => {
  assert.deepEqual(waiverStatusMeta(waiver({})), { label: '有效', color: 'green' })
  assert.deepEqual(waiverStatusMeta(waiver({ active: false })), { label: '已过期', color: 'orange' })
  assert.deepEqual(
    waiverStatusMeta(waiver({ active: false, revoked_at: '2026-10-01T00:00:00+08:00' })),
    { label: '已撤销', color: 'gray' },
  )
})

test('规则提示同时包含说明与修复建议', () => {
  const text = ruleTooltipText(rule('M01', 'meta'))
  assert.ok(text.includes('M01 说明'))
  assert.ok(text.includes('修复建议：M01 修复'))
})

test('匹配方式文案', () => {
  assert.equal(matchTypeLabel('exact'), '精确匹配')
  assert.equal(matchTypeLabel('app'), '应用整体加白')
  assert.equal(matchTypeLabel('other'), 'other')
})
