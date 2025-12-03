// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import { getMenuItem } from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { loadImage } from "../utils/dom.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
    this._cleanup = [];
    this.categoryId = null;
  }

  async load(params) {
    console.log("[DetailsPage] load", params);
    TelegramSDK.expand();

    // режим добавления — чтобы глобальный хук не перехватывал main button
    document.body.dataset.mainbutton = "add";
    TelegramSDK.showMainButton("ADD TO CART");

    // распарсим параметры
    let itemId = null;
    try {
      const p = JSON.parse(params || "{}");
      itemId = p.id || p.itemId || null;
      this.categoryId = p.categoryId || p.category?.id || null;
    } catch (e) {}

    if (!itemId) {
      console.error("[DetailsPage] no itemId in params", params);
      return;
    }

    // грузим данные блюда
    try {
      const item = await getMenuItem(itemId);
      if (!item) {
        console.error("[DetailsPage] item not found", itemId);
        return;
      }
      this.#renderItem(item);
    } catch (e) {
      console.error("[DetailsPage] getMenuItem failed", e);
    }
  }

  destroy() {
    // сбрасываем режим и кнопку при уходе со страницы
    document.body.dataset.mainbutton = "";
    try { TelegramSDK.hideMainButton(); } catch (e) {}

    this._cleanup.forEach(fn => { try { fn(); } catch {} });
    this._cleanup = [];
    super.destroy && super.destroy();
  }

  // ---- helpers ----
  #renderItem(item) {
    // базовая инфа
    loadImage($("#details-image"), item.image);
    $("#details-name").text(item.name || "");
    $("#details-description").text(item.description || "");

    // убрать shimmer
    [
      "#details-image",
      "#details-name",
      "#details-description",
      "#details-selected-variant-weight",
      "#details-section-title",
      "#details-variants",
      "#details-price-value",
    ].forEach((sel) => $(sel).removeClass("shimmer"));

    // варианты
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const variantsContainer = $("#details-variants").empty();
    const templateHtml = $("#details-variant-template").html();

    let quantity = 1;
    let selected = variants[0] || null;

    const updateQty = () => $("#details-quantity-value").text(quantity);
    const updateSelected = () => {
      if (!selected) return;
      $("#details-selected-variant-weight").text(selected.weight || "");
      $("#details-price-value").text(toDisplayCost(Number(selected.cost) || 0));
    };

    // рендер кнопок вариантов
    variants.forEach((v) => {
      const el = $(templateHtml);
      el.attr("data-id", v.id);
      el.find(".details-variant-name").text(v.name || "");
      el.on("click", () => {
        $("#details-variants .cafe-item-details-variant").removeClass("active");
        el.addClass("active");
        selected = v;
        updateSelected();
      });
      variantsContainer.append(el);
    });
    $("#details-variants .cafe-item-details-variant").first().addClass("active");

    // qty +/-
    $("#details-quantity-increase-button").off("click").on("click", () => {
      quantity += 1;
      updateQty();
    });
    $("#details-quantity-decrease-button").off("click").on("click", () => {
      if (quantity > 1) { quantity -= 1; updateQty(); }
    });

    updateQty();
    updateSelected();

    // ADD TO CART
    const addToCart = () => {
      if (!selected) return;
      Cart.addItem(item, selected, quantity);

      // считаем позиции и показываем MY CART · N
      const items = (Cart.getItems && Cart.getItems()) || [];
      const n = items.reduce((s, i) => s + Number(i?.quantity || 0), 0);
      const label = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;

      document.body.dataset.mainbutton = "cart";
      TelegramSDK.showMainButton(label, () => navigateTo("cart"));
    };

    TelegramSDK.showMainButton("ADD TO CART", addToCart);
    document.body.dataset.mainbutton = "add";

    // очистка обработчиков при destroy
    this._cleanup.push(() => {
      $("#details-quantity-increase-button").off("click");
      $("#details-quantity-decrease-button").off("click");
      $("#details-variants .cafe-item-details-variant").off("click");
    });
  }
}