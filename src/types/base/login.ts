/*
 * @Author: lingdu waong2005@126.com
 * @Date: 2022-10-03 09:17:21
 * @LastEditors: lingdu waong2005@126.com
 * @FilePath: \IUI314\src\types\base\login.ts
 * @Description:
 */

/**
 * @description: 验证码
 */
export interface codeData {
  captcha_on_off: boolean
  img: string
  uuid: string
}

/**
 * @description: login form data
 */
export interface LocalUser {
  user_name: string
  user_password: string
}

/**
 * @description: login form data
 */
export interface LoginForm extends LocalUser {
  code: string
  uuid: string
}

export interface LoginFormLocal extends LoginForm {
  rememberMe: boolean
}

/**
 * @description: 金蝶通行证登录配置（GET /comm/kd_config）
 */
export interface KdLoginConfig {
  enabled: boolean
  client_id: string
  auth_url: string
  checklogin_url: string
  /** 服务端配置的回调地址，空串表示由前端用当前 origin 拼接 */
  redirect_uri: string
  /** true: 后端用 code 换 token 校验，前端只需回传 code */
  server_side_verify: boolean
}

/**
 * @description: 金蝶通行证 checklogin 返回的用户信息
 */
export interface KdPassportUser {
  uid: number
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
  login: number
  login_type?: number
}

/**
 * @description: 金蝶通行证登录请求体（POST /comm/kd_login）
 */
export interface KdLoginReq {
  code?: string
  redirect_uri?: string
  uid?: number
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
}

/**
 * token info
 */
export interface TokenInfo {
  exp_in: number
  exp: number
  token: string
  token_type: string
}

// 完整用户信息
export interface FullUserInfo {
  user: User
  roles: string[]
  depts: string[]
  permissions: string[]
}

export interface User {
  id: string
  user_name: string
  user_nickname: string
  user_status: string
  user_email: string
  sex: string
  avatar: string
  dept_id: string
  remark: string
  is_admin: string
  phone_num: string
  role_id: string
  created_at: Date
  /** IANA 时区名，用于前端渲染 local time；后端默认 Asia/Shanghai */
  timezone?: string
  dept: Dept
}

export interface Dept {
  dept_id: string
  parent_id: string
  dept_name: string
  order_num: number
  leader: string
  phone: string
  email: string
  status: string
}
