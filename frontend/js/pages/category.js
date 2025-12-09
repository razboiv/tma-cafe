// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import { TelegramSDK } from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();
    this.updateMainButton();

    // 1) распарсим параметры (строка/объект), примем id | categoryId | slug
    let p = {};
    try {
      p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {});
    } catch (_) { p = params || {}; }

    const categoryId = p.categoryId || p.id || p.slug;
    if (!categoryId || typeof categoryId !== "string") {
      console.error("[CategoryPage] no valid id in params:", params);
      navigateTo("root");
      return;
    }

    // 2) запросим список блюд
    const items = await getMenuCategory(categoryId);
    console.log("[CategoryPage] items", items);

    // 3) контейнер и отрисовка без utils/dom.js
    const root = document.querySelector("#cafe-category");
    if (!root) return;

    // очистим «скелетоны»
    root.innerHTML = "";

    (Array.isArray(items) ? items : []).forEach((item) => {
      const el = document.createElement("div");
      el.className = "cafe-item-container";

      // картинка
      const img = document.createElement("img");
      img.className = "cafe-item-image shimmer";
      img.alt = "";
      img.src = (item.image || item.photo || "").trim();
      img.addEventListener("load", () => img.classList.remove("shimmer"));

      // заголовок
      const title = document.createElement("h6");
      title.className = "cafe-item-name";
      title.textContent = item.name || "";

      // подпись
      const desc = document.createElement("p");
      desc.className = "small cafe-item-description";
      desc.textContent = item.description || item.short || "";

      el.appendChild(img);
      el.appendChild(title);
      el.appendChild(desc);

      // переход на детали; пробрасываем categoryId
      el.addEventListener("click", () =>
        navigateTo("details", { id: String(item.id), categoryId })
      );

      root.appendChild(el);
    });
  }

  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count} POSITIONS`, () =>
        navigateTo("cart")
      );
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }
}
export { CategoryPage };