import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
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
  AlignLeft,
  AlignRight
} from "lucide-react";
import * as XLSX from "xlsx";
import "./styles.css";
import "./home.css";
import { getFlag } from "./utils/flags";

const LOGO_SRC = "/imagenes/logo.png";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");
const DISTRITOS = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"];
const PAISES = [
  "Afganistan", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda", "Arabia Saudita", "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaiyan",
  "Bahamas", "Banglades", "Barbados", "Barein", "Belgica", "Belice", "Benin", "Bielorrusia", "Birmania", "Bolivia", "Bosnia y Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Butan",
  "Cabo Verde", "Camboya", "Camerun", "Canada", "Catar", "Chad", "Chile", "China", "Chipre", "Colombia", "Comoras", "Congo", "Corea del Norte", "Corea del Sur", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba",
  "Dinamarca", "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Arabes Unidos", "Eritrea", "Eslovaquia", "Eslovenia", "Espana", "Estados Unidos", "Estonia", "Esuatini", "Etiopia",
  "Filipinas", "Finlandia", "Fiyi", "Francia", "Gabon", "Gambia", "Georgia", "Ghana", "Granada", "Grecia", "Guatemala", "Guinea", "Guinea-Bisau", "Guinea Ecuatorial", "Guyana",
  "Haiti", "Honduras", "Hungria", "India", "Indonesia", "Irak", "Iran", "Irlanda", "Islandia", "Islas Marshall", "Islas Salomon", "Israel", "Italia", "Jamaica", "Japon", "Jordania",
  "Kazajistan", "Kenia", "Kirguistan", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letonia", "Libano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo",
  "Macedonia del Norte", "Madagascar", "Malasia", "Malaui", "Maldivas", "Mali", "Malta", "Marruecos", "Mauricio", "Mauritania", "Mexico", "Micronesia", "Moldavia", "Monaco", "Mongolia", "Montenegro", "Mozambique",
  "Namibia", "Nauru", "Nepal", "Nicaragua", "Niger", "Nigeria", "Noruega", "Nueva Zelanda", "Oman", "Paises Bajos", "Pakistan", "Palaos", "Panama", "Papua Nueva Guinea", "Paraguay", "Peru", "Polonia", "Portugal",
  "Reino Unido", "Republica Centroafricana", "Republica Checa", "Republica Democratica del Congo", "Republica Dominicana", "Ruanda", "Rumania", "Rusia",
  "Samoa", "San Cristobal y Nieves", "San Marino", "San Vicente y las Granadinas", "Santa Lucia", "Santo Tome y Principe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Siria", "Somalia", "Sri Lanka", "Sudafrica", "Sudan", "Sudan del Sur", "Suecia", "Suiza", "Surinam",
  "Tailandia", "Tanzania", "Tayikistan", "Timor Oriental", "Togo", "Tonga", "Trinidad y Tobago", "Tunez", "Turkmenistan", "Turquia", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistan", "Vanuatu", "Vaticano", "Venezuela", "Vietnam", "Yemen", "Yibuti", "Zambia", "Zimbabue"
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
  argumentacion: { label: "Argumentacion", max: 25 },
  negociacion: { label: "Negociacion", max: 20 },
  liderazgo: { label: "Liderazgo", max: 15 },
  redaccion: { label: "Redaccion", max: 25 }
};

function ponderada(row) {
  return Object.entries(criterios).reduce((sum, [key, item]) => sum + ((Number(row[key]) || 0) / item.max) * item.max, 0);
}

function mapDelegado(row) {
  const cal = row.calificacion || {};
  return {
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido || "",
    designacion: row.designacion || "",
    comision: row.comision?.nombre || "",
    comisionObj: row.comision || null,
    comisionId: row.comisionId || row.comision_id || row.comision?.id || "",
    avanza: Boolean(row.avanzaEtapa || row.avanza_etapa || cal.pasaMinumeXvii),
    oratoria: cal.oratoria || 0,
    argumentacion: cal.argumentacion || 0,
    negociacion: cal.negociacion || 0,
    liderazgo: cal.liderazgo || 0,
    redaccion: cal.redaccion || 0,
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
          <label>Contrasena<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary full" disabled={loading}><Lock size={16} /> {loading ? "Validando..." : "Ingresar"}</button>
          <button type="button" className="btn secondary full" style={{ marginTop: "10px" }} onClick={onBackToHome}>Volver al inicio</button>
        </form>
      </section>
    </main>
  );
}

