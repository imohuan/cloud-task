# Worker 任务执行问题分析与解决

## 问题概述

异步任务被创建后，Worker 无法正确获取并执行任务。任务状态卡在 `running`，但没有实际的执行日志。

## 问题现象

1. **任务创建成功**：日志显示任务创建成功，状态为 `pending`
2. **Worker 获取任务失败**：Worker 报告 "数据库中没有 pending 状态的任务"
3. **任务状态异常**：查询任务时发现状态为 `running`，但没有任何执行日志
4. **TaskHandler 未被调用**：没有 `TaskHandler` 开始执行的日志

## 根本原因

### SQL 竞态条件 (Race Condition)

`postgres-task-dispatcher.ts` 中的 `claimNextTask()` 方法使用了 CTE (Common Table Expression) 查询：

```sql
-- 问题代码
WITH picked AS (
  SELECT id
  FROM task_runs_v2
  WHERE status = 'pending'
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE task_runs_v2 t
SET status = 'running', ...
FROM picked
WHERE t.id = picked.id
RETURNING ...
```

**问题分析：**
1. Worker A 执行 CTE 查询，获取到 pending 任务的 id
2. Worker B 抢先执行 UPDATE，将该任务改为 `running`
3. Worker A 的 UPDATE 由于 `WHERE t.id = picked.id` 条件不满足，返回空结果
4. Worker A 回滚事务，返回 null
5. 任务被改为 `running`，但没有 Worker 执行它

## 多次修改历程

### 第一次修改：添加基础日志
- 在 `claimNextTask()` 中添加 pending 任务数量查询
- 在 Worker 循环中添加日志
- **结果**：可以看到任务被创建，但 Worker 获取失败

### 第二次修改：增强日志
- 在 `defaultTaskHandler` 中添加 8 个步骤的详细日志
- 在 `base-task-dispatcher.ts` 中添加执行日志
- **结果**：确认 `TaskHandler` 根本没有被调用

### 第三次修改：修复竞态条件 ✓
- 将 CTE 查询改为原子子查询
- **结果**：Worker 正确获取并执行任务

```sql
-- 修复后的代码
UPDATE task_runs_v2
SET status = 'running', ...
WHERE id = (
  SELECT id FROM task_runs_v2
  WHERE status = 'pending'
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING ...
```

## 关键教训

### 1. 原子操作的重要性
PostgreSQL 的 `FOR UPDATE SKIP LOCKED` 必须在同一个原子操作中完成查询和更新，否则会出现竞态条件。

### 2. 日志的重要性
- 需要在关键路径上添加日志：任务获取、执行开始、执行结束
- 日志应该包含任务 ID，便于追踪
- 使用结构化日志（对象格式）便于调试

### 3. 调试策略
当遇到 Worker 不执行任务时：
1. 检查任务是否真的被创建（`pending` 状态）
2. 检查 Worker 是否能发现任务
3. 检查 Worker 是否能成功获取任务（锁定）
4. 检查 `TaskHandler` 是否被调用
5. 检查任务执行流程是否完整

## 修复后的日志示例

```
✅ Worker 成功获取任务: a485a0ad..., apiId=yunwu.image.generate
🚀 Worker-1 开始执行任务
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 [TaskHandler] 开始执行任务: a485a0ad...
   apiId=yunwu.image.generate, authProfileId=xxx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[a485a0ad...] 步骤1: 更新任务状态为 running
[a485a0ad...] 步骤2: 查找 API Handler: yunwu.image.generate
[a485a0ad...] ✅ 找到 API Handler: 图片生成 (async)
... (步骤3-8)
[a485a0ad...] ✅ API Handler 执行完成, success=true
[a485a0ad...] 步骤8: 更新任务进度 -> 90%
[a485a0ad...] ✅ 任务执行成功, 耗时: 11798ms
[a485a0ad...] ✅ 任务状态已更新为 completed
✅ 任务完成: a485a0ad..., 耗时: 11798ms
✅ Worker-1 任务 #1 执行完毕: a485a0ad...
```

## 相关文件

- `app/src/adapters/task-dispatcher/postgres-task-dispatcher.ts` - 任务获取逻辑
- `app/src/adapters/task-dispatcher/base-task-dispatcher.ts` - Worker 循环
- `app/src/adapters/http-elysia/routes/task.route.ts` - TaskHandler 实现

## 时间线

- 2026-04-25 22:18 - 首次报告问题
- 2026-04-25 22:46 - 添加详细日志
- 2026-04-25 22:54 - 修复竞态条件，问题解决
