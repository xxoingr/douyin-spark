<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api.js';

const busy = inject('busy');
const finishedCount = inject('finishedCount');
const startTask = inject('startTask');
const accountId = inject('accountId');

const friends = ref([]);
const onlyFlame = ref(true);

async function load() {
  friends.value = accountId.value ? await api.friends(accountId.value) : [];
}
onMounted(load);
watch([finishedCount, accountId], load);

const shown = computed(() => (onlyFlame.value ? friends.value.filter((f) => f.flame_days != null) : friends.value));
const enabledCount = computed(() => friends.value.filter((f) => f.enabled).length);

// 今天有没有给 TA 发过（看自己发的最后一条消息的日期，含手机上手动发的）
const sentToday = (friend) => friend.my_sent_at != null && new Date(friend.my_sent_at).toDateString() === new Date().toDateString();
const unsentCount = computed(() => friends.value.filter((f) => f.enabled && !sentToday(f)).length);

async function toggle(friend, enabled) {
  try {
    await api.setFriendEnabled(accountId.value, friend.uid, enabled);
    friend.enabled = enabled ? 1 : 0;
  } catch (err) {
    ElMessage.error(err.message);
  }
}
</script>

<template>
  <div>
    <el-empty v-if="!accountId" description="还没有账号，先到“账号”页扫码添加" />
    <div v-else class="toolbar">
      <el-button :disabled="busy" @click="startTask(() => api.refreshFriends(accountId))">刷新好友列表</el-button>
      <el-switch v-model="onlyFlame" active-text="只看有火花的" />
      <span class="hint">已勾选 {{ enabledCount }} 个好友续火花，今天还有 {{ unsentCount }} 个没发</span>
    </div>

    <el-empty v-if="accountId && !friends.length" description="还没有好友数据，点“刷新好友列表”从抖音拉取（约半分钟）" />
    <el-table v-else-if="accountId" :data="shown" row-key="uid">
      <el-table-column label="好友" min-width="220">
        <template #default="{ row }">
          <div class="friend">
            <img v-if="row.avatar" :src="row.avatar" class="avatar" referrerpolicy="no-referrer" alt="" />
            <span>{{ row.title }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="火花" min-width="180">
        <template #default="{ row }">
          <template v-if="row.flame_days != null">
            <span class="days">🔥 {{ row.flame_days }} 天</span>
            <span v-if="row.flame_text !== String(row.flame_days)" class="hint">{{ row.flame_text }}</span>
          </template>
          <span v-else class="hint">无火花</span>
        </template>
      </el-table-column>
      <el-table-column label="今天" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="sentToday(row)" type="success" size="small" disable-transitions>已发</el-tag>
          <el-tag v-else type="warning" size="small" disable-transitions>未发</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="续火花" width="90" align="center">
        <template #default="{ row }">
          <el-switch :model-value="Boolean(row.enabled)" @change="(value) => toggle(row, value)" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.friend {
  display: flex;
  gap: 10px;
  align-items: center;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}
.days {
  margin-right: 8px;
  font-weight: 600;
  color: #e6501f;
}
</style>
