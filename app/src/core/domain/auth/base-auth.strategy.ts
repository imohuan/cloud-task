import type { AuthContext, AuthProfile, AuthStrategyMetadata } from '@core/contracts/auth.types';

/**
 * 认证策略基类
 * 所有认证实现都必须继承此类
 */
export abstract class BaseAuthStrategy {
  /**
   * 获取认证策略元数据
   */
  abstract getMetadata(): AuthStrategyMetadata;

  /**
   * 根据用户配置生成认证上下文
   * @param profile 认证配置（从数据库读取）
   * @returns 认证上下文（用于 API 调用）
   */
  abstract buildAuthContext(profile: AuthProfile): Promise<AuthContext>;

  /**
   * 验证认证配置是否有效（可选实现）
   * @param credentials 用户填写的认证参数
   */
  async validateCredentials(credentials: Record<string, any>): Promise<{
    valid: boolean;
    error?: string;
  }> {
    // 默认只做基本校验，子类可覆盖实现更复杂的验证逻辑
    const schema = this.getMetadata().authSchema;
    
    for (const field of schema.fields) {
      if (field.required && !credentials[field.name]) {
        return {
          valid: false,
          error: `缺少必填字段: ${field.name}`,
        };
      }
    }
    
    return { valid: true };
  }

  /**
   * 获取平台支持的模型列表
   * 默认实现：通过认证上下文请求 {baseUrl}/models
   * 子类可覆盖以实现自定义逻辑
   */
  async fetchModels(profile: AuthProfile): Promise<any[]> {
    const ctx = await this.buildAuthContext(profile);
    const baseUrl = (ctx.metadata?.baseUrl as string) || '';

    const response = await fetch(`${baseUrl}/models`, {
      headers: ctx.headers || {},
    });

    if (!response.ok) {
      throw new Error(`获取模型列表失败: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    return Array.isArray(data) ? data : (data.data ?? []);
  }
}
