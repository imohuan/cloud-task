import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import { LangChainPlugin } from "@langchain/vue";


import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router/index";
import App from "./App.vue";
import "./style.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@xterm/xterm/css/xterm.css";
import { API_BASE } from "./api";

const app = createApp(App);

app.use(createPinia());
const chatApiUrl = API_BASE.startsWith('/') ? `${location.origin}${API_BASE}/chat` : `${API_BASE}/chat`;
app.use(LangChainPlugin, { apiUrl: chatApiUrl });
// app.use(LangChainPlugin, { apiUrl: `https://www.imohuan.shop/api/chat` });
// const LOCAL_AGENT_SERVER_URL = `${window.location.origin}/api/langgraph`;
// app.use(LangChainPlugin, { apiUrl: LOCAL_AGENT_SERVER_URL });
app.use(router);

app.mount("#app");
