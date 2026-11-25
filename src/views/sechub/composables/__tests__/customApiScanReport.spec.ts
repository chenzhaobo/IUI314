/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置，单测只用 Node 内置 test runner */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCustomApiReportIndex, customApiReportOverview, reportSectionsForItem } from '../customApiScanReport.ts'

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

test('证据和利用方式加粗标题不会截断完整问题正文', () => {
  const report = `## A1 · POST /kapi/v2/ccm/deleteJournals（信用流水删除）

### 3. 发现的问题与证据

#### F1（high，confirmed）越权

**证据 1：入口参数完全由调用方决定**
证据一完整代码与说明。

**证据 2：删除过滤条件不含组织**
证据二完整代码与说明。

**证据 3：直接下沉到删除服务**
证据三完整代码与说明。

**证据 4：服务层没有权限校验**
证据四完整代码与说明。

**利用方式**
构造请求即可删除任意组织的数据。

#### F2（medium，confirmed）异常原文回传
F2 完整代码与说明。

### 4. 已排除项
这些内容不属于发现的问题。

### 5. 修复建议
1. 补齐组织与数据权限校验。
`
  const sections = reportSectionsForItem(buildCustomApiReportIndex(report), {
    call_path: '/kapi/v2/ccm/deleteJournals',
    http_method: 'POST',
  })

  for (const expected of ['F1', '证据 1', '证据一完整', '证据 2', '证据二完整', '证据 3', '证据三完整', '证据 4', '证据四完整', '利用方式', 'F2 完整'])
    assert.match(sections.findings, new RegExp(expected))
  assert.doesNotMatch(sections.findings, /已排除项|修复建议/)
  assert.match(sections.excluded, /这些内容不属于发现的问题/)
  assert.match(sections.fixSuggestions, /补齐组织与数据权限校验/)
})

test('检测报告弹窗只保留检测结果总览', () => {
  const markdown = `# 自定义API测试报告

## 检测结果总览
| # | 调用路径 | 结论 |
| 1 | /kapi/demo | confirmed |

---

## AI 扫描报告 · 代码库
## A1 · POST /kapi/demo
### 3. 发现的问题与证据
完整漏洞详情不应继续显示在总览页。
`
  const overview = customApiReportOverview(markdown)
  assert.match(overview, /检测结果总览/)
  assert.match(overview, /\/kapi\/demo/)
  assert.doesNotMatch(overview, /AI 扫描报告|完整漏洞详情/)
})
