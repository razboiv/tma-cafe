// frontend/js/routing/route.js

export class Route {
  constructor(name, htmlPath) {
    this.name = name;         // имя роута (main, category, details, cart)
    this.htmlPath = htmlPath; // путь к html-шаблону страницы
  }
  // у наследников должен быть async load(params) {}
}