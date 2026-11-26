/** 自动化源配置取数（service 层），失败由统一拦截器提示并返回 null。 */
import type { ListData } from '../shared/types'
import type { AutomationSourceRow, AutomationTestResult } from './types'
import { ApiMonauditAutomationSource } from '@/api/monauditApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'
import { compactQuery } from '../shared/types'

export function fetchAutomationSources(query: object): Promise<ListData<AutomationSourceRow> | null> {
  return getAction<ListData<AutomationSourceRow>>(ApiMonauditAutomationSource.getList, compactQuery(query))
}

export function createAutomationSource(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiMonauditAutomationSource.add, payload)
}

export async function updateAutomationSource(payload: Record<string, unknown>): Promise<boolean> {
  return (await putAction<unknown>(ApiMonauditAutomationSource.edit, payload)) !== null
}

export async function deleteAutomationSources(ids: string[]): Promise<boolean> {
  return (await deleteAction<unknown>(ApiMonauditAutomationSource.delete, { ids })) !== null
}

export function testAutomationSource(id: string): Promise<AutomationTestResult | null> {
  return postAction<AutomationTestResult>(ApiMonauditAutomationSource.test, { id })
}
