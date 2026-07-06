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
import type { ApiDataScopeTest } from './tests'
import type {
  ApiSecDefect,
  ApiSecFinding,
  ApiSecOrg,
  ApiSecProjectGroup,
  ApiSecReleaseWindow,
  ApiSecScanRun,
  ApiSecScanTask,
  ApiSecScanTool,
  ApiSecTestEnv,
  ApiSecUserStory,
} from './sechubApis'
import type {
  ApiPerfEnv,
  ApiPerfCloud,
  ApiPerfApp,
  ApiPerfMenu,
  ApiPerfScriptMenu,
  ApiPerfScript,
  ApiPerfRun,
  ApiPerfReport,
  ApiPerfBaseline,
  ApiPerfIteration,
  ApiPerfTask,
  ApiPerfModule,
  ApiPerfTableStats,
  ApiPerfTestPlan,
} from './perfApis'
import type {
  ApiInfraHost,
  ApiInfraVm,
  ApiInfraService,
  ApiInfraEnvMapping,
} from './infraApis'

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
  | ApiSecScanTool
  | ApiSecScanRun
  | ApiSecFinding
  | ApiSecOrg
  | ApiSecDefect
  | ApiSecProjectGroup
  | ApiSecReleaseWindow
  | ApiSecScanTask
  | ApiSecTestEnv
  | ApiSecUserStory
  | ApiPerfEnv
  | ApiPerfCloud
  | ApiPerfApp
  | ApiPerfMenu
  | ApiPerfScriptMenu
  | ApiPerfScript
  | ApiPerfRun
  | ApiPerfReport
  | ApiPerfBaseline
  | ApiPerfIteration
  | ApiPerfTask
  | ApiPerfModule
  | ApiPerfTableStats
  | ApiPerfTestPlan
  | ApiInfraHost
  | ApiInfraVm
  | ApiInfraService
  | ApiInfraEnvMapping

export const ErrorFlag = '__________' // 错误标志
export * from './sysApis'
export * from './tests'
export * from './sechubApis'
export * from './perfApis'
export * from './infraApis'
