// Set base URL depending on your environment.
// Don't forget to add it to allowed origins on backend.
const baseUrl = 'https://tma-cafe-backend.onrender.com'; // <-- без завершающего слеша

/** Performs GET request. */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,      // endpoint начинается со слеша, например '/info'
    dataType: 'json',
    success: (result) => onSuccess(result),
  });
}

/** Performs POST request. */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,      // endpoint: '/order'
    data: JSON.stringify(data),   // <-- ВАЖНО: сериализуем в JSON!
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    processData: false,           // <-- чтобы jQuery не трогал тело
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      // вытащим сообщение сервера, если есть
      const msg =
        (xhr.responseJSON && (xhr.responseJSON.message || xhr.responseJSON.error)) ||
        'Something went wrong.';
      onResult({ ok: false, error: msg });
    },
  });
}
