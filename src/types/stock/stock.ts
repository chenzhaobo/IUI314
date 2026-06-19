import type { operateInfo, pageData, pageQueryParam } from '@/types/base/apis'

// GigaB2B 同步请求
export interface gigaSyncReq {
  cookie: string
}

// GigaB2B 商品查询参数
export interface gigaItemSearchReq extends pageQueryParam {
  sku?: string
  product_name?: string
  store_name?: string
}

// GigaB2B 商品
export interface gigaItem extends operateInfo {
  id: string
  sku: string
  product_name: string
  image?: string
  quantity?: number
  price?: number
  freight?: number
  drop_shipping_total_cost?: number
  is_available: boolean
  store_name?: string
  fetched_at: string
}

// Amazon 报告查询参数
export interface amazonReportSearchReq extends pageQueryParam {
  report_id?: string
  source?: string
  file_name?: string
}

// Amazon 报告
export interface amazonReport extends operateInfo {
  report_id: string
  file_name: string
  file_path?: string
  total_count: number
  source: string
  uploaded_by?: string
  uploaded_at: string
}

// 自动拉取请求
export interface amazonAutoFetchReq {
  profile_id?: string
}

// 库存分析请求
export interface stockAnalysisReq {
  report_id: string
}

// 库存差异查询参数
export interface stockDiffSearchReq extends pageQueryParam {
  report_id?: string
  diff_type?: string
  sku?: string
  asin?: string
}

// 库存差异类型
export const DIFF_TYPE_MAP: Record<string, string> = {
  no_stock: 'Giga 缺货',
  new_stock: 'Giga 到货',
  low_stock: 'Giga 低库存',
  not_favorite: '未加入收藏',
  price_diff: '价格差异',
}

// 库存差异
export interface stockDiff extends operateInfo {
  id: string
  report_id: string
  asin: string
  sku: string
  product_name?: string
  amazon_qty?: number
  giga_qty?: number
  amazon_price?: number
  giga_price?: number
  diff_type: string
  analyzed_at: string
}

// 导出 CSV 请求
export interface stockExportReq {
  report_id: string
  diff_type: string
}
