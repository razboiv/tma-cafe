// frontend/js/pages/cart.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Страница корзины
 */
export default class CartPage extends Route {
  constructor() {
    super("cart", "/pages/cart.html");
  }

  async load(params) {
    console.log("[CartPage] load", params);

    TelegramSDK.expand();
    TelegramSDK.showMainButton("CHECKOUT", () => this.#checkout());

    this.#render();

    // Подпишемся на изменения корзины, чтобы пересобирать список
    if (!this._unsubscribe) {
      this._unsubscribe = Cart.subscribe(() => this.#render());
    }
  }

  unload() {
    // спрячем main-button, когда уходим со страницы
    TelegramSDK.hideMainButton();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  #render() {
    const items = Cart.getItems();

    const emptyBlock = $("#cart-empty");
    const listBlock = $("#cart-items");
    const totalCostEl = $("#cart-total");

    listBlock.empty();

    if (!items.length) {
      emptyBlock.show();
      totalCostEl.text(toDisplayCost(0));
      return;
    }

    emptyBlock.hide();

    const templateHtml = $("#cart-item-template").html();

    let total = 0;

    items.forEach((cartItem) => {
      const el = $(templateHtml);
      const { cafeItem, variant, quantity } = cartItem;
      el.find(".cart-item-image").attr("src", cafeItem.image || "");

      const positionCost = (Number(variant.cost) || 0) * quantity;
      total += positionCost;

      el.attr("id", cartItem.getId());

      el.find(".cart-qty-value").text(quantity);
      el.find(".cart-item-name").text(cafeItem.name ?? "");
      el.find(".cart-item-image").attr("src", cafeItem.image ?? cafeItem.imageUrl ?? "");
      el.find(".cart-item-variant").text(variant.name ?? "");
      el.find(".cart-item-weight").text(variant.weight ?? "");
      el.find(".cart-item-cost").text(toDisplayCost(positionCost));
      el.find(".cart-item-qty").text(quantity);

      // кнопки +/-
// --- КНОПКИ +/-
el.find(".cart-btn-inc").on("click", () => {
  Cart.increaseQuantity(cartItem);
});

el.find(".cart-btn-dec").on("click", () => {
  Cart.decreaseQuantity(cartItem);
});


      listBlock.append(el);
    });

    totalCostEl.text(toDisplayCost(total));
  }

#checkout() {
  const order = Cart.toOrderJSON();
  console.log("[CartPage] checkout payload", order);

  if (!order.length) {
    // пустую корзину не отправляем
    return;
  }

  // здесь мог бы быть запрос на бэкенд

  TelegramSDK.showAlert("Заказ отправлен (демо).");
  Cart.clear();
  TelegramSDK.close();       // закрываем MiniApp и возвращаемся в чат
}

