import { Elysia, t } from 'elysia';
import { registry } from '@core/application/registry/registry-center';
import { getAuthProfileRepository } from '@adapters/persistence';

/**
 * Invoke 路由
 * 提供 API 调用入口
 */
export const invokeRoutes = new Elysia({ prefix: '/api/invoke' })
  .post('/:apiId', async ({ params, body }) => {
    const { authProfileId, input } = body as {
      authProfileId: string;
      input?: Record<string, any>;
    };

    const handler = registry.getApiHandler(params.apiId);
    if (!handler) {
      return {
        success: false,
        error: {
          code: 'API_NOT_FOUND',
          message: 'API 不存在',
        },
      };
    }

    const metadata = registry.getApiMetadata(params.apiId);

    if (metadata!.executionMode !== 'sync') {
      return {
        success: false,
        error: {
          code: 'INVALID_EXECUTION_MODE',
          message: '该接口为异步接口，请使用 POST /api/tasks 创建异步任务',
        },
      };
    }

    const validation = await handler.validateInput(input || {});
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '输入参数验证失败',
          details: validation.errors,
        },
      };
    }

    const authStrategy = registry.getAuthStrategy(
      metadata!.platformId!,
      metadata!.authStrategyId,
    );

    if (!authStrategy) {
      return {
        success: false,
        error: {
          code: 'AUTH_STRATEGY_NOT_FOUND',
          message: '认证策略不存在',
        },
      };
    }

    const authProfile = await getAuthProfileRepository().findById(authProfileId);
    if (!authProfile) {
      return {
        success: false,
        error: {
          code: 'AUTH_PROFILE_NOT_FOUND',
          message: '认证配置不存在',
        },
      };
    }

    if (!authProfile.enabled) {
      return {
        success: false,
        error: {
          code: 'AUTH_PROFILE_DISABLED',
          message: '认证配置已禁用',
        },
      };
    }

    if (authProfile.platformId !== metadata!.platformId || authProfile.authStrategyId !== metadata!.authStrategyId) {
      return {
        success: false,
        error: {
          code: 'AUTH_PROFILE_MISMATCH',
          message: '认证配置与接口不匹配',
        },
      };
    }

    const authContext = await authStrategy.buildAuthContext(authProfile);

    const context = {
      authProfileId,
      input: input || {},
      requestId: `req-${Date.now()}`,
    };

    const result = await handler.execute(context, authContext);

    return result;
  }, {
    params: t.Object({
      apiId: t.String(),
    }),
    body: t.Object({
      authProfileId: t.String(),
      input: t.Optional(t.Record(t.String(), t.Any())),
    }),
    detail: {
      summary: '调用同步 API',
      tags: ['invoke'],
    },
  });
