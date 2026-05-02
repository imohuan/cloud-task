import request, { API_BASE } from "@/utils/request";
export { API_BASE };

export const registryApi = {
  getAll: () => request.get("/registry/all"),
  getApiDetail: (apiId: string) => request.get(`/registry/apis/${apiId}`),
  batchGetApiNames: (apiIds: string[]) => request.post("/registry/apis/batch", { apiIds }),
};

export const authProfileApi = {
  getProfiles: () => request.get("/auth-profiles"),
  getProfile: (id: string) => request.get(`/auth-profiles/${id}`),
  createProfile: (data: unknown) => request.post("/auth-profiles", data),
  updateProfile: (id: string, data: unknown) => request.put(`/auth-profiles/${id}`, data),
  deleteProfile: (id: string) => request.delete(`/auth-profiles/${id}`),
};

export const taskApi = {
  createTask: (apiId: string, authProfileId: string, input: unknown) =>
    request.post("/tasks", { apiId, authProfileId, input }),
  getTask: (taskId: string) => request.get(`/tasks/${taskId}`),
  getTasksByIds: (ids: string[]) => request.post("/tasks/batch", { ids }),
  getTasks: (params?: {
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) => request.get("/tasks", { params }),
  getTaskStats: () => request.get("/tasks/stats"),
  getTaskAnalytics: (days?: number) => request.get("/tasks/analytics", { params: days ? { days } : undefined }),
  deleteTask: (taskId: string) => request.delete(`/tasks/${taskId}`),
  batchDeleteTasks: (ids: string[]) => request.delete("/tasks", { data: { ids } }),
};

export interface ThreadSearchParams {
  ids?: string[];
  metadata?: Record<string, unknown>;
  values?: Record<string, unknown>;
  status?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  select?: string[];
  extract?: Record<string, unknown>;
}

export interface ThreadItem {
  thread_id: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
  values?: Record<string, unknown>;
}

export const agentApi = {
  searchThreads: (params?: ThreadSearchParams) =>
    request.post<unknown, ThreadItem[]>("/chat/threads/search", {
      ids: [],
      metadata: {},
      values: {},
      status: "idle",
      limit: 10,
      offset: 0,
      sort_by: "thread_id",
      sort_order: "asc",
      select: ["thread_id", "metadata", "created_at", "updated_at"],
      extract: {},
      ...params,
    }),
  getThreadState: (threadId: string) =>
    request.get(`/chat/threads/${threadId}/state`),
};

export const invokeApi = {
  invokeSync: (apiId: string, authProfileId: string, input: unknown) =>
    request.post(`/invoke/${apiId}`, { authProfileId, input }),
};

export const logApi = {
  getFiles: () => request.get("/logs"),
  getContent: (
    name: string,
    params?: { lines?: number; offset?: number; after?: number; search?: string; exclude?: string; levels?: string },
  ) => request.get(`/logs/${name}`, { params }),
  getStatus: (name: string, params?: { search?: string; exclude?: string; levels?: string }) =>
    request.get(`/logs/status/${name}`, { params }),
};
