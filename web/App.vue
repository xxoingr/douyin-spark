<script setup>
import { computed, onMounted, onUnmounted, provide, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from './api.js';
import FriendsTab from './components/FriendsTab.vue';
import MessagesTab from './components/MessagesTab.vue';
import RunsTab from './components/RunsTab.vue';
import AccountTab from './components/AccountTab.vue';

const status = ref({ account: {}, current: null, last: null });
const finishedCount = ref(0); // 每结束一个后台任务加一，各页面据此重新加载数据
const tab = ref('friends');

let polledOnce = false;
async function poll() {
  const next = await api.status();
  const previousFinish = status.value.last?.finishedAt;
  status.value = next;
  // 页面打开后才结束的任务才提示（打开页面时看到的旧结果不提示）
  if (polledOnce && next.last && next.last.finishedAt !== previousFinish) {
    const { name, error } = next.last;
    if (error) ElMessage.error({ message: `${name}失败：${error}`, duration: 8000 });
    else ElMessage.success(`${name}完成`);
    finishedCount.value++;
  }
  polledOnce = true;
}

let timer;
onMounted(() => {
  poll().catch(() => {});
  timer = setInterval(() => poll().catch(() => {}), 2000);
});
onUnmounted(() => clearInterval(timer));

const busy = computed(() => Boolean(status.value.current));

// 启动后台任务：请求被拒绝（比如正在忙）时提示原因，返回是否启动成功
async function startTask(request) {
  try {
    await request();
    await poll();
    return true;
  } catch (err) {
    ElMessage.error(err.message);
    return false;
  }
}

async function sendNow() {
  if (await startTask(api.run)) tab.value = 'runs';
}

provide('status', status);
provide('busy', busy);
provide('finishedCount', finishedCount);
provide('startTask', startTask);
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>🔥 douyin-spark</h1>
      <div class="header-right">
        <el-tag v-if="busy" type="warning" effect="light">⏳ 正在{{ status.current.name }}…</el-tag>
        <el-tag v-if="status.account.loggedIn" type="success" effect="plain">已登录</el-tag>
        <el-tag v-else type="danger" effect="plain">未登录</el-tag>
        <el-button type="danger" :disabled="busy || !status.account.loggedIn" @click="sendNow">立即发送</el-button>
      </div>
    </header>

    <el-tabs v-model="tab">
      <el-tab-pane label="好友" name="friends"><FriendsTab /></el-tab-pane>
      <el-tab-pane label="消息" name="messages"><MessagesTab /></el-tab-pane>
      <el-tab-pane label="运行记录" name="runs"><RunsTab /></el-tab-pane>
      <el-tab-pane label="账号" name="account"><AccountTab /></el-tab-pane>
    </el-tabs>
  </div>
</template>

<style>
body {
  margin: 0;
  background: #f6f7f9;
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}
.header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.header h1 {
  margin: 0;
  font-size: 22px;
}
.header-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.hint {
  color: #909399;
  font-size: 13px;
}
</style>
