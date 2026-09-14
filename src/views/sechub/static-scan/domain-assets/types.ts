/**
 * 领域资产（domain asset）页共用类型、标签映射与纯函数。
 *
 * 数据面为安全扫描后端 AS-03 的真实接口族（均已核对后端路由）：
 *   - 列表 / 详情：GET /sechub/domain-assets、GET /sechub/domain-assets/{id}
 *   - 文件 / 候选 / 问题：GET /sechub/domain-assets/{id}/files|candidates|issues，
 *     三者各自**独立服务端分页**
 *   - 同步历史：GET /sechub/domain-assets/sync-runs
 *   - 重匹配：POST /sechub/domain-assets/rematch（仅表单资产）
 *   - 人工字段：PATCH /sechub/domain-assets/{id}/manual-fields
 *     （只有 owner / tags_json / in_scope / remark 四个字段）
 *   - 表单同步：POST /sechub/form-assets/sync/preview → POST /sechub/form-assets/sync
 *     （返回 task_id）→ GET /sechub/form-assets/sync/{task_id} 轮询
 *
 * 插件（form.surfaces[].bindings[]，含 match_row）、菜单（form.menus）、
 * Helper 依赖（microservice.helper_files）都**随详情内嵌返回**，没有独立分页接口，
 * 因此详情页对这三类做客户端分页，保证 2 万级绑定不会一次性渲染。
 *
 * 候选与问题的状态**不在本页维护**：只读展示接口返回的当前状态，
 * 确认、认领、修复等流转仍在扫描结果 / 缺陷页完成，避免两处状态机互相覆盖。
 *
 * 纯函数（人工字段 payload 构造、重匹配证据解析、动态列推导、标签映射）集中在此，
 * 页面只做组装与请求。
 */

import type { VNodeChild } from 'vue'

import { Tag } from '@arco-design/web-vue'
import { h } from 'vue'

import { formatTime, parseTimeInput, withTableDefaults } from '@/hooks'
import { aiStatusLabels, runStatusLabels } from '../labels'

// ── 基础类型 ──────────────────────────────────────

/** 资产形态（后端 asset_type 取值；展示层按标签映射兜底扩展） */
export type AssetKind = 'form' | 'micro' | 'unknown'

/** 详情页 tab 标识：basic 为基本信息，其余为内嵌数据或独立分页接口 */
export type AssetTabKind
  = | 'plugins'
    | 'menus'
    | 'helper_files'
    | 'files'
    | 'candidates'
    | 'issues'
    | 'sync_history'

export type AssetTabKey = 'basic' | AssetTabKind

/** 内嵌 tab（插件 / 菜单 / Helper）：数据来自详情响应，本地客户端分页 */
const EMBEDDED_TAB_KINDS: AssetTabKind[] = ['plugins', 'menus', 'helper_files']

export function isEmbeddedTabKind(kind: AssetTabKind): boolean {
  return EMBEDDED_TAB_KINDS.includes(kind)
}

/** 单元格渲染方式，对应表格的统一取值逻辑 */
export type AssetCellKind
  = | 'text'
    | 'time'
    | 'code'
    | 'count'
    | 'tag'
    /** env_id → 环境名 */
    | 'env'
    /** repository_id → 仓库显示名 */
    | 'repo'
    /** match_status_counts 聚合计数 → 「已匹配 3 / 未匹配 2」 */
    | 'match_counts'

/** 标签类单元格的取值语义（决定用哪套 label/color 映射） */
export type AssetTagKind
  = | 'asset_type'
    | 'match_status'
    | 'candidate'
    | 'issue'
    | 'risk'
    | 'sync'
    | 'scope'
    | 'active'

export function assetKind(assetType?: string | null): AssetKind {
  if (assetType === 'form')
    return 'form'
  if (assetType === 'microservice' || assetType === 'micro')
    return 'micro'
  return 'unknown'
}

/**
 * 各匹配状态的计数（列表冗余字段）。
 *
 * 注意列表**不返回**单个 match_status —— 匹配状态以计数聚合形式给出
 * （例如 `{ matched: 3, unmatched: 2 }`）。键名由后端动态决定，
 * 这里用索引签名宽松承载，展示时逐个键做标签映射，未知键原样输出。
 */
export interface DomainAssetMatchStatusCounts {
  [status: string]: number | null | undefined
}

