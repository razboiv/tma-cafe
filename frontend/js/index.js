// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
// версия в query — чтобы перебить кэш
import { bootRouter, handleLocation } from "./routing/router.js?v=10";

TelegramSDK.ready();
TelegramSDK.expand();

bootRouter();
window.addEventListener("hashchange", handleLocation);