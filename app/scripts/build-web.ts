/**
 * 一键构建前端并同步到 app/public/
 *
 * 步骤：
 *   1. pnpm build（web 目录）
 *   2. 清空 app/public/（保留 logs 子目录）
 *   3. 将 web/dist/ 全量复制到 app/public/
 *   4. 重新生成 static-assets.ts（供编译 exe 使用）
 */

import { join } from 'path';
import { readdir, rm, mkdir, cp, stat } from 'fs/promises';

const appDir   = join(import.meta.dir, '..');
const webDir   = join(appDir, '..', 'web');
const distDir  = join(webDir, 'dist');
const publicDir = join(appDir, 'public');

// ── Step 1: build web ────────────────────────────────────────────────────────
console.log('\n📦 [1/3] 构建前端 (pnpm build)...');
const buildProc = Bun.spawnSync(['pnpm', 'build'], {
  cwd: webDir,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (buildProc.exitCode !== 0) {
  console.error('❌ pnpm build 失败');
  process.exit(1);
}

// ── Step 2: clean public/ (keep logs/) ───────────────────────────────────────
console.log('\n🧹 [2/3] 同步到 app/public/...');
await mkdir(publicDir, { recursive: true });

const entries = await readdir(publicDir, { withFileTypes: true });
await Promise.all(
  entries
    .filter(e => e.name !== 'logs')
    .map(e => rm(join(publicDir, e.name), { recursive: true, force: true })),
);

// ── Step 3: copy dist → public ───────────────────────────────────────────────
await cp(distDir, publicDir, { recursive: true });
console.log(`   dist → public/ 完成`);

// ── Step 4: regenerate static-assets.ts ─────────────────────────────────────
console.log('\n⚙️  [3/3] 生成 static-assets.ts (供 build:exe 使用)...');
const genProc = Bun.spawnSync(['bun', 'run', 'scripts/build-assets.ts'], {
  cwd: appDir,
  stdout: 'inherit',
  stderr: 'inherit',
});
if (genProc.exitCode !== 0) {
  console.error('❌ build-assets.ts 失败');
  process.exit(1);
}

console.log('\n✅ 完成！前端已同步到 app/public/，可直接启动 Node 后台。\n');
