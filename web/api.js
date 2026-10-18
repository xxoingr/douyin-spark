// 和后端 /api 打交道的函数都在这里。出错时抛出带中文原因的 Error。
async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `请求失败（${res.status}）`);
  return data;
}

export const api = {
  status: () => request('GET', '/status'),
  login: () => request('POST', '/login'),
  refreshFriends: () => request('POST', '/friends/refresh'),
  friends: () => request('GET', '/friends'),
  setFriendEnabled: (uid, enabled) => request('PATCH', `/friends/${uid}`, { enabled }),
  messages: () => request('GET', '/messages'),
  addMessage: (content) => request('POST', '/messages', { content }),
  deleteMessage: (id) => request('DELETE', `/messages/${id}`),
  run: () => request('POST', '/runs'),
  runs: () => request('GET', '/runs'),
};
