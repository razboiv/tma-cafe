import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

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
            variant: { ...this.variant, cost },
            quantity: this.quantity,
        };
    }
}

export default class Cart {
    static cartItems = [];

    static #saveItems() {
        localStorage.setItem("cart", JSON.stringify(this.cartItems));
    }

    static load() {
        const saved = localStorage.getItem("cart");
        if (!saved) return;

        try {
            this.cartItems = JSON.parse(saved).map(CartItem.fromRaw);
        } catch (e) {
            console.error("Cart load error:", e);
        }
    }

    static #findItem(id) {
        return this.cartItems.find((i) => i.getId() === id) ?? null;
    }

    static getPortionCount() {
        return this.cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    static add(cafeItem, variant, quantity = 1) {
        const adding = new CartItem(cafeItem, variant, quantity);
        const existing = this.#findItem(adding.getId());

        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(adding);
        }

        this.#saveItems();
    }

    static increaseQuantity(cartItem, quantity = 1) {
        const existing = this.#findItem(cartItem.getId());
        if (existing) {
            existing.quantity += quantity;
            this.#saveItems();
        }
    }

    static decreaseQuantity(cartItem, quantity = 1) {
        const existing = this.#findItem(cartItem.getId());
        if (existing) {
            if (existing.quantity > quantity) {
                existing.quantity -= quantity;
            } else {
                removeIf(this.cartItems, (i) => i.getId() === existing.getId());
            }
            this.#saveItems();
        }
    }

    static clear() {
        this.cartItems = [];
        this.#saveItems();
    }
}
