/**
 * 「配置检查 / 白名单」页纯规则的单测（node:test，无 Vue / 请求依赖）。
 *
 * 仓库没有 vitest 配置，沿用 `releaseCoverageRules.spec.ts` 的做法：
 * 由 tsc 编译到临时目录后交给 node 的测试运行器执行。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { ConfigItem, ConfigRuleDef, ReleaseWaiver } from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  configEventLabel,
  configQueryOf,
  configSeverityMeta,
  configStateMeta,
  configSummaryQueryOf,
  exemptKeyOf,
  exemptRequestOf,
  matchTypeLabel,
  rulesOfFamily,
  ruleTooltipText,
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
    ...patch,
  }
}

test('规则按页签过滤 family，保持后端顺序', () => {
  const rules = [rule('M01', 'meta'), rule('M02', 'meta'), rule('C01', 'api')]
  assert.deepEqual(rulesOfFamily(rules, 'meta').map(def => def.code), ['M01', 'M02'])
  assert.deepEqual(rulesOfFamily(rules, 'api').map(def => def.code), ['C01'])
  assert.deepEqual(rulesOfFamily([], 'api'), [])
})

test('列表查询：空筛选项不下发，关键词 trim，状态与范围总是下发', () => {
  const query = configQueryOf({
    iterationId: 'it-1',
    scope: 'domain',
    ruleCode: ' M01 ',
    projectGroup: '',
    state: 'open',
    severity: '',
    keyword: '  总账 ',
    newOnly: false,
  }, 2, 50)
  assert.deepEqual(query, {
    iteration_id: 'it-1',
    scope: 'domain',
    rule_code: 'M01',
    state: 'open',
    keyword: '总账',
    page_num: 2,
    page_size: 50,
  })
  assert.equal('project_group' in query, false)
  assert.equal('severity' in query, false)
  assert.equal('new_only' in query, false)
})

test('列表查询：全部状态与只看新增照原样下发', () => {
  const query = configQueryOf({
    iterationId: '',
    scope: 'all',
    ruleCode: '',
    projectGroup: 'GL',
    state: 'all',
    severity: 'high',
    keyword: '',
    newOnly: true,
  }, 1, 20)
  assert.deepEqual(query, {
    scope: 'all',
    project_group: 'GL',
    state: 'all',
    severity: 'high',
    new_only: true,
    page_num: 1,
    page_size: 20,
  })
  assert.equal('iteration_id' in query, false)
  assert.equal('rule_code' in query, false)
})

test('汇总查询只带范围，不迭代时不下发 iteration_id', () => {
  assert.deepEqual(configSummaryQueryOf('it-1', 'domain'), { iteration_id: 'it-1', scope: 'domain' })
  assert.deepEqual(configSummaryQueryOf('', 'all'), { scope: 'all' })
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
