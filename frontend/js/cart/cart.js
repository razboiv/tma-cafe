// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Модель позиции в корзине:
 *  - сам пункт меню (cafeItem)
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
   * Очень важно: при сериализации в JSON отправляем на бэкенд
   * структуру, которую он ожидает: { cafeteria, variant, quantity }
   */
  toJSON() {
    // нормализуем цену: число (11.99), без валютных символов
    let cost = this.variant?.cost;
    if (typeof cost !== "number") {
      const parsed = parseFloat(String(cost ?? "")
        .replace(/[^\d.,]/g, "")
        .replace(",", "."));
      cost = Number.isFinite(parsed) ? parsed : 0;
    }

    return {
      cafeItem: {
        id: this.cafeItem.id,
        name: this.cafeItem.name,
        // можно добавить другие поля, если они требуются бэкенду
      },
      variant: {
        id: this.variant.id,
        name: this.variant.name,
        cost: cost,
        weight: this.variant.weight,
      },
      quantity: this.quantity,
    };
  }
}

/**
 * Основной класс корзины
 */
export default class Cart {
  static cartItems = [];
  static #listeners = [];

  // === работа с localStorage ===
  static #STORAGE_KEY = "tma_cafe_cart";

  static #loadItems() {
    try {
      const raw = window.localStorage.getItem(this.#STORAGE_KEY);
      if (!raw) {
        this.cartItems = [];
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.cartItems = parsed.map((it) => CartItem.fromRaw(it));
      } else {
        this.cartItems = [];
      }
    } catch (e) {
      console.error("[Cart] failed to load items", e);
      this.cartItems = [];
    }
  }

  static #saveItems() {
    try {
      const raw = JSON.stringify(this.cartItems);
      window.localStorage.setItem(this.#STORAGE_KEY, raw);
    } catch (e) {
      console.error("[Cart] failed to save items", e);
    }
  }

  static #notifyAboutItemsChanged() {
    const portionCount = this.getPortionCount();
    this.#listeners.forEach((fn) => {
      try {
        fn(this.cartItems, portionCount);
      } catch (e) {
        console.error("[Cart] listener error", e);
      }
    });
  }

  // === публичное API ===

  /**
   * Подписка на изменения корзины
   */
  static subscribe(listener) {
    this.#loadItems();
    this.#listeners.push(listener);
    // сразу дергаем слушателя текущим состоянием
    listener(this.cartItems, this.getPortionCount());
    return () => {
      removeIf(this.#listeners, (fn) => fn === listener);
    };
  }

  /**
   * Общее количество порций в корзине
   */
  static getPortionCount() {
    let portionCount = 0;
    for (const item of this.cartItems) {
      portionCount += item.quantity;
    }
    return portionCount;
  }

  /**
   * Поиск позиции по id
   */
  static #findItem(id) {
    return this.cartItems.find((it) => it.getId() === id) ?? null;
  }

  /**
   * Добавить новый пункт меню (или увеличить количество,
   * если такой вариант уже есть в корзине)
   */
  static addItem(cafeItem, variant, quantity = 1) {
    this.#loadItems();

    const adding = new CartItem(cafeItem, variant, quantity);
    const existing = this.#findItem(adding.getId());

    if (existing != null) {
      existing.quantity += quantity;
    } else {
      this.cartItems.push(adding);
    }

    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  /**
   * Увеличить количество у существующей позиции
   */
  static increaseQuantity(cartItem, quantity = 1) {
    this.#loadItems();

    const existing = this.#findItem(cartItem.getId());
    if (existing != null) {
      existing.quantity += quantity;
      this.#saveItems();
      this.#notifyAboutItemsChanged();
    }
  }

  /**
   * Уменьшить количество или удалить позицию,
   * если количество стало 0
   */
  static decreaseQuantity(cartItem, quantity = 1) {
    this.#loadItems();

    const existing = this.#findItem(cartItem.getId());
    if (!existing) return;

    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      removeIf(this.cartItems, (it) => it.getId() === existing.getId());
    }

    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  /**
   * Очистить корзину полностью
   */
  static clear() {
    this.cartItems = [];
    this.#saveItems();
    this.#notifyAboutItemsChanged();
  }

  /**
   * Вернуть копию массива позиций
   */
  static getItems() {
    this.#loadItems();
    return [...this.cartItems];
  }
}
