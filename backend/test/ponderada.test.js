import assert from "node:assert/strict";
import { calcularPonderada } from "../src/utils/ponderada.js";

const completo = calcularPonderada({
  oratoria: 15,
  argumentacion: 25,
  negociacion: 20,
  liderazgo: 15,
  redaccion: 25
});

assert.equal(completo, 100);

const conDecimales = calcularPonderada({
  oratoria: 12.5,
  argumentacion: 20.25,
  negociacion: 18.75,
  liderazgo: 14.5,
  redaccion: 22.35
});

assert.equal(conDecimales, 88.35);

const parciales = calcularPonderada({
  oratoria: null,
  argumentacion: "",
  negociacion: 10.5,
  liderazgo: undefined,
  redaccion: 25.75
});

assert.equal(parciales, 35.5);

console.log("ponderada.test.js ok");
