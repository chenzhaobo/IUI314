import md5 from 'blueimp-md5'
import { defineStore } from 'pinia'
import { unref } from 'vue'

import { usePermissionStore } from './permission'
import { ApiSysLogin, ApiSysUser, ErrorFlag } from '@/api/apis'
import defaultAvatar from '@/assets/av.webp'
import { useEncrypt, useGet, usePost, usePut } from '@/hooks'
import type { FullUserInfo, KdLoginReq, LoginForm, LoginFormLocal, TokenInfo } from '@/types/base/login'

export const useUserStore = defineStore('userInfo', {
  state: () => ({
    token: {
      type: '',
      value: '',
      expires: 0,
      exp_in: 0,
    },
    localUserInfo: {
      username: '',
      password: '',
    },
    rememberMe: false,
    user: {
      name: '',
      nickname: '',
      avatar: '',
      roles: Array<string>(),
      role: '',
      depts: Array<string>(),
      dept: '',
      uid: '',
      permissions: Array<string>(),
    },
  }),
  persist: {
    pick: ['token', 'localUserInfo', 'rememberMe'],
  },
  actions: {
    /**
     * 登录
     *
     * 【调试必读 - 登录流程说明】
     * 1. 验证码：
     *    - GET /api/comm/get_captcha 返回 { captcha_on_off, uuid, img }
     *    - uuid = md5(验证码明文)，后端校验时对比 md5(code) == uuid
     *    - 当前环境 config.toml 中 captcha_on_off = false（验证码关闭），
     *      关闭时 code/uuid 字段仍需传（可为空字符串），后端跳过校验
     * 2. 密码格式：
     *    - 前端必须将用户输入的明文密码做一次 MD5 后再传输（见下方 md5(userInfo.user_password)）
     *    - 后端存储的密码 = md5(md5(明文) + 用户盐值)，即后端会再做一次 md5(收到的密码 + salt)
     *    - 因此直接用 curl/脚本调试时，user_password 应传 md5(明文密码) 的值
     * 3. 默认账号：admin，密码可为 admin123 或 1234567
     * 4. 登录请求体（POST /api/comm/login）：
     *    { "user_name": "admin", "user_password": "<md5后的密码>", "code": "<验证码明文>", "uuid": "<get_captcha返回的uuid>" }
     * 5. 登录成功响应：{ code: 200, data: { token, token_type, exp, exp_in } }
     *    后续请求需在 Header 中携带 Authorization: Bearer <token>
     */
    async login(userInfo: LoginFormLocal) {
      const { encrypt } = useEncrypt()
      this.rememberMe = userInfo.rememberMe
      if (this.rememberMe) {
        this.localUserInfo.username = encrypt(userInfo.user_name) as string
        this.localUserInfo.password = encrypt(userInfo.user_password) as string
      }
      // 注意：user_password 在此处做了 MD5 加密，后端收到的不是明文密码
      const user_data: LoginForm = {
        user_name: userInfo.user_name,
        user_password: md5(userInfo.user_password),
        code: userInfo.code,
        uuid: userInfo.uuid,
      }
      const { data, execute } = usePost<TokenInfo>(ApiSysLogin.login, user_data)
      await execute()
      const token = unref(data) as TokenInfo
      this.token = {
        value: token.token,
        expires: token.exp,
        exp_in: token.exp_in,
        type: token.token_type,
      }
      // 登录成功后重置路由加载状态，确保路由守卫重新调用 getUserInfo 和 generateRoutes
      usePermissionStore().setIsReloading(true)
      usePermissionStore().setServerError(false)
    },
    /**
     * 金蝶通行证登录（云之家扫码 / 金蝶账号密码）
     *
     * 【流程】
     * 1. 用户点击"金蝶通行证登录" → 跳转 passport 授权页（可选云之家扫码）
     * 2. 授权成功后回调 /#/login?code=xxx
     * 3. server_side_verify=true：直接把 code 交给后端，后端换 token 拉用户信息
     *    server_side_verify=false：前端先调 checklogin（带 Cookie）拿到 uid 等信息再回传
     * 4. 后端按 kd_uid 查/建本地用户（首次建号分配固定角色），签发与密码登录一致的 JWT
     */
    async kdLogin(req: KdLoginReq) {
      const { data, execute } = usePost<TokenInfo>(ApiSysLogin.kdLogin, req)
      await execute()
      const token = unref(data) as TokenInfo
      if (!token || !token.token)
        throw new Error('金蝶通行证登录失败')
      this.token = {
        value: token.token,
        expires: token.exp,
        exp_in: token.exp_in,
        type: token.token_type,
      }
      usePermissionStore().setIsReloading(true)
      usePermissionStore().setServerError(false)
    },
    // 获取用户信息
    async getUserInfo(): Promise<boolean> {
      const { data, error, execute } = useGet<FullUserInfo>(ApiSysLogin.getUserInfo, null, { refetch: false })
      try {
        await execute()
      }
      catch {
        return false
      }
      // 请求失败（网络错误/后端不可达）或返回错误标志时，直接返回 false
      if (error.value || !data.value || data.value === (ErrorFlag as unknown)) {
        return false
      }
      const user = data.value
      if (user && user.user) {
        this.user = {
          // name = 登录账号（唯一标识，扫码用户形如 kd_<金蝶uid>）
          name: user.user.user_name,
          // nickname = 展示名（扫码用户取金蝶昵称，如"陈钊波"）；缺失时回落到账号
          nickname: user.user.user_nickname || user.user.user_name,
          avatar:
            user.user.avatar === '' || user.user.avatar == null
              ? defaultAvatar
              : import.meta.env.VITE_API_BASE_URL + user.user.avatar,
          roles: user.roles,
          role: user.user.role_id,
          depts: user.depts,
          dept: user.user.dept_id,
          uid: user.user.id,
          permissions: user.permissions,
        }
        return true
      }
      return false
    },
    // 获取本地用户信息
    getLocalUserInfo() {
      const { decrypt } = useEncrypt()
      return {
        user_name: decrypt(this.localUserInfo.username) as string,
        user_password: decrypt(this.localUserInfo.password) as string,
      }
    },
    // 刷新token
    async freshToken() {
      const { data, execute } = await usePut<TokenInfo>(ApiSysUser.freshToken)
      await execute()
      const token = unref(data) as TokenInfo
      this.token = {
        value: token.token,
        expires: token.exp,
        exp_in: token.exp_in,
        type: token.token_type,
      }
    },
    // 前端退出
    async frontEndLogout() {
      this.token = {
        type: '',
        value: '',
        expires: 0,
        exp_in: 0,
      }
      // 重置为登录状态，下次进入路由刷新路由表
      usePermissionStore().setIsReloading(true)
    },
    // 登出系统
    async logOut() {
      const { execute } = usePost(ApiSysLogin.logOut)
      await execute()
      await this.frontEndLogout()
    },
  },
})
