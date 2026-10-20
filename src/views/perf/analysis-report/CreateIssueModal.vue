<script setup lang="ts">
/**
 * 转缺陷确认框：说明会发生什么 + 必填「计划完成时间」+ 指定项目组与处理人。
 *
 * 缺陷要有治理计划：转出去的单子必须写明计划何时修完，与静态扫描「计划处理完成时间」
 * 同一口径（业务日、精确到天）。原来用 Modal.confirm 放不下表单项，单条与批量共用本组件。
 *
 * 项目组默认带出台账当前的项目组（批量且各条不同时留空 = 各自沿用）；
 * 处理人默认带出传入的值，没有就是当前登录人 —— 指定了处理人，问题单建好即「已认领」，
 * 不必再去问题列表转交一次。
 */
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/stores'
import { addDays, businessToday, monthEnd } from '@/utils/planDate'
import { useUserOptions } from '@/views/perf/composables/useUserOptions'

export interface CreateIssueChoice {
  planDate: string
  /** 空 = 沿用台账的项目组 */
  projectGroupCode: string
  /** 空 = 不指定（问题单待认领） */
  processOwner: string
}

interface GroupOption {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  title: string
  /** 说明行（会发生什么、跳过哪些） */
  lines: string[]
  okText: string
  /** 项目组下拉（台账页已从基础数据加载） */
  groupOptions?: GroupOption[]
  /** 默认项目组；空 = 各自沿用台账项目组 */
  defaultGroup?: string
  /** 默认处理人；空则取当前登录人 */
  defaultOwner?: string
  /** 确认回调；返回 true 表示提交成功、关闭弹窗 */
  submit: (choice: CreateIssueChoice) => Promise<boolean>
}>(), {
  groupOptions: () => [],
  defaultGroup: '',
  defaultOwner: '',
})
const visible = defineModel<boolean>('visible', { required: true })

const userStore = useUserStore()
const { userOptions } = useUserOptions()

const planDate = ref('')
const projectGroupCode = ref('')
const processOwner = ref('')
const today = ref(businessToday())

watch(visible, (open) => {
  if (!open)
    return
  today.value = businessToday()
  planDate.value = ''
  projectGroupCode.value = props.defaultGroup
  processOwner.value = props.defaultOwner || userStore.user?.nickname || userStore.user?.name || ''
})

const shortcuts = computed(() => [
  { label: '1 周后', value: addDays(today.value, 7) },
  { label: '2 周后', value: addDays(today.value, 14) },
  { label: '1 个月后', value: addDays(today.value, 30) },
  { label: '本月底', value: monthEnd(today.value) },
])

function isDisabledDate(current?: Date): boolean {
  if (!current)
    return false
  const y = current.getFullYear()
  const m = String(current.getMonth() + 1).padStart(2, '0')
  const d = String(current.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}` < today.value
}

async function handleBeforeOk(): Promise<boolean> {
  if (!planDate.value)
    return false
  return props.submit({
    planDate: planDate.value,
    projectGroupCode: projectGroupCode.value.trim(),
    processOwner: processOwner.value.trim(),
  })
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="title"
    :ok-text="okText"
    :ok-button-props="{ disabled: !planDate }"
    :on-before-ok="handleBeforeOk"
    :width="560"
  >
    <div class="create-issue-lines">
      <p v-for="line in lines" :key="line">
        {{ line }}
      </p>
    </div>
    <a-form layout="vertical" :model="{ planDate }">
      <a-form-item label="项目组">
        <a-select v-model="projectGroupCode" placeholder="各自沿用台账的项目组" allow-clear allow-search>
          <a-option v-for="g in groupOptions" :key="g.value" :value="g.value">
            {{ g.label }}
          </a-option>
        </a-select>
        <template #extra>
          改了项目组，台账的归属会一并改掉（流转记录里留痕）。
        </template>
      </a-form-item>
      <a-form-item label="处理人">
        <a-select v-model="processOwner" placeholder="不指定（问题单待认领）" allow-clear allow-search allow-create>
          <a-option v-for="u in userOptions" :key="u.value" :value="u.value">
            {{ u.label }}
          </a-option>
        </a-select>
        <template #extra>
          指定后问题单建好即「已认领」，不必再去问题列表转交。
        </template>
      </a-form-item>
      <a-form-item label="计划完成时间" required>
        <a-date-picker v-model="planDate" value-format="YYYY-MM-DD" style="width: 100%" placeholder="选择计划修完的日期（精确到日）" :disabled-date="isDisabledDate" />
        <template #extra>
          <a-space :size="4" wrap>
            <span>快捷：</span>
            <a-link v-for="s in shortcuts" :key="s.label" @click="planDate = s.value">
              {{ s.label }}
            </a-link>
          </a-space>
          <div>写入问题单的「计划完成」，问题列表据此提示剩余 / 超期天数。批量转时所有问题用同一个日期。</div>
        </template>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.create-issue-lines { margin-bottom: 12px; color: var(--color-text-2); line-height: 1.7; }
.create-issue-lines p { margin: 0; }
</style>
