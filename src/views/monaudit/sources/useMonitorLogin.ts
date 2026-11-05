/**
 * Monitor 登录：先让后端自动识别验证码；识别不了返回图片，弹窗人工输入，直到登录成功或用户放弃。
 */
import type { LoginOutcome, SourceRow } from './types'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { startMonitorLogin, submitMonitorCode } from './service'

export function useMonitorLogin(onLoggedIn: () => void) {
  const loggingId = ref('')
  const captchaVisible = ref(false)
  const captchaImage = ref('')
  const captchaReason = ref('')
  const captchaCode = ref('')
  const captchaLoading = ref(false)
  const current = ref<SourceRow | null>(null)

  /** 处理一次登录结果；返回 true = 已登录 */
  function handle(outcome: LoginOutcome | null): boolean {
    if (!outcome)
      return false
    if (outcome.state === 'logged_in') {
      Message.success(outcome.detail || 'Monitor 登录成功')
      captchaVisible.value = false
      onLoggedIn()
      return true
    }
    captchaImage.value = outcome.image
    captchaReason.value = outcome.reason
    captchaCode.value = ''
    captchaVisible.value = true
    return false
  }

  async function login(row: SourceRow) {
    current.value = row
    loggingId.value = row.id
    try {
      handle(await startMonitorLogin(row.id))
    }
    finally {
      loggingId.value = ''
    }
  }

  /** 换一张：重新发起登录（后端会再尝试一次自动识别） */
  async function refreshCaptcha() {
    if (!current.value)
      return
    captchaLoading.value = true
    try {
      handle(await startMonitorLogin(current.value.id))
    }
    finally {
      captchaLoading.value = false
    }
  }

  /** 弹窗确定：返回 false 阻止关闭（验证码错误时后端会给新图片） */
  async function submitCode(): Promise<boolean> {
    if (!current.value)
      return true
    if (!captchaCode.value.trim()) {
      Message.warning('请输入验证码')
      return false
    }
    captchaLoading.value = true
    try {
      return handle(await submitMonitorCode(current.value.id, captchaCode.value.trim()))
    }
    finally {
      captchaLoading.value = false
    }
  }

  return {
    loggingId,
    captchaVisible,
    captchaImage,
    captchaReason,
    captchaCode,
    captchaLoading,
    login,
    refreshCaptcha,
    submitCode,
  }
}
