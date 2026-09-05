/**
 * 服务端分页的查询状态与事件处理。
 *
 * ## 为什么要有它
 * 全站 69 个页面各自手写分页，结果同一类 bug 反复出现：
 *
 * - **每页条数不生效**：15 个页面写了 `showPageSize: true` 却只监听 `@page-change`，
 *   漏了 `@page-size-change`。Arco 不会自己改服务端查询参数，所以选了 50 条毫无反应。
 * - **改条数后"数据没了"**：原本停在第 5 页，条数从 10 改成 50，第 5 页往往已超出
 *   新的总页数，后端返回空列表。必须同时把页码重置为 1。
 * - **改筛选条件后"搜不到"**：在第 3 页输入关键词点查询，页码没重置，
 *   结果拿到的是"符合条件的第 3 页"，而符合条件的记录可能只有 2 条。
 *
 * 这三条都是"每次都要记住"的事，写成一处就不会再漏。
 *
 * ## 用法
 * ```ts
 * const { query, total, pagination, onPageChange, onPageSizeChange, search, reset }
 *   = usePagedQuery({ keyword: '', status: '' }, () => fetchList())
 *
 * const { data, execute: fetchList } = useGet(ApiXxx.getList, query, { immediate: true })
 * watch(data, (d) => { rows.value = d?.list ?? []; total.value = d?.total ?? 0 })
 * ```
 * ```vue
 * <a-table
 *   :pagination="pagination"
 *   @page-change="onPageChange"
 *   @page-size-change="onPageSizeChange"
 * />
 * ```
 *
 * `query` 直接当作请求参数传给 `useGet` —— 它是一个 `ref`，页码/条数变化会被
 * `useGet` 的响应式参数捕获，所以 `fetch` 拿到的一定是最新值。
 */

import { computed, ref } from 'vue'
import type { Ref } from 'vue'

/** 后端统一的分页字段名 */
export interface PagedParams {
  page_num: number
  page_size: number
}

export interface UsePagedQueryOptions {
  /** 初始每页条数 */
  pageSize?: number
  /** 可选的每页条数档位 */
  pageSizeOptions?: number[]
  /** 是否显示总数 */
  showTotal?: boolean
  /** 是否允许改每页条数 */
  showPageSize?: boolean
}

export function usePagedQuery<T extends Record<string, any>>(
  /** 除分页外的查询条件初值 */
  initial: T,
  /** 参数变化后用来重新拉取数据的函数 */
  fetch: () => void,
  options?: UsePagedQueryOptions,
) {
  const query = ref({
    page_num: 1,
    page_size: options?.pageSize ?? 20,
    ...initial,
  }) as Ref<T & PagedParams>

  const total = ref(0)

  /** 直接绑给 `<a-table :pagination>` */
  const pagination = computed(() => ({
    total: total.value,
    current: query.value.page_num,
    pageSize: query.value.page_size,
    showTotal: options?.showTotal ?? true,
    showPageSize: options?.showPageSize ?? true,
    ...(options?.pageSizeOptions ? { pageSizeOptions: options.pageSizeOptions } : {}),
  }))

  function onPageChange(page: number) {
    query.value.page_num = page
    fetch()
  }

  function onPageSizeChange(size: number) {
    query.value.page_size = size
    // 必须回到第 1 页：原本停在第 5 页、条数改大后该页往往已超出总页数，
    // 后端返回空列表，用户看到的是"数据没了"
    query.value.page_num = 1
    fetch()
  }

  /**
   * 条件变化后重新查询。
   * 同样要回到第 1 页 —— 在第 3 页改条件直接查，拿到的是"新条件的第 3 页"，
   * 而符合新条件的记录可能还不到一页。
   */
  function search() {
    query.value.page_num = 1
    fetch()
  }

  /** 清空筛选条件回到初始状态（保留每页条数，那是用户的显示偏好） */
  function reset() {
    const size = query.value.page_size
    query.value = { page_num: 1, page_size: size, ...initial } as T & PagedParams
    fetch()
  }

  return { query, total, pagination, onPageChange, onPageSizeChange, search, reset }
}
