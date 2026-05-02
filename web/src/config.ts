export const API_BASE =
  location.port && location.port !== "8080"
    ? `${location.protocol}//${location.hostname}:8080/api`
    : "/api";

export const CHAT_API_URL = API_BASE.startsWith("/")
  ? `${location.origin}${API_BASE}/chat`
  : `${API_BASE}/chat`;

  
const _proxyBaseUrl = `${API_BASE}/upload/proxy?url={{url}}&retries=5&retryDelay=500&timeout=15000&maxRetries=5&maxRetryDelay=2000&minTimeout=2000&maxTimeout=20000&type=resource`
const _proxyOrigin = new URL(_proxyBaseUrl).protocol + "//" + new URL(_proxyBaseUrl).hostname

export function getProxyImageUrl(src: string): string {
  if (!src.startsWith("http")) return src
  if (src.startsWith(_proxyOrigin)) return src
  return _proxyBaseUrl.replace("{{url}}", encodeURIComponent(src))
}

// app.use(LangChainPlugin, { apiUrl: `https://www.imohuan.shop/api/chat` });
// const LOCAL_AGENT_SERVER_URL = `${window.location.origin}/api/langgraph`;
// app.use(LangChainPlugin, { apiUrl: LOCAL_AGENT_SERVER_URL });