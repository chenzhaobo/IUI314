/**
 * 「新建扫描」的扫描范围与领域资产选择（整仓 / 表单资产 / 微服务资产）。
 *
 * 从 useNewScan 拆出只为控制单文件规模（SC-003 ≤300 行）：这里只管"扫哪些资产"，
 * 不关心仓库来源与差量策略。资产取数按仓库 id 传入，不反向依赖仓库状态。
 */
import type { DomainAsset } from '../domain-assets/types'
import type { AssetOption, ScanTargetType } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { fetchDomainAssets } from './service'

/** 一键全选的上限提示阈值：后端按资产逐条冻结范围，选太多会明显变慢 */
const ASSET_SELECT_SOFT_LIMIT = 300

export function useScanTarget() {
  const scanTargetType = ref<ScanTargetType>('repository')
  const domainAssets = ref<DomainAsset[]>([])
  const selectedAssetIds = ref<string[]>([])
  const includeAmbiguous = ref(false)
  const loadingDomainAssets = ref(false)

  const isDomainTarget = computed(() => scanTargetType.value !== 'repository')
  /** 已选资产共同的同步批次：不一致的资产会被禁用（源码证据可能对不上） */
  const selectedSyncRunId = computed(() => {
    const first = domainAssets.value.find(asset => selectedAssetIds.value.includes(asset.id))
    return first?.last_sync_run_id ? String(first.last_sync_run_id) : ''
  })
  const assetOptions = computed<AssetOption[]>(() => domainAssets.value.map(asset => ({
    value: asset.id,
    label: String(asset.display_name ?? asset.asset_key ?? asset.id),
    fileCount: Number(asset.file_count ?? 0),
    disabled: Boolean(selectedSyncRunId.value && String(asset.last_sync_run_id ?? '') !== selectedSyncRunId.value),
  })))

  /** 翻页取全量：只取第一页会让超出部分的资产根本选不到（表单资产一个仓库就可能上百） */
  async function loadDomainAssets(repositoryId: string | undefined) {
    if (!repositoryId || scanTargetType.value === 'repository') {
      domainAssets.value = []
      return
    }
    loadingDomainAssets.value = true
    try {
      const res = await fetchDomainAssets(scanTargetType.value, repositoryId)
      if (!res) {
        domainAssets.value = []
        return
      }
      domainAssets.value = res.list
      selectedAssetIds.value = selectedAssetIds.value.filter(id => res.list.some(asset => asset.id === id))
      if (res.truncated)
        Message.warning(`当前仓库有 ${res.total} 个可扫描资产，本次先展示 ${res.list.length} 个（可缩小仓库范围或按需分批扫描）`)
    }
    finally {
      loadingDomainAssets.value = false
    }
  }

  /** 一键选中当前列表里的全部资产（含"匹配歧义被禁用"的也会选中：是否需要它们由后端冻结校验兜底） */
  function selectAllAssets() {
    selectedAssetIds.value = domainAssets.value.map(asset => asset.id)
    if (selectedAssetIds.value.length > ASSET_SELECT_SOFT_LIMIT)
      Message.warning(`已选 ${selectedAssetIds.value.length} 个资产，冻结范围与扫描会比较慢，建议按批次扫描`)
  }

  async function onScanTargetChange(repositoryId: string | undefined) {
    selectedAssetIds.value = []
    includeAmbiguous.value = false
    if (scanTargetType.value !== 'repository')
      await loadDomainAssets(repositoryId)
  }

  /** 预填资产（资产详情跳转）：不在当前仓库可扫描范围内（active + in_scope）的忽略 */
  function applyPrefilledAssets(ids: string[]) {
    const available = ids.filter(id => domainAssets.value.some(asset => asset.id === id))
    selectedAssetIds.value = available
    if (available.length === 0)
      Message.warning('预填的资产不在当前仓库的可扫描范围内（要求资产 active 且 in_scope），请重新选择')
  }

  /** 复位到"整个仓库"（打开弹窗与换仓库时） */
  function resetTarget() {
    scanTargetType.value = 'repository'
    selectedAssetIds.value = []
    domainAssets.value = []
    includeAmbiguous.value = false
  }

  return {
    scanTargetType,
    domainAssets,
    selectedAssetIds,
    includeAmbiguous,
    loadingDomainAssets,
    isDomainTarget,
    assetOptions,
    loadDomainAssets,
    selectAllAssets,
    onScanTargetChange,
    applyPrefilledAssets,
    resetTarget,
  }
}
