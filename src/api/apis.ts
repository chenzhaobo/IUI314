import type {
  ApiSysDbApi,
  ApiSysDept,
  ApiSysDictData,
  ApiSysDictType,
  ApiSysLogin,
  ApiSysLoginLog,
  ApiSysMenu,
  ApiSysMigration,
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
  ApiPerfLoadNode,
  ApiPerfAttachment,
} from './perfApis'
import type {
  ApiInfraHost,
  ApiInfraVm,
  ApiInfraService,
  ApiInfraEnvMapping,
} from './infraApis'
import type {
  ApiDmp
} from './dmpApis'
import type { ApiAiAgent, ApiAiSkill, ApiAiExecution, ApiAiInvoke } from './aiApis'
import type { ApiMcArtifact, ApiMcAudit, ApiMcEnvironment } from './mcApis'

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
  | ApiSysMigration
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
  | ApiPerfLoadNode
  | ApiPerfAttachment
  | ApiInfraHost
  | ApiInfraVm
  | ApiInfraService
  | ApiInfraEnvMapping
  | ApiDmp
  | ApiAiAgent
  | ApiAiSkill
  | ApiAiExecution
  | ApiAiInvoke
  | ApiMcArtifact
  | ApiMcEnvironment
  | ApiMcAudit

export const ErrorFlag = '__________' // 错误标志
export * from './sysApis'
export * from './sechubApis'
export * from './perfApis'
export * from './infraApis'
export * from './dmpApis'
export * from './aiApis'
export * from './mcApis'
