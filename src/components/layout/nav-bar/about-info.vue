<!--
  关于：显示当前实例跑的是哪个包。

  为什么值得一个入口：排查「生产上到底是哪个版本」时，原来要 curl
  /api/comm/version 或去问运维。而这个问题在发版后很常问 ——
  MC 改了期望版本但 Pod 没重启时，期望与实际会不一致，界面上看不出来。

  `migrations_applied` 一起显示：版本号对但迁移数不对，说明启动时迁移失败了
  （生产栽过一次「144 条迁移全部成功」却少了 32 张表）。
-->
<template>
  <a-descriptions :column="1" size="medium" :label-style="{ width: '96px', color: '#86909c' }">
    <a-descriptions-item label="制品版本">
      <a-typography-text v-if="info?.version" copyable bold>{{ info.version }}</a-typography-text>
      <!-- 本地开发构建不注入版本号（那是打包脚本写进去的），显式说明而不是留空 -->
      <a-tag v-else color="gray" size="small">开发构建（未注入版本号）</a-tag>
    </a-descriptions-item>
    <a-descriptions-item label="代码提交">
      <a-typography-text v-if="info?.git_sha" copyable code>{{ info.git_sha }}</a-typography-text>
      <span v-else style="color: #c9cdd4">--</span>
    </a-descriptions-item>
    <a-descriptions-item label="构建时间">
      {{ fmt(info?.build_time) }}
    </a-descriptions-item>
    <a-descriptions-item label="实例角色">
      <a-tag :color="roleColor(info?.role)" size="small">{{ roleText(info?.role) }}</a-tag>
    </a-descriptions-item>
    <a-descriptions-item label="启动时间">
      {{ fmt(info?.started_at) }}
      <span v-if="uptime" style="margin-left: 8px; color: #86909c">已运行 {{ uptime }}</span>
    </a-descriptions-item>
    <a-descriptions-item label="已应用迁移">
      {{ info?.migrations_applied ?? '--' }}
      <span style="margin-left: 8px; color: #86909c; font-size: 12px">
        条（版本对但这个数不对，说明启动时迁移失败）
      </span>
    </a-descriptions-item>
  </a-descriptions>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { ApiSysLogin } from '@/api/sysApis'
import { formatTime, useGet } from '@/hooks'

defineOptions({ name: 'AboutInfo' })

interface VersionInfo {
  version?: string | null
  git_sha?: string | null
  build_time?: string | null
  role?: string | null
  started_at?: string | null
  migrations_applied?: number | null
}

const info = ref<VersionInfo | null>(null)
const { data, execute } = useGet<VersionInfo>(ApiSysLogin.version, undefined, { immediate: false })

const fmt = (v?: string | null) => (v ? formatTime(v) : '--')

const roleText = (r?: string | null) => {
  switch (r) {
    case 'app': return '业务实例'
    case 'mc': return '管理中心'
    case 'all': return '业务 + 管理中心'
    default: return r || '--'
  }
}
const roleColor = (r?: string | null) => (r === 'mc' ? 'purple' : r === 'all' ? 'orange' : 'arcoblue')

// 已运行时长：判断「是不是刚重启过」——发版后最常问的就是这个
const uptime = computed(() => {
  const s = info.value?.started_at
  if (!s) return ''
  const ms = Date.now() - new Date(s).getTime()
  if (ms < 0 || Number.isNaN(ms)) return ''
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d} 天 ${h} 小时`
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分`
})

onMounted(async () => {
  await execute()
  info.value = data.value ?? null
})
</script>
