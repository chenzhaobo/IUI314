/**
 * Monitor（eye）数据源页的 DTO、枚举与展示口径（后端 `MonitorSourceVo` / `MonitorSourceReq` 的前端镜像）。
 *
 * 分层同 k8s-cluster / prometheus-source：本文件只放类型、常量与纯函数，
 * 取数在 ./service，页面状态在 ./useMonitorSource。
 */

/** 后端 MonitorSourceVo 的前端镜像；出参不含密码，只有 has_credential 标记 */
export interface MonitorSourceRow {
  id: string
  code: string
  name: string
  base_url: string
  username: string
  /** 对应部署标签 cluster（如 fi_sit） */
  cluster_label?: string | null
  /** 测试连接回写的单次采样上限（秒） */
  max_sample_seconds?: number | null
  /** 测试连接回写的火焰图保留天数 */
  max_store_days?: number | null
  status: string
  verified_at?: string | null
  verify_error?: string | null
  remark?: string | null
  create_by: string
  update_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  has_credential: boolean
}

/** 列表响应（后端 ListData<T> 的前端视图） */
export interface MonitorSourceListPage {
  list: MonitorSourceRow[]
  total: number
}

export interface MonitorSourceListFilter {
  keyword: string
}

export interface MonitorSourceListQuery extends MonitorSourceListFilter {
  page_num: number
  page_size: number
}

export const MONITOR_SOURCE_DEFAULT_FILTER: MonitorSourceListFilter = { keyword: '' }

export const MONITOR_SOURCE_PAGE_SIZE = 10

/** 测试连接结果（后端 TestResult；登录失败也是一条正常结果，不是请求错误） */
export interface SourceTestResult {
  ok: boolean
  detail?: string
  error?: string
}

/** 连通状态：verify_error 优先（最近一次测试失败），其次 verified_at，都没有 = 未测试 */
export function monVerifyLabel(row: MonitorSourceRow): string {
  if (row.verify_error)
    return '失败'
  if (row.verified_at)
    return '已验证'
  return '未测试'
}

export function monVerifyColor(row: MonitorSourceRow): string {
  if (row.verify_error)
    return 'red'
  if (row.verified_at)
    return 'green'
  return 'gray'
}

/** 采样上限列：测试连接回写前为空 */
export function monSampleLimitText(row: MonitorSourceRow): string {
  return row.max_sample_seconds == null ? '—' : `${row.max_sample_seconds}s`
}

/** 火焰图保留天数列：测试连接回写前为空 */
export function monStoreDaysText(row: MonitorSourceRow): string {
  return row.max_store_days == null ? '—' : `${row.max_store_days}天`
}

/**
 * 页面提示：Monitor 侧火焰图仅保留 N 天，平台会自动归档（spec R13：Monitor 侧过期后
 * 由依赖其自动清理，平台归档保留 180 天，不需要人工抢时间下载）。
 *
 * N 取已回写数据源里的最大值（多源时按最宽口径说，不把短保留期夸大成整体约束）；
 * 一条都没测过（max_store_days 为空）时不带天数 —— 那是「未知」而不是「0 天」。
 */
export function monitorRetentionHint(rows: MonitorSourceRow[]): string {
  const days = rows
    .map(row => row.max_store_days)
    .filter((value): value is number => typeof value === 'number' && value > 0)
  if (!days.length)
    return 'Monitor 侧火焰图有保留期限（测试连接成功后回写天数），平台会自动归档'
  return `Monitor 侧火焰图仅保留 ${Math.max(...days)} 天，平台会自动归档`
}

/** 新增/编辑表单（credential 明文只存在于表单里） */
export interface MonitorSourceForm {
  id: string
  code: string
  name: string
  base_url: string
  username: string
  credential: string
  cluster_label: string
  remark: string
}

export function emptyMonitorSourceForm(): MonitorSourceForm {
  return {
    id: '',
    code: '',
    name: '',
    base_url: '',
    username: '',
    credential: '',
    cluster_label: '',
    remark: '',
  }
}

/** 编辑表单：密码留空 —— 留空 = 不修改（后端按字段缺省保留旧值） */
export function monitorSourceFormOf(row: MonitorSourceRow): MonitorSourceForm {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base_url: row.base_url,
    username: row.username,
    credential: '',
    cluster_label: row.cluster_label ?? '',
    remark: row.remark ?? '',
  }
}

/**
 * 表单 → 请求体；新增不带 id，密码留空时不出现该键（后端据此保留旧值）。
 *
 * cluster_label / remark 后端编辑时整列覆写，必须显式发送（空 = 清空）；
 * code / name / base_url / username 后端 validate 都要求非空，前端不另做预检，
 * 让拦截器统一弹后端的中文原因。
 */
export function buildMonitorSourcePayload(form: MonitorSourceForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    code: form.code.trim(),
    name: form.name.trim(),
    base_url: form.base_url.trim(),
    username: form.username.trim(),
    cluster_label: form.cluster_label.trim() || null,
    remark: form.remark.trim() || null,
  }
  if (form.id)
    payload.id = form.id
  if (form.credential)
    payload.credential = form.credential
  return payload
}
