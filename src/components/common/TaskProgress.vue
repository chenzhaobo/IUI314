<script lang="ts" setup>
import { ref, watch, computed, onUnmounted } from 'vue'
import { useToken } from '@/hooks'

const props = withDefaults(defineProps<{
  taskId: string
  interval?: number
}>(), {
  interval: 500,
})
const emit = defineEmits<{
  complete: [result: any]
  fail: [error: string]
}>()

const baseUrl = import.meta.env.VITE_API_BASE_URL
const progress = ref<any>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const percent = computed(() => {
  if (!progress.value || !progress.value.total) return 0
  return Math.round((progress.value.done / progress.value.total) * 100)
})
const progressStatus = computed(() => {
  if (!progress.value) return 'normal'
  if (progress.value.status === 'failed') return 'danger'
  if (progress.value.status === 'completed') return 'success'
  return 'normal'
})
const isRunning = computed(() => progress.value?.status === 'running')

async function fetchProgress() {
  try {
    const { token } = useToken()
    const resp = await fetch(
      `${baseUrl}/perf/task/progress?task_id=${encodeURIComponent(props.taskId)}`,
      { headers: { Authorization: token } },
    )
    const json = await resp.json()
    if (json.code === 200 && json.data) {
      progress.value = json.data
      if (json.data.status === 'completed') {
        stopPolling()
        emit('complete', json.data.result)
      } else if (json.data.status === 'failed') {
        stopPolling()
        emit('fail', json.data.message || '任务失败')
      }
    } else {
      // 任务不存在或已过期
      stopPolling()
      emit('fail', json.msg || '任务不存在或已过期')
    }
  } catch {
    // 网络错误，不中断轮询
  }
}

function startPolling() {
  stopPolling()
  fetchProgress()
  pollTimer = setInterval(fetchProgress, props.interval)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

watch(
  () => props.taskId,
  (val) => {
    if (val) {
      progress.value = null
      startPolling()
    } else {
      stopPolling()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="task-progress">
    <a-progress
      :percent="percent"
      :status="progressStatus"
      :show-text="true"
      :animation="isRunning"
    />
    <div class="task-progress-info">
      <span v-if="progress" class="task-progress-msg">
        {{ progress.message }}
        <span class="task-progress-count">
          ({{ progress.done }}/{{ progress.total }}
          <template v-if="progress.skipped > 0">, 跳过{{ progress.skipped }}</template>)
        </span>
      </span>
      <span v-else class="task-progress-msg">等待任务启动...</span>
    </div>
  </div>
</template>

<style scoped>
.task-progress {
  width: 100%;
}
.task-progress-info {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-2);
}
.task-progress-msg {
  word-break: break-all;
}
.task-progress-count {
  color: var(--color-text-3);
  margin-left: 4px;
}
</style>