/** 资产列表行（后端新增字段原样透传） */
export interface DomainAsset {
  id: string
  asset_type: string
  source_ref_type?: string | null
  env_id?: string | null
  repository_id?: string | null
  app_id?: string | null
  /** 表单资产标识 */
  form_id?: string | null
  /** 插件类（表单资产） */
  plugin_class?: string | null
  /** 微服务资产标识 */
  service_name?: string | null
  in_scope?: boolean | null
  active?: boolean | null
  match_status_counts?: DomainAssetMatchStatusCounts | null
  last_sync_run_id?: string | null
  owner?: string | null
  /** 标签（JSON 数组或 JSON 字符串，两种形态都容忍） */
  tags_json?: string[] | string | null
  remark?: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

export interface DomainAssetPage {
  list: DomainAsset[]
  total: number
}

// ── 详情（含内嵌数据）────────────────────────────

/** 绑定上的匹配行：重匹配证据的来源 */
export interface DomainAssetMatchRow {
  repository_id?: string | null
  snapshot_commit?: string | null
  match_status?: string | null
  matched_at?: string | null
  updated_at?: string | null
  created_at?: string | null
  [key: string]: unknown
}

export interface FormSurfaceBinding {
  match_row?: DomainAssetMatchRow | null
  [key: string]: unknown
}

export interface FormSurface {
  bindings?: FormSurfaceBinding[] | null
  [key: string]: unknown
}

/** 表单资产内嵌数据：surface 绑定（含匹配行）与菜单 */
export interface FormAssetDetail {
  surfaces?: FormSurface[] | null
  menus?: Record<string, unknown>[] | null
  [key: string]: unknown
}

/** 微服务资产内嵌数据：Helper 文件 */
export interface MicroserviceAssetDetail {
  helper_files?: Record<string, unknown>[] | null
  [key: string]: unknown
}

export interface DomainAssetDetail extends DomainAsset {
  form?: FormAssetDetail | null
  microservice?: MicroserviceAssetDetail | null
}

// ── 查询参数 ──────────────────────────────────────

/**
 * 列表查询参数（对应后端 AssetListQuery 的字段集合）。
 *
 * **不含 page_num / page_size**：这两个由 `usePagedQuery` 的 [`PagedParams`] 注入，
 * 若在初值里也写一份，会覆盖 hook 的 `pageSize` 选项（`query` 的展开顺序决定的）。
 *
 * in_scope / active 在后端是布尔，但空字符串表示"不过滤"、
 * 由 [`compactQuery`] 在发送前剔除，所以这里用字符串承载三态。
 */
export interface DomainAssetListQuery {
  keyword: string
  asset_type: string
  source_ref_type: string
  env_id: string
  repository_id: string
  app_id: string
  form_id: string
  plugin_class: string
  service_name: string
  match_status: string
  in_scope: string
  active: string
}

/** 文件 / 候选 / 问题三个子列表：路径已携带资产 id，除分页外**没有**筛选条件 */
export type AssetSubListFilter = Record<string, never>

/**
 * 同步运行历史（sync-runs）的查询参数；分页字段由页面的分页状态注入。
 * 后端 SyncRunListQuery 只认 domain / source_ref_type / source_ref_id /
 * repository_id / status / keyword 六个筛选字段。
 */
export interface DomainAssetSyncRunsFilter {
  domain: string
  source_ref_type: string
  source_ref_id: string
  repository_id: string
  status: string
  keyword: string
}

/**
 * 剔除空值后再发请求。
 *
 * 后端查询结构体里 in_scope / active 等是强类型（bool / number / Option<T>），
 * 空字符串会反序列化失败；「未选择」的正确语义就是**不传该参数**。
 */
export function compactQuery<T extends Record<string, any>>(source: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === '' || value === null || value === undefined)
      continue
    out[key] = value
  }
  return out
}

// ── 同步（env 维度：预览 → 执行 → task_id 轮询）───

/** 执行同步的返回：task_id 用于轮询 GET /sechub/form-assets/sync/{task_id} */
export interface FormAssetSyncTask {
  task_id: string
  [key: string]: unknown
}

/** 同步任务的终态（不再轮询） */
export const SYNC_TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled', 'skipped'] as const

export function isTerminalSyncStatus(status?: string | null): boolean {
  return SYNC_TERMINAL_STATUSES.includes((status ?? '') as typeof SYNC_TERMINAL_STATUSES[number])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 把任意响应对象摊平为「字段 → 文本」条目（嵌套对象用父.子路径展开）。
 * 用于结构未固定的响应（例如同步预览 / 任务状态）：返回什么就展示什么。
 */
export function flattenScalarEntries(source: Record<string, unknown>, prefix = ''): LooseScalarEntry[] {
  const entries: LooseScalarEntry[] = []
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      const scalars = value.filter(v => !isRecord(v))
      if (scalars.length === value.length) {
        entries.push({
          key: path,
          label: fieldLabel(key),
          text: scalars.length ? scalars.map(v => scalarText(v)).join('、') : '--',
        })
      }
      continue
    }
    if (isRecord(value)) {
      entries.push(...flattenScalarEntries(value, path))
      continue
    }
    entries.push({ key: path, label: fieldLabel(key), text: scalarText(value) })
  }
  return entries
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return '--'
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  return String(value)
}

/**
 * 同步任务状态的展示文案：状态标签 + 若干计数/进度字段。
 *
 * 任务状态 DTO 的具体字段由后端任务表决定（task_id 之外不固定契约），
 * 所以这里**不假设固定计数键**，把标量字段宽松摊平后取前几项拼接 ——
 * 有进度就显示进度，没有就只显示状态，绝不假造数字。
 */
export function syncTaskText(payload: Record<string, unknown> | null | undefined): string {
  if (!payload)
    return ''
  const parts: string[] = []
  const status = payload.status
  if (status !== undefined && status !== null && status !== '')
    parts.push(syncStatusMeta(String(status)).label)
  const extras = flattenScalarEntries(payload)
    .filter(entry => entry.key !== 'status' && entry.key !== 'task_id' && entry.text !== '--')
    .slice(0, 4)
  return [...parts, ...extras.map(e => `${e.label}:${e.text}`)].join(' · ')
}

// ── 人工字段（PATCH /manual-fields）───────────────

/** 人工可改字段的编辑草稿（对应后端 PATCH 的真实四字段） */
export interface AssetManualDraft {
  owner: string
  tags: string[]
  in_scope: boolean
  remark: string
}

