<script setup lang="ts">
/**
 * 转缺陷确认框：说明会发生什么 + 必填「计划完成时间」。
 *
 * 缺陷要有治理计划：转出去的单子必须写明计划何时修完，与静态扫描「计划处理完成时间」
 * 同一口径（业务日、精确到天）。原来用 Modal.confirm 放不下表单项，单条与批量共用本组件。
 */
import { computed, ref, watch } from 'vue'
import { addDays, businessToday, monthEnd } from '@/utils/planDate'

const props = defineProps<{
  title: string
  /** 说明行（会发生什么、跳过哪些） */
  lines: string[]
  okText: string
  /** 确认回调；返回 true 表示提交成功、关闭弹窗 */
  submit: (planDate: string) => Promise<boolean>
}>()
const visible = defineModel<boolean>('visible', { required: true })

const planDate = ref('')
const today = ref(businessToday())

watch(visible, (open) => {
  if (!open)
    return
  today.value = businessToday()
  planDate.value = ''
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
  return props.submit(planDate.value)
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="title"
    :ok-text="okText"
    :ok-button-props="{ disabled: !planDate }"
    :on-before-ok="handleBeforeOk"
    :width="520"
  >
    <div class="create-issue-lines">
      <p v-for="line in lines" :key="line">
        {{ line }}
      </p>
    </div>
    <a-form layout="vertical" :model="{ planDate }">
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
