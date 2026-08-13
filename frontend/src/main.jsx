import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  ClipboardCheck,
  Search,
  RefreshCw
} from "lucide-react";
import * as XLSX from "xlsx";
import "./styles.css";
import "./home.css";
import { getFlag } from "./utils/flags";

const LOGO_SRC = "/imagenes/logo.png";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");
const DISTRITOS = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"];
const PAISES = [
  "Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda", "Arabia Saudita", "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaiyán",
  "Bahamas", "Bangladés", "Barbados", "Baréin", "Bélgica", "Belice", "Benín", "Bielorrusia", "Birmania", "Bolivia", "Bosnia y Herzegovina", "Botsuana", "Brasil", "Brunéi", "Bulgaria", "Burkina Faso", "Burundi", "Bután",
  "Cabo Verde", "Camboya", "Camerún", "Canadá", "Catar", "Chad", "Chile", "China", "Chipre", "Colombia", "Comoras", "Congo", "Corea del Norte", "Corea del Sur", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba",
  "Dinamarca", "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia", "Eslovenia", "España", "Estados Unidos", "Estonia", "Esuatini", "Etiopía",
  "Filipinas", "Finlandia", "Fiyi", "Francia", "Gabón", "Gambia", "Georgia", "Ghana", "Granada", "Grecia", "Guatemala", "Guinea", "Guinea-Bisáu", "Guinea Ecuatorial", "Guyana",
  "Haití", "Honduras", "Hungría", "India", "Indonesia", "Irak", "Irán", "Irlanda", "Islandia", "Islas Marshall", "Islas Salomón", "Israel", "Italia", "Jamaica", "Japón", "Jordania",
  "Kazajistán", "Kenia", "Kirguistán", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letonia", "Líbano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo",
  "Macedonia del Norte", "Madagascar", "Malasia", "Malaui", "Maldivas", "Mali", "Malta", "Marruecos", "Mauricio", "Mauritania", "México", "Micronesia", "Moldavia", "Mónaco", "Mongolia", "Montenegro", "Mozambique",
  "Namibia", "Nauru", "Nepal", "Nicaragua", "Níger", "Nigeria", "Noruega", "Nueva Zelanda", "Omán", "Países Bajos", "Pakistán", "Palaos", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú", "Polonia", "Portugal",
  "Reino Unido", "República Centroafricana", "República Checa", "República Democrática del Congo", "República Dominicana", "Ruanda", "Rumania", "Rusia",
  "Samoa", "San Cristóbal y Nieves", "San Marino", "San Vicente y las Granadinas", "Santa Lucía", "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Siria", "Somalia", "Sri Lanka", "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza", "Surinam",
  "Tailandia", "Tanzania", "Tayikistán", "Timor Oriental", "Togo", "Tonga", "Trinidad y Tobago", "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistán", "Vanuatu", "Vaticano", "Venezuela", "Vietnam", "Yemen", "Yibuti", "Zambia", "Zimbabue"
];

let accessToken = null;
function setAccessToken(token) {
  accessToken = token || null;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/refresh") {
    const refreshed = await fetch(`${API_BASE}/api/auth/refresh`, { method: "POST", credentials: "include" });
    if (refreshed.ok) {
      const data = await refreshed.json();
      setAccessToken(data.access_token);
      headers.set("Authorization", `Bearer ${data.access_token}`);
      response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: "include" });
    }
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(response.ok ? "El servidor devolvio una respuesta inesperada." : `Error del servidor (${response.status}).`);
    }
  }
  if (!response.ok) throw new Error(data?.error || "No se pudo completar la solicitud.");
  return data;
}

const criterios = {
  oratoria: { label: "Oratoria", max: 15 },
  argumentacion: { label: "Argumentación", max: 25 },
  negociacion: { label: "Negociación", max: 20 },
  liderazgo: { label: "Liderazgo", max: 15 },
  redaccion: { label: "Redacción", max: 25 }
};

function ponderada(row) {
  return Object.entries(criterios).reduce((sum, [key, item]) => sum + ((Number(row[key]) || 0) / item.max) * item.max, 0);
}

function mapDelegado(row) {
  const cal = row.calificacion || {};
  const feedbackEtapa = cal.feedback?.startsWith("etapa:") ? cal.feedback.replace("etapa:", "") : null;
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido || "",
    designacion: row.designacion || "",
    comision: row.comision?.nombre || "",
    comisionObj: row.comision || null,
    comisionId: row.comisionId || row.comision_id || row.comision?.id || "",
    avanza: feedbackEtapa || (row.avanzaEtapa ? "distrital" : "no"),
    asistencia: row.asistencia || "presente_votando",
    oratoria: cal.oratoria ?? "",
    argumentacion: cal.argumentacion ?? "",
    negociacion: cal.negociacion ?? "",
    liderazgo: cal.liderazgo ?? "",
    redaccion: cal.redaccion ?? "",
    mencion: cal.mencion || "",
    feedback: cal.feedback || ""
  };
}

function exportExcel(filename, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Reporte");
  XLSX.writeFile(book, filename);
}

function displayError(error) {
  if (!error) return;
  const msg = error.message || String(error);
  const silentErrors = ["token requerido", "token invalido o expirado", "refresh token requerido", "sesion invalida"];
  if (silentErrors.includes(msg.toLowerCase().trim())) {
    console.warn("Silent API error ignored:", msg);
    return;
  }
  window.alert(msg);
}

function LogoMark({ onClick }) {
  return (
    <div className="logo-mark sm" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <img src={LOGO_SRC} alt="SIGEL CELIDER 10" />
    </div>
  );
}

function LoginPage({ onLogin, onBackToHome }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setAccessToken(data.access_token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <LogoMark onClick={onBackToHome} />
          <div>
            <span>Acceso privado</span>
            <h1>SIGEL CELIDER 10</h1>
            <p>Panel seguro para Regional 10, distritos y mesas directivas.</p>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>Correo institucional<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary full" disabled={loading}><Lock size={16} /> {loading ? "Validando..." : "Ingresar"}</button>
          <button type="button" className="btn secondary full" style={{ marginTop: "10px" }} onClick={onBackToHome}>Volver al inicio</button>
        </form>
      </section>
    </main>
  );
}

