import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Model class representing Cart item:
 *  - Cafe (Menu) item
 *  - Selected variant
 *  - Quantity
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
    // Нормализуем цену: число (11.99), без валютных символов
    let cost = this.variant?.cost;
    if (typeof cost !== 'number') {
      cost = parseFloat(String(cost ?? '')
        .replace(/[^\d.,]/g, '')
        .replace(',', '.')) || 0;
    }

    return {
      cafeteria: { name: this.cafeItem?.name ?? '' },
      variant: {
        name: this.variant?.name ?? '',
        cost: cost
      },
      quantity: Number(this.quantity) || 1
    };
  }
}

/**
 * Cart class holds current cart state and allows to manipulate it.
 * Все методы статические → храним единый state.
 */
export class Cart {
  static #cartItems = [];
  static onItemsChangeListener;

  // Восстанавливаем state из localStorage
  static {
    const savedCartItemsJson = localStorage.getItem('cartItems');
    if (savedCartItemsJson != null) {
      try {
        const savedRaw = JSON.parse(savedCartItemsJson);
        const restored = Array.isArray(savedRaw)
          ? savedRaw.map((raw) => CartItem.fromRaw(raw))
          : [];
        this.#cartItems = restored;
      } catch {
        localStorage.removeItem('cartItems');
        this.#cartItems = [];
      }
    }
  }

  /** @returns {CartItem[]} */
  static getItems() {
    return this.#cartItems;
  }

  /** @returns {number} total portions */
  static getPortionCount() {
    let portionCount = 0;
    for (let i = 0; i < this.#cartItems.length; i++) {
      portionCount += this.#cartItems[i].quantity;
    }
    return portionCount;
  }

  /**
   * Add new Cafe item (or increase qty if same variant already exists).
   */
  static addItem(cafeItem, variant, quantity) {
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
    const existing = this.#findItem(cartItem.getId());
    if (existing != null) {
      existing.quantity += quantity;
      this.#saveItems();
      this.#notifyAboutItemsChanged();
    }
  }

  static decreaseQuantity(cartItem, quantity) {
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

  static #findItem(id) {
    return this.#cartItems.find((it) => it.getId() === id);
  }

  static #saveItems() {
    // Сохраняем как обычные поля (без методов классов)
    localStorage.setItem('cartItems', JSON.stringify(this.#cartItems));
  }

  static #notifyAboutItemsChanged() {
    if (this.onItemsChangeListener != null) {
      this.onItemsChangeListener(this.#cartItems);
    }
  }
}
