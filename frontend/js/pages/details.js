// Страница товара: картинка, варианты (Small/Large), счётчик, кнопка ADD TO CART

import TelegramSDK from "../telegram/telegram.js";
import * as API from "../requests/requests.js";

const esc = (s) =>
  (s ?? "").toString().replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

async function getItem(id) {
  if (API.getItem) return API.getItem(id);
  const r = await fetch(`/menu/details/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error("Not found");
  return r.json();
}

export default async function DetailsPage({ id }) {
  const item = await getItem(id);

  const title = item.title || item.name || "Item";
  const img = item.photo || item.image || item.cover || item.picture;
  const opts = item.options || [
    { key: "small", title: "Small", price: item.small?.price ?? item.prices?.[0]?.price ?? item.price, weight: item.small?.weight ?? item.weight },
    { key: "large", title: "Large", price: item.large?.price ?? item.prices?.[1]?.price, weight: item.large?.weight }
  ].filter(o => o.price != null);

  const html = `
  <style>
    .d-img{width:100%;border-radius:16px;overflow:hidden;margin:-8px -8px 12px}
    .d-img img{width:100%;display:block}
    .title{font-size:28px;font-weight:700;margin:6px 0}
    .desc{opacity:.8;margin:6px 0 16px}
    .opt-row{display:flex;gap:10px;margin:12px 0}
    .opt{padding:8px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
    .opt.active{background:rgba(135,122,254,.18);border-color:#8774e1}
    .qty{display:flex;align-items:center;gap:12px;margin:14px 0}
    .qty button{width:42px;height:42px;border-radius:21px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);font-size:20px}
    .price{font-size:18px;font-weight:700;margin:8px 0 16px}
  </style>

  <div class="d-img">${img ? `<img src="${esc(img)}" alt="${esc(title)}">` : ""}</div>
  <div class="title">${esc(title)}</div>
  ${item.description ? `<div class="desc">${esc(item.description)}</div>` : ""}

  ${opts.length ? `
    <div>Price</div>
    <div class="opt-row">
      ${opts.map((o, i) => `
        <button class="opt ${i === 0 ? "active" : ""}" data-key="${esc(o.key || i)}" data-price="${Number(o.price)}">
          ${esc(o.title)}${o.weight ? ` · ${esc(o.weight)}` : ""}
        </button>`).join("")}
    </div>
  ` : ""}

  <div class="price" id="d-price"></div>
  <div class="qty">
    <button id="d-minus">−</button>
    <div id="d-count">1</div>
    <button id="d-plus">+</button>
  </div>
  `;

  setTimeout(() => {
    let count = 1;
    let curPrice = Number(document.querySelector(".opt.active")?.dataset.price ?? item.price ?? 0);

    const $price = document.getElementById("d-price");
    const redraw = () => { $price.textContent = curPrice ? `$${(curPrice * count).toFixed(2)}` : ""; };
    redraw();

    document.querySelectorAll(".opt").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".opt").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        curPrice = Number(btn.dataset.price || 0);
        redraw();
      });
    });

    document.getElementById("d-minus").onclick = () => {
      count = Math.max(1, count - 1);
      document.getElementById("d-count").textContent = count;
      redraw();
    };
    document.getElementById("d-plus").onclick = () => {
      count += 1;
      document.getElementById("d-count").textContent = count;
      redraw();
    };

    // Telegram MainButton: «ADD TO CART»
    try {
      TelegramSDK.showMainButton("ADD TO CART", () => {
        import("../routing/router.js").then(r => r.navigateTo("cart"));
      });
    } catch {}
  }, 0);

  return html;
}