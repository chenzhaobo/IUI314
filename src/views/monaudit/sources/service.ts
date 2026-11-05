/**
 * 同步源配置取数（service 层）。失败返回 null（拦截器已弹原因）。
 */
import type { ListData } from '../shared/types'
import type { LoginOutcome, SourceRow, SourceTestResult } from './types'
import { ApiMonauditSource } from '@/api/monauditApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'
import { compactQuery } from '../shared/types'

export function fetchSources(query: object): Promise<ListData<SourceRow> | null> {
  return getAction<ListData<SourceRow>>(ApiMonauditSource.getList, compactQuery(query))
}

export function createSource(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiMonauditSource.add, payload)
}

export async function updateSource(payload: Record<string, unknown>): Promise<boolean> {
  return (await putAction<unknown>(ApiMonauditSource.edit, payload)) !== null
}

export async function deleteSources(ids: string[]): Promise<boolean> {
  return (await deleteAction<unknown>(ApiMonauditSource.delete, { ids })) !== null
}

/** 测试 OpenAPI：登录 + 取第一页并检查字段，结果同时回写 verified_at / verify_error */
export function testOpenapi(id: string): Promise<SourceTestResult | null> {
  return postAction<SourceTestResult>(ApiMonauditSource.testOpenapi, { id })
}

/** 发起 Monitor 登录：验证码未开启 / 自动识别成功直接登录，否则返回验证码图片 */
export function startMonitorLogin(id: string): Promise<LoginOutcome | null> {
  return postAction<LoginOutcome>(ApiMonauditSource.monitorCaptcha, { id })
}

/** 用人工输入的验证码登录 */
export function submitMonitorCode(id: string, code: string): Promise<LoginOutcome | null> {
  return postAction<LoginOutcome>(ApiMonauditSource.monitorLogin, { id, code })
}
