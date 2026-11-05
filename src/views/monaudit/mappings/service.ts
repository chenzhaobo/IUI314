/**
 * 领域映射取数（service 层）。失败返回 null / false（拦截器已弹原因）。
 */
import type { ListData } from '../shared/types'
import type { MappingRow, UnmappedDomain } from './types'
import { ApiMonauditMapping } from '@/api/monauditApis'
import { deleteAction, getAction, postAction, putAction } from '@/hooks'
import { compactQuery } from '../shared/types'

export function fetchMappings(query: object): Promise<ListData<MappingRow> | null> {
  return getAction<ListData<MappingRow>>(ApiMonauditMapping.getList, compactQuery(query))
}

export function createMapping(payload: Record<string, unknown>): Promise<string | null> {
  return postAction<string>(ApiMonauditMapping.add, payload)
}

export async function updateMapping(payload: Record<string, unknown>): Promise<boolean> {
  return (await putAction<unknown>(ApiMonauditMapping.edit, payload)) !== null
}

export async function deleteMappings(ids: string[]): Promise<boolean> {
  return (await deleteAction<unknown>(ApiMonauditMapping.delete, { ids })) !== null
}

export async function fetchUnmapped(): Promise<UnmappedDomain[]> {
  const list = await getAction<UnmappedDomain[]>(ApiMonauditMapping.unmapped)
  return Array.isArray(list) ? list : []
}

/** 按当前映射重算 auto 归属的问题 */
export async function reapplyMappings(): Promise<boolean> {
  return (await postAction<unknown>(ApiMonauditMapping.reapply, {})) !== null
}
