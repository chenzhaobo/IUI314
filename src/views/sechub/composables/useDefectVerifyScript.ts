/**
 * 缺陷一键验证脚本的鉴权下载：路径走 service，文件名与后端 `script_filename` 一致。
 */
import type { ReleaseDefect } from '@/types/sechub-release'
import { ref } from 'vue'
import { useDownload } from '@/hooks'

import { verifyScriptPath } from '../services/defectDraftService'
import { verifyScriptFilename } from './defectEvidenceRules'

export function useDefectVerifyScript() {
  const scriptDownloading = ref(false)
  const { downloadWithTip } = useDownload()

  /** 下载验证脚本；并发点击只发一次，返回是否成功 */
  async function downloadVerifyScript(defect: Pick<ReleaseDefect, 'id' | 'defect_code'>): Promise<boolean> {
    if (scriptDownloading.value)
      return false
    scriptDownloading.value = true
    try {
      return await downloadWithTip(
        verifyScriptPath(defect.id),
        verifyScriptFilename(defect.defect_code),
        '下载验证脚本失败',
      )
    }
    finally {
      scriptDownloading.value = false
    }
  }

  return { scriptDownloading, downloadVerifyScript }
}
