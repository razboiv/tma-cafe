// frontend/js/pages/details.js
import { Route } from "../routing/route.js";
import { navigateTo } from "../routing/router.js";
import * as Requests from "../requests/requests.js";
import TelegramSDK from "../telegram/telegram.js";
import { Cart } from "../cart/cart.js";
import { toDisplayCost } from "../utils/currency.js";

const W = () => window.Telegram?.WebApp;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const setText = (sel,v)=>{ const el=$(sel); if(el) el.textContent=v; return el; };
const setImg  = (sel,url)=>{ const el=$(sel); if(!el) return; if(url){ el.src=url; el.style.removeProperty("display"); } else el.style.display="none"; };
const showMB  = (text,cb)=>{ try{ TelegramSDK.showMainButton?.(text,cb); const w=W(); w?.MainButton?.setText?.(text); w?.MainButton?.onClick?.(cb); w?.onEvent?.("mainButtonClicked",cb); w?.MainButton?.enable?.(); w?.MainButton?.show?.(); }catch{} };

function readIdFromHash(){
  const h = location.hash || "";
  let m = h.match(/#\/?details\/([^/?#]+)/i); if(m) return decodeURIComponent(m[1]);
  m = h.match(/[?&#](?:id|dir)=([^&#]+)/i);    if(m) return decodeURIComponent(m[1]);
  return null;
}

function normalizeId(params){
  // 1) объект вида { id: 'burger-1' }
  if (params && typeof params === "object" && "id" in params) return String(params.id);
  // 2) строка
  if (typeof params === "string") return params;
  // 3) data-* и hash
  const ds = document.body?.dataset || {};
  return ds.itemId || ds.dir || ds.id || readIdFromHash() || null;
}

async function getItem(id){
  try { if (typeof Requests.getMenuItem === "function") return await Requests.getMenuItem(id); } catch {}
  try {
    const r = await fetch(`${location.origin}/menu/details/${encodeURIComponent(id)}`);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch(e){ console.error("fetch details failed", e); return null; }
}

function removeSkeleton(){
  $$(".shimmer,[data-skeleton],.skeleton").forEach(el=>el.style.display="none");
  $$("[data-content],.details-content").forEach(el=>el.style.removeProperty("display"));
}

export default class DetailsPage extends Route{
  constructor(){ super("details","/pages/details.html"); }

  async load(params){
    // чтобы persist-mb не перехватывал клик
    document.body.dataset.mainbutton = "add";

    const id = normalizeId(params);
    console.log("[Details] normalized id =", id, "params =", params);

    if (!id) return;                         // нет id — оставим скелет, чтобы не мигало

    this.item    = await getItem(id);
    if (!this.item) return;

    this.qty     = 1;
    this.variant = this.item?.variants?.[0] || null;

    this.render();

    showMB("ADD TO CART", ()=>this.addToCart());
  }

  render(){
    const it = this.item || {};
    removeSkeleton();

    setImg ("#cafe-item-details-image", it.image || it.imageUrl || it.coverImage || "");
    setText("#cafe-item-details-name", it.name || "");
    setText("#cafe-item-details-description", it.description || "");
    setText("#cafe-item-details-section-title", "Price");

    const wrap = $("#cafe-item-details-variants");
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
          $$(".cafe-item-details-variant", wrap).forEach(x=>x.classList.remove("active"));
          b.classList.add("active");
        });
        wrap.appendChild(b);
      });
    }

    setText("#cafe-item-details-quantity-value", String(this.qty));
    $("#cafe-item-details-quantity-increase-button")?.addEventListener("click", ()=>{
      this.qty = Math.min(99, this.qty + 1);
      setText("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });
    $("#cafe-item-details-quantity-decrease-button")?.addEventListener("click", ()=>{
      this.qty = Math.max(1, this.qty - 1);
      setText("#cafe-item-details-quantity-value", String(this.qty));
      this.updatePrice();
    });

    this.updatePrice();
  }

  updatePrice(){
    const cost = Number(this.variant?.cost || 0) * Number(this.qty || 1);
    setText("#cafe-item-details-selected-variant-price",  toDisplayCost(cost));
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