import request, { API_BASE } from "@/utils/request";
export { API_BASE };

export const authApi = {
  login: (password: string) => request.post("/auth/login", { password }),
  getSession: () => request.get("/auth/session"),
};

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
  fetchModels: (data: { platformId: string; authStrategyId: string; credentials: Record<string, any> }) =>
    request.post("/auth-profiles/fetch-models", data),
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
  cancelTask: (taskId: string) => request.post(`/tasks/${taskId}/cancel`),
  deleteTask: (taskId: string) => request.delete(`/tasks/${taskId}`),
  batchDeleteTasks: (ids: string[]) => request.delete("/tasks", { data: { ids } }),
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
  getByTime: (params: {
    startTime: number;
    endTime?: number;
    offsetMinutes?: number;
    search?: string;
    exclude?: string;
    levels?: string;
    lines?: number;
  }) => request.get("/logs/by-time", { params }),
};
