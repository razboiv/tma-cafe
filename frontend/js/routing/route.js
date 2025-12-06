// frontend/js/routing/route.js

// Экспортируем и default, и именованный Route — чтобы работало и
// import Route from "../routing/route.js"
// и import { Route } from "../routing/route.js"
class Route {
  /**
   * @param {string} name   имя роута ("main", "category", "details", "cart")
   * @param {string} htmlPath относительный путь к HTML (например "/pages/main.html")
   */
  constructor(name, htmlPath) {
    this.name = name;
    this.htmlPath = htmlPath;
    this.node = null;
  }

  // хуки при желании можно переопределять в страницах
  async beforeEnter(/*params*/) {}
  async afterEnter(/*params*/) {}
  async beforeLeave(/*params*/) {}
  async afterLeave(/*params*/) {}

  // будет вызвано после монтирования HTML
  async load(/*params*/) {}

  async fetchHtml() {
    if (!this.htmlPath) {
      throw new Error(`[Route] htmlPath is not set for "${this.name}"`);
    }
    const url = new URL(this.htmlPath, location.origin).toString();
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`[Route] Failed to load HTML for "${this.name}": ${res.status} ${res.statusText} (${url})`);
    }
    return await res.text();
  }

  mount(container, html) {
    container.innerHTML = html;
    this.node = container;
  }
}

export { Route };
export default Route;