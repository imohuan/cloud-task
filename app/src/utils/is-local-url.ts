/**
 * 判断 URL 是否指向本地/私有网络
 *
 * 用于在调用第三方 API 前判断参考资源 URL 是否对外不可访问，
 * 不可访问时调用方需自行下载并转为 base64 / 上传转存。
 */
import isIpPrivate from 'private-ip';

/**
 * 判断 URL 的 host 是否为本地/私有网络地址。
 *
 * 命中规则（任一即返回 true）：
 * - hostname 为 `localhost`
 * - hostname 以 `.local` 结尾（mDNS 域名）
 * - hostname 是 IPv4/IPv6 的私有 / 回环 / 链路本地地址（由 `private-ip` 判定）
 *
 * 非法 URL、`data:` / `file:` 等非 http(s) URL 一律返回 false
 * （调用方应在外层先做协议过滤）。
 *
 * @example
 * isLocalOrPrivateUrl('http://localhost/img.jpg')        // true
 * isLocalOrPrivateUrl('http://192.168.1.1/img.jpg')      // true
 * isLocalOrPrivateUrl('http://[::1]/img.jpg')            // true
 * isLocalOrPrivateUrl('https://example.com/img.jpg')     // false
 */
export function isLocalOrPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
    // IPv6 host 在 URL.hostname 中带方括号（如 "[::1]"），需要剥离后再判断
    const ip = hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
    return isIpPrivate(ip) === true;
  } catch {
    return false;
  }
}
