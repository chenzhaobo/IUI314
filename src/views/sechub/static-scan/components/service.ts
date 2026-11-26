import type { IssueCodePreview, IssueScopeNode, ModuleWithRepository, ScanPointTreeNode } from '@/types/static-scan'
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

/** 代码预览的公共参数：版本（最新/检出时/指定 commit）与行段 */
export interface CodePreviewParams {
  version?: string
  commit?: string
  from?: number
  to?: number
}

/** 按缺陷 id 取代码预览；失败返回 null（拦截器已提示原因） */
export function fetchIssueCode(params: { issue_id: string } & CodePreviewParams): Promise<IssueCodePreview | null> {
  return getAction<IssueCodePreview>(ApiSecPrescan.issueCode, params)
}

/** 按候选 id 取代码预览（仓库/分支/检出 commit 取自候选所属运行） */
export function fetchCandidateCode(params: { candidate_id: string } & CodePreviewParams): Promise<IssueCodePreview | null> {
  return getAction<IssueCodePreview>(ApiSecPrescan.candidateCode, params)
}

/** 缺陷页左树：按维度（规则/项目组/业务领域/产品领域）返回节点与分桶计数 */
export function fetchIssueScopeTree(query: Record<string, string>): Promise<IssueScopeNode | null> {
  return getAction<IssueScopeNode>(ApiSecPrescan.issueScopeTree, query)
}
