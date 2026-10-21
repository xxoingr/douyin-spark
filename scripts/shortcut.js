// 在桌面创建“续火花”快捷方式，双击即可打开页面。用法：npm run shortcut
// conhost --headless 让脚本在后台运行，双击时不会闪出黑窗口。
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const powershell = (script) =>
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' }).trim();

const desktop = powershell("[Environment]::GetFolderPath('Desktop')");
const link = path.join(desktop, '续火花.lnk');
powershell(`
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut('${link}')
  $s.TargetPath = "$env:WINDIR\\System32\\conhost.exe"
  $s.Arguments = '--headless "${process.execPath}" scripts\\open.js'
  $s.WorkingDirectory = '${root}'
  $s.IconLocation = '${process.execPath},0'
  $s.Description = '打开 douyin-spark 续火花页面'
  $s.Save()
`);
console.log(`已在桌面创建快捷方式：${link}`);
