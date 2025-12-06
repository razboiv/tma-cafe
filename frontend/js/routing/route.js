// frontend/js/routing/route.js
class Route {
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
    if (!this.htmlPath) throw new Error(`[Route] htmlPath is not set for "${this.name}"`);
    const url = new URL(this.htmlPath, location.origin).toString();
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`[Route] Failed to load "${this.name}": ${res.status} ${res.statusText}`);
    return await res.text();
  }

  mount(container, html) {
    container.innerHTML = html;
    this.node = container;
  }
}
export { Route };       // ← именованный экспорт
export default Route;   // ← и дефолтный тоже