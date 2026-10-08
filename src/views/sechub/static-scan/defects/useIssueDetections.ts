/**
 * 缺陷「检出记录」状态：按缺陷 id 拉检出列表，并维护当前查看的那条报告。
 * 默认查看代表检出（即缺陷当前显示内容的来源），没有代表时看最新一条。
 */
import type { Ref } from 'vue'
import type { IssueDetectionRow } from './types'
import { computed, ref, watch } from 'vue'
import { fetchIssueDetections } from './service'

export function useIssueDetections(issueId: Ref<string>) {
  const detections = ref<IssueDetectionRow[]>([])
  const loading = ref(false)
  const activeId = ref('')
  let seq = 0

  const activeDetection = computed(() => detections.value.find(row => row.detection_id === activeId.value) ?? null)

  async function load(id: string) {
    const current = ++seq
    detections.value = []
    activeId.value = ''
    if (!id)
      return
    loading.value = true
    try {
      const list = await fetchIssueDetections(id) ?? []
      if (current !== seq)
        return
      detections.value = list
      activeId.value = (list.find(row => row.is_representative) ?? list[0])?.detection_id ?? ''
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  /** 切换查看的检出报告（表格插槽只给 TableData，按 id 选更稳） */
  function selectDetection(detectionId: string) {
    activeId.value = detectionId
  }

  watch(issueId, id => void load(id), { immediate: true })

  return { detections, loading, activeId, activeDetection, selectDetection, reload: () => load(issueId.value) }
}
