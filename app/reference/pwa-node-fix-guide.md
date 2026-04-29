# PWA 接入 Node 后台 —— 问题排查与解决方案

## 背景

前端（Vite + Vue）打包后放到 Elysia（Bun）后台的 `public/` 目录下，以静态文件形式托管。
PWA（`vite-plugin-pwa`）注册后出现以下两类报错，导致 Service Worker 始终无法正常激活：

```
// 错误 1（首次遇到）
TypeError: Failed to execute 'put' on 'Cache': Vary header contains *
  at A.cachePut (workbox-ffa4df14.js:1)

// 错误 2（修复错误 1 后出现）
bad-precaching-response :: [{"url":"http://localhost:8080/vite.svg","status":200}]
  at e._handleInstall (sw.js:1)
```

---

## 根本原因分析

### 原因 1：`Vary: *` 响应头与 Cache API 冲突

浏览器 Cache API 规范：**只要响应头包含 `Vary: *`，`cache.put()` 就会直接抛错**，无法缓存该响应。

Elysia 后台使用了 `@elysiajs/cors`（全局 CORS 中间件），该中间件会对所有响应（包括静态文件）附加 CORS 相关响应头，某些情况下会附带 `Vary: *`。

```
Service Worker → fetch 静态资源 → Node 服务器响应含 Vary: * → cache.put() 报错
```

### 原因 2：`generateSW` 模式不支持自定义函数插件

`vite-plugin-pwa` 默认的 `generateSW` 模式会把配置序列化后生成 SW 文件。
**Workbox 的 `generateSW` 无法序列化任意函数对象**，因此在 `vite.config.ts` 的 `runtimeCaching.options.plugins` 里写自定义函数是无效的。

### 原因 3：precaching 阶段 `return null` 会导致安装失败

Workbox v7 规范：
- **Runtime caching**：`cacheWillUpdate` 返回 `null` = 跳过缓存，完全合法
- **Precaching**：每个 manifest entry **必须**被成功写入 Cache。如果 `cacheWillUpdate` 返回 `null`，Workbox 检测到 entry 未入库，抛 `bad-precaching-response`，SW 整个安装失败

---

## 解决方案

### 1. 切换到 `injectManifest` 模式

修改 `web/vite.config.ts`，把 `generateSW` 换成 `injectManifest`，允许编写自定义 SW 文件：

```ts
// web/vite.config.ts
VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  strategies: "injectManifest",   // ← 关键
  srcDir: "src",
  filename: "sw.ts",
  injectManifest: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
    maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
  },
  manifest: { /* ... */ },
})
```

### 2. 编写自定义 SW 文件（`web/src/sw.ts`）

核心是 `stripVaryStarPlugin`——遇到 `Vary: *` 响应时，**剥掉该头部后再缓存**（而不是返回 `null` 跳过）：

```ts
// web/src/sw.ts
const stripVaryStarPlugin = {
  cacheWillUpdate: async ({ response }) => {
    if (!response || response.status !== 200) return null;
    if (response.headers.get('Vary')?.includes('*')) {
      // 剥掉 Vary: * 头，让 Cache API 接受该响应
      const headers = new Headers(response.headers);
      headers.delete('Vary');
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
};
```

Precaching 使用 `PrecacheController`（而非 `precacheAndRoute`），这样插件可以作用于安装阶段：

```ts
const precacheController = new PrecacheController({
  plugins: [stripVaryStarPlugin],
});
precacheController.addToCacheList(self.__WB_MANIFEST);

self.addEventListener('install', event => {
  (event as ExtendableEvent).waitUntil(
    precacheController.install(event as ExtendableEvent),
  );
});
self.addEventListener('activate', event => {
  (event as ExtendableEvent).waitUntil(
    precacheController.activate(event as ExtendableEvent),
  );
});

registerRoute(new PrecacheRoute(precacheController));
```

### 3. 为 `sw.js` 和 `manifest.webmanifest` 添加专属路由

在 Elysia 非编译模式（`staticPlugin` 托管静态文件）下，`sw.js` 可能被 `*` 兜底路由误当 `index.html` 返回，导致 SW 注册失败（浏览器拿到的是 HTML 而非 JS）。

在 `staticPlugin` 之前注册专属路由，确保：
- 返回正确内容
- `Cache-Control: no-cache`（SW 文件禁止 HTTP 长缓存，否则更新无法及时生效）

```ts
// app/src/adapters/http-elysia/index.ts（非编译模式分支）
app.get('/sw.js', () =>
  new Response(Bun.file(join(publicDir, 'sw.js')), {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, no-cache',
    },
  }),
);
app.get('/manifest.webmanifest', () =>
  new Response(Bun.file(join(publicDir, 'manifest.webmanifest')), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, no-cache',
    },
  }),
);
// 注意：以上两个路由必须在 app.use(staticPlugin(...)) 之前注册
```

### 4. TypeScript 配置分离

`sw.ts` 运行在 ServiceWorker 环境（`lib: WebWorker`），与主应用的 DOM 环境冲突。
需要把 `sw.ts` 从主 tsconfig 排除，并为其单独建一个配置：

```jsonc
// web/tsconfig.app.json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "exclude": ["src/sw.ts"]   // ← 排除 SW 文件
}
```

```jsonc
// web/tsconfig.sw.json（新建）
{
  "compilerOptions": {
    "lib": ["ESNext", "WebWorker"],   // ← WebWorker 环境
    "moduleResolution": "bundler",
    "strict": true
  },
  "include": ["src/sw.ts"]
}
```

---

## 依赖安装

`injectManifest` 模式需要手动安装 Workbox 子包：

```bash
# web/ 目录下
pnpm add -D workbox-core workbox-precaching workbox-routing workbox-strategies workbox-expiration
```

---

## 构建流程

```bash
# app/ 目录下，一条命令完成：
# 1. pnpm build（编译前端）
# 2. 清空 app/public/（保留 logs/）并复制 web/dist/
# 3. 重新生成 static-assets.ts（供 build:exe 使用）
pnpm build:web
```

脚本位于 `app/scripts/build-web.ts`。

---

## 文件变更清单

| 文件 | 变更内容 |
|---|---|
| `web/vite.config.ts` | `generateSW` → `injectManifest`，迁移 globPatterns 配置 |
| `web/src/sw.ts` | 新建自定义 SW，含 `stripVaryStarPlugin` + `PrecacheController` |
| `web/tsconfig.app.json` | 排除 `src/sw.ts` |
| `web/tsconfig.sw.json` | 新建，为 SW 提供 WebWorker 类型环境 |
| `web/tsconfig.json` | 添加 `tsconfig.sw.json` 引用 |
| `web/package.json` | 新增 workbox-* devDependencies |
| `app/src/adapters/http-elysia/index.ts` | 非编译模式：为 `sw.js` / `manifest.webmanifest` 添加 no-cache 路由 |
| `app/scripts/build-web.ts` | 新建一键构建脚本 |
| `app/package.json` | 新增 `build:web` 命令，更新 `build:exe` |
