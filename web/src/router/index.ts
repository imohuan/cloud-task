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
        name: "Home",
        component: { render: () => null },
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
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
