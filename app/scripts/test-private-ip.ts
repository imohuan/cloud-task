/**
 * 测试 isLocalOrPrivateUrl 逻辑
 *
 * 用法: bun run scripts/test-private-ip.ts
 */
import { isLocalOrPrivateUrl } from '../src/utils/is-local-url';

const cases: Array<{ url: string; expected: boolean; desc: string }> = [
  // 本地 / 私有 → true
  { url: 'http://localhost/image.jpg',          expected: true,  desc: 'localhost' },
  { url: 'http://127.0.0.1/image.jpg',          expected: true,  desc: 'IPv4 loopback' },
  { url: 'http://[::1]/image.jpg',              expected: true,  desc: 'IPv6 loopback' },
  { url: 'http://192.168.1.100/image.jpg',      expected: true,  desc: 'IPv4 private 192.168.x' },
  { url: 'http://10.0.0.1/img.png',             expected: true,  desc: 'IPv4 private 10.x' },
  { url: 'http://172.16.0.5/img.png',           expected: true,  desc: 'IPv4 private 172.16.x' },
  { url: 'http://myserver.local/img.jpg',       expected: true,  desc: '*.local 域名' },
  // 公网 → false
  { url: 'https://example.com/image.jpg',       expected: false, desc: '公网域名' },
  { url: 'https://cdn.openai.com/img.png',      expected: false, desc: '公网 CDN' },
  { url: 'https://8.8.8.8/image.jpg',           expected: false, desc: '公网 IP' },
  { url: 'https://101.0.26.90/image.jpg',       expected: false, desc: '公网 IP 2' },
  // 边界情况
  { url: 'data:image/png;base64,abc123',        expected: false, desc: 'base64 data URI（不是 http）' },
  { url: 'not-a-url',                           expected: false, desc: '非法 URL' },
];

let passed = 0;
let failed = 0;

for (const { url, expected, desc } of cases) {
  const result = isLocalOrPrivateUrl(url);
  const ok = result === expected;
  const icon = ok ? '✓' : '✗';
  console.log(`${icon} [${desc}]`);
  if (!ok) {
    console.log(`    url:      ${url}`);
    console.log(`    expected: ${expected}`);
    console.log(`    got:      ${result}`);
    failed++;
  } else {
    passed++;
  }
}

console.log(`\n结果: ${passed} 通过 / ${failed} 失败`);
// if (failed > 0) Bun.exit(1);
