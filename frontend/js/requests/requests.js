const baseUrl = 'https://tma-cafe-backend.onrender.com';

export async function get(path) {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    return response.json();
}

export async function post(path, data = {}) {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return response.json();
}
