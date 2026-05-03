const _API_BASE: string = `${import.meta.env.VITE_API_BASE_URL || ""}/api`;
export const API_BASE: string = _API_BASE.startsWith("http") ? _API_BASE : `${location.origin}${_API_BASE}`
const API_ORIGIN = new URL(API_BASE).protocol + "//" + new URL(API_BASE).hostname

export const CHAT_API_URL = `${API_BASE}/chat`

const _proxyBaseUrl = `${API_BASE}/upload/proxy?url={{url}}&type=resource`

export function getProxyImageUrl(src: string): string {
  if (!src.startsWith("http")) return src
  if (src.startsWith(API_ORIGIN)) return src
  return _proxyBaseUrl.replace("{{url}}", encodeURIComponent(src))
}

export function getImageUrl(src: string): string {
  return src.startsWith("http") ? src : `${API_BASE.replace("/api", "")}${src}`
}

// app.use(LangChainPlugin, { apiUrl: `https://www.imohuan.shop/api/chat` });
// const LOCAL_AGENT_SERVER_URL = `${window.location.origin}/api/langgraph`;
// app.use(LangChainPlugin, { apiUrl: LOCAL_AGENT_SERVER_URL });