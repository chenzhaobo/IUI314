<script lang="ts" setup>
/**
 * 治理仪表盘 — 统计卡片 + 当前用户角色
 */
import { computed } from 'vue'
import { useGet } from '@/hooks'
import { ApiSecGovernance } from '@/api/sechubApis'

defineOptions({ name: 'StaticScanGovernanceDashboard' })

const { data: stats, isFetching: loadingStats } = useGet<any>(ApiSecGovernance.stats, {}, { immediate: true })
const { data: me, isFetching: loadingMe } = useGet<any>(ApiSecGovernance.me, {}, { immediate: true })

const statCards = computed(() => {
  const s = stats.value || {}
  return [
    { title: '计划总数', value: s.campaigns_total ?? 0, color: '#165DFF' },
    { title: '执行中', value: s.campaigns_executing ?? 0, color: '#FF7D00' },
    { title: '阻塞', value: s.campaigns_blocked ?? 0, color: '#F53F3F' },
    { title: '已通过', value: s.campaigns_passed ?? 0, color: '#00B42A' },
    { title: '开放处置', value: s.dispositions_open ?? 0, color: '#722ED1' },
    { title: '必修项', value: s.dispositions_must_fix ?? 0, color: '#EB2F96' },
    { title: '待审批', value: s.approvals_pending ?? 0, color: '#FAAD14' },
    { title: '活跃白名单', value: s.waivers_active ?? 0, color: '#13C2C2' },
  ]
})

const roleLabels: Record<string, string> = {
  developer: '开发',
  tester: '测试',
  project_group_architect: '项目组架构师',
  domain_architect: '领域架构师',
  director: '总监',
}

const myRoles = computed(() => {
  const roles: string[] = me.value?.roles || []
  return roles.map(r => roleLabels[r] || r)
})

const capabilities = computed(() => me.value || {})
</script>

<template>
  <div class="p-4">
    <a-card title="治理仪表盘" :loading="loadingStats">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <a-card v-for="card in statCards" :key="card.title" :bordered="true" class="text-center" :data-testid="`stat-${card.title}`">
          <a-statistic :title="card.title" :value="card.value" :value-style="{ color: card.color }" />
        </a-card>
      </div>
    </a-card>

    <!-- 当前用户角色 -->
    <a-card title="我的角色与权限" class="mt-4" :loading="loadingMe">
      <div class="flex flex-wrap gap-4">
        <div>
          <span class="mr-2 font-bold">角色:</span>
          <a-tag v-for="role in myRoles" :key="role" color="arcoblue" data-testid="my-role">
            {{ role }}
          </a-tag>
          <span v-if="myRoles.length === 0" class="text-gray-400">未分配角色</span>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-4">
        <a-tag :color="capabilities.can_create_campaign ? 'green' : 'gray'" data-testid="cap-campaign">
          {{ capabilities.can_create_campaign ? '✓' : '✗' }} 创建计划
        </a-tag>
        <a-tag :color="capabilities.can_disposition ? 'green' : 'gray'" data-testid="cap-disposition">
          {{ capabilities.can_disposition ? '✓' : '✗' }} 问题处置
        </a-tag>
        <a-tag :color="capabilities.can_approve_domain ? 'green' : 'gray'" data-testid="cap-domain">
          {{ capabilities.can_approve_domain ? '✓' : '✗' }} 领域审批
        </a-tag>
        <a-tag :color="capabilities.can_approve_director ? 'green' : 'gray'" data-testid="cap-director">
          {{ capabilities.can_approve_director ? '✓' : '✗' }} 总监审批
        </a-tag>
        <a-tag :color="capabilities.can_manage_waiver ? 'green' : 'gray'" data-testid="cap-waiver">
          {{ capabilities.can_manage_waiver ? '✓' : '✗' }} 白名单管理
        </a-tag>
      </div>
    </a-card>
  </div>
</template>
