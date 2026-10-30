/**
 * 安全测试域页面之间的穿透跳转。
 *
 * 路由名 = sys_menu.path（见 permission store：`name: menu.path`），
 * 所以这里只维护「页面 → 路由名」与 query 键，完整 URL 由菜单树决定。
 * 各页面统一用 `router.push(toXxx(...))`，路径与参数名只在本文件出现一次。
 *
 * 接收方只在进入时读一次 query（与 `useReleaseCoverage.applyRouteFilters` 一致），
 * 之后用户在页面里的操作不再受地址栏影响。
 */
import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'

const ROUTES = {
  runs: 'scan-runs',
  tasks: 'scan-task-list',
  suites: 'regression-suites',
  apiResults: 'api-test-results',
  formResults: 'form-results',
} as const

/** 表单域用例前缀：表单权限/注入/URL 直达 + 元数据静态检查 */
const FORM_CASE_PREFIXES = ['form_', 'meta_']

function text(value?: string | null): string {
  return (value ?? '').trim()
}

/** 路由 query 值可能是数组；取第一个并裁剪空白 */
export function firstQueryText(value: unknown): string {
  if (Array.isArray(value))
    return firstQueryText(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

/** 空值直接省略，避免地址栏出现 `?task_id=` 这类无意义参数 */
function compactQuery(entries: Record<string, string | null | undefined>): LocationQueryRaw {
  const query: LocationQueryRaw = {}
  for (const [key, raw] of Object.entries(entries)) {
    const value = text(raw)
    if (value)
      query[key] = value
  }
  return query
}

/** 执行记录页：带 run_id 直接打开该运行结果 */
export function toRunResults(runId?: string | null): RouteLocationRaw {
  return { name: ROUTES.runs, query: compactQuery({ run_id: runId }) }
}

/** 执行记录页：只看某个任务的运行 */
export function toTaskRuns(taskId?: string | null): RouteLocationRaw {
  return { name: ROUTES.runs, query: compactQuery({ task_id: taskId }) }
}

/** 执行记录页：只看某个回归套件下环境任务的运行（后端支持 suite_id） */
export function toSuiteRuns(suiteId?: string | null, suiteName?: string | null): RouteLocationRaw {
  return {
    name: ROUTES.runs,
    query: compactQuery({ suite_id: suiteId, suite_name: suiteName }),
  }
}

/** 扫描任务页：定位 / 过滤某个任务 */
export function toTask(taskId?: string | null): RouteLocationRaw {
  return { name: ROUTES.tasks, query: compactQuery({ task_id: taskId }) }
}

/** 回归套件页：按套件编码过滤 */
export function toSuite(suiteCode?: string | null): RouteLocationRaw {
  return { name: ROUTES.suites, query: compactQuery({ suite_code: suiteCode }) }
}

/** API 测试结果页：直接打开某接口详情；缺路径时没有可跳目标 */
export function toApiResult(apiPath: string, httpMethod?: string | null, envId?: string | null): RouteLocationRaw | null {
  const path = text(apiPath)
  if (!path)
    return null
  return {
    name: ROUTES.apiResults,
    query: compactQuery({
      api_path: path,
      http_method: text(httpMethod).toUpperCase(),
      env_id: envId,
    }),
  }
}

/** 表单测试结果页：直接打开某表单详情；缺表单编码时没有可跳目标 */
export function toFormResult(formNumber?: string | null): RouteLocationRaw | null {
  const number = text(formNumber)
  if (!number)
    return null
  return { name: ROUTES.formResults, query: { form_number: number } }
}

/** `entity_number` 可能带冒号后缀（如 `AR_receivable:001`），表单编码取冒号前部分 */
export function formNumberFromEntityNumber(entityNumber?: string | null): string {
  const raw = text(entityNumber)
  if (!raw)
    return ''
  const [head] = raw.split(':')
  return text(head)
}

/** 用例类型是否属于表单域（表单权限/注入/URL 直达 + 元数据检查） */
export function isFormCaseType(caseType?: string | null): boolean {
  const value = text(caseType)
  return FORM_CASE_PREFIXES.some(prefix => value.startsWith(prefix))
}

export interface CaseLinkFields {
  case_type?: string | null
  entity_number?: string | null
  api_path?: string | null
  http_method?: string | null
}

/**
 * 执行结果 / 用例行 → 对应测试结果详情：
 * API 用例（有 api_path）优先，其次表单域用例，其余（如脚本无路径）不可跳。
 */
export function caseResultLink(record?: CaseLinkFields | null): RouteLocationRaw | null {
  if (!record)
    return null
  if (text(record.api_path))
    return toApiResult(record.api_path ?? '', record.http_method)
  if (!isFormCaseType(record.case_type))
    return null
  return toFormResult(formNumberFromEntityNumber(record.entity_number))
}
