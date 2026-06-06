import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  FileSpreadsheet,
  Gauge,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Upload,
  UserPlus,
  Users
} from "lucide-react";
import * as XLSX from "xlsx";
import "./styles.css";
import "./home.css";

const LOGO_SRC = "/imagenes/logo.png";

const criterios = {
  oratoria: {
    label: "Oratoria",
    max: 15,
    peso: 15,
    niveles: [
      ["Excelente", "13-15", "Cohesión, progresión temática, registro diplomático impecable y lenguaje no verbal persuasivo."],
      ["Bueno", "10-12", "Comunica con coherencia, seguridad y estructura clara."],
      ["Normal", "7-9", "Ideas comprensibles con fluidez limitada o presencia funcional."],
      ["Regular", "4-6", "Fallas de fluidez, claridad o proyección; dependencia marcada de notas."],
      ["Malo", "0-3", "Discurso sin estructura, poca proyección o comunicación no comprensible."]
    ]
  },
  argumentacion: {
    label: "Argumentación",
    max: 25,
    peso: 25,
    niveles: [
      ["Excelente", "22-25", "Argumentos efectivos, evidencia contrastada y cadena causal explícita."],
      ["Bueno", "17-21", "Argumentos relevantes y bien construidos, con razonamiento seguible."],
      ["Normal", "12-16", "Argumentos relevantes con fallas lógicas o simplificación."],
      ["Regular", "6-11", "Predominan afirmaciones sin garantía ni evidencia suficiente."],
      ["Malo", "0-5", "Contenido no relevante, sin estructura argumentativa ni evidencia."]
    ]
  },
  negociacion: {
    label: "Negociación",
    max: 20,
    peso: 20,
    niveles: [
      ["Excelente", "17-20", "Integra bloques, identifica intereses y lidera acuerdos realizables."],
      ["Bueno", "13-16", "Negocia con flexibilidad, construye consensos y sostiene su postura."],
      ["Normal", "9-12", "Participa aceptablemente, con iniciativa limitada para consensos amplios."],
      ["Regular", "5-8", "Participación escasa, rígida o pasiva en la construcción de acuerdos."],
      ["Malo", "0-4", "No participa o bloquea acuerdos sin fundamento."]
    ]
  },
  liderazgo: {
    label: "Liderazgo",
    max: 15,
    peso: 15,
    niveles: [
      ["Excelente", "13-15", "Liderazgo democrático, inclusivo y capaz de elevar el desempeño del bloque."],
      ["Bueno", "10-12", "Influencia constructiva, escucha e integración sostenida."],
      ["Normal", "7-9", "Iniciativa puntual, respeto y colaboración con influencia intermitente."],
      ["Regular", "4-6", "Liderazgo limitado y actitud mayormente pasiva."],
      ["Malo", "0-3", "Sin liderazgo o con actitud disruptiva."]
    ]
  },
  redaccion: {
    label: "Redacción",
    max: 25,
    peso: 25,
    niveles: [
      ["Excelente", "22-25", "Textos técnicos con cohesión, cláusulas precisas y fuentes confiables."],
      ["Bueno", "17-21", "Buena estructura, cohesión y formato con pocas fallas."],
      ["Normal", "12-16", "Comprensible, con estructura básica y fallas que no impiden lectura."],
      ["Regular", "6-11", "Ideas desorganizadas, formato incorrecto o poco lenguaje técnico."],
      ["Malo", "0-5", "No cumple estructura, formato ni registro mínimo."]
    ]
  }
};

