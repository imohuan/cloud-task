/**
 * 任务状态
 */
export type TaskStatus =
  | 'pending'      // 等待执行
  | 'running'      // 执行中（普通任务）
  | 'polling'      // 等待第三方异步结果，需要定时轮询
  | 'polling-run'  // 轮询任务正在执行中
  | 'completed'    // 已完成
  | 'failed'       // 失败
  | 'timeout';     // 超时

/**
 * 单次 API 调用日志
 */
export interface ApiCallLog {
  /** 调用序号 */
  index: number;
  /** 调用阶段名称（如：认证、生成、查询） */
  phase: string;
  /** 请求方法 */
  method: string;
  /** 请求 URL */
  url: string;
  /** 请求头（脱敏后） */
  headers?: Record<string, string>;
  /** 请求体 */
  requestBody?: Record<string, any>;
  /** 响应状态码 */
  statusCode?: number;
  /** 响应体 */
  responseBody?: Record<string, any> | string;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 调用时间 */
  timestamp: string;
}

/**
 * 任务运行记录
 */
export interface TaskRun {
  id: string;
  /** API ID */
  apiId: string;
  /** 认证配置 ID */
  authProfileId: string;
  /** 任务状态 */
  status: TaskStatus;
  /** 输入参数 */
  input: Record<string, any>;
  /** 输出结果 */
  output?: Record<string, any>;
  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** 进度（0-100） */
  progress?: number;
  /** 创建时间 */
  createdAt: Date;
  /** 开始执行时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 重试次数 */
  retryCount: number;
  /** 执行主机信息（用于区分多环境） */
  workerInfo?: {
    hostname: string;
    pid: number;
    platform: string;
    arch: string;
    nodeVersion: string;
    env: string;
  };
  /** API 调用日志（每次第三方请求/响应的完整记录） */
  apiCallLogs: ApiCallLog[];
  /** 是否已删除（软删除） */
  deleted?: boolean;
}

export type QueueTask = {
  id: string;
  apiId: string;
  authProfileId: string;
  input: Record<string, any>;
  retryCount: number;
};

/**
 * 任务运行仓储端口
 */
export interface TaskRunRepository {
  /**
   * 根据 ID 获取任务
   */
  findById(id: string): Promise<TaskRun | null>;

  /**
   * 创建任务
   */
  create(task: Omit<TaskRun, 'id' | 'createdAt' | 'retryCount'>): Promise<TaskRun>;

  /**
   * 更新任务状态
   */
  updateStatus(
    id: string,
    status: TaskStatus,
    updates?: Partial<Pick<TaskRun, 'output' | 'error' | 'progress' | 'completedAt' | 'startedAt' | 'workerInfo' | 'apiCallLogs'>> & { nextPollAt?: Date }
  ): Promise<TaskRun>;

  /**
   * 根据多个 ID 批量获取任务
   */
  findByIds(ids: string[]): Promise<TaskRun[]>;

  /**
   * 分页查询任务列表（支持状态、关键字、时间范围过滤）
   */
  queryTasks(filters: {
    status?: TaskStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ tasks: TaskRun[]; total: number; page: number; pageSize: number }>;

  /**
   * 获取待执行的任务列表（用于 worker 拉取）
   */
  getPendingTasks(limit?: number): Promise<TaskRun[]>;

  /**
   * 增加重试次数
   */
  incrementRetryCount(id: string): Promise<void>;

  /**
   * 【Worker】原子性竞争获取下一个待执行任务
   * 同时获取 pending 任务 和 已到期的 polling 任务
   */
  claimNextTask(workerInfo: Record<string, any>): Promise<QueueTask | null>;

  /**
   * 【Worker】释放超时未完成的任务（重新入队或标记失败）
   */
  releaseStaleTasks(timeoutSec: number, maxAttempts: number): Promise<{ released: number; failed: number }>;

  /**
   * 【Worker】处理任务执行失败
   */
  handleTaskError(task: QueueTask, error: any, maxAttempts: number): Promise<void>;

  /**
   * 软删除任务（标记为已删除，不物理删除）
   */
  softDelete(id: string): Promise<void>;

  /**
   * 批量软删除任务
   */
  softDeleteMany(ids: string[]): Promise<number>;

  /**
   * 获取任务统计
   */
  getTaskStats(): Promise<{ total: number; statusCounts: Record<string, number> }>;

  /**
   * 获取任务分析数据（用于数据看板）
   */
  getTaskAnalytics(days?: number): Promise<{
    dailyTrend: Array<{ date: string; total: number; completed: number; failed: number }>;
    topApis: Array<{ apiId: string; count: number }>;
    avgDurationMs: number | null;
    totalRetries: number;
  }>;
}
