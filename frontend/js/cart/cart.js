// frontend/js/cart/cart.js

import { removeIf } from "../utils/array.js";
import { toDisplayCost } from "../utils/currency.js";

class CartItem {
    constructor(cafeItem, variant, quantity) {
        this.cafeItem = cafeItem;
        this.variant = variant;
        this.quantity = quantity;
    }

    getId() {
        return `${this.cafeItem.id}-${this.variant.id}`;
    }

    getDisplayTotalCost() {
        const total = this.variant.cost * this.quantity;
        return toDisplayCost(total);
    }

    toJSON() {
        return {
            cafeItem: this.cafeItem,
            variant: this.variant,
            quantity: this.quantity
        };
    }
}

export class Cart {
    static cartItems = JSON.parse(localStorage.getItem("cart") || "[]")
        .map((raw) => new CartItem(raw.cafeItem, raw.variant, raw.quantity));

    static saveItems() {
        localStorage.setItem("cart", JSON.stringify(this.cartItems));
    }

    static getPortionCount() {
        return this.cartItems.reduce((sum, it) => sum + it.quantity, 0);
    }

    static addItem(cafeItem, variant, quantity) {
        const adding = new CartItem(cafeItem, variant, quantity);
        const existing = this.cartItems.find(i => i.getId() === adding.getId());

        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cartItems.push(adding);
        }

        this.saveItems();
    }

    static increaseQuantity(cartItem, quantity) {
        const existing = this.cartItems.find(i => i.getId() === cartItem.getId());
        if (!existing) return;

        existing.quantity += quantity;

        this.saveItems();
    }

    static decreaseQuantity(cartItem, quantity) {
        const existing = this.cartItems.find(i => i.getId() === cartItem.getId());
        if (!existing) return;

        if (existing.quantity > quantity) {
            existing.quantity -= quantity;
        } else {
            removeIf(this.cartItems, i => i.getId() === existing.getId());
        }

        this.saveItems();
    }

    static clear() {
        this.cartItems = [];
        this.saveItems();
    }
}
