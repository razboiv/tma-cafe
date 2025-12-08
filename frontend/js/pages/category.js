// frontend/js/pages/category.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuCategory } from "../requests/requests.js"; // правильный экспорт
import TelegramSDK from "../telegram/telegram.js";
import { replaceShimmerContent, loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";

/* ===== helpers to pick existing selectors ===== */
const pickSelector = (...cands) => cands.find(sel => !!document.querySelector(sel));
const remShimmer = (rootSel) => {
  const root = document.querySelector(rootSel);
  if (!root) return;
  root.classList?.remove("shimmer");
  root.querySelectorAll(".shimmer").forEach(el => el.classList.remove("shimmer"));
};

/* ===== raw render if no template ===== */
function renderRaw(containerSel, items = [], categoryId) {
  const cont = document.querySelector(containerSel);
  if (!cont) return;
  cont.innerHTML = "";
  (Array.isArray(items) ? items : []).forEach(it => {
    const card = document.createElement("div");
    card.className = "cafe-item-container";
    const img = document.createElement("img");
    img.className = "cafe-item-image";
    if (it?.image) img.src = it.image;
    const name = document.createElement("h6");
    name.className = "cafe-item-name";
    name.textContent = it?.name ?? "";
    const d = document.createElement("p");
    d.className = "small cafe-item-description";
    d.textContent = it?.description ?? "";
    card.append(img, name, d);
    card.addEventListener("click", () => {
      navigateTo("details", JSON.stringify({ id: it?.id, categoryId }));
    });
    cont.append(card);
  });
}

export default class CategoryPage extends Route {
  constructor() {
    super("category", "/pages/category.html");
    this._onBack = this._onBack.bind(this);
  }

  _onBack() {
    window.history.back(); // системный back → плавная анимация
  }

  updateMainButton() {
    const count = Cart.getPortionCount ? Cart.getPortionCount() : 0;
    if (count > 0) {
      TelegramSDK.showMainButton(`MY CART · ${count} POSITIONS`, () => navigateTo("cart"));
      document.body.dataset.mainbutton = "cart";
    } else {
      TelegramSDK.hideMainButton();
      document.body.dataset.mainbutton = "";
    }
  }

  async load(params) {
    TelegramSDK.showBackButton(this._onBack);
    TelegramSDK.ready?.();
    TelegramSDK.expand?.();
    this.updateMainButton();

    const { id: categoryId } = params ? JSON.parse(params) : {};
    if (!categoryId) return this._onBack();

    try {
      const items = await getMenuCategory(categoryId);

      // найдём реальные селекторы на твоей странице
      const containerSel = pickSelector(
        "#category-items",
        "#menu-items",
        "#cafe-category-items",
        "#cafe-menu",
        "#items"
      );
      const templateSel = pickSelector(
        "#category-item-template",
        "#menu-item-template",
        "#cafe-item-template",
        "template[data-id='category-item-template']"
      );
      const imageSel = ["#category-item-image", "#menu-item-image", "#cafe-item-image", ".cafe-item-image"]
        .find(sel => !!document.querySelector(sel)) || "#cafe-item-image";

      // снять шимер со всей секции категории, если он есть
      remShimmer(containerSel || "body");

      if (containerSel && templateSel) {
        // обычный рендер через шаблон
        replaceShimmerContent(
          containerSel,
          templateSel,
          imageSel,
          Array.isArray(items) ? items : [],
          (tpl, item) => {
            tpl.find("#category-item-name, #cafe-item-name").text(item?.name ?? "");
            tpl.find("#category-item-description, #cafe-item-description").text(item?.description ?? "");
            const img = tpl.find(imageSel);
            if (item?.image) loadImage(img, item.image);
            tpl.on("click", () =>
              navigateTo("details", JSON.stringify({ id: item?.id, categoryId }))
            );
          }
        );
      } else if (containerSel) {
        // безопасный «ручной» рендер
        renderRaw(containerSel, items, categoryId);
      } else {
        console.error("[CategoryPage] контейнер для рендера не найден");
      }
    } catch (e) {
      console.error("[CategoryPage] load failed", e);
    }
  }

  destroy() {
    try { TelegramSDK.hideBackButton(); } catch {}
    try { TelegramSDK.offBackButton?.(this._onBack); } catch {}
  }
}