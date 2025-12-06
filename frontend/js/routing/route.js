// frontend/js/routing/route.js
class Route {
  /**
   * @param {string} name     "main" | "category" | "details" | "cart"
   * @param {string} htmlPath Абсолютный путь к HTML, напр. "/pages/main.html"
   */
  constructor(name, htmlPath) {
    this.name = name;
    this.htmlPath = htmlPath;
    this.node = null;
  }

  async beforeEnter() {}
  async afterEnter() {}
  async beforeLeave() {}
  async afterLeave() {}
  async load() {}

  async fetchHtml() {
    if (!this.htmlPath) {
      throw new Error(`[Route] htmlPath is not set for "${this.name}"`);
    }
    const url = new URL(this.htmlPath, location.origin).toString();
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(
        `[Route] Failed to load HTML for "${this.name}": ${res.status} ${res.statusText} (${url})`
      );
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