// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Один элемент корзины (товар + вариант)
 */
class CartItem {
    constructor(cafeItem, variant, quantity) {
        this.cafeItem = cafeItem;
        this.variant = variant;
        this.quantity = quantity;
    }

    static fromRaw(raw) {
        return new CartItem(
            raw.cafeItem,
            raw.variant,
            raw.quantity
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
        let cost = this.variant.cost;
        if (typeof cost !== "number") {
            cost = parseFloat(String(cost).replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
        }

        return {
            cafeItem: this.cafeItem,
            variant: {
                ...this.variant,
                cost
            },
            quantity: this.quantity
        };
    }
}


/**
 * Корзина
 */
export class Cart {

    static cartItems = [];

    /** Счётчик порций */
    static getPortionCount() {
        let count = 0;
        for (const it of this.cartItems) {
            count += it.quantity;
        }
        return count;
    }

    /** Добавить товар */
    static add(cafeItem, variant, quantity = 1) {
        const newItem = new CartItem(cafeItem, variant, quantity);
        const existing = this.cartItems.find(it => it.getId() === newItem.getId());

        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(newItem);
        }

        this.saveItems();
        this.notify();
    }

    /** Увеличить количество */
    static increaseQuantity(cartItem, qty = 1) {
        const existing = this.cartItems.find(it => it.getId() === cartItem.getId());
        if (existing) {
            existing.quantity += qty;
            this.saveItems();
            this.notify();
        }
    }

    /** Уменьшить */
    static decreaseQuantity(cartItem, qty = 1) {
        const existing = this.cartItems.find(it => it.getId() === cartItem.getId());
        if (existing) {
            if (existing.quantity > qty) {
                existing.quantity -= qty;
            } else {
                removeIf(this.cartItems, it => it.getId() === existing.getId());
            }
            this.saveItems();
            this.notify();
        }
    }

    static clear() {
        this.cartItems = [];
        this.saveItems();
        this.notify();
    }

    // ==== Хранилище ====

    static saveItems() {
        localStorage.setItem("cart", JSON.stringify(this.cartItems));
    }

    static loadItems() {
        const raw = JSON.parse(localStorage.getItem("cart") || "[]");
        this.cartItems = raw.map(r => CartItem.fromRaw(r));
    }

    static notify() {
        console.log("[Cart] changed:", this.cartItems);
    }
}

// Загружаем корзину при старте
Cart.loadItems();
