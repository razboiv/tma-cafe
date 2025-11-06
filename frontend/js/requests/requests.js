// Set base URL of your backend (без завершающего /)
const baseUrl = 'https://tma-cafe-backend.onrender.com';

/**
 * Performs GET request.
 * @param {string} endpoint  e.g. '/info'
 * @param {*} onSuccess      callback
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,
    dataType: 'json',
    success: (result) => onSuccess(result),
  });
}

/**
 * Performs POST request with JSON body.
 * @param {string} endpoint  e.g. '/order'
 * @param {string} data      JSON.stringify(body)
 * @param {*} onResult       callback -> { ok, data | error }
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,
    data: data, // уже JSON-строка
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      let msg = 'Something went wrong.';
      try {
        const parsed = JSON.parse(xhr.responseText || '{}');
        if (parsed.message) msg = parsed.message;
      } catch (_) {}
      onResult({ ok: false, error: msg });
    },
  });
}
