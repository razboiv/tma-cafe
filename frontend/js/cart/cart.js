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
        return new CartItem(
            raw.cafeItem,
            raw.variant,
            raw.quantity
        );
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

    static #cartItems = [];
    static onItemsChangeListener = null;

    // --- SAFE INITIALIZATION BLOCK ---
    static {
        try {
            const saved = localStorage.getItem("cartItems") || "[]";
            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
                this.#cartItems = parsed.map(raw => CartItem.fromRaw(raw));
            } else {
                localStorage.removeItem("cartItems");
                this.#cartItems = [];
            }
        } catch (e) {
            console.warn("Cart: corrupted localStorage cleaned");
            localStorage.removeItem("cartItems");
            this.#cartItems = [];
        }
    }
    // -----------------------------------

    static getItems() {
        return this.#cartItems;
    }

    static getPortionCount() {
        return this.#cartItems.reduce((sum, item) => sum + item.quantity, 0);
    }

    static addItem(cafeItem, variant, quantity) {
        const newItem = new CartItem(cafeItem, variant, quantity);
        const existing = this.#findItem(newItem.getId());

        if (existing) existing.quantity += quantity;
        else this.#cartItems.push(newItem);

        this.#save();
        this.#notify();
    }

    static increaseQuantity(cartItem, amount) {
        const found = this.#findItem(cartItem.getId());
        if (found) {
            found.quantity += amount;
            this.#save();
            this.#notify();
        }
    }

    static decreaseQuantity(cartItem, amount) {
        const found = this.#findItem(cartItem.getId());
        if (found) {
            if (found.quantity > amount) {
                found.quantity -= amount;
            } else {
                removeIf(this.#cartItems, item => item.getId() === found.getId());
            }
            this.#save();
            this.#notify();
        }
    }

    static clear() {
        this.#cartItems = [];
        this.#save();
        this.#notify();
    }

    static #findItem(id) {
        return this.#cartItems.find(item => item.getId() === id);
    }

    static #save() {
        localStorage.setItem("cartItems", JSON.stringify(this.#cartItems));
    }

    static #notify() {
        if (this.onItemsChangeListener) {
            this.onItemsChangeListener(this.#cartItems);
        }
    }
}
