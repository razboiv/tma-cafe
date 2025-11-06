import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Model class representing Cart item.
 * This is combination of:
 *  - Cafe (Menu) item
 *  - selected variant
 *  - quantity
 */
class CartItem {
  constructor(cafeItem, variant, quantity) {
    this.cafeItem = cafeItem;
    this.variant = variant;
    this.quantity = quantity;
  }

  static fromRaw(raw) {
    return new CartItem(raw.cafeItem, raw.variant, raw.quantity);
  }

  getId() {
    return ${this.cafeItem.id}-${this.variant.id};
  }

  getDisplayTotalCost() {
    const total = this.variant.cost * this.quantity;
    return toDisplayCost(total);
  }
}

/**
 * Cart class holds all cart items
 */
export class Cart {
  // Используем обычные статические поля для совместимости
  static _items = [];
  static onItemsChangeListener = null;

  // Инициализация хранилища БЕЗ static { }
  static _init() {
    try {
      const saved = localStorage.getItem("cartItems") || "[]";
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        Cart._items = parsed.map(raw => CartItem.fromRaw(raw));
      } else {
        localStorage.removeItem("cartItems");
        Cart._items = [];
      }
    } catch (e) {
      // битый JSON — чистим
      localStorage.removeItem("cartItems");
      Cart._items = [];
    }
  }

  static getItems() {
    return Cart._items;
  }

  static getPortionCount() {
    return Cart._items.reduce((sum, it) => sum + it.quantity, 0);
  }

  static addItem(cafeItem, variant, quantity) {
    const newItem = new CartItem(cafeItem, variant, quantity);
    const existing = Cart._findItem(newItem.getId());

    if (existing) existing.quantity += quantity;
    else Cart._items.push(newItem);

    Cart._save();
    Cart._notify();
  }

  static increaseQuantity(cartItem, amount) {
    const found = Cart._findItem(cartItem.getId());
    if (found) {
      found.quantity += amount;
      Cart._save();
      Cart._notify();
    }
  }

  static decreaseQuantity(cartItem, amount) {
    const found = Cart._findItem(cartItem.getId());
    if (found) {
      if (found.quantity > amount) {
        found.quantity -= amount;
      } else {
        removeIf(Cart._items, it => it.getId() === found.getId());
      }
      Cart._save();
      Cart._notify();
    }
  }

  static clear() {
    Cart._items = [];
    Cart._save();
    Cart._notify();
  }

  static _findItem(id) {
    return Cart._items.find(it => it.getId() === id);
  }

  static _save() {
    localStorage.setItem("cartItems", JSON.stringify(Cart._items));
  }

  static _notify() {
    if (Cart.onItemsChangeListener) {
      Cart.onItemsChangeListener(Cart._items);
    }
  }
}

// Запускаем инициализацию
Cart._init();
