// frontend/js/pages/category.js

import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
    this._clickHandler = null; // чтобы не плодить обработчики
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();

    // 1) Кнопка внизу: показываем, если в корзине что-то есть
    this.#syncMainButton();

    // 2) Разбираем params надёжно
    const parsed = this.#parseParams(params);
    const categoryId = parsed.id || parsed.categoryId || null;
    if (!categoryId) {
      console.error("[CategoryPage] no category id in params:", params);
      this.#renderError("Category not found");
      return;
    }

    // 3) Точки монтирования
    const root = document.getElementById("cafe-category");
    const tpl = document.getElementById("cafe-item-template");
    if (!root || !tpl) {
      console.error("[CategoryPage] mount points not found in DOM");
      return;
    }

    // 4) Грузим список блюд
    let items = [];
    try {
      items = await getMenuCategory(categoryId);
    } catch (err) {
      console.error("[CategoryPage] fetch error:", err);
      this.#renderError("Failed to load menu");
      return;
    }

    // 5) Убираем скелеты и рисуем карточки
    root.innerHTML = "";

    if (!items || items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "small muted";
      empty.textContent = "No items in this category yet.";
      root.appendChild(empty);
    } else {
      const frag = document.createDocumentFragment();

      items.forEach((item) => {
        const node = tpl.content.cloneNode(true);

        const card = node.querySelector(".cafe-item-container");
        const img  = node.querySelector("[data-role='image']");
        const name = node.querySelector("[data-role='name']");
        const desc = node.querySelector("[data-role='desc']");

        // безопасно расставляем данные
        if (card) card.dataset.id = item.id;
        if (img)  img.src = item.photo || item.coverImage || "";
        if (name) name.textContent = item.name ?? "";
        if (desc) desc.textContent = item.description ?? "";

        frag.appendChild(node);
      });

      root.appendChild(frag);
    }

    // 6) Один делегированный обработчик на контейнер
    if (this._clickHandler) {
      root.removeEventListener("click", this._clickHandler);
    }
    this._clickHandler = (e) => {
      const card = e.target.closest(".cafe-item-container");
      if (!card) return;
      const id = card.dataset.id;
      if (!id) return;
      navigateTo("details", { id });
    };
    root.addEventListener("click", this._clickHandler);
  }

  // ——— helpers ———

  #parseParams(params) {
    if (!params) return {};
    if (typeof params === "object") return params;
    try {
      return JSON.parse(params);
    } catch {
      // иногда прилетает что-то вроде "[object Object]"
      return {};
    }
  }

  #syncMainButton() {
    const portionCount = Cart.getPortionCount?.() ?? 0;
    if (portionCount > 0) {
      TelegramSDK.showMainButton(
        `MY CART · ${portionCount} POSITION${portionCount > 1 ? "S" : ""}`,
        () => navigateTo("cart")
      );
    } else {
      TelegramSDK.hideMainButton();
    }
  }

  #renderError(text) {
    const root = document.getElementById("cafe-category");
    if (!root) return;
    root.innerHTML = "";
    const div = document.createElement("div");
    div.className = "small muted";
    div.textContent = text;
    root.appendChild(div);
  }
}