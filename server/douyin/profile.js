import fs from 'node:fs';

const PROFILE_URL = 'https://www.douyin.com/aweme/v1/web/user/profile/self/?device_platform=webapp&aid=6383';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

// 用保存的 Cookie 直接请求“我的资料”接口，不用开浏览器。登录失效时抖音返回空内容。
export async function fetchProfile(statePath) {
  const { cookies } = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const cookie = cookies
    .filter((c) => 'www.douyin.com'.endsWith(c.domain.replace(/^\./, '')))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const res = await fetch(PROFILE_URL, { headers: { cookie, 'user-agent': USER_AGENT, referer: 'https://www.douyin.com/user/self' } });
  const text = await res.text();
  const user = text ? JSON.parse(text).user : null;
  if (!user?.uid) throw new Error('登录已失效，读取不到账号信息');
  return { uid: String(user.uid), nickname: user.nickname, avatar: user.avatar_thumb?.url_list?.[0] ?? '' };
}
