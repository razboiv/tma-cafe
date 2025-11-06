// frontend/js/requests/requests.js

// Укажи адрес своего бэкенда БЕЗ завершающего слеша
const baseUrl = 'https://tma-cafe-backend.onrender.com';

/**
 * GET helper
 * @param {string} endpoint - например '/info'
 * @param {function} onSuccess
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,
    method: 'GET',
    dataType: 'json',
    success: (result) => onSuccess(result),
    error: (xhr) => {
      console.error('GET error', endpoint, xhr.status, xhr.responseText);
      onSuccess({ ok: false, error: 'Request failed' });
    }
  });
}

/**
 * POST helper
 * @param {string} endpoint - например '/order'
 * @param {object} data - тело запроса (обычный объект)
 * @param {function} onResult
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    url: baseUrl + endpoint,
    method: 'POST',
    data: JSON.stringify(data),                // СТРОГАЯ JSON-посылка
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      // Печатаем текст ошибки сервера (чтобы видеть сообщения из /order)
      const msg = xhr.responseJSON?.message || xhr.responseText || 'Something went wrong.';
      console.error('POST error', endpoint, xhr.status, msg);
      onResult({ ok: false, error: msg });
    }
  });
}