function PrivateHome({ goLogin }) {
  const [align, setAlign] = useState(() => localStorage.getItem("sigel-align") || "left");
  useEffect(() => { document.documentElement.dataset.theme = "light"; localStorage.removeItem("sigel-theme"); }, []);
  useEffect(() => { document.documentElement.dataset.align = align; localStorage.setItem("sigel-align", align); }, [align]);
  return (
    <main className="home-shell private-home">
      <header className="home-topbar">
        <div className="brand inverse"><LogoMark /><div><strong>SIGEL CELIDER 10</strong><span>Regional 10</span></div></div>
        <div className="home-controls"><button className="icon-btn" onClick={() => setAlign((value) => value === "left" ? "right" : "left")} aria-label="Cambiar alineación">{align === "left" ? <AlignRight size={16} /> : <AlignLeft size={16} />}</button><button className="btn small light" onClick={goLogin}><Lock size={14} /> Iniciar sesión</button></div>
      </header>
      <section className="home-hero private">
        <div className="home-copy">
          <span>Plataforma institucional privada</span>
          <h1>Gestion de eventos, asistencia y evaluaciones CELIDER</h1>
          <p>Gestiona eventos, delegados, comisiones y evaluaciones desde una plataforma institucional segura.</p>
          <button className="btn primary" onClick={goLogin}><ShieldCheck size={16} /> Acceder al panel</button>
        </div>
        <div className="home-status">
          <div className="status-header"><ShieldCheck size={18} /><span>Operación institucional</span></div>
          <strong>Gestión segura</strong>
          <p>Usuarios por rol, asignaciones por distrito y comisiones, auditoría y datos protegidos.</p>
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
      window.alert(error.message);
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
      window.alert(error.message);
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
          {eventos.map((evento) => (
            <div key={evento.id} className="row-actions">
              <button className="link-row" onClick={() => setEventoActivo(evento)}>
                <strong>{evento.nombre}</strong>
                <span>{evento.distrito?.codigo} | {evento.fecha ? new Date(evento.fecha).toLocaleDateString("es-DO") : "Sin fecha"} | {evento._count?.delegados || 0} delegados | {evento._count?.comisiones || 0} comisiones</span>
              </button>
              {canCreate && <button className="icon-btn danger" onClick={() => deleteEvento(evento.id)} aria-label="Eliminar evento"><Trash2 size={16} /></button>}
            </div>
          ))}
        </div>
      </article>
      <article className="activity-card">
        <div className="section-heading compact"><span>Limite operativo</span><h2>Hasta 30 eventos</h2></div>
        <p>Cada distrito puede mantener hasta 30 eventos. El regional visualiza todo, pero no altera la data distrital.</p>
      </article>
    </section>
  );
}

