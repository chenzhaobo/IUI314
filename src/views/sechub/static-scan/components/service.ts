import type { ModuleWithRepository } from '@/types/static-scan'
/**
 * 静态扫描页内公共组件的接口调用（View → Composable → Service → Api 的 service 层）。
 */
import { ApiSecModuleRepository } from '@/api/sechubApis'
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
