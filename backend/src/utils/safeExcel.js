const FORMULA_PREFIX = /^[=+\-@]/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const SQL_MARKERS = /(--|\/\*|\*\/|;|\b(drop|alter|truncate|insert|update|delete|union|execute|exec)\b)/i;

export function cleanCell(value, maxLength = 255) {
  const text = String(value ?? "").replace(CONTROL_CHARS, " ").trim();
  if (!text) return "";
  if (text.length > maxLength) throw new Error("Celda excede la longitud permitida");
  if (FORMULA_PREFIX.test(text)) throw new Error("Formula de Excel no permitida");
  if (SQL_MARKERS.test(text)) throw new Error("Contenido potencialmente peligroso");
  return text;
}

export function pickClean(row, names, maxLength = 255) {
  const targetNames = names.map(n => n.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  for (const key of Object.keys(row)) {
    const normKey = key.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (targetNames.includes(normKey)) {
      if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
        return cleanCell(row[key], maxLength);
      }
    }
  }
  return "";
}

export function assertExcelFile(file) {
  const allowed = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream"
  ];
  if (!file) throw new Error("Archivo requerido");
  if (!file.originalname.toLowerCase().endsWith(".xlsx")) throw new Error("Solo se permiten archivos .xlsx");
  if (!allowed.includes(file.mimetype)) throw new Error("Tipo de archivo no permitido. Usa un archivo .xlsx");
}
