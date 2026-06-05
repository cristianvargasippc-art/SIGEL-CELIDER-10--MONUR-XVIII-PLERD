import assert from "node:assert/strict";
import { calcularPonderada } from "../src/utils/ponderada.js";

assert.equal(
  calcularPonderada({
    oratoria: 15,
    argumentacion: 25,
    negociacion: 20,
    liderazgo: 15,
    redaccion: 25
  }),
  100
);

assert.equal(
  calcularPonderada({
    oratoria: 10,
    argumentacion: 20,
    negociacion: 0,
    liderazgo: 12,
    redaccion: 20
  }),
  62
);

console.log("Ponderada tests OK");
