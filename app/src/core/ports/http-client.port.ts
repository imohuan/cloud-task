/**
 * HTTP 客户端端口
 * 用于发起 HTTP 请求（可替换为 fetch、axios 等）
 */
export interface HttpClientPort {
  /**
   * 发起 HTTP 请求
   */
  request<T = any>(config: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string | number | boolean>;
    body?: any;
    timeout?: number;
  }): Promise<{
    status: number;
    headers: Record<string, string>;
    data: T;
  }>;
}
