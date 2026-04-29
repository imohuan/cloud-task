import { Elysia, t } from 'elysia';
import { registry } from '@core/application/registry/registry-center';

/**
 * Registry 路由
 * 提供平台、分类、API 列表和 Schema 查询
 */
export const registryRoutes = new Elysia({ prefix: '/api/registry' })
  // 获取所有注册表数据（嵌套结构：平台 -> 分类 -> API，平台 -> 认证策略）
  .get('/all', () => {
    const platforms = registry.getPlatforms();

    const data = platforms.map(platform => {
      const categories = registry.getCategories(platform.id);
      const authStrategies = registry.getAuthStrategies(platform.id);

      const categoriesWithApis = categories.map(category => {
        const apis = registry.getApisByCategory(platform.id, category.id);
        return { ...category, apis };
      });

      return {
        ...platform,
        categories: categoriesWithApis,
        authStrategies,
      };
    });

    return {
      success: true,
      data: { platforms: data },
    };
  }, {
    detail: {
      summary: '获取所有注册表数据（嵌套结构）',
      tags: ['registry'],
    },
  })

  // 获取所有平台列表
  .get('/platforms', () => {
    const platforms = registry.getPlatforms();
    return {
      success: true,
      data: platforms,
    };
  }, {
    detail: {
      summary: '获取所有平台列表',
      tags: ['registry'],
    },
  })

  // 获取平台详情
  .get('/platforms/:platformId', ({ params }) => {
    const platform = registry.getPlatform(params.platformId);
    if (!platform) {
      return {
        success: false,
        error: '平台不存在',
      };
    }
    return {
      success: true,
      data: platform,
    };
  }, {
    params: t.Object({
      platformId: t.String(),
    }),
    detail: {
      summary: '获取平台详情',
      tags: ['registry'],
    },
  })

  // 获取平台下的分类列表
  .get('/platforms/:platformId/categories', ({ params }) => {
    const categories = registry.getCategories(params.platformId);
    return {
      success: true,
      data: categories,
    };
  }, {
    params: t.Object({
      platformId: t.String(),
    }),
    detail: {
      summary: '获取平台下的分类列表',
      tags: ['registry'],
    },
  })

  // 获取平台下的认证策略列表
  .get('/platforms/:platformId/auth-strategies', ({ params }) => {
    const strategies = registry.getAuthStrategies(params.platformId);
    return {
      success: true,
      data: strategies,
    };
  }, {
    params: t.Object({
      platformId: t.String(),
    }),
    detail: {
      summary: '获取平台下的认证策略列表',
      tags: ['registry'],
    },
  })

  // 获取平台下的 API 列表
  .get('/platforms/:platformId/apis', ({ params }) => {
    const apis = registry.getApisByPlatform(params.platformId);
    return {
      success: true,
      data: apis,
    };
  }, {
    params: t.Object({
      platformId: t.String(),
    }),
    detail: {
      summary: '获取平台下的 API 列表',
      tags: ['registry'],
    },
  })

  // 获取分类下的 API 列表
  .get('/platforms/:platformId/categories/:categoryId/apis', ({ params }) => {
    const apis = registry.getApisByCategory(params.platformId, params.categoryId);
    return {
      success: true,
      data: apis,
    };
  }, {
    params: t.Object({
      platformId: t.String(),
      categoryId: t.String(),
    }),
    detail: {
      summary: '获取分类下的 API 列表',
      tags: ['registry'],
    },
  })

  // 获取 API 详情（包括输入输出 Schema）
  .get('/apis/:apiId', ({ params }) => {
    const metadata = registry.getApiMetadata(params.apiId);
    if (!metadata) {
      return {
        success: false,
        error: 'API 不存在',
      };
    }
    return {
      success: true,
      data: metadata,
    };
  }, {
    params: t.Object({
      apiId: t.String(),
    }),
    detail: {
      summary: '获取 API 详情',
      tags: ['registry'],
    },
  })

  // 批量获取 API 基础信息（轻量级，仅返回 id 和 name）
  .post('/apis/batch', ({ body }) => {
    const { apiIds } = body;
    if (!Array.isArray(apiIds) || apiIds.length === 0) {
      return {
        success: false,
        error: 'apiIds 必须是非空数组',
      };
    }

    // 限制批量查询数量
    const limitedIds = apiIds.slice(0, 100);
    const result = limitedIds.map(apiId => {
      const metadata = registry.getApiMetadata(apiId);
      return {
        id: apiId,
        name: metadata?.name || apiId,
      };
    });

    return {
      success: true,
      data: result,
    };
  }, {
    body: t.Object({
      apiIds: t.Array(t.String()),
    }),
    detail: {
      summary: '批量获取 API 名称',
      tags: ['registry'],
    },
  });
