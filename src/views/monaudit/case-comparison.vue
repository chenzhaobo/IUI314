<script setup lang="ts">
/** 独立「用例耗时横比」页：选择轮次后复用采集与横比面板。 */
import ListPage from '@/components/common/ListPage.vue'
import CaseComparisonPanel from './rounds/components/CaseComparisonPanel.vue'
import { useCaseWorkspace } from './rounds/useCaseWorkspace'

// 与 sys_menu.path 一致，供 keep-alive 识别
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-cases' })

const { selectedRoundId, detail, roundOptions, listLoading, detailLoading, loadDetail, reload } = useCaseWorkspace()
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <div class="case-filter">
          <a-select
            v-model="selectedRoundId"
            :options="roundOptions"
            :loading="listLoading"
            placeholder="选择当前批次（本轮）"
            allow-search
            class="round-select"
            @change="loadDetail()"
          />
          <a-button size="small" :loading="listLoading || detailLoading" @click="reload">
            刷新
          </a-button>
        </div>
      </template>

      <a-spin :loading="detailLoading" class="case-workspace">
        <CaseComparisonPanel v-if="detail" :round="detail.round" @refresh="reload" />
        <a-empty v-else description="请先选择轮次；无数据时请先创建自动化轮次" />
      </a-spin>
    </ListPage>
  </div>
</template>

<style scoped>
.case-filter { display: flex; align-items: center; gap: 8px; }
.round-select { width: 460px; }
.case-workspace { display: block; width: 100%; }
</style>
