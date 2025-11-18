// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Модель элемента корзины:
 *  - сам товар (из меню)
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
    return new CartItem(raw.cafeItem, raw.variant, raw.quantity);
  }

  getId() {
    return `${this.cafeItem.id}-${this.variant.id}`;
  }

  getDisplayTotalCost() {
    const cost = this.#getNumericCost() * this.quantity;
    return toDisplayCost(cost);
  }

  /**
   * Нормализуем цену варианта к числу (11.99) без валютных символов.
   */
  #getNumericCost() {
    let cost = this.variant?.cost;

    if (typeof cost === "number") {
      return cost;
    }

    const parsed =
      parseFloat(
        String(cost ?? "")
          .replace(/[^\d.,]/g, "") // убираем всё кроме цифр, точки и запятой
          .replace(",", ".")
      ) || 0;

    return parsed;
  }

  /**
   * Очень важно: при сериализации на бэкенд
   * отправляем структуру { cafeteria, variant, quantity }.
   */
  toJSON() {
    return {
      cafeteria: this.cafeItem.id,
      variant: {
        ...this.variant,
        cost: this.#getNumericCost(),
      },
      quantity: this.quantity,
    };
  }
}

class CartInternal {
  static #STORAGE_KEY = "cart_items";
  static #items = null; // лениво загружаем
  static #subscribers = new Set();

  // ===== ВНУТРЕННЕЕ =====

  static #ensureLoaded() {
    if (this.#items !== null) return;

    try {
      const raw = localStorage.getItem(this.#STORAGE_KEY);
      if (!raw) {
        this.#items = [];
        return;
      }

      const parsed = JSON.parse(raw);
      this.#items = Array.isArray(parsed)
        ? parsed
            .map((x) => CartItem.fromRaw(x))
            .filter((x) => x !== null)
        : [];
    } catch (e) {
      console.error("[Cart] failed to load from storage", e);
      this.#items = [];
    }
  }

  static #save() {
    try {
      const raw = JSON.stringify(this.#items);
      localStorage.setItem(this.#STORAGE_KEY, raw);
    } catch (e) {
      console.error("[Cart] failed to save to storage", e);
    }
  }

  static #notify() {
    for (const cb of this.#subscribers) {
      try {
        cb(this.getItems());
      } catch (e) {
        console.error("[Cart] subscriber failed", e);
      }
    }
  }

  // ===== ПУБЛИЧНЫЙ API =====

  /**
   * Все элементы корзины (копия массива).
   */
  static getItems() {
    this.#ensureLoaded();
    return [...this.#items];
  }

  /**
   * Количество позиций в корзине (для текста кнопки "MY CART · N POSITIONS").
   */
  static getPortionCount() {
    this.#ensureLoaded();
    return this.#items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  /**
   * Добавить товар (или увеличить количество, если такой вариант уже есть).
   */
  static addItem(cafeItem, variant, quantity = 1) {
    this.#ensureLoaded();

    const qty = quantity > 0 ? quantity : 1;
    const adding = new CartItem(cafeItem, variant, qty);
    const id = adding.getId();

    const existing = this.#items.find((it) => it.getId() === id);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.#items.push(adding);
    }

    this.#save();
    this.#notify();
  }

  /**
   * Увеличить количество конкретного CartItem на quantity.
   */
  static increaseQuantity(cartItem, quantity = 1) {
    this.#ensureLoaded();

    const id = cartItem?.getId?.() ?? cartItem?.id;
    if (!id) return;

    const existing = this.#items.find((it) => it.getId() === id);
    if (!existing) return;

    existing.quantity += quantity;
    if (existing.quantity < 1) existing.quantity = 1;

    this.#save();
    this.#notify();
  }

  /**
   * Уменьшить количество; если стало 0 — удалить позицию.
   */
  static decreaseQuantity(cartItem, quantity = 1) {
    this.#ensureLoaded();

    const id = cartItem?.getId?.() ?? cartItem?.id;
    if (!id) return;

    const existing = this.#items.find((it) => it.getId() === id);
    if (!existing) return;

    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      removeIf(this.#items, (it) => it.getId() === id);
    }

    this.#save();
    this.#notify();
  }

  /**
   * Полностью очистить корзину.
   */
  static clear() {
    this.#ensureLoaded();
    this.#items = [];
    this.#save();
    this.#notify();
  }

  /**
   * Подписаться на изменения корзины.
   * callback(items) будет вызван при каждом изменении.
   */
  static onItemsChanged(callback) {
    if (typeof callback !== "function") return () => {};
    this.#subscribers.add(callback);
    // вернём функцию отписки
    return () => {
      this.#subscribers.delete(callback);
    };
  }
}

/**
 * Внешний класс Cart — просто проксируем к CartInternal.
 * Так удобнее одновременно экспортировать именованный и default.
 */
class Cart extends CartInternal {}

export { Cart, CartItem };
export default Cart;
