// ✅ Base URL твоего backend без последнего слэша
const baseUrl = "https://tma-cafe-backend.onrender.com";

/**
 * GET запрос
 */
export function get(endpoint, onSuccess) {
  $.ajax({
    url: baseUrl + endpoint,
    dataType: "json",
    success: (result) => onSuccess(result),
  });
}

/**
 * POST запрос (JSON) — корректная отправка
 */
export function post(endpoint, data, onResult) {
  $.ajax({
    type: "POST",
    url: baseUrl + endpoint,
    data: JSON.stringify(data),              // ✅ Отправляем как JSON строку
    contentType: "application/json; charset=UTF-8", // ✅ Указываем JSON
    dataType: "json",                        // ✅ Ждём JSON в ответ
    processData: false,                      // ✅ Не превращать тело в form-data
    success: (result) => {
      onResult({ ok: true, data: result });
    },
    error: (xhr) => {
      const msg =
        (xhr.responseJSON && xhr.responseJSON.message) ||
        xhr.responseText ||
        "Something went wrong";
      onResult({ ok: false, error: msg });
    },
  });
}
