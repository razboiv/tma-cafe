// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";

// --- очень простой локальный "стор" корзины
const readCart  = () => { try { return JSON.parse(localStorage.getItem("cart")||"[]"); } catch { return []; } };
const writeCart = (v) => localStorage.setItem("cart", JSON.stringify(v));
const cartCount = () => readCart().reduce((s,x)=>s+(x.qty||0),0);

function addToCart(item) {
  const cart = readCart();
  const key = `${item.id}:${item.variantId||""}`;
  const f = cart.find(x => x.key === key);
  if (f) f.qty += item.qty;
  else cart.push({ key, ...item });
  writeCart(cart);
  return cartCount();
}

// helpers для MainButton
function showAdd(onClick) {
  const MB = window.Telegram?.WebApp?.MainButton;
  document.body.dataset.mainbutton = "add";
  try {
    MB.setText("ADD TO CART");
    MB.onClick(onClick);
    MB.show();
  } catch {}
}
function showCart(count, onClick) {
  const MB = window.Telegram?.WebApp?.MainButton;
  const suffix = count === 1 ? "POSITION" : "POSITIONS";
  document.body.dataset.mainbutton = "cart";
  try {
    MB.setText(`MY CART · ${count} ${suffix}`);
    MB.onClick(onClick);
    MB.show();
  } catch {}
}

export default class DetailsPage extends Route {
  constructor(){ super("root", "/pages/details.html"); }

  async load(params) {
    const id = String(params?.id || "");
    const data = await this.fetchItem(id);

    this.render(data);

    let variant = (data.variants||[])[0] || null;
    let qty = 1;

    // варианты
    const vRoot = document.getElementById("cafe-item-details-variants");
    vRoot.querySelectorAll(".cafe-item-details-variant").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        vRoot.querySelectorAll(".cafe-item-details-variant").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        variant = (data.variants||[]).find(v=>v.id===btn.dataset.id) || variant;
        this.updateMeta(variant);
      });
    });

    // qty
    document.getElementById("cafe-item-details-quantity-increase-button")
      .addEventListener("click", ()=>{
        qty = Math.min(99, qty+1);
        document.getElementById("cafe-item-details-quantity-value").textContent = qty;
      });
    document.getElementById("cafe-item-details-quantity-decrease-button")
      .addEventListener("click", ()=>{
        qty = Math.max(1, qty-1);
        document.getElementById("cafe-item-details-quantity-value").textContent = qty;
      });

    // Кнопка: если корзина пуста — показываем ADD, иначе — MY CART
    const have = cartCount();
    if (have > 0) {
      showCart(have, ()=> navigateTo("cart"));
    } else {
      showAdd(()=>{
        const count = addToCart({
          id: data.id,
          name: data.name,
          variantId: variant?.id || "",
          variantName: variant?.name || "",
          price: variant?.price || data.price || 0,
          qty
        });
        // После добавления НЕ переходим автоматически — просто меняем кнопку
        showCart(count, ()=> navigateTo("cart"));
      });
    }
  }

  // API товара
  async fetchItem(id) {
    const r = await fetch(`/menu/details/${encodeURIComponent(id)}`, { cache: "no-cache" });
    if (!r.ok) throw new Error("details load failed");
    return await r.json();
  }

  render(d) {
    // картинка
    const img = document.getElementById("cafe-item-details-image");
    img.src = d.image;
    img.alt = d.name;

    // тексты
    document.getElementById("cafe-item-details-name").textContent = d.name;
    document.getElementById("cafe-item-details-description").textContent = d.description || "";
    document.getElementById("cafe-item-details-section-title").textContent = "Price";

    // варианты
    const root = document.getElementById("cafe-item-details-variants");
    root.innerHTML = "";
    (d.variants||[]).forEach((v,i)=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cafe-item-details-variant" + (i===0?" active":"");
      b.dataset.id = v.id;
      b.textContent = v.name;
      root.appendChild(b);
    });

    this.updateMeta((d.variants||[])[0] || { price: d.price || 0, weight: d.weight || "" });

    // снять скелеты и показать контент
    document.querySelectorAll("[data-skeleton]").forEach(el=>el.style.display="none");
    document.querySelectorAll("[data-content]").forEach(el=>el.style.display="");
  }

  updateMeta(v) {
    const price = (v?.price ?? 0);
    document.getElementById("cafe-item-details-selected-variant-price").textContent = `$${(+price).toFixed(2)}`;
    document.getElementById("cafe-item-details-selected-variant-weight").textContent = v?.weight || "";
  }
}