import { BasePlatformProvider, type CategoryMetadata } from '@core/domain/platform/base-platform.provider';

/**
 * Apimart平台提供者
 */
export class ApimartPlatformProvider extends BasePlatformProvider {
  getMetadata() {
    return {
      id: 'apimart',
      name: 'Apimart平台',
      description: 'Apimart AI 平台，提供图片生成、语音合成等 AI 能力',
      website: 'https://apimart.ai',
      icon: 'cloud',
      enabled: true,
    };
  }

  getCategories(): CategoryMetadata[] {
    return [
      // {
      //   id: 'chat',
      //   name: 'Chat 生成',
      //   description: 'OpenAI Chat Completions 相关接口',
      //   icon: 'chat',
      //   order: 1,
      // },
      {
        id: 'image',
        name: '图片生成',
        description: 'AI 图片生成相关接口',
        icon: 'image',
        order: 2,
      },
      // {
      //   id: 'voice',
      //   name: '语音合成',
      //   description: 'AI 语音合成相关接口',
      //   icon: 'audio',
      //   order: 2,
      // },

      // {
      //   id: 'video',
      //   name: '视频生成',
      //   description: 'AI 视频生成相关接口',
      //   icon: 'video',
      //   order: 3,
      // },
    ];
  }

  getAuthStrategies() {
    // 将在单独文件中实现，这里先返回空数组
    // 实际注册时会在 platform 模块中完成
    return [];
  }
}
