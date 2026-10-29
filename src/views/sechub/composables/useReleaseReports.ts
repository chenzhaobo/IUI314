/**
 * 发版报告页状态：快照列表（服务端分页）、报告预览、下载、定稿与撤销定稿。
 *
 * 列表只给摘要字段；预览按需拉详情（含 report_md）。请求失败统一返回 null
 * （拦截器已提示），这里保留旧数据，避免页面闪空。
 */
import type {
  ReleaseSnapshotDetail,
  ReleaseSnapshotRow,
} from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { computed, onActivated, onMounted, ref } from 'vue'
import { useDownload } from '@/hooks'

import {
  fetchReleaseSnapshotDetail,
  fetchReleaseSnapshots,
  finalizeReleaseSnapshot,
  snapshotReportPath,
  unfinalizeReleaseSnapshot,
} from '../services/releaseDashboardService'

export function useReleaseReports() {
  const loading = ref(false)
  const list = ref<ReleaseSnapshotRow[]>([])
  const pageNum = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const drawerVisible = ref(false)
  const detailLoading = ref(false)
  const detail = ref<ReleaseSnapshotDetail | null>(null)
  /** 正在定稿 / 撤销定稿的快照 id */
  const actingId = ref('')
  const unfinalizeVisible = ref(false)
  const unfinalizing = ref(false)
  const unfinalizeTarget = ref<ReleaseSnapshotRow | null>(null)
  const { downloadWithTip } = useDownload()

  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: total.value,
    showTotal: true,
    showPageSize: true,
  }))

  async function loadSnapshots() {
    loading.value = true
    try {
      const result = await fetchReleaseSnapshots({ page_num: pageNum.value, page_size: pageSize.value })
      if (!result)
        return
      list.value = result.list
      total.value = result.total
    }
    finally {
      loading.value = false
    }
  }

  function handlePageChange(page: number) {
    pageNum.value = page
    void loadSnapshots()
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
    void loadSnapshots()
  }

  async function openReport(row: ReleaseSnapshotRow) {
    drawerVisible.value = true
    detailLoading.value = true
    detail.value = null
    try {
      detail.value = await fetchReleaseSnapshotDetail(row.id)
    }
    finally {
      detailLoading.value = false
    }
  }

  function downloadReport(row: ReleaseSnapshotRow) {
    const name = `发版报告-${row.iteration_code || row.iteration_id}.md`
    void downloadWithTip(snapshotReportPath(row.id), name, '下载发版报告失败')
  }

  async function finalize(row: ReleaseSnapshotRow) {
    if (actingId.value)
      return
    actingId.value = row.id
    try {
      const result = await finalizeReleaseSnapshot(row.id)
      if (!result)
        return
      Message.success('已定稿')
      await loadSnapshots()
    }
    finally {
      actingId.value = ''
    }
  }

  function openUnfinalize(row: ReleaseSnapshotRow) {
    unfinalizeTarget.value = row
    unfinalizeVisible.value = true
  }

  /** 撤销定稿；成功返回 true（弹窗据此关闭），失败保持打开 */
  async function submitUnfinalize(reason: string): Promise<boolean> {
    const target = unfinalizeTarget.value
    if (!target || unfinalizing.value || !reason.trim())
      return false
    unfinalizing.value = true
    try {
      const result = await unfinalizeReleaseSnapshot(target.id, reason.trim())
      if (!result)
        return false
      Message.success('已撤销定稿')
      await loadSnapshots()
      return true
    }
    finally {
      unfinalizing.value = false
    }
  }

  /** 首次取数完成前不响应 onActivated，避免 keep-alive 首次挂载时重复请求 */
  let initialized = false

  onMounted(() => {
    void loadSnapshots().then(() => {
      initialized = true
    })
  })
  onActivated(() => {
    if (initialized)
      void loadSnapshots()
  })

  return {
    loading,
    list,
    pagination,
    drawerVisible,
    detailLoading,
    detail,
    actingId,
    unfinalizeVisible,
    unfinalizing,
    unfinalizeTarget,
    loadSnapshots,
    handlePageChange,
    handlePageSizeChange,
    openReport,
    downloadReport,
    finalize,
    openUnfinalize,
    submitUnfinalize,
  }
}
