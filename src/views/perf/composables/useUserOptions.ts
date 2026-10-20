/**
 * 处理人下拉选项（系统启用用户）。
 *
 * 用 `/system/user/options` 而不是 `/system/user/list`：后者受系统管理菜单权限控制，
 * 无该权限的业务用户一打开就会弹「无权访问」。值取**昵称**（与问题列表「转交」同一口径，
 * 处理人列存的就是显示名），标签带登录账号便于区分同名。
 */
import { computed } from 'vue'
import { ApiSysUser } from '@/api/sysApis'
import { useGet } from '@/hooks'

interface UserOptionRow {
  user_name?: string
  user_nickname?: string
}

export interface UserOption {
  value: string
  label: string
}

export function toUserOptions(list: unknown): UserOption[] {
  return (Array.isArray(list) ? (list as UserOptionRow[]) : [])
    .filter(u => u.user_nickname || u.user_name)
    .map(u => ({
      value: (u.user_nickname || u.user_name) as string,
      label: u.user_nickname ? `${u.user_nickname}（${u.user_name || ''}）` : (u.user_name as string),
    }))
}

export function useUserOptions() {
  const { data } = useGet<UserOptionRow[]>(ApiSysUser.options, {}, { immediate: true })
  const userOptions = computed(() => toUserOptions(data.value))
  return { userOptions }
}