function EventoDetalle({ evento, onBack }) {
  const [delegados, setDelegados] = useState([]);
  const [comisionId, setComisionId] = useState("");
  const [paisQuery, setPaisQuery] = useState("");
  const [paises, setPaises] = useState([]);
  const [customCountry, setCustomCountry] = useState("");
  const [customCountries, setCustomCountries] = useState(() => JSON.parse(localStorage.getItem("sigel-paises") || "[]"));
  const [modo, setModo] = useState("individual");
  const comisiones = useMemo(() => {
    const map = new Map();
    delegados.forEach((d) => {
      if (d.comisionId && !map.has(d.comisionId)) {
        map.set(d.comisionId, d.comisionObj || d.comision);
      }
    });
    return [...map.entries()].map(([id, val]) => ({
      id,
      nombre: typeof val === "string" ? val : val.nombre,
      modoAsignacion: typeof val === "object" ? val.modoAsignacion : "individual"
    }));
  }, [delegados]);

  useEffect(() => {
    if (comisionId) {
      const selectedCom = comisiones.find((c) => Number(c.id) === Number(comisionId));
      if (selectedCom) {
        setModo(selectedCom.modoAsignacion || "individual");
      }
    }
  }, [comisionId, comisiones]);

  const presentes = delegados.filter((d) => d.asistencia === "presente_votando");

  async function load() {
    const data = await apiRequest(`/api/eventos/${evento.id}/delegados`);
    setDelegados(data.map(mapDelegado));
  }

  useEffect(() => {
    load().catch((error) => window.alert(error.message));
    const timer = window.setInterval(() => load().catch(console.error), 5000);
    return () => window.clearInterval(timer);
  }, [evento.id]);

  async function upload(kind, file) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await apiRequest(`/api/eventos/${evento.id}/import/${kind}`, { method: "POST", body });
      await load();
      if (res.errors && res.errors.length > 0) {
        window.alert(`Importación completada con algunos errores:\n${res.errors.map((e) => `Fila ${e.row}: ${e.error}`).join("\n")}`);
      } else {
        window.alert(`¡Importación exitosa! Se cargaron ${res.imported_count} registros.`);
      }
    } catch (error) {
      window.alert(error.message);
    }
  }

  async function updateAsistencia(id, estado) {
    const previous = [...delegados];
    setDelegados((current) => current.map((d) => d.id === id ? { ...d, asistencia: estado } : d));
    try {
      await apiRequest(`/api/eventos/${evento.id}/asistencia/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
      await load();
    } catch (error) {
      setDelegados(previous);
      window.alert(error.message);
    }
  }

  async function updateCalificacion(id, key, value) {
    let nextValue = value;
    if (criterios[key]) {
      nextValue = Math.max(0, Math.min(Number(value), criterios[key].max));
    }
    const previous = [...delegados];
    setDelegados((current) => current.map((d) => d.id === id ? { ...d, [key]: nextValue } : d));
    try {
      await apiRequest(`/api/calificaciones/${id}`, { method: "PATCH", body: JSON.stringify({ [key]: nextValue }) });
      await load();
    } catch (error) {
      setDelegados(previous);
      window.alert(error.message);
    }
  }

  async function updateAvanza(id, avanza) {
    const previous = [...delegados];
    setDelegados((current) => current.map((d) => d.id === id ? { ...d, avanza } : d));
    try {
      await apiRequest(`/api/eventos/${evento.id}/avanza/${id}`, { method: "PATCH", body: JSON.stringify({ avanza }) });
      await load();
    } catch (error) {
      setDelegados(previous);
      window.alert(error.message);
    }
  }

  async function asignar() {
    try { await apiRequest(`/api/eventos/${evento.id}/asignar`, { method: "POST", body: JSON.stringify({ comision_id: Number(comisionId), modo, paises }) }); await load(); } catch (error) { window.alert(error.message); }
  }

  function exportEvento() {
    exportExcel(`SIGEL-${evento.nombre}.xlsx`, delegados.map((d) => ({
      Nombre: d.nombre,
      Comision: d.comision,
      Designacion: d.designacion,
      Asistencia: d.asistencia,
      Ponderada: ponderada(d).toFixed(2),
      Avanza: d.avanza ? "Si" : "No"
    })));
  }

  const allCountries = [...new Set([...PAISES, ...customCountries])].sort((a, b) => a.localeCompare(b));
  const paisesVisibles = useMemo(() => {
    const selectedSet = new Set(paises);
    const filtered = allCountries.filter((p) => p.toLowerCase().includes(paisQuery.toLowerCase()));
    const combined = [...paises, ...filtered.filter((p) => !selectedSet.has(p))];
    return combined.slice(0, 32);
  }, [allCountries, paises, paisQuery]);

  async function clearDelegados() {
    if (!window.confirm("¿Seguro que deseas eliminar todos los delegados importados de este evento?")) return;
    try {
      await apiRequest(`/api/eventos/${evento.id}/delegados`, { method: "DELETE" });
      await load();
    } catch (error) { window.alert(error.message); }
  }

  async function clearComisiones() {
    if (!window.confirm("¿Seguro que deseas eliminar todas las comisiones (y delegados) importados de este evento?")) return;
    try {
      await apiRequest(`/api/eventos/${evento.id}/comisiones`, { method: "DELETE" });
      await load();
    } catch (error) { window.alert(error.message); }
  }

  async function guardarModoComision() {
    if (!comisionId) return;
    try {
      await apiRequest(`/api/eventos/${evento.id}/comisiones/${comisionId}`, {
        method: "PATCH",
        body: JSON.stringify({ modo })
      });
      await load();
      window.alert("Modo de asignación de la comisión guardado correctamente.");
    } catch (error) { window.alert(error.message); }
  }

  function addCountry(event) {
    event.preventDefault();
    const name = customCountry.trim();
    if (!name || allCountries.some((country) => country.toLowerCase() === name.toLowerCase())) return;
    const next = [...customCountries, name];
    setCustomCountries(next);
    localStorage.setItem("sigel-paises", JSON.stringify(next));
    setPaises((x) => x.includes(name) ? x : [...x, name]);
    setCustomCountry("");
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
      
      <div className="excel-help-card">
        <div className="excel-help-header">
          <FileSpreadsheet size={16} />
          <h4>Reglas para Carga de Documentación Excel (Siga el orden obligatorio)</h4>
        </div>
        <div className="excel-help-content">
          <div className="excel-help-col highlighted-col">
            <h5>⚠️ PASO 1: Subir Comisiones Primero</h5>
            <ul>
              <li>El archivo debe estar en formato <code>.xlsx</code>.</li>
              <li>Columna obligatoria en la primera fila: <code>comisiones</code>.</li>
              <li><strong>Regla de oro:</strong> Cree y suba las comisiones primero. Si no existen las comisiones en el evento, el archivo de delegados rebotará con error.</li>
            </ul>
          </div>
          <div className="excel-help-col">
            <h5>PASO 2: Subir Delegados Después</h5>
            <ul>
              <li>El archivo debe estar en formato <code>.xlsx</code>.</li>
              <li>Columna obligatoria en la primera fila: <code>nombre</code>. No se requieren más columnas obligatorias.</li>
              <li><strong>Importante:</strong> Debe escribir el **nombre completo** del delegado en esta columna.</li>
              <li>El sistema detectará automáticamente el primer apellido del nombre completo para realizar la asignación de Corte ("Su Excelencia [Apellido]").</li>
              <li>No use fórmulas de Excel ni caracteres maliciosos.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="event-tools">
        <div className="tool-upload-group">
          <label className="file-drop"><Upload size={18} /> Subir comisiones Excel<input type="file" accept=".xlsx" onChange={(e) => upload("comisiones", e.target.files?.[0])} /></label>
          {comisiones.length > 0 && <button className="btn danger small-btn" onClick={clearComisiones}><Trash2 size={14} /> Limpiar Comisiones</button>}
        </div>
        <div className="tool-upload-group">
          <label className="file-drop"><FileSpreadsheet size={18} /> Subir delegados Excel<input type="file" accept=".xlsx" onChange={(e) => upload("delegados", e.target.files?.[0])} /></label>
          {delegados.length > 0 && <button className="btn danger small-btn" onClick={clearDelegados}><Trash2 size={14} /> Limpiar Delegados</button>}
        </div>
      </div>
      <div className="assignment-panel">
        <div className="section-heading compact"><span>Asignaciones</span><h2>Paises por comite</h2><p>Para Corte Internacional de Justicia se asigna "Su Excelencia" y apellido, sin pais.</p></div>
        <div className="inline-form">
          <label>Comision<select value={comisionId} onChange={(e) => setComisionId(e.target.value)}><option value="">Seleccionar</option>{comisiones.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select></label>
          <label>Modo<select value={modo} onChange={(e) => setModo(e.target.value)}><option value="individual">Individual</option><option value="duplas">Duplas</option></select></label>
          <button className="btn secondary" type="button" onClick={guardarModoComision} disabled={!comisionId}>Actualizar Modo</button>
          <label>Buscar pais<input value={paisQuery} onChange={(e) => setPaisQuery(e.target.value)} placeholder="Buscar pais" /></label>
          <button className="btn primary" type="button" onClick={asignar} disabled={!comisionId}><CheckCircle2 size={15} /> Asignar</button>
        </div>
        <form className="country-add" onSubmit={addCountry}><input value={customCountry} onChange={(e) => setCustomCountry(e.target.value)} placeholder="Añadir país o territorio" /><button className="btn secondary" type="submit">Añadir</button></form>
        <div className="country-picker">{paisesVisibles.map((pais) => <button type="button" key={pais} className={paises.includes(pais) ? "active" : ""} onClick={() => setPaises((x) => x.includes(pais) ? x.filter((p) => p !== pais) : [...x, pais])}>{getFlag(pais, "picker-flag")} <span>{pais}</span></button>)}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Delegado</th><th>Comision</th><th>Asignacion</th><th>Pase de lista</th>{Object.entries(criterios).map(([k, c]) => <th key={k}>{c.label}<small>0-{c.max}</small></th>)}<th>Total</th><th>Avanza</th></tr></thead>
          <tbody>
            {delegados.map((d) => (
              <tr key={d.id} className={d.asistencia === "ausente" ? "muted-row" : ""}>
                <td><strong>{d.nombre} {d.apellido}</strong></td>
                <td>{d.comision || "Sin comision"}</td>
                <td>
                  <div className="designacion-cell">
                    {getFlag(d.designacion)}
                    <span>{d.designacion || "Pendiente"}</span>
                  </div>
                </td>
                <td><select value={d.asistencia} onChange={(e) => updateAsistencia(d.id, e.target.value)}><option value="presente_votando">Presente/Votando</option><option value="ausente">Ausente</option></select></td>
                {Object.keys(criterios).map((key) => <td key={key}><input className="score-input" type="number" min="0" max={criterios[key].max} value={d[key]} disabled={d.asistencia === "ausente"} onChange={(e) => updateCalificacion(d.id, key, Number(e.target.value))} /></td>)}
                <td><strong>{d.asistencia === "ausente" ? "No aplica" : ponderada(d).toFixed(2)}</strong></td>
                <td><input type="checkbox" checked={d.avanza} onChange={(e) => updateAvanza(d.id, e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="helper-text">{presentes.length} presentes pasan al apartado de calificacion. Los ausentes quedan fuera del calculo operativo.</p>
    </section>
  );
}

function UsuariosPanel({ distritos, comisiones, admins, setAdmins, onReload, onDeactivate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("distrito");
  const [distritoId, setDistritoId] = useState("");
  const [comisionId, setComisionId] = useState("");

  async function submit(event) {
    event.preventDefault();
    const tempEmail = email;
    const tempPassword = password;
    const tempRole = role;
    const tempDistritoId = distritoId;
    const tempComisionId = comisionId;

    // Reset inputs immediately
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
      window.alert(error.message);
    }
  }

  return (
    <article className="admin-users-card">
      <div className="section-heading compact"><span>Usuarios</span><h2>Regional, distritos y mesas</h2></div>
      <form className="inline-form" onSubmit={submit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Rol<select value={role} onChange={(e) => setRole(e.target.value)}><option value="regional">Regional</option><option value="distrito">Distrito</option><option value="admin">Mesa directiva</option></select></label>
        <label>Distrito<select value={distritoId} onChange={(e) => setDistritoId(e.target.value)}><option value="">No aplica</option>{distritos.map((d) => <option value={d.id} key={d.id}>{d.codigo}</option>)}</select></label>
        <label>Comisión<select value={comisionId} onChange={(e) => setComisionId(e.target.value)}><option value="">No aplica</option>{comisiones.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}</select></label>
        <label>Contrasena<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} /></label>
        <button className="btn primary"><UserPlus size={15} /> Crear</button>
      </form>
      <div className="admin-list">{admins.map((a) => <div key={a.id}><strong>{a.email}</strong><span>{a.role} | {a.distrito?.codigo || "Regional"} | {a.comision?.nombre || "Todas las comisiones"} | {a.estado}</span><button className="icon-btn danger" onClick={() => onDeactivate(a)} aria-label={`Desactivar ${a.email}`}><Trash2 size={16} /></button></div>)}</div>
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
  const [active, setActive] = useState("dashboard");
  const [eventos, setEventos] = useState([]);
  const [distritos, setDistritos] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [comisiones, setComisiones] = useState([]);
  const [audits, setAudits] = useState([]);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [align, setAlign] = useState(() => localStorage.getItem("sigel-align") || "left");

  useEffect(() => { document.documentElement.dataset.theme = "light"; localStorage.removeItem("sigel-theme"); }, []);
  useEffect(() => { document.documentElement.dataset.align = align; localStorage.setItem("sigel-align", align); }, [align]);

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
    if (user.role === "superadmin") {
      const [adminRows, commissionRows, auditRows] = await Promise.all([
        apiRequest("/api/admins"),
        apiRequest("/api/admins/comisiones"),
        apiRequest("/api/audit").catch(() => [])
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
      window.alert(error.message);
    }
  }

  useEffect(() => {
    let active = true;
    const refresh = () => load().catch(console.error);
    refresh();
    const timer = window.setInterval(() => { if (active && !eventoActivo) refresh(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [eventoActivo]);

  useEffect(() => {
    if (active === "seguridad" && user.role === "superadmin") {
      loadAudits().catch(console.error);
    }
  }, [active, user.role]);

  const totalDelegados = eventos.reduce((sum, e) => sum + (e._count?.delegados || 0), 0);
  const totalComisiones = eventos.reduce((sum, e) => sum + (e._count?.comisiones || 0), 0);
  const isRegional = ["superadmin", "regional"].includes(user.role);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" onClick={onLogout} style={{ cursor: "pointer" }} title="Cerrar sesión y volver al inicio">
          <LogoMark />
          <div><strong>SIGEL CELIDER 10</strong><span>{user.email}</span></div>
        </div>
        <nav className="nav-actions">
          <button className={active === "dashboard" ? "active" : ""} onClick={() => setActive("dashboard")}>Dashboard</button>
          <button className={active === "eventos" ? "active" : ""} onClick={() => setActive("eventos")}>Eventos</button>
          {isRegional && <button className={active === "regional" ? "active" : ""} onClick={() => setActive("regional")}>Regional</button>}
          {user.role === "superadmin" && <button className={active === "usuarios" ? "active" : ""} onClick={() => setActive("usuarios")}>Usuarios</button>}
          {user.role === "superadmin" && <button className={active === "seguridad" ? "active" : ""} onClick={() => setActive("seguridad")}>Seguridad</button>}
        </nav>
        <div className="header-actions"><button className="icon-btn" onClick={() => setAlign((value) => value === "left" ? "right" : "left")} aria-label="Cambiar alineación">{align === "left" ? <AlignRight size={16} /> : <AlignLeft size={16} />}</button><span className="role-pill">{user.role}</span><button className="icon-btn" onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={17} /></button></div>
      </header>
      <main className="workspace">
        <section className="admin-hero"><div><span>Panel seguro</span><h1>Operacion CELIDER Regional 10</h1><p>Eventos por distrito, pase de lista, calificaciones, asignaciones y reportes exportables.</p></div></section>
        {active === "dashboard" && <section className="metrics-grid"><Metric icon={BarChart3} label="Eventos" value={eventos.length} note="Registrados" /><Metric icon={Users} label="Delegados" value={totalDelegados} note="Cargados" /><Metric icon={FileSpreadsheet} label="Comisiones" value={totalComisiones} note="Configuradas" /><Metric icon={ShieldCheck} label="Seguridad" value="Activa" note="Acceso por roles" /></section>}
        {active === "eventos" && (eventoActivo ? <EventoDetalle evento={eventoActivo} onBack={() => { setEventoActivo(null); load(); }} /> : <EventosPanel user={user} eventos={eventos} setEventos={setEventos} distritos={distritos} onReload={load} setEventoActivo={setEventoActivo} />)}
        {active === "regional" && <RegionalReport eventos={eventos} />}
        {active === "usuarios" && <UsuariosPanel distritos={distritos} comisiones={comisiones} admins={admins} setAdmins={setAdmins} onReload={load} onDeactivate={deactivateAdmin} />}
        {active === "seguridad" && user.role === "superadmin" && <SeguridadPanel audits={audits} onRefresh={loadAudits} />}
      </main>
    </div>
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
          <h2>Bitácora de Auditoría y Detección de Incidentes</h2>
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
          <strong>Protección en Tiempo Real Activa:</strong> El sistema audita todos los accesos, inyecciones de código e intentos de intrusión. Las fórmulas de Excel y las inyecciones SQL son interceptadas y registradas para resguardar la seguridad de la Regional 10.
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Acción Realizada</th>
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
    await apiRequest("/api/auth/logout", { method: "POST" }).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setPage("home");
  }

  if (user) return <Dashboard user={user} onLogout={logout} />;
  if (page === "login") return <LoginPage onLogin={setUser} onBackToHome={() => setPage("home")} />;
  return <PrivateHome goLogin={() => setPage("login")} />;
}

createRoot(document.getElementById("root")).render(<App />);
