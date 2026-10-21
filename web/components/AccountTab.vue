<script setup>
import { computed, inject } from 'vue';
import { ElMessageBox } from 'element-plus';
import { api } from '../api.js';

const status = inject('status');
const busy = inject('busy');
const startTask = inject('startTask');

const account = computed(() => status.value.account);
const expires = computed(() =>
  account.value.expiresAt ? new Date(account.value.expiresAt).toLocaleDateString('zh-CN') : '',
);

// 已登录时一般用不到，只在发送提示“登录失效”或想换账号时才需要
async function relogin() {
  try {
    await ElMessageBox.confirm('当前已经登录。重新扫码会替换现在的登录状态，一般只在发送提示“登录失效”时才需要。确定要重新登录吗？', '重新登录', {
      confirmButtonText: '重新登录',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return; // 点了取消
  }
  startTask(api.login);
}
</script>

<template>
  <el-card shadow="never">
    <template v-if="account.loggedIn">
      <p>✅ 已登录，登录状态有效期至 <b>{{ expires }}</b>。每次运行都会自动续期，不用手动重新登录。</p>
      <el-button link type="info" :disabled="busy" @click="relogin">重新登录</el-button>
    </template>
    <template v-else>
      <p>❌ 未登录或登录已过期，需要扫码登录。</p>
      <el-button type="primary" :disabled="busy" @click="startTask(api.login)">扫码登录</el-button>
      <p class="hint">点击后电脑上会弹出一个浏览器窗口，用手机抖音扫码；5 分钟内有效。如果抖音要求短信验证，直接在窗口里完成。</p>
    </template>
  </el-card>
</template>