const inicial = [
  {
    id: 1,
    nombre: "Ana Isabel Duarte",
    designacion: "República Dominicana",
    comision: "Asamblea General",
    estado: "presente_votando",
    oratoria: 14,
    argumentacion: 23,
    negociacion: 18,
    liderazgo: 14,
    redaccion: 24,
    pasa: true,
    mencion: "Mejor Delegada",
    feedback: "Excelente dominio del registro diplomático y liderazgo sostenido."
  },
  {
    id: 2,
    nombre: "Carlos Méndez",
    designacion: "Francia",
    comision: "Consejo de Seguridad",
    estado: "presente_votando",
    oratoria: 11,
    argumentacion: 20,
    negociacion: 15,
    liderazgo: 10,
    redaccion: 19,
    pasa: false,
    mencion: "",
    feedback: "Buen avance argumentativo. Puede reforzar evidencia y cierre."
  },
  {
    id: 3,
    nombre: "Sofía Batista",
    designacion: "Brasil",
    comision: "Derechos Humanos",
    estado: "presente_ausente",
    oratoria: 9,
    argumentacion: 16,
    negociacion: 11,
    liderazgo: 8,
    redaccion: 15,
    pasa: false,
    mencion: "",
    feedback: "Participación funcional con oportunidades claras de mayor iniciativa."
  }
];

function calcularPonderada(row) {
  return Object.entries(criterios).reduce((total, [key, meta]) => {
    const valor = Number(row[key]) || 0;
    return total + (valor / meta.max) * meta.peso;
  }, 0);
}

function nivel(key, value) {
  const valor = Number(value) || 0;
  const niveles = criterios[key].niveles;
  const encontrado = niveles.find(([, rango]) => {
    const [min, max] = rango.split("-").map(Number);
    return valor >= min && valor <= max;
  });
  return encontrado?.[0] || "Malo";
}

function criterioDetalle(row, key) {
  const meta = criterios[key];
  const valor = Number(row[key]) || 0;
  const aporte = (valor / meta.max) * meta.peso;
  return { ...meta, key, valor, aporte, nivel: nivel(key, valor) };
}

function estadoLabel(value) {
  return value === "presente_votando" ? "Presente/Votando" : "Presente/Ausente";
}

function normalizarDelegado(item, index) {
  const nombre = item.Nombre || item.nombre || item.Delegado || item.delegado || "";
  const designacion = item.Designación || item.Designacion || item.designacion || item.Delegación || item.Delegacion || item.delegacion || "";
  const comision = item.Comisión || item.Comision || item.comision || item.Comité || item.Comite || item.comite || "";

  return {
    id: Date.now() + index,
    nombre: String(nombre).trim(),
    designacion: String(designacion).trim(),
    comision: String(comision).trim(),
    estado: "presente_votando",
    oratoria: 0,
    argumentacion: 0,
    negociacion: 0,
    liderazgo: 0,
    redaccion: 0,
    pasa: false,
    mencion: "",
    feedback: ""
  };
}

function crearMovimiento(tipo, detalle, usuario = "Superadmin") {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    hora: new Date().toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }),
    tipo,
    usuario,
    detalle
  };
}

