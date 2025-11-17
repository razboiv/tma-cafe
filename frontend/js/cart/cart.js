// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

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

  toJSON() {
    // нормализуем цену
    let cost = this.variant.cost;
    if (typeof cost !== "number") {
      const parsed = parseFloat(
        String(cost ?? "")
          .replace(/[^\d.,]/g, "")
          .replace(",", ".")
      );
      cost = parsed || 0;
    }

    return {
      cafeItem: this.cafeItem,
      variant: { ...this.variant, cost },
      quantity: this.quantity,
    };
  }
}

export default class Cart {
  static #storageKey = "cart_items";
  static #cartItems = Cart.#loadItems();
  static #subscribers = [];

  // ---------- internal helpers ----------

  static #loadItems() {
    try {
      const raw = window.localStorage.getItem(Cart.#storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(CartItem.fromRaw);
    } catch (e) {
      console.error("[Cart] Failed to load items from storage", e);
      return [];
    }
  }

  static #saveItems() {
    try {
      const raw = JSON.stringify(Cart.#cartItems);
      window.localStorage.setItem(Cart.#storageKey, raw);
    } catch (e) {
      console.error("[Cart] Failed to save items to storage", e);
    }
  }

  static #findItem(id) {
    return Cart.#cartItems.find((it) => it.getId() === id) ?? null;
  }

  static #notifyAboutItemsChanged() {
    const items = Cart.getItems();
    Cart.#subscribers.forEach((cb) => {
      try {
        cb(items);
      } catch (e) {
        console.error("[Cart] subscriber error", e);
      }
    });
  }

  // ---------- public API ----------

  static getItems() {
    return [...Cart.#cartItems];
  }

  static getPortionCount() {
    let portionCount = 0;
    Cart.#cartItems.forEach((it) => {
      portionCount += it.quantity;
    });
    return portionCount;
  }

  static add(cafeItem, variant, quantity = 1) {
    const adding = new CartItem(cafeItem, variant, quantity);
    const existing = Cart.#findItem(adding.getId());

    if (existing !== null) {
      existing.quantity += quantity;
    } else {
      Cart.#cartItems.push(adding);
    }

    Cart.#saveItems();
    Cart.#notifyAboutItemsChanged();
  }

  static increaseQuantity(cartItem, quantity = 1) {
    const existing = Cart.#findItem(cartItem.getId());
    if (existing !== null) {
      existing.quantity += quantity;
      Cart.#saveItems();
      Cart.#notifyAboutItemsChanged();
    }
  }

  static decreaseQuantity(cartItem, quantity = 1) {
    const existing = Cart.#findItem(cartItem.getId());
    if (existing === null) return;

    if (existing.quantity > quantity) {
      existing.quantity -= quantity;
    } else {
      removeIf(Cart.#cartItems, (it) => it.getId() === existing.getId());
    }

    Cart.#saveItems();
    Cart.#notifyAboutItemsChanged();
  }

  static clear() {
    Cart.#cartItems = [];
    Cart.#saveItems();
    Cart.#notifyAboutItemsChanged();
  }

  static subscribe(callback) {
    Cart.#subscribers.push(callback);
    return () => {
      removeIf(Cart.#subscribers, (cb) => cb === callback);
    };
  }
}
