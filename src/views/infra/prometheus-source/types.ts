/**
 * Prometheus 数据源页的 DTO、枚举与展示口径（后端 `PrometheusVo` / `PrometheusReq` 的前端镜像）。
 *
 * 分层同 sechub/static-scan 样板：本文件只放类型、常量与纯函数，
 * 取数在 ./service，页面状态在 ./usePrometheusSource。
 */
import type { SelectOption } from '@/types/static-scan'

/** 后端 PrometheusVo 的前端镜像；出参不含凭据，只有 has_credential 标记 */
export interface PrometheusRow {
  id: string
  code: string
  name: string
  base_url: string
  /** container | host_middleware */
  purpose: string
  /** none | basic | bearer */
  auth_type: string
  username?: string | null
  /** container 用途关联的 K8s 集群 */
  cluster_id?: string | null
  status: string
  verified_at?: string | null
  verify_error?: string | null
  /** 测试连接回写的 buildinfo（约 = {version}） */
  build_info?: Record<string, unknown> | null
  remark?: string | null
  create_by: string
  update_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  has_credential: boolean
}

/** 列表响应（后端 ListData<T> 的前端视图） */
export interface PrometheusListPage {
  list: PrometheusRow[]
  total: number
}

export interface PrometheusListFilter {
  keyword: string
  purpose: string
}

export interface PrometheusListQuery extends PrometheusListFilter {
  page_num: number
  page_size: number
}

export const PROMETHEUS_DEFAULT_FILTER: PrometheusListFilter = { keyword: '', purpose: '' }

export const PROMETHEUS_PAGE_SIZE = 10

/** 测试连接结果（后端 TestResult；失败也是一条正常结果，不是请求错误） */
export interface SourceTestResult {
  ok: boolean
  detail?: string
  error?: string
}

/** 集群下拉的最小视图（取 /infra/k8s-cluster/list，只用到 id 与显示名） */
export interface ClusterOptionRow {
  id: string
  name: string
  code: string
}

/** 用途（后端 purpose：container | host_middleware，缺省 container） */
export const PROMETHEUS_PURPOSE_OPTIONS: SelectOption[] = [
  { label: '容器（K8s 集群）', value: 'container' },
  { label: '主机与中间件（PMM）', value: 'host_middleware' },
]

/** 鉴权方式（后端 auth_type：none | basic | bearer，缺省 none） */
export const PROMETHEUS_AUTH_TYPE_OPTIONS: SelectOption[] = [
  { label: '无认证', value: 'none' },
  { label: 'Basic 认证', value: 'basic' },
  { label: 'Bearer 令牌', value: 'bearer' },
]

export function promPurposeLabel(purpose: string): string {
  return PROMETHEUS_PURPOSE_OPTIONS.find(option => option.value === purpose)?.label ?? purpose
}

export function promAuthTypeLabel(authType: string): string {
  return PROMETHEUS_AUTH_TYPE_OPTIONS.find(option => option.value === authType)?.label ?? authType
}

/** 连通状态：verify_error 优先（最近一次测试失败），其次 verified_at，都没有 = 未测试 */
export function promVerifyLabel(row: PrometheusRow): string {
  if (row.verify_error)
    return '失败'
  if (row.verified_at)
    return '已验证'
  return '未测试'
}

export function promVerifyColor(row: PrometheusRow): string {
  if (row.verify_error)
    return 'red'
  if (row.verified_at)
    return 'green'
  return 'gray'
}

/** build_info.version：后端测试连接成功后回写；形状异常时不猜，返回空串 */
export function promBuildVersion(row: PrometheusRow): string {
  const info = row.build_info
  if (!info || typeof info !== 'object' || Array.isArray(info))
    return ''
  const version = (info as Record<string, unknown>).version
  return typeof version === 'string' ? version : ''
}

/** 新增/编辑表单（credential 明文只存在于表单里） */
export interface PrometheusForm {
  id: string
  code: string
  name: string
  base_url: string
  purpose: string
  auth_type: string
  username: string
  credential: string
  cluster_id: string
  remark: string
}

export function emptyPrometheusForm(): PrometheusForm {
  return {
    id: '',
    code: '',
    name: '',
    base_url: '',
    purpose: 'container',
    auth_type: 'none',
    username: '',
    credential: '',
    cluster_id: '',
    remark: '',
  }
}

/** 编辑表单：凭据留空 —— 留空 = 不修改（后端按字段缺省保留旧值） */
export function prometheusFormOf(row: PrometheusRow): PrometheusForm {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base_url: row.base_url,
    purpose: row.purpose || 'container',
    auth_type: row.auth_type || 'none',
    username: row.username ?? '',
    credential: '',
    cluster_id: row.cluster_id ?? '',
    remark: row.remark ?? '',
  }
}

/** auth_type = basic 才需要用户名；none 不需要，bearer 只要令牌 */
export function promNeedsUsername(authType: string): boolean {
  return authType === 'basic'
}

/** auth_type 除 none 外都要输入凭据（密码 / 令牌） */
export function promNeedsCredential(authType: string): boolean {
  return authType !== 'none'
}

/** 表单 → 请求体；新增不带 id，凭据留空时不出现该键（后端据此保留旧值） */
export function buildPrometheusPayload(form: PrometheusForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    code: form.code.trim(),
    name: form.name.trim(),
    base_url: form.base_url.trim(),
    purpose: form.purpose,
    auth_type: form.auth_type,
    // 后端编辑时这两列整列覆写，必须显式发送（空 = 清空）
    username: promNeedsUsername(form.auth_type) ? form.username.trim() || null : null,
    cluster_id: form.cluster_id || null,
    remark: form.remark.trim() || null,
  }
  if (form.id)
    payload.id = form.id
  if (form.credential)
    payload.credential = form.credential
  return payload
}
