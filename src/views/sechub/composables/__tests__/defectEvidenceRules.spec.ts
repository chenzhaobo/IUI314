/**
 * 「缺陷证据」纯规则单测（node:test，无 Vue / 请求依赖）。
 *
 * 覆盖详情抽屉「请求与响应 / 自测脚本」需要的展示规则：请求地址回退、
 * 请求行、实际证据判定与验证脚本文件名（与后端 `verify_script::script_filename` 一致）。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import type { ReleaseRequestEvidence } from '@/types/sechub-release'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  evidenceUrl,
  hasActualEvidence,
  requestLine,
  verifyScriptFilename,
} from '../defectEvidenceRules'

function evidence(overrides: Partial<ReleaseRequestEvidence> = {}): ReleaseRequestEvidence {
  return {
    method: 'POST',
    path: '/kapi/v2/bill',
    role: null,
    headers: [],
    body: null,
    http_status: null,
    elapsed_ms: null,
    response: null,
    from_evidence: false,
    ...overrides,
  }
}

test('验证脚本文件名与后端 script_filename 一致', () => {
  assert.equal(verifyScriptFilename('REL-1a2b3c4d'), 'verify_REL-1a2b3c4d.py')
  assert.equal(verifyScriptFilename(' REL/1 '), 'verify_REL_1.py')
  assert.equal(verifyScriptFilename(''), 'verify_defect.py')
})

test('请求地址优先取 full_url，缺失时回退 request.path', () => {
  assert.equal(evidenceUrl({ full_url: ' http://h/ierp/p ', request: evidence() }), 'http://h/ierp/p')
  assert.equal(evidenceUrl({ full_url: '', request: evidence({ path: '/kapi/v2/bill' }) }), '/kapi/v2/bill')
  assert.equal(evidenceUrl({ full_url: null, request: null }), '')
  assert.equal(evidenceUrl(null), '')
})

test('请求行 = 方法 + 地址；没有 request 时为空串', () => {
  assert.equal(requestLine(evidence(), 'http://h/ierp/kapi/v2/bill'), 'POST http://h/ierp/kapi/v2/bill')
  assert.equal(requestLine(null, 'http://h'), '')
})

test('只有 from_evidence=true 才算实际请求记录', () => {
  assert.equal(hasActualEvidence(evidence({ from_evidence: true })), true)
  assert.equal(hasActualEvidence(evidence()), false)
  assert.equal(hasActualEvidence(null), false)
})
