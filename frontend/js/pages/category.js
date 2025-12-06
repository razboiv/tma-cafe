// frontend/js/pages/category.js

import Route from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);
    TelegramSDK.expand();

    // Основная кнопка на обычных страницах — корзина (если не пустая)
    const portionCount = Cart.getPortionCount();
    document.body.dataset.mainbutton = portionCount > 0 ? "cart" : "";

    // --- безопасно разбираем categoryId из params (строка/объект) ---
    let categoryId = null;
    try {
      if (typeof params === "string") {
        const parsed = JSON.parse(params || "{}");
        categoryId = parsed.id ?? parsed.category ?? null;
      } else if (params && typeof params === "object") {
        categoryId = params.id ?? params.category ?? null;
      }
    } catch (e) {
      console.error("[CategoryPage] parse params failed:", e, params);
    }

    if (!categoryId) {
      replaceShimmerContent(document, "#category-grid",
        `<div style="padding:16px">Category is empty</div>`);
      return;
    }

    // --- грузим блюда категории ---
    let items = [];
    try {
      items = await getMenuCategory(categoryId);
    } catch (e) {
      console.error("[CategoryPage] fetch error:", e);
    }

    if (!Array.isArray(items) || items.length === 0) {
      replaceShimmerContent(document, "#category-grid",
        `<div style="padding:16px">No items found</div>`);
      return;
    }

    // --- рендер карточек ---
    const html = items.map((it) => {
      const id = it.id || it._id || it.slug;
      const name = it.name || it.title || "Untitled";
      const desc = it.descriptionShort || it.description || "";
      const img = it.photo || it.image || it.coverImage || "icons/icon-transparent.svg";
      const price = (it.price && (it.price.small ?? it.price)) ?? it.priceSmall ?? "";
      return `
        <div class="menu-card" data-id="${id}">
          <div class="menu-card__pic"><img src="${img}" alt=""></div>
          <div class="menu-card__title">${name}</div>
          <div class="menu-card__desc">${desc}</div>
          <div class="menu-card__price">${price !== "" ? `$${price}` : ""}</div>
        </div>`;
    }).join("");

    replaceShimmerContent(document, "#category-grid", html);

    // --- клики по карточкам ---
    document.querySelectorAll(".menu-card").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-id");
        navigateTo("details", { id });
      }, { passive: true });
    });
  }
}