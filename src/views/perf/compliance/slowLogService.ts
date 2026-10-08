/**
 * 「查看慢日志」取数（View → Composable → Service → Api 的 service 层）。
 *
 * 下载接口要带鉴权头，不能 window.open，这里只负责拼出相对 API 路径，
 * 由 composable 交给 useDownload 发起。
 */
import type { SlowLogFile, SlowLogList, SlowLogQuery } from '@/types/perf-slow-logs'
import { ApiPerfCompliance } from '@/api/perfApis'
import { getAction } from '@/hooks'

/** 表单在周期内已下载的慢日志清单；失败返回 null（拦截器已提示） */
export function fetchSlowLogs(query: SlowLogQuery): Promise<SlowLogList | null> {
  return getAction<SlowLogList>(ApiPerfCompliance.slowLogs, query)
}

/** 单个日志文件的下载路径（任务 id + 相对路径，服务端校验越界） */
export function slowLogFilePath(file: SlowLogFile): string {
  return `${ApiPerfCompliance.slowLogDownload}?${new URLSearchParams({ task_id: file.task_id, path: file.path }).toString()}`
}

/** 打包下载路径：空筛选项不下发 */
export function slowLogZipPath(query: SlowLogQuery): string {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value)
      params[key] = value
  }
  return `${ApiPerfCompliance.slowLogZip}?${new URLSearchParams(params).toString()}`
}
