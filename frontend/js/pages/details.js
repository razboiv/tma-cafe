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
  }

  async load(params) {
    console.log("[DetailsPage] load", params);
    TelegramSDK.expand();

    // Кнопка в режиме добавления — наш глобальный хук не перехватывает
    document.body.dataset.mainbutton = "add";
    TelegramSDK.showMainButton("ADD TO CART");

    // читаем параметры
    let itemId = null, categoryId = null;
    try {
      const p = JSON.parse(params || "{}");
      itemId = p.id;
      categoryId = p.categoryId || p.category?.id || null;
    } catch (e) {}

    if (!itemId) { console.error("[DetailsPage] no itemId"); return; }
    this.categoryId = categoryId;

    // грузим товар и рендерим
    const item = await getMenuItem(itemId);
    if (!item) { console.error("[DetailsPage] item not found", itemId); return; }
    this.#fillItem(item);
  }

  destroy() {
    // сбрасываем режим и убираем кнопку
    document.body.dataset.mainbutton = "";
    try { TelegramSDK.hideMainButton(); } catch(e) {}
    this._cleanup.forEach(fn => { try{ fn(); } catch{} });
    this._cleanup = [];
    super.destroy && super.destroy();
  }

  #fillItem(item) {
    // базовая инфа
    loadImage($("#details-image"), item.image);
    $("#details-name").text(item.name || "");
    $("#details-description").text(item.description || "");

    // убрать шиммер
    ["#details-image","#details-name","#details-description",
     "#details-selected-variant-weight","#details-section-title",
     "#details-variants","#details-price-value"].forEach(sel => $(sel).removeClass("shimmer"));

    const variantsContainer = $("#details-variants").empty();

    // состояние
    let quantity = 1;
    let selectedVariant = (item.variants || [])[0] ?? null;

    const updateQty = () => $("#details-quantity-value").text(quantity);
    const updateSelected = () => {
      if (!selectedVariant) return;
      $("#details-selected-variant-weight").text(selectedVariant.weight || "");
      $("#details-price-value").text(toDisplayCost(Number(selectedVariant.cost) || 0));
    };

    updateQty(); updateSelected();

    // варианты
    const templateHtml = $("#details-variant-template").html();
    (item.variants || []).forEach((variant) => {
      const el = $(templateHtml);
      el.attr("data-id", variant.id);
      el.find(".details-variant-name").text(variant.name || "");
      el.on("click", () => {
        selectedVariant = variant;
        updateSelected();
        $("#details-variants .cafe-item-details-variant").removeClass("active");
        el.addClass("active");
      });
      variantsContainer.append(el);
    });
    const firstBtn = $("#details-variants .cafe-item-details-variant").first();
    if (firstBtn.length) firstBtn.addClass("active");

    // +/- количество
    $("#details-quantity-increase-button").off("click").on("click", () => { quantity += 1; updateQty(); });
    $("#details-quantity-decrease-button").off("click").on("click", () => { if (quantity > 1) { quantity -= 1; updateQty(); } });

    // ADD TO CART → добавляем и показываем "MY CART · N"
    const addToCart = () => {
      if (!selectedVariant) return;
      Cart.addItem(item, selectedVariant, quantity);

      const n = Cart.getPortionCount
        ? Cart.getPortionCount()
        : (Cart.getItems?.().reduce((s,i)=>s+Number(i.quantity||0),0) || 0);

      const label = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;

      // переводим в режим корзины: теперь MainButton открывает cart
      document.body.dataset.mainbutton = "cart";
      TelegramSDK.showMainButton(label, () => navigateTo("cart"));
    };

    TelegramSDK.showMainButton("ADD TO CART", addToCart);
    document.body.dataset.mainbutton = "add";
  }
}