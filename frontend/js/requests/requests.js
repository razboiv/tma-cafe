// frontend/js/requests/requests.js

// Базовый URL бэкенда на Render (без завершающего /)
const API_BASE = ('https://tma-cafe-backend.onrender.com').replace(/\/+$/, '');

// Собираем абсолютный URL
function makeUrl(path) {
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

// Универсальный fetch с ретраями и проверкой JSON
async function fetchWithRetry(path, options = {}, retries = 2, backoffMs = 500) {
  const url = makeUrl(path);
  try {
    const res = await fetch(url, { credentials: 'omit', ...options });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${text}`);
    }

    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text().catch(() => '');
      throw new Error(`${options.method || 'GET'} ${path} expected JSON, got: ${text}`);
    }

    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, backoffMs));
      return fetchWithRetry(path, options, retries - 1, backoffMs * 2);
    }
    throw err;
  }
}

/* -------- Старые совместимые API (для текущих страниц) -------- */
export async function get(path) {
  return fetchWithRetry(path, { method: 'GET' });
}

export async function post(path, payload) {
  return fetchWithRetry(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {})
  });
}

/* -------- Новые удобные шорткаты (можно использовать в новом коде) -------- */
export const getInfo = () => get('/info');
export const getCategories = () => get('/categories');
export const getPopularMenu = () => get('/menu/popular');
