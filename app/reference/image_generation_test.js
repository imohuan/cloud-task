#!/usr/bin/env node
/**
 * 图片生成功能本地模拟测试
 * 
 * 测试流程：
 * 1. 创建认证配置
 * 2. 调用图片生成接口（异步）
 * 3. 轮询查询任务状态
 * 4. 验证最终结果
 * 
 * 使用方法：
 *   DATABASE_URL="postgresql://..." node test/image_generation_test.js
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_ql1KwJLGSQ8D@ep-flat-hat-amvc1kt4.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require";

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const sql = neon(DATABASE_URL);

// 颜色输出
const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[34m${s}\x1b[0m`,
  c: (s) => `\x1b[36m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;
let testAuthProfileId = null;
let testTaskId = null;

async function assert(condition, name) {
  if (condition) {
    console.log(c.g(`  ✓ ${name}`));
    passed++;
  } else {
    console.log(c.r(`  ✗ ${name}`));
    failed++;
  }
}

// ========== API 调用封装 ==========
async function apiCall(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();
  return { status: response.status, data };
}

// ========== 阶段 1: 创建认证配置 ==========
async function setupAuthProfile() {
  console.log(c.b('\n▶ 阶段 1: 创建认证配置'));

  const res = await apiCall('POST', '/api/auth-profiles', {
    platformId: 'yunwu',
    authStrategyId: 'yunwu.api-key',
    name: '测试图片生成认证',
    credentials: {
      apiKey: 'test-api-key-' + Date.now(),
      baseUrl: 'https://api.yunwu.example.com',
    },
  });

  if (res.data.success) {
    testAuthProfileId = res.data.data.id;
    console.log(c.g(`  ✓ 认证配置创建成功: ${testAuthProfileId}`));
  } else {
    console.log(c.r(`  ✗ 认证配置创建失败: ${res.data.error?.message}`));
    failed++;
    throw new Error('无法创建认证配置');
  }
}

// ========== 阶段 2: 调用图片生成接口 ==========
async function testGenerateImage() {
  console.log(c.b('\n▶ 阶段 2: 调用图片生成接口（异步）'));

  const res = await apiCall('POST', '/api/tasks', {
    apiId: 'yunwu.image.generate',
    authProfileId: testAuthProfileId,
    input: {
      prompt: '一只可爱的橘猫在草地上玩耍，阳光明媚，写实风格',
      width: 512,
      height: 512,
      style: 'realistic',
    },
  });

  console.log(c.c(`  响应: ${JSON.stringify(res.data, null, 2)}`));

  await assert(res.data.success === true, '接口调用成功');
  await assert(!!res.data.data?.taskId, '返回了任务ID');
  await assert(res.data.data?.status === 'pending', '任务状态为 pending');

  if (res.data.success) {
    testTaskId = res.data.data.taskId;
    console.log(c.y(`  ℹ 任务ID: ${testTaskId}`));
  }
}

// ========== 阶段 3: 轮询查询任务状态 ==========
async function pollTaskStatus() {
  console.log(c.b('\n▶ 阶段 3: 轮询查询任务状态'));

  const maxAttempts = 30;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    // 查询任务状态
    const res = await apiCall('POST', '/api/invoke/yunwu.image.query', {
      authProfileId: testAuthProfileId,
      input: {
        taskId: testTaskId,
      },
    });

    const task = res.data.data;
    const progressBar = '█'.repeat(Math.floor((task.progress || 0) / 5)) + 
                        '░'.repeat(20 - Math.floor((task.progress || 0) / 5));
    
    process.stdout.write(`\r  [${progressBar}] ${task.progress || 0}% | 状态: ${task.status} | 第${attempts}次查询`);

    if (task.status === 'completed') {
      console.log('');
      console.log(c.g(`  ✓ 任务完成！`));
      console.log(c.c(`  图片URL: ${task.imageUrl}`));
      console.log(c.c(`  创建时间: ${task.createdAt}`));
      console.log(c.c(`  完成时间: ${task.completedAt}`));
      
      await assert(!!task.imageUrl, '返回了图片URL');
      await assert(task.progress === 100, '进度为100%');
      return;
    }

    if (task.status === 'failed') {
      console.log('');
      console.log(c.r(`  ✗ 任务失败: ${task.error}`));
      await assert(false, '任务不应该失败');
      return;
    }

    // 等待1秒后再次查询
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('');
  await assert(false, `轮询超时（${maxAttempts}次）`);
}

// ========== 阶段 4: 直接查询任务API ==========
async function testTaskApi() {
  console.log(c.b('\n▶ 阶段 4: 直接查询任务API'));

  const res = await apiCall('GET', `/api/tasks/${testTaskId}`);

  await assert(res.data.success === true, '任务API查询成功');
  await assert(res.data.data?.taskId === testTaskId, '返回正确的任务ID');
  await assert(res.data.data?.status === 'completed', '任务状态为已完成');

  console.log(c.c(`  任务详情:`));
  console.log(c.c(`    - API: ${res.data.data.apiId}`));
  console.log(c.c(`    - 进度: ${res.data.data.progress}%`));
  console.log(c.c(`    - 输入: ${JSON.stringify(res.data.data.input?.prompt).slice(0, 50)}...`));
  console.log(c.c(`    - 输出: ${JSON.stringify(res.data.data.output).slice(0, 100)}...`));
}

// ========== 阶段 5: 获取任务列表 ==========
async function testTaskList() {
  console.log(c.b('\n▶ 阶段 5: 获取任务列表'));

  const res = await apiCall('GET', '/api/tasks');

  await assert(res.data.success === true, '获取任务列表成功');
  await assert(Array.isArray(res.data.data), '返回数据为数组');

  const taskCount = res.data.data.length;
  console.log(c.c(`  当前共有 ${taskCount} 个待处理任务`));
}

// ========== 阶段 6: 清理 ==========
async function cleanup() {
  console.log(c.b('\n▶ 阶段 6: 清理测试数据'));

  // 删除认证配置
  if (testAuthProfileId) {
    await apiCall('DELETE', `/api/auth-profiles/${testAuthProfileId}`);
    console.log(c.g(`  ✓ 认证配置已删除: ${testAuthProfileId}`));
  }

  // 可选：删除任务记录
  if (testTaskId) {
    await sql`DELETE FROM task_runs_v2 WHERE id = ${testTaskId}`;
    console.log(c.g(`  ✓ 任务记录已清理: ${testTaskId}`));
  }
}

// ========== 主流程 ==========
async function main() {
  console.log(c.b('╔══════════════════════════════════════════╗'));
  console.log(c.b('║      图片生成功能本地模拟测试            ║'));
  console.log(c.b('╚══════════════════════════════════════════╝'));
  console.log(`API地址: ${BASE_URL}`);
  console.log(`数据库: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('');
  console.log(c.y('⚠  确保服务已启动: bun run start'));
  console.log(c.y('⚠  确保 Worker 已启用: ENABLE_WORKER=true'));
  console.log('');

  try {
    await setupAuthProfile();
    await testGenerateImage();
    await pollTaskStatus();
    await testTaskApi();
    await testTaskList();
  } catch (err) {
    console.error(c.r(`\n测试过程中出错: ${err.message}`));
    console.error(err.stack);
    failed++;
  } finally {
    await cleanup();
  }

  console.log(c.b('\n══════════════ 测试结果 ══════════════'));
  console.log(c.g(`  通过: ${passed}`));
  console.log(failed > 0 ? c.r(`  失败: ${failed}`) : `  失败: ${failed}`);
  console.log(c.b('═══════════════════════════════════════'));

  process.exit(failed > 0 ? 1 : 0);
}

main();
