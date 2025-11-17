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
        let cost = this.variant.cost;
        if (typeof cost !== "number") {
            cost = parseFloat(String(cost ?? "")
                .replace(/[^\d.,]/g, "")
                .replace(",", ".")
            ) || 0;
        }

        return {
            cafeItem: this.cafeItem,
            variant: {
                ...this.variant,
                cost,
            },
            quantity: this.quantity,
        };
    }
}

export default class Cart {
    static cartItems = [];

    static load() {
        try {
            const raw = JSON.parse(localStorage.getItem("cart") || "[]");
            this.cartItems = raw.map(CartItem.fromRaw);
        } catch (e) {
            console.error("[Cart] Failed to load cart", e);
            this.cartItems = [];
        }
    }

    static save() {
        try {
            const raw = JSON.stringify(this.cartItems);
            localStorage.setItem("cart", raw);
        } catch (err) {
            console.error("[Cart] Failed to save cart", err);
        }
    }

    static getPortionCount() {
        let count = 0;
        this.cartItems.forEach((it) => {
            count += it.quantity;
        });
        return count;
    }

    static findItem(id) {
        return this.cartItems.find((item) => item.getId() === id);
    }

    static add(cafeItem, variant, quantity = 1) {
        const adding = new CartItem(cafeItem, variant, quantity);
        const existing = this.findItem(adding.getId());

        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(adding);
        }
        this.save();
    }

    static increaseQuantity(cartItem, quantity = 1) {
        const existing = this.findItem(cartItem.getId());
        if (existing) {
            existing.quantity += quantity;
        }
        this.save();
    }

    static decreaseQuantity(cartItem, quantity = 1) {
        const existing = this.findItem(cartItem.getId());
        if (!existing) return;

        if (existing.quantity > quantity) {
            existing.quantity -= quantity;
        } else {
            removeIf(this.cartItems, (it) => it.getId() === existing.getId());
        }

        this.save();
    }

    static clear() {
        this.cartItems = [];
        this.save();
    }
}

// Автозагрузка корзины при старте
Cart.load();
