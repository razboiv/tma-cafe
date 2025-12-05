// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";

// Простейший стор корзины (fallback). Если у тебя есть свой Cart — можешь использовать его.
function readCart() {
  try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
}
function writeCart(items) {
  localStorage.setItem("cart", JSON.stringify(items));
}
function addToCart(item) {
  const cart = readCart();
  const key = `${item.id}:${item.variantId}`;
  const found = cart.find(x => x.key === key);
  if (found) found.qty += item.qty;
  else cart.push({ key, ...item });
  writeCart(cart);
  return cart;
}
function cartCount() {
  return readCart().reduce((s, x) => s + (x.qty || 0), 0);
}

// helpers для MainButton
function setMBAddToCart(onClick) {
  const MB = window.Telegram?.WebApp?.MainButton;
  document.body.dataset.mainbutton = "add";
  try {
    MB.setText("ADD TO CART");
    MB.onClick(onClick);
    MB.show();
  } catch {}
}

function setMBMyCart(count, onClick) {
  const MB = window.Telegram?.WebApp?.MainButton;
  document.body.dataset.mainbutton = "cart";
  const suffix = count === 1 ? "POSITION" : "POSITIONS";
  try {
    MB.setText(`MY CART · ${count} ${suffix}`);
    MB.onClick(onClick);
    MB.show();
  } catch {}
}

export default class DetailsPage extends Route {
  constructor() {
    super("root", "/pages/details.html");
  }

  async load(params) {
    // 1) получаем товар (id пришёл из роутера)
    const idRaw = params?.id || params?.["id"] || "";
    const id = String(idRaw);

    // <- подставь свою загрузку товара, если есть
    // пример данных:
    //   { id, name, description, image, variants:[{id:'small', name:'Small', price:11.99, weight:'200g'}, ...] }
    const details = await this.fetchItem(id);

    // 2) рендер в разметку details.html
    this.renderDetails(details);

    // 3) подготовка состояния
    let selectedVariant = details.variants?.[0];
    let qty = 1;

    // клики по вариантам
    const variantsRoot = document.getElementById("cafe-item-details-variants");
    variantsRoot.querySelectorAll(".cafe-item-details-variant").forEach(btn => {
      btn.addEventListener("click", () => {
        variantsRoot.querySelectorAll(".cafe-item-details-variant").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedVariant = details.variants.find(v => v.id === btn.dataset.id);
        this.updateSelectedMeta(selectedVariant);
      });
    });

    // qty
    document.getElementById("cafe-item-details-quantity-increase-button")
      .addEventListener("click", () => {
        qty = Math.min(99, qty + 1);
        document.getElementById("cafe-item-details-quantity-value").textContent = qty;
      });
    document.getElementById("cafe-item-details-quantity-decrease-button")
      .addEventListener("click", () => {
        qty = Math.max(1, qty - 1);
        document.getElementById("cafe-item-details-quantity-value").textContent = qty;
      });

    // 4) ADD TO CART → меняем кнопку на MY CART, но НЕ навигируем автоматически
    setMBAddToCart(() => {
      const cart = addToCart({
        id: details.id,
        name: details.name,
        variantId: selectedVariant.id,
        variantName: selectedVariant.name,
        price: selectedVariant.price,
        qty
      });
      const count = cart.reduce((s, x) => s + x.qty, 0);
      setMBMyCart(count, () => navigateTo("cart"));
    });

    // если корзина уже не пустая — сразу показать MY CART, иначе ADD TO CART
    const have = cartCount();
    if (have > 0) {
      setMBMyCart(have, () => navigateTo("cart"));
    } else {
      setMBAddToCart(() => {
        const cart = addToCart({
          id: details.id,
          name: details.name,
          variantId: selectedVariant.id,
          variantName: selectedVariant.name,
          price: selectedVariant.price,
          qty
        });
        const count = cart.reduce((s, x) => s + x.qty, 0);
        setMBMyCart(count, () => navigateTo("cart"));
      });
    }
  }

  // ===== helpers =====

  async fetchItem(id) {
    // <- если есть свой API, замени этот фейк
    // дергаем твой уже работающий бэкенд/кэш; здесь просто пример структуры
    const resp = await fetch(`/menu/details/${encodeURIComponent(id)}`);
    if (!resp.ok) throw new Error("details load failed");
    return await resp.json();
  }

  renderDetails(d) {
    // картинка
    const img = document.getElementById("cafe-item-details-image");
    img.src = d.image;
    img.alt = d.name;
    img.style.display = "block";
    // скелет скрыть
    document.querySelectorAll("[data-skeleton]").forEach(el => el.style.display = "none");
    document.querySelectorAll("[data-content]").forEach(el => el.style.display = "");

    // тексты
    document.getElementById("cafe-item-details-name").textContent = d.name;
    document.getElementById("cafe-item-details-description").textContent = d.description;
    document.getElementById("cafe-item-details-section-title").textContent = "Price";

    // варианты
    const root = document.getElementById("cafe-item-details-variants");
    root.innerHTML = "";
    d.variants.forEach((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cafe-item-details-variant" + (i === 0 ? " active" : "");
      b.dataset.id = v.id;
      b.textContent = v.name;
      root.appendChild(b);
    });

    this.updateSelectedMeta(d.variants[0]);
  }

  updateSelectedMeta(v) {
    document.getElementById("cafe-item-details-selected-variant-price").textContent = `$${v.price.toFixed(2)}`;
    document.getElementById("cafe-item-details-selected-variant-weight").textContent = v.weight || "";
  }
}