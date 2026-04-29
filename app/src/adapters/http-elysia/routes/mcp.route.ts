import { Elysia, t } from 'elysia';
import { registry } from '@core/application/registry/registry-center';
import { apisToMCPTools, apiToMCPTool } from '@core/mcp';

/**
 * MCP 路由
 * 提供 MCP 工具定义导出
 */
export const mcpRoutes = new Elysia({ prefix: '/api/mcp' })
  // 获取所有 MCP 工具定义
  .get('/tools', () => {
    const allApis: any[] = [];
    
    // 收集所有 API
    const platforms = registry.getPlatforms();
    platforms.forEach(p => {
      const apis = registry.getApisByPlatform(p.id);
      allApis.push(...apis);
    });

    // 转换为 MCP 工具
    const tools = apisToMCPTools(allApis);

    return {
      success: true,
      data: tools,
    };
  }, {
    detail: {
      summary: '获取所有 MCP 工具定义',
      tags: ['mcp'],
    },
  })

  // 获取单个 API 的 MCP 工具定义
  .get('/tools/:apiId', ({ params }) => {
    const metadata = registry.getApiMetadata(params.apiId);
    if (!metadata) {
      return {
        success: false,
        error: 'API 不存在',
      };
    }

    const tool = apiToMCPTool(metadata);
    return {
      success: true,
      data: tool,
    };
  }, {
    params: t.Object({
      apiId: t.String(),
    }),
    detail: {
      summary: '获取单个 API 的 MCP 工具定义',
      tags: ['mcp'],
    },
  });
