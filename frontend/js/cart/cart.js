// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Модель одного элемента корзины:
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

  static fromRaw(rawCartItem) {
    return new CartItem(
      rawCartItem.cafeItem,
      rawCartItem.variant,
      rawCartItem.quantity,
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
   * Преобразуем в структуру, которую ждёт бэкенд
   */
  toJSON() {
    // нормализуем цену (число, без валютных символов)
    let cost = this.variant.cost;
    if (typeof cost !== "number") {
      const parsed = parseFloat(
        String(cost ?? "")
          .replace(/[^\d.,]/g, "")
          .replace(",", "."),
      );
      cost = parsed || 0;
    }

    return {
      cafeteria: this.cafeItem.id,
      variant: {
        id: this.variant.id,
        name: this.variant.name,
        weight: this.variant.weight,
        cost,
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

  // ----------------- сервисные методы -----------------

  static init() {
    // пытаемся загрузить корзину из localStorage
    try {
      const raw = window.localStorage.getItem(this.#storageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      this.#cartItems = parsed.map((it) => CartItem.fromRaw(it));
    } catch (e) {
      console.error("[Cart] failed to load from storage", e);
      this.#cartItems = [];
    }
  }

  static #saveItems() {
    try {
      const raw = JSON.stringify(this.#cartItems);
      window.localStorage.setItem(this.#storageKey, raw);
    } catch (e) {
      console.error("[Cart] failed to save to storage", e);
    }
  }

  static #notifyAboutItemsChanged() {
    const snapshot = [...this.#cartItems];
    this.#subscribers.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (e) {
        console.error("[Cart] subscriber failed", e);
      }
    });
  }

  static subscribe(callback) {
    this.#subscribers.push(callback);
    // сразу отдаём текущее состояние
    callback([...this.#cartItems]);
    return () => {
      removeIf(this.#subscribers, (cb) => cb === callback);
    };
  }

  static #findItem(id) {
    return this.#cartItems.find((it) => it.getId() === id) ?? null;
  }

  // ----------------- публичные методы -----------------

  /**
   * Кол-во «позиций» в корзине (для надписи MY CART · N POSITIONS)
   */
  static getPortionCount() {
    let portionCount = 0;
    this.#cartItems.forEach((item) => {
      portionCount += item.quantity;
    });
    return portionCount;
  }

  /**
   * Добавить новый товар (или увеличить количество, если такой вариант уже есть)
   */
  static add(cafeItem, variant, quantity = 1) {
    const adding = new CartItem(cafeItem, variant, quantity);
    const existing = this.#findItem(adding.getId());

    if (existing !== null) {
      existing.quantity += quantity;
    } else {
      this.#cartItems.push(adding);
    }

    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  static increaseQuantity(cartItem, quantity = 1) {
    const existing = this.#findItem(cartItem.getId());
    if (existing !== null) {
      existing.quantity += quantity;
      this.#saveItems();
      this.#notifyAboutItemsChanged();
    }
  }

  static decreaseQuantity(cartItem, quantity = 1) {
    const existing = this.#findItem(cartItem.getId());
    if (!existing) return;

    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      removeIf(this.#cartItems, (it) => it.getId() === existing.getId());
    }

    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  static clear() {
    this.#cartItems = [];
    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  static getItems() {
    return [...this.#cartItems];
  }

  static getDisplayTotalCost() {
    const total = this.#cartItems.reduce(
      (sum, it) => sum + it.variant.cost * it.quantity,
      0,
    );
    return toDisplayCost(total);
  }
}

// Инициализируем корзину сразу при загрузке модуля
Cart.init();
