// frontend/js/requests/requests.js

// Базовый URL твоего бэкенда на Render.
const API_BASE = ('https://tma-cafe-backend.onrender.com').replace(/\/+$/, '');

// Нормализуем путь: гарантируем ведущий слэш.
function url(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Обёртка вокруг fetch с автоповтором.
 * retries — сколько раз пробуем (всего попыток = retries + 1).
 */
async function fetchWithRetry(path, options = {}, retries = 2) {
  const fullUrl = url(path);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(fullUrl, {
        // по умолчанию GET
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        credentials: 'omit',
      });

      const text = await res.text();
      const contentType = res.headers.get('content-type') || '';

      // Если ответ неуспешный — бросаем ошибку (её поймает внешний код)
      if (!res.ok) {
        let message = text;
        if (contentType.includes('application/json')) {
          try {
            const json = JSON.parse(text || '{}');
            message = JSON.stringify(json);
          } catch (_) {}
        }

        throw new Error(
          `${options.method || 'GET'} ${path} failed: ${res.status} ${message}`
        );
      }

      // Если JSON
      if (contentType.includes('application/json')) {
        return JSON.parse(text || 'null');
      }

      // если не JSON — просто отдадим текст
      return text;
    } catch (err) {
      // последняя попытка — пробрасываем ошибку наружу
      if (attempt === retries) {
        console.error(`[fetchWithRetry] ${options.method || 'GET'} ${path} failed`, err);
        throw err;
      }
      // небольшая пауза перед повтором (100ms)
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

// ------ публичные функции ------

// Универсальный GET, как в оригинальном проекте
export async function get(path) {
  return fetchWithRetry(path, { method: 'GET' });
}

// Универсальный POST JSON
export async function post(path, payload) {
  return fetchWithRetry(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
    }
  );
}

// Доп. «говорящие» функции, если где-то захочешь использовать
export function getInfo() {
  return get('/info');
}

export function getCategories() {
  return get('/categories');
}

export function getPopularMenu() {
  return get('/menu/popular');
}

export function postOrder(payload) {
  return post('/order', payload);
}
