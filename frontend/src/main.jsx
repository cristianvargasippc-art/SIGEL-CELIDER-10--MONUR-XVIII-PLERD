import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Lock,
  LogOut,
  Search,
  ShieldCheck,
  Upload,
  Users
} from "lucide-react";
import * as XLSX from "xlsx";
import "./styles.css";
import "./home.css";

const LOGO_SRC = "/imagenes/logo.png";

const criterios = {
  oratoria: { label: "Oratoria", max: 15, peso: 0.15 },
  argumentacion: { label: "Argumentacion", max: 25, peso: 0.25 },
  negociacion: { label: "Negociacion", max: 20, peso: 0.2 },
  liderazgo: { label: "Liderazgo", max: 15, peso: 0.15 },
  redaccion: { label: "Redaccion", max: 25, peso: 0.25 }
};

const inicial = [
  {
    id: 1,
    nombre: "Ana Isabel Duarte",
    designacion: "Republica Dominicana",
    comision: "Asamblea General",
    estado: "presente_votando",
    oratoria: 14,
    argumentacion: 23,
    negociacion: 18,
    liderazgo: 14,
    redaccion: 24,
    pasa: true,
    mencion: "Mejor Delegada",
    feedback: "Excelente dominio del registro diplomatico y liderazgo sostenido."
  },
  {
    id: 2,
    nombre: "Carlos Mendez",
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
    nombre: "Sofia Batista",
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
    feedback: "Participacion funcional con oportunidades claras de mayor iniciativa."
  }
];

function calcularPonderada(row) {
  return Object.entries(criterios).reduce((total, [key, meta]) => {
    return total + (Number(row[key]) || 0) * meta.peso * (100 / meta.max);
  }, 0);
}

function nivel(key, value) {
  const max = criterios[key].max;
  const ratio = (Number(value) || 0) / max;
  if (ratio >= 0.86) return "Excelente";
  if (ratio >= 0.68) return "Bueno";
  if (ratio >= 0.48) return "Normal";
  if (ratio >= 0.24) return "Regular";
  return "Malo";
}

function LogoMark({ size = "lg" }) {
  return (
    <div className={`logo-mark ${size}`} aria-label="Logo SIGEL">
      <img src={LOGO_SRC} alt="Logo SIGEL" />
    </div>
  );
}

function Stats({ rows }) {
  const comisiones = [...new Set(rows.map((row) => row.comision))];
  const calificados = rows.filter((row) => calcularPonderada(row) > 0).length;

  return (
    <section className="stats-grid">
      <article>
        <Users size={20} />
        <span>Total delegados</span>
        <strong>{rows.length}</strong>
      </article>
      <article>
        <BarChart3 size={20} />
        <span>Calificados</span>
        <strong>{calificados} / {rows.length}</strong>
      </article>
      <article>
        <ShieldCheck size={20} />
        <span>Comisiones activas</span>
        <strong>{comisiones.length}</strong>
      </article>
    </section>
  );
}

