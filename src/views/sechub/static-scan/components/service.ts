import type { IssueScopeNode, ModuleWithRepository, ScanPointTreeNode } from '@/types/static-scan'
/**
 * 静态扫描页内公共组件的接口调用（View → Composable → Service → Api 的 service 层）。
 */
import { ApiSecModuleRepository, ApiSecPrescan, ApiSecScanPoint } from '@/api/sechubApis'
import { getAction } from '@/hooks'

/**
 * 应用范围树的仓库源。
 *
 * include_unbound_local=true：反编译源码登记只建仓库、不绑业务模块，不带这个参数
 * 左树就看不到它们（与扫描看板、新建扫描弹窗的取数口径一致）。
 */
export function fetchScopeRepositories(): Promise<ModuleWithRepository[] | null> {
  return getAction<ModuleWithRepository[]>(ApiSecModuleRepository.listWithModule, { include_unbound_local: true })
}

/** 扫描点树（域 → 分类 → 扫描点），规则版本页左树同源；结果页/缺陷页用它补「分类」层 */
export function fetchScanPointTree(): Promise<ScanPointTreeNode[] | null> {
  return getAction<ScanPointTreeNode[]>(ApiSecScanPoint.tree)
}

/** 缺陷页左树：按维度（规则/项目组/业务领域/产品领域）返回节点与分桶计数 */
export function fetchIssueScopeTree(query: Record<string, string>): Promise<IssueScopeNode | null> {
  return getAction<IssueScopeNode>(ApiSecPrescan.issueScopeTree, query)
}