function LogoMark({ size = "md" }) {
  return (
    <div className={`logo-mark ${size}`} aria-label="Logo institucional">
      <img src={LOGO_SRC} alt="Logo SIGEL" />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <article className="metric-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  );
}

function exportarExcel(rows) {
  const data = rows.map((row) => ({
    Nombre: row.nombre,
    Delegación: row.designacion,
    Comisión: row.comision,
    Estado: estadoLabel(row.estado),
    Oratoria: row.oratoria,
    Argumentación: row.argumentacion,
    Negociación: row.negociacion,
    Liderazgo: row.liderazgo,
    Redacción: row.redaccion,
    "Calificación Ponderada": calcularPonderada(row).toFixed(2),
    Mención: row.mencion || "",
    "Avanza / Reconocimiento": row.pasa ? "Sí" : "No",
    Retroalimentación: row.feedback || ""
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
  XLSX.writeFile(wb, "SIGEL-calificaciones.xlsx");
}

function RubricasPanel() {
  const [active, setActive] = useState("oratoria");
  const meta = criterios[active];

  return (
    <aside className="rubric-panel">
      <div className="section-heading compact">
        <span>Rúbricas PLERD</span>
        <h2>Criterios y puntaje</h2>
        <p>Consulta el rango antes de asignar cada calificación.</p>
      </div>
      <div className="rubric-tabs">
        {Object.entries(criterios).map(([key, item]) => (
          <button
            key={key}
            className={active === key ? "active" : ""}
            type="button"
            onClick={() => setActive(key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="rubric-summary">
        <strong>{meta.label}</strong>
        <span>0-{meta.max} pts | Peso {meta.peso}%</span>
      </div>
      <div className="rubric-list">
        {meta.niveles.map(([name, range, descriptor]) => (
          <article key={name}>
            <div>
              <strong>{name}</strong>
              <span>{range} pts</span>
            </div>
            <p>{descriptor}</p>
          </article>
        ))}
      </div>
    </aside>
  );
}

function CalificacionesTable({ rows, setRows, scope = "all", onAudit }) {
  const [filterOpen, setFilterOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [delegacion, setDelegacion] = useState("Todas");
  const baseRows = scope === "all" ? rows : rows.filter((row) => row.comision === scope);
  const delegaciones = ["Todas", ...new Set(baseRows.map((row) => row.designacion).filter(Boolean))];
  const visibles = baseRows.filter((row) => {
    const q = query.trim().toLowerCase();
    const matchesText = !q || row.nombre.toLowerCase().includes(q) || row.designacion.toLowerCase().includes(q);
    const matchesDelegacion = delegacion === "Todas" || row.designacion === delegacion;
    return matchesText && matchesDelegacion;
  });

  function update(id, key, value) {
    const delegado = rows.find((row) => row.id === id);
    setRows((actuales) =>
      actuales.map((row) => {
        if (row.id !== id) return row;
        if (criterios[key]) {
          const limpio = Math.max(0, Math.min(Number(value), criterios[key].max));
          return { ...row, [key]: limpio };
        }
        return { ...row, [key]: value };
      })
    );
    if (delegado && onAudit) {
      onAudit("Calificación actualizada", `${delegado.nombre} (${delegado.comision}): ${criterios[key]?.label || key} modificado.`);
    }
  }

  return (
    <div className="table-card">
      <div className="table-title">
        <div>
          <span>Registro de evaluación</span>
          <h2>Calificaciones por delegado</h2>
        </div>
        <div className="table-actions">
          <button className="btn small ghost" type="button" onClick={() => setFilterOpen(!filterOpen)}>
            <Filter size={15} /> Filtro
          </button>
          <button className="btn small ghost" type="button" onClick={() => exportarExcel(visibles)}>
            <Download size={15} /> Exportar
          </button>
        </div>
      </div>
      {filterOpen && (
        <div className="filter-panel">
          <label>
            Buscar por nombre o delegación
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ejemplo: Ana, Francia, Brasil"
            />
          </label>
          <label>
            Delegación
            <select value={delegacion} onChange={(event) => setDelegacion(event.target.value)}>
              {delegaciones.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <div className="filter-count">
            <strong>{visibles.length}</strong>
            <span>delegados visibles</span>
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Delegado</th>
              <th>Comisión</th>
              <th>Estado</th>
              {Object.entries(criterios).map(([key, item]) => (
                <th key={key}>{item.label}<small>0-{item.max}</small></th>
              ))}
              <th>Ponderada</th>
              <th>Avanza</th>
              <th>Mención / retroalimentación</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.nombre}</strong>
                  <span>{row.designacion}</span>
                </td>
                <td>{row.comision}</td>
                <td>
                  <select value={row.estado} onChange={(event) => update(row.id, "estado", event.target.value)}>
                    <option value="presente_votando">Presente/Votando</option>
                    <option value="presente_ausente">Presente/Ausente</option>
                  </select>
                </td>
                {Object.keys(criterios).map((key) => (
                  <td key={key}>
                    <input
                      className="score-input"
                      type="number"
                      min="0"
                      max={criterios[key].max}
                      value={row[key]}
                      onChange={(event) => update(row.id, key, event.target.value)}
                      aria-label={`${criterios[key].label} de ${row.nombre}`}
                    />
                    <small className={`level ${nivel(key, row[key]).toLowerCase()}`}>{nivel(key, row[key])}</small>
                  </td>
                ))}
                <td>
                  <strong className="score-total">{calcularPonderada(row).toFixed(2)}</strong>
                  <span>de 100</span>
                </td>
                <td>
                  <label className="switch-line">
                    <input type="checkbox" checked={row.pasa} onChange={(event) => update(row.id, "pasa", event.target.checked)} />
                    <span>{row.pasa ? "Sí" : "No"}</span>
                  </label>
                </td>
                <td className="feedback-cell">
                  {row.pasa && (
                    <input
                      value={row.mencion}
                      maxLength="500"
                      onChange={(event) => update(row.id, "mencion", event.target.value)}
                      placeholder="Mención"
                    />
                  )}
                  <textarea
                    value={row.feedback}
                    maxLength="500"
                    onChange={(event) => update(row.id, "feedback", event.target.value)}
                    placeholder="Retroalimentación individual"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PublicRanking({ rows, published }) {
  const [query, setQuery] = useState("");
  const [comision, setComision] = useState("Todas");
  const comisiones = ["Todas", ...new Set(rows.map((row) => row.comision))];
  const ranking = useMemo(() => {
    return rows
      .filter((row) => comision === "Todas" || row.comision === comision)
      .filter((row) => row.nombre.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => calcularPonderada(b) - calcularPonderada(a));
  }, [rows, query, comision]);

  if (!published) {
    return (
      <section className="empty-state">
        <ShieldCheck size={34} />
        <h2>Resultados pendientes de publicación</h2>
        <p>El ranking público se activará cuando el superadmin autorice la publicación final.</p>
      </section>
    );
  }

  return (
    <section className="ranking-panel">
      <div className="section-heading">
        <span>Ranking público</span>
        <h2>Resultados publicados</h2>
      </div>
      <div className="ranking-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar delegado" />
        <select value={comision} onChange={(event) => setComision(event.target.value)}>
          {comisiones.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
      <div className="ranking-list">
        {ranking.map((row, index) => (
          <article key={row.id}>
            <strong>{index + 1}</strong>
            <div>
              <h3>{row.nombre}</h3>
              <p>{row.designacion} | {row.comision}</p>
            </div>
            <span>{calcularPonderada(row).toFixed(2)}</span>
            <em>{row.mencion || "Sin mención"}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function UploadDelegados({ setRows, onAudit }) {
  const [mensaje, setMensaje] = useState("Formato requerido: Nombre, Delegación, Comisión.");

  function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const data = new Uint8Array(loadEvent.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json(sheet);
      const delegados = records.map(normalizarDelegado).filter((row) => row.nombre && row.designacion && row.comision);

      if (!delegados.length) {
        setMensaje("No se encontraron filas válidas. Revisa que existan las columnas Nombre, Delegación y Comisión.");
        return;
      }

      setRows(delegados);
      setMensaje(`${delegados.length} delegados cargados correctamente desde ${file.name}.`);
      onAudit("Listado importado", `${delegados.length} delegados cargados desde Excel.`);
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <article className="upload-card">
      <div className="section-heading compact">
        <span>Importación inicial</span>
        <h2>Subir listado de delegados</h2>
        <p>Carga un archivo `.xlsx` con las columnas exactas: Nombre, Delegación y Comisión.</p>
      </div>
      <label className="file-drop">
        <Upload size={20} />
        <span>Seleccionar archivo Excel</span>
        <input type="file" accept=".xlsx,.xls" onChange={handleUpload} />
      </label>
      <p className="helper-text">{mensaje}</p>
    </article>
  );
}

function CommitteeDashboard({ rows, auditLog }) {
  const resumen = [...new Set(rows.map((row) => row.comision))].map((comision) => {
    const delegados = rows.filter((row) => row.comision === comision);
    const calificados = delegados.filter((row) => calcularPonderada(row) > 0).length;
    const promedio = delegados.length ? delegados.reduce((sum, row) => sum + calcularPonderada(row), 0) / delegados.length : 0;
    const movimientos = auditLog.filter((item) => item.detalle.includes(comision)).length;
    const progreso = delegados.length ? (calificados / delegados.length) * 100 : 0;
    return { comision, delegados: delegados.length, calificados, promedio, movimientos, progreso };
  });
  const maxMovimientos = Math.max(1, ...resumen.map((item) => item.movimientos));
  const promedioGeneral = rows.length ? rows.reduce((sum, row) => sum + calcularPonderada(row), 0) / rows.length : 0;
  const evaluados = rows.filter((row) => calcularPonderada(row) > 0).length;
  const avanceGeneral = rows.length ? (evaluados / rows.length) * 100 : 0;

  return (
    <section className="charts-dashboard">
      <div className="chart-summary">
        <article>
          <div className="donut" style={{ "--value": `${avanceGeneral}%` }}>
            <strong>{avanceGeneral.toFixed(0)}%</strong>
          </div>
          <span>Avance general</span>
        </article>
        <article>
          <div className="donut average" style={{ "--value": `${promedioGeneral}%` }}>
            <strong>{promedioGeneral.toFixed(0)}</strong>
          </div>
          <span>Promedio general</span>
        </article>
      </div>
      <div className="committee-grid">
        {resumen.map((item) => (
          <article key={item.comision}>
            <div>
              <strong>{item.comision}</strong>
              <span>{item.calificados}/{item.delegados} evaluados</span>
            </div>
            <div className="chart-row">
              <span>Progreso</span>
              <div className="progress-track">
                <span style={{ width: `${item.progreso}%` }} />
              </div>
              <strong>{item.progreso.toFixed(0)}%</strong>
            </div>
            <div className="chart-row">
              <span>Promedio</span>
              <div className="progress-track score">
                <span style={{ width: `${item.promedio}%` }} />
              </div>
              <strong>{item.promedio.toFixed(1)}</strong>
            </div>
            <div className="chart-row">
              <span>Movimientos</span>
              <div className="progress-track motion">
                <span style={{ width: `${(item.movimientos / maxMovimientos) * 100}%` }} />
              </div>
              <strong>{item.movimientos}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminUsersPanel({ rows, admins, setAdmins, onAudit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [comision, setComision] = useState("");
  const comisiones = [...new Set(rows.map((row) => row.comision))];

  function addAdmin(event) {
    event.preventDefault();
    if (!email || !password || !comision) return;
    const nuevo = { id: Date.now(), email, comision, estado: "Activo", passwordTemporal: password };
    setAdmins((actuales) => [nuevo, ...actuales]);
    setEmail("");
    setPassword("");
    setComision("");
    onAudit("Admin asignado", `${email} fue asignado a ${comision} con contraseña definida por superadmin.`);
  }

  return (
    <article className="admin-users-card">
      <div className="section-heading compact">
        <span>Usuarios por comisión</span>
        <h2>Asignar administradores</h2>
      </div>
      <form className="inline-form" onSubmit={addAdmin}>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@institucion.edu.do" />
        <input
          type="password"
          value={password}
          minLength="8"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Contraseña inicial"
        />
        <select value={comision} onChange={(event) => setComision(event.target.value)}>
          <option value="">Seleccionar comisión</option>
          {comisiones.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button className="btn primary" type="submit"><UserPlus size={15} /> Asignar</button>
      </form>
      <div className="admin-list">
        {admins.map((admin) => (
          <div key={admin.id}>
            <strong>{admin.email}</strong>
            <span>{admin.comision} | {admin.estado} | contraseña definida</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AuditPanel({ auditLog }) {
  return (
    <article className="audit-card">
      <div className="section-heading compact">
        <span>Observación y auditoría</span>
        <h2>Movimientos recientes</h2>
        <p>Vista para supervisar accesos, carga de datos, asignaciones y modificaciones.</p>
      </div>
      <div className="audit-list">
        {auditLog.map((item) => (
          <div key={item.id}>
            <time>{item.hora}</time>
            <strong>{item.tipo}</strong>
            <p>{item.detalle}</p>
            <span>{item.usuario}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function Dashboard({ user, rows, setRows, published, setPublished, active, setActive, onLogout, auditLog, onAudit, admins, setAdmins }) {
  const calificados = rows.filter((row) => calcularPonderada(row) > 0).length;
  const promedio = rows.length ? rows.reduce((sum, row) => sum + calcularPonderada(row), 0) / rows.length : 0;
  const comisiones = new Set(rows.map((row) => row.comision)).size;

  function togglePublished() {
    const next = !published;
    setPublished(next);
    onAudit(next ? "Resultados publicados" : "Resultados ocultados", `La consulta publica fue ${next ? "activada" : "desactivada"}.`);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <LogoMark size="sm" />
          <div>
            <strong>SIGEL CELIDER 10</strong>
            <span>Panel administrativo de evaluación</span>
          </div>
        </div>
        <nav className="nav-actions" aria-label="Secciones administrativas">
          <button className={active === "dashboard" ? "active" : ""} onClick={() => setActive("dashboard")} type="button">Resumen</button>
          <button className={active === "importar" ? "active" : ""} onClick={() => setActive("importar")} type="button">Importar</button>
          <button className={active === "usuarios" ? "active" : ""} onClick={() => setActive("usuarios")} type="button">Usuarios</button>
          <button className={active === "calificar" ? "active" : ""} onClick={() => setActive("calificar")} type="button">Calificar</button>
          <button className={active === "rubricas" ? "active" : ""} onClick={() => setActive("rubricas")} type="button">Rúbricas</button>
          <button className={active === "auditoria" ? "active" : ""} onClick={() => setActive("auditoria")} type="button">Auditoría</button>
          <button className={active === "ranking" ? "active" : ""} onClick={() => setActive("ranking")} type="button">Ranking</button>
        </nav>
        <div className="header-actions">
          <span className="role-pill">{user.role}</span>
          <button className="icon-btn" type="button" onClick={onLogout} aria-label="Cerrar sesión">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="admin-hero">
          <div>
            <span>Administración oficial</span>
            <h1>Evaluación precisa para SIGEL CELIDER 10</h1>
            <p>Gestiona delegados, controla la publicación y califica con rúbricas visibles para mantener consistencia académica.</p>
          </div>
          <div className="admin-controls">
            <button className="btn primary" type="button" onClick={togglePublished}>
              <CheckCircle2 size={16} /> {published ? "Ocultar resultados" : "Publicar resultados"}
            </button>
            <button className="btn secondary" type="button" onClick={() => exportarExcel(rows)}>
              <FileSpreadsheet size={16} /> Excel general
            </button>
          </div>
        </section>

        {active === "dashboard" && (
          <>
            <section className="metrics-grid">
              <MetricCard icon={Users} label="Delegados" value={rows.length} note={`${comisiones} comisiones activas`} />
              <MetricCard icon={Gauge} label="Progreso" value={`${calificados}/${rows.length}`} note="Registros con puntaje" />
              <MetricCard icon={BarChart3} label="Promedio" value={promedio.toFixed(2)} note="Ponderada general" />
              <MetricCard icon={Trophy} label="Publicación" value={published ? "Activa" : "Pendiente"} note="Consulta pública" />
            </section>
            <section className="admin-grid">
              <article className="activity-card">
                <div className="section-heading compact">
                  <span>Dashboard en tiempo real</span>
                  <h2>Movimiento por comité</h2>
                </div>
                <CommitteeDashboard rows={rows} auditLog={auditLog} />
              </article>
              <AuditPanel auditLog={auditLog.slice(0, 5)} />
            </section>
          </>
        )}

        {active === "importar" && (
          <section className="admin-grid">
            <UploadDelegados setRows={setRows} onAudit={onAudit} />
            <article className="activity-card">
              <div className="section-heading compact">
                <span>Formato requerido</span>
                <h2>Columnas del Excel</h2>
              </div>
              <p>Fila 1: Nombre | Delegación | Comisión.</p>
              <p>Cada fila siguiente representa un delegado. Al importar, el sistema crea los registros con criterios en cero para comenzar la evaluación.</p>
              <p>Después de subir el listado, entra a Usuarios para asignar administradores por comisión.</p>
            </article>
          </section>
        )}

        {active === "usuarios" && (
          <AdminUsersPanel rows={rows} admins={admins} setAdmins={setAdmins} onAudit={onAudit} />
        )}

        {active === "calificar" && (
          <section className="evaluation-layout">
            <CalificacionesTable rows={rows} setRows={setRows} onAudit={onAudit} />
            <RubricasPanel />
          </section>
        )}

        {active === "rubricas" && <RubricasPanel />}
        {active === "auditoria" && <AuditPanel auditLog={auditLog} />}
        {active === "ranking" && <PublicRanking rows={rows} published={published} />}
      </main>
    </div>
  );
}

function HomePage({ rows, published, onNavigate }) {
  const [displayName, setDisplayName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(() => {
    const q = searchName.toLowerCase().trim();
    if (!q) return [];
    return rows.filter((row) => row.nombre.toLowerCase().includes(q));
  }, [rows, searchName]);

  const calificados = rows.filter((row) => calcularPonderada(row) > 0).length;
  const comisiones = new Set(rows.map((row) => row.comision)).size;
  const top = [...rows].sort((a, b) => calcularPonderada(b) - calcularPonderada(a)).slice(0, 3);

  function submitSearch() {
    if (!displayName.trim()) return;
    setSearchName(displayName);
    setSubmitted(true);
  }

  return (
    <main className="home-shell">
      <header className="home-topbar">
        <div className="brand inverse">
          <LogoMark size="sm" />
          <div>
            <strong>SIGEL CELIDER 10</strong>
            <span>Sistema de Gestión y Evaluación de Liderazgo</span>
          </div>
        </div>
        <button className="btn small light" type="button" onClick={() => onNavigate("login")}>
          <Lock size={14} /> Admin
        </button>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <span>Plataforma oficial CELIDER</span>
          <h1>SIGEL CELIDER 10</h1>
          <p>Consulta tus criterios evaluados, calificación por criterio y retroalimentación cuando la comisión administrativa publique los resultados.</p>
          <div className="hero-search-box">
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Escribe tu nombre completo"
              aria-label="Buscar delegado por nombre"
              onKeyDown={(event) => {
                if (event.key === "Enter") submitSearch();
              }}
            />
            <button className="icon-btn bright" type="button" disabled={!displayName.trim()} onClick={submitSearch} aria-label="Buscar">
              <Search size={19} />
            </button>
          </div>
          <small>Los resultados solo aparecen cuando el superadmin activa la publicación oficial.</small>
        </div>

        <div className="home-status">
          <div className="home-logo-lock">
            <LogoMark size="md" />
            <div>
              <span>CELIDER</span>
              <strong>Regional 10</strong>
            </div>
          </div>
          <div className="status-header">
            <SlidersHorizontal size={18} />
            <span>Estado del sistema</span>
          </div>
          <strong>{published ? "Publicado" : "En revisión"}</strong>
          <p>{calificados} de {rows.length} delegados cuentan con calificación registrada.</p>
          <div className="mini-stats">
            <span>{rows.length}<small>Delegados</small></span>
            <span>{comisiones}<small>Comisiones</small></span>
            <span>100<small>Puntos máx.</small></span>
          </div>
        </div>
      </section>

      {submitted && (
        <section className="results-section">
          <div className="section-heading">
            <span>Consulta pública</span>
            <h2>Resultados de búsqueda</h2>
          </div>
          {!published ? (
            <div className="empty-state dark">
              <ShieldCheck size={32} />
              <h3>Resultados no publicados</h3>
              <p>La información estará disponible después de la autorización del superadmin.</p>
            </div>
          ) : results.length > 0 ? (
            <div className="results-grid">
              {results.map((row) => (
                <article key={row.id} className="result-card">
                  <div>
                    <h3>{row.nombre}</h3>
                    <p>{row.designacion} | {row.comision}</p>
                  </div>
                  <strong>{calcularPonderada(row).toFixed(2)}<span> pts</span></strong>
                  <div className="result-criteria">
                    {Object.keys(criterios).map((key) => {
                      const item = criterioDetalle(row, key);
                      return (
                        <div key={key}>
                          <span>{item.label}</span>
                          <strong>{item.valor}/{item.max}</strong>
                          <small>{item.nivel} | aporta {item.aporte.toFixed(2)}</small>
                        </div>
                      );
                    })}
                  </div>
                  <dl>
                    <div><dt>Nombre</dt><dd>{row.nombre}</dd></div>
                    <div><dt>Delegación</dt><dd>{row.designacion}</dd></div>
                    <div><dt>Comisión</dt><dd>{row.comision}</dd></div>
                    <div><dt>Mención</dt><dd>{row.mencion || "Sin mención"}</dd></div>
                    <div><dt>Retroalimentación</dt><dd>{row.feedback || "Sin retroalimentación registrada"}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state dark">
              <Search size={32} />
              <h3>No se encontró ningún delegado</h3>
              <p>Verifica el nombre y vuelve a intentar.</p>
            </div>
          )}
        </section>
      )}

      <section className="public-preview">
        <div className="section-heading">
          <span>Vista institucional</span>
          <h2>{published ? "Ranking destacado" : "Criterios de evaluación"}</h2>
        </div>
        {published ? (
          <div className="preview-list">
            {top.map((row, index) => (
              <article key={row.id}>
                <strong>{index + 1}</strong>
                <div>
                  <h3>{row.nombre}</h3>
                  <p>{row.comision}</p>
                </div>
                <span>{calcularPonderada(row).toFixed(2)}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="criteria-strip">
            {Object.values(criterios).map((item) => (
              <article key={item.label}>
                <strong>{item.label}</strong>
                <span>0-{item.max} pts</span>
                <small>Peso {item.peso}%</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function LoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    if (!email || !password) {
      setError("Ingresa correo y contraseña para continuar.");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ name: "Admin Monur", role: "Superadmin", email });
    }, 450);
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <LogoMark />
          <div>
            <span>Acceso administrativo</span>
            <h1>Ingreso seguro</h1>
            <p>Usa tus credenciales institucionales para administrar evaluaciones y publicación.</p>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Correo institucional
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@celider10.edu.do" autoComplete="email" />
          </label>
          <label>
            Contraseña
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="********" autoComplete="current-password" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn primary full" disabled={loading}>
            <Lock size={16} /> {loading ? "Ingresando..." : "Ingresar"}
          </button>
          <button type="button" className="btn secondary full" onClick={onBack}>
            Volver al inicio
          </button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("home");
  const [active, setActive] = useState("dashboard");
  const [published, setPublished] = useState(false);
  const [rows, setRows] = useState(inicial);
  const [admins, setAdmins] = useState([]);
  const [auditLog, setAuditLog] = useState([
    crearMovimiento("Sistema iniciado", "Sesión de demostración local preparada para SIGEL CELIDER 10.", "Sistema")
  ]);

  function handleAudit(tipo, detalle, usuario = user?.email || user?.name || "Superadmin") {
    setAuditLog((actuales) => [crearMovimiento(tipo, detalle, usuario), ...actuales]);
  }

  function handleSetActive(section) {
    setActive(section);
    handleAudit("Navegación", `Ingresó a la sección ${section}.`);
  }

  function handleLogin(nextUser) {
    setUser(nextUser);
    setPage("home");
    setAuditLog((actuales) => [crearMovimiento("Inicio de sesión", `${nextUser.email} entró al panel administrativo.`, nextUser.email), ...actuales]);
  }

  function handleLogout() {
    handleAudit("Cierre de sesión", `${user?.email || user?.name || "Usuario"} salió del panel.`);
    setUser(null);
    setPage("home");
    setActive("dashboard");
  }

  if (user) {
    return (
      <Dashboard
        user={user}
        rows={rows}
        setRows={setRows}
        published={published}
        setPublished={setPublished}
        active={active}
        setActive={handleSetActive}
        onLogout={handleLogout}
        auditLog={auditLog}
        onAudit={handleAudit}
        admins={admins}
        setAdmins={setAdmins}
      />
    );
  }

  if (page === "login") {
    return <LoginPage onLogin={handleLogin} onBack={() => setPage("home")} />;
  }

  return <HomePage rows={rows} published={published} onNavigate={setPage} />;
}

createRoot(document.getElementById("root")).render(<App />);

