// frontend/js/requests/requests.js

// Базовый URL бэкенда на Render.
const API_BASE = "web-production-razboiv.up.railway.app".replace(/\/+$/, "");

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

      let data;
      if (isJson) {
        data = await res.json();
      } else {
        data = await res.text();
      }

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

      // Успешный JSON-ответ
      return data;
    } catch (err) {
      lastError = err;
      // если есть ещё попытки — пробуем ещё раз
      if (attempt < retries) {
        continue;
      }
    }
  }

  // Если все попытки провалились — кидаем последнюю ошибку
  throw lastError;
}

// ===== Публичные функции, которые импортирует фронт =====

// /info
export function getInfo() {
  return fetchWithRetry("/info");
}

// /categories
export function getCategories() {
  return fetchWithRetry("/categories");
}

// /menu/popular
export function getPopularMenu() {
  return fetchWithRetry("/menu/popular");
}

// /menu/<categoryId> (burgers, pizza, pasta, coffee, ice-cream)
export function getMenuCategory(categoryId) {
  return fetchWithRetry(`/menu/${encodeURIComponent(categoryId)}`);
}

// /menu/details/<itemId> (burger-1, pizza-2 и т.п.)
export function getMenuItem(itemId) {
  return fetchWithRetry(`/menu/details/${encodeURIComponent(itemId)}`);
}

// POST /order
export function createOrder(payload) {
  return fetchWithRetry("/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
}
