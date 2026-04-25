import { part1 } from "./figures-part1.js";
import { part2 } from "./figures-part2.js";
import { part3 } from "./figures-part3.js";
import { part4 } from "./figures-part4.js";
import { part5 } from "./figures-part5.js";
import { part6 } from "./figures-part6.js";
import { part7 } from "./figures-part7.js";

export const figures = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5,
  ...part6,
  ...part7
];

export const figuresById = Object.fromEntries(figures.map((f) => [f.id, f]));

// Versión "ligera" para enviar al frontend (sin los textos largos de bio/thinking).
export const figuresPublic = figures.map((f) => ({
  id: f.id,
  name: f.name,
  era: f.era,
  field: f.field,
  tagline: f.tagline,
  color: f.color,
  avatar: f.avatar
}));
