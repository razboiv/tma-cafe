// frontend/js/cart/cart.js
import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Один пункт в корзине:
 *  - объект блюда (из меню)
 *  - выбранный вариант
 *  - количество
 */
class CartItem {
  constructor(cafeItem, variant, quantity) {
    this.cafeItem = cafeItem;
    this.variant = variant;
    this.quantity = quantity;
  }

  static fromRaw(raw) {
    if (!raw) return null;

    return new CartItem(
      raw.cafeItem,
      raw.variant,
      typeof raw.quantity === "number" ? raw.quantity : 1,
    );
  }

  getId() {
    return `${this.cafeItem.id}-${this.variant.id}`;
  }

  getDisplayTotalCost() {
    const total = (Number(this.variant.cost) || 0) * this.quantity;
    return toDisplayCost(total);
  }

  /**
   * Этот JSON мы кладём в localStorage
   * (для бэкенда при чекауте будет отдельный метод).
   */
  toJSON() {
    return {
      cafeItem: this.cafeItem,
      variant: this.variant,
      quantity: this.quantity,
    };
  }

  /**
   * А этот JSON можно отправлять на бэкенд.
   * Структура под комментарий в шаблоне:
   * { cafeteria, variant, quantity, cost }
   */
  toOrderJSON() {
    let cost = this.variant.cost;

    if (typeof cost !== "number") {
      cost =
        parseFloat(
          String(cost ?? "")
            .replace(/[^\d.,]/g, "")
            .replace(",", "."),
        ) || 0;
    }

    return {
      cafeteria: this.cafeItem.id,
      variant: this.variant.id,
      quantity: this.quantity,
      cost,
    };
  }
}

export default class Cart {
  static #storageKey = "laurel_cafe_cart";
  static #cartItems = [];
  static #loaded = false;
  static #listeners = new Set();

  // ===== служебные методы =====

  static #load() {
    if (this.#loaded) return;

    try {
      const rawJson = localStorage.getItem(this.#storageKey);
      if (!rawJson) {
        this.#cartItems = [];
      } else {
        const rawArray = JSON.parse(rawJson);
        this.#cartItems = Array.isArray(rawArray)
          ? rawArray.map(CartItem.fromRaw).filter((it) => it !== null)
          : [];
      }
    } catch (e) {
      console.error("[Cart] failed to load from localStorage", e);
      this.#cartItems = [];
    }

    this.#loaded = true;
  }

  static #save() {
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(this.#cartItems));
    } catch (e) {
      console.error("[Cart] failed to save to localStorage", e);
    }
  }

  static #notify() {
    for (const cb of this.#listeners) {
      try {
        cb(this.getItems());
      } catch (e) {
        console.error("[Cart] listener failed", e);
      }
    }
  }

  // ===== публичные методы =====

  /** Все позиции корзины */
  static getItems() {
    this.#load();
    return [...this.#cartItems];
  }

  /** Сколько всего порций (для кнопки MY CART · N POSITIONS) */
  static getPortionCount() {
    this.#load();
    return this.#cartItems.reduce((sum, it) => sum + it.quantity, 0);
  }

  /** Добавить позицию / увеличить количество, если такая уже есть */
  static addItem(cafeItem, variant, quantity) {
    this.#load();

    const qty = Math.max(1, Number(quantity) || 1);
    const adding = new CartItem(cafeItem, variant, qty);

    const existing = this.#cartItems.find((it) => it.getId() === adding.getId());

    if (existing) {
      existing.quantity += qty;
    } else {
      this.#cartItems.push(adding);
    }

    this.#save();
    this.#notify();
  }

  /** Установить точное количество для позиции */
  static setQuantity(cartItem, quantity) {
    this.#load();

    const existing = this.#cartItems.find((it) => it.getId() === cartItem.getId());
    if (!existing) return;

    const qty = Math.max(1, Number(quantity) || 1);
    existing.quantity = qty;

    this.#save();
    this.#notify();
  }

  /** Увеличить количество на 1 */
  static increaseQuantity(cartItem) {
    this.setQuantity(cartItem, cartItem.quantity + 1);
  }

  /** Уменьшить количество на 1, при нуле — удалить */
  static decreaseQuantity(cartItem) {
    this.#load();

    const existing = this.#cartItems.find((it) => it.getId() === cartItem.getId());
    if (!existing) return;

    if (existing.quantity > 1) {
      existing.quantity -= 1;
    } else {
      removeIf(this.#cartItems, (it) => it.getId() === existing.getId());
    }

    this.#save();
    this.#notify();
  }

  /** Очистить корзину */
  static clear() {
    this.#cartItems = [];
    this.#save();
    this.#notify();
  }

  /** JSON для чекаута на бэкенд */
  static toOrderJSON() {
    this.#load();
    return this.#cartItems.map((it) => it.toOrderJSON());
  }

  /** Подписка на изменения (для main.js и cart.js страницы) */
  static subscribe(listener) {
    this.#listeners.add(listener);

    // сразу один раз дернём с текущим состоянием
    try {
      listener(this.getItems());
    } catch (e) {
      console.error("[Cart] listener failed", e);
    }

    return () => this.#listeners.delete(listener);
  }
}
