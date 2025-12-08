// frontend/js/requests/requests.js

// Абсолютный адрес бэкенда (по умолчанию — Railway).
const DEFAULT_API_BASE = "https://web-production-razboiv.up.railway.app";

// Берём из ENV, если сборка это поддерживает (Next/Vercel), иначе — дефолт.
// Если в ENV придёт относительный путь, приклеим его к origin фронта.
const envBase =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.NEXT_PUBLIC_BACKEND_URL) ||
  DEFAULT_API_BASE;

const API_BASE = (/^https?:\/\//i.test(envBase)
  ? envBase
  : (window.location.origin + "/" + envBase.replace(/^\/+/, ""))
).replace(/\/+$/, "");

// Собираем полный URL.
function url(path) {
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Базовый helper с автоповтором и проверкой JSON.
async function fetchWithRetry(path, options = {}, retries = 2) {
  const target = url(path);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(target, options);
      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");

      const data = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        const msg =
          isJson && data && typeof data === "object" && data.message
            ? data.message
            : data;
        throw new Error(
          `${options.method || "GET"} ${path} failed: ${res.status} ${msg}`
        );
      }

      if (!isJson) {
        throw new Error(
          `${options.method || "GET"} ${path} expected JSON, got: ${data}`
        );
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt < retries) continue;
    }
  }
  throw lastError;
}

// ===== Публичные функции, которые импортирует фронт =====

export function getInfo() {
  return fetchWithRetry("/info");
}

export function getCategories() {
  return fetchWithRetry("/categories");
}

export function getPopularMenu() {
  return fetchWithRetry("/menu/popular");
}

export function getMenuCategory(categoryId) {
  return fetchWithRetry(`/menu/${encodeURIComponent(categoryId)}`);
}

export function getMenuItem(itemId) {
  return fetchWithRetry(`/menu/details/${encodeURIComponent(itemId)}`);
}

export function createOrder(payload) {
  return fetchWithRetry("/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
}