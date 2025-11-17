// js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * CartItem model
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

    toJSON() {
        return {
            cafeItem: this.cafeItem,
            variant: this.variant,
            quantity: this.quantity
        };
    }
}

/**
 * Main Cart controller
 */
export class Cart {

    static cartItems = [];
    static listeners = [];

    /** Load from localStorage */
    static loadItems() {
        try {
            const raw = JSON.parse(localStorage.getItem("cart") || "[]");
            this.cartItems = raw.map((i) => CartItem.fromRaw(i));
        } catch (e) {
            this.cartItems = [];
        }
    }

    /** Save to localStorage */
    static saveItems() {
        localStorage.setItem("cart", JSON.stringify(this.cartItems));
    }

    /** Find item by id */
    static findItem(id) {
        return this.cartItems.find((i) => i.getId() === id) || null;
    }

    /** Add new item or increase quantity */
    static add(cafeItem, variant, quantity = 1) {
        const adding = new CartItem(cafeItem, variant, quantity);
        const existing = this.findItem(adding.getId());

        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(adding);
        }

        this.saveItems();
        this.notify();
    }

    /** Change quantity */
    static increase(cartItem, quantity = 1) {
        const existing = this.findItem(cartItem.getId());
        if (existing) {
            existing.quantity += quantity;
            this.saveItems();
            this.notify();
        }
    }

    static decrease(cartItem, quantity = 1) {
        const existing = this.findItem(cartItem.getId());
        if (!existing) return;

        if (existing.quantity > quantity) {
            existing.quantity -= quantity;
        } else {
            removeIf(this.cartItems, (i) => i.getId() === existing.getId());
        }

        this.saveItems();
        this.notify();
    }

    static clear() {
        this.cartItems = [];
        this.saveItems();
        this.notify();
    }

    /** Subscribe UI */
    static onChange(callback) {
        this.listeners.push(callback);
    }

    static notify() {
        this.listeners.forEach((cb) => cb(this.cartItems));
    }
}

Cart.loadItems();
