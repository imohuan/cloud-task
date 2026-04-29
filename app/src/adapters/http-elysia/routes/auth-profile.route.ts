/**
 * Auth Profile 路由
 * 提供认证配置管理
 * 
 * 【优化】使用 Logger 替代 console 输出
 */

import { Elysia, t } from 'elysia';
import { getAuthProfileRepository } from '@adapters/persistence';
import { registry } from '@core/application/registry/registry-center';
import type { AuthProfile } from '@core/contracts/auth.types';
import { Logger } from '../../../utils/logger';

const logger = new Logger('AuthProfile');

function toSafeProfile(profile: AuthProfile) {
  return {
    id: profile.id,
    platformId: profile.platformId,
    authStrategyId: profile.authStrategyId,
    name: profile.name,
    enabled: profile.enabled,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function toFullProfile(profile: AuthProfile) {
  return {
    id: profile.id,
    platformId: profile.platformId,
    authStrategyId: profile.authStrategyId,
    name: profile.name,
    enabled: profile.enabled,
    credentials: profile.credentials,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/**
 * Auth Profile 路由
 * 提供认证配置管理
 */
export const authProfileRoutes = new Elysia({ prefix: '/api/auth-profiles' })
  .get('/', async () => {
    const profiles = await getAuthProfileRepository().findAll();

    return {
      success: true,
      data: profiles.map(toSafeProfile),
    };
  }, {
    detail: {
      summary: '获取所有认证配置',
      tags: ['auth-profiles'],
    },
  })

  .get('/:profileId', async ({ params }) => {
    const profile = await getAuthProfileRepository().findById(params.profileId);
    
    if (!profile) {
      return {
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: '认证配置不存在',
        },
      };
    }

    logger.info('获取认证配置详情', { profileId: params.profileId });

    return {
      success: true,
      data: toFullProfile(profile),
    };
  }, {
    params: t.Object({
      profileId: t.String(),
    }),
    detail: {
      summary: '获取单个认证配置详情',
      tags: ['auth-profiles'],
    },
  })

  .post('/', async ({ body }) => {
    const { platformId, authStrategyId, name, credentials } = body as {
      platformId: string;
      authStrategyId: string;
      name: string;
      credentials: Record<string, any>;
    };

    logger.info('创建认证配置请求', { platformId, authStrategyId, name });

    const platform = registry.getPlatform(platformId);
    if (!platform) {
      logger.warn('平台不存在', { platformId });
      return {
        success: false,
        error: {
          code: 'PLATFORM_NOT_FOUND',
          message: '平台不存在',
        },
      };
    }

    const strategy = registry.getAuthStrategy(platformId, authStrategyId);
    if (!strategy) {
      logger.warn('认证策略不存在', { platformId, authStrategyId });
      return {
        success: false,
        error: {
          code: 'AUTH_STRATEGY_NOT_FOUND',
          message: '认证策略不存在',
        },
      };
    }

    const validation = await strategy.validateCredentials(credentials);
    if (!validation.valid) {
      logger.warn('认证参数无效', { error: validation.error });
      return {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: validation.error || '认证参数不合法',
        },
      };
    }

    // 检查名称是否已存在
    const existingProfile = await getAuthProfileRepository().findByName(name);
    if (existingProfile) {
      logger.warn('认证配置名称已存在', { name });
      return {
        success: false,
        error: {
          code: 'DUPLICATE_NAME',
          message: '认证配置名称已存在，请使用其他名称',
        },
      };
    }

    try {
      const profile = await getAuthProfileRepository().create({
        platformId,
        authStrategyId,
        name,
        credentials,
        enabled: true,
      });

      logger.info('认证配置创建成功', { profileId: profile.id });

      return {
        success: true,
        data: toSafeProfile(profile),
      };
    } catch (error: any) {
      logger.error('认证配置创建失败', error);
      return {
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: error.message || '创建认证配置失败',
        },
      };
    }
  }, {
    body: t.Object({
      platformId: t.String(),
      authStrategyId: t.String(),
      name: t.String(),
      credentials: t.Record(t.String(), t.Any()),
    }),
    detail: {
      summary: '创建认证配置',
      tags: ['auth-profiles'],
    },
  })

  .put('/:profileId', async ({ params, body }) => {
    const { name, credentials, enabled } = body as {
      name?: string;
      credentials?: Record<string, any>;
      enabled?: boolean;
    };

    const existing = await getAuthProfileRepository().findById(params.profileId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: '认证配置不存在',
        },
      };
    }

    if (credentials) {
      const strategy = registry.getAuthStrategy(existing.platformId, existing.authStrategyId);
      if (!strategy) {
        return {
          success: false,
          error: {
            code: 'AUTH_STRATEGY_NOT_FOUND',
            message: '认证策略不存在',
          },
        };
      }

      const validation = await strategy.validateCredentials(credentials);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: validation.error || '认证参数不合法',
          },
        };
      }
    }

    const profile = await getAuthProfileRepository().update(params.profileId, {
      name,
      credentials,
      enabled,
    });

    return {
      success: true,
      data: toSafeProfile(profile),
    };
  }, {
    params: t.Object({
      profileId: t.String(),
    }),
    body: t.Object({
      name: t.Optional(t.String()),
      credentials: t.Optional(t.Record(t.String(), t.Any())),
      enabled: t.Optional(t.Boolean()),
    }),
    detail: {
      summary: '更新认证配置',
      tags: ['auth-profiles'],
    },
  })

  .delete('/:profileId', async ({ params }) => {
    await getAuthProfileRepository().delete(params.profileId);

    return {
      success: true,
      message: '认证配置已删除',
    };
  }, {
    params: t.Object({
      profileId: t.String(),
    }),
    detail: {
      summary: '删除认证配置',
      tags: ['auth-profiles'],
    },
  });
