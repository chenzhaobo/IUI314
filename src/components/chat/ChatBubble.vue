<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { useToken } from '@/hooks'
import { useUserStore } from '@/stores'

defineOptions({ name: 'ChatBubble' })

const { token } = useToken()
const userStore = useUserStore()

const visible = ref(false)
const loading = ref(false)
const inputText = ref('')
const messages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const chatBodyRef = ref<HTMLElement | null>(null)

function togglePanel() {
  visible.value = !visible.value
}

function scrollToBottom() {
  nextTick(() => {
    if (chatBodyRef.value) {
      chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
    }
  })
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  loading.value = true
  scrollToBottom()

  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const resp = await fetch(`${baseUrl}/notification/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
      body: JSON.stringify({
        message: text,
        user_id: userStore.user.uid || 'anonymous',
      }),
    })
    const json = await resp.json()
    if (json.code === 200 && json.data) {
      messages.value.push({ role: 'assistant', content: json.data.reply })
    } else {
      messages.value.push({ role: 'assistant', content: json.msg || '请求失败' })
    }
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `网络错误: ${e.message}` })
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}
// ── 停靠与拖动 ───────────────────────────────────────────────
//
// 需求：默认贴边隐藏、只露一个点，点它唤醒；整体可拖动。
//
// 几个实现选择的理由：
// - **不用 `left/top` 双轴自由拖动**，而是"贴哪一边 + 垂直位置"。浮窗自由停在
//   画面中间会挡住表格，而且窗口缩放后容易落到视口外；贴边只需夹紧一个纵坐标。
// - **拖动用 Pointer Events**（不是 mouse + touch 两套）：一套代码同时覆盖鼠标与触屏，
//   且 `setPointerCapture` 能保证指针移出元素后仍持续收到 move，不会"拖一半丢失"。
// - **靠位移阈值区分点击与拖动**：贴边时按钮很窄，按下时难免抖几像素，
//   不设阈值会把每次点击都判成拖动而打不开面板。
// - 位置存 localStorage：换页面、刷新后还在用户放的地方。

const DOCK_KEY = 'ttp-chat-bubble-dock'
const BUBBLE_SIZE = 48
/** 贴边时露出多少像素（那个"点"的可见宽度） */
const PEEK = 14
/** 超过多少像素才算拖动而不是点击 */
const DRAG_THRESHOLD = 4

const side = ref<'left' | 'right'>('right')
const offsetTop = ref(0)
/** 贴边隐藏中；点一下唤醒 */
const docked = ref(true)
const dragging = ref(false)

function clampTop(v: number) {
  const max = Math.max(8, window.innerHeight - BUBBLE_SIZE - 8)
  return Math.min(max, Math.max(8, v))
}

function loadDock() {
  offsetTop.value = clampTop(Math.round(window.innerHeight * 0.62))
  try {
    const raw = localStorage.getItem(DOCK_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { side?: string; top?: number }
    if (saved.side === 'left' || saved.side === 'right') side.value = saved.side
    if (typeof saved.top === 'number') offsetTop.value = clampTop(saved.top)
  } catch {
    // 存的内容坏了就用默认位置，不值得打扰用户
  }
}

function saveDock() {
  try {
    localStorage.setItem(DOCK_KEY, JSON.stringify({ side: side.value, top: offsetTop.value }))
  } catch {
    // 隐私模式下 localStorage 可能不可写；位置记不住不影响功能
  }
}

/** 贴边时把大部分挪出视口，只留 PEEK 那一条 */
const wrapperStyle = computed(() => {
  const hidden = docked.value && !visible.value && !dragging.value
  // 贴边时向外挪出去只留 PEEK；唤醒后往内让 12px，不贴死在屏幕边缘
  const shift = hidden ? BUBBLE_SIZE - PEEK : -12
  return {
    top: `${offsetTop.value}px`,
    [side.value]: '0px',
    transform: `translateX(${side.value === 'right' ? shift : -shift}px)`,
    // 拖动中不要过渡，否则跟手会有延迟感
    transition: dragging.value ? 'none' : 'transform 0.22s ease',
  } as Record<string, string>
})

/** 面板 520px 高；气泡离顶不足这个距离时就改成向下展开，否则面板会开到视口上方之外 */
const PANEL_HEIGHT = 520
const panelBelow = computed(() => offsetTop.value < PANEL_HEIGHT - BUBBLE_SIZE + 16)

let dragStartY = 0
let dragStartX = 0
let dragStartTop = 0
let moved = false

function onPointerDown(e: PointerEvent) {
  dragStartY = e.clientY
  dragStartX = e.clientX
  dragStartTop = offsetTop.value
  moved = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!e.currentTarget || !(e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) return
  const dy = e.clientY - dragStartY
  const dx = e.clientX - dragStartX
  if (!moved && Math.abs(dy) + Math.abs(dx) <= DRAG_THRESHOLD) return
  moved = true
  dragging.value = true
  offsetTop.value = clampTop(dragStartTop + dy)
  // 拖过视口中线就换边，比"拖到边缘才吸附"更容易操作
  side.value = e.clientX < window.innerWidth / 2 ? 'left' : 'right'
}

function onPointerUp(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  if (moved) {
    dragging.value = false
    saveDock()
    return
  }
  // 没有位移 → 当作点击：唤醒并开面板
  dragging.value = false
  docked.value = false
  togglePanel()
  saveDock()
}

function closePanel() {
  visible.value = false
  // 关闭即回到贴边隐藏，不再长期占着画面
  docked.value = true
}

function onWindowResize() {
  offsetTop.value = clampTop(offsetTop.value)
}

onMounted(() => {
  loadDock()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
})

</script>

<template>
  <div
    class="chat-bubble-wrapper"
    :class="[`side-${side}`, { docked: docked && !visible, dragging, 'panel-below': panelBelow }]"
    :style="wrapperStyle"
  >
    <!--
      气泡兼作拖动手柄：不另设手柄，因为贴边时可见区域只有十几像素，
      再切出一块专门用来拖会两个都点不准。点击与拖动靠位移阈值区分（见脚本说明）。
      touch-action:none 由 CSS 给出 —— 触屏上不加它，浏览器会把纵向拖动
      当页面滚动手势吃掉，pointermove 收不全。
    -->
    <div
      class="chat-bubble-btn"
      role="button"
      tabindex="0"
      :aria-label="visible ? '收起智能助手' : '唤醒智能助手'"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown.enter.prevent="docked = false; togglePanel()"
      @keydown.space.prevent="docked = false; togglePanel()"
    >
      <icon-robot :size="24" />
    </div>

    <!-- 对话面板 -->
    <transition name="chat-fade">
      <div v-if="visible" class="chat-panel">
        <div class="chat-header">
          <span>智能助手</span>
          <icon-close class="chat-close" @click="closePanel" />
        </div>

        <div ref="chatBodyRef" class="chat-body">
          <div v-if="messages.length === 0" class="chat-empty">
            你好！我是技术测试平台智能助手，可以帮你查询性能数据、达标率等信息。
          </div>
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="chat-msg"
            :class="msg.role"
          >
            <div class="chat-msg-content">{{ msg.content }}</div>
          </div>
          <div v-if="loading" class="chat-msg assistant">
            <div class="chat-msg-content typing">思考中...</div>
          </div>
        </div>

        <div class="chat-footer">
          <a-textarea
            v-model="inputText"
            :auto-size="{ minRows: 1, maxRows: 3 }"
            placeholder="输入消息，Enter 发送"
            @keydown="handleKeydown"
          />
          <a-button type="primary" size="small" :loading="loading" @click="sendMessage">
            发送
          </a-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.chat-bubble-wrapper {
  position: fixed;
  z-index: 1000;
  /* top / left|right / transform 由 wrapperStyle 动态给出（贴边隐藏与拖动） */
}

/* 贴边隐藏时只露一条：把靠边那侧的圆角去掉，看起来像从屏幕边缘伸出来的一个点 */
.chat-bubble-wrapper.docked .chat-bubble-btn {
  opacity: 0.55;
}

.chat-bubble-wrapper.docked:hover .chat-bubble-btn {
  opacity: 1;
}

.chat-bubble-wrapper.side-right.docked .chat-bubble-btn {
  border-radius: 50% 0 0 50%;
}

.chat-bubble-wrapper.side-left.docked .chat-bubble-btn {
  border-radius: 0 50% 50% 0;
}

.chat-bubble-wrapper.dragging .chat-bubble-btn {
  cursor: grabbing;
}

.chat-bubble-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgb(var(--primary-6));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  box-shadow: 0 4px 12px rgb(0 0 0 / 20%);
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }
}

/* 气泡离视口顶部太近时面板改为向下展开，否则 bottom:60px 会把它顶到视口外 */
.panel-below .chat-panel {
  top: 60px;
  bottom: auto;
}

/* 面板跟随停靠侧：贴左边时若仍用 right:0，面板会整块跑到视口外 */
.side-left .chat-panel {
  right: auto;
  left: 0;
}

.chat-panel {
  position: absolute;
  right: 0;
  bottom: 60px;
  width: 380px;
  height: 520px;
  background: var(--color-bg-2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgb(0 0 0 / 15%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  padding: 12px 16px;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 1px solid var(--color-border-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-close {
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-text-1);
  }
}

.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-empty {
  color: var(--color-text-3);
  font-size: 13px;
  text-align: center;
  margin-top: 40px;
}

.chat-msg {
  display: flex;

  &.user {
    justify-content: flex-end;

    .chat-msg-content {
      background: rgb(var(--primary-6));
      color: #fff;
      border-radius: 12px 12px 2px;
    }
  }

  &.assistant {
    justify-content: flex-start;

    .chat-msg-content {
      background: var(--color-fill-2);
      color: var(--color-text-1);
      border-radius: 12px 12px 2px 12px;
    }
  }
}

.chat-msg-content {
  max-width: 80%;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.typing {
  animation: blink 1.2s infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

.chat-footer {
  padding: 12px;
  border-top: 1px solid var(--color-border-2);
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-footer .arco-textarea {
  flex: 1;
}

.chat-fade-enter-active,
.chat-fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.chat-fade-enter-from,
.chat-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
