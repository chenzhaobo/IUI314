import type { Ref } from 'vue'
import type {
  slowRequestLogList,
  slowRequestLogQueryParam,
  slowSqlLogDetail,
  slowSqlLogList,
  slowSqlLogQueryParam,
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
