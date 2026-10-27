import type { Ref } from 'vue'
import type {
  slowRequestLog,
  slowRequestLogList,
  slowRequestLogQueryParam,
  slowRequestOverview,
  slowSqlLogDetail,
  slowSqlLogList,
  slowSqlLogQueryParam,
  slowSqlOverview,
} from '@/types/system/slow-log'
import { computed } from 'vue'
import { ApiSysSlowRequest, ApiSysSlowSql } from '@/api/apis'
import { useGet } from '@/hooks'

export function useSlowRequestListApi(queryParams: Ref<slowRequestLogQueryParam>) {
  return useGet<slowRequestLogList>(ApiSysSlowRequest.getList, queryParams, { immediate: true })
}

export function useSlowSqlListApi(queryParams: Ref<slowSqlLogQueryParam>) {
  return useGet<slowSqlLogList>(ApiSysSlowSql.getList, queryParams, { immediate: true })
}

export function useSlowSqlDetailApi(slowSqlId: Ref<string>) {
  const queryParams = computed(() => ({ slow_sql_id: slowSqlId.value }))
  return useGet<slowSqlLogDetail>(ApiSysSlowSql.getById, queryParams, { immediate: false })
}

export function useSlowRequestDetailApi(requestId: Ref<string>) {
  const queryParams = computed(() => ({ request_id: requestId.value }))
  return useGet<slowRequestLog>(ApiSysSlowRequest.getById, queryParams, { immediate: false })
}

export function useSlowRequestOverviewApi() {
  return useGet<slowRequestOverview>(ApiSysSlowRequest.getOverview, {}, { immediate: true })
}

export function useSlowSqlOverviewApi() {
  return useGet<slowSqlOverview>(ApiSysSlowSql.getOverview, {}, { immediate: true })
}

export function useSlowSqlByTraceApi(traceId: Ref<string>) {
  const queryParams = computed(() => ({ page_num: 1, page_size: 20, trace_id: traceId.value }))
  return useGet<slowSqlLogList>(ApiSysSlowSql.getList, queryParams, { immediate: false })
}
