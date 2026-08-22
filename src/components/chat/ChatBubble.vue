<script lang="ts" setup>
import { nextTick, ref } from 'vue'

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
</script>

<template>
  <div class="chat-bubble-wrapper">
    <!-- 悬浮气泡按钮 -->
    <div class="chat-bubble-btn" @click="togglePanel">
      <icon-robot :size="24" />
    </div>

    <!-- 对话面板 -->
    <transition name="chat-fade">
      <div v-if="visible" class="chat-panel">
        <div class="chat-header">
          <span>智能助手</span>
          <icon-close class="chat-close" @click="visible = false" />
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
  right: 24px;
  bottom: 24px;
  z-index: 1000;
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
  cursor: pointer;
  box-shadow: 0 4px 12px rgb(0 0 0 / 20%);
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }
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
