/**
 * 缺陷详情抽屉的取数：打开时按 id 拉详情（列表行先展示，详情回来后补齐）。
 *
 * 请求失败返回 null（拦截器已提示），抽屉继续展示列表行原有字段。
 */
import type { ReleaseDefectDetail } from '@/types/sechub-release'
import { ref } from 'vue'

import { fetchDefectDetail } from '../services/defectDraftService'

export function useDefectDetail() {
  const loading = ref(false)
  const detail = ref<ReleaseDefectDetail | null>(null)

  async function load(id: string) {
    detail.value = null
    loading.value = true
    try {
      detail.value = await fetchDefectDetail(id)
    }
    finally {
      loading.value = false
    }
  }

  function reset() {
    detail.value = null
  }

  return { loading, detail, load, reset }
}
