const baseUrl = 'https://tma-cafe-backend.onrender.com';

export function get(endpoint, onSuccess) {
    $.ajax({
        url: baseUrl + endpoint,
        dataType: "json",
        success: result => onSuccess(result)
    });
}

export function post(endpoint, data, onResult) {
    $.ajax({
        type: 'POST',
        url: baseUrl + endpoint,
        data: JSON.stringify(data),
        contentType: 'application/json; charset=utf-8',
    dataType: 'json',
        success: result => onResult({ ok: true, data: result }),
        error: xhr => onResult({ ok: false, error: 'Something went wrong.' })
    });
}
