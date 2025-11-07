// frontend/js/requests/requests.js

// БЕЗ завершающего слеша!
const baseUrl = 'https://tma-cafe-backend.onrender.com';

/**
 * GET
 * @param {string} endpoint - например '/info'
 * @param {Function} onSuccess
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,
    dataType: 'json',
    success: (result) => onSuccess(result),
    error: () => onSuccess({ ok: false, error: 'Network error' })
  });
}

/**
 * POST
 * @param {string} endpoint - например '/order'
 * @param {Object} data - тело запроса (JS-объект)
 * @param {Function} onResult
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,
    data: JSON.stringify(data),                        // отправляем JSON-строку
    contentType: 'application/json; charset=utf-8',   // говорим серверу, что это JSON
    dataType: 'json',                                  // ожидаем JSON в ответе
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      // попробуем достать сообщение об ошибке из JSON
      try {
        const parsed = JSON.parse(xhr.responseText);
        return onResult({ ok: false, error: parsed.message || 'Something went wrong.' });
      } catch (_) {
        return onResult({ ok: false, error: 'Something went wrong.' });
      }
    }
  });
}
