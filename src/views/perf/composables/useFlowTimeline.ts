/**
 * 问题台账 / 缺陷流转记录的取数与文案。
 *
 * 为什么抽出来：台账详情与问题列表的「流转记录」展示同一条时间线（台账事件 + 缺陷流转），
 * 原来问题列表在页面里直接 useGet 接口、用 any 渲染，台账这边则完全没有。
 * 分层遵循 View → Composable → Api。
 */
import type { FlowItem, FlowTarget } from '@/types/perf-flow'
import { ref } from 'vue'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { useGet } from '@/hooks'

export interface TagMeta {
  text: string
  color: string
}

/** 台账状态 */
const PATTERN_STATUS: Record<string, string> = {
  new: '待处置',
  issued: '已提单',
  wont_fix: '不处理',
  observing: '观察',
  duplicate: '重复',
}

/** 缺陷内部处理进度（unclaimed = 建单后还没人认领） */
const PROCESS_STATUS: Record<string, string> = {
  unclaimed: '待认领',
  claimed: '已认领',
  fixing: '修复中',
  fixed: '已修复',
  released: '已发版',
  verified: '已验证',
  wont_fix: '不处理',
}

/** 缺陷生产侧状态（含复核用的旧口径 verified / fixing / closed） */
const ISSUE_STATUS: Record<string, string> = {
  recurring: '仍复现',
  observing: '观察中',
  resolved: '已消失',
  excluded: '不适用',
  verified: '已验证',
  fixing: '修复中',
  closed: '已关闭',
}

const PATTERN_EVENTS: Record<string, TagMeta> = {
  created: { text: '台账创建', color: 'arcoblue' },
  triage: { text: '处置', color: 'orange' },
  restored: { text: '撤回处置', color: 'gray' },
  issued: { text: '转缺陷', color: 'blue' },
  linked: { text: '关联问题单', color: 'blue' },
  discarded: { text: '废弃', color: 'red' },
  attribution_edited: { text: '修改归属', color: 'cyan' },
  duplicate: { text: '标记重复', color: 'gray' },
  duplicate_cancel: { text: '取消重复', color: 'gray' },
  regression: { text: '修复后复发', color: 'red' },
  status_change: { text: '状态变更', color: 'orange' },
}

const ISSUE_EVENTS: Record<string, TagMeta> = {
  created: { text: '缺陷建单', color: 'arcoblue' },
  process: { text: '处理流转', color: 'purple' },
  status_change: { text: '生产状态变更', color: 'orange' },
  recheck: { text: '数据复核', color: 'green' },
  regression: { text: '归因打回', color: 'red' },
  note: { text: '结论变更说明', color: 'gray' },
}

/** 事件的标签文案与颜色（台账与缺陷的同名事件含义不同，按来源区分）。 */
export function flowEventMeta(item: Pick<FlowItem, 'source' | 'event_type'>): TagMeta {
  const table = item.source === 'pattern' ? PATTERN_EVENTS : ISSUE_EVENTS
  return table[item.event_type] || { text: item.event_type || '--', color: 'gray' }
}

/** 状态文案：台账事件用台账状态，缺陷流转用处理进度。 */
export function flowStatusText(item: Pick<FlowItem, 'source'>, status?: string | null): string {
  if (!status)
    return ''
  const table = item.source === 'pattern' ? PATTERN_STATUS : PROCESS_STATUS
  return table[status] || status
}

export function issueStatusText(status?: string | null): string {
  return status ? ISSUE_STATUS[status] || status : ''
}

/** 「A → B」；两边相同或都为空时返回空串（不显示无变化的行）。 */
export function changeText(from?: string | null, to?: string | null): string {
  const a = from || ''
  const b = to || ''
  if (a === b)
    return ''
  return a ? `${a} → ${b || '—'}` : b
}

/** 改归属事件的前后差异，形如「项目组 PM1 → PM2」。 */
export function attributionChanges(meta?: Record<string, unknown> | null): string[] {
  const from = (meta?.from ?? {}) as Record<string, unknown>
  const to = (meta?.to ?? {}) as Record<string, unknown>
  const labels: Record<string, string> = { project_group_code: '项目组', app_number: '应用', business_area: '业务领域' }
  return Object.entries(labels)
    .map(([key, label]) => {
      const text = changeText(from[key] == null ? '' : String(from[key]), to[key] == null ? '' : String(to[key]))
      return text ? `${label} ${text}` : ''
    })
    .filter(Boolean)
}

export function useFlowTimeline() {
  const items = ref<FlowItem[]>([])
  const loading = ref(false)
  const query = ref<{ pattern_id?: string, issue?: string }>({})

  const { execute } = useGet<FlowItem[]>(ApiPerfPatternLedger.flow, query, {
    immediate: false,
    onSuccess(data) {
      items.value = Array.isArray(data) ? data : []
    },
  })

  function load(target: FlowTarget) {
    items.value = []
    const patternId = target.patternId?.trim()
    const issue = target.issue?.trim()
    if (!patternId && !issue)
      return
    query.value = { pattern_id: patternId || undefined, issue: patternId ? undefined : issue }
    loading.value = true
    execute().finally(() => {
      loading.value = false
    })
  }

  function reset() {
    items.value = []
  }

  return { items, loading, load, reset }
}
