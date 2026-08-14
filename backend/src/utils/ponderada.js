export function calcularPonderada(calificacion = {}) {
  const sanitize = (val, maxVal) => {
    const num = Number(val || 0);
    if (isNaN(num) || num < 0) return 0;
    return Math.min(num, maxVal);
  };

  const oratoria = (sanitize(calificacion.oratoria, 15) / 15) * 15;
  const argumentacion = (sanitize(calificacion.argumentacion, 25) / 25) * 25;
  const negociacion = (sanitize(calificacion.negociacion, 20) / 20) * 20;
  const liderazgo = (sanitize(calificacion.liderazgo, 15) / 15) * 15;
  const redaccion = (sanitize(calificacion.redaccion, 25) / 25) * 25;

  const total = oratoria + argumentacion + negociacion + liderazgo + redaccion;
  return Number(total.toFixed(2));
}
