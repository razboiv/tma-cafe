// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import * as Requests from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

// --- tiny helpers ---
const W = () => window.Telegram?.WebApp;
const qs = (s,r=document)=>r.querySelector(s);
const qsa = (s,r=document)=>Array.from(r.querySelectorAll(s));
const setText = (sel, v)=>{ const el=qs(sel); if(el) el.textContent=v; return el; };
const setImg  = (sel, url)=>{ const el=qs(sel); if(!el) return; if(url){ el.src=url; el.style.removeProperty("display"); } else el.style.display="none"; };
const showMB  = (text, cb)=>{ try{ TelegramSDK.showMainButton?.(text, cb); const w=W(); w?.MainButton?.setText?.(text); w?.MainButton?.onClick?.(cb); w?.onEvent?.("mainButtonClicked", cb); w?.MainButton?.enable?.(); w?.MainButton?.show?.(); }catch{} };

function readIdEverywhere(params){
  if (params && typeof params === "string") return params;
  if (params?.id)  return params.id;
  if (params?.dir) return params.dir;

  const ds = document.body?.dataset || {};
  if (ds.itemId) return ds.itemId;
  if (ds.dir)    return ds.dir;
  if (ds.id)     return ds.id;

  const h = location.hash || "";
  let m = h.match(/#\/?details\/([^/?#]+)/i);       if (m) return decodeURIComponent(m[1]);
  m = h.match(/[?&#](?:id|dir)=([^&#]+)/i);         if (m) return decodeURIComponent(m[1]);

  const el = document.querySelector("[data-item-id],[data-id],[data-dir]");
  if (el) { const d = el.dataset; return d.itemId || d.id || d.dir || null; }

  return null;
}

async function fetchItem(id){
  try { if (typeof Requests.getMenuItem === "function") return await Requests.getMenuItem(id); } catch {}
  try {
    const r = await fetch(`${location.origin}/menu/details/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch(e){ console.error("fetch details failed", e); return null; }
}

export default class DetailsPage extends Route{
  constructor(){ super("details","/pages/details.html"); }

  async load(params){
    // чтобы persist-mb не перехватывал кнопку
    document.body.dataset.mainbutton = "add";

    const id = readIdEverywhere(params);
    console.log("[Details] id=", id, "params=", params, "hash=", location.hash);

    if (!id) return;                 // без id просто оставим скелет (чтобы не мигало)

    this.item    = await fetchItem(id);
    if (!this.item) return;

    this.qty     = 1;
    this.variant = this.item?.variants?.[0] || null;

    this.render();

    // теперь можно показать «ADD TO CART»
    showMB("ADD TO CART", ()=>this.addToCart());
  }

  render(){
    const it = this.item || {};

    // убираем шимер
    qsa(".shimmer,[data-skeleton],.skeleton").forEach(el=>el.style.display="none");
    qsa("[data-content],.details-content").forEach(el=>el.style.removeProperty("display"));

    setImg ("#cafe-item-details-image", it.image || it.imageUrl || it.coverImage || "");
    setText("#cafe-item-details-name", it.name || "");
    setText("#cafe-item-details-description", it.description || "");
    setText("#cafe-item-details-section-title", "Price");

    // варианты
    const wrap = qs("#cafe-item-details-variants");
    if (wrap){
      wrap.innerHTML = "";
      (it.variants || []).forEach((v,i)=>{
        const b = document.createElement("button");
        b.className = "cafe-item-details-variant";
        b.textContent = v.name || "";
        if (i===0) b.classList.add("active");
        b.addEventListener("click", ()=>{
          this.variant = v;
          this.updatePrice();
          qsa(".cafe-item-details-variant", wrap).forEach(x=>x.classList.remove("active"));
          b.classList.add("active");
        });
        wrap.appendChild(b);
      });
    }

    // количество
    setText("#cafe-item-details-quantity-value", String(this.qty));
    qs("#cafe-item-details-quantity-increase-button")?.addEventListener("click", ()=>{
      this.qty = Math.min(99, this.qty + 1);
      setText("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });
    qs("#cafe-item-details-quantity-decrease-button")?.addEventListener("click", ()=>{
      this.qty = Math.max(1, this.qty - 1);
      setText("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });

    this.updatePrice();
  }

  updatePrice(){
    const price = Number(this.variant?.cost || 0) * Number(this.qty || 1);
    setText("#cafe-item-details-selected-variant-price",  toDisplayCost(price));
    setText("#cafe-item-details-selected-variant-weight", this.variant?.weight || "");
  }

  addToCart(){
    if (!this.item || !this.variant) return;

    try { Cart.addItem(this.item, this.variant, this.qty); } catch {}

    document.body.dataset.mainbutton = "cart";
    const n = (Cart.getPortionCount && Cart.getPortionCount()) || 1;
    const label = n === 1 ? "MY CART · 1 POSITION" : `MY CART · ${n} POSITIONS`;

    showMB(label, ()=>{
      if (window.navigateTo) window.navigateTo("cart");
      else { location.hash = "#/cart"; window.handleLocation?.(); }
    });
  }
}