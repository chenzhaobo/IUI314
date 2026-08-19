<script lang="ts" setup>
import type { FieldRule, FormInstance } from '@arco-design/web-vue'
import type { MessageSchema } from '@/i18n'

import type { codeData, KdLoginConfig, KdPassportUser, LoginFormLocal } from '@/types/base/login'
import { Message } from '@arco-design/web-vue'
import { IconLock, IconQrcode, IconUser } from '@arco-design/web-vue/es/icon'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ApiSysLogin } from '@/api/sysApis'
import logo from '@/assets/logo.svg'
import { useFormUtil, useGet, useTheme } from '@/hooks'
import { useUserStore } from '@/stores'

defineOptions({ name: 'LoginRight' })

const userStore = useUserStore()
const router = useRouter()
const { formValidate, formReset } = useFormUtil()

const loginFormRef = ref<FormInstance>()

const loginForm = ref<LoginFormLocal>({
  user_name: '',
  user_password: '',
  rememberMe: false,
  code: '',
  uuid: '',
})

const isDark = useTheme().get_is_dark()
const { t } = useI18n<{ message: MessageSchema }>({ useScope: 'global' })

// 验证码获取
// 接口返回 { captcha_on_off: boolean, uuid: string, img: string(base64图片) }
// uuid = md5(验证码明文)，登录时将用户输入的 code(明文) + uuid 一并提交，后端校验 md5(code)==uuid
// 当前环境验证码已关闭(captcha_on_off=false)，关闭时 code/uuid 传空字符串即可
const { data: captchaData, execute: getCaptcha } = useGet<codeData>(ApiSysLogin.getCaptcha, null, { immediate: true })

// 验证码开关（由后端配置 config.toml [system] captcha_on_off 决定）
const captchaOnOff = computed(() => captchaData.value?.captcha_on_off ?? true)

//  验证规则
const loginRules = ref<{ [key: string]: FieldRule[] }>({
  user_name: [
    { required: true, message: t('sys.loginUserNameValidateTipA') },
    { minLength: 4, maxLength: 20, message: t('sys.loginUserNameValidateTipB') },
  ],
  user_password: [
    { required: true, message: t('sys.loginUserPasswordValidateTipA') },
  ],
  code: [
    { required: true, message: t('sys.loginCodeValidateTipA') },
    { minLength: 1, maxLength: 10, message: t('sys.loginCodeValidateTipB') },
  ],
})

loginForm.value.rememberMe = userStore.rememberMe

// 提交登录
async function submitLogin(formRef: FormInstance | undefined) {
  if (!(await formValidate(formRef)))
    return
  if (captchaOnOff.value)
    loginForm.value.uuid = captchaData.value!.uuid
  await userStore.login(loginForm.value)
  const redirect = router.currentRoute.value.query.redirect
    ? (router.currentRoute.value.query.redirect as string)
    : '/index'
  await router.push({ path: redirect })
}
// 获取本地用户信息
function getLocalUserInfo() {
  if (loginForm.value.rememberMe) {
    const { user_name, user_password } = userStore.getLocalUserInfo()
    loginForm.value.user_name = user_name
    loginForm.value.user_password = user_password
  }
}

getLocalUserInfo()

// ── 金蝶通行证登录（云之家扫码 / 金蝶账号密码） ──────────────────────────
// 流程：点击按钮 → 跳转 passport 授权页(可选云之家扫码) → 回调 /#/login?code=xxx
//      → server_side_verify=true 时把 code 交后端换 token；否则前端先调 checklogin 拿 uid 再回传
//      → 后端按 kd_uid 查/建本地用户（首次建号分配固定角色）并签发 JWT

const kdConfigData = ref<KdLoginConfig>()
const kdEnabled = computed(() => kdConfigData.value?.enabled === true)
const kdLoading = ref(false)
// state 中随机串的暂存键（同标签页内有效，用于回调时校验）
const KD_STATE_KEY = 'kd_login_state'

// base64url 编码（无 padding），与后端 URL_SAFE_NO_PAD 对应
function base64UrlEncode(s: string) {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// 校验回调带回的 state 与发起时暂存的 nonce 是否一致
function verifyKdState(state: string | undefined): boolean {
  const saved = sessionStorage.getItem(KD_STATE_KEY)
  sessionStorage.removeItem(KD_STATE_KEY)
  if (!state || !saved)
    return false
  try {
    const json = atob(state.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json).n === saved
  }
  catch {
    return false
  }
}

// 用原生 fetch 读取配置：后端未升级（404）时静默隐藏入口，不弹全局错误提示
async function getKdConfig() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${ApiSysLogin.kdConfig}`)
    if (!res.ok)
      return
    const body = await res.json()
    if (body?.code === 200)
      kdConfigData.value = body.data as KdLoginConfig
  }
  catch {
    // 忽略：视为未启用金蝶登录
  }
}

// 回调地址：后端未配置时用当前站点 origin（hash 路由，code 会落在 hash 的 query 上）
function kdRedirectUri() {
  return kdConfigData.value?.redirect_uri || `${window.location.origin}/#/login`
}

// 跳转金蝶通行证授权页
function loginWithKingdee() {
  const cfg = kdConfigData.value
  if (!cfg || !cfg.enabled) {
    Message.error('金蝶通行证登录未启用')
    return
  }
  // state 携带当前站点 origin + 随机 nonce：
  // origin 让后端回调中转知道该跳回哪个端口（3000 打开就回 3000，9876 打开就回 9876）
  // nonce 存 sessionStorage，回调时比对，防止 CSRF（别人拿自己的授权码把你登进他的账号）
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36)
  sessionStorage.setItem(KD_STATE_KEY, nonce)
  const state = base64UrlEncode(JSON.stringify({ o: window.location.origin, n: nonce }))
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    response_type: 'code',
    redirect_uri: kdRedirectUri(),
    display: 'web',
    scope: 'basic',
    force_login: '0',
    state,
  })
  window.location.href = `${cfg.auth_url}?${params.toString()}`
}

