// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Модель одного элемента корзины:
 *  - сам товар (cafeItem)
 *  - выбранный вариант (variant)
 *  - количество (quantity)
 */
class CartItem {
  constructor(cafeItem, variant, quantity) {
    this.cafeItem = cafeItem;
    this.variant = variant;
    this.quantity = quantity;
  }

  static fromRaw(rawCartItem) {
    return new CartItem(
      rawCartItem.cafeItem,
      rawCartItem.variant,
      rawCartItem.quantity
    );
  }

  getId() {
    return `${this.cafeItem.id}-${this.variant.id}`;
  }

  getDisplayTotalCost() {
    const total = this.variant.cost * this.quantity;
    return toDisplayCost(total);
  }

  /**
   * Преобразуем в структуру для бэка:
   * { cafeteria, variant, quantity }
   */
  toJSON() {
    // нормализуем цену в число
    let cost = this.variant.cost;
    if (typeof cost !== "number") {
      cost = parseFloat(String(cost ?? "")
        .replace(/[^\d.,]/g, "")
        .replace(",", ".")
      ) || 0;
    }

    return {
      cafeteria: this.cafeItem.id,
      variant: {
        id: this.variant.id,
        cost,
        name: this.variant.name,
        weight: this.variant.weight,
      },
      quantity: this.quantity,
    };
  }
}

/**
 * Корзина
 */
export class Cart {
  static #storageKey = "tma-cafe-cart";
  static #cartItems = [];
  static #subscribers = [];

  // ---------- служебное ----------

  static #loadItems() {
    if (this.#cartItems.length > 0) return;

    try {
      const raw = window.localStorage.getItem(this.#storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      this.#cartItems = parsed.map(CartItem.fromRaw);
    } catch (e) {
      console.error("[Cart] failed to load items", e);
      this.#cartItems = [];
    }
  }

  static #saveItems() {
    try {
      const raw = JSON.stringify(this.#cartItems);
      window.localStorage.setItem(this.#storageKey, raw);
    } catch (e) {
      console.error("[Cart] failed to save items", e);
    }
  }

  static #findItem(id) {
    return this.#cartItems.find((it) => it.getId() === id) ?? null;
  }

  static #notifyAboutItemsChanged() {
    this.#subscribers.forEach((fn) => {
      try {
        fn(this.#cartItems);
      } catch (e) {
        console.error("[Cart] subscriber error", e);
      }
    });
  }

  // ---------- публичное API ----------

  static subscribe(callback) {
    this.#loadItems();
    this.#subscribers.push(callback);
    callback(this.#cartItems);

    return () => {
      removeIf(this.#subscribers, (fn) => fn === callback);
    };
  }

  static getItems() {
    this.#loadItems();
    return this.#cartItems;
  }

  static getPortionCount() {
    this.#loadItems();
    let portionCount = 0;
    this.#cartItems.forEach((it) => {
      portionCount += it.quantity;
    });
    return portionCount;
  }

  /**
   * Добавить новый товар в корзину (или увеличить количество,
   * если такой вариант уже есть).
   */
  static add(cafeItem, variant, quantity) {
    this.#loadItems();

    const adding = new CartItem(cafeItem, variant, quantity);
    const existing = this.#findItem(adding.getId());

    if (existing != null) {
      existing.quantity += quantity;
    } else {
      this.#cartItems.push(adding);
    }

    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  static increaseQuantity(cartItem, quantity) {
    this.#loadItems();

    const existing = this.#findItem(cartItem.getId());
    if (existing != null) {
      existing.quantity += quantity;
      this.#saveItems();
      this.#notifyAboutItemsChanged();
    }
  }

  static decreaseQuantity(cartItem, quantity) {
    this.#loadItems();

    const existing = this.#findItem(cartItem.getId());
    if (existing != null) {
      if (existing.quantity > quantity) {
        existing.quantity -= quantity;
      } else {
        removeIf(this.#cartItems, (it) => it.getId() === existing.getId());
      }
      this.#saveItems();
      this.#notifyAboutItemsChanged();
    }
  }

  static clear() {
    this.#cartItems = [];
    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  static toJSON() {
    this.#loadItems();
    return this.#cartItems.map((it) => it.toJSON());
  }
}
