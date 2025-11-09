// frontend/js/requests/requests.js

// Базовый URL твоего бэкенда на Render.
// Без завершающего слэша — ниже мы сами добавим его при сборке URL.
const API_BASE = ('https://tma-cafe-backend.onrender.com').replace(/\/+$/, '');

// Нормализуем путь: гарантируем ведущий слэш.
function url(path) {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

// GET JSON
export async function get(path) {
  const res = await fetch(url(path), {
    method: 'GET',
    credentials: 'omit',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${t}`);
  }
  return res.json();
}

// POST JSON
export async function post(path, payload) {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
    credentials: 'omit',
  });

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.text();
    throw new Error(`POST ${path} expected JSON, got: ${t}`);
  }
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

// Удобная обёртка для создания инвойса
// cartItems — массив позиций корзины, _auth — initData из Telegram
export function createOrder(cartItems, _auth) {
  return post('/order', { cartItems, _auth });
}

// Также даём дефолтный экспорт на всякий случай,
// если где-то в коде импортировали "по умолчанию".
export default { get, post, createOrder };