// 处理授权回调
async function handleKdCallback(code: string) {
  const cfg = kdConfigData.value
  if (!cfg)
    return
  kdLoading.value = true
  try {
    if (cfg.server_side_verify) {
      // 后端用 code 换 access_token 并拉取用户信息（前端无法伪造身份）
      await userStore.kdLogin({ code, redirect_uri: kdRedirectUri() })
    }
    else {
      // 零密钥方案：浏览器携带 passport Cookie 调 checklogin 拿到用户信息后回传
      const res = await fetch(`${cfg.checklogin_url}?client_id=${cfg.client_id}`, {
        credentials: 'include',
      })
      const body = await res.json()
      const kdUser = body?.data as KdPassportUser | undefined
      if (body?.code !== 0 || !kdUser || kdUser.login !== 1)
        throw new Error('未获取到金蝶通行证登录态')
      await userStore.kdLogin({
        uid: kdUser.uid,
        nickname: kdUser.nickname,
        email: kdUser.email,
        phone: kdUser.phone,
        avatar: kdUser.avatar,
      })
    }
    const redirect = (router.currentRoute.value.query.redirect as string) || '/index'
    // 清掉 URL 上的 code，避免刷新重复登录
    await router.replace({ path: '/login', query: {} })
    await router.push({ path: redirect })
  }
  catch (err) {
    Message.error(`金蝶通行证登录失败：${(err as Error).message || '请重试'}`)
    await router.replace({ path: '/login', query: {} })
  }
  finally {
    kdLoading.value = false
  }
}

onMounted(async () => {
  await getKdConfig()
  if (!kdEnabled.value)
    return
  // hash 路由下 code 落在路由 query，兼容读取普通 search 参数
  const queryCode = router.currentRoute.value.query.code as string | undefined
  const code = queryCode || new URLSearchParams(window.location.search).get('code') || ''
  // 后端回调中转在缺少 code 时会带 kd_error 回来，避免静默失败
  const kdError = router.currentRoute.value.query.kd_error as string | undefined
  if (kdError) {
    Message.error(`金蝶通行证登录失败：${kdError === 'missing_code' ? '未收到授权码，请重试' : kdError}`)
    await router.replace({ path: '/login', query: {} })
    return
  }
  if (code) {
    // 校验 state，防止他人构造回调链接把你登进别人的账号
    const state = router.currentRoute.value.query.state as string | undefined
    if (!verifyKdState(state)) {
      Message.error('金蝶通行证登录失败：登录状态校验不通过，请重新点击扫码登录')
      await router.replace({ path: '/login', query: {} })
      return
    }
    await handleKdCallback(code)
  }
})
</script>

<template>
  <div class="w-100% flex justify-center items-center m-t-30px">
    <div
      class="login-son-container min-h-450px w-400px flex justify-center b-rd-20px p-b-20px"
    >
      <a-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        label-align="left"
        hide-label="true"
        class="p-l-20px p-r-20px"
      >
        <div class="flex items-center justify-center m-t-20px">
          <div
            class="logo_circle flex items-center justify-center w-72px h-72px"
          >
            <img :src="logo" alt="logo" class="w-48px h-48px">
          </div>
        </div>
        <h2 class="m-t-10px m-b-10px text-center">
          π {{ t("app.APP") }}
        </h2>
        <a-form-item
          field="user_name"
          validate-trigger="blur"
          hide-label
        >
          <a-input
            v-model="loginForm.user_name"
            :placeholder="t('sys.userName')"
            size="large"
            type="text"
          >
            <template #prefix>
              <IconUser />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          field="user_password"
          validate-trigger="blur"
          hide-label
        >
          <a-input
            v-model="loginForm.user_password"
            size="large"
            :placeholder="t('sys.passWord')"
            type="password"
          >
            <template #prefix>
              <IconLock />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          v-if="captchaOnOff"
          v-model="loginForm.code"
          field="code"
          validate-trigger="blur"

          hide-label
        >
          <a-input
            v-model="loginForm.code"
            :placeholder="t('sys.validateCode')"
            size="large"
            type="text"
            @keyup.enter="submitLogin(loginFormRef)"
          >
            <template #prefix>
              <IconUnlock />
            </template>
          </a-input>
          <img
            :class="
              isDark ? 'filter-invert-90' : 'filter-invert-0'
            "
            :src="captchaData?.img"
            alt="code"
            class="h-40px w-130px b-rd-6px m-l-5px"
            @click="() => getCaptcha()"
          >
        </a-form-item>
        <a-checkbox v-model="loginForm.rememberMe" class="w-350px">
          {{ t('sys.rememberMe') }}
        </a-checkbox>
        <div class="flex justify-around m-t-30px">
          <a-button type="primary" @click="submitLogin(loginFormRef)">
            {{ t('sys.login') }}
          </a-button>
          <a-button type="secondary" @click="formReset(loginFormRef)">
            {{ t('sys.reset') }}
          </a-button>
        </div>
        <template v-if="kdEnabled">
          <a-divider class="m-t-20px m-b-10px" orientation="center">
            <span class="text-12px color-gray">或</span>
          </a-divider>
          <a-button
            type="outline"
            long
            :loading="kdLoading"
            @click="loginWithKingdee"
          >
            <template #icon>
              <IconQrcode />
            </template>
            金蝶通行证 / 云之家扫码登录
          </a-button>
        </template>
      </a-form>
    </div>
  </div>
</template>
