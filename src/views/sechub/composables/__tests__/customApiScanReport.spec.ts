/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomApiReportIndex, reportSectionsForItem } from '../customApiScanReport.ts'

const REPORT = `# 汇总

## A1 · GET /kapi/v2/demo/detail

### 实现定位与调用链

入口 → Service → DB

### 发现的问题与证据

\`\`\`java
QueryServiceHelper.query(id);
\`\`\`

### 修复建议

1. 校验数据归属。

## A2 · POST /kapi/v2/demo/detail

### 调用链

入口 → 标准保存

### 证据代码与排除依据

标准校验链已覆盖。

### 修复建议（非必须）

无需额外修复。

## A3 · GET /kapi/v2/demo/legacy（历史接口）

**调用链**
旧入口 → 旧服务

**发现的问题与证据**
旧报告证据代码。

**修复建议**
补充归属校验。
`

test('按方法和路径提取调用链、问题证据与修复建议', () => {
  const index = buildCustomApiReportIndex(REPORT)
  const getItem = { call_path: '/kapi/v2/demo/detail', http_method: 'get' }
  const postItem = { call_path: '/kapi/v2/demo/detail', http_method: 'POST' }

  const getSections = reportSectionsForItem(index, getItem)
  assert.match(getSections.callChain, /Service → DB/)
  assert.match(getSections.findings, /QueryServiceHelper/)
  assert.match(getSections.fixSuggestions, /校验数据归属/)

  const postSections = reportSectionsForItem(index, postItem)
  assert.match(postSections.callChain, /标准保存/)
  assert.match(postSections.findings, /标准校验链/)
  assert.match(postSections.fixSuggestions, /无需额外修复/)

  const legacySections = reportSectionsForItem(index, { call_path: '/kapi/v2/demo/legacy', http_method: 'GET' })
  assert.match(legacySections.callChain, /旧服务/)
  assert.match(legacySections.findings, /旧报告证据/)
  assert.match(legacySections.fixSuggestions, /归属校验/)
})

test('缺少报告或 API 不匹配时返回空结果', () => {
  const empty = buildCustomApiReportIndex(null)
  const item = { call_path: '/not-found', http_method: 'GET' }
  assert.equal(reportSectionsForItem(empty, item), null)
  assert.equal(reportSectionsForItem(buildCustomApiReportIndex(REPORT), item), null)
})
