/**
 * PostgreSQL 同构数据库数据迁移脚本
 * 用法: bun run scripts/migrate-db.ts
 *
 * 注意：
 * - 只迁移数据，不迁移表结构（假设结构完全一致）
 * - 会先 TRUNCATE 目标表，再插入源数据
 * - 自动处理外键约束（先禁用，迁移完再启用）
 */
import { Client } from "pg";

// ==================== 请修改这里 ====================
const SOURCE_DB_URL =
  "postgresql://neondb_owner:npg_ql1KwJLGSQ8D@ep-flat-hat-amvc1kt4.c-5.us-east-1.aws.neon.tech/neondb?sslmode=verify-full";
const TARGET_DB_URL =
  "postgresql://postgres:qhb4fwd8@dbconn.usw-1.sealos.app:42794/?directConnection=true";
// ====================================================

// 排除的系统表/不迁移的表
const EXCLUDED_TABLES = new Set([
  "migrations",
  "schema_migrations",
  "spatial_ref_sys",
  "pg_stat_statements",
  "task_runs"
]);

async function run() {
  const source = new Client({ connectionString: SOURCE_DB_URL });
  const target = new Client({ connectionString: TARGET_DB_URL });

  try {
    await source.connect();
    await target.connect();
    console.log("✅ 数据库连接成功");

    // 1. 获取源库所有用户表（按依赖排序，避免外键问题）
    const { rows: tables } = await source.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tables
      .map((t) => t.table_name)
      .filter((name) => !EXCLUDED_TABLES.has(name));

    console.log(`📋 发现 ${tableNames.length} 张表需要迁移:`, tableNames.join(", "));

    // 2. 禁用目标库外键约束
    await target.query("SET session_replication_role = 'replica';");
    console.log("🔒 已禁用目标库外键检查");

    // 3. 逐表迁移
    for (const table of tableNames) {
      // 3.1 获取列名与数据类型
      const { rows: columns } = await source.query<{ column_name: string; data_type: string }>(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      const columnNames = columns.map((c) => `"${c.column_name}"`).join(", ");

      // 3.2 清空目标表
      await target.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);

      // 3.3 读取源数据
      const { rows: data } = await source.query(`SELECT * FROM "${table}";`);

      if (data.length === 0) {
        console.log(`⏭️  ${table}: 0 条数据，跳过`);
        continue;
      }

      // 3.4 批量插入（每批 1000 条）
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const placeholders: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        for (const row of batch) {
          const rowPlaceholders: string[] = [];
          for (const col of columns) {
            let val = row[col.column_name];
            // pg 驱动会把 json/jsonb 解析为 JS 对象，INSERT 前需重新序列化
            if (
              (col.data_type === "json" || col.data_type === "jsonb") &&
              val !== null && typeof val !== "string"
            ) {
              val = JSON.stringify(val);
            }
            values.push(val);
            rowPlaceholders.push(`$${idx++}`);
          }
          placeholders.push(`(${rowPlaceholders.join(", ")})`);
        }

        const sql = `INSERT INTO "${table}" (${columnNames}) VALUES ${placeholders.join(", ")};`;
        await target.query(sql, values);
      }

      console.log(`✅  ${table}: 迁移 ${data.length} 条数据`);
    }

    // 4. 恢复外键约束
    await target.query("SET session_replication_role = 'origin';");
    console.log("🔓 已恢复目标库外键检查");

    console.log("🎉 数据迁移完成！");
  } catch (err) {
    console.error("❌ 迁移失败:", err);
    process.exit(1);
  } finally {
    await source.end();
    await target.end();
  }
}

run();