/** PATCH 请求体：id 在路径上，body 只允许这四个字段 */
export interface DomainAssetManualFieldsRequest {
  owner?: string
  tags_json?: string[] | null
  in_scope?: boolean
  remark?: string
  [key: string]: unknown
}

/** 后端 tags_json 可能是数组也可能是 JSON 字符串，两种都容忍 */
export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter(v => typeof v === 'string') as string[]
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed))
        return parsed.filter(v => typeof v === 'string') as string[]
    }
    catch {
      // 非 JSON 字符串按单标签展示，不丢数据
      return [value]
    }
  }
  return []
}

/** 从资产快照生成编辑草稿（空值归一化，供 a-input / a-input-tag 使用） */
export function toManualDraft(asset?: DomainAsset | null): AssetManualDraft {
  return {
    owner: asset?.owner ?? '',
    tags: asStringArray(asset?.tags_json),
    in_scope: Boolean(asset?.in_scope),
    remark: asset?.remark ?? '',
  }
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const text = tag.trim()
    if (!text || seen.has(text))
      continue
    seen.add(text)
    out.push(text)
  }
  return out
}

/**
 * 生成 PATCH payload：只提交实际改动的字段（无改动返回 null）。
 * 字段集合严格限定为后端支持的 owner / tags_json / in_scope / remark。
 */
export function buildManualFieldsPayload(
  asset: DomainAsset | null | undefined,
  draft: AssetManualDraft,
): DomainAssetManualFieldsRequest | null {
  if (!asset)
    return null
  const payload: DomainAssetManualFieldsRequest = {}
  let changed = false

  const nextOwner = draft.owner.trim()
  if (nextOwner !== (asset.owner ?? '')) {
    payload.owner = nextOwner
    changed = true
  }

  const nextTags = normalizeTags(draft.tags)
  const prevTags = asStringArray(asset.tags_json)
  if (nextTags.length !== prevTags.length || nextTags.some((tag, i) => tag !== prevTags[i])) {
    // 空数组按「清空」提交 null，与后端可空字段语义一致
    payload.tags_json = nextTags.length ? nextTags : null
    changed = true
  }

  if (draft.in_scope !== Boolean(asset.in_scope)) {
    payload.in_scope = draft.in_scope
    changed = true
  }

  const nextRemark = draft.remark.trim()
  if (nextRemark !== (asset.remark ?? '')) {
    payload.remark = nextRemark
    changed = true
  }

  return changed ? payload : null
}

/**
 * 保存成功后把已提交的改动合并回本地快照。
 *
 * 不假设 PATCH 返回完整资产对象（可能只回回执），也不拿它覆盖快照 ——
 * 展示层立刻与刚保存的内容一致；泛型保持 DomainAssetDetail 类型不丢内嵌数据。
 */
export function applyManualFields<T extends DomainAsset>(
  asset: T,
  payload: DomainAssetManualFieldsRequest,
): T {
  const next = { ...asset } as T
  if (payload.owner !== undefined)
    next.owner = payload.owner
  if ('tags_json' in payload)
    next.tags_json = payload.tags_json ?? []
  if (payload.in_scope !== undefined)
    next.in_scope = payload.in_scope
  if (payload.remark !== undefined)
    next.remark = payload.remark
  return next
}

// ── 重匹配（POST /sechub/domain-assets/rematch）───

/** 重匹配所需的证据：后端 body 为 { form_sync_run_id, repository_id, snapshot_commit } */
export interface RematchEvidence {
  ready: boolean
  reason: string
  form_sync_run_id: string
  repository_id: string
  snapshot_commit: string
}

/** 匹配行的时间戳（毫秒）：取第一个可解析的时间字段，用于挑最新一条 */
export function matchRowTime(row: DomainAssetMatchRow): number {
  for (const value of [row.matched_at, row.updated_at, row.created_at]) {
    const date = parseTimeInput(value)
    if (date)
      return date.getTime()
  }
  return 0
}

/** 从匹配行里挑最新的一条（时间相同则取靠后的，通常是最近写入） */
export function pickLatestMatch(rows: DomainAssetMatchRow[]): DomainAssetMatchRow | null {
  let latest: DomainAssetMatchRow | null = null
  let latestTs = -1
  for (const row of rows) {
    const ts = matchRowTime(row)
    if (ts >= latestTs) {
      latest = row
      latestTs = ts
    }
  }
  return latest
}

/** 摊平详情里的全部 match_row（form.surfaces[].bindings[].match_row） */
export function collectMatchRows(detail: DomainAssetDetail | null | undefined): DomainAssetMatchRow[] {
  const rows: DomainAssetMatchRow[] = []
  const surfaces = detail?.form?.surfaces
  if (!Array.isArray(surfaces))
    return rows
  for (const surface of surfaces) {
    const bindings = surface?.bindings
    if (!Array.isArray(bindings))
      continue
    for (const binding of bindings) {
      const row = binding?.match_row
      if (row && typeof row === 'object')
        rows.push(row)
    }
  }
  return rows
}

/**
 * 解析重匹配证据，缺任何一项都返回禁用原因。
 *
 * 规则（与后端契约一一对应）：
 *   - 只有表单资产可重匹配；
 *   - `form_sync_run_id` 取资产的 `last_sync_run_id`（没有则无法定位本次同步）；
 *   - `repository_id` / `snapshot_commit` 优先从绑定里**最新一条 match_row** 提取；
 *     repository_id 允许回退到资产自身的 repository_id，
 *     snapshot_commit **没有回退来源**，缺了就禁用并说明。
 */
