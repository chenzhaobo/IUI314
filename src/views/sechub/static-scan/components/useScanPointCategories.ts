/**
 * 扫描点 → (域, 分类) 映射：结果页规则分布、缺陷页规则分布补「分类」层用。
 *
 * 取数源与规则版本页左树一致（GET 扫描点树），保证三处左树的层级与分类口径相同：
 * 域 → 分类（中文）→ 扫描点 → 规则。扫描点目录变化很慢，页面间共享一次加载结果；
 * 加载失败不缓存（下次调用重试），调用方按行上自带的 domain/category 兜底。
 */
import type { ScanPointTreeNode } from '@/types/static-scan'
import { shallowRef } from 'vue'
import { fetchScanPointTree } from './service'

/** 扫描点所属的域与分类（分类为原始 key，展示时再过 categoryLabel） */
export interface ScanPointCategory {
  domain: string
  category: string
}

export type ScanPointCategoryMap = ReadonlyMap<string, ScanPointCategory>

/** 模块级共享：多个页面 / 同页多次调用只发一次请求（整体替换，shallowRef 足够） */
const shared = shallowRef<ScanPointCategoryMap>(new Map())
let inflight: Promise<void> | null = null
let loaded = false

/** 扫描点树（domain → category → scan_point）拍平成 spId → {domain, category} */
export function flattenScanPointTree(nodes: ScanPointTreeNode[]): Map<string, ScanPointCategory> {
  const map = new Map<string, ScanPointCategory>()
  for (const domainNode of nodes) {
    for (const categoryNode of domainNode.children) {
      for (const point of categoryNode.children) {
        if (point.level === 'scan_point')
          map.set(point.value, { domain: domainNode.value, category: categoryNode.label })
      }
    }
  }
  return map
}

async function loadOnce(): Promise<void> {
  const tree = await fetchScanPointTree()
  if (tree) {
    shared.value = flattenScanPointTree(tree)
    loaded = true
  }
}

export function useScanPointCategories() {
  /** 确保映射已加载（失败时静默：调用方按行字段兜底） */
  async function ensureScanPointCategories(): Promise<void> {
    if (loaded)
      return
    if (!inflight)
      inflight = loadOnce().finally(() => { inflight = null })
    await inflight
  }

  return { scanPointCategories: shared, ensureScanPointCategories }
}
