const baseUrl = 'https://tma-cafe-backend.onrender.com'; // без завершающего '/'

export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,        // пример: '/order'
    data: JSON.stringify(data),     // JSON-строка
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    processData: false,
    success: (result) => onResult({ ok: true, data: result }),
    error: (xhr) => {
      let err = 'Something went wrong.';
      try { err = xhr.responseJSON?.message || err; } catch(_) {}
      onResult({ ok: false, error: err });
    },
  });
}
