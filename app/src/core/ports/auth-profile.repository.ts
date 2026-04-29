import type { AuthProfile } from '@core/contracts/auth.types';

/**
 * 认证配置仓储端口
 */
export interface AuthProfileRepository {
  /**
   * 根据 ID 获取认证配置
   */
  findById(id: string): Promise<AuthProfile | null>;

  /**
   * 根据平台 ID 获取所有认证配置
   */
  findByPlatformId(platformId: string): Promise<AuthProfile[]>;

  /**
   * 根据名称获取认证配置
   */
  findByName(name: string): Promise<AuthProfile | null>;

  /**
   * 创建认证配置
   */
  create(profile: Omit<AuthProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuthProfile>;

  /**
   * 更新认证配置
   */
  update(id: string, profile: Partial<AuthProfile>): Promise<AuthProfile>;

  /**
   * 删除认证配置
   */
  delete(id: string): Promise<void>;
}
