/**
 * 「新建扫描」的统一扫描（006c C01）：自动资产摘要（unified-preview）与统一触发。
 *
 * 统一模式本期只支持全量（后端 plan：统一 run 的差量留后续），所以没有分支/commit/差量向导，
 * 资产也不由用户勾选 —— 后端自动选取该仓全部在用表单/微服务资产；blocked_reason 非空时禁止提交。
 * 与 useScanTarget 平级：只管统一模式自己的状态，模式切换与弹窗编排在 useNewScan。
 */
import type { ScanMode, UnifiedPreview, UnifiedTriggerResponse } from './types'
import { computed, ref } from 'vue'
import { unifiedBlockedText } from './labels'
import { fetchUnifiedPreview, triggerUnified } from './service'

export function useUnifiedScan() {
  /** 默认统一扫描；旧三种范围收在「过渡期旧轨」折叠项里 */
  const scanMode = ref<ScanMode>('unified')
  const unifiedPreview = ref<UnifiedPreview | null>(null)
  const loadingUnifiedPreview = ref(false)
  const triggeringUnified = ref(false)
  /** 预览对应的仓库：换仓库后旧摘要作废 */
  let previewRepositoryId = ''
  /** 请求序号：快速换仓库时丢弃慢响应 */
  let previewSeq = 0

  const unifiedBlockedReason = computed(() => {
    const reason = unifiedPreview.value?.blocked_reason?.trim()
    return reason ? unifiedBlockedText(reason) : ''
  })
  /** 可提交 = 预览已返回且未阻断（预览失败时不放行，避免触发端才报错） */
  const unifiedCanSubmit = computed(() => Boolean(unifiedPreview.value) && !unifiedBlockedReason.value && !loadingUnifiedPreview.value)

  async function loadUnifiedPreview(repositoryId: string | undefined) {
    const seq = ++previewSeq
    if (!repositoryId) {
      unifiedPreview.value = null
      previewRepositoryId = ''
      return
    }
    loadingUnifiedPreview.value = true
    try {
      const res = await fetchUnifiedPreview(repositoryId)
      if (seq !== previewSeq)
        return
      unifiedPreview.value = res
      previewRepositoryId = res ? repositoryId : ''
    }
    finally {
      if (seq === previewSeq)
        loadingUnifiedPreview.value = false
    }
  }

  /** 已有同仓库预览就不重拉（切回统一模式时用） */
  async function ensureUnifiedPreview(repositoryId: string | undefined) {
    if (repositoryId && repositoryId === previewRepositoryId && unifiedPreview.value)
      return
    await loadUnifiedPreview(repositoryId)
  }

  /** 统一触发；rule_set_id 空值走 undefined（JSON 序列化整键消失 = 平台默认目录） */
  async function submitUnifiedTrigger(repositoryId: string, ruleSetId: string): Promise<UnifiedTriggerResponse | null> {
    triggeringUnified.value = true
    try {
      return await triggerUnified({ repository_id: repositoryId, rule_set_id: ruleSetId || undefined, force: false })
    }
    finally {
      triggeringUnified.value = false
    }
  }

  function resetUnified() {
    scanMode.value = 'unified'
    unifiedPreview.value = null
    previewRepositoryId = ''
    previewSeq += 1
    loadingUnifiedPreview.value = false
  }

  return {
    scanMode,
    unifiedPreview,
    loadingUnifiedPreview,
    triggeringUnified,
    unifiedBlockedReason,
    unifiedCanSubmit,
    loadUnifiedPreview,
    ensureUnifiedPreview,
    submitUnifiedTrigger,
    resetUnified,
  }
}
