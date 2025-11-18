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

/**
 * Основной класс корзины.
 * ВАЖНО: все методы статические, используем Cart.* в коде.
 */
export class Cart {
  static #STORAGE_KEY = "cart_items";
  static #items = null; // лениво загружаем
  static #subscribers = new Set();

  // ===== ВНУТРЕННЕЕ =====

  static #ensureLoaded() {
    if (Cart.#items !== null) return;

    try {
      const raw = localStorage.getItem(Cart.#STORAGE_KEY);
      if (!raw) {
        Cart.#items = [];
        return;
      }

      const parsed = JSON.parse(raw);
      Cart.#items = Array.isArray(parsed)
        ? parsed
            .map((x) => CartItem.fromRaw(x))
            .filter((x) => x !== null)
        : [];
    } catch (e) {
      console.error("[Cart] failed to load from storage", e);
      Cart.#items = [];
    }
  }

  static #save() {
    try {
      const raw = JSON.stringify(Cart.#items);
      localStorage.setItem(Cart.#STORAGE_KEY, raw);
    } catch (e) {
      console.error("[Cart] failed to save to storage", e);
    }
  }

  static #notify() {
    for (const cb of Cart.#subscribers) {
      try {
        cb(Cart.getItems());
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
    Cart.#ensureLoaded();
    return [...Cart.#items];
  }

  /**
   * Количество позиций в корзине (для текста кнопки "MY CART · N POSITIONS").
   */
  static getPortionCount() {
    Cart.#ensureLoaded();
    return Cart.#items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  /**
   * Добавить товар (или увеличить количество, если такой вариант уже есть).
   */
  static addItem(cafeItem, variant, quantity = 1) {
    Cart.#ensureLoaded();

    const qty = quantity > 0 ? quantity : 1;
    const adding = new CartItem(cafeItem, variant, qty);
    const id = adding.getId();

    const existing = Cart.#items.find((it) => it.getId() === id);
    if (existing) {
      existing.quantity += qty;
    } else {
      Cart.#items.push(adding);
    }

    Cart.#save();
    Cart.#notify();
  }

  /**
   * Увеличить количество конкретного CartItem на quantity.
   */
  static increaseQuantity(cartItem, quantity = 1) {
    Cart.#ensureLoaded();

    const id = cartItem?.getId?.() ?? cartItem?.id;
    if (!id) return;

    const existing = Cart.#items.find((it) => it.getId() === id);
    if (!existing) return;

    existing.quantity += quantity;
    if (existing.quantity < 1) existing.quantity = 1;

    Cart.#save();
    Cart.#notify();
  }

  /**
   * Уменьшить количество; если стало 0 — удалить позицию.
   */
  static decreaseQuantity(cartItem, quantity = 1) {
    Cart.#ensureLoaded();

    const id = cartItem?.getId?.() ?? cartItem?.id;
    if (!id) return;

    const existing = Cart.#items.find((it) => it.getId() === id);
    if (!existing) return;

    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      removeIf(Cart.#items, (it) => it.getId() === id);
    }

    Cart.#save();
    Cart.#notify();
  }

  /**
   * Полностью очистить корзину.
   */
  static clear() {
    Cart.#ensureLoaded();
    Cart.#items = [];
    Cart.#save();
    Cart.#notify();
  }

  /**
   * Подписаться на изменения корзины.
   * callback(items) будет вызван при каждом изменении.
   */
  static onItemsChanged(callback) {
    if (typeof callback !== "function") return () => {};
    Cart.#subscribers.add(callback);
    // вернём функцию отписки
    return () => {
      Cart.#subscribers.delete(callback);
    };
  }
}

export default Cart;
