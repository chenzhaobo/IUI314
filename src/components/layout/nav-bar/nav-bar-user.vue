<script lang="ts" setup>
import { h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import defaultAvatar from '@/assets/av.webp'

import { Message, Modal } from '@arco-design/web-vue'
import AboutInfo from './about-info.vue'
import ChangeCom from './changeCom.vue'
import { ErrorFlag } from '@/api/apis'
import { ApiSysDept, ApiSysRole, ApiSysUser } from '@/api/sysApis'
import { useGet, usePut } from '@/hooks'
import { router } from '@/router'
import { useUserStore } from '@/stores'
import type { dept, deptList } from '@/types/system/dept'
import type { role, roleList } from '@/types/system/role'

defineOptions({ name: 'NavBarUser' })

const { t } = useI18n({ useScope: 'global' })
const userStore = useUserStore()
const role_id = ref('')
const roleOptions = ref<role[]>([])
const dept_id = ref('')
const deptOptions = ref<dept[]>([])
const deptMapOptions = ref<Record<string, string>>({})

async function get_options() {
  const queryParams = {
    page_num: 1,
    page_size: Number.MAX_SAFE_INTEGER,
  }

  const { data: roles, execute: e_roles } = useGet<roleList>(
    ApiSysRole.getList,
    queryParams,
  )
  const { data: depts, execute: e_depts } = useGet<deptList>(
    ApiSysDept.getList,
    queryParams,
  )
  await Promise.all([e_roles(), e_depts()])
  const map: Record<string, string> = {}
  // 这里原来写 `roles.value?.list.filter(...)`：`?.` 只保护了 `.value`，
  // **没保护 `.list`** —— 请求失败时 data.value 是错误哨兵（不是 null，
  // 见 useRequest 的 updateDataOnError），`.list` 为 undefined，
  // `.filter` 直接抛 "t.value.list is undefined"，把整个导航栏 setup 打断。
  // 用户可见的现象是右上角用户菜单里角色/部门是空的。
  const roleList = Array.isArray(roles.value?.list) ? roles.value!.list : []
  const deptList = Array.isArray(depts.value?.list) ? depts.value!.list : []
  const r = roleList.filter((item) => {
    return userStore.user.roles.includes(item.role_id!)
  })
  const d = deptList.filter((item) => {
    map[item.dept_id!] = item.dept_name!
    return userStore.user.depts.includes(item.dept_id!)
  })
  roleOptions.value = r
  role_id.value = userStore.user.role
  deptOptions.value = d
  deptMapOptions.value = map
  dept_id.value = userStore.user.dept
}
async function roleChanged(v: string | number | boolean) {
  const { data, execute } = usePut(ApiSysUser.changeRole, {
    user_id: userStore.user.uid,
    role_id: v,
  })
  await execute()
  if (data.value === ErrorFlag)
    return
  Message.success(t('app.nav.changeRoleTip'))

  setTimeout(() => {
    window.location.reload()
  }, 1000)
}
async function deptChanged(v: string | number | boolean) {
  const { data, execute } = usePut(ApiSysUser.changeDept, {
    user_id: userStore.user.uid,
    dept_id: v,
  })
  await execute()
  if (data.value === ErrorFlag)
    return
  Message.success(t('app.nav.changeDeptTip'))

  setTimeout(() => {
    window.location.reload()
  }, 1000)
}

function logoutModal() {
  Modal.info({
    title: t('app.info'),
    hideCancel: false,
    titleAlign: 'start',
    content: t('app.nav.logoutTip'),
    okText: t('app.confirm'),
    cancelText: t('app.cancel'),
    draggable: true,
    onOk: logout,
  })
}

function roleChangeCom() {
  return h(ChangeCom, {
    id: role_id.value,
    keyKey: 'role_id',
    valueKey: 'role_id',
    labelKey: 'role_name',
    options: roleOptions.value,
    onOptionChange: roleChanged,
  })
}

function deptChangeCom() {
  return h(ChangeCom, {
    id: dept_id.value,
    keyKey: 'dept_id',
    valueKey: 'dept_id',
    labelKey: 'dept_name',
    options: deptOptions.value,
    mapOptions: deptMapOptions.value,
    onOptionChange: deptChanged,
  })
}

function roleChangeModal() {
  Modal.info({
    title: t('app.nav.changeRole'),
    hideCancel: false,
    titleAlign: 'start',
    content: roleChangeCom,
    footer: false,
    draggable: true,
  })
}

function deptChangeModal() {
  Modal.info({
    title: t('app.nav.changeDept'),
    hideCancel: false,
    titleAlign: 'start',
    content: deptChangeCom,
    footer: false,
    draggable: true,
  })
}

async function logout() {
  const currentRoute = router.currentRoute
  Message.success(t('app.nav.logoutSuccessTip'))
  await userStore.logOut()
  await router.push(`/login?redirect=${currentRoute.value.fullPath}`)
}

function go_to_profile() {
  router.push('/user/profile')
}

// 关于：显示当前实例跑的是哪个包。
// 用 Modal 而不是单独一个路由页 —— 这是「看一眼就走」的信息，
// 不值得占一个菜单，也不该让人为了看版本号跳出当前页面。
function aboutModal() {
  Modal.info({
    title: '关于',
    hideCancel: true,
    titleAlign: 'start',
    content: () => h(AboutInfo),
    okText: t('app.confirm'),
    draggable: true,
    width: 460,
  })
}
get_options()
</script>

<template>
  <div>
    <a-dropdown trigger="click">
      <div class="m-t-2px cursor-pointer">
        <img
          :src="userStore.user.avatar || defaultAvatar"
          class="w-32px h-32px cursor-pointer b-rd-30px"
          alt="user"
          @error="(e: Event) => (e.target as HTMLImageElement).src = defaultAvatar"
        >
      </div>
      <template #content>
        <a-doption>
          <a-popover position="lt">
            <span class="m-l--20px" @click="roleChangeModal">
              <span class="m-l-20px">
                {{ t('app.nav.changeRole') }}
              </span>
            </span>
            <template #content>
              <roleChangeCom />
            </template>
          </a-popover>
        </a-doption>
        <a-doption>
          <a-popover position="lt">
            <span class="m-l--20px" @click="deptChangeModal">
              <span class="m-l-20px">
                {{ t('app.nav.changeDept') }}
              </span>
            </span>
            <template #content>
              <deptChangeCom />
            </template>
          </a-popover>
        </a-doption>
        <a-divider />
        <a-doption>
          <span @click="go_to_profile">
            {{ t('route.userCenter') }}
          </span>
        </a-doption>
        <a-divider />
        <a-doption @click="aboutModal">
          关于
        </a-doption>
        <a-divider />
        <a-doption
          @click="logoutModal"
        >
          {{ t('app.nav.logout') }}
        </a-doption>
      </template>
    </a-dropdown>
  </div>
</template>

<style lang="scss" scoped>
.arco-divider-horizontal{
  margin: 1px 0 !important;
}
</style>
