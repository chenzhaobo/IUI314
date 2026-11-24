import type { CustomApiScanItem, CustomApiScanTask, CustomApiScanTaskDetail } from '@/types/sechub-test-results'
import { computed, onMounted, ref, watch } from 'vue'
import { fetchCustomApiScanDetail, fetchCustomApiScanTasks } from '../services/testResultsService'

/** 自定义扫描结果：按任务加载已有逐接口明细，筛选和分页均不复制结果数据。 */
export function useCustomApiScanResults() {
  const tasks = ref<CustomApiScanTask[]>([])
  const selectedTaskId = ref('')
  const detail = ref<CustomApiScanTaskDetail | null>(null)
  const tasksLoading = ref(false)
  const loading = ref(false)
  const keyword = ref('')
  const verdict = ref('')
  const pageNum = ref(1)
  const pageSize = ref(20)
  let detailRequestId = 0

  const selectedTask = computed(() => detail.value?.task ?? tasks.value.find(task => task.id === selectedTaskId.value) ?? null)
  const items = computed(() => detail.value?.items ?? [])
  const confirmedCount = computed(() => items.value.filter(item => item.verdict === 'confirmed').length)
  const filteredItems = computed<CustomApiScanItem[]>(() => {
    const normalizedKeyword = keyword.value.trim().toLowerCase()
    return items.value.filter((item) => {
      if (verdict.value && item.verdict !== verdict.value)
        return false
      if (!normalizedKeyword)
        return true
      return [item.call_path, item.api_name, item.api_number, item.app_number, item.app_name]
        .some(value => value?.toLowerCase().includes(normalizedKeyword))
    })
  })
  const pagination = computed(() => ({
    current: pageNum.value,
    pageSize: pageSize.value,
    total: filteredItems.value.length,
    showTotal: true,
    showPageSize: true,
  }))

  async function selectTask(taskId: string) {
    const requestId = ++detailRequestId
    selectedTaskId.value = taskId
    pageNum.value = 1
    detail.value = null
    if (!taskId) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result = await fetchCustomApiScanDetail(taskId)
      if (requestId === detailRequestId)
        detail.value = result
    }
    finally {
      if (requestId === detailRequestId)
        loading.value = false
    }
  }

  async function loadTasks() {
    tasksLoading.value = true
    try {
      const allTasks: CustomApiScanTask[] = []
      let pageNum = 1
      let total = 0
      do {
        const data = await fetchCustomApiScanTasks(pageNum)
        if (!data)
          break
        allTasks.push(...data.list)
        total = data.total
        pageNum += 1
      } while (allTasks.length < total && total > 0)
      tasks.value = allTasks
      const nextTaskId = tasks.value.some(task => task.id === selectedTaskId.value)
        ? selectedTaskId.value
        : (tasks.value[0]?.id ?? '')
      await selectTask(nextTaskId)
    }
    finally {
      tasksLoading.value = false
    }
  }

  function handlePageChange(page: number) {
    pageNum.value = page
  }

  function handlePageSizeChange(size: number) {
    pageSize.value = size
    pageNum.value = 1
  }

  function resetFilters() {
    keyword.value = ''
    verdict.value = ''
    pageNum.value = 1
  }

  watch([keyword, verdict], () => {
    pageNum.value = 1
  })
  onMounted(() => void loadTasks())

  return {
    tasks,
    selectedTaskId,
    selectedTask,
    detail,
    tasksLoading,
    loading,
    keyword,
    verdict,
    filteredItems,
    confirmedCount,
    pagination,
    selectTask,
    handlePageChange,
    handlePageSizeChange,
    resetFilters,
  }
}
