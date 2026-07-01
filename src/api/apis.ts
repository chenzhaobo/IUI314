import type {
  ApiSysDbApi,
  ApiSysDept,
  ApiSysDictData,
  ApiSysDictType,
  ApiSysLogin,
  ApiSysLoginLog,
  ApiSysMenu,
  ApiSysOnlineUser,
  ApiSysOperateLog,
  ApiSysPost,
  ApiSysRole,
  ApiSysScheduledTasks,
  ApiSysScheduledTasksLog,
  ApiSysServiceMonitor,
  ApiSysUser,
} from './sysApis'
import type {
  ApiStockAmazon,
  ApiStockAnalysis,
  ApiStockGiga,
} from './stockApis'
import type { ApiDataScopeTest } from './tests'

export type APIS =
  | ApiSysLogin
  | ApiSysUser
  | ApiSysDictType
  | ApiSysDictData
  | ApiSysMenu
  | ApiSysDbApi
  | ApiSysDept
  | ApiSysPost
  | ApiSysRole
  | ApiSysLoginLog
  | ApiSysOperateLog
  | ApiSysOnlineUser
  | ApiSysServiceMonitor
  | ApiSysScheduledTasks
  | ApiSysScheduledTasksLog
  | ApiDataScopeTest
  | ApiStockGiga
  | ApiStockAmazon
  | ApiStockAnalysis
  | ApiStockSkuMapping

export const ErrorFlag = '__________' // 错误标志
export * from './sysApis'
export * from './stockApis'
export * from './tests'
