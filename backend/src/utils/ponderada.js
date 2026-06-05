export function calcularPonderada(calificacion = {}) {
  const oratoria = Number(calificacion.oratoria || 0) * 0.15 * (100 / 15);
  const argumentacion = Number(calificacion.argumentacion || 0) * 0.25 * (100 / 25);
  const negociacion = Number(calificacion.negociacion || 0) * 0.2 * (100 / 20);
  const liderazgo = Number(calificacion.liderazgo || 0) * 0.15 * (100 / 15);
  const redaccion = Number(calificacion.redaccion || 0) * 0.25 * (100 / 25);
  return Number((oratoria + argumentacion + negociacion + liderazgo + redaccion).toFixed(2));
}
