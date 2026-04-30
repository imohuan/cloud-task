import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import MainLayout from "@/layouts/MainLayout.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    component: MainLayout,
    children: [
      {
        path: "",
        redirect: { name: "welcome" },
      },
      {
        path: "welcome",
        name: "welcome",
        component: () => import("@/modules/dashboard/pages/WelcomePage.vue"),
      },
      {
        path: "tasks",
        name: "tasks",
        component: () => import("@/modules/task/pages/TaskCenterPage.vue"),
      },
      {
        path: "auth",
        name: "auth",
        component: () => import("@/modules/auth/pages/AuthManagerPage.vue"),
      },
      {
        path: "generator",
        name: "generator",
        component: () => import("@/modules/chat/components/GeneratorPage.vue"),
      },
      {
        path: "api",
        name: "api",
        component: () => import("@/modules/api/pages/ApiFormPage.vue"),
      },
      {
        path: "icons",
        name: "Icons",
        component: () => import("@/modules/icons/pages/IconsPage.vue"),
      },
    ],
  },
  {
    path: "/logs",
    name: "Logs",
    component: () => import("@/modules/log/pages/LogsPage.vue"),
  },
  {
    path: "/test",
    name: "test",
    component: () => import("@/modules/test/pages/TestIndexPage.vue"),
    children: [
      {
        path: "toast",
        name: "test-toast",
        component: () => import("@/modules/test/pages/ToastTestPage.vue"),
      },
      {
        path: "sse",
        name: "test-sse",
        component: () => import("@/modules/test/pages/SseTestPage.vue"),
      },
      {
        path: "task-item",
        name: "test-task-item",
        component: () => import("@/modules/test/pages/TaskItemTestPage.vue"),
      },
      {
        path: "comark",
        name: "test-comark",
        component: () => import("@/modules/test/pages/ComarkTestPage.vue"),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
