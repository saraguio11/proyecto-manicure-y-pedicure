import { useState, useEffect } from 'react';
import './App.css';
import './dashboard.css';

// Usar variable de entorno para producción (Vercel) o localhost en local
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const IMAGENES_SERVICIOS = {
  1: '/manicure-tradicional.png',
  2: '/manicure-gel.png',
  3: '/pedicure-tradicional.png',
  4: '/unas-acrilicas.png',
};

const IMAGEN_MODAL = '/login-art.png';

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token_spa') || '');
  const [usuario, setUsuario] = useState(() => {
    const sesion = localStorage.getItem('sesion_spa');
    return sesion ? JSON.parse(sesion) : null;
  });

  const [tipoModal, setTipoModal] = useState(null);
  const [authForm, setAuthForm] = useState({
    correo: '',
    password: '',
    nombre_completo: '',
    documento: '',
    telefono: ''
  });
  const [authError, setAuthError] = useState('');
  const [authCargando, setAuthCargando] = useState(false);

  const [alerta, setAlerta] = useState(null);
  const [pagina, setPagina] = useState('inicio');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const mostrarAlerta = (texto, tipo = 'success') => {
    setAlerta({ texto, tipo });
    setTimeout(() => setAlerta(null), 4500);
  };
  const irA = (id) => {
    setPagina(id);
    setMenuAbierto(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [servicios, setServicios] = useState([]);
  // Ahora soportamos selección múltiple de servicios (Combo / Paquete de belleza)
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(true);

  const fechaHoy = new Date().toISOString().split('T')[0];
  const [formReserva, setFormReserva] = useState({
    fecha: '',
    hora_inicio: '10:00:00',
    observacion: ''
  });
  const [reservaCargando, setReservaCargando] = useState(false);
  const [horasOcupadas, setHorasOcupadas] = useState([]);

  const HORARIOS_DISPONIBLES = [
    { valor: '08:00:00', etiqueta: '08:00 AM' },
    { valor: '09:30:00', etiqueta: '09:30 AM' },
    { valor: '11:00:00', etiqueta: '11:00 AM' },
    { valor: '13:30:00', etiqueta: '01:30 PM' },
    { valor: '15:00:00', etiqueta: '03:00 PM' },
    { valor: '16:30:00', etiqueta: '04:30 PM' },
    { valor: '18:00:00', etiqueta: '06:00 PM' }
  ];

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  const cargarServicios = () => {
    fetch(`${API_BASE}/servicios`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setServicios(data);
          if (data.length > 0 && serviciosSeleccionados.length === 0) {
            setServiciosSeleccionados([data[0]]);
          }
        }
      })
      .catch(err => {
        console.error(err);
        mostrarAlerta('No se pudo conectar con el catálogo de servicios', 'error');
      })
      .finally(() => setCargandoServicios(false));
  };

  // Alternar selección de un servicio (Permite mínimo 1 y máximo 2 servicios por sesión)
  const toggleServicio = (s) => {
    const yaExiste = serviciosSeleccionados.some(item => item.id === s.id);

    if (yaExiste) {
      if (serviciosSeleccionados.length === 1) {
        mostrarAlerta('Debes tener al menos un servicio seleccionado', 'warning');
        return;
      }
      setServiciosSeleccionados(serviciosSeleccionados.filter(item => item.id !== s.id));
    } else {
      // Límite estricto: máximo 2 servicios por cita
      if (serviciosSeleccionados.length >= 2) {
        mostrarAlerta('Solo puedes seleccionar un máximo de 2 servicios por sesión (ej. Manicure + Pedicure)', 'warning');
        return;
      }
      setServiciosSeleccionados([...serviciosSeleccionados, s]);
    }
  };

  // Totales acumulados de la selección
  const duracionTotal = serviciosSeleccionados.reduce((acc, s) => acc + Number(s.duracion_min), 0);
  const precioTotal = serviciosSeleccionados.reduce((acc, s) => acc + Number(s.precio), 0);

  // Calcular la hora fin proyectada
  const calcularHoraFin = (hInicio, duracionMin) => {
    if (!hInicio) return '';
    const [h, m] = hInicio.split(':').map(Number);
    const minTotales = h * 60 + m + duracionMin;
    const finH = String(Math.floor(minTotales / 60)).padStart(2, '0');
    const finM = String(minTotales % 60).padStart(2, '0');
    return `${finH}:${finM}`;
  };

  const [misCitas, setMisCitas] = useState([]);
  const [citasAdmin, setCitasAdmin] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargandoCitas, setCargandoCitas] = useState(false);

  // Dashboard stats
  const [dashStats, setDashStats] = useState(null);
  const [dashSeccion, setDashSeccion] = useState('dashboard'); // dashboard | citas | servicios | clientas

  useEffect(() => {
    if (!formReserva.fecha) {
      setHorasOcupadas([]);
      return;
    }
    fetch(`${API_BASE}/citas/disponibilidad?fecha=${formReserva.fecha}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHorasOcupadas(data);
      })
      .catch(err => console.error(err));
  }, [formReserva.fecha]);

  const cargarMisCitas = () => {
    if (!token) return;
    setCargandoCitas(true);
    fetch(`${API_BASE}/citas`, { headers: authHeaders() })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          cerrarSesion();
          throw new Error('Tu sesión ha expirado');
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setMisCitas(data);
      })
      .catch(err => console.error(err))
      .finally(() => setCargandoCitas(false));
  };

  const cargarCitasAdmin = () => {
    if (!token) return;
    setCargandoCitas(true);
    let url = `${API_BASE}/citas`;
    if (filtroEstado) url += `?estado_id=${filtroEstado}`;
    fetch(url, { headers: authHeaders() })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          cerrarSesion();
          throw new Error('Acceso restringido');
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setCitasAdmin(data);
      })
      .catch(err => console.error(err))
      .finally(() => setCargandoCitas(false));
  };

  const cargarDashStats = () => {
    if (!token) return;
    fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setDashStats(data))
      .catch(err => console.error('Stats error:', err));
  };

  useEffect(() => {
    cargarServicios();
  }, []);

  useEffect(() => {
    if (usuario && token) {
      if (usuario.rol === 'Administradora' || usuario.rol_id === 2) {
        cargarCitasAdmin();
        cargarDashStats();
      } else {
        cargarMisCitas();
      }
    }
  }, [usuario, token, filtroEstado]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!authForm.correo.includes('@')) {
      return setAuthError('Por favor ingresa un correo válido');
    }
    if (authForm.password.length < 6) {
      return setAuthError('La contraseña debe tener mínimo 6 caracteres');
    }

    setAuthCargando(true);

    try {
      if (tipoModal === 'login_cliente' || tipoModal === 'login_admin') {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: authForm.correo, password: authForm.password })
        });
        const data = await res.json();

        if (!res.ok) {
          return setAuthError(data.error || 'Credenciales inválidas');
        }

        if (tipoModal === 'login_admin' && data.usuario.rol !== 'Administradora' && data.usuario.rol_id !== 2) {
          return setAuthError('Acceso denegado: Esta cuenta no posee permisos de Administradora');
        }

        guardarSesion(data.usuario, data.token);
        setTipoModal(null);
        mostrarAlerta(`¡Bienvenida, ${data.usuario.nombre_completo || data.usuario.nombre}!`, 'success');
      } else if (tipoModal === 'registro_cliente') {
        if (!authForm.nombre_completo.trim() || !authForm.documento.trim() || !authForm.telefono.trim()) {
          return setAuthError('Por favor llena todos los datos');
        }

        const res = await fetch(`${API_BASE}/auth/registro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(authForm)
        });
        const data = await res.json();

        if (!res.ok) {
          return setAuthError(data.error || 'Error al crear cuenta');
        }

        guardarSesion(data.usuario, data.token);
        setTipoModal(null);
        mostrarAlerta('¡Cuenta creada exitosamente!', 'success');
      }
    } catch (err) {
      setAuthError('Error de conexión: ' + err.message);
    } finally {
      setAuthCargando(false);
    }
  };

  const guardarSesion = (u, t) => {
    setUsuario(u);
    setToken(t);
    localStorage.setItem('sesion_spa', JSON.stringify(u));
    localStorage.setItem('token_spa', t);
  };

  const cerrarSesion = () => {
    setUsuario(null);
    setToken('');
    localStorage.removeItem('sesion_spa');
    localStorage.removeItem('token_spa');
    setMisCitas([]);
    setCitasAdmin([]);
    setPagina('inicio');
    mostrarAlerta('Has cerrado sesión correctamente.', 'warning');
  };

  // Reservar uno o varios servicios continuos
  const handleReservar = async (e) => {
    e.preventDefault();

    if (!usuario || !token) {
      setAuthError('Inicia sesión o regístrate para confirmar tu cita');
      setTipoModal('login_cliente');
      return;
    }

    if (serviciosSeleccionados.length === 0) {
      return mostrarAlerta('Debes seleccionar al menos un servicio', 'error');
    }

    if (!formReserva.fecha) {
      return mostrarAlerta('Debes seleccionar una fecha para tu cita', 'error');
    }
    if (formReserva.fecha < fechaHoy) {
      return mostrarAlerta('No puedes agendar citas en fechas pasadas', 'error');
    }

    setReservaCargando(true);

    try {
      const res = await fetch(`${API_BASE}/citas`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          servicios_ids: serviciosSeleccionados.map(s => s.id),
          servicio_id: serviciosSeleccionados[0].id,
          fecha: formReserva.fecha,
          hora_inicio: formReserva.hora_inicio,
          observacion: formReserva.observacion
        })
      });

      const data = await res.json();
      if (res.ok) {
        mostrarAlerta(`✨ ¡${serviciosSeleccionados.length > 1 ? 'Combo de servicios agendado' : 'Cita agendada'} con éxito! Reserva #${data.cita_id}`, 'success');
        setFormReserva({ fecha: '', hora_inicio: '10:00:00', observacion: '' });
        cargarMisCitas();
        irA('citas');
      } else {
        mostrarAlerta(data.error || 'No se pudo reservar la cita', 'error');
      }
    } catch (err) {
      mostrarAlerta('Error: ' + err.message, 'error');
    } finally {
      setReservaCargando(false);
    }
  };

  const actualizarEstadoCita = async (id, nuevoEstadoId) => {
    try {
      const res = await fetch(`${API_BASE}/citas/${id}/estado`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ estado_id: nuevoEstadoId })
      });
      const data = await res.json();
      if (res.ok) {
        mostrarAlerta('Estado de la cita actualizado', 'success');
        cargarCitasAdmin();
      } else {
        mostrarAlerta(data.error || 'Error al actualizar', 'error');
      }
    } catch (err) {
      mostrarAlerta('Error: ' + err.message, 'error');
    }
  };

  const actualizarPago = async (id, nuevoEstadoPago) => {
    try {
      const res = await fetch(`${API_BASE}/citas/${id}/estado`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ estado_pago: nuevoEstadoPago })
      });
      const data = await res.json();
      if (res.ok) {
        mostrarAlerta(`Pago actualizado a "${nuevoEstadoPago}"`, 'success');
        cargarCitasAdmin();
      } else {
        mostrarAlerta(data.error || 'Error al registrar pago', 'error');
      }
    } catch (err) {
      mostrarAlerta('Error: ' + err.message, 'error');
    }
  };

  const esAdmin = usuario?.rol === 'Administradora' || usuario?.rol_id === 2;

  useEffect(() => {
    if (esAdmin) setPagina('admin');
  }, [esAdmin]);

  const itemsMenu = esAdmin
    ? [
        { id: 'inicio', etiqueta: 'Inicio', icono: '⌂' },
        { id: 'nosotros', etiqueta: 'Nosotros', icono: '◈' },
        { id: 'tratamientos', etiqueta: 'Tratamientos', icono: '✧' },
        { id: 'admin', etiqueta: 'Panel', icono: '☰' },
        { id: 'contacto', etiqueta: 'Contacto', icono: '☎' }
      ]
    : [
        { id: 'inicio', etiqueta: 'Inicio', icono: '⌂' },
        { id: 'nosotros', etiqueta: 'Nosotros', icono: '◈' },
        { id: 'tratamientos', etiqueta: 'Tratamientos', icono: '✧' },
        { id: 'reservar', etiqueta: 'Reservar', icono: '◷' },
        ...(usuario ? [{ id: 'citas', etiqueta: 'Mis Citas', icono: '☑' }] : []),
        { id: 'contacto', etiqueta: 'Contacto', icono: '☎' }
      ];

  return (
    <div className="app-shell">
      {alerta && (
        <div className={`toast-notification toast-${alerta.tipo}`}>
          <span>{alerta.tipo === 'success' ? '✓' : alerta.tipo === 'warning' ? '⚠️' : '✕'}</span>
          <p>{alerta.texto}</p>
        </div>
      )}

      <button
        className="sidebar-toggle"
        type="button"
        onClick={() => setMenuAbierto((abierto) => !abierto)}
        aria-label="Abrir menú"
      >
        {menuAbierto ? '✕' : '☰'}
      </button>

      {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)} />}

      <aside className={`sidebar ${menuAbierto ? 'abierto' : ''}`}>
        <div className="sidebar-logo">
          <span className="sidebar-mark">✦</span>
          <p>Glam Nails</p>
        </div>

        <nav className="sidebar-nav">
          {itemsMenu.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-item ${pagina === item.id ? 'active' : ''}`}
              onClick={() => irA(item.id)}
            >
              <span className="sidebar-icon">{item.icono}</span>
              {item.etiqueta}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          {usuario ? (
            <>
              <p className="sidebar-user">
                {usuario.nombre_completo || usuario.nombre}
                {esAdmin && <span className="badge-admin">Admin</span>}
              </p>
              <button type="button" className="btn-logout" onClick={cerrarSesion}>Cerrar sesión</button>
            </>
          ) : (
            <>
              <button type="button" className="btn-cliente-login" onClick={() => { setAuthError(''); setTipoModal('login_cliente'); }}>
                Soy Clienta
              </button>
              <button type="button" className="btn-admin-access" onClick={() => { setAuthError(''); setTipoModal('login_admin'); }}>
                Administradora
              </button>
            </>
          )}
        </div>
      </aside>

      <div className="app-content">
      {/* PANEL ADMIN EXCLUSIVO — Dashboard estilo moderno */}
      {esAdmin && pagina === 'admin' ? (
        <main className="admin-dashboard">
          {/* Sidebar del dashboard */}
          <aside className="dash-sidebar">
            <div className="dash-brand">
              <span className="dash-brand-icon">💅</span>
              <div>
                <p className="dash-brand-name">Glam Nails</p>
                <p className="dash-brand-sub">Studio & Spa</p>
              </div>
            </div>

            <nav className="dash-nav">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: '◈' },
                { id: 'citas', label: 'Citas', icon: '📅' },
                { id: 'servicios', label: 'Servicios', icon: '✨' },
                { id: 'clientas', label: 'Clientas', icon: '👥' },
              ].map(item => (
                <button
                  key={item.id}
                  className={`dash-nav-item ${dashSeccion === item.id ? 'active' : ''}`}
                  onClick={() => setDashSeccion(item.id)}
                >
                  <span className="dash-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="dash-sidebar-foot">
              <div className="dash-user-info">
                <div className="dash-user-avatar">
                  {(usuario?.nombre_completo || usuario?.nombre || 'A').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="dash-user-name">{usuario?.nombre_completo || usuario?.nombre}</p>
                  <p className="dash-user-role">Administradora</p>
                </div>
              </div>
              <button className="dash-logout-btn" onClick={cerrarSesion}>
                ⎋ Cerrar sesión
              </button>
            </div>
          </aside>

          {/* Contenido principal del dashboard */}
          <div className="dash-main">
            {/* ── SECCIÓN DASHBOARD ── */}
            {dashSeccion === 'dashboard' && (
              <div className="dash-content">
                <div className="dash-topbar">
                  <div>
                    <h2 className="dash-title">Dashboard</h2>
                    <p className="dash-subtitle">Bienvenida — resumen de tu negocio hoy</p>
                  </div>
                  <button className="dash-refresh-btn" onClick={() => { cargarCitasAdmin(); cargarDashStats(); }}>
                    🔄 Actualizar
                  </button>
                </div>

                {/* Stats cards */}
                <div className="dash-stats-grid">
                  {[
                    {
                      label: 'Total Citas',
                      value: dashStats ? dashStats.estadosCita.reduce((a, e) => a + Number(e.total), 0) : '—',
                      icon: '📋',
                      color: 'stat-purple'
                    },
                    {
                      label: 'Pendientes',
                      value: dashStats ? Number(dashStats.estadosCita.find(e => e.id === 1)?.total || 0) : '—',
                      icon: '⏳',
                      color: 'stat-yellow'
                    },
                    {
                      label: 'Confirmadas',
                      value: dashStats ? Number(dashStats.estadosCita.find(e => e.id === 2)?.total || 0) : '—',
                      icon: '✅',
                      color: 'stat-green'
                    },
                    {
                      label: 'Ingresos del Mes',
                      value: dashStats ? `$${Number(dashStats.ingresosMes).toLocaleString()}` : '—',
                      icon: '💵',
                      color: 'stat-pink'
                    },
                    {
                      label: 'Atendidas',
                      value: dashStats ? Number(dashStats.estadosCita.find(e => e.id === 4)?.total || 0) : '—',
                      icon: '🌟',
                      color: 'stat-mauve'
                    },
                    {
                      label: 'Clientas Registradas',
                      value: dashStats ? dashStats.totalClientas : '—',
                      icon: '👩',
                      color: 'stat-cream'
                    },
                  ].map((s, i) => (
                    <div key={i} className={`dash-stat-card ${s.color}`}>
                      <div className="stat-icon">{s.icon}</div>
                      <div className="stat-info">
                        <p className="stat-value">{s.value}</p>
                        <p className="stat-label">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="dash-bottom-row">
                  {/* Gráfico donut */}
                  <div className="dash-donut-card">
                    <div className="dash-card-header">
                      <h3>Estado de Citas</h3>
                      <span className="dash-badge-pill">General</span>
                    </div>
                    {dashStats ? (
                      <div className="donut-wrapper">
                        <svg viewBox="0 0 120 120" className="donut-svg">
                          {(() => {
                            const total = dashStats.estadosCita.reduce((a, e) => a + Number(e.total), 0);
                            const colores = ['#F59E0B', '#10B981', '#EF4444', '#6366F1'];
                            let offset = 0;
                            const circum = 2 * Math.PI * 40;
                            return dashStats.estadosCita.map((e, idx) => {
                              const pct = total > 0 ? Number(e.total) / total : 0;
                              const dash = pct * circum;
                              const gap = circum - dash;
                              const rotate = offset * 360 - 90;
                              offset += pct;
                              return (
                                <circle
                                  key={e.id}
                                  cx="60" cy="60" r="40"
                                  fill="none"
                                  stroke={colores[idx % colores.length]}
                                  strokeWidth="18"
                                  strokeDasharray={`${dash} ${gap}`}
                                  strokeDashoffset={0}
                                  transform={`rotate(${rotate} 60 60)`}
                                />
                              );
                            });
                          })()}
                          <text x="60" y="56" textAnchor="middle" className="donut-center-num">
                            {dashStats.estadosCita.reduce((a, e) => a + Number(e.total), 0)}
                          </text>
                          <text x="60" y="70" textAnchor="middle" className="donut-center-label">total</text>
                        </svg>
                        <div className="donut-legend">
                          {dashStats.estadosCita.map((e, idx) => {
                            const colores = ['#F59E0B', '#10B981', '#EF4444', '#6366F1'];
                            const total = dashStats.estadosCita.reduce((a, x) => a + Number(x.total), 0);
                            const pct = total > 0 ? Math.round(Number(e.total) / total * 100) : 0;
                            return (
                              <div key={e.id} className="legend-item">
                                <span className="legend-dot" style={{ background: colores[idx % colores.length] }} />
                                <span className="legend-label">{e.nombre}</span>
                                <span className="legend-count">{e.total} <em>({pct}%)</em></span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="loading">Cargando estadísticas...</p>
                    )}
                  </div>

                  {/* Ingresos recientes */}
                  <div className="dash-income-card">
                    <div className="dash-card-header">
                      <h3>Ingresos Recientes</h3>
                      <span className="dash-badge-pill">Top 5</span>
                    </div>
                    {dashStats?.citasRecientes?.length > 0 ? (
                      <div className="income-list">
                        {dashStats.citasRecientes.map((c, idx) => (
                          <div key={c.id} className="income-item">
                            <div className="income-rank">{idx + 1}</div>
                            <div className="income-info">
                              <p className="income-name">{c.cliente_nombre}</p>
                              <p className="income-sub">{c.servicio_nombre} · {c.fecha?.substring(0, 10)}</p>
                            </div>
                            <div className="income-amount">
                              ${Number(c.precio).toLocaleString()}
                            </div>
                          </div>
                        ))}
                        <div className="income-total-row">
                          <span>Total acumulado</span>
                          <strong>${dashStats ? Number(dashStats.ingresosTotal).toLocaleString() : 0} COP</strong>
                        </div>
                      </div>
                    ) : (
                      <p className="empty-income">No hay ingresos registrados aún.</p>
                    )}
                  </div>
                </div>

                {/* Agenda de hoy */}
                <div className="dash-schedule-card">
                  <div className="dash-card-header">
                    <h3>📆 Agenda de Hoy</h3>
                    <span className="dash-badge-pill">
                      {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  {dashStats?.citasHoy?.length > 0 ? (
                    <div className="schedule-timeline">
                      {dashStats.citasHoy.map(c => (
                        <div key={c.id} className={`timeline-item estado-${c.estado_id}`}>
                          <div className="timeline-time">
                            <span>{c.hora_inicio?.substring(0, 5)}</span>
                            <span className="timeline-fin">{c.hora_fin?.substring(0, 5)}</span>
                          </div>
                          <div className="timeline-bar" />
                          <div className="timeline-info">
                            <p className="timeline-nombre">{c.cliente_nombre}</p>
                            <p className="timeline-servicio">{c.servicio_nombre}</p>
                          </div>
                          <span className={`dash-badge-estado estado-${c.estado_id}`}>{c.estado_nombre}</span>
                          <span className="timeline-precio">${Number(c.precio).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-schedule">
                      ✨ No hay citas programadas para hoy.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SECCIÓN CITAS ── */}
            {dashSeccion === 'citas' && (
              <div className="dash-content">
                <div className="dash-topbar">
                  <div>
                    <h2 className="dash-title">Gestión de Citas</h2>
                    <p className="dash-subtitle">Revisa, confirma y gestiona todas las citas</p>
                  </div>
                  <div className="dash-topbar-actions">
                    <select
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value)}
                      className="dash-select"
                    >
                      <option value="">Todas</option>
                      <option value="1">Pendientes</option>
                      <option value="2">Confirmadas</option>
                      <option value="4">Atendidas</option>
                      <option value="3">Canceladas</option>
                    </select>
                    <button onClick={cargarCitasAdmin} className="dash-refresh-btn">🔄 Refrescar</button>
                  </div>
                </div>

                {cargandoCitas ? (
                  <p className="loading">Cargando citas...</p>
                ) : citasAdmin.length === 0 ? (
                  <div className="dash-empty-box">No hay citas registradas con este filtro.</div>
                ) : (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Clienta</th>
                          <th>Servicio(s)</th>
                          <th>Fecha & Horario</th>
                          <th>Total</th>
                          <th>Estado</th>
                          <th>Pago</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {citasAdmin.map((c) => (
                          <tr key={c.id}>
                            <td><strong>#{c.id}</strong></td>
                            <td>
                              <strong>{c.cliente_nombre}</strong>
                              <br /><small>📞 {c.cliente_telefono}</small>
                            </td>
                            <td>
                              <strong>{c.servicio_nombre}</strong>
                              <br /><small>⏱ {c.duracion_min} min</small>
                            </td>
                            <td>
                              📅 {c.fecha?.substring(0, 10)}
                              <br />🕒 {c.hora_inicio?.substring(0, 5)} – {c.hora_fin?.substring(0, 5)}
                            </td>
                            <td><strong>${Number(c.precio).toLocaleString()}</strong></td>
                            <td>
                              <span className={`dash-badge-estado estado-${c.estado_id}`}>{c.estado_nombre}</span>
                            </td>
                            <td>
                              <select
                                value={c.estado_pago}
                                className="dash-select-pago"
                                onChange={(e) => actualizarPago(c.id, e.target.value)}
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="parcial">Parcial</option>
                                <option value="pagado">Pagado</option>
                              </select>
                            </td>
                            <td>
                              <div className="dash-action-btns">
                                {c.estado_id !== 2 && (
                                  <button className="dash-act-btn confirm" onClick={() => actualizarEstadoCita(c.id, 2)}>✓</button>
                                )}
                                {c.estado_id !== 4 && (
                                  <button className="dash-act-btn attend" onClick={() => actualizarEstadoCita(c.id, 4)}>🌟</button>
                                )}
                                {c.estado_id !== 3 && (
                                  <button className="dash-act-btn cancel" onClick={() => actualizarEstadoCita(c.id, 3)}>✕</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── SECCIÓN SERVICIOS ── */}
            {dashSeccion === 'servicios' && (
              <div className="dash-content">
                <div className="dash-topbar">
                  <div>
                    <h2 className="dash-title">Catálogo de Servicios</h2>
                    <p className="dash-subtitle">Todos los servicios disponibles en el salón</p>
                  </div>
                </div>
                {cargandoServicios ? (
                  <p className="loading">Cargando servicios...</p>
                ) : (
                  <div className="dash-services-grid">
                    {servicios.map(s => (
                      <div key={s.id} className="dash-service-card">
                        <div className="dash-svc-header">
                          <span className="dash-svc-icon">💅</span>
                          <div>
                            <p className="dash-svc-name">{s.nombre}</p>
                            <p className="dash-svc-desc">{s.descripcion}</p>
                          </div>
                        </div>
                        <div className="dash-svc-footer">
                          <span className="dash-svc-duration">⏱ {s.duracion_min} min</span>
                          <span className="dash-svc-price">${Number(s.precio).toLocaleString()} COP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SECCIÓN CLIENTAS ── */}
            {dashSeccion === 'clientas' && (
              <div className="dash-content">
                <div className="dash-topbar">
                  <div>
                    <h2 className="dash-title">Clientas</h2>
                    <p className="dash-subtitle">Historial de citas por clienta</p>
                  </div>
                </div>
                <div className="dash-table-wrap">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Clienta</th>
                        <th>Servicio(s)</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citasAdmin.map((c) => (
                        <tr key={c.id}>
                          <td>#{c.id}</td>
                          <td>
                            <strong>{c.cliente_nombre}</strong>
                            <br /><small>📞 {c.cliente_telefono}</small>
                          </td>
                          <td>{c.servicio_nombre}</td>
                          <td>{c.fecha?.substring(0, 10)}</td>
                          <td>${Number(c.precio).toLocaleString()}</td>
                          <td><span className={`dash-badge-estado estado-${c.estado_id}`}>{c.estado_nombre}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* VISTAS INDEPENDIENTES */
        <main className="page-stage">
          {pagina === 'inicio' && (
          <section className="hero">
            <span className="badge">Salón & Spa de Alta Gama</span>
            <h1>Elegancia y Perfección en Cada Detalle</h1>
            <p>Puedes elegir <strong>uno o varios tratamientos continuos</strong> para el mismo día (ej. Manicure + Pedicure).</p>
            <div className="hero-actions">
              <button type="button" className="submit-btn" onClick={() => irA('tratamientos')}>Ver tratamientos</button>
              {!esAdmin && (
                <button type="button" className="btn-cliente-login" onClick={() => irA('reservar')}>Reservar cita</button>
              )}
            </div>
          </section>
          )}

          {pagina === 'nosotros' && (
            <section className="section about-page">
              <div className="section-header">
                <h2>Nosotras</h2>
                <p>Un espacio pensado para el detalle, el descanso y el cuidado de tus manos y pies.</p>
              </div>
              <div className="info-grid">
                <article className="info-card">
                  <h3>El estudio</h3>
                  <p>Glam Nails Studio & Spa combina técnica profesional con un ambiente cálido. Cada cita se agenda con tiempo real para que no se crucen servicios.</p>
                </article>
                <article className="info-card">
                  <h3>El equipo</h3>
                  <p>Atención personalizada, protocolos de higiene y acabados de larga duración en manicure, gel, pedicure y acrílico.</p>
                </article>
                <article className="info-card">
                  <h3>Tu cita</h3>
                  <p>Elige hasta dos tratamientos continuos (por ejemplo manicure + pedicure) y reserva el bloque completo en un solo paso.</p>
                </article>
              </div>
            </section>
          )}

          {pagina === 'tratamientos' && (
          <section id="servicios" className="section">
            <div className="section-header">
              <h2>Nuestros Tratamientos Exclusivos</h2>
              <p>Puedes elegir hasta un <strong>máximo de 2 servicios</strong> para tu cita (ej. Manicure + Pedicure)</p>
            </div>

            {cargandoServicios ? (
              <p className="loading">Cargando catálogo...</p>
            ) : (() => {
              // 5 Imágenes maestras por categoría (Opción 1)
              const IMAGENES_CATEGORIA = {
                '💅 Manicura': '/cat-manicura.jpg',
                '🦶 Pedicure': '/cat-pedicure.jpg',
                '🔄 Retoques': '/cat-retoques.jpg',
                '🧔 Caballero': '/cat-caballero.jpg',
                '✨ Servicios Adicionales': '/cat-adicionales.jpg',
                '🌸 Otros': '/manicure-tradicional.png'
              };

              // Agrupar servicios por categoría
              const categorias = [
                {
                  nombre: '💅 Manicura',
                  keywords: ['Manicure', 'Semipermanente', 'Dipping', 'Nivelación', 'Forrado', 'Press On', 'Polygel con', 'Acrílicas con'],
                  color: 'cat-manicure',
                  imagen: IMAGENES_CATEGORIA['💅 Manicura']
                },
                {
                  nombre: '🦶 Pedicure',
                  keywords: ['Pedicure'],
                  color: 'cat-pedicure',
                  imagen: IMAGENES_CATEGORIA['🦶 Pedicure']
                },
                {
                  nombre: '🔄 Retoques',
                  keywords: ['Retoque'],
                  color: 'cat-retoques',
                  imagen: IMAGENES_CATEGORIA['🔄 Retoques']
                },
                {
                  nombre: '🧔 Caballero',
                  keywords: ['Caballero'],
                  color: 'cat-caballero',
                  imagen: IMAGENES_CATEGORIA['🧔 Caballero']
                },
                {
                  nombre: '✨ Servicios Adicionales',
                  keywords: ['Retiro', 'Decoración', 'Reparación'],
                  color: 'cat-adicional',
                  imagen: IMAGENES_CATEGORIA['✨ Servicios Adicionales']
                },
              ];

              const asignados = new Set();
              const grupos = categorias.map(cat => {
                const items = servicios.filter(s =>
                  !asignados.has(s.id) &&
                  cat.keywords.some(kw => s.nombre.includes(kw))
                );
                items.forEach(s => asignados.add(s.id));
                return { ...cat, items };
              });

              const sinCategorizar = servicios.filter(s => !asignados.has(s.id));
              if (sinCategorizar.length > 0) {
                grupos.push({
                  nombre: '🌸 Otros',
                  keywords: [],
                  color: 'cat-otros',
                  imagen: IMAGENES_CATEGORIA['🌸 Otros'],
                  items: sinCategorizar
                });
              }

              return (
                <div className="catalogo-categorias">
                  {grupos.filter(g => g.items.length > 0).map(grupo => (
                    <div key={grupo.nombre} className={`categoria-grupo ${grupo.color}`}>
                      <div className="categoria-banner">
                        <div className="categoria-banner-img-wrap">
                          <img src={grupo.imagen} alt={grupo.nombre} className="categoria-banner-img" />
                          <div className="categoria-banner-overlay" />
                        </div>
                        <div className="categoria-banner-text">
                          <h3 className="categoria-titulo">{grupo.nombre}</h3>
                          <span className="categoria-badge">{grupo.items.length} servicios disponibles</span>
                        </div>
                      </div>

                      <div className="categoria-cards">
                        {grupo.items.map(s => {
                          const sel = serviciosSeleccionados.some(item => item.id === s.id);
                          return (
                            <div
                              key={s.id}
                              className={`service-card-mini ${sel ? 'selected' : ''}`}
                              onClick={() => toggleServicio(s)}
                            >
                              <div className="mini-header-indicator">
                                <span className="mini-chip-cat">{grupo.nombre.split(' ')[0]}</span>
                                {sel && <span className="mini-checkmark-chip">✓ Elegido</span>}
                              </div>
                              <div className="mini-body">
                                <h4>{s.nombre}</h4>
                                <p className="mini-desc">{s.descripcion}</p>
                                <div className="mini-footer">
                                  <span className="mini-dur">⏱ {s.duracion_min} min</span>
                                  <span className="mini-price">${Number(s.precio).toLocaleString()}</span>
                                </div>
                                <button className={`mini-select-btn ${sel ? 'selected' : ''}`}>
                                  {sel ? '✓ En tu paquete' : '+ Agregar'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {!esAdmin && (
              <div className="hero-actions">
                <button type="button" className="submit-btn" onClick={() => irA('reservar')}>Continuar a reservar</button>
              </div>
            )}
          </section>
          )}

          {pagina === 'reservar' && !esAdmin && (
          <section id="reservar" className="section form-section">
            <div className="form-wrapper">
              <div className="form-header">
                <h2>Agenda Tu Espacio</h2>

                {/* Resumen del paquete / servicios elegidos */}
                <div className="combo-summary-box">
                  <div className="combo-title">
                    <span>✨ Tu Sesión ({serviciosSeleccionados.length} {serviciosSeleccionados.length === 1 ? 'servicio' : 'servicios'}):</span>
                  </div>
                  <div className="combo-chips">
                    {serviciosSeleccionados.map(s => (
                      <span key={s.id} className="service-chip">
                        {s.nombre} (⏱ {s.duracion_min}m)
                      </span>
                    ))}
                  </div>
                  <div className="combo-totals">
                    <span>⏱ Duración Total: <strong>{duracionTotal} min</strong></span>
                    <span>💵 Inversión: <strong>${precioTotal.toLocaleString()} COP</strong></span>
                  </div>
                </div>

                {!usuario && (
                  <p className="login-tip">
                    ✦ Para reservar, te pediremos identificarte con tu correo o registrarte en un clic.
                  </p>
                )}
              </div>

              <form onSubmit={handleReservar} className="booking-form">
                <div className="form-group">
                  <label>Fecha de la Sesión</label>
                  <input
                    type="date"
                    required
                    min={fechaHoy}
                    value={formReserva.fecha}
                    onChange={(e) => setFormReserva({ ...formReserva, fecha: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Hora de Inicio</label>
                  <select
                    value={formReserva.hora_inicio}
                    onChange={(e) => setFormReserva({ ...formReserva, hora_inicio: e.target.value })}
                  >
                    {HORARIOS_DISPONIBLES.map(h => {
                      // Proyección: ¿Choca el bloque completo [inicio, inicio + duracionTotal] con alguna cita ocupada?
                      const [hH, hM] = h.valor.split(':').map(Number);
                      const minIni = hH * 60 + hM;
                      const minFin = minIni + duracionTotal;

                      const estaOcupada = horasOcupadas.some(ocupada => {
                        const [oH1, oM1] = ocupada.hora_inicio.split(':').map(Number);
                        const [oH2, oM2] = ocupada.hora_fin.split(':').map(Number);
                        const oMinIni = oH1 * 60 + oM1;
                        const oMinFin = oH2 * 60 + oM2;

                        return minIni < oMinFin && minFin > oMinIni;
                      });

                      return (
                        <option key={h.valor} value={h.valor} disabled={estaOcupada}>
                          {h.etiqueta} {estaOcupada ? '⛔ (Sin tiempo suficiente)' : '✓ (Disponible)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {formReserva.hora_inicio && (
                  <div className="form-group full info-rango">
                    <span>🕒 Tu sesión se realizará de <strong>{formReserva.hora_inicio.substring(0, 5)}</strong> a <strong>{calcularHoraFin(formReserva.hora_inicio, duracionTotal)}</strong></span>
                  </div>
                )}

                <div className="form-group full">
                  <label>Observaciones o diseño personalizado (Opcional)</label>
                  <textarea
                    rows="2"
                    placeholder="Especifícanos colores, técnicas o referencias que tengas en mente para tus servicios..."
                    value={formReserva.observacion}
                    onChange={(e) => setFormReserva({ ...formReserva, observacion: e.target.value })}
                  />
                </div>

                <button type="submit" className="submit-btn" disabled={reservaCargando}>
                  {reservaCargando ? 'Procesando...' : usuario ? `Confirmar Cita ($${precioTotal.toLocaleString()} COP) ✦` : 'Iniciar Sesión y Reservar ✦'}
                </button>
              </form>
            </div>
          </section>
          )}

          {pagina === 'citas' && usuario && !esAdmin && (
            <section id="mis-citas" className="section mis-citas-section">
              <div className="section-header">
                <h2>Mis Citas Reservadas</h2>
                <p>Historial y citas confirmadas para tus próximos servicios</p>
              </div>

              {cargandoCitas ? (
                <p className="loading">Cargando tus citas...</p>
              ) : misCitas.length === 0 ? (
                <div className="empty-box">Aún no tienes citas agendadas. Elige tus servicios en Tratamientos.</div>
              ) : (
                <div className="citas-grid">
                  {misCitas.map((mc) => (
                    <div key={mc.id} className="cita-clienta-card">
                      <div className="cita-top">
                        <span className="cita-id">Cita #{mc.id}</span>
                        <span className={`badge-state state-${mc.estado_id}`}>{mc.estado_nombre}</span>
                      </div>
                      <h4>{mc.servicio_nombre}</h4>
                      <div className="cita-info">
                        <p>📅 <strong>Fecha:</strong> {mc.fecha?.substring(0, 10)}</p>
                        <p>🕒 <strong>Horario:</strong> {mc.hora_inicio?.substring(0, 5)} - {mc.hora_fin?.substring(0, 5)}</p>
                        <p>⏱ <strong>Duración:</strong> {mc.duracion_min} minutos</p>
                        <p>💵 <strong>Inversión:</strong> ${Number(mc.precio).toLocaleString()} COP</p>
                        <p>💳 <strong>Pago:</strong> {mc.estado_pago}</p>
                      </div>
                      {mc.observacion && (
                        <p className="cita-obs"><em>"{mc.observacion}"</em></p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {pagina === 'contacto' && (
            <section className="section about-page">
              <div className="section-header">
                <h2>Contacto</h2>
                <p>Escríbenos para dudas, cambios de cita o diseños especiales.</p>
              </div>
              <div className="info-grid">
                <article className="info-card">
                  <h3>WhatsApp</h3>
                  <p>300 999 8877 — respuesta en horario de atención.</p>
                </article>
                <article className="info-card">
                  <h3>Horario</h3>
                  <p>Lunes a sábado, 8:00 a.m. a 6:00 p.m.</p>
                </article>
                <article className="info-card">
                  <h3>Correo</h3>
                  <p>admin@glamnails.com</p>
                </article>
              </div>
            </section>
          )}
        </main>
      )}

      <footer className="footer">
        <p>© 2026 Glam Nails Studio & Spa — Arte y cuidado premium en tus manos</p>
      </footer>
      </div>

      {/* MODAL AUTH */}
      {tipoModal && (
        <div className="modal-backdrop" onClick={() => setTipoModal(null)}>
          <div className="desert-card-container" onClick={(e) => e.stopPropagation()}>
            <button className="desert-close-btn" onClick={() => setTipoModal(null)}>✕</button>

            <div className="desert-image-panel">
              <img src={IMAGEN_MODAL} alt="Glam Nails Studio" />
              <div className="desert-image-overlay">
                <span className="desert-image-brand">✦ GLAM NAILS</span>
              </div>
            </div>

            <div className="desert-form-panel">
              {tipoModal === 'login_admin' && (
                <>
                  <h2 className="desert-title">Admin Login</h2>
                  <p className="desert-subtitle">Área exclusiva para administración</p>

                  <form onSubmit={handleAuthSubmit} className="desert-form">
                    <div className="desert-input-group">
                      <label>Email</label>
                      <div className="desert-input-wrap">
                        <input
                          type="email"
                          required
                          value={authForm.correo}
                          onChange={(e) => setAuthForm({ ...authForm, correo: e.target.value })}
                        />
                        <span className="input-icon">✉</span>
                      </div>
                    </div>

                    <div className="desert-input-group">
                      <label>Password</label>
                      <div className="desert-input-wrap">
                        <input
                          type="password"
                          required
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                        <span className="input-icon">🔒</span>
                      </div>
                    </div>

                    {authError && <div className="desert-error">{authError}</div>}

                    <button type="submit" className="desert-submit-btn" disabled={authCargando}>
                      {authCargando ? 'Validando...' : 'Login'}
                    </button>
                  </form>
                </>
              )}

              {tipoModal === 'login_cliente' && (
                <>
                  <h2 className="desert-title">Login</h2>
                  
                  <form onSubmit={handleAuthSubmit} className="desert-form">
                    <div className="desert-input-group">
                      <label>Email</label>
                      <div className="desert-input-wrap">
                        <input
                          type="email"
                          required
                          value={authForm.correo}
                          onChange={(e) => setAuthForm({ ...authForm, correo: e.target.value })}
                        />
                        <span className="input-icon">✉</span>
                      </div>
                    </div>

                    <div className="desert-input-group">
                      <label>Password</label>
                      <div className="desert-input-wrap">
                        <input
                          type="password"
                          required
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                        <span className="input-icon">🔒</span>
                      </div>
                    </div>

                    {authError && <div className="desert-error">{authError}</div>}

                    <button type="submit" className="desert-submit-btn" disabled={authCargando}>
                      {authCargando ? 'Validando...' : 'Login'}
                    </button>

                    <div className="desert-footer-links">
                      <button 
                        type="button" 
                        className="desert-link"
                        onClick={() => { setAuthError(''); setTipoModal('registro_cliente'); }}
                      >
                        Create an account
                      </button>
                      <button 
                        type="button" 
                        className="desert-link"
                        onClick={() => mostrarAlerta('Por favor contacta a la administradora para restablecer tu contraseña', 'warning')}
                      >
                        Forgot password
                      </button>
                    </div>
                  </form>
                </>
              )}

              {tipoModal === 'registro_cliente' && (
                <>
                  <h2 className="desert-title">Sign Up</h2>
                  
                  <form onSubmit={handleAuthSubmit} className="desert-form">
                    <div className="desert-input-group">
                      <label>Full Name</label>
                      <div className="desert-input-wrap">
                        <input
                          type="text"
                          required
                          value={authForm.nombre_completo}
                          onChange={(e) => setAuthForm({ ...authForm, nombre_completo: e.target.value })}
                        />
                        <span className="input-icon">👤</span>
                      </div>
                    </div>

                    <div className="desert-input-group">
                      <label>Document ID / Cédula</label>
                      <div className="desert-input-wrap">
                        <input
                          type="text"
                          required
                          value={authForm.documento}
                          onChange={(e) => setAuthForm({ ...authForm, documento: e.target.value })}
                        />
                        <span className="input-icon">🪪</span>
                      </div>
                    </div>

                    <div className="desert-input-group">
                      <label>Phone / WhatsApp</label>
                      <div className="desert-input-wrap">
                        <input
                          type="tel"
                          required
                          value={authForm.telefono}
                          onChange={(e) => setAuthForm({ ...authForm, telefono: e.target.value })}
                        />
                        <span className="input-icon">📞</span>
                      </div>
                    </div>

                    <div className="desert-input-group">
                      <label>Email</label>
                      <div className="desert-input-wrap">
                        <input
                          type="email"
                          required
                          value={authForm.correo}
                          onChange={(e) => setAuthForm({ ...authForm, correo: e.target.value })}
                        />
                        <span className="input-icon">✉</span>
                      </div>
                    </div>

                    <div className="desert-input-group">
                      <label>Password</label>
                      <div className="desert-input-wrap">
                        <input
                          type="password"
                          required
                          placeholder="Mínimo 6 caracteres"
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                        <span className="input-icon">🔒</span>
                      </div>
                    </div>

                    {authError && <div className="desert-error">{authError}</div>}

                    <button type="submit" className="desert-submit-btn" disabled={authCargando}>
                      {authCargando ? 'Registrando...' : 'Create Account'}
                    </button>

                    <div className="desert-footer-links" style={{ justifyContent: 'center' }}>
                      <button 
                        type="button" 
                        className="desert-link"
                        onClick={() => { setAuthError(''); setTipoModal('login_cliente'); }}
                      >
                        Already have an account? Login
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
