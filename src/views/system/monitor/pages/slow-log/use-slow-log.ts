import type { slowRequestLogQueryParam, slowSqlLog, slowSqlLogQueryParam } from '@/types/system/slow-log'
import { ref } from 'vue'
import { useSlowRequestListApi, useSlowSqlDetailApi, useSlowSqlListApi } from './service'

const defaultPage = () => ({ page_num: 1, page_size: 10, min_elapsed_ms: 1000 })

export function useSlowRequestLog() {
  const queryParams = ref<slowRequestLogQueryParam>(defaultPage())
  const { data, isFetching, execute } = useSlowRequestListApi(queryParams)
  const getList = () => execute()
  const query = () => {
    queryParams.value.page_num = 1
    return getList()
  }
  return { queryParams, data, loading: isFetching, getList, query }
}

export function useSlowSqlLog() {
  const queryParams = ref<slowSqlLogQueryParam>(defaultPage())
  const { data, isFetching, execute } = useSlowSqlListApi(queryParams)
  const getList = () => execute()
  const query = () => {
    queryParams.value.page_num = 1
    return getList()
  }
  return { queryParams, data, loading: isFetching, getList, query }
}

export function useSlowSqlDetail() {
  const slowSqlId = ref('')
  const visible = ref(false)
  const { data, isFetching, execute } = useSlowSqlDetailApi(slowSqlId)
  async function openDetail(row: slowSqlLog) {
    slowSqlId.value = row.slow_sql_id
    visible.value = true
    await execute()
  }
  return { detail: data, loading: isFetching, visible, openDetail }
}
