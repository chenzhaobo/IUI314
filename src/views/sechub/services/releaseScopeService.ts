/**
 * 发版范围选项取数（View → Composable → Service → Api 的 service 层）。
 *
 * 失败返回 null（拦截器已提示）；调用方保留已有选项，避免下拉被清空。
 */
import type { ReleaseScopeOptions } from '@/types/sechub-release'
import { ApiSecRelease } from '@/api/sechubApis'
import { getAction } from '@/hooks'

/** 范围选项（产品线 / 环境 / 迭代 / 领域树）；失败返回 null */
export function fetchScopeOptions(productLine?: string): Promise<ReleaseScopeOptions | null> {
  const query: { product_line?: string } = {}
  if (productLine)
    query.product_line = productLine
  return getAction<ReleaseScopeOptions>(ApiSecRelease.scopeOptions, query)
}
