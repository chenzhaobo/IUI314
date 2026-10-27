import type { slowRequestLog, slowRequestLogQueryParam, slowSqlLog, slowSqlLogQueryParam } from '@/types/system/slow-log'
import { ref } from 'vue'
import {
  useSlowRequestDetailApi,
  useSlowRequestListApi,
  useSlowRequestOverviewApi,
  useSlowSqlByTraceApi,
  useSlowSqlDetailApi,
  useSlowSqlListApi,
  useSlowSqlOverviewApi,
} from './service'

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

export function useSlowRequestOverview() {
  const { data, isFetching } = useSlowRequestOverviewApi()
  return { overview: data, loading: isFetching }
}

export function useSlowSqlOverview() {
  const { data, isFetching } = useSlowSqlOverviewApi()
  return { overview: data, loading: isFetching }
}

export function useSlowRequestDetail() {
  const requestId = ref('')
  const traceId = ref('')
  const visible = ref(false)
  const { data: detail, isFetching: detailLoading, execute: loadDetail } = useSlowRequestDetailApi(requestId)
  const { data: relatedSql, isFetching: sqlLoading, execute: loadSql } = useSlowSqlByTraceApi(traceId)
  async function openDetail(row: slowRequestLog) {
    requestId.value = row.request_id
    traceId.value = row.trace_id
    visible.value = true
    await Promise.all([loadDetail(), loadSql()])
  }
  return { detail, relatedSql, detailLoading, sqlLoading, visible, openDetail }
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
