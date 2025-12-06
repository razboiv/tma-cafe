// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { bootRouter, handleLocation } from "./routing/router.js";

TelegramSDK.ready();
TelegramSDK.expand();

bootRouter();
window.addEventListener("hashchange", handleLocation);