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
//
// ⚠️ 打开缓存前必须确认页面是**缓存安全**的：被缓存后切页签走 onDeactivated，
// onUnmounted **不再触发**。若页面在 onUnmounted 里清理 setInterval/setTimeout，
// 缓存一开定时器就永久存活，多开几个页签就有多路轮询同时跑、把渲染拖死。
// 曾因为只对齐了名字没审这一点，导致"页签加了但内容不出来"。
// 正确顺序：先把清理改到 onDeactivated、刷新挂到 onActivated，再让名字匹配。
</script>

<template>
  <a-scrollbar :style="scrollbarStyle">
    <div>
      <router-view v-slot="{ Component, route }">
        <!--
          刻意**不用** `mode="out-in"`。

          out-in 模式下 Vue 的 BaseTransition 会先返回一个空占位符、把
          `state.isLeaving` 置 true，等离场元素的 `afterLeave` 回调再渲染新页面。
          而只要有任何一个路由视图是**多根模板（fragment 根）**，它的 `vnode.el`
          就是 fragment 的文本锚点；`Transition` 的 leave 钩子对文本节点做
          `el.classList.add(...)` 会抛 TypeError → `afterLeave` 永不触发 →
          `isLeaving` 永久为 true → **之后每次导航都只渲染空占位符**。

          实际事故：`static-scan/defects`、`sechub/project-group`、
          `perf/issue/IssueList` 三个视图是 fragment 根，只要路过其中之一再离开，
          整个路由出口就永久卡死 —— 表现为"开了十几个菜单后所有页面白屏"，
          且刷新前无法恢复。数量不是原因，路过那几个页面才是。

          那三个视图已改成单根，但这是**易回归**的约束：谁新写一个多根视图
          （多加一个顶层 <a-modal>、甚至在根上留一段注释都算多根）就会再次踩中。
          去掉 out-in 后，最坏情况退化为"没有过场动画 + 一条控制台告警"，
          而不是整个应用不可用。代价是进出动画同时进行，观感上略逊。
        -->
        <transition :name="appStore.app.animation">
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
