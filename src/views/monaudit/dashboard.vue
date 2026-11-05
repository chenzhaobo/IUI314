<script lang="ts" setup>
/**
 * 监控审计 · 问题看板：汇总卡片 + 按审计类型 / 项目组 / 状态分布 + 轮次趋势（按当前用户的数据范围）。
 *
 * 取数与图表配置在 ./dashboard/useDashboard、./dashboard/charts；点项目组条形跳到问题清单并带上范围。
 */
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { onMounted } from 'vue'
import VChart from 'vue-echarts'
import { useDashboard } from './dashboard/useDashboard'

// 组件名必须与路由 name（= sys_menu.path）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-dashboard' })

use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const { summary, loading, load, typeOption, groupOption, statusOption, trendOption, onGroupClick } = useDashboard()

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="p-4 dashboard">
    <a-spin :loading="loading" class="dashboard-spin">
      <div class="head-row">
        <span class="head-title">问题看板</span>
        <a-button size="small" @click="load">
          刷新
        </a-button>
      </div>

      <a-row :gutter="12">
        <a-col :span="6">
          <a-card :bordered="false">
            <a-statistic title="问题总数" :value="summary.total" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false">
            <a-statistic title="未关闭" :value="summary.open" :value-style="{ color: 'rgb(var(--warning-6))' }" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false">
            <a-statistic title="已超期" :value="summary.overdue" :value-style="{ color: 'rgb(var(--danger-6))' }" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false">
            <a-statistic title="未归类" :value="summary.unclassified" />
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="12" class="chart-row">
        <a-col :span="12">
          <a-card :bordered="false" title="按审计类型（未关闭 / 总数）">
            <VChart v-if="summary.by_type.length" class="chart" :option="typeOption" autoresize />
            <a-empty v-else />
          </a-card>
        </a-col>
        <a-col :span="12">
          <a-card :bordered="false" title="按项目组 Top 20（点击查看问题）">
            <VChart v-if="summary.by_group.length" class="chart" :option="groupOption" autoresize @click="onGroupClick" />
            <a-empty v-else />
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="12" class="chart-row">
        <a-col :span="8">
          <a-card :bordered="false" title="按状态">
            <VChart v-if="summary.by_status.length" class="chart" :option="statusOption" autoresize />
            <a-empty v-else />
          </a-card>
        </a-col>
        <a-col :span="16">
          <a-card :bordered="false" title="轮次趋势（最近 12 轮）">
            <VChart v-if="summary.trend.length" class="chart" :option="trendOption" autoresize />
            <a-empty v-else description="暂无轮次" />
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<style scoped>
.dashboard { overflow-x: hidden; }
.dashboard-spin { display: block; width: 100%; }
.head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.head-title { font-weight: 600; font-size: 16px; }
.chart-row { margin-top: 12px; }
.chart { width: 100%; height: 340px; }
</style>