function PrivateHome({ goLogin }) {
  useEffect(() => { document.documentElement.dataset.theme = "light"; localStorage.removeItem("sigel-theme"); }, []);
  return (
    <main className="home-shell private-home">
      <header className="home-topbar">
        <div className="brand inverse"><LogoMark /><div><strong>SIGEL CELIDER 10</strong><span>Regional 10</span></div></div>
        <div className="home-controls"><button className="btn small light" onClick={goLogin}><Lock size={14} /> Iniciar sesión</button></div>
      </header>
      <section className="home-hero private">
        <div className="home-copy">
          <span>Plataforma institucional privada</span>
          <h1>Gestión de eventos, asistencia y evaluaciones CELIDER</h1>
          <p>Administra eventos, delegados, comisiones y evaluaciones desde una plataforma institucional segura.</p>
          <button className="btn primary" onClick={goLogin}><ShieldCheck size={16} /> Acceder al panel</button>
        </div>
        <div className="home-status">
          <div className="status-header"><ShieldCheck size={18} /><span>Operación institucional</span></div>
          <strong>Gestión segura</strong>
          <p>Usuarios por rol, asignaciones por distrito, auditoría y datos protegidos.</p>
          <div className="mini-stats">{DISTRITOS.map((d) => <span key={d}>{d}<small>Distrito</small></span>)}</div>
        </div>
      </section>
    </main>
  );
}
function Metric({ icon: Icon, label, value, note }) {
  return <article className="metric-card"><Icon size={18} /><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function EventosPanel({ user, eventos, setEventos, distritos, onReload, setEventoActivo }) {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [distritoId, setDistritoId] = useState("");
  const canCreate = ["superadmin", "distrito"].includes(user.role);

  async function createEvento(event) {
    event.preventDefault();
    const tempNombre = nombre;
    const tempFecha = fecha;
    const tempDistritoId = distritoId;

    // Reset inputs immediately
    setNombre("");
    setFecha("");

    const tempEvent = {
      id: "temp-" + Date.now(),
      nombre: tempNombre,
      fecha: tempFecha || null,
      distrito: distritos.find((d) => d.id === Number(tempDistritoId)) || null,
      _count: { delegados: 0, comisiones: 0 }
    };

    setEventos((current) => [tempEvent, ...current]);

    try {
      await apiRequest("/api/eventos", {
        method: "POST",
        body: JSON.stringify({
          nombre: tempNombre,
          fecha: tempFecha || undefined,
          distrito_id: tempDistritoId ? Number(tempDistritoId) : undefined
        })
      });
      await onReload();
    } catch (error) {
      setEventos((current) => current.filter((e) => e.id !== tempEvent.id));
      setNombre(tempNombre);
      setFecha(tempFecha);
      displayError(error);
    }
  }

  async function deleteEvento(id) {
    if (!confirm("Eliminar este evento y sus datos asociados?")) return;
    const previous = [...eventos];
    setEventos((current) => current.filter((e) => e.id !== id));
    try {
      await apiRequest(`/api/eventos/${id}`, { method: "DELETE" });
      await onReload();
    } catch (error) {
      setEventos(previous);
      displayError(error);
    }
  }

  return (
    <section className="admin-grid">
      <article className="activity-card">
        <div className="section-heading compact"><span>Eventos</span><h2>Eventos por distrito</h2></div>
        {canCreate && (
          <form className="inline-form" onSubmit={createEvento}>
            <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={180} /></label>
            <label>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            {user.role === "superadmin" && <label>Distrito<select value={distritoId} onChange={(e) => setDistritoId(e.target.value)} required><option value="">Seleccionar</option>{distritos.map((d) => <option key={d.id} value={d.id}>{d.codigo}</option>)}</select></label>}
            <button className="btn primary"><Plus size={15} /> Crear</button>
          </form>
        )}
        <div className="admin-list">
          {eventos.map((evento) => {
            const isTemp = String(evento.id).startsWith("temp-");
            return (
              <div key={evento.id} className="row-actions" style={isTemp ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
                <button className="link-row" onClick={() => setEventoActivo(evento)} disabled={isTemp}>
                  <strong>{evento.nombre}</strong>
                  <span>{evento.distrito?.codigo} | {evento.fecha ? new Date(evento.fecha).toLocaleDateString("es-DO") : "Sin fecha"} | {evento._count?.delegados || 0} delegados | {evento._count?.comisiones || 0} comisiones</span>
                </button>
                {canCreate && <button className="icon-btn danger" onClick={() => deleteEvento(evento.id)} disabled={isTemp} aria-label="Eliminar evento"><Trash2 size={16} /></button>}
              </div>
            );
          })}
        </div>
      </article>
      <article className="activity-card">
        <div className="section-heading compact"><span>Límite operativo</span><h2>Hasta 30 eventos</h2></div>
        <p>Cada distrito puede mantener hasta 30 eventos. El regional visualiza todo, pero no altera la data distrital.</p>
      </article>
    </section>
  );
}

function EventoDetalle({ evento, onBack, user, initialView = "flujo" }) {
  const [delegados, setDelegados] = useState([]);
  const [comisiones, setComisiones] = useState([]);
  const [comisionId, setComisionId] = useState("");
  const [modo, setModo] = useState("individual");
  const [cantidad, setCantidad] = useState("");
  const [paisQuery, setPaisQuery] = useState("");
  const [paises, setPaises] = useState([]);
  const [customCountry, setCustomCountry] = useState("");
  const [customCountries, setCustomCountries] = useState(() => JSON.parse(localStorage.getItem("sigel-paises") || "[]"));
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState(initialView);
  const [filtroCalificaciones, setFiltroCalificaciones] = useState("");
  const canManageEvent = ["superadmin", "distrito"].includes(user?.role);
  const canTakeAttendance = canManageEvent;

  useEffect(() => {
    if (comisionId) {
      const selectedCom = comisiones.find((c) => Number(c.id) === Number(comisionId));
      if (selectedCom) setModo(selectedCom.modoAsignacion || "individual");
      setPaises([]);
      setCantidad("");
    }
  }, [comisionId]);

  const presentes = delegados.filter((d) => d.asistencia === "presente_votando");
  const presentesFiltrados = useMemo(() => {
    if (!filtroCalificaciones.trim()) return presentes;
    const search = filtroCalificaciones.toLowerCase().trim();
    return presentes.filter((d) => {
      const fullNombre = `${d.nombre} ${d.apellido || ""}`.toLowerCase();
      const pais = (d.designacion || "").toLowerCase();
      return fullNombre.includes(search) || pais.includes(search);
    });
  }, [presentes, filtroCalificaciones]);

  const presentesOrdenados = useMemo(() => {
    return [...presentesFiltrados].sort((a, b) => {
      const comisionCompare = (a.comision || "").localeCompare(b.comision || "");
      if (comisionCompare) return comisionCompare;
      return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`);
    });
  }, [presentesFiltrados]);
  const comisionesConPresentes = useMemo(() => {
    const map = new Map();
    presentesOrdenados.forEach((delegado) => {
      const key = delegado.comisionId || "sin-comision";
      if (!map.has(key)) map.set(key, { id: key, nombre: delegado.comision || "Sin comisión", delegados: [] });
      map.get(key).delegados.push(delegado);
    });
    return [...map.values()];
  }, [presentesOrdenados]);

  const totalDelegados = delegados.length;
  const totalAsignados = delegados.filter((d) => d.designacion && d.designacion.trim() !== "").length;
  const totalSinAsignar = totalDelegados - totalAsignados;

  const comisionDelegados = useMemo(() => {
    if (!comisionId) return [];
    return delegados.filter((d) => String(d.comisionId) === String(comisionId));
  }, [delegados, comisionId]);

  const delegadosDisponiblesParaComision = useMemo(() => {
    if (!comisionId) return [];
    return delegados.filter((d) => {
      const sinDesignacion = !d.designacion || d.designacion.trim() === "";
      const enComision = String(d.comisionId) === String(comisionId);
      const sinComision = !d.comisionId;
      return sinDesignacion && (enComision || sinComision);
    });
  }, [delegados, comisionId]);

  const yaAsignados = useMemo(() => comisionDelegados.filter((d) => d.designacion && d.designacion.trim() !== "").length, [comisionDelegados]);
  const sinAsignar = delegadosDisponiblesParaComision.length;
  const cantidadNum = Number(cantidad) || 0;
  const maxPaises = modo === "duplas" ? Math.ceil(cantidadNum / 2) : cantidadNum;
  const comisionSeleccionada = comisiones.find((c) => String(c.id) === String(comisionId));
  const esCorteSeleccionada = /corte internacional de justicia|cij/i.test(comisionSeleccionada?.nombre || "");
  const paisesRequeridos = esCorteSeleccionada ? 0 : maxPaises;

  const delegadosSorted = useMemo(() => {
    return [...delegados].sort((a, b) => {
      const comA = a.comision || "zzz";
      const comB = b.comision || "zzz";
      if (comA !== comB) return comA.localeCompare(comB);
      const aAssigned = a.designacion ? 0 : 1;
      const bAssigned = b.designacion ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return Number(a.id) - Number(b.id);
    });
  }, [delegados]);

  async function loadComisiones() {
    const data = await apiRequest(`/api/eventos/${evento.id}/comisiones`);
    setComisiones(data);
  }

  async function loadDelegados() {
    const data = await apiRequest(`/api/eventos/${evento.id}/delegados`);
    setDelegados(data.map(mapDelegado));
  }

  async function load() {
    await Promise.all([loadDelegados(), loadComisiones()]);
  }

  useEffect(() => {
    load().catch(displayError);
    const timer = window.setInterval(() => load().catch(console.error), 30000);
    return () => window.clearInterval(timer);
  }, [evento.id]);

  async function upload(kind, file) {
    if (!file || uploading) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await apiRequest(`/api/eventos/${evento.id}/import/${kind}`, { method: "POST", body });
      await load();
      if (res.errors && res.errors.length > 0) {
        displayError(new Error(`Importación con errores:\n${res.errors.map((e) => `Fila ${e.row}: ${e.error}`).join("\n")}`));
      } else {
        window.alert("Listado cargado correctamente.");
      }
    } catch (error) {
      displayError(error);
    } finally {
      setUploading(false);
    }
  }

  async function updateAsistencia(id, estado) {
    const previous = [...delegados];
    setDelegados((current) => current.map((d) => d.id === id ? { ...d, asistencia: estado } : d));
    try {
      await apiRequest(`/api/eventos/${evento.id}/asistencia/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
    } catch (error) {
      setDelegados(previous);
      displayError(error);
    }
  }

  async function updateCalificacion(id, key, value) {
    const raw = String(value ?? "").trim();
    if (raw === "") {
      const previous = [...delegados];
      setDelegados((current) => current.map((d) => d.id === id ? { ...d, [key]: "" } : d));
      try {
        await apiRequest(`/api/calificaciones/${id}`, { method: "PATCH", body: JSON.stringify({ [key]: null }) });
      } catch (error) {
        setDelegados(previous);
        displayError(error);
      }
      return;
    }
    let nextValue = Number(raw);
    if (!Number.isFinite(nextValue)) return;
    if (!Number.isInteger(nextValue)) {
      window.alert("Solo se permiten cantidades enteras (sin decimales).");
      return;
    }
    if (criterios[key]) {
      if (nextValue < 0 || nextValue > criterios[key].max) {
        window.alert(`La calificación de ${criterios[key].label} debe estar entre 0 y ${criterios[key].max}.`);
        return;
      }
    }
    const previous = [...delegados];
    setDelegados((current) => current.map((d) => d.id === id ? { ...d, [key]: nextValue } : d));
    try {
      await apiRequest(`/api/calificaciones/${id}`, { method: "PATCH", body: JSON.stringify({ [key]: nextValue }) });
    } catch (error) {
      setDelegados(previous);
      displayError(error);
    }
  }

  async function updateAvanza(id, etapa) {
    const previous = [...delegados];
    setDelegados((current) => current.map((d) => d.id === id ? { ...d, avanza: etapa } : d));
    try {
      await apiRequest(`/api/eventos/${evento.id}/avanza/${id}`, { method: "PATCH", body: JSON.stringify({ avanza: etapa }) });
    } catch (error) {
      setDelegados(previous);
      window.alert(error.message);
    }
  }

  async function asignar() {
    if (!comisionId) return;
    if (!cantidadNum || cantidadNum < 1) {
      window.alert("Ingresa la cantidad de delegados que quieres asignar a esta comisi\u00f3n.");
      return;
    }
    if (cantidadNum > sinAsignar) {
      window.alert(`Solo hay ${sinAsignar} delegado(s) sin asignar en este comité.`);
      return;
    }
    if (!esCorteSeleccionada && paises.length !== paisesRequeridos) {
      window.alert(`Selecciona exactamente ${paisesRequeridos} país(es) para asignar ${cantidadNum} delegado(s) en modo ${modo}.`);
      return;
    }
    if (maxPaises > 0 && paises.length > maxPaises) {
      window.alert(`Solo puedes seleccionar ${maxPaises} país(es) para ${cantidadNum} delegados en modo ${modo}.`);
      return;
    }
    try {
      const res = await apiRequest(`/api/eventos/${evento.id}/asignar`, {
        method: "POST",
        body: JSON.stringify({ comision_id: Number(comisionId), modo, paises, cantidad: cantidadNum })
      });
      await load();
      setPaises([]);
      setCantidad("");
      setView("pase");
      window.alert(`\u2705 ${res.assigned_count} delegado(s) asignados correctamente.`);
    } catch (error) { displayError(error); }
  }

  function exportEvento() {
    const avanzaLabels = {
      no: "No avanza",
      distrital: "Etapa Distrital",
      regional: "Etapa Regional",
      minume: "Etapa MINUME"
    };

    exportExcel(`SIGEL-${evento.nombre}.xlsx`, delegados.map((d) => ({
      Nombre: d.nombre,
      Apellido: d.apellido || "",
      Comisión: d.comision,
      "País / Designación": d.designacion || "",
      Asistencia: d.asistencia === "presente_votando" ? "Presente" : "Ausente",
      Oratoria: d.oratoria !== "" && d.oratoria !== null && d.oratoria !== undefined ? Number(d.oratoria) : "",
      Argumentación: d.argumentacion !== "" && d.argumentacion !== null && d.argumentacion !== undefined ? Number(d.argumentacion) : "",
      Negociación: d.negociacion !== "" && d.negociacion !== null && d.negociacion !== undefined ? Number(d.negociacion) : "",
      Liderazgo: d.liderazgo !== "" && d.liderazgo !== null && d.liderazgo !== undefined ? Number(d.liderazgo) : "",
      Redacción: d.redaccion !== "" && d.redaccion !== null && d.redaccion !== undefined ? Number(d.redaccion) : "",
      "Total Ponderado": d.asistencia === "presente_votando" ? Number(ponderada(d).toFixed(2)) : "",
      Avanza: avanzaLabels[d.avanza] || "No avanza"
    })));
  }

  const allCountries = useMemo(
    () => [...new Set([...PAISES, ...customCountries])].sort((a, b) => a.localeCompare(b)),
    [customCountries]
  );

  const paisesVisibles = useMemo(() => {
    const selectedSet = new Set(paises);
    const filtered = allCountries.filter((p) => p.toLowerCase().includes(paisQuery.toLowerCase()));
    const combined = [...paises, ...filtered.filter((p) => !selectedSet.has(p))];
    return combined.slice(0, 40);
  }, [allCountries, paises, paisQuery]);

  async function clearDelegados() {
    if (!window.confirm("¿Seguro que deseas eliminar todos los delegados importados de este evento?")) return;
    try {
      await apiRequest(`/api/eventos/${evento.id}/delegados`, { method: "DELETE" });
      await load();
    } catch (error) { displayError(error); }
  }

  async function clearComisiones() {
    if (!confirm("Atención: esto eliminará TODAS las comisiones de este evento. ¿Deseas continuar?")) return;
    try {
      await apiRequest(`/api/eventos/${evento.id}/comisiones`, { method: "DELETE" });
      await load();
    } catch (error) { displayError(error); }
  }

  async function updateModoAsignacion(comisionId, modo) {
    try {
      await apiRequest(`/api/eventos/${evento.id}/comisiones/${comisionId}`, {
        method: "PATCH",
        body: JSON.stringify({ modoAsignacion: modo })
      });
      await load();
      window.alert("Modo de asignación de la comisión guardado correctamente.");
    } catch (error) { displayError(error); }
  }

  function addCountry(event) {
    event.preventDefault();
    const name = customCountry.trim();
    if (!name) return;
    const duplicate = allCountries.some((country) => country.toLowerCase() === name.toLowerCase());
    if (!duplicate) {
      const next = [...customCountries, name];
      setCustomCountries(next);
      localStorage.setItem("sigel-paises", JSON.stringify(next));
    }
    setPaises((x) => x.includes(name) ? x : [...x, name]);
    setCustomCountry("");
    setPaisQuery("");
  }

  return (
    <section className="activity-card">
      <div className="table-title">
        <div><span>Evento activo</span><h2>{evento.nombre}</h2></div>
        <div className="table-actions">
          <button className="btn secondary" onClick={onBack}>Volver</button>
          <button className="btn secondary" onClick={exportEvento}><Download size={15} /> Excel</button>
          <button className="btn secondary" onClick={() => window.print()}><Download size={15} /> PDF</button>
        </div>
      </div>
      <div className="event-tabs" role="tablist" aria-label="Flujo del evento">
        {canManageEvent && <button className={view === "flujo" ? "active" : ""} onClick={() => setView("flujo")} type="button">Carga y asignación</button>}
        {canTakeAttendance && <button className={view === "pase" ? "active" : ""} onClick={() => setView("pase")} type="button">Pase de lista</button>}
        <button className={view === "calificaciones" ? "active" : ""} onClick={() => setView("calificaciones")} type="button">Calificaciones</button>
      </div>
      {view === "flujo" && canManageEvent && <>
      <div className="excel-help-card">
        <div className="excel-help-header">
          <FileSpreadsheet size={16} />
          <h4>Formato requerido para carga Excel</h4>
        </div>
        <div className="excel-help-content">
          <div className="excel-help-col highlighted-col">
            <h5>Paso 1: Comisiones</h5>
            <ul>
              <li>Archivo en formato <code>.xlsx</code>.</li>
              <li>La primera fila debe incluir la columna <code>comisiones</code>.</li>
              <li>Sube las comisiones antes del listado de delegados.</li>
            </ul>
          </div>
          <div className="excel-help-col">
            <h5>Paso 2: Delegados</h5>
            <ul>
              <li>Archivo en formato <code>.xlsx</code>.</li>
              <li>La primera fila debe incluir la columna <code>nombre</code>.</li>
              <li>Si incluyes <code>comision</code>, debe coincidir con una comisión del evento.</li>
              <li>No se permiten fórmulas ni contenido potencialmente peligroso.</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="event-tools">
        <div className="tool-upload-group">
          <label className="file-drop"><Upload size={18} /> Subir comisiones Excel<input type="file" accept=".xlsx" onChange={(e) => upload("comisiones", e.target.files?.[0])} /></label>
          {comisiones.length > 0 && <button className="btn danger small-btn" onClick={clearComisiones}><Trash2 size={14} /> Limpiar comisiones</button>}
        </div>
        <div className="tool-upload-group">
          <label className="file-drop"><FileSpreadsheet size={18} /> Subir delegados Excel<input type="file" accept=".xlsx" onChange={(e) => upload("delegados", e.target.files?.[0])} /></label>
          {delegados.length > 0 && <button className="btn danger small-btn" onClick={clearDelegados}><Trash2 size={14} /> Limpiar Delegados</button>}
        </div>
      </div>
      <div className="assignment-panel">
        <div className="section-heading compact"><span>Paso 2 - Asignaciones</span><h2>Países por comité</h2><p>Selecciona comité, modo, cantidad y países. Para Corte Internacional de Justicia se asigna "Su Excelencia" más el apellido automáticamente.</p></div>
        <div className="assign-controls">
          <label>
            <span className="assign-label">Comité</span>
            <select value={comisionId} onChange={(e) => setComisionId(e.target.value)}>
              <option value="">Seleccionar comité</option>
              {comisiones.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>
            <span className="assign-label">Modo</span>
            <select value={modo} onChange={(e) => setModo(e.target.value)}>
              <option value="individual">Individual (1 país por delegado)</option>
              <option value="duplas">Duplas (1 país por cada 2)</option>
            </select>
          </label>
          <label>
            <span className="assign-label">Cantidad a asignar</span>
            <input
              type="number"
              min="1"
              max={sinAsignar || undefined}
              value={cantidad}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCantidad(v > 0 ? v : "");
                const newMax = modo === "duplas" ? Math.ceil(v / 2) : v;
                if (paises.length > newMax) setPaises((x) => x.slice(0, newMax));
              }}
              placeholder={comisionId ? `Máx. ${sinAsignar} sin asignar` : "Selecciona comité primero"}
              disabled={!comisionId}
            />
          </label>
        </div>
        {comisionId && (
          <div className="assign-counter">
            <span className="counter-item assigned">Asignados: <strong>{yaAsignados}</strong></span>
            <span className="counter-item pending">Sin asignar: <strong>{sinAsignar}</strong></span>
            <span className="counter-item total">Total en comité: <strong>{comisionDelegados.length}</strong></span>
            {delegadosDisponiblesParaComision.some((d) => !d.comisionId) && <span className="counter-item selected">Incluye delegados sin comité</span>}
            {cantidadNum > 0 && <span className="counter-item selected">Países seleccionados: <strong>{paises.length}</strong> / <strong>{paisesRequeridos}</strong></span>}
            {esCorteSeleccionada && <span className="counter-item done">CIJ: Su Excelencia + apellido</span>}
          </div>
        )}
        <div className="country-search-row">
          <input value={paisQuery} onChange={(e) => setPaisQuery(e.target.value)} placeholder="Buscar país" className="country-search-input" disabled={esCorteSeleccionada} />
          <form className="country-add-inline" onSubmit={addCountry}>
            <input value={customCountry} onChange={(e) => setCustomCountry(e.target.value)} placeholder="Añadir territorio o país" disabled={esCorteSeleccionada} />
            <button className="btn secondary" type="submit" disabled={esCorteSeleccionada}>Añadir</button>
          </form>
        </div>
        {!esCorteSeleccionada && <div className="country-picker">
          {paisesVisibles.map((pais) => {
            const isSelected = paises.includes(pais);
            const limitReached = !isSelected && cantidadNum > 0 && paises.length >= maxPaises;
            return (
              <button
                type="button"
                key={pais}
                className={isSelected ? "active" : limitReached ? "disabled" : ""}
                disabled={limitReached}
                title={limitReached ? `Límite de ${maxPaises} países alcanzado` : pais}
                onClick={() => setPaises((x) => x.includes(pais) ? x.filter((p) => p !== pais) : [...x, pais])}
              >
                {getFlag(pais, "picker-flag")} <span>{pais}</span>
              </button>
            );
          })}
        </div>}
        <div className="assign-action-row">
          {paises.length > 0 && <div className="selected-summary"><strong>Seleccionados ({paises.length}):</strong> {paises.join(", ")}</div>}
          <button className="btn primary" type="button" onClick={asignar} disabled={!comisionId || !cantidadNum || uploading}>
            <CheckCircle2 size={15} /> Asignar {cantidadNum > 0 ? `(${cantidadNum} delegados)` : ""}
          </button>
        </div>
      </div>
      {delegados.length > 0 && (
        <div className="global-quota-banner">
          <span className="quota-item">Total cargados: <strong>{totalDelegados}</strong></span>
          <span className="quota-item assigned">Con país: <strong>{totalAsignados}</strong></span>
          {totalSinAsignar > 0 && (
            <span className="quota-item pending">Sin asignar: <strong>{totalSinAsignar}</strong> {totalSinAsignar === 1 ? "delegado" : "delegados"} pendiente{totalSinAsignar !== 1 ? "s" : ""}</span>
          )}
          {totalSinAsignar === 0 && <span className="quota-item done">Todos asignados</span>}
        </div>
      )}
      </>}

      {view === "pase" && canTakeAttendance && <>
      <div className="section-heading compact" style={{ marginTop: "16px" }}>
        <span>Paso 3</span>
        <h2>Pase de lista</h2>
        <p>Marca la asistencia de cada delegado. Solo los presentes pasan a calificaciones.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Delegado</th>
              <th>Comisión</th>
              <th>País / Asignación</th>
              <th>Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {delegadosSorted.map((d) => (
              <tr key={d.id} className={d.asistencia === "ausente" ? "muted-row" : ""}>
                <td><strong>{d.nombre} {d.apellido}</strong></td>
                <td><span className="comision-badge">{d.comision || <em style={{ color: "var(--muted)" }}>Sin comisi\u00f3n</em>}</span></td>
                <td>
                  <div className="designacion-cell">
                    {d.designacion
                      ? <><span className="pais-asignado">{getFlag(d.designacion)} {d.designacion}</span></>
                      : <em style={{ color: "var(--muted)", fontSize: "12px" }}>Pendiente de asignación</em>
                    }
                  </div>
                </td>
                <td>
                  <select
                    value={d.asistencia}
                    onChange={(e) => updateAsistencia(d.id, e.target.value)}
                    className={d.asistencia === "presente_votando" ? "asistencia-presente" : "asistencia-ausente"}
                  >
                    <option value="presente_votando">Presente / Votando</option>
                    <option value="ausente">Ausente</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="next-step-row">
        <p className="helper-text">{presentes.length} de {delegados.length} presentes pasan a calificaciones.</p>
        <button className="btn primary" type="button" onClick={() => setView("calificaciones")} disabled={presentes.length === 0}>
          <ClipboardCheck size={15} /> Siguiente
        </button>
      </div>
      </>}

      {view === "calificaciones" && (
        <>
          <div className="section-heading compact" style={{ marginTop: "28px" }}>
            <span>Paso 4</span>
            <h2>Calificaciones</h2>
            <p>Evaluación de delegados presentes. Los ausentes no aparecen aquí. <strong>* Nota: Solo se permiten cantidades enteras (sin decimales).</strong></p>
          </div>

          {presentes.length > 0 && (
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" }}>
              <div className="calificaciones-search-box" style={{ position: "relative", maxWidth: "360px", flex: "1" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Buscar por nombre o país..."
                  value={filtroCalificaciones}
                  onChange={(e) => setFiltroCalificaciones(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 36px",
                    minHeight: "40px",
                    borderRadius: "8px",
                    border: "1.5px solid var(--line)",
                    fontSize: "14px",
                    background: "#fff",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={async () => {
                  await load();
                }}
                style={{ height: "40px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <RefreshCw size={15} /> Actualizar Calificaciones
              </button>
            </div>
          )}

          {presentes.length === 0 && <div className="empty-state"><ClipboardCheck size={24} /><h3>Sin delegados presentes</h3><p>Completa el pase de lista para habilitar esta hoja de evaluación.</p></div>}
          {comisionesConPresentes.map((grupo) => (
          <div className="table-wrap rubric-by-committee" key={grupo.id}>
            <div className="rubric-committee-title">{grupo.nombre}</div>
            <table>
              <thead>
                <tr>
                  <th>Delegado</th>
                  <th>Comisión</th>
                  <th>País</th>
                  {Object.entries(criterios).map(([k, c]) => (
                    <th key={k}>{c.label}<small>0-{c.max}</small></th>
                  ))}
                  <th>Total</th>
                  <th>Avanza</th>
                </tr>
              </thead>
              <tbody>
                {grupo.delegados.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.nombre} {d.apellido}</strong></td>
                    <td>{d.comision || "-"}</td>
                    <td>
                      <div className="designacion-cell">
                        {getFlag(d.designacion)}
                        <span>{d.designacion || "-"}</span>
                      </div>
                    </td>
                    {Object.keys(criterios).map((key) => (
                      <td key={key}>
                        <input
                          className="score-input"
                          type="number"
                          min="0"
                          max={criterios[key].max}
                          step="1"
                          inputMode="numeric"
                          placeholder=""
                          value={d[key]}
                          onChange={(e) => updateCalificacion(d.id, key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td><strong>{ponderada(d).toFixed(2)}</strong></td>
                    <td>
                      <select
                        value={d.avanza || "no"}
                        onChange={(e) => updateAvanza(d.id, e.target.value)}
                        className="avanza-select"
                      >
                        <option value="no">No avanza</option>
                        <option value="distrital">Etapa Distrital</option>
                        <option value="regional">Etapa Regional</option>
                        <option value="minume">Etapa MINUME</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ))}
        </>
      )}
    </section>
  );
}

function UsuariosPanel({ user, distritos, comisiones, admins, setAdmins, onReload, onDeactivate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user.role === "distrito" ? "admin" : "distrito");
  const [distritoId, setDistritoId] = useState("");
  const [comisionId, setComisionId] = useState("");

  async function submit(event) {
    event.preventDefault();
    const tempEmail = email;
    const tempPassword = password;
    const tempRole = role;
    const tempDistritoId = distritoId;
    const tempComisionId = comisionId;

    setEmail("");
    setPassword("");
    setDistritoId("");
    setComisionId("");

    const tempAdmin = {
      id: "temp-" + Date.now(),
      email: tempEmail,
      role: tempRole,
      distrito: distritos.find((d) => d.id === Number(tempDistritoId)) || null,
      comision: comisiones.find((c) => c.id === Number(tempComisionId)) || null,
      estado: "activo"
    };

    setAdmins((current) => [tempAdmin, ...current]);

    try {
      await apiRequest("/api/admins", {
        method: "POST",
        body: JSON.stringify({
          email: tempEmail,
          password: tempPassword || undefined,
          role: tempRole,
          distrito_id: tempDistritoId ? Number(tempDistritoId) : undefined,
          comision_id: tempComisionId ? Number(tempComisionId) : undefined
        })
      });
      await onReload();
    } catch (error) {
      setAdmins((current) => current.filter((a) => a.id !== tempAdmin.id));
      setEmail(tempEmail);
      setPassword(tempPassword);
      setDistritoId(tempDistritoId);
      setComisionId(tempComisionId);
      displayError(error);
    }
  }

  return (
    <article className="admin-users-card">
      <div className="section-heading compact"><span>Usuarios</span><h2>Regional, distritos y mesas</h2></div>
      <form className="users-form" onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Rol<select value={role} onChange={(e) => setRole(e.target.value)}><option value="admin">Mesa directiva</option>{user.role === "superadmin" && <option value="regional">Regional</option>}{user.role === "superadmin" && <option value="distrito">Distrito</option>}</select></label>
        <label>Distrito<select value={user.role === "distrito" ? user.distrito_id || "" : distritoId} onChange={(e) => setDistritoId(e.target.value)} disabled={user.role === "distrito"}><option value="">No aplica</option>{distritos.map((d) => <option value={d.id} key={d.id}>{d.codigo}</option>)}</select></label>
        <label>Comisión<select value={comisionId} onChange={(e) => setComisionId(e.target.value)} required={role === "admin"}><option value="">No aplica</option>{comisiones.map((c) => <option value={c.id} key={c.id}>{c.nombre}{c.evento ? ` | ${c.evento.nombre}` : ""}</option>)}</select></label>
        <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} /></label>
        <button className="btn primary"><UserPlus size={15} /> Crear</button>
      </form>
      <div className="admin-list">
        {admins.map((a) => (
          <div key={a.id} className="row-actions">
            <div className="link-row">
              <strong>{a.email}</strong>
              <span>{a.role} | {a.distrito?.codigo || "Regional"} | {a.comision?.nombre || "Todas las comisiones"} | {a.estado}</span>
            </div>
            <button className="icon-btn danger" onClick={() => onDeactivate(a)} aria-label={`Desactivar ${a.email}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}

function RegionalReport({ eventos }) {
  const rows = eventos.map((e) => ({
    Distrito: e.distrito?.codigo,
    Evento: e.nombre,
    Fecha: e.fecha ? new Date(e.fecha).toLocaleDateString("es-DO") : "",
    Delegados: e._count?.delegados || 0,
    Comisiones: e._count?.comisiones || 0
  }));
  return (
    <article className="activity-card">
      <div className="table-title">
        <div><span>Regional</span><h2>Reporte general CELIDER 10</h2></div>
        <div className="table-actions"><button className="btn secondary" onClick={() => exportExcel("SIGEL-regional.xlsx", rows)}><Download size={15} /> Excel</button><button className="btn secondary" onClick={() => window.print()}><Download size={15} /> PDF</button></div>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Distrito</th><th>Evento</th><th>Fecha</th><th>Delegados</th><th>Comisiones</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.Distrito}</td><td>{r.Evento}</td><td>{r.Fecha}</td><td>{r.Delegados}</td><td>{r.Comisiones}</td></tr>)}</tbody></table></div>
    </article>
  );
}

function Dashboard({ user, onLogout }) {
  const [active, setActive] = useState(user.role === "admin" ? "calificaciones" : "inicio");
  const [eventos, setEventos] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [comisiones, setComisiones] = useState([]);
  const [audits, setAudits] = useState([]);
  const [eventoActivo, setEventoActivo] = useState(null);

  useEffect(() => { document.documentElement.dataset.theme = "light"; localStorage.removeItem("sigel-theme"); }, []);

  async function loadAudits() {
    try {
      const data = await apiRequest("/api/audit");
      setAudits(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function load() {
    const [eventRows, districtRows] = await Promise.all([apiRequest("/api/eventos"), apiRequest("/api/eventos/distritos")]);
    setEventos(eventRows);
    setDistritos(districtRows);
    if (user.role === "superadmin" || user.role === "distrito") {
      const [adminRows, commissionRows, auditRows] = await Promise.all([
        apiRequest("/api/admins"),
        apiRequest("/api/admins/comisiones"),
        user.role === "superadmin" ? apiRequest("/api/audit").catch(() => []) : Promise.resolve([])
      ]);
      setAdmins(adminRows);
      setComisiones(commissionRows);
      setAudits(auditRows);
    }
  }

  async function deactivateAdmin(admin) {
    if (!window.confirm(`Desactivar el usuario ${admin.email}?`)) return;
    const previous = [...admins];
    setAdmins((current) => current.filter((a) => a.id !== admin.id));
    try {
      await apiRequest(`/api/admins/${admin.id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      setAdmins(previous);
      displayError(error);
    }
  }

  useEffect(() => {
    let isMounted = true;
    load().catch(console.error);
    const timer = window.setInterval(() => {
      if (isMounted && !eventoActivo && ["inicio", "eventos", "regional"].includes(active)) load().catch(console.error);
    }, 30000);
    return () => { isMounted = false; window.clearInterval(timer); };
  }, [eventoActivo, active]);

  useEffect(() => {
    if (active === "seguridad" && user.role === "superadmin") {
      loadAudits().catch(console.error);
    }
  }, [active, user.role]);

  const totalDelegados = eventos.reduce((sum, e) => sum + (e._count?.delegados || 0), 0);
  const totalComisiones = eventos.reduce((sum, e) => sum + (e._count?.comisiones || 0), 0);
  const isRegional = ["superadmin", "regional"].includes(user.role);
  const navItems = [
    { id: "inicio", label: "Inicio", icon: BarChart3, show: user.role !== "admin" },
    { id: "eventos", label: "Eventos", icon: FileSpreadsheet, show: user.role !== "admin" },
    { id: "calificaciones", label: "Calificaciones", icon: ClipboardCheck, show: true },
    { id: "agenda", label: "Agenda", icon: CalendarDays, show: user.role === "superadmin" || user.role === "distrito" },
    { id: "regional", label: "Regional", icon: Users, show: isRegional },
    { id: "usuarios", label: "Usuarios", icon: UserPlus, show: user.role === "superadmin" || user.role === "distrito" },
    { id: "seguridad", label: "Seguridad", icon: ShieldCheck, show: user.role === "superadmin" }
  ].filter((item) => item.show);

  return (
    <div className="app-shell admin-layout">
      <aside className="app-sidebar">
        <div className="brand sidebar-brand">
          <LogoMark />
          <div><strong>SIGEL CELIDER 10</strong><span>Regional 10</span></div>
        </div>
        <nav className="side-nav" aria-label="Panel de administración">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => { setEventoActivo(null); setActive(id); }}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="role-pill">{user.role}</span>
          <strong>{user.email}</strong>
          <button className="btn secondary full" onClick={onLogout} type="button"><LogOut size={16} /> Cerrar sesión</button>
        </div>
      </aside>
      <main className="workspace">
        {active === "inicio" && (
          <>
            <section className="admin-hero lighthouse-hero">
              <div>
                <span>Bienvenido</span>
                <h1>Bienvenido al panel institucional CELIDER Regional 10</h1>
                <p>Gestiona eventos, carga listados, asigna países, verifica asistencia y consulta auditoría desde un entorno protegido por roles.</p>
              </div>
            </section>
            <section className="metrics-grid">
              <Metric icon={BarChart3} label="Eventos" value={eventos.length} note="Registrados" />
              <Metric icon={Users} label="Delegados" value={totalDelegados} note="Cargados" />
              <Metric icon={FileSpreadsheet} label="Comisiones" value={totalComisiones} note="Configuradas" />
              <Metric icon={ShieldCheck} label="Seguridad" value="Activa" note="Acceso por roles" />
            </section>
          </>
        )}
        {active === "eventos" && (eventoActivo ? <EventoDetalle user={user} evento={eventoActivo} onBack={() => { setEventoActivo(null); load(); }} /> : <EventosPanel user={user} eventos={eventos} setEventos={setEventos} distritos={distritos} onReload={load} setEventoActivo={setEventoActivo} />)}
        {active === "calificaciones" && (eventoActivo ? <EventoDetalle user={user} evento={eventoActivo} initialView="calificaciones" onBack={() => { setEventoActivo(null); load(); }} /> : <EventosPanel user={user} eventos={eventos} setEventos={setEventos} distritos={distritos} onReload={load} setEventoActivo={setEventoActivo} />)}
        {active === "agenda" && <AgendaPanel eventos={eventos} />}
        {active === "regional" && <RegionalReport eventos={eventos} />}
        {active === "usuarios" && <UsuariosPanel user={user} distritos={distritos} comisiones={comisiones} admins={admins} setAdmins={setAdmins} onReload={load} onDeactivate={deactivateAdmin} />}
        {active === "seguridad" && user.role === "superadmin" && <SeguridadPanel audits={audits} onRefresh={loadAudits} />}
      </main>
    </div>
  );
}

function AgendaPanel({ eventos }) {
  const rows = [...eventos].sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
  return (
    <article className="activity-card">
      <div className="table-title">
        <div><span>Agenda</span><h2>Calendario operativo</h2></div>
      </div>
      <div className="agenda-list">
        {rows.length === 0 && <div className="empty-state"><CalendarDays size={24} /><h3>Sin eventos programados</h3><p>Los eventos creados aparecerán en esta agenda.</p></div>}
        {rows.map((evento) => (
          <article key={evento.id}>
            <time>{evento.fecha ? new Date(evento.fecha).toLocaleDateString("es-DO") : "Sin fecha"}</time>
            <div><strong>{evento.nombre}</strong><span>{evento.distrito?.codigo || "Regional"} | {evento._count?.delegados || 0} delegados | {evento._count?.comisiones || 0} comisiones</span></div>
          </article>
        ))}
      </div>
    </article>
  );
}
function SeguridadPanel({ audits, onRefresh }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAudits = audits.filter((a) => {
    const email = a.user?.email || "sistema";
    const text = `${a.action} ${email} ${a.entityType}`.toLowerCase();
    return text.includes(searchTerm.toLowerCase());
  });

  return (
    <article className="activity-card security-card">
      <div className="table-title">
        <div>
          <span>Ciberseguridad y Monitoreo</span>
          <h2>Bitácora de auditoría y detección de incidentes</h2>
        </div>
        <div className="table-actions">
          <input
            type="text"
            className="score-input search-logs"
            placeholder="Buscar acción o usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "240px" }}
          />
          <button className="btn secondary" onClick={onRefresh}>Actualizar logs</button>
        </div>
      </div>

      <div className="security-alert-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>Protección activa:</strong> El sistema audita todos los accesos, inyecciones de código e intentos de intrusión. Las fórmulas de Excel y las inyecciones SQL son interceptadas y registradas para resguardar la seguridad de la Regional 10.
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Acción realizada</th>
              <th>Entidad</th>
              <th>ID</th>
              <th>Detalles / Metadatos</th>
            </tr>
          </thead>
          <tbody>
            {filteredAudits.map((a) => {
              const date = new Date(a.createdAt).toLocaleString("es-DO");
              const isAlert = ["fallido", "incorrecta", "inexistente", "desactivado", "eliminado", "bloqueada", "inyeccion", "incidente", "limpiados", "limpiadas"].some(keyword => a.action.toLowerCase().includes(keyword));
              
              return (
                <tr key={a.id} className={isAlert ? "alert-row" : ""}>
                  <td style={{ whiteSpace: "nowrap" }}>{date}</td>
                  <td><strong>{a.user?.email || "Público / Sistema"}</strong></td>
                  <td><span className="role-pill small">{a.user?.role || "N/A"}</span></td>
                  <td>
                    <span className={`action-badge ${isAlert ? "alert-action" : "success-action"}`}>
                      {a.action}
                    </span>
                  </td>
                  <td><code>{a.entityType}</code></td>
                  <td>{a.entityId || "N/A"}</td>
                  <td>
                    <span className="details-text">
                      {a.changes ? JSON.stringify(a.changes) : "Sin cambios reportados"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function App() {
  const [page, setPage] = useState("home");
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function restore() {
      try {
        const refreshed = await apiRequest("/api/auth/refresh", { method: "POST" });
        setAccessToken(refreshed.access_token);
        const me = await apiRequest("/api/auth/me");
        setUser(me.user);
      } catch {
        setAccessToken(null);
      }
    }
    restore();
  }, []);

  async function logout() {
    setAccessToken(null);
    setUser(null);
    setPage("home");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      await apiRequest("/api/auth/logout", { method: "POST", signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (err) {
      console.warn("Logout background request:", err);
    }
  }

  if (user) return <Dashboard user={user} onLogout={logout} />;
  if (page === "login") return <LoginPage onLogin={setUser} onBackToHome={() => setPage("home")} />;
  return <PrivateHome goLogin={() => setPage("login")} />;
}

createRoot(document.getElementById("root")).render(<App />);






