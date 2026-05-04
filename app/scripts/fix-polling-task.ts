/**
 * 修复错误入库的任务记录：将错误的 completed 状态恢复为 polling，
 * 并重建正确的 output_payload，使任务重新进入轮询流程。
 *
 * 用法: bun run scripts/fix-polling-task.ts
 */
import { Database } from 'bun:sqlite';

const DB_PATH = 'D:\\Code\\Git\\cloud-task\\app\\data\\store\\app.db';
const TASK_ID = '658a9668-00a7-45f1-8e3a-aa1a2d551bb2';
const THIRD_PARTY_TASK_ID = 'task_01KQRZ70SYV1R6ZSY26CAS5RME';

const db = new Database(DB_PATH, { readwrite: true });

// ---------- 1. 查看当前记录 ----------
console.log('\n=== 修复前记录 ===');
const before = db.prepare(
  `SELECT id, status, progress, output_payload, next_poll_at, completed_at
   FROM task_runs_v2 WHERE id = ?`
).get(TASK_ID) as any;

if (!before) {
  console.error(`❌ 未找到 ID 为 ${TASK_ID} 的记录`);
  process.exit(1);
}

console.log('status      :', before.status);
console.log('progress    :', before.progress);
console.log('completed_at:', before.completed_at);
console.log('next_poll_at:', before.next_poll_at);
console.log('output_payload:', JSON.stringify(JSON.parse(before.output_payload ?? 'null'), null, 2));

// ---------- 2. 构造正确的 output_payload（对齐 executeTaskHandler 的 pollingData 结构）----------
const correctOutput = {
  thirdPartyTaskId: THIRD_PARTY_TASK_ID,
  pollingPhase: 'image_generate',
  pollCount: 0,
};

// next_poll_at 设为当前时间（立即触发下一次轮询）
const nextPollAt = Date.now();

// ---------- 3. 执行更新 ----------
const stmt = db.prepare(`
  UPDATE task_runs_v2
  SET status         = 'polling',
      output_payload = ?,
      progress       = 30,
      completed_at   = NULL,
      next_poll_at   = ?
  WHERE id = ?
`);

const result = stmt.run(
  JSON.stringify(correctOutput),
  nextPollAt,
  TASK_ID,
);

console.log('\n=== 更新结果 ===');
if (result.changes === 1) {
  console.log('✅ 更新成功，影响行数:', result.changes);
} else {
  console.error('❌ 更新失败，影响行数:', result.changes);
  process.exit(1);
}

// ---------- 4. 验证修复后记录 ----------
console.log('\n=== 修复后记录 ===');
const after = db.prepare(
  `SELECT id, status, progress, output_payload, next_poll_at, completed_at
   FROM task_runs_v2 WHERE id = ?`
).get(TASK_ID) as any;

console.log('status      :', after.status);
console.log('progress    :', after.progress);
console.log('completed_at:', after.completed_at);
console.log('next_poll_at:', after.next_poll_at, `(${new Date(after.next_poll_at).toISOString()})`);
console.log('output_payload:', JSON.stringify(JSON.parse(after.output_payload ?? 'null'), null, 2));

db.close();
console.log('\n🎉 完成，任务已恢复为 polling 状态，将在下次调度时开始轮询。');