function CalificacionesTable({ rows, setRows, scope = "all" }) {
  const visibles = scope === "all" ? rows : rows.filter((row) => row.comision === scope);

  function update(id, key, value) {
    setRows((actuales) =>
      actuales.map((row) => {
        if (row.id !== id) return row;
        const numeric = criterios[key] ? Math.min(Number(value), criterios[key].max) : value;
        return { ...row, [key]: numeric };
      })
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Designacion</th>
            <th>Comision</th>
            <th>Estado</th>
            {Object.values(criterios).map((item) => <th key={item.label}>{item.label}</th>)}
            <th>Ponderada</th>
            <th>Pasa</th>
            <th>Mencion</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((row) => (
            <tr key={row.id}>
              <td>{row.nombre}</td>
              <td>{row.designacion}</td>
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
                  <small>{nivel(key, row[key])}</small>
                </td>
              ))}
              <td><strong>{calcularPonderada(row).toFixed(2)}</strong></td>
              <td>
                <input type="checkbox" checked={row.pasa} onChange={(event) => update(row.id, "pasa", event.target.checked)} />
              </td>
              <td>
                {row.pasa ? (
                  <input value={row.mencion} maxLength="500" onChange={(event) => update(row.id, "mencion", event.target.value)} />
                ) : (
                  <span className="muted">No aplica</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Publico({ rows, published }) {
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
      <main className="public-empty">
        <LogoMark />
        <h2>Calificaciones no publicadas</h2>
        <p>El ranking público se habilitará cuando los resultados sean publicados.</p>
      </main>
    );
  }

  return (
      <main className="workspace">
        <section className="toolbar">
          <div>
            <h2>Ranking Público</h2>
            <p>Consulta por comisión y busca delegados de forma rápida.</p>
          </div>
          <div className="filters">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar delegado" />
            <select value={comision} onChange={(event) => setComision(event.target.value)}>
              {comisiones.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
        </section>
        <div className="ranking-list">
          {ranking.map((row, index) => (
            <article key={row.id}>
              <strong>{index + 1}</strong>
              <div>
                <h3>{row.nombre}</h3>
                <p>{row.designacion} - {row.comision}</p>
              </div>
              <span>{calcularPonderada(row).toFixed(2)}</span>
              <em>{row.mencion || "Sin mención"}</em>
            </article>
          ))}
        </div>
      </main>
  );
}

function Dashboard({ user, rows, setRows, published, setPublished, active, setActive, onLogout }) {
  const calificados = rows.filter((row) => calcularPonderada(row) >= 60).length;
  const promedio = (rows.reduce((sum, row) => sum + calcularPonderada(row), 0) / rows.length).toFixed(2);

  return (
    <div className="page-shell">
      <header className="app-header dashboard-header">
        <div className="brand">
          <LogoMark size="sm" />
          <div>
            <strong>SIGEL MONUR XVIII R-10</strong>
            <span>Panel administrativo profesional</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="status-pill">{user.role}</div>
          <button className="secondary-btn" type="button" onClick={onLogout}>
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </header>
      <main className="workspace">
        <section className="welcome-panel">
          <div>
            <p className="eyebrow">Bienvenido, {user.name}</p>
            <h1>Control y gestión desde un solo lugar</h1>
            <p>Administra calificaciones, revisa actividad y publica resultados con seguridad y eficiencia.</p>
          </div>
          <div className="hero-card">
            <span className="eyebrow">Resumen global</span>
            <strong>{rows.length} delegados activos</strong>
            <p>{calificados} delegados con resultados actuales y un promedio general de {promedio}.</p>
          </div>
        </section>
        <section className="quick-actions">
          <button className={active === "dashboard" ? "primary-btn" : "secondary-btn"} onClick={() => setActive("dashboard")}>Resumen</button>
          <button className={active === "calificar" ? "primary-btn" : "secondary-btn"} onClick={() => setActive("calificar")}>Calificar</button>
          <button className={active === "publico" ? "primary-btn" : "secondary-btn"} onClick={() => setActive("publico")}>Ranking</button>
          <button className="secondary-btn" type="button" onClick={() => setPublished(!published)}>
            {published ? "Ocultar resultados" : "Publicar resultados"}
          </button>
        </section>
        {active === "dashboard" && (
          <>
            <Stats rows={rows} />
            <section className="audit-grid">
              <article>
                <h3>Actividad reciente</h3>
                <p>Calificación actualizada: Ana Isabel Duarte, Oratoria subida a 14.</p>
                <p>Publicación: {published ? "Activada" : "Pendiente"}.</p>
              </article>
              <article>
                <h3>Control administrativo</h3>
                <p>Usuario conectado: {user.email}</p>
                <p>Rol: {user.role}</p>
              </article>
            </section>
          </>
        )}
        {active === "calificar" && <CalificacionesTable rows={rows} setRows={setRows} />}
        {active === "publico" && <Publico rows={rows} published={published} />}
      </main>
    </div>
  );
}

function HomePage({ rows, published, onNavigate }) {
  const [displayName, setDisplayName] = useState("");
  const [searchName, setSearchName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(() => {
    return rows.filter((row) =>
      row.nombre.toLowerCase().includes(searchName.toLowerCase().trim())
    );
  }, [rows, searchName]);

  const calificados = rows.filter((row) => calcularPonderada(row) > 0).length;
  const comisiones = new Set(rows.map((row) => row.comision)).size;

  return (
    <main className="home-shell">
      {/* TOPBAR PROFESIONAL */}
      <header className="home-topbar">
        <div className="topbar-left">
          <LogoMark size="sm" />
          <div className="topbar-brand">
            <p className="topbar-title">SIGEL CELIDER 10-04</p>
            <span className="topbar-subtitle">Gestión y evaluación de liderazgo</span>
          </div>
        </div>
        <div className="topbar-center">
          <span className="system-indicator">● SISTEMA ACTIVO — CELIDER 2026</span>
        </div>
        <div className="topbar-right">
          <span className="regional-tag">REGIONAL 10</span>
          <button className="btn-admin" type="button" onClick={() => onNavigate("login")}>
            → Admin
          </button>
        </div>
      </header>

      {/* HERO SECTION CENTRADO */}
      <section className="home-hero-full">
        <div className="hero-container">
          <div className="hero-pretext">PLATAFORMA OFICIAL</div>
          <h1 className="hero-title">
            SIGEL <span className="hero-accent">CELIDER</span>
          </h1>
          <p className="hero-description">
            Consulta tus calificaciones escribiendo tu nombre completo.<br />
            Accede a tu información de evaluación de liderazgo en tiempo real.
          </p>

          {/* SEARCH BOX PROMINENTE */}
          <div className="hero-search-box">
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Escribe tu nombre completo..."
              className="search-input"
              aria-label="Buscar delegado por nombre"
              onKeyPress={(e) => {
                if (e.key === "Enter" && displayName.trim()) {
                  setSearchName(displayName);
                  setSubmitted(true);
                }
              }}
            />
            <button
              className="search-submit"
              type="button"
              disabled={!displayName.trim()}
              onClick={() => {
                setSearchName(displayName);
                setSubmitted(true);
              }}
            >
              <Search size={20} />
            </button>
          </div>
          <p className="hero-note">Solo tienes acceso a tu propia información como delegado</p>

          {/* STATS SECTION */}
          <div className="stats-container">
            <div className="stat-card">
              <strong>{rows.length}</strong>
              <span>Delegados en el sistema</span>
            </div>
            <div className="stat-card">
              <strong>{calificados}</strong>
              <span>Calificados ({((calificados / rows.length) * 100).toFixed(0)}%)</span>
            </div>
            <div className="stat-card">
              <strong>{comisiones}</strong>
              <span>Comisiones activas</span>
            </div>
            <div className="stat-card">
              <strong>{published ? "Publicado" : "Pendiente"}</strong>
              <span>Estado de resultados</span>
            </div>
          </div>
        </div>
      </section>

      {/* RESULTADOS DE BÚSQUEDA */}
      {submitted && (
        <section className="results-section">
          <div className="results-header">
            <h2>Resultados de búsqueda</h2>
            <button className="btn-back" type="button" onClick={() => setSubmitted(false)}>
              ← Volver
            </button>
          </div>

          {!published ? (
            <div className="result-empty">
              <h3>Resultados no publicados</h3>
              <p>El superadmin debe publicar los resultados para que estén disponibles aquí.</p>
            </div>
          ) : results.length > 0 ? (
            <div className="results-cards">
              {results.map((row) => (
                <article key={row.id} className="result-item">
                  <div className="result-top">
                    <div className="result-info">
                      <h3>{row.nombre}</h3>
                      <p className="result-meta">{row.designacion} • {row.comision}</p>
                    </div>
                    <div className="result-score">
                      {calcularPonderada(row).toFixed(2)}
                      <span>pts</span>
                    </div>
                  </div>
                  <div className="result-details">
                    <div className="detail-row">
                      <span className="detail-label">Mención:</span>
                      <span className="detail-value">{row.mencion || "Sin mención"}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Feedback:</span>
                      <span className="detail-value">{row.feedback || "Sin feedback"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="result-empty">
              <h3>No se encontró ningún resultado</h3>
              <p>Verifica que tu nombre esté escrito correctamente y vuelve a intentar.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function LoginPage({ onLogin, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!email || !password) {
      setError("Ingresa correo y contrasena para continuar.");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin({ name: "Admin Monur", role: "Superadmin", email });
    }, 500);
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-banner">
          <LogoMark />
          <div>
            <span className="eyebrow">Acceso seguro</span>
            <h1>Ingreso de administrador</h1>
            <p>Utiliza tu correo institucional y contraseña asignada para entrar al panel administrativo.</p>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Correo institucional
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@monur.edu.do"
              autoComplete="email"
            />
          </label>
          <label>
            Contrasena
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            <Lock size={16} /> {loading ? "Ingresando..." : "Ingresar"}
          </button>
          <button type="button" className="secondary-btn" onClick={onBack}>
            Volver al inicio público
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

  function handleLogout() {
    setUser(null);
    setPage("home");
    setActive("dashboard");
  }

  return user ? (
    <Dashboard
      user={user}
      rows={rows}
      setRows={setRows}
      published={published}
      setPublished={setPublished}
      active={active}
      setActive={setActive}
      onLogout={handleLogout}
    />
  ) : page === "login" ? (
    <LoginPage onLogin={setUser} onBack={() => setPage("home")} />
  ) : (
    <HomePage rows={rows} published={published} onNavigate={setPage} />
  );
}

createRoot(document.getElementById("root")).render(<App />);
