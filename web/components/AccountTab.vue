<script setup>
import { computed, inject } from 'vue';
import { api } from '../api.js';

const status = inject('status');
const busy = inject('busy');
const startTask = inject('startTask');

const account = computed(() => status.value.account);
const expires = computed(() =>
  account.value.expiresAt ? new Date(account.value.expiresAt).toLocaleDateString('zh-CN') : '',
);
</script>

<template>
  <el-card shadow="never">
    <p v-if="account.loggedIn">
      ✅ 已登录，登录状态有效期至 <b>{{ expires }}</b>。每次运行都会自动续期，不用手动重新登录。
    </p>
    <p v-else>❌ 未登录或登录已过期，需要扫码登录。</p>
    <el-button type="primary" :disabled="busy" @click="startTask(api.login)">扫码登录</el-button>
    <p class="hint">点击后电脑上会弹出一个浏览器窗口，用手机抖音扫码；5 分钟内有效。如果抖音要求短信验证，直接在窗口里完成。</p>
  </el-card>
</template>
