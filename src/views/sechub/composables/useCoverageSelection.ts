/**
 * 「接口覆盖」页勾选：跨页保留（Map key = api_path|METHOD）。
 *
 * 只有未覆盖 / 待评审可勾选；范围或明细筛选变化时由页面调用 `clearSelection()`，
 * 避免把用户已经看不见的接口一并派发。
 */
import type { ReleaseApi } from '@/types/sechub-release'
import { computed, ref } from 'vue'

import { apiSelectionKey, groupSelectedApis, isSelectable } from './releaseCoverageRules'

export function useCoverageSelection() {
  const selected = ref(new Map<string, ReleaseApi>())

  const selectedApis = computed<ReleaseApi[]>(() => [...selected.value.values()])
  const selectedCount = computed(() => selected.value.size)
  /** 勾选键列表（供表格受控渲染） */
  const selectedKeys = computed(() => [...selected.value.keys()])
  /** 项目组编码 → api_path 列表（一键测试按组逐次派发） */
  const selectedByGroup = computed(() => groupSelectedApis(selectedApis.value))
  const selectedGroupCount = computed(() => Object.keys(selectedByGroup.value).length)
  /** 项目组编码 → 名称（弹窗展示用） */
  const selectedGroupNames = computed<Record<string, string>>(() => {
    const names: Record<string, string> = {}
    for (const api of selectedApis.value)
      names[api.project_group_code.trim()] = api.project_group_name
    return names
  })

  function selectableOnPage(apis: ReleaseApi[]): ReleaseApi[] {
    return apis.filter(api => isSelectable(api.coverage))
  }

  function hasPageSelectable(apis: ReleaseApi[]): boolean {
    return selectableOnPage(apis).length > 0
  }

  function pageAllSelected(apis: ReleaseApi[]): boolean {
    const selectable = selectableOnPage(apis)
    return selectable.length > 0
      && selectable.every(api => selected.value.has(apiSelectionKey(api.api_path, api.http_method)))
  }

  function isApiSelected(api: ReleaseApi): boolean {
    return selected.value.has(apiSelectionKey(api.api_path, api.http_method))
  }

  function toggleApi(api: ReleaseApi) {
    if (!isSelectable(api.coverage))
      return
    const key = apiSelectionKey(api.api_path, api.http_method)
    const next = new Map(selected.value)
    if (next.has(key))
      next.delete(key)
    else
      next.set(key, api)
    selected.value = next
  }

  /** 表头全选：本页可勾选行全选 / 取消 */
  function togglePageSelection(apis: ReleaseApi[]) {
    const next = new Map(selected.value)
    if (pageAllSelected(apis)) {
      for (const api of selectableOnPage(apis))
        next.delete(apiSelectionKey(api.api_path, api.http_method))
    }
    else {
      for (const api of selectableOnPage(apis))
        next.set(apiSelectionKey(api.api_path, api.http_method), api)
    }
    selected.value = next
  }

  function clearSelection() {
    selected.value = new Map()
  }

  return {
    selectedApis,
    selectedCount,
    selectedKeys,
    selectedByGroup,
    selectedGroupCount,
    selectedGroupNames,
    hasPageSelectable,
    pageAllSelected,
    isApiSelected,
    toggleApi,
    togglePageSelection,
    clearSelection,
  }
}
