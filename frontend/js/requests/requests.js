// public/js/requests/requests.js

// Базовый URL бэкенда (без завершающего слеша!)
const baseUrl = 'https://tma-cafe-backend.onrender.com';

/**
 * GET
 * @param {string} endpoint - например, '/info'
 * @param {function} onSuccess
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,
    dataType: 'json',
    cache: false,
    success: (result) => onSuccess(result),
    error: (xhr) => {
      console.error('GET error', endpoint, xhr);
      onSuccess({ ok: false, error: xhr.responseJSON?.message || xhr.responseText || 'Something went wrong.' });
    },
  });
}

/**
 * POST JSON
 * @param {string} endpoint - например, '/order'
 * @param {object} data - тело запроса (JS-объект)
 * @param {function} onResult - колбэк
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,
    data: JSON.stringify(data),
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    processData: false, // важно для jQuery, чтобы не перекодировал объект
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      const text = xhr?.responseJSON?.message || xhr?.responseText || 'Something went wrong.';
      console.error('POST error', endpoint, text, xhr);
      onResult({ ok: false, error: text });
    },
  });
}