export function resolveRematchEvidence(
  asset: DomainAsset | null | undefined,
  detail: DomainAssetDetail | null | undefined,
): RematchEvidence {
  const empty: RematchEvidence = {
    ready: false,
    reason: '',
    form_sync_run_id: '',
    repository_id: '',
    snapshot_commit: '',
  }
  if (!asset)
    return { ...empty, reason: '请先选择资产' }
  if (assetKind(asset.asset_type) !== 'form')
    return { ...empty, reason: '重新匹配仅支持表单资产' }
  if (!asset.last_sync_run_id)
    return { ...empty, reason: '该资产尚无同步运行记录，无法定位重匹配范围' }

  const latest = pickLatestMatch(collectMatchRows(detail))
  const repositoryId = (latest?.repository_id ?? asset.repository_id ?? '') as string
  const snapshotCommit = (latest?.snapshot_commit ?? '') as string

  if (!repositoryId)
    return { ...empty, reason: '未在匹配明细中找到仓库证据（repository_id），无法重新匹配' }
  if (!snapshotCommit)
    return { ...empty, reason: '未在匹配明细中找到快照提交证据（snapshot_commit），无法重新匹配' }

  return {
    ready: true,
    reason: '',
    form_sync_run_id: asset.last_sync_run_id,
    repository_id: repositoryId,
    snapshot_commit: snapshotCommit,
  }
}

// ── 专项扫描（复用预扫描接口）──────────────────────

/**
 * 「发起专项扫描」能力开关。
 *
 * 该操作要复用预扫描引擎（POST /sechub/prescan/trigger），但预扫描触发契约目前只有
 * repository / branch / commit / scan_mode 维度参数，**没有"按资产限定 + 安全专项规则"
 * 的参数**，拿它发起的实际是仓库级预扫描，与"该资产的专项扫描"语义不符。
 * 因此默认禁用按钮并明确提示原因；后端补齐资产级安全参数后把这里置 true，
 * 触发逻辑（见 buildPrescanTriggerPayload）已按预扫描真实契约写好，无需再改页面。
 *
 * 刻意标注 `: boolean`：不标的话类型被推断成字面量 `false`，
 * 打开开关后调用点会被判定为「不可达代码」，一处开关要改两个文件。
 */
export const SECURITY_SCAN_PARAM_READY: boolean = false

/** 返回禁用原因；空字符串表示可以发起 */
export function scanTriggerDisabledReason(asset: DomainAsset | null | undefined): string {
  if (!asset)
    return '请先选择资产'
  if (!asset.repository_id)
    return '该资产未关联代码仓库，无法发起专项扫描'
  if (!SECURITY_SCAN_PARAM_READY)
    return '后端预扫描接口暂未提供资产级安全专项参数，无法按资产范围发起；待补齐后开放'
  return ''
}

/**
 * 按预扫描真实契约构造触发 payload（repository + 全量范围）。
 * 仅在 SECURITY_SCAN_PARAM_READY 为 true 时调用。
 */
export function buildPrescanTriggerPayload(asset: DomainAsset): Record<string, unknown> {
  return {
    repository_id: asset.repository_id,
    scan_mode: 'full',
    force: false,
  }
}

// ── 标签映射 ──────────────────────────────────────

export const assetTypeLabels: Record<string, { label: string, color: string }> = {
  form: { label: '表单', color: 'arcoblue' },
  microservice: { label: '微服务', color: 'purple' },
  // 后端个别形态写作 micro，展示层兼容
  micro: { label: '微服务', color: 'purple' },
}

export const matchStatusLabels: Record<string, { label: string, color: string }> = {
  matched: { label: '已匹配', color: 'green' },
  partial: { label: '部分匹配', color: 'orange' },
  unmatched: { label: '未匹配', color: 'red' },
  pending: { label: '待匹配', color: 'gray' },
  conflict: { label: '冲突', color: 'orangered' },
  ambiguous: { label: '歧义', color: 'orange' },
  skipped: { label: '已跳过', color: 'gray' },
  failed: { label: '匹配失败', color: 'red' },
}

/** 问题状态沿用缺陷页（defects.vue）的中文口径 */
export const issueStatusLabels: Record<string, { label: string, color: string }> = {
  open: { label: '打开', color: 'red' },
  reopened: { label: '重新打开', color: 'orangered' },
  fixing: { label: '修复中', color: 'blue' },
  fixed: { label: '已修复', color: 'green' },
  verified: { label: '已验证', color: 'green' },
  wont_fix: { label: '不处理', color: 'gray' },
  verification_failed: { label: '验证失败', color: 'orange' },
}

export const riskLevelLabels: Record<string, { label: string, color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
  info: { label: '提示', color: 'gray' },
}

/** 同步运行状态：沿用扫描运行的中文口径，补 cancelled */
export const syncStatusLabels: Record<string, { label: string, color: string }> = {
  ...runStatusLabels,
  cancelled: { label: '已取消', color: 'gray' },
}

function metaOf(
  map: Record<string, { label: string, color: string }>,
  value: string,
): { label: string, color: string } {
  return map[value] ?? { label: value || '--', color: 'gray' }
}

export function assetTypeMeta(value?: string | null) {
  return metaOf(assetTypeLabels, value ?? '')
}

export function matchStatusMeta(value?: string | null) {
  return metaOf(matchStatusLabels, value ?? '')
}

