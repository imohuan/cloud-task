import { BaseAuthStrategy } from '@core/domain/auth/base-auth.strategy';
import type { AuthContext, AuthProfile, AuthStrategyMetadata } from '@core/contracts/auth.types';

/**
 * NewAPI平台 API Key 认证策略
 * id 只写简短形式 'api-key'，注册中心自动拼装为 'newapi.api-key'
 */
export class NewApiApiKeyAuthStrategy extends BaseAuthStrategy {
  getMetadata(): AuthStrategyMetadata {
    return {
      id: 'api-key',
      name: 'API Key 认证',
      description: '使用NewAPI平台 API Key 进行认证',
      authSchema: {
        description: '请输入您的NewAPI平台 API Key 和 Base URL',
        fields: [
          {
            name: 'apiKey',
            type: 'string',
            required: true,
            description: 'NewAPI平台 API Key',
            uiHint: 'text',
          },
          {
            name: 'baseUrl',
            type: 'string',
            required: false,
            description: 'API 基础 URL（可选，默认: https://newapi.ai/v1）',
            defaultValue: 'https://newapi.ai/v1',
            uiHint: 'text',
          },
        ],
      },
    };
  }

  async buildAuthContext(profile: AuthProfile): Promise<AuthContext> {
    const { apiKey, baseUrl } = profile.credentials;

    return {
      authProfileId: profile.id,
      platformId: profile.platformId,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      metadata: { baseUrl }
    };
  }

  async validateCredentials(credentials: Record<string, any>) {
    const result = await super.validateCredentials(credentials);

    if (!result.valid) {
      return result;
    }

    // 额外校验 API Key 格式
    const apiKey = credentials.apiKey as string;
    if (apiKey.length < 20) {
      return {
        valid: false,
        error: 'API Key 格式不正确',
      };
    }

    return { valid: true };
  }
}
