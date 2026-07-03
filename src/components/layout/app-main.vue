<script lang="ts" setup>
import { computed } from 'vue'

import { useRoute } from 'vue-router'
import { useAppStore, useTabBarStore } from '@/stores'

defineOptions({ name: 'AppMain' })

const tabBarStore = useTabBarStore()
const appStore = useAppStore()

tabBarStore.setCurrentRoute(useRoute())

const appMainHeight = computed(() => {
  let v = 'calc(var(--vh) * 100'
  if (appStore.app.navBar)
    v += ' - var(--header-bar-height)'
  if (appStore.app.tabBar)
    v += ' - var(--header-bar-height)'
  v += ')'
  return v
})

const scrollbarStyle = computed(() => `height: ${appMainHeight.value};overflow:auto;`)

const cacheList = computed(() => tabBarStore.getCacheList)
// NOTE: cacheList 存的是路由 name（= sys_menu.path），keep-alive :include 按组件 defineOptions({ name }) 匹配
// 新建视图时务必确保两者一致，否则缓存失效 → 10+ 页签灰屏。系统视图用 systemMenus.xxx.path
</script>

<template>
  <a-scrollbar :style="scrollbarStyle">
    <div>
      <router-view v-slot="{ Component, route }">
        <transition :name="appStore.app.animation" mode="out-in">
          <keep-alive :include="cacheList" :max="20">
            <component :is="Component" :key="route.fullPath" class="app-main-content p-l-15px p-r-15px p-t-10px p-b-10px" />
          </keep-alive>
        </transition>
      </router-view>
    </div>
  </a-scrollbar>
</template>

<style scoped lang="scss">
.app-main-content {
  background-color: var(--header-bar-bg-color);
  border-radius: 4px;
  min-height: 100%;
}
</style>