export function candidateStatusMeta(value?: string | null) {
  return metaOf(aiStatusLabels, value ?? '')
}

export function issueStatusMeta(value?: string | null) {
  return metaOf(issueStatusLabels, value ?? '')
}

export function riskLevelMeta(value?: string | null) {
  return metaOf(riskLevelLabels, value ?? '')
}

export function syncStatusMeta(value?: string | null) {
  return metaOf(syncStatusLabels, value ?? '')
}

/** 标签类单元格的通用解析（kind 决定取值映射，未知取值原样展示不隐藏数据） */
export function cellTagMeta(kind: AssetTagKind | undefined, value: unknown): { label: string, color: string } {
  switch (kind) {
    case 'asset_type': return assetTypeMeta(value == null ? '' : String(value))
    case 'match_status': return matchStatusMeta(value == null ? '' : String(value))
    case 'candidate': return candidateStatusMeta(value == null ? '' : String(value))
    case 'issue': return issueStatusMeta(value == null ? '' : String(value))
    case 'risk': return riskLevelMeta(value == null ? '' : String(value))
    case 'sync': return syncStatusMeta(value == null ? '' : String(value))
    case 'scope':
      return isTruthyFlag(value) ? { label: '范围内', color: 'green' } : { label: '范围外', color: 'gray' }
    case 'active':
      return isTruthyFlag(value) ? { label: '启用', color: 'green' } : { label: '停用', color: 'gray' }
    default:
      return { label: value == null || value === '' ? '--' : String(value), color: 'gray' }
  }
}

/** 布尔标记的宽松判定（后端可能给 true / 'true' / 1） */
export function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1)
    return true
  if (typeof value === 'string')
    return value === 'true' || value === '1'
  return false
}

// ── 展示用纯函数 ──────────────────────────────────

/** 通用文本：null/undefined/空串显示 '--' */
export function asText(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return '--'
  if (typeof value === 'boolean')
    return value ? '是' : '否'
  return String(value)
}

/** 计数展示：null/undefined 显示 '--'，避免把"没统计"误读成 0 */
export function countText(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return '--'
  return String(value)
}

/** 资产标识：表单看 form_id，微服务看 service_name */
export function assetIdentityLabel(assetType?: string | null): string {
  return assetKind(assetType) === 'micro' ? '服务名' : '表单ID'
}

export function assetIdentityValue(asset: DomainAsset): string {
  const value = assetKind(asset.asset_type) === 'micro' ? asset.service_name : asset.form_id
  return value || '--'
}

/**
 * 计数字段的宽松解析：后端可能给对象，也可能给 JSON 字符串
 * （同 tags_json 的两种形态），两种都收，其余一律视为"没有计数"。
 */
function parseCounts(source: unknown): DomainAssetMatchStatusCounts | null {
  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as DomainAssetMatchStatusCounts
        : null
    }
    catch {
      return null
    }
  }
  if (source && typeof source === 'object' && !Array.isArray(source))
    return source as DomainAssetMatchStatusCounts
  return null
}

/**
 * 匹配状态计数的可读文本：逐个键做标签映射后拼接。
 * 没有计数可展示时返回 '--'（不把"没统计"写成 0）。
 */
export function matchStatusCountsText(counts?: unknown): string {
  const parsed = parseCounts(counts)
  if (!parsed)
    return '--'
  const parts = Object.entries(parsed)
    .filter(([, count]) => count !== null && count !== undefined)
    .map(([status, count]) => `${matchStatusMeta(status).label} ${count}`)
  return parts.length ? parts.join(' / ') : '--'
}

// ── 动态列推导（内嵌数据字段随版本变化，按行内容推导列）──

/** 字段中文名映射；未知键原样输出（不隐藏后端新增字段） */
export const fieldLabels: Record<string, string> = {
  id: 'ID',
  name: '名称',
  code: '编码',
  title: '名称',
  asset_type: '资产类型',
  source_ref_type: '来源类型',
  env_id: '环境',
  repository_id: '代码仓库',
  app_id: '应用',
  form_id: '表单ID',
  form_name: '表单名称',
  plugin_class: '插件类',
  service_name: '服务名',
  module_code: '模块编码',
  module_name: '模块名称',
  surface_name: 'Surface',
  surface: 'Surface',
  surface_code: 'Surface编码',
  binding_key: '绑定键',
  binding_type: '绑定类型',
  menu_id: '菜单ID',
  menu_name: '菜单名称',
  menu_path: '菜单路径',
  component_path: '组件路径',
  route_name: '路由名',
  file_path: '文件',
  start_line: '起始行',
  end_line: '结束行',
  line_count: '行数',
  matched_text: '命中文本',
  match_type: '匹配类型',
  match_status: '匹配状态',
  match_status_counts: '匹配状态',
  matched_at: '匹配时间',
  repository_name: '仓库名称',
  snapshot_commit: '快照提交',
  entry_class: '入口类',
  class_name: '类名',
  package_name: '包名',
  bean_name: 'Bean 名称',
  helper_name: 'Helper',
  helper_class: 'Helper 类',
  helper_file: 'Helper 文件',
  dependency_scope: '依赖范围',
  scope_type: '范围类型',
  category: '分类',
  domain: '领域',
  rule_name: '规则',
  rule_id: '规则ID',
  risk_level: '风险',
  ai_status: 'AI状态',
  ai_risk_level: 'AI风险',
  status: '状态',
  hit_count: '命中次数',
  assignee: '处理人',
  fingerprint: '指纹',
  introduced_commit: '引入提交',
  introduced_at: '引入时间',
  introduced_author: '引入者',
  task_id: '任务ID',
  sync_run_id: '同步运行',
  last_sync_run_id: '最近同步运行',
  form_sync_run_id: '表单同步运行',
  added: '新增',
  updated: '更新',
  removed: '移除',
  processed: '已处理',
  total: '总数',
  changed: '变更',
  skipped: '跳过',
  failed: '失败',
  error_message: '错误信息',
  message: '消息',
  detail: '详情',
  started_at: '开始时间',
  finished_at: '结束时间',
  created_at: '创建时间',
  updated_at: '更新时间',
  discovered_at: '发现时间',
  commit_sha: '提交',
  in_scope: '扫描范围',
  active: '启用',
  owner: '负责人',
  tags_json: '标签',
  remark: '备注',
  enabled: '启用',
  count: '数量',
  version: '版本',
}

