// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

/**
 * Model for single Cart item
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
            cost = parseFloat(
                String(cost ?? "")
                    .replace(/[^\d.,]/g, "")
                    .replace(",", ".")
            ) || 0;
        }

        return {
            cafeteria: this.cafeItem,
            variant: { ...this.variant, cost },
            quantity: this.quantity
        };
    }
}

export default class Cart {

    static cartItems = Cart.#loadItems();

    static getPortionCount() {
        let portionCount = 0;
        for (const it of this.cartItems) {
            portionCount += it.quantity;
        }
        return portionCount;
    }

    // -------- STORAGE --------

    static #storageKey = "laurel-cafe-cart";

    static #saveItems() {
        const raw = this.cartItems.map((it) => it.toJSON());
        localStorage.setItem(this.#storageKey, JSON.stringify(raw));
    }

    static #loadItems() {
        try {
            const raw = JSON.parse(localStorage.getItem(this.#storageKey) || "[]");
            return raw.map((r) => CartItem.fromRaw(r));
        } catch (e) {
            console.error("[Cart] Failed to load items", e);
            return [];
        }
    }

    // -------- CART ACTIONS --------

    static #findItem(id) {
        return this.cartItems.find((it) => it.getId() === id) || null;
    }

    static #notifyAboutItemsChanged() {
        document.dispatchEvent(new CustomEvent("cart-changed"));
    }

    static add(cafeItem, variant, quantity = 1) {
        const adding = new CartItem(cafeItem, variant, quantity);
        const existing = this.#findItem(adding.getId());

        if (existing !== null) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(adding);
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
        if (existing !== null) {
            if (existing.quantity > quantity) {
                existing.quantity -= quantity;
            } else {
                removeIf(this.cartItems, it => it.getId() === existing.getId());
            }
            this.#saveItems();
            this.#notifyAboutItemsChanged();
        }
    }

    static clear() {
        this.cartItems = [];
        this.#saveItems();
        this.#notifyAboutItemsChanged();
    }
}
