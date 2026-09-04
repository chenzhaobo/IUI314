<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 筛选栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-select v-model="productLine" placeholder="产品线">
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="星空">星空</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-input-number v-model="complianceThreshold" placeholder="达标率阈值" :min="0" :max="100" :step="5" />
        </a-col>
        <a-col :span="4">
          <a-input-number v-model="usageThreshold" placeholder="使用频次阈值" :min="0" :step="50" />
        </a-col>
        <a-col :span="8">
          <a-button type="primary" :loading="loading" @click="() => handleRecommend()">执行推荐</a-button>
        </a-col>
      </a-row>

      <!-- 推荐结果表格 -->
      <a-alert v-if="recommended && recommendList.length === 0" type="info" style="margin-bottom: 16px">
        无符合推荐条件的数据
      </a-alert>

      <a-table v-if="recommendList.length > 0" :data="recommendList" :loading="loading" :pagination="{ pageSize: 20 }" row-key="id">
        <template #columns>
          <a-table-column title="应用" data-index="app_name" :width="120" />
          <a-table-column title="表单" data-index="form_name" :width="150" />
          <a-table-column title="操作类型" data-index="operation_type" :width="100" />
          <a-table-column title="使用频次" data-index="usage_count" :width="100" />
          <a-table-column title="达标率" data-index="compliance_rate" :width="100">
            <template #cell="{ record }">
              <span style="color: #f53f3f">{{ record.compliance_rate?.toFixed(2) }}%</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.status === 'confirmed' ? 'green' : 'orange'">
                {{ record.status === 'confirmed' ? '已采纳' : '待确认' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="150">
            <template #cell="{ record }">
              <a-space v-if="record.status === 'pending'">
                <a-link @click="handleAdopt(record)">采纳</a-link>
                <a-link status="warning" @click="handleIgnore(record)">忽略</a-link>
              </a-space>
              <span v-else>-</span>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfScenario } from '@/api/perfApis'
import { usePost, usePut } from '@/hooks'

defineOptions({ name: 'scenario-recommend' })

const productLine = ref('星瀚')
const complianceThreshold = ref(95)
const usageThreshold = ref(100)
const recommended = ref(false)

// 执行推荐
const recommendPayload = computed(() => ({
  product_line: productLine.value,
  compliance_threshold: complianceThreshold.value,
  usage_threshold: usageThreshold.value,
}))
const { isFetching: loading, data: recommendData, execute: handleRecommend } = usePost<any>(ApiPerfScenario.recommend, recommendPayload, { immediate: false })
const recommendList = computed(() => {
  recommended.value = true
  return recommendData.value || []
})

// 采纳
const confirmPayload = ref<any>({})
const { execute: doConfirm } = usePut<any>(ApiPerfScenario.confirm, confirmPayload, { immediate: false })
const handleAdopt = async (record: any) => {
  confirmPayload.value = { id: record.id }
  await doConfirm()
  Message.success('已采纳')
  record.status = 'confirmed'
}

// 忽略
const editPayload = ref<any>({})
const { execute: doEdit } = usePut<any>(ApiPerfScenario.edit, editPayload, { immediate: false })
const handleIgnore = async (record: any) => {
  editPayload.value = { id: record.id, status: 'ignored' }
  await doEdit()
  Message.success('已忽略')
  record.status = 'ignored'
}
</script>
