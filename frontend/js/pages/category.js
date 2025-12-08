// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
  }

  async load(params) {
    console.log("[CategoryPage] load", params);

    // --- НАДЁЖНЫЙ «Назад» ---
    const goBackToRoot = () => navigateTo("root");

    // 1) через твою обёртку
    try { TelegramSDK.showBackButton(goBackToRoot); } catch (e) { console.warn("showBackButton:", e); }

    // 2) через нативный API кнопки «Назад»
    try { window.Telegram?.WebApp?.BackButton?.onClick(goBackToRoot); } catch {}

    // 3) на всякий случай — глобальное событие (iOS иногда жмёт системный back)
    try { window.Telegram?.WebApp?.onEvent?.("back_button_pressed", goBackToRoot); } catch {}

    this.updateMainButton();

    // --- читаем параметры маршрута ---
    let p = {};
    try { p = typeof params === "string" ? JSON.parse(params || "{}") : (params || {}); }
    catch { p = params || {}; }

    const categoryId = p.categoryId || p.id || p.slug;
    if (!categoryId || typeof categoryId !== "string") {
      console.error("[CategoryPage] no valid id in params:", params);
      goBackToRoot();
      return;
    }

    // --- грузим блюда категории ---
    const items = await getMenuCategory(categoryId);
    console.log("[CategoryPage] items", items);

    const root = document.querySelector("#cafe-category");
    if (!root) return;
    root.innerHTML = "";

    (Array.isArray(items) ? items : []).forEach((item) => {
      const el = document.createElement("div");
      el.className = "cafe-item-container";

      const img = document.createElement("img");
      img.className = "cafe-item-image shimmer";
      img.alt = "";
      img.src = (item.image || item.photo || "").trim();
      img.addEventListener("load", () => img.classList.remove("shimmer"));

      const title = document.createElement("h6");
      title.className = "cafe-item-name";
      title.textContent = item.name || "";

      const desc = document.createElement("p");
      desc.className = "small cafe-item-description";
      desc.textContent = item.description || item.short || "";

      el.appendChild(img);
      el.appendChild(title);
      el.appendChild(desc);

      // переход в детали; пробрасываем categoryId, чтобы там «Назад» вернул в эту категорию
      el.addEventListener("click", () =>
        navigateTo("details", { id: String(item.id), categoryId })
      );

      root.appendChild(el);
    });
  }

  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count === 1 ? "1 POSITION" : `${count} POSITIONS`}`,
        () => navigateTo("cart"));
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }
}