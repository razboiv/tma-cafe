export async function apiRequest(route, payload = {}) {
    const url = `https://tma-cafe-backend.onrender.com/api/${route}`;

    const auth = window.Telegram.WebApp.initData || "";
    payload["_auth"] = auth;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        return data;
    } catch (err) {
        console.error("API error:", err);
        return { error: true };
    }
}

export const API = {
    info: (payload) => apiRequest("info", payload),
    categories: (payload) => apiRequest("categories", payload),
    cart: (payload) => apiRequest("cart", payload)
};
