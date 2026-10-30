import type { ConfigRuleRow, WaiverFormInput } from './configCheckRules'
import type { useConfigCheckSummary } from './useConfigCheckSummary'
import type { useReleaseScope } from './useReleaseScope'
import type {
  ConfigBatchDefectResult,
  ConfigEvent,
  ConfigItem,
  ConfigRunFamily,
} from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { toApiParam } from '@/hooks'
import {
  addWaiver,
  createConfigDefect,
  createConfigDefectsBatch,
  fetchConfigEvents,
  runConfigCheck,
} from '../services/configCheckService'
import {
  configDefectLink,
  validateWaiverReason,
  waiverRequestOf,
} from './configCheckRules'

/**
 * 配置检查的动作：手动执行、生成缺陷（单行 / 按规则批量）、加白名单、变更记录。
 *
 * 取数状态在 summary / items 里，本模块只负责动作与弹窗，成功后回调 `reload` 刷新汇总与明细。
 */
export function useConfigCheckActions(
  scope: ReturnType<typeof useReleaseScope>,
  summary: ReturnType<typeof useConfigCheckSummary>,
  reload: () => Promise<void>,
) {
  const router = useRouter()
  const family = ref<ConfigRunFamily>('meta')
  const running = ref(false)
  const rowDefectLoadingId = ref('')

  const batchVisible = ref(false)
  const batchRule = ref<ConfigRuleRow | null>(null)
  const batchLoading = ref(false)
  const batchResult = ref<ConfigBatchDefectResult | null>(null)

  const waiverVisible = ref(false)
  const waiverItem = ref<ConfigItem | null>(null)
  const waiverLoading = ref(false)

  const eventsVisible = ref(false)
  const eventsItem = ref<ConfigItem | null>(null)
  const events = ref<ConfigEvent[]>([])
  const eventsLoading = ref(false)

  function envId(): string {
    return summary.summary.value?.env.id.trim() ?? ''
  }

  async function runCheck() {
    running.value = true
    try {
      const result = await runConfigCheck(family.value)
      if (result?.accepted)
        Message.success('已开始检查，稍后刷新')
    }
    finally {
      running.value = false
    }
  }

  /** 单行生成缺陷：项目组 + 规则；未归属项目组的检查项后端无法生成 */
  async function createRowDefect(item: ConfigItem): Promise<boolean> {
    const group = item.project_group_code?.trim() ?? ''
    const id = envId()
    if (!id || !group || !item.rule_code.trim())
      return false
    rowDefectLoadingId.value = item.id
    try {
      const result = await createConfigDefect({
        env_id: id,
        project_group_code: group,
        rule_code: item.rule_code.trim(),
      })
      if (!result)
        return false
      Message.success(result.created
        ? `已生成缺陷草稿（${result.item_count} 项）`
        : `已更新缺陷草稿（${result.item_count} 项）`)
      await reload()
      return true
    }
    finally {
      rowDefectLoadingId.value = ''
    }
  }

  function openDefect(item: ConfigItem) {
    if (!item.defect)
      return
    void router.push(configDefectLink(item.defect.defect_code, scope.productLine.value))
  }

  function openBatchDefect(rule: ConfigRuleRow) {
    batchRule.value = rule
    batchResult.value = null
    batchVisible.value = true
  }

  function resetBatch() {
    batchVisible.value = false
    batchRule.value = null
    batchResult.value = null
  }

  async function submitBatchDefect(groups: string[]): Promise<boolean> {
    if (!batchRule.value || !groups.length)
      return false
    batchLoading.value = true
    try {
      const result = await createConfigDefectsBatch({
        product_line: scope.productLine.value || undefined,
        env_id: envId() || undefined,
        rule_code: batchRule.value.code,
        project_groups: groups,
      })
      if (!result)
        return false
      batchResult.value = result
      const failed = result.failed.length ? `，失败 ${result.failed.length} 个` : ''
      Message.success(`已生成 ${result.created} 个、更新 ${result.updated} 个配置缺陷${failed}`)
      await reload()
      return true
    }
    finally {
      batchLoading.value = false
    }
  }

  function openWaiver(item: ConfigItem) {
    waiverItem.value = item
    waiverVisible.value = true
  }

  /** 白名单：立即生效，返回后刷新汇总与明细（命中项转为已加白） */
  async function submitWaiver(item: ConfigItem, form: WaiverFormInput): Promise<boolean> {
    const error = validateWaiverReason(form.reason)
    if (error) {
      Message.warning(error)
      return false
    }
    const expiresAt = toApiParam(form.expiresAt) ?? ''
    waiverLoading.value = true
    try {
      const result = await addWaiver(waiverRequestOf(item, { ...form, expiresAt }))
      if (!result)
        return false
      Message.success(`已加白名单（${result.affected} 项转为已加白）`)
      waiverVisible.value = false
      await reload()
      return true
    }
    finally {
      waiverLoading.value = false
    }
  }

  async function loadEvents(itemId: string) {
    eventsLoading.value = true
    events.value = []
    try {
      const result = await fetchConfigEvents(itemId)
      events.value = result?.list ?? []
    }
    finally {
      eventsLoading.value = false
    }
  }

  function openEvents(item: ConfigItem) {
    eventsItem.value = item
    eventsVisible.value = true
    void loadEvents(item.id)
  }

  return {
    family,
    running,
    rowDefectLoadingId,
    batchVisible,
    batchRule,
    batchLoading,
    batchResult,
    waiverVisible,
    waiverItem,
    waiverLoading,
    eventsVisible,
    eventsItem,
    events,
    eventsLoading,
    runCheck,
    createRowDefect,
    openDefect,
    openBatchDefect,
    resetBatch,
    submitBatchDefect,
    openWaiver,
    submitWaiver,
    openEvents,
  }
}
