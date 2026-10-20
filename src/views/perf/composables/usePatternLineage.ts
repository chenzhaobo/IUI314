/**
 * 台账谱系（关联台账 + 结论变更记录 + 旧版报告查看 + 人工标记重复）的状态与请求。
 *
 * 为什么抽出来：问题台账详情与问题列表详情都要展示同一块，与「再次分析」一样
 * 只该有一份逻辑。分层遵循 View → Composable → Api。
 */
import type { LineageTarget, PatternChangeEntry, PatternLineage } from '@/types/perf-lineage'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { isRequestFailed, useGet, usePost } from '@/hooks'

interface LineageQuery {
  pattern_id?: string
  issue?: string
}

interface ReportMdQuery {
  pattern?: string
  issue?: string
  file?: string
}

interface ReportMdResult {
  found?: boolean
  markdown?: string
  reason?: string
}

interface DuplicatePayload {
  pattern: string
  master?: string
  reason?: string
}

export interface TagMeta {
  text: string
  color: string
}

/** 变更种类 → 文案与颜色。 */
export function changeKindMeta(kind: string): TagMeta {
  const map: Record<string, TagMeta> = {
    refine: { text: '补充证据后更新', color: 'arcoblue' },
    supersede: { text: '推翻原结论', color: 'red' },
    recheck: { text: '复发时重新分析', color: 'cyan' },
    reanalysis: { text: '复核更新', color: 'orange' },
    merged: { text: '并入其他台账', color: 'gray' },
    derived: { text: '派生出残留问题', color: 'purple' },
    split: { text: '拆分', color: 'purple' },
    duplicate: { text: '重复标记', color: 'gray' },
    trend: { text: '耗时趋势', color: 'gold' },
    regression: { text: '修复后复发', color: 'red' },
  }
  return map[kind] || { text: kind || '--', color: 'gray' }
}

/** 关系类型 → 文案与颜色（本台账相对上游的关系）。 */
export function relationMeta(type?: string | null): TagMeta {
  switch (type) {
    case 'sibling':
      return { text: '同族（同一根因的新表单实例）', color: 'cyan' }
    case 'derived':
      return { text: '修复后残留', color: 'purple' }
    case 'split':
      return { text: '拆分自', color: 'purple' }
    case 'duplicate':
      return { text: '重复于', color: 'gray' }
    default:
      return { text: type || '关联', color: 'gray' }
  }
}

/** 下游台账相对本台账的关系文案（方向与 relationMeta 相反）。 */
export function childRelationText(type?: string | null): string {
  switch (type) {
    case 'sibling':
      return '同族实例'
    case 'derived':
      return '修复后残留'
    case 'split':
      return '拆分出'
    case 'duplicate':
      return '重复项'
    default:
      return '关联'
  }
}

/** 变更记录里的旧报告路径（evidence 是字符串数组时才有）。 */
export function entryReportPaths(entry: PatternChangeEntry): string[] {
  return Array.isArray(entry.evidence) ? entry.evidence.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0) : []
}

function toQuery(target: LineageTarget): LineageQuery {
  return {
    pattern_id: target.patternId?.trim() || undefined,
    issue: target.issue?.trim() || undefined,
  }
}

export function usePatternLineage() {
  const lineage = ref<PatternLineage | null>(null)
  const loading = ref(false)
  const target = ref<LineageTarget>({})
  const query = ref<LineageQuery>({})

  const { execute: fetchLineage } = useGet<PatternLineage>(ApiPerfPatternLedger.lineage, query, {
    immediate: false,
    onSuccess(data) {
      lineage.value = data && typeof data === 'object' ? data : null
    },
  })

  function load(next: LineageTarget) {
    target.value = { ...next }
    lineage.value = null
    if (!target.value.patternId?.trim() && !target.value.issue?.trim())
      return
    query.value = toQuery(target.value)
    loading.value = true
    fetchLineage().finally(() => {
      loading.value = false
    })
  }

  function reset() {
    lineage.value = null
    target.value = {}
  }

  // ── 旧版报告 ──
  const versionVisible = ref(false)
  const versionLoading = ref(false)
  const versionFile = ref('')
  const versionMarkdown = ref('')
  const versionReason = ref('')
  const versionQuery = ref<ReportMdQuery>({})
  const { execute: fetchVersion } = useGet<ReportMdResult>(ApiPerfPatternLedger.reportMd, versionQuery, {
    immediate: false,
    onSuccess(data) {
      versionMarkdown.value = data?.found ? data.markdown || '' : ''
      versionReason.value = data?.found ? '' : data?.reason || '读取失败'
    },
  })

  function viewVersion(file: string) {
    const q = toQuery(target.value)
    versionQuery.value = { pattern: q.pattern_id, issue: q.issue, file }
    versionFile.value = file
    versionMarkdown.value = ''
    versionReason.value = ''
    versionVisible.value = true
    versionLoading.value = true
    fetchVersion().finally(() => {
      versionLoading.value = false
    })
  }

  // ── 人工标记重复 ──
  const duplicatePayload = ref<DuplicatePayload>({ pattern: '' })
  const marking = ref(false)
  const { data: markRes, execute: doMark } = usePost<unknown>(ApiPerfPatternLedger.markDuplicate, duplicatePayload, { immediate: false })

  /** master 为空表示取消重复（取消时 reason 必填）。成功返回 true（调用方据此刷新列表）。 */
  async function markDuplicate(pattern: string, master?: string, reason?: string): Promise<boolean> {
    if (!pattern.trim())
      return false
    duplicatePayload.value = { pattern: pattern.trim(), master: master?.trim() || undefined, reason: reason?.trim() || undefined }
    marking.value = true
    try {
      await doMark()
      // usePost 不支持 onSuccess，按结果显式处理；失败时拦截器已提示
      if (isRequestFailed(markRes.value))
        return false
      Message.success(master?.trim() ? `已标记为 ${master.trim()} 的重复` : '已取消重复标记')
      load(target.value)
      return true
    }
    finally {
      marking.value = false
    }
  }

  return {
    lineage,
    loading,
    load,
    reset,
    versionVisible,
    versionLoading,
    versionFile,
    versionMarkdown,
    versionReason,
    viewVersion,
    marking,
    markDuplicate,
  }
}