export function fieldLabel(key: string): string {
  return fieldLabels[key] ?? key
}

/** 列排序偏好：业务含义强的字段在前 */
export const PREFERRED_FIELDS = [
  'name',
  'title',
  'code',
  'asset_type',
  'surface_name',
  'surface',
  'menu_name',
  'menu_id',
  'file_path',
  'start_line',
  'matched_text',
  'match_type',
  'match_status',
  'risk_level',
  'status',
  'class_name',
  'entry_class',
  'helper_class',
  'helper_file',
  'dependency_scope',
  'repository_id',
  'snapshot_commit',
  'sync_run_id',
  'started_at',
  'finished_at',
  'created_at',
  'updated_at',
]

/** 这些字段用标签样式渲染（值 → 中文标签 + 颜色） */
export const TAG_FIELDS: Record<string, AssetTagKind> = {
  asset_type: 'asset_type',
  match_status: 'match_status',
  ai_status: 'candidate',
  status: 'issue',
  risk_level: 'risk',
  ai_risk_level: 'risk',
  in_scope: 'scope',
  active: 'active',
  enabled: 'active',
}

/** 这些字段用等宽样式渲染（类名 / 路径 / 提交等） */
const CODE_FIELDS = new Set([
  'file_path',
  'entry_class',
  'class_name',
  'package_name',
  'helper_class',
  'helper_file',
  'component_path',
  'menu_path',
  'repository_id',
  'snapshot_commit',
  'sync_run_id',
  'task_id',
  'introduced_commit',
  'commit_sha',
  'form_id',
  'fingerprint',
  'code',
])

/** 按字段名 + 取值推导单元格渲染方式 */
export function cellKindFor(field: string, value: unknown): AssetCellKind {
  if (TAG_FIELDS[field])
    return 'tag'
  if (field === 'env_id')
    return 'env'
  if (field === 'repository_id')
    return 'repo'
  if (field === 'match_status_counts')
    return 'match_counts'
  if (CODE_FIELDS.has(field))
    return 'code'
  if (field === 'start_line' || field === 'end_line' || field === 'line_count' || field.endsWith('_count') || field.endsWith('_counts'))
    return 'count'
  if (field.endsWith('_at') || field.endsWith('_time'))
    return 'time'
  return typeof value === 'number' ? 'count' : 'text'
}

/**
 * 表格列定义。
 *
 * 显式带上 [`ColumnLike`] 所需的索引签名，使 toTableColumns 产出的 Record<string,any>[]
 * 能无缝传入 withTableDefaults（ColumnLike 约束需要 `[key: string]: any`）。
 */
export interface AssetColumnDef {
  [key: string]: any
  title: string
  dataIndex?: string
  width?: number
  cell?: AssetCellKind
  meta?: AssetTagKind
}

/**
 * 列定义 → Arco 列（补默认省略 + hover 提示）。
 *
 * 单元格用**渲染函数**而不是插槽：这些列是运行时从字段推导出来的，
 * 插槽里要拿列上的 `meta` 得访问 `column.meta`，而 Arco 槽位参数的类型是
 * `TableColumnData`（没有 meta / cell 这两个自定义字段），`vue-tsc` 的模板检查
 * 会直接报错；渲染函数在 TS 里闭包住 def，取值与类型都确定。
 */
export function toTableColumns(
  defs: AssetColumnDef[],
  renderCell?: (def: AssetColumnDef, record: Record<string, unknown>) => VNodeChild,
): Record<string, any>[] {
  return withTableDefaults(defs.map((def) => {
    const column: Record<string, any> = {
      title: def.title,
      dataIndex: def.dataIndex,
      width: def.width,
    }
    if (def.cell && def.dataIndex && renderCell)
      column.render = ({ record }: { record: Record<string, unknown> }) => renderCell(def, record)
    return column
  }))
}

/** 单元格渲染上下文：名称解析等由页面注入（页面才有下拉选项数据） */
export interface AssetCellContext {
  /** env_id → 环境名；不注入时直接显示 id */
  envName?: (envId: string) => string
  /** repository_id → 仓库显示名；不注入时直接显示 id */
  repositoryName?: (repositoryId: string) => string
}

/**
 * 生成统一单元格渲染器，列表页与详情页共用同一套取值逻辑
 * （时间格式、等宽样式、计数占位、标签配色、环境/仓库名解析）。
 */
