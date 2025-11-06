// frontend/js/requests/requests.js

// Укажи БЕЗ завершающего слеша
const baseUrl = 'https://tma-cafe-backend.onrender.com';

/**
 * GET helper
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,   // endpoint с ведущим '/', напр. '/info'
    dataType: 'json',
    success: result => onSuccess(result)
  });
}

/**
 * POST helper
 * data — обычный JS-объект (мы сами его сериализуем в JSON)
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: 'POST',
    url: baseUrl + endpoint,   // endpoint с ведущим '/', напр. '/order'
    data: JSON.stringify(data),
    contentType: 'application/json; charset=utf-8',
    dataType: 'json',
    success: result => onResult({ ok: true, data: result }),
    error: xhr => {
      // Пытаемся показать JSON-ошибку от бэка
      let msg = 'Something went wrong.';
      try {
        if (xhr.responseJSON && xhr.responseJSON.message) {
          msg = xhr.responseJSON.message;
        } else if (xhr.responseText) {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed && parsed.message) msg = parsed.message;
        }
      } catch (e) {}
      onResult({ ok: false, error: msg });
    }
  });
}
