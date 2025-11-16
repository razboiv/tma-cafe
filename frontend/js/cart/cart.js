// frontend/js/cart/cart.js

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
     * Приводим к виду, который отправляется на backend
     */
    toJSON() {
        let cost = this.variant.cost;

        if (typeof cost !== "number") {
            cost = parseFloat(
                String(cost ?? "")
                    .replace(/[^\d.,]/g, "")
                    .replace(",", ".")
            ) || 0;
        }

        return {
            cafeItem: this.cafeItem,
            variant: this.variant,
            quantity: this.quantity,
        };
    }
}

export class Cart {
    static cartItems = [];

    /**
     * Сколько позиций в корзине
     */
    static getPortionCount() {
        let portionCount = 0;
        this.cartItems.forEach((it) => (portionCount += it.quantity));
        return portionCount;
    }

    /**
     * Добавить новый товар в корзину
     */
    static add(cafeItem, variant, quantity = 1) {
        const newItem = new CartItem(cafeItem, variant, quantity);
        const existing = this.findItem(newItem.getId());

        if (existing != null) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(newItem);
        }

        this.saveItems();
        this.notifyAboutItemsChanged();
    }

    /**
     * Увеличить количество
     */
    static increaseQuantity(cartItem, quantity = 1) {
        const existing = this.findItem(cartItem.getId());
        if (existing != null) {
            existing.quantity += quantity;
            this.saveItems();
            this.notifyAboutItemsChanged();
        }
    }

    /**
     * Уменьшить количество
     */
    static decreaseQuantity(cartItem, quantity = 1) {
        const existing = this.findItem(cartItem.getId());
        if (existing != null) {
            if (existing.quantity > quantity) {
                existing.quantity -= quantity;
            } else {
                removeIf(
                    this.cartItems,
                    (it) => it.getId() === existing.getId()
                );
            }
            this.saveItems();
            this.notifyAboutItemsChanged();
        }
    }

    /**
     * Найти товар по ID
     */
    static findItem(id) {
        return this.cartItems.find((it) => it.getId() === id) ?? null;
    }

    /**
     * Очистить корзину
     */
    static clear() {
        this.cartItems = [];
        this.saveItems();
        this.notifyAboutItemsChanged();
    }

    /**
     * Сохранить в localStorage
     */
    static saveItems() {
        try {
            const json = JSON.stringify(this.cartItems);
            localStorage.setItem("cartItems", json);
        } catch (e) {
            console.error("[Cart] Failed to save", e);
        }
    }

    /**
     * Загрузить корзину из localStorage
     */
    static loadItems() {
        try {
            const json = localStorage.getItem("cartItems");
            if (!json) return;

            const arr = JSON.parse(json);
            this.cartItems = arr.map((raw) => CartItem.fromRaw(raw));
        } catch (e) {
            console.error("[Cart] Failed to load", e);
        }
    }

    /**
     * Callback: обновление корзины
     */
    static notifyAboutItemsChanged() {
        console.log("[Cart] items changed:", this.cartItems);
    }
}

// Загружаем корзину сразу
Cart.loadItems();

export { CartItem };
