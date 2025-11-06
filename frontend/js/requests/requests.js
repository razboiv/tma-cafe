// Set base URL of your backend.
// Без завершающего слеша!
const baseUrl = 'https://tma-cafe-backend.onrender.com';

/**
 * Performs GET request.
 * @param {string} endpoint e.g. '/info'
 * @param {*} onSuccess callback
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,
    dataType: 'json',
    success: (result) => onSuccess(result),
  });
}

/**
 * Performs POST request (JSON).
 * @param {string} endpoint e.g. '/order'
 * @param {object} data plain object (мы сами сериализуем в JSON)
 * @param {*} onResult callback({ ok, data? , error? })
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,
    data: JSON.stringify(data),          // <<< главное изменение
    processData: false,                  // не превращать объект в query-string
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      let msg =
        (xhr.responseJSON && xhr.responseJSON.message) ||
        xhr.statusText ||
        'Something went wrong.';
      onResult({ ok: false, error: msg });
    },
  });
}