export function createAssetCellRenderer(context: AssetCellContext = {}) {
  return (def: AssetColumnDef, record: Record<string, unknown>): VNodeChild => {
    const value = def.dataIndex ? record[def.dataIndex] : undefined
    switch (def.cell) {
      case 'time':
        return formatTime(value as string | number | Date | null | undefined)
      case 'code':
        // 等宽样式必须内联：渲染函数产出的 VNode 在 Table 的渲染上下文里生成，
        // 页面 scoped 的 `.mono-text`（scopeId 不同）到不了这里
        return h('span', { style: { fontFamily: 'monospace', fontSize: '12px' } }, asText(value))
      case 'count':
        return countText(value)
      case 'env': {
        if (value === null || value === undefined || value === '')
          return '--'
        const id = String(value)
        return context.envName ? context.envName(id) : id
      }
      case 'repo': {
        if (value === null || value === undefined || value === '')
          return '--'
        const id = String(value)
        return context.repositoryName ? context.repositoryName(id) : id
      }
      case 'match_counts':
        return matchStatusCountsText(value)
      case 'tag': {
        if (value === null || value === undefined || value === '')
          return '--'
        const meta = cellTagMeta(def.meta, value)
        return h(Tag, { color: meta.color, size: 'small' }, meta.label)
      }
      default:
        return asText(value)
    }
  }
}

function pickScalars(source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (isRecord(value))
      continue
    if (Array.isArray(value)) {
      if (!value.every(v => !isRecord(v)))
        continue
      out[key] = value.join('、')
      continue
    }
    out[key] = value
  }
  return out
}

function firstText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value)
      return value
  }
  return ''
}

/**
 * 行数组 → 标量列集合。
 *
 * 内嵌数据的字段随后端版本变化，无法写死列定义。这里按**行内容**推导：
 * 任一行为对象/对象数组的键一律排除（不做 JSON 折叠展示，避免列内容爆炸），
 * 其余标量键成列；列顺序按 PREFERRED_FIELDS 优先，未列出的排在后面。
 */
export function deriveScalarColumns(rows: Record<string, unknown>[]): AssetColumnDef[] {
  if (!rows.length)
    return []
  const excluded = new Set<string>()
  const seen = new Set<string>()
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (isRecord(value) || (Array.isArray(value) && value.some(v => isRecord(v))))
        excluded.add(key)
      else
        seen.add(key)
    }
  }
  const keys = [...seen].filter(key => !excluded.has(key))
  keys.sort((a, b) => {
    const ia = PREFERRED_FIELDS.indexOf(a)
    const ib = PREFERRED_FIELDS.indexOf(b)
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib
    return ra - rb || a.localeCompare(b)
  })
  const sample = rows.find(row => Object.keys(row).length > 0) ?? {}
  return keys.map((key) => {
    const value = sample[key]
    return {
      title: fieldLabel(key),
      dataIndex: key,
      width: 160,
      cell: cellKindFor(key, value),
      meta: TAG_FIELDS[key],
    }
  })
}

/** 预览等"只读展示"场景的列：全部按纯文本渲染（不做标签映射，避免误读语义） */
export function derivePlainColumns(rows: Record<string, unknown>[]): AssetColumnDef[] {
  const columns = deriveScalarColumns(rows)
  if (!columns.length)
    return []
  const sample = rows.find(row => Object.keys(row).length > 0) ?? {}
  return columns.map(col => ({
    title: col.title,
    dataIndex: col.dataIndex,
    width: 160,
    cell: cellKindFor(col.dataIndex ?? '', sample[col.dataIndex ?? '']) === 'time' ? 'time' : 'text',
  }))
}

// ── 内嵌数据 → 行模型 ─────────────────────────────

/**
 * 插件行：摊平 form.surfaces[].bindings[]。
 *
 * 一行 = 一个绑定；match_row 的标量字段与 binding 自身的标量字段合并
 * （binding 同名字段优先，它更贴近绑定本身），并附带所属 surface 名称。
 */
export function buildPluginRows(form: FormAssetDetail | null | undefined): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  const surfaces = form?.surfaces
  if (!Array.isArray(surfaces))
    return rows
  for (const surface of surfaces) {
    if (!isRecord(surface))
      continue
    const surfaceName = firstText(surface, ['surface_name', 'surface', 'name', 'title', 'code'])
    const bindings = surface.bindings
    if (!Array.isArray(bindings))
      continue
    for (const binding of bindings) {
      if (!isRecord(binding))
        continue
      const matchRow = isRecord(binding.match_row) ? binding.match_row : {}
      rows.push({
        ...(surfaceName ? { surface_name: surfaceName } : {}),
        ...pickScalars(matchRow),
        ...pickScalars(binding),
      })
    }
  }
  return rows
}

/** 菜单行：form.menus 直接摊平（数据可能直接是对象数组） */
export function buildMenuRows(form: FormAssetDetail | null | undefined): Record<string, unknown>[] {
  const menus = form?.menus
  if (!Array.isArray(menus))
    return []
  return menus.filter(isRecord).map(menu => pickScalars(menu))
}

/** Helper 行：microservice.helper_files 直接摊平 */
export function buildHelperRows(micro: MicroserviceAssetDetail | null | undefined): Record<string, unknown>[] {
  const files = micro?.helper_files
  if (!Array.isArray(files))
    return []
  return files.filter(isRecord).map(file => pickScalars(file))
}

// ── 宽松展示（同步预览等结构未固定的响应）─────────

export interface LooseScalarEntry {
  key: string
  label: string
  text: string
}

