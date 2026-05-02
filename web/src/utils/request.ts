import axios from "axios";
import { API_BASE } from "@/config";

export { API_BASE };

const request = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

request.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

request.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data && data.success === false) {
      const errorInfo = data.error || {};
      const message = (typeof errorInfo === "string" ? errorInfo : errorInfo.message) || "请求失败";
      const code = typeof errorInfo === "object" ? errorInfo.code : undefined;
      const err = new Error(message) as Error & { code?: string | number; response?: { data: unknown } };
      err.code = code;
      err.response = { data };
      return Promise.reject(err);
    }
    return data;
  },
  (error) => {
    const message = error.response?.data?.error?.message || error.response?.data?.error || error.message || "请求失败";
    const code = error.response?.data?.error?.code || error.response?.status;

    error.message = typeof message === "string" ? message : "请求失败";
    error.code = code;

    window.dispatchEvent(
      new CustomEvent("api-error", {
        detail: { message: error.message, code },
      }),
    );

    return Promise.reject(error);
  },
);

export default request;
