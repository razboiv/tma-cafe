// frontend/js/requests/requests.js

// Базовый URL бэкенда на Render (без завершающего /)
const API_BASE = 'https://tma-cafe-backend.onrender.com'.replace(/\/+$/, '');

// Нормализуем путь
function url(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

// Универсальная функция с автоповтором
async function fetchWithRetry(method, path, body, tries = 3, delayMs = 800) {
  const target = url(path);

  let lastError;

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(target, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body != null ? JSON.stringify(body) : undefined,
        credentials: 'omit',
      });

      const ct = res.headers.get('content-type') || '';

      if (!ct.includes('application/json')) {
        const text = await res.text();
        throw new Error(`${method} ${path} expected JSON, got: ${ct} ${text.slice(0, 120)}`);
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(`${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
      }

      return json;
    } catch (err) {
      lastError = err;
      console.error(`Request ${method} ${path} attempt ${attempt} failed:`, err);

      if (attempt === tries) break;

      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  throw lastError || new Error(`Request ${method} ${path} failed`);
}

// Публичные функции

export async function get(path) {
  return fetchWithRetry('GET', path, null);
}

export async function post(path, payload) {
  return fetchWithRetry('POST', path, payload);
}
