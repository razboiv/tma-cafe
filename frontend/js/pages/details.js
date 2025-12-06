// frontend/js/pages/details.js
// Карточка товара: "ADD TO CART" -> "MY CART · N POSITIONS" (без автоперехода)

import Route from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
// Если у тебя другой импорт данных — оставь как было. Этот файл отвечает только за кнопку.

function normalizeId(raw) {
  if (!raw) return null;
  if (typeof raw === "object" && raw.id) return raw.id;
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); if (p && p.id) return p.id; } catch {}
    return raw;
  }
  return null;
}

export default class DetailsPage extends Route {
  constructor() {
    super("details", "/pages/details.html");
  }

  async load(params) {
    console.log("[Details] load >", params);
    TelegramSDK.expand();

    // сохраняем id текущего товара
    this.itemId = normalizeId(params?.id ?? params);

    // --- инициализация UI (если нужно) ---
    // Кол-во и выбранная опция читаются из DOM. Если у тебя другие селекторы — оставь их как было.
    const getQty = () => {
      const el = document.querySelector("[data-role=qty-value]");
      const n = Number(el?.textContent || 1);
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    const getOption = () => {
      const active = document.querySelector("[data-role=opt].is-active");
      return active?.dataset?.value || "default";
    };

    // --- помощник: показать кнопку «MY CART …» ---
    const showMyCart = () => {
      const count = Cart.getPortionCount ? Cart.getPortionCount() : (Cart.size?.() || 0);
      const text = count > 0 ? `MY CART · ${count} POSITION${count > 1 ? "S" : ""}` : "MY CART";
      TelegramSDK.showMainButton(text, () => navigateTo("cart"));
    };

    // --- основное состояние: ADD TO CART ---
    const showAddToCart = () => {
      TelegramSDK.showMainButton("ADD TO CART", () => {
        // добавляем в корзину
        const qty = getQty();
        const option = getOption();
        try {
          if (Cart.add) {
            // наиболее частый вариант
            Cart.add({ id: this.itemId, option, qty });
          } else if (Cart.addItem) {
            Cart.addItem({ id: this.itemId, option, qty });
          } else if (Cart.addPortion) {
            Cart.addPortion(this.itemId, option, qty);
          }
        } catch (e) {
          console.error("[Details] add to cart failed:", e);
        }

        // важно: меняем обработчик на следующий тик,
        // чтобы текущее нажатие не «подхватило» новый handler
        TelegramSDK.showMainButton("MY CART · …");
        setTimeout(showMyCart, 60);
      });
    };

    // Всегда стартуем с «ADD TO CART»
    showAddToCart();

    // Если на карточке есть кнопки +/- или выбор опции — их логика остаётся прежней.
    // Этот файл не трогает твою отрисовку, только MainButton.
  }

  // Ничего специально не скрываем: если корзина не пуста,
  // «MY CART…» должен оставаться на других страницах.
  unload() {
    console.log("[Details] unload");
  }
}