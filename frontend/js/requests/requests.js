// frontend/js/requests.js

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay));
        console.log("🔄 Retrying...");
      } else {
        throw err;
      }
    }
  }
}

// Пример использования
const API_URL = "https://tma-cafe-backend.onrender.com";

export async function getInfo() {
  return fetchWithRetry(`${API_URL}/info`);
}

export async function getCategories() {
  return fetchWithRetry(`${API_URL}/categories`);
}

export async function getPopularMenu() {
  return fetchWithRetry(`${API_URL}/menu/popular`);
}
