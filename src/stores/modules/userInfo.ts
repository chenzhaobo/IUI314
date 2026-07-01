import md5 from 'blueimp-md5'
import { defineStore } from 'pinia'
import { unref } from 'vue'

import { usePermissionStore } from './permission'
import { ApiSysLogin, ApiSysUser, ErrorFlag } from '@/api/apis'
import defaultAvatar from '@/assets/av.webp'
import { useEncrypt, useGet, usePost, usePut } from '@/hooks'
import type { FullUserInfo, LoginForm, LoginFormLocal, TokenInfo } from '@/types/base/login'

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
    paths: ['token', 'localUserInfo', 'rememberMe'],
  },
  actions: {
    // 登录
    async login(userInfo: LoginFormLocal) {
      const { encrypt } = useEncrypt()
      this.rememberMe = userInfo.rememberMe
      if (this.rememberMe) {
        this.localUserInfo.username = encrypt(userInfo.user_name) as string
        this.localUserInfo.password = encrypt(userInfo.user_password) as string
      }
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
          name: user.user.user_name,
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
