/**
 * API 测试（概览 / 用例 / 结果）共用常量与工具
 *
 * 单独抽出来是为了让三个页面与两个抽屉共用同一套取值映射，
 * 避免"同一个枚举在五个文件里各写一份、改一处漏四处"。
 */

/** 32 位主键列（CHAR(32)）里存的是 scru128 字符串：26 位、字母表 0-9a-v */
const SCRU_ALPHABET = '0123456789abcdefghijklmnopqrstuv'
const SCRU_LEN = 26

/**
 * 本地生成一个 scru128 形态的用例 id（新建用例时随模型一起提交）。
 *
 * 后端 `sec_case::add` 对空 id 会自行生成；这里显式给一个是为了满足
 * 「id 可传新 id」的新契约（幂等重放/前后端对账时能对上）。
 * crypto 不可用时退回 Math.random —— 只要求唯一，不做安全用途。
 */
export function newCaseId(): string {
  const bytes = new Uint8Array(SCRU_LEN)
  const c = globalThis.crypto
  if (typeof c?.getRandomValues === 'function') {
    c.getRandomValues(bytes)
  }
  else {
    for (let i = 0; i < SCRU_LEN; i++)
      bytes[i] = (Math.random() * 256) | 0
  }
  let out = '0'
  for (let i = 1; i < SCRU_LEN; i++)
    out += SCRU_ALPHABET[bytes[i] % 32]
  return out
}

/** 用例ID展示：业务用例ID优先，没有就退回主键后 8 位（避免把 26 位乱码铺满表格） */
export function caseIdText(record: any): string {
  if (!record)
    return '--'
  return record.case_code || (record.id ? String(record.id).slice(-8) : '--')
}

/** 用例类型（sec_sec_case.case_type） */
export const CASE_TYPE_LABELS: Record<string, string> = {
  form_perm: '表单权限',
  form_inject: '表单注入',
  openapi_perm: 'OpenAPI权限',
  openapi_inject: 'OpenAPI注入',
  script: 'Python脚本',
}

/** 测试类型（sec_sec_case.test_type） */
export const TEST_TYPE_LABELS: Record<string, string> = {
  perm: '权限',
  anon: '未鉴权访问',
  xss: 'XSS注入',
  sqli: 'SQL注入',
  java_reflect: 'Java反射',
  idor: '越权(IDOR)',
  base: '正向基线',
  robustness: '健壮性',
}

/** 测试角色：ALL=全量账号 / LIM=受限账号 / NONE=无权限账号 */
export const TEST_ROLE_OPTIONS = [
  { value: 'ALL', label: 'ALL（全量账号）' },
  { value: 'LIM', label: 'LIM（受限账号）' },
  { value: 'NONE', label: 'NONE（无权限账号）' },
]
export const TEST_ROLE_LABELS: Record<string, string> = {
  ALL: 'ALL 全量',
  LIM: 'LIM 受限',
  NONE: 'NONE 无权限',
}

/** 执行方式（sec_sec_case.exec_mode） */
export const EXEC_MODE_LABELS: Record<string, string> = {
  orchestration: '平台编排',
  script: 'Python脚本',
  python: 'Python脚本',
  hybrid: '混合',
}

/**
 * 断言类型（sec_sec_case.assertion）：平台编排用例执行后按哪种语义判定。
 * tooltip 的说明与执行器里的判定逻辑一一对应。
 */
export const ASSERTION_OPTIONS = [
  { value: 'denied', label: '被拒', tip: '响应被服务端拒绝（403 / 明确的拒绝文案）→ 权限控制生效' },
  { value: 'empty_or_denied', label: '空或被拒', tip: '返回空数据或被拒都算通过（接口会按角色过滤数据）' },
  { value: 'total_consistent', label: '总数一致', tip: 'NONE 的响应总量应与 ALL 一致（数据级过滤生效），用于统计类接口' },
  { value: 'timed_out', label: '超时', tip: '接口在限定时间内未返回（导出/重计算类接口视为被拒）' },
  { value: 'empty', label: '数据为空', tip: '必须返回空数据（NONE 不应看到任何业务数据）' },
  { value: 'custom', label: '自定义文本', tip: '按「期望提示」里的文本判定响应是否命中' },
]
export const ASSERTION_LABELS: Record<string, string> = Object.fromEntries(
  ASSERTION_OPTIONS.map(o => [o.value, o.label]),
)

/** 期望判定（sec_sec_case.expected_verdict）：与结果表的 verdict 同一取值域 */
export const VERDICT_OPTIONS = ['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']

export const VERDICT_COLOR: Record<string, string> = {
  PASS: 'green',
  FAIL: 'red',
  REVIEW: 'orange',
  BLOCKED: 'gray',
  ERROR: 'orangered',
}
export function verdictColor(v?: string | null) {
  return VERDICT_COLOR[v || ''] ?? 'gray'
}