/**
 * 从响应里挑出「数组-of-对象」字段，作为可预览的小表。
 * 用于同步预览：后端返回什么结构就展示什么，不假设固定计数键。
 */
export function pickArrayTables(
  source: Record<string, unknown> | null | undefined,
): { key: string, label: string, rows: Record<string, unknown>[] }[] {
  if (!source)
    return []
  const tables: { key: string, label: string, rows: Record<string, unknown>[] }[] = []
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value) && value.length > 0 && value.every(isRecord)) {
      tables.push({
        key,
        label: fieldLabel(key),
        rows: value as Record<string, unknown>[],
      })
    }
  }
  return tables
}

// ── 详情 tab 与列定义 ─────────────────────────────

export interface AssetTabDef {
  key: AssetTabKey
  title: string
  /** basic 之外用于分派数据源；内嵌三类走客户端分页，其余走独立分页接口 */
  kind?: AssetTabKind
  emptyText?: string
}

/** 候选列：字段与扫描结果页 CandidateDetailRow 对齐 */
export function CANDIDATE_COLUMNS(): AssetColumnDef[] {
  return [
    { title: '文件', dataIndex: 'file_path', width: 260, cell: 'code' },
    { title: '行', dataIndex: 'start_line', width: 60, cell: 'count' },
    { title: '分类', dataIndex: 'category', width: 110 },
    { title: 'AI风险', dataIndex: 'ai_risk_level', width: 80, cell: 'tag', meta: 'risk' },
    { title: 'AI状态', dataIndex: 'ai_status', width: 90, cell: 'tag', meta: 'candidate' },
    { title: '引入提交', dataIndex: 'introduced_commit', width: 110, cell: 'code' },
    { title: '引入时间', dataIndex: 'introduced_at', width: 150, cell: 'time' },
    { title: '引入者', dataIndex: 'introduced_author', width: 110 },
  ]
}

/** 问题列：字段与缺陷页 ScanIssueRow 对齐 */
export function ISSUE_COLUMNS(): AssetColumnDef[] {
  return [
    { title: '标题', dataIndex: 'title', width: 220 },
    { title: '分类', dataIndex: 'category', width: 110 },
    { title: '风险', dataIndex: 'risk_level', width: 70, cell: 'tag', meta: 'risk' },
    { title: '状态', dataIndex: 'status', width: 90, cell: 'tag', meta: 'issue' },
    { title: '处理人', dataIndex: 'assignee', width: 90 },
    { title: '文件', dataIndex: 'file_path', width: 220, cell: 'code' },
    { title: '行', dataIndex: 'start_line', width: 60, cell: 'count' },
    { title: '命中次数', dataIndex: 'hit_count', width: 80, cell: 'count' },
    { title: '引入时间', dataIndex: 'introduced_at', width: 150, cell: 'time' },
  ]
}

/** 表单资产 tab：基本信息 / 插件（内嵌）/ 菜单（内嵌）/ 文件 / 候选 / 问题 / 同步历史 */
export const FORM_ASSET_TABS: AssetTabDef[] = [
  { key: 'basic', title: '基本信息' },
  { key: 'plugins', title: '插件绑定', kind: 'plugins', emptyText: '该表单暂无插件绑定' },
  { key: 'menus', title: '菜单', kind: 'menus', emptyText: '该表单暂无关联菜单' },
  { key: 'files', title: '文件', kind: 'files', emptyText: '该资产暂无文件记录' },
  { key: 'candidates', title: '候选', kind: 'candidates', emptyText: '该资产暂无候选记录' },
  { key: 'issues', title: '问题', kind: 'issues', emptyText: '该资产暂无问题记录' },
  { key: 'sync_history', title: '同步历史', kind: 'sync_history', emptyText: '暂无同步运行记录' },
]

/** 微服务资产 tab：基本信息 / Helper 依赖（内嵌）/ 文件 / 候选 / 问题 / 同步历史 */
export const MICRO_ASSET_TABS: AssetTabDef[] = [
  { key: 'basic', title: '基本信息' },
  { key: 'helper_files', title: 'Helper 依赖', kind: 'helper_files', emptyText: '该微服务暂无 Helper 文件记录' },
  { key: 'files', title: '文件', kind: 'files', emptyText: '该资产暂无文件记录' },
  { key: 'candidates', title: '候选', kind: 'candidates', emptyText: '该资产暂无候选记录' },
  { key: 'issues', title: '问题', kind: 'issues', emptyText: '该资产暂无问题记录' },
  { key: 'sync_history', title: '同步历史', kind: 'sync_history', emptyText: '暂无同步运行记录' },
]

/** 按资产类型取 tab 定义；未知类型按表单处理（后端扩展类型时不至于空白） */
export function assetTabs(assetType?: string | null): AssetTabDef[] {
  return assetKind(assetType) === 'micro' ? MICRO_ASSET_TABS : FORM_ASSET_TABS
}

// ── 筛选下拉选项 / 分页档位 ────────────────────────

export const ASSET_TYPE_OPTIONS = [
  { value: 'form', label: '表单' },
  { value: 'microservice', label: '微服务' },
]

export const IN_SCOPE_OPTIONS = [
  { value: 'true', label: '范围内' },
  { value: 'false', label: '范围外' },
]

export const ACTIVE_OPTIONS = [
  { value: 'true', label: '启用' },
  { value: 'false', label: '停用' },
]

export const DOMAIN_ASSET_PAGE_SIZES = [10, 20, 50, 100]
