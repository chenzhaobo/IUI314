/**
 * 「新建扫描」的统一扫描：自动资产摘要 + 增量基线（unified-preview）、扫描方式与统一触发。
 *
 * 契约 D：基线按（仓库, 分支）自动取最近一次已定稿的全量统一 run，没有人工采纳步骤；
 * 没有可用基线时不能选增量（给出 baseline_unavailable_reason）。资产不由用户勾选 ——
 * 后端自动选取该仓全部在用表单/微服务资产；blocked_reason 非空时禁止提交。
 */
import type { ScanStrategy, UnifiedBaseline, UnifiedPreview, UnifiedTriggerRequest, UnifiedTriggerResponse } from './types'
import { computed, ref } from 'vue'
import { unifiedBlockedText } from './labels'
import { fetchUnifiedPreview, triggerUnified } from './service'

/** 后端没给原因时的兜底说明 */
const DEFAULT_NO_BASELINE_REASON = '该分支还没有已定稿的全量统一扫描，先跑一次全量扫描作为基线'

export function useUnifiedScan() {
  const strategy = ref<ScanStrategy>('full')
  const unifiedPreview = ref<UnifiedPreview | null>(null)
  const loadingUnifiedPreview = ref(false)
  const triggeringUnified = ref(false)
  /** 请求序号：快速换仓库/分支时丢弃慢响应 */
  let previewSeq = 0

  /** 可用基线（useGet 会把 null 归一成 {}，所以按 run_id 判定） */
  const baseline = computed<UnifiedBaseline | null>(() => {
    const value = unifiedPreview.value?.baseline
    return value?.run_id ? value : null
  })
  /** 增量不可选的原因（'' = 可选） */
  const incrementalDisabledReason = computed(() => {
    if (!unifiedPreview.value)
      return '预览未返回，暂不能判断是否有可用基线'
    if (baseline.value)
      return ''
    return unifiedPreview.value.baseline_unavailable_reason?.trim() || DEFAULT_NO_BASELINE_REASON
  })
  const unifiedBlockedReason = computed(() => {
    const reason = unifiedPreview.value?.blocked_reason?.trim()
    return reason ? unifiedBlockedText(reason) : ''
  })
  /** 可提交 = 预览已返回且未阻断（预览失败时不放行，避免触发端才报错） */
  const unifiedCanSubmit = computed(() => Boolean(unifiedPreview.value) && !unifiedBlockedReason.value && !loadingUnifiedPreview.value)

  /** 拉预览（仓库或分支变化时）；没有可用基线时把已选的增量退回全量 */
  async function loadUnifiedPreview(repositoryId: string | undefined, branch: string) {
    const seq = ++previewSeq
    if (!repositoryId) {
      unifiedPreview.value = null
      loadingUnifiedPreview.value = false
      return
    }
    loadingUnifiedPreview.value = true
    try {
      const res = await fetchUnifiedPreview(repositoryId, branch)
      if (seq !== previewSeq)
        return
      unifiedPreview.value = res
      if (!baseline.value)
        strategy.value = 'full'
    }
    finally {
      if (seq === previewSeq)
        loadingUnifiedPreview.value = false
    }
  }

  /** 统一触发；请求体由调用方组装（空值字段不出现） */
  async function submitUnifiedTrigger(body: UnifiedTriggerRequest): Promise<UnifiedTriggerResponse | null> {
    triggeringUnified.value = true
    try {
      return await triggerUnified(body)
    }
    finally {
      triggeringUnified.value = false
    }
  }

  function resetUnified() {
    strategy.value = 'full'
    unifiedPreview.value = null
    previewSeq += 1
    loadingUnifiedPreview.value = false
  }

  return {
    strategy,
    unifiedPreview,
    loadingUnifiedPreview,
    triggeringUnified,
    baseline,
    incrementalDisabledReason,
    unifiedBlockedReason,
    unifiedCanSubmit,
    loadUnifiedPreview,
    submitUnifiedTrigger,
    resetUnified,
  }
}
