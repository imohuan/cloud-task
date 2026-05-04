/**
 * 应用启动入口
 * 
 * 【问题分析】
 * 1. 直接读取 process.env 违反了依赖注入原则，Core 层应该通过配置对象获取参数
 * 2. 缺少启动时的配置验证，可能导致运行时错误
 * 3. 端口解析没有错误处理，无效值会导致 NaN
 * 4. 缺少优雅关闭的超时机制
 * 
 * 【优化】引入配置管理器和启动验证
 */

import { createElysiaApp } from '@adapters/http-elysia';
import { initPersistence, shutdownPersistence } from '@adapters/persistence';
import { taskDispatcher } from '@adapters/http-elysia/routes/task.route';
import { registry } from '@core/application/registry/registry-center';
import { registerNewApiPlatform } from '@/platforms';
import { getConfig, validateConfig } from './config';
import { Logger, getLogFilePath } from './utils/logger';
import { existsSync, unlinkSync, mkdirSync, accessSync, constants } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';

/** 生成本次启动的唯一标识 */
const BOOT_ID = randomUUID();

/** 检查是否需要清空日志 */
const shouldClearLogs = process.argv.includes('--clear');

/** 清空当日日志文件 */
function clearTodayLogs(): void {
  const file = getLogFilePath();
  if (existsSync(file)) {
    try {
      unlinkSync(file);
      console.log(`🗑️ 已清空日志文件: ${file}`);
    } catch (err) {
      console.error('❌ 清空日志文件失败:', err);
    }
  }
}

// 如果需要，先清空日志
if (shouldClearLogs) {
  clearTodayLogs();
}

const logger = new Logger('Bootstrap');

/** 加载并验证配置 */
const config = getConfig();
validateConfig(config);


/**
 * 预检关键目录是否可写
 * 根本原因：Docker bind mount 由 Daemon 以 root 创建，容器以非 root 用户运行时无写权限
 */
function checkDirectories(): void {
  const checks: Array<[string, string]> = [];

  if (config.queue.driver === 'sqlite' && config.database.sqlitePath) {
    checks.push(['SQLite 数据目录', dirname(config.database.sqlitePath)]);
  }
  if (config.log.enableFile) {
    checks.push(['日志目录', config.log.logDir]);
  }

  for (const [label, dir] of checks) {
    try {
      mkdirSync(dir, { recursive: true });
      accessSync(dir, constants.W_OK);
    } catch {
      console.error(
        `\n❌ ${label} "${dir}" 不可写（权限不足）` +
        `\n   根本原因：Docker bind mount 目录由 root 创建，但容器以非 root 用户（UID 1001）运行` +
        `\n   修复方法（在宿主机执行）：` +
        `\n     mkdir -p ${dir} && chown 1001:1001 ${dir}\n`,
      );
      process.exit(1);
    }
  }
}

async function bootstrap() {
  try {
    checkDirectories();

    logger.info('═══════════════════════════════════════════════════════');
    logger.info('🚀 服务启动中...');
    logger.info(`🔑 启动标识: ${BOOT_ID}`);
    logger.info(`📝 日志文件: ${getLogFilePath()}`);
    logger.info('═══════════════════════════════════════════════════════');

    // 1. 注册所有平台
    logger.info('📦 注册平台...');
    registerNewApiPlatform(registry)

    // 未来可以继续注册其他平台
    // registerTencentCloudPlatform(registry);
    // registerAlibabaBailianPlatform(registry);

    // 2. 初始化注册中心
    logger.info('🔧 初始化注册中心...');
    await registry.initialize();

    // 3. 初始化数据库（自动建表）
    logger.info('🗄️ 初始化数据库...');
    await initPersistence();

    // 4. 启动数据库任务消费器（异步任务处理）
    if (config.worker.enabled) {
      logger.info('⚙️ 启动任务消费器...');
      await taskDispatcher.start();
      logger.info('✅ 任务消费器已启动');
    }

    // 5. 创建并启动 HTTP 服务
    logger.info('🚀 启动 HTTP 服务...');
    const app = createElysiaApp(config);

    app.listen(config.server.port, () => {
      logger.info('');
      logger.info('✅ 服务启动成功！');
      logger.info(`🌐 HTTP: http://localhost:${config.server.port}`);
      logger.info(`📚 文档: http://localhost:${config.server.port}/docs`);
      logger.info(`💚 健康: http://localhost:${config.server.port}/health`);
      logger.info(`⚙️ 任务消费器: ${config.worker.enabled ? '已启用' : '已禁用'}`);
      logger.info('');
      logger.info('📋 已注册平台:');
      const platforms = registry.getPlatforms();
      platforms.forEach(p => {
        logger.info(`   - ${p.name} (${p.id})`);
        const categories = registry.getCategories(p.id);
        categories.forEach(c => {
          logger.info(`     └─ ${c.name} (${c.id})`);
          const apis = registry.getApisByCategory(p.id, c.id);
          apis.forEach(api => {
            logger.info(`        └─ ${api.name} (${api.id}) [${api.executionMode}]`);
          });
        });
      });
      logger.info('');
    });

    // 优雅关闭 - 增加超时机制
    const gracefulShutdown = async (signal: string) => {
      logger.info(`\n🛑 收到 ${signal} 信号，正在关闭服务...`);

      /** 设置强制关闭超时 */
      const forceExitTimeout = setTimeout(() => {
        logger.error('❌ 优雅关闭超时，强制退出');
        process.exit(1);
      }, config.server.shutdownTimeoutMs);

      try {
        if (config.worker.enabled) {
          await taskDispatcher.stop();
        }
        await registry.destroy();
        await shutdownPersistence();
        clearTimeout(forceExitTimeout);
        logger.info('✅ 服务已安全关闭');
        process.exit(0);
      } catch (error) {
        logger.error('❌ 关闭过程中发生错误:', error);
        clearTimeout(forceExitTimeout);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    /** 处理未捕获的异常 */
    process.on('uncaughtException', (error) => {
      logger.error('❌ 未捕获的异常:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('❌ 未处理的 Promise 拒绝:', reason);
    });

  } catch (error) {
    logger.error('❌ 启动失败:', error);
    // 确保日志写入文件后再退出
    await Logger.flushAll();
    process.exit(1);
  }
}

bootstrap();
