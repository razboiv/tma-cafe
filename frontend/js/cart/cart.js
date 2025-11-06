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
    return `${this.cafeItem.id}-${this.variant.id}`;
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
  static _items = [];
  static onItemsChangeListener = null;

  // Load items from localStorage safely
  static _init() {
    try {
      const saved = localStorage.getItem("cartItems") || "[]";
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        Cart._items = parsed.map(raw => CartItem.fromRaw(raw));
      } else {
        Cart._items = [];
        localStorage.removeItem("cartItems");
      }
    } catch (e) {
      Cart._items = [];
      localStorage.removeItem("cartItems");
    }
  }

  static getItems() {
    return Cart._items;
  }

  static getPortionCount() {
    return Cart._items.reduce((sum, it) => sum + it.quantity, 0);
  }

  static addItem(cafeItem, variant, quantity) {
    const it = new CartItem(cafeItem, variant, quantity);
    const existing = Cart._findItem(it.getId());

    if (existing) existing.quantity += quantity;
    else Cart._items.push(it);

    Cart._save();
    Cart._notify();
  }

  static increaseQuantity(cartItem, amount) {
    const it = Cart._findItem(cartItem.getId());
    if (it) {
      it.quantity += amount;
      Cart._save();
      Cart._notify();
    }
  }

  static decreaseQuantity(cartItem, amount) {
    const it = Cart._findItem(cartItem.getId());
    if (it) {
      if (it.quantity > amount) {
        it.quantity -= amount;
      } else {
        removeIf(Cart._items, x => x.getId() === it.getId());
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
    return Cart._items.find(x => x.getId() === id);
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

// Initialize cart on module load
Cart._init();
