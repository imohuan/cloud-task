export const API_BASE =
  location.port && location.port !== "8080"
    ? `${location.protocol}//${location.hostname}:8080/api`
    : "/api";

export const CHAT_API_URL = API_BASE.startsWith("/")
  ? `${location.origin}${API_BASE}/chat`
  : `${API_BASE}/chat`;

  
// app.use(LangChainPlugin, { apiUrl: `https://www.imohuan.shop/api/chat` });
// const LOCAL_AGENT_SERVER_URL = `${window.location.origin}/api/langgraph`;
// app.use(LangChainPlugin, { apiUrl: LOCAL_AGENT_SERVER_URL });