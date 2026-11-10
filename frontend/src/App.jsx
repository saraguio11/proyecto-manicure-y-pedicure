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

const SERVICIOS_DEFAULT = [
  { id: 1, nombre: 'Manicure tradicional', descripcion: 'Limado, cutícula y esmaltado tradicional.', duracion_min: 45, precio: 25000, categoria: '💅 Manicura' },
  { id: 2, nombre: 'Manicure en gel', descripcion: 'Esmaltado semipermanente con acabado brillante.', duracion_min: 60, precio: 40000, categoria: '💅 Manicura' },
  { id: 3, nombre: 'Pedicure tradicional', descripcion: 'Limpieza, exfoliación y esmaltado de pies.', duracion_min: 60, precio: 30000, categoria: '🦶 Pedicure' },
  { id: 4, nombre: 'Uñas acrílicas', descripcion: 'Extensión de uñas con acrílico y diseño a elección.', duracion_min: 120, precio: 80000, categoria: '💅 Manicura' },
  { id: 5, nombre: 'Semipermanente', descripcion: 'Esmaltado semipermanente de larga duración con curado en lámpara.', duracion_min: 60, precio: 38000, categoria: '💅 Manicura' },
  { id: 6, nombre: 'Semipermanente con Rubber Base', descripcion: 'Esmaltado semipermanente con base rubber que refuerza y protege la uña natural.', duracion_min: 60, precio: 40000, categoria: '💅 Manicura' },
  { id: 7, nombre: 'Dipping', descripcion: 'Técnica de inmersión en polvo acrílico para uñas resistentes.', duracion_min: 60, precio: 45000, categoria: '💅 Manicura' },
  { id: 8, nombre: 'Nivelación', descripcion: 'Corrección y nivelado de la superficie de la uña.', duracion_min: 75, precio: 50000, categoria: '💅 Manicura' }
];

const IMAGEN_MODAL = '/login-art.png';

const DIAS_SEMANA_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const GCAL_HORAS = [
  { hora: 8, etiqueta: '8 AM', valor: '08:00:00' },
  { hora: 9, etiqueta: '9 AM', valor: '09:00:00' },
  { hora: 10, etiqueta: '10 AM', valor: '10:00:00' },
  { hora: 11, etiqueta: '11 AM', valor: '11:00:00' },
  { hora: 12, etiqueta: '12 PM', valor: '12:00:00' },
  { hora: 13, etiqueta: '1 PM', valor: '13:00:00' },
  { hora: 14, etiqueta: '2 PM', valor: '14:00:00' },
  { hora: 15, etiqueta: '3 PM', valor: '15:00:00' },
  { hora: 16, etiqueta: '4 PM', valor: '16:00:00' },
  { hora: 17, etiqueta: '5 PM', valor: '17:00:00' },
  { hora: 18, etiqueta: '6 PM', valor: '18:00:00' },
  { hora: 19, etiqueta: '7 PM', valor: '19:00:00' },
  { hora: 20, etiqueta: '8 PM', valor: '20:00:00' },
  { hora: 21, etiqueta: '9 PM', valor: '21:00:00' },
  { hora: 22, etiqueta: '10 PM', valor: '22:00:00' }
];

const formatearHora12 = (horaStr) => {
  if (!horaStr) return '';
  const [h, m] = horaStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return horaStr;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mStr = String(m).padStart(2, '0');
  return `${h12}:${mStr} ${ampm}`;
};

const sumarDias = (fechaStr, delta) => {
  if (!fechaStr) return '';
  const d = new Date(fechaStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
};

const calcularPosicionesEventos = (eventos) => {
  const evs = [...eventos].sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  return evs.map((e, idx) => {
    const [hI, mI] = (e.hora_inicio || '08:00').split(':').map(Number);
    const startMin = (hI * 60 + mI);
    const [hF, mF] = (e.hora_fin || '').split(':').map(Number);
    const endMin = (!isNaN(hF) && !isNaN(mF)) ? (hF * 60 + mF) : (startMin + (Number(e.duracion_min) || 60));
    const durMin = Math.max(endMin - startMin, 35);
    const top = startMin - 480;

    const colisiona = idx > 0 && (() => {
      const prev = evs[idx - 1];
      const [pHI, pMI] = (prev.hora_inicio || '08:00').split(':').map(Number);
      const [pHF, pMF] = (prev.hora_fin || '').split(':').map(Number);
      const pStart = pHI * 60 + pMI;
      const pEnd = (!isNaN(pHF) && !isNaN(pMF)) ? (pHF * 60 + pMF) : (pStart + (Number(prev.duracion_min) || 60));
      return startMin < pEnd;
    })();

    return {
      ...e,
      topPx: top,
      heightPx: durMin,
      colisiona
    };
  });
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token_spa') || '');
  const [usuario, setUsuario] = useState(() => {
    const sesion = localStorage.getItem('sesion_spa');
    return sesion ? JSON.parse(sesion) : null;
  });

  const esAdmin = usuario?.rol === 'Administradora' || usuario?.rol_id === 2;

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
  const [verPassword, setVerPassword] = useState(false);
  
  // Tema Blanco / Negro (Modo Claro vs Modo Oscuro tipo Instagram / Windows)
  const [temaOscuro, setTemaOscuro] = useState(() => {
    const guardado = localStorage.getItem('tema_oscuro');
    return guardado === 'true';
  });

  const toggleTema = () => {
    setTemaOscuro(prev => {
      const nuevo = !prev;
      localStorage.setItem('tema_oscuro', String(nuevo));
      return nuevo;
    });
  };

  const mostrarAlerta = (texto, tipo = 'success') => {
    setAlerta({ texto, tipo });
    setTimeout(() => setAlerta(null), 4500);
  };
  const irA = (id) => {
    setPagina(id);
    setMenuAbierto(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [servicios, setServicios] = useState(SERVICIOS_DEFAULT);
  // Ahora soportamos selección múltiple de servicios (Combo / Paquete de belleza)
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([SERVICIOS_DEFAULT[0]]);
  const [cargandoServicios, setCargandoServicios] = useState(false);

  const fechaHoy = new Date().toISOString().split('T')[0];
  const [formReserva, setFormReserva] = useState({
    fecha: fechaHoy,
    hora_inicio: '10:00:00',
    observacion: '',
    manicurista_id: ''
  });
  const [reservaCargando, setReservaCargando] = useState(false);
  const [horasOcupadas, setHorasOcupadas] = useState([]);
  const [vistaCalendario, setVistaCalendario] = useState('dia'); // 'dia' (Google Calendar) | 'mes'
  const [vistaCitasAdmin, setVistaCitasAdmin] = useState('calendario'); // 'tabla' | 'calendario'
  const [fechaAdminGcal, setFechaAdminGcal] = useState(fechaHoy);
  const [citasGcalAdmin, setCitasGcalAdmin] = useState([]);
  const [citaDetalleModal, setCitaDetalleModal] = useState(null);

  const cargarCitasGcalAdmin = (f) => {
    const targetFecha = f || fechaAdminGcal;
    fetch(`${API_BASE}/citas/disponibilidad?fecha=${targetFecha}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCitasGcalAdmin(data);
      })
      .catch(err => console.error(err));
  };

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
    const url = esAdmin ? `${API_BASE}/servicios/admin/all` : `${API_BASE}/servicios`;
    fetch(url, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setServicios(data);
          // Si no había ninguno seleccionado, seleccionar el primero
          setServiciosSeleccionados(prev => (prev.length === 0 ? [data[0]] : prev));
        }
      })
      .catch(err => {
        console.warn('Usando catálogo inicial (offline/sync):', err);
      })
      .finally(() => setCargandoServicios(false));
  };

  const cargarManicuristasPublicas = () => {
    fetch(`${API_BASE}/manicuristas`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setManicuristas(data);
      })
      .catch(err => console.error(err));
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
  const duracionTotal = serviciosSeleccionados.reduce((acc, s) => acc + (Number(s.duracion_min) || 45), 0);
  const precioTotal = serviciosSeleccionados.reduce((acc, s) => acc + (Number(s.precio) || 0), 0);

  // Calcular la hora fin proyectada
  const calcularHoraFin = (hInicio, duracionMin) => {
    if (!hInicio) return '';
    const dur = Number(duracionMin) || 0;
    if (dur <= 0) return hInicio.substring(0, 5);
    const [h, m] = hInicio.split(':').map(Number);
    const minTotales = h * 60 + m + dur;
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
  const [dashSeccion, setDashSeccion] = useState('dashboard'); // dashboard | citas | servicios | manicuristas | clientas

  // ── CRUD Servicios (admin) ──
  const [modalServicio, setModalServicio] = useState(null); // null | 'nuevo' | objeto_servicio
  const [formServicio, setFormServicio] = useState({ nombre: '', descripcion: '', duracion_min: 60, precio: '', imagen_url: '', categoria: '' });
  const [guardandoServicio, setGuardandoServicio] = useState(false);
  const CATEGORIAS_SERVICIO = ['💅 Manicura', '🦶 Pedicure', '🔄 Retoques', '🧔 Caballero', '✨ Adicionales'];

  // ── CRUD Manicuristas (admin) ──
  const [manicuristas, setManicuristas] = useState([]);
  const [cargandoManicuristas, setCargandoManicuristas] = useState(false);
  const [modalManicurista, setModalManicurista] = useState(null); // null | 'nuevo' | objeto
  const [formManicurista, setFormManicurista] = useState({ nombre: '', especialidad: '', foto_url: '' });
  const [guardandoManicurista, setGuardandoManicurista] = useState(false);

  // ── Calendario de reservas (vista cliente) ──
  const hoy = new Date();
  const [calMes, setCalMes] = useState(hoy.getMonth());
  const [calAnio, setCalAnio] = useState(hoy.getFullYear());
  const [calDiaSeleccionado, setCalDiaSeleccionado] = useState(null);

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

  useEffect(() => {
    if (esAdmin && dashSeccion === 'citas' && vistaCitasAdmin === 'calendario') {
      cargarCitasGcalAdmin(fechaAdminGcal);
    }
  }, [esAdmin, dashSeccion, vistaCitasAdmin, fechaAdminGcal]);

  const renderGoogleCalendar = ({
    fecha,
    citas,
    esAdminMode = false,
    onCambiarFecha,
    onSeleccionarHora,
    horaSeleccionada = '',
    duracion = 60
  }) => {
    const dObj = new Date(fecha + 'T12:00:00');
    const diaSemana = DIAS_SEMANA_CORTO[dObj.getDay()] || 'LUN';
    const diaNum = dObj.getDate();
    const esDiaHoy = fecha === fechaHoy;
    const ahora = new Date();
    const minActuales = ahora.getHours() * 60 + ahora.getMinutes();
    const redLineVisible = esDiaHoy && minActuales >= 480 && minActuales <= 1320;
    const redLineTop = minActuales - 480;

    const eventosPosicionados = calcularPosicionesEventos(citas || []);

    return (
      <div className="gcal-container">
        {/* Cabecera Google Calendar */}
        <div className="gcal-header">
          <div className="gcal-header-left">
            <button
              type="button"
              className="gcal-nav-btn"
              disabled={!esAdminMode && fecha <= fechaHoy}
              onClick={() => {
                const ant = sumarDias(fecha, -1);
                if (esAdminMode || ant >= fechaHoy) {
                  onCambiarFecha(ant);
                }
              }}
              title={!esAdminMode && fecha <= fechaHoy ? "No puedes reservar en fechas pasadas" : "Día anterior"}
            >
              ‹
            </button>
            <button
              type="button"
              className="gcal-today-btn"
              onClick={() => onCambiarFecha(fechaHoy)}
              title="Ir al día de hoy"
            >
              Hoy
            </button>
            <button
              type="button"
              className="gcal-nav-btn"
              onClick={() => onCambiarFecha(sumarDias(fecha, 1))}
              title="Día siguiente"
            >
              ›
            </button>
            <input
              type="date"
              className="gcal-date-picker-input"
              value={fecha}
              min={!esAdminMode ? fechaHoy : undefined}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                if (!esAdminMode && val < fechaHoy) {
                  mostrarAlerta('No puedes agendar citas en fechas anteriores a hoy', 'error');
                  return;
                }
                onCambiarFecha(val);
              }}
              title="Elegir fecha"
            />
          </div>

          <div className="gcal-header-center">
            <div className="gcal-day-badge-wrap">
              <span className="gcal-day-name">{diaSemana}</span>
              <span className={`gcal-day-circle ${esDiaHoy ? 'is-today' : ''}`}>{diaNum}</span>
            </div>
            <div className="gcal-date-label-full">
              {dObj.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div className="gcal-header-right">
            <span className="gcal-timezone-tag">GMT-5</span>
          </div>
        </div>

        {/* Barra de leyenda explicativa e intuitiva */}
        <div className="gcal-legend-bar">
          <span className="gcal-legend-item"><span className="gcal-legend-dot blue" /> Cita Ocupada</span>
          {!esAdminMode && <span className="gcal-legend-item"><span className="gcal-legend-dot purple" /> Tu Selección</span>}
          {redLineVisible && <span className="gcal-legend-item"><span className="gcal-legend-dot red" /> Hora Actual</span>}
          {!esAdminMode && <span className="gcal-legend-tip">💡 Toca cualquier franja libre para agendar a esa hora</span>}
        </div>

        {/* Cuerpo del calendario: Timeline de 8 AM a 10 PM */}
        <div className="gcal-scroll-body">
          <div className="gcal-timeline-layout">
            {/* Columna izquierda de horas */}
            <div className="gcal-time-axis">
              {GCAL_HORAS.map(h => (
                <div key={h.hora} className="gcal-axis-hour">
                  <span>{h.etiqueta}</span>
                </div>
              ))}
            </div>

            {/* Canvas de la grilla y bloques de eventos */}
            <div className="gcal-grid-canvas">
              {/* Líneas horizontales de cada hora */}
              {GCAL_HORAS.map(h => (
                <div
                  key={h.hora}
                  className="gcal-grid-row"
                  onClick={() => {
                    if (!esAdminMode && onSeleccionarHora && fecha >= fechaHoy) {
                      onSeleccionarHora(h.valor);
                    }
                  }}
                  title={!esAdminMode && fecha >= fechaHoy ? `Haz clic para agendar a las ${h.etiqueta}` : ''}
                >
                  <div className="gcal-half-hour-line" />
                </div>
              ))}

              {/* Línea roja de hora actual de Google Calendar */}
              {redLineVisible && (
                <div className="gcal-now-line" style={{ top: `${redLineTop}px` }}>
                  <span className="gcal-now-dot" />
                </div>
              )}

              {/* Eventos / Citas agendadas */}
              {eventosPosicionados.map(c => {
                const anchoStyle = c.colisiona
                  ? { width: 'calc(50% - 10px)', left: 'calc(50% + 4px)' }
                  : { width: 'calc(100% - 12px)', left: '6px' };

                return (
                  <div
                    key={c.id}
                    className={`gcal-event-block estado-${c.estado_id || 1}`}
                    style={{
                      top: `${Math.max(c.topPx, 0)}px`,
                      height: `${Math.max(c.heightPx, 38)}px`,
                      ...anchoStyle
                    }}
                    onClick={() => {
                      if (esAdminMode) setCitaDetalleModal(c);
                    }}
                    title={`Cita: ${c.servicio_nombre} (${formatearHora12(c.hora_inicio)} - ${formatearHora12(c.hora_fin)}) · Clienta: ${c.cliente_nombre || 'Clienta'} · Manicurista: ${c.manicurista_nombre || 'Sin asignar'}`}
                  >
                    <div className="gcal-event-header-row">
                      <span className="gcal-event-title">💅 {c.servicio_nombre || 'Cita de salón'}</span>
                      <span className="gcal-event-time-pill">{formatearHora12(c.hora_inicio)} – {formatearHora12(c.hora_fin)}</span>
                    </div>
                    {c.heightPx >= 46 && (
                      <div className="gcal-event-meta-row">
                        <span className="gcal-event-client">👤 {c.cliente_nombre || 'Clienta'}</span>
                        {c.manicurista_nombre && (
                          <span className="gcal-event-staff">✨ {c.manicurista_nombre}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Bloque interactivo de reserva seleccionada por el cliente */}
              {!esAdminMode && horaSeleccionada && fecha >= fechaHoy && (() => {
                const [hB, mB] = horaSeleccionada.split(':').map(Number);
                if (isNaN(hB) || isNaN(mB)) return null;
                const startB = hB * 60 + mB;
                const topB = startB - 480;
                const heightB = Math.max(duracion, 40);
                const hFin = calcularHoraFin(horaSeleccionada, duracion);

                return (
                  <div
                    className="gcal-booking-preview"
                    style={{
                      top: `${Math.max(topB, 0)}px`,
                      height: `${heightB}px`,
                      width: 'calc(100% - 12px)',
                      left: '6px'
                    }}
                  >
                    <div className="gcal-preview-header-row">
                      <span className="gcal-preview-badge">✨ TU SELECCIÓN</span>
                      <span className="gcal-preview-time-pill">
                        🕒 {formatearHora12(horaSeleccionada)} – {formatearHora12(hFin)} ({duracion}m)
                      </span>
                    </div>
                    <div className="gcal-preview-title">
                      {serviciosSeleccionados.map(s => s.nombre).join(' + ')}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

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

  // ── Cargar manicuristas (admin) ──
  const cargarManicuristas = () => {
    if (!token) return;
    setCargandoManicuristas(true);
    fetch(`${API_BASE}/manicuristas/admin/all`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setManicuristas(data); })
      .catch(err => console.error(err))
      .finally(() => setCargandoManicuristas(false));
  };

  // ── CRUD Servicios ──
  const abrirFormServicio = (servicio = null) => {
    if (servicio) {
      setFormServicio({ nombre: servicio.nombre, descripcion: servicio.descripcion || '', duracion_min: servicio.duracion_min, precio: servicio.precio, imagen_url: servicio.imagen_url || '', categoria: servicio.categoria || '' });
      setModalServicio(servicio);
    } else {
      setFormServicio({ nombre: '', descripcion: '', duracion_min: 60, precio: '', imagen_url: '', categoria: '' });
      setModalServicio('nuevo');
    }
  };
  const cerrarFormServicio = () => setModalServicio(null);

  const guardarServicio = async (e) => {
    e.preventDefault();
    if (!formServicio.nombre.trim() || !formServicio.precio || !formServicio.duracion_min) {
      return mostrarAlerta('Nombre, precio y duración son obligatorios', 'error');
    }
    setGuardandoServicio(true);
    try {
      const esEdicion = modalServicio && modalServicio !== 'nuevo';
      const url = esEdicion ? `${API_BASE}/servicios/${modalServicio.id}` : `${API_BASE}/servicios`;
      const method = esEdicion ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify({ ...formServicio, duracion_min: Number(formServicio.duracion_min), precio: Number(formServicio.precio) }) });
      const data = await res.json();
      if (res.ok) {
        mostrarAlerta(data.mensaje, 'success');
        cerrarFormServicio();
        cargarServicios();
      } else {
        mostrarAlerta(data.error || 'Error al guardar', 'error');
      }
    } catch (err) { mostrarAlerta('Error: ' + err.message, 'error'); }
    finally { setGuardandoServicio(false); }
  };

  const desactivarServicio = async (id) => {
    if (!window.confirm('¿Desactivar este servicio? No se podrá reservar hasta que lo reactives.')) return;
    try {
      const res = await fetch(`${API_BASE}/servicios/${id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) { mostrarAlerta(data.mensaje, 'success'); cargarServicios(); }
      else mostrarAlerta(data.error, 'error');
    } catch (err) { mostrarAlerta('Error: ' + err.message, 'error'); }
  };

  const reactivarServicio = async (s) => {
    try {
      const res = await fetch(`${API_BASE}/servicios/${s.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ...s, activo: true }) });
      const data = await res.json();
      if (res.ok) { mostrarAlerta('Servicio reactivado ✓', 'success'); cargarServicios(); }
      else mostrarAlerta(data.error, 'error');
    } catch (err) { mostrarAlerta('Error: ' + err.message, 'error'); }
  };

  // ── CRUD Manicuristas ──
  const abrirFormManicurista = (m = null) => {
    if (m) {
      setFormManicurista({ nombre: m.nombre, especialidad: m.especialidad || '', foto_url: m.foto_url || '' });
      setModalManicurista(m);
    } else {
      setFormManicurista({ nombre: '', especialidad: '', foto_url: '' });
      setModalManicurista('nuevo');
    }
  };
  const cerrarFormManicurista = () => setModalManicurista(null);

  const guardarManicurista = async (e) => {
    e.preventDefault();
    if (!formManicurista.nombre.trim()) return mostrarAlerta('El nombre es obligatorio', 'error');
    setGuardandoManicurista(true);
    try {
      const esEdicion = modalManicurista && modalManicurista !== 'nuevo';
      const url = esEdicion ? `${API_BASE}/manicuristas/${modalManicurista.id}` : `${API_BASE}/manicuristas`;
      const method = esEdicion ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(formManicurista) });
      const data = await res.json();
      if (res.ok) { mostrarAlerta(data.mensaje, 'success'); cerrarFormManicurista(); cargarManicuristas(); }
      else mostrarAlerta(data.error || 'Error al guardar', 'error');
    } catch (err) { mostrarAlerta('Error: ' + err.message, 'error'); }
    finally { setGuardandoManicurista(false); }
  };

  const desactivarManicurista = async (id) => {
    if (!window.confirm('¿Desactivar esta manicurista?')) return;
    try {
      const res = await fetch(`${API_BASE}/manicuristas/${id}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) { mostrarAlerta(data.mensaje, 'success'); cargarManicuristas(); }
      else mostrarAlerta(data.error, 'error');
    } catch (err) { mostrarAlerta('Error: ' + err.message, 'error'); }
  };

  const asignarManicuristaCita = async (citaId, manicuristaId) => {
    try {
      const res = await fetch(`${API_BASE}/citas/${citaId}/estado`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ manicurista_id: manicuristaId || null })
      });
      const data = await res.json();
      if (res.ok) {
        mostrarAlerta('Manicurista asignada a la cita ✓', 'success');
        cargarCitasAdmin();
        cargarDashStats();
      } else {
        mostrarAlerta(data.error || 'Error al asignar manicurista', 'error');
      }
    } catch (err) {
      mostrarAlerta('Error: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    cargarServicios();
    cargarManicuristasPublicas();
  }, [esAdmin]);

  useEffect(() => {
    if (usuario && token) {
      if (usuario.rol === 'Administradora' || usuario.rol_id === 2) {
        cargarCitasAdmin();
        cargarDashStats();
        cargarManicuristas();
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
    if (e && e.preventDefault) e.preventDefault();

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
          manicurista_id: formReserva.manicurista_id ? Number(formReserva.manicurista_id) : null,
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
    <div className={`app-shell ${temaOscuro ? 'tema-negro' : 'tema-blanco'}`}>
      {alerta && (
        <div className={`toast-notification toast-${alerta.tipo}`}>
          <span>{alerta.tipo === 'success' ? '✓' : alerta.tipo === 'warning' ? '⚠️' : '✕'}</span>
          <p>{alerta.texto}</p>
        </div>
      )}

      {/* Si es admin y está en el panel, la sidebar del dashboard toma el control (evita doble sidebar) */}
      {(!esAdmin || pagina !== 'admin') && (
        <>
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
              <button
                type="button"
                className="btn-theme-switch"
                onClick={toggleTema}
                title={temaOscuro ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              >
                <span className="theme-switch-icon">{temaOscuro ? '☀️' : '🌙'}</span>
                <span>{temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>
              {usuario ? (
                <>
                  <p className="sidebar-user">
                    {usuario.nombre_completo || usuario.nombre}
                    {esAdmin && <span className="badge-admin">Admin</span>}
                  </p>
                  {esAdmin && (
                    <button type="button" className="btn-volver-panel-side" onClick={() => irA('admin')}>
                      ☰ Ir al Panel Admin
                    </button>
                  )}
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
        </>
      )}

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
                { id: 'manicuristas', label: 'Manicuristas', icon: '💅' },
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

              <button
                type="button"
                className="dash-nav-item btn-ver-sitio"
                onClick={() => irA('inicio')}
                title="Ver vista pública del salón"
              >
                <span className="dash-nav-icon">🌐</span>
                <span>Ver Sitio Web</span>
              </button>
            </nav>

            <div className="dash-sidebar-foot">
              <button
                type="button"
                className="btn-theme-switch"
                onClick={toggleTema}
                style={{ width: '100%', marginBottom: '0.65rem' }}
                title={temaOscuro ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
              >
                <span className="theme-switch-icon">{temaOscuro ? '☀️' : '🌙'}</span>
                <span>{temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>
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
                            <small className="timeline-manicurista">💅 {c.manicurista_nombre || 'Sin manicurista'}</small>
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
                    <p className="dash-subtitle">Agenda en tiempo real con Google Calendar y vista tabular</p>
                  </div>
                  <div className="dash-topbar-actions">
                    <div className="dash-view-selector-tabs">
                      <button
                        type="button"
                        className={`dash-tab-btn ${vistaCitasAdmin === 'calendario' ? 'active' : ''}`}
                        onClick={() => {
                          setVistaCitasAdmin('calendario');
                          cargarCitasGcalAdmin(fechaAdminGcal);
                        }}
                      >
                        📆 Google Calendar (Día)
                      </button>
                      <button
                        type="button"
                        className={`dash-tab-btn ${vistaCitasAdmin === 'tabla' ? 'active' : ''}`}
                        onClick={() => setVistaCitasAdmin('tabla')}
                      >
                        📋 Tabla de Citas
                      </button>
                    </div>

                    {vistaCitasAdmin === 'tabla' && (
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
                    )}
                    <button onClick={() => { cargarCitasAdmin(); cargarCitasGcalAdmin(fechaAdminGcal); }} className="dash-refresh-btn">🔄 Refrescar</button>
                  </div>
                </div>

                {/* Modal de Detalle de Cita desde Google Calendar */}
                {citaDetalleModal && (
                  <div className="dash-modal-overlay" onClick={() => setCitaDetalleModal(null)}>
                    <div className="dash-modal" onClick={e => e.stopPropagation()}>
                      <div className="dash-modal-header">
                        <h3>📅 Detalle de Cita #{citaDetalleModal.id}</h3>
                        <button className="dash-modal-close" onClick={() => setCitaDetalleModal(null)}>✕</button>
                      </div>
                      <div className="dash-modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#935073', fontWeight: 600 }}>Clienta</label>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>👤 {citaDetalleModal.cliente_nombre || 'Clienta'}</p>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#935073', fontWeight: 600 }}>Servicio(s) a Realizar</label>
                          <p style={{ margin: 0, fontWeight: 700, color: '#9303C5' }}>💅 {citaDetalleModal.servicio_nombre}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#935073', fontWeight: 600 }}>Fecha y Horario</label>
                            <p style={{ margin: 0, fontWeight: 600 }}>
                              📅 {citaDetalleModal.fecha || fechaAdminGcal}<br />
                              🕒 {formatearHora12(citaDetalleModal.hora_inicio)} – {formatearHora12(citaDetalleModal.hora_fin)}
                            </p>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#935073', fontWeight: 600 }}>Inversión / Precio</label>
                            <p style={{ margin: 0, fontWeight: 700, color: '#10B981', fontSize: '1.1rem' }}>
                              ${Number(citaDetalleModal.precio || 0).toLocaleString()} COP
                            </p>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: '#935073', fontWeight: 600 }}>Manicurista Asignada</label>
                          <p style={{ margin: 0, fontWeight: 600 }}>💅 {citaDetalleModal.manicurista_nombre || 'Sin asignar'}</p>
                        </div>
                        {citaDetalleModal.observacion && (
                          <div>
                            <label style={{ fontSize: '0.8rem', color: '#935073', fontWeight: 600 }}>Notas de la Reserva</label>
                            <p style={{ margin: 0, background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                              {citaDetalleModal.observacion}
                            </p>
                          </div>
                        )}
                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="dash-act-btn confirm"
                            style={{ padding: '0.6rem 1rem', width: 'auto', height: 'auto', borderRadius: '8px' }}
                            onClick={() => {
                              actualizarEstadoCita(citaDetalleModal.id, 2);
                              setCitaDetalleModal(null);
                              cargarCitasGcalAdmin(fechaAdminGcal);
                            }}
                          >
                            ✓ Confirmar Cita
                          </button>
                          <button
                            type="button"
                            className="dash-act-btn attend"
                            style={{ padding: '0.6rem 1rem', width: 'auto', height: 'auto', borderRadius: '8px' }}
                            onClick={() => {
                              actualizarEstadoCita(citaDetalleModal.id, 4);
                              setCitaDetalleModal(null);
                              cargarCitasGcalAdmin(fechaAdminGcal);
                            }}
                          >
                            🌟 Marcar Atendida
                          </button>
                          <button
                            type="button"
                            className="dash-act-btn cancel"
                            style={{ padding: '0.6rem 1rem', width: 'auto', height: 'auto', borderRadius: '8px' }}
                            onClick={() => {
                              actualizarEstadoCita(citaDetalleModal.id, 3);
                              setCitaDetalleModal(null);
                              cargarCitasGcalAdmin(fechaAdminGcal);
                            }}
                          >
                            ✕ Cancelar Cita
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {vistaCitasAdmin === 'calendario' ? (
                  <div className="dash-gcal-wrapper">
                    {renderGoogleCalendar({
                      fecha: fechaAdminGcal,
                      citas: citasGcalAdmin,
                      esAdminMode: true,
                      onCambiarFecha: (nuevaF) => {
                        setFechaAdminGcal(nuevaF);
                        cargarCitasGcalAdmin(nuevaF);
                      }
                    })}
                  </div>
                ) : cargandoCitas ? (
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
                          <th>Manicurista</th>
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
                              <select
                                value={c.manicurista_id || ''}
                                className="dash-select-pago"
                                onChange={(e) => asignarManicuristaCita(c.id, e.target.value)}
                                title="Asignar o reasignar manicurista"
                              >
                                <option value="">(Sin asignar)</option>
                                {manicuristas.filter(m => m.activo).map(m => (
                                  <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                              </select>
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
                    <p className="dash-subtitle">Gestiona los servicios del salón — agrega, edita o desactiva</p>
                  </div>
                  <button className="dash-add-btn" onClick={() => abrirFormServicio()}>
                    + Nuevo Servicio
                  </button>
                </div>

                {/* Modal crear/editar servicio */}
                {modalServicio && (
                  <div className="dash-modal-overlay" onClick={cerrarFormServicio}>
                    <div className="dash-modal" onClick={e => e.stopPropagation()}>
                      <div className="dash-modal-header">
                        <h3>{modalServicio === 'nuevo' ? '✦ Nuevo Servicio' : '✎ Editar Servicio'}</h3>
                        <button className="dash-modal-close" onClick={cerrarFormServicio}>✕</button>
                      </div>
                      <form className="dash-modal-form" onSubmit={guardarServicio}>
                        <div className="dash-form-row">
                          <div className="dash-form-group">
                            <label>Nombre del servicio *</label>
                            <input type="text" value={formServicio.nombre} onChange={e => setFormServicio({...formServicio, nombre: e.target.value})} placeholder="Ej: Manicure en gel" required />
                          </div>
                          <div className="dash-form-group">
                            <label>Categoría</label>
                            <select value={formServicio.categoria} onChange={e => setFormServicio({...formServicio, categoria: e.target.value})}>
                              <option value="">Sin categoría</option>
                              {CATEGORIAS_SERVICIO.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="dash-form-row">
                          <div className="dash-form-group">
                            <label>Duración (minutos) *</label>
                            <input type="number" min="5" max="480" value={formServicio.duracion_min} onChange={e => setFormServicio({...formServicio, duracion_min: e.target.value})} required />
                          </div>
                          <div className="dash-form-group">
                            <label>Precio (COP) *</label>
                            <input type="number" min="1000" value={formServicio.precio} onChange={e => setFormServicio({...formServicio, precio: e.target.value})} placeholder="Ej: 35000" required />
                          </div>
                        </div>
                        <div className="dash-form-group">
                          <label>Descripción</label>
                          <textarea rows="2" value={formServicio.descripcion} onChange={e => setFormServicio({...formServicio, descripcion: e.target.value})} placeholder="Breve descripción del servicio..." />
                        </div>
                        <div className="dash-form-group">
                          <label>URL de imagen (opcional)</label>
                          <input type="text" value={formServicio.imagen_url} onChange={e => setFormServicio({...formServicio, imagen_url: e.target.value})} placeholder="https://... o /mi-imagen.jpg" />
                        </div>
                        <div className="dash-modal-actions">
                          <button type="button" className="dash-btn-cancel" onClick={cerrarFormServicio}>Cancelar</button>
                          <button type="submit" className="dash-btn-save" disabled={guardandoServicio}>
                            {guardandoServicio ? 'Guardando...' : (modalServicio === 'nuevo' ? '+ Crear Servicio' : '✓ Guardar Cambios')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Tabla de servicios */}
                {cargandoServicios ? (
                  <p className="loading">Cargando servicios...</p>
                ) : (
                  <div className="dash-table-wrap">
                    <table className="dash-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Servicio</th>
                          <th>Categoría</th>
                          <th>Duración</th>
                          <th>Precio</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicios.map(s => (
                          <tr key={s.id} className={!s.activo ? 'row-inactivo' : ''}>
                            <td><strong>#{s.id}</strong></td>
                            <td>
                              <strong>{s.nombre}</strong>
                              {s.descripcion && <><br /><small>{s.descripcion.substring(0, 60)}{s.descripcion.length > 60 ? '…' : ''}</small></>}
                            </td>
                            <td><span className="dash-cat-chip">{s.categoria || '—'}</span></td>
                            <td>⏱ {s.duracion_min} min</td>
                            <td><strong>${Number(s.precio).toLocaleString()}</strong></td>
                            <td>
                              {s.activo !== false && s.activo !== 0
                                ? <span className="dash-badge-estado estado-2">Activo</span>
                                : <span className="dash-badge-estado estado-3">Inactivo</span>
                              }
                            </td>
                            <td>
                              <div className="dash-action-btns">
                                <button className="dash-act-btn confirm" title="Editar" onClick={() => abrirFormServicio(s)}>✎</button>
                                {(s.activo !== false && s.activo !== 0)
                                  ? <button className="dash-act-btn cancel" title="Desactivar" onClick={() => desactivarServicio(s.id)}>✕</button>
                                  : <button className="dash-act-btn attend" title="Reactivar" onClick={() => reactivarServicio(s)}>↺</button>
                                }
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

            {/* ── SECCIÓN MANICURISTAS ── */}
            {dashSeccion === 'manicuristas' && (
              <div className="dash-content">
                <div className="dash-topbar">
                  <div>
                    <h2 className="dash-title">Manicuristas</h2>
                    <p className="dash-subtitle">Gestiona el equipo del salón</p>
                  </div>
                  <button className="dash-add-btn" onClick={() => { abrirFormManicurista(); cargarManicuristas(); }}>
                    + Nueva Manicurista
                  </button>
                </div>

                {/* Modal crear/editar manicurista */}
                {modalManicurista && (
                  <div className="dash-modal-overlay" onClick={cerrarFormManicurista}>
                    <div className="dash-modal" onClick={e => e.stopPropagation()}>
                      <div className="dash-modal-header">
                        <h3>{modalManicurista === 'nuevo' ? '✦ Nueva Manicurista' : '✎ Editar Manicurista'}</h3>
                        <button className="dash-modal-close" onClick={cerrarFormManicurista}>✕</button>
                      </div>
                      <form className="dash-modal-form" onSubmit={guardarManicurista}>
                        <div className="dash-form-group">
                          <label>Nombre completo *</label>
                          <input type="text" value={formManicurista.nombre} onChange={e => setFormManicurista({...formManicurista, nombre: e.target.value})} placeholder="Ej: María González" required />
                        </div>
                        <div className="dash-form-group">
                          <label>Especialidad</label>
                          <input type="text" value={formManicurista.especialidad} onChange={e => setFormManicurista({...formManicurista, especialidad: e.target.value})} placeholder="Ej: Uñas acrílicas, Gel, Nail Art" />
                        </div>
                        <div className="dash-form-group">
                          <label>Foto (URL — opcional)</label>
                          <input type="text" value={formManicurista.foto_url} onChange={e => setFormManicurista({...formManicurista, foto_url: e.target.value})} placeholder="https://..." />
                        </div>
                        <div className="dash-modal-actions">
                          <button type="button" className="dash-btn-cancel" onClick={cerrarFormManicurista}>Cancelar</button>
                          <button type="submit" className="dash-btn-save" disabled={guardandoManicurista}>
                            {guardandoManicurista ? 'Guardando...' : (modalManicurista === 'nuevo' ? '+ Agregar' : '✓ Guardar')}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Grid de manicuristas */}
                {cargandoManicuristas ? (
                  <p className="loading">Cargando equipo...</p>
                ) : manicuristas.length === 0 ? (
                  <div className="dash-empty-box">Aún no hay manicuristas registradas. ¡Agrega la primera!</div>
                ) : (
                  <div className="manicuristas-grid">
                    {manicuristas.map(m => (
                      <div key={m.id} className={`manicurista-card ${!m.activo ? 'inactiva' : ''}`}>
                        <div className="manicurista-avatar">
                          {m.foto_url
                            ? <img src={m.foto_url} alt={m.nombre} />
                            : <span>{m.nombre.charAt(0).toUpperCase()}</span>
                          }
                        </div>
                        <div className="manicurista-info">
                          <p className="manicurista-nombre">{m.nombre}</p>
                          <p className="manicurista-esp">{m.especialidad || 'Sin especialidad registrada'}</p>
                          <span className={`dash-badge-estado ${m.activo ? 'estado-2' : 'estado-3'}`}>
                            {m.activo ? 'Activa' : 'Inactiva'}
                          </span>
                        </div>
                        <div className="manicurista-actions">
                          <button className="dash-act-btn confirm" title="Editar" onClick={() => abrirFormManicurista(m)}>✎</button>
                          {m.activo
                            ? <button className="dash-act-btn cancel" title="Desactivar" onClick={() => desactivarManicurista(m.id)}>✕</button>
                            : <button className="dash-act-btn attend" title="Reactivar" onClick={async () => {
                                const res = await fetch(`${API_BASE}/manicuristas/${m.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({...m, activo: true}) });
                                const d = await res.json();
                                if (res.ok) { mostrarAlerta('Reactivada ✓', 'success'); cargarManicuristas(); }
                                else mostrarAlerta(d.error, 'error');
                              }}>↺</button>
                          }
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
          {esAdmin && (
            <div className="admin-banner-bar">
              <div className="admin-banner-text">
                <span className="admin-banner-crown">👑</span>
                <span><strong>Modo Administradora activo</strong> — Vista pública del salón</span>
              </div>
              <button type="button" className="btn-volver-dash" onClick={() => irA('admin')}>
                ⬅ Volver al Panel de Control
              </button>
            </div>
          )}
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
              {!esAdmin && <p>Puedes elegir hasta un <strong>máximo de 2 servicios</strong> para tu cita (ej. Manicure + Pedicure)</p>}
              {esAdmin && <p>Vista de catálogo — Para gestionar servicios ve al <button className="link-btn" onClick={() => irA('admin')}>Panel Admin → Servicios</button></p>}
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
                          const sel = !esAdmin && serviciosSeleccionados.some(item => item.id === s.id);
                          return (
                            <div
                              key={s.id}
                              className={`service-card-mini ${sel ? 'selected' : ''} ${esAdmin ? 'admin-readonly' : ''}`}
                              onClick={() => !esAdmin && toggleServicio(s)}
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
                                {!esAdmin && (
                                  <button className={`mini-select-btn ${sel ? 'selected' : ''}`}>
                                    {sel ? '✓ En tu paquete' : '+ Agregar'}
                                  </button>
                                )}
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
          <section id="reservar" className="section reservar-section">
            <div className="reservar-layout">

              {/* Panel izquierdo — Paso a paso intuitivo de reserva */}
              <div className="reservar-panel-left">
                <div className="reserva-header-badge">
                  <h2>Agenda Tu Cita</h2>
                  <p className="reserva-subtitle">Sigue estos sencillos pasos para asegurar tu espacio</p>
                </div>

                {/* PASO 1: Servicio(s) */}
                <div className="reserva-step-card">
                  <div className="reserva-step-header">
                    <span className="reserva-step-num">1</span>
                    <div>
                      <h4 className="reserva-step-title">Elige tu tratamiento</h4>
                      <p className="reserva-step-hint">Servicio principal o combo de hasta 2 servicios</p>
                    </div>
                  </div>

                  <div className="reserva-combo-row">
                    <select
                      className="reserva-dropdown"
                      value={serviciosSeleccionados[0]?.id || ''}
                      onChange={(e) => {
                        const idSel = Number(e.target.value);
                        const svc = servicios.find(s => s.id === idSel);
                        if (svc) {
                          const segundo = serviciosSeleccionados[1];
                          setServiciosSeleccionados(segundo && segundo.id !== svc.id ? [svc, segundo] : [svc]);
                        }
                      }}
                    >
                      {servicios.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre} · ⏱ {s.duracion_min}m · ${Number(s.precio).toLocaleString()} COP
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Servicio 2 (Opcional - Combo) */}
                  <div className="reserva-combo-row" style={{ marginTop: '0.45rem' }}>
                    <select
                      className="reserva-dropdown"
                      value={serviciosSeleccionados[1]?.id || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setServiciosSeleccionados([serviciosSeleccionados[0] || servicios[0]]);
                        } else {
                          const idSel = Number(val);
                          const svc = servicios.find(s => s.id === idSel);
                          if (svc) {
                            setServiciosSeleccionados([serviciosSeleccionados[0] || servicios[0], svc]);
                          }
                        }
                      }}
                    >
                      <option value="">+ Añadir segundo servicio (Combo opcional)...</option>
                      {servicios
                        .filter(s => s.id !== serviciosSeleccionados[0]?.id)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.nombre} · ⏱ {s.duracion_min}m · ${Number(s.precio).toLocaleString()} COP
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Chips de duración e inversión */}
                  <div className="reserva-mini-totals">
                    <span className="reserva-total-chip">⏱ Duración: <strong>{duracionTotal} min</strong></span>
                    <span className="reserva-total-chip price">💵 Inversión: <strong>${precioTotal.toLocaleString()} COP</strong></span>
                  </div>
                </div>

                {/* PASO 2: Manicurista */}
                <div className="reserva-step-card">
                  <div className="reserva-step-header">
                    <span className="reserva-step-num">2</span>
                    <div>
                      <h4 className="reserva-step-title">Manicurista</h4>
                      <p className="reserva-step-hint">¿Quién deseas que te atienda?</p>
                    </div>
                  </div>
                  <select
                    className="reserva-dropdown"
                    value={formReserva.manicurista_id}
                    onChange={(e) => setFormReserva({ ...formReserva, manicurista_id: e.target.value })}
                  >
                    <option value="">✨ Cualquiera disponible (Recomendado)</option>
                    {manicuristas.filter(m => m.activo).map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nombre} {m.especialidad ? `— ${m.especialidad}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* PASO 3: Resumen de Fecha y Hora del Calendario */}
                <div className="reserva-step-card">
                  <div className="reserva-step-header">
                    <span className="reserva-step-num">3</span>
                    <div>
                      <h4 className="reserva-step-title">Fecha y Horario Elegido</h4>
                      <p className="reserva-step-hint">Seleccionado directamente en el calendario 👉</p>
                    </div>
                  </div>

                  {formReserva.fecha && formReserva.hora_inicio ? (
                    <div className="reserva-ticket-box">
                      <div className="ticket-row">
                        <span className="ticket-label">📅 Fecha:</span>
                        <span className="ticket-val">
                          {new Date(formReserva.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}
                        </span>
                      </div>
                      <div className="ticket-row">
                        <span className="ticket-label">🕒 Horario:</span>
                        <span className="ticket-val highlight">
                          {formatearHora12(formReserva.hora_inicio)} → {formatearHora12(calcularHoraFin(formReserva.hora_inicio, duracionTotal))}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="reserva-ticket-empty">
                      👈 Toca una franja horaria en el calendario para seleccionar tu hora
                    </div>
                  )}
                </div>

                {/* PASO 4: Notas y Confirmación */}
                <div className="reserva-step-card">
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem', color: '#c084fc', fontWeight: 600 }}>Notas o referencias de diseño (Opcional)</label>
                    <textarea
                      rows="2"
                      placeholder="Colores, técnicas o referencias que tengas en mente..."
                      value={formReserva.observacion}
                      onChange={(e) => setFormReserva({ ...formReserva, observacion: e.target.value })}
                    />
                  </div>

                  {!usuario && (
                    <p className="login-tip" style={{ marginBottom: '0.75rem' }}>
                      ✦ Inicia sesión o regístrate en 1 clic para confirmar tu cita.
                    </p>
                  )}

                  <button
                    type="button"
                    className="submit-btn"
                    disabled={reservaCargando || !formReserva.fecha || !formReserva.hora_inicio}
                    onClick={handleReservar}
                  >
                    {reservaCargando ? 'Procesando...' : !formReserva.fecha ? 'Selecciona una fecha →' : !formReserva.hora_inicio ? 'Selecciona una hora en el calendario →' : usuario ? `Confirmar Cita ($${precioTotal.toLocaleString()} COP) ✦` : 'Iniciar Sesión y Reservar ✦'}
                  </button>
                </div>
              </div>

              {/* Panel derecho — CALENDARIO interactivo tipo Google */}
              <div className="reservar-panel-right">
                <div className="cal-view-toggle-bar">
                  <button
                    type="button"
                    className={`cal-toggle-pill ${vistaCalendario === 'dia' ? 'active' : ''}`}
                    onClick={() => setVistaCalendario('dia')}
                  >
                    📆 Google Calendar (Vista Día)
                  </button>
                  <button
                    type="button"
                    className={`cal-toggle-pill ${vistaCalendario === 'mes' ? 'active' : ''}`}
                    onClick={() => setVistaCalendario('mes')}
                  >
                    🗓 Vista Calendario Mes
                  </button>
                </div>

                {vistaCalendario === 'dia' ? (
                  <>
                    {renderGoogleCalendar({
                      fecha: formReserva.fecha,
                      citas: horasOcupadas,
                      esAdminMode: false,
                      onCambiarFecha: (nuevaF) => setFormReserva({ ...formReserva, fecha: nuevaF }),
                      onSeleccionarHora: (nuevaH) => setFormReserva({ ...formReserva, hora_inicio: nuevaH }),
                      horaSeleccionada: formReserva.hora_inicio,
                      duracion: duracionTotal
                    })}

                    {/* Horarios rápidos sugeridos */}
                    <div className="cal-slots-quick-select">
                      <span className="cal-quick-title">⚡ O selecciona un horario frecuente:</span>
                      <div className="cal-slots-grid">
                        {HORARIOS_DISPONIBLES.map(h => {
                          const [hH, hM] = h.valor.split(':').map(Number);
                          const minIni = hH * 60 + hM;
                          const minFin = minIni + duracionTotal;
                          const estaOcupada = horasOcupadas.some(ocupada => {
                            const [oH1, oM1] = ocupada.hora_inicio.split(':').map(Number);
                            const [oH2, oM2] = ocupada.hora_fin.split(':').map(Number);
                            return minIni < (oH2 * 60 + oM2) && minFin > (oH1 * 60 + oM1);
                          });
                          const seleccionado = formReserva.hora_inicio === h.valor;

                          return (
                            <button
                              key={h.valor}
                              type="button"
                              disabled={estaOcupada}
                              className={`cal-slot-btn${estaOcupada ? ' ocupado' : ''}${seleccionado ? ' seleccionado' : ''}`}
                              onClick={() => !estaOcupada && setFormReserva({ ...formReserva, hora_inicio: h.valor })}
                            >
                              {h.etiqueta}
                              {estaOcupada && <span className="slot-ocupado-label">Ocupado</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Cabecera del mes */}
                    <div className="cal-header">
                      <button
                        className="cal-nav-btn"
                        disabled={calAnio < hoy.getFullYear() || (calAnio === hoy.getFullYear() && calMes <= hoy.getMonth())}
                        onClick={() => {
                          if (calAnio < hoy.getFullYear() || (calAnio === hoy.getFullYear() && calMes <= hoy.getMonth())) return;
                          if (calMes === 0) { setCalMes(11); setCalAnio(calAnio - 1); }
                          else setCalMes(calMes - 1);
                          setCalDiaSeleccionado(null);
                          setFormReserva({ ...formReserva, fecha: '', hora_inicio: '10:00:00' });
                        }}
                        title={calAnio < hoy.getFullYear() || (calAnio === hoy.getFullYear() && calMes <= hoy.getMonth()) ? "No puedes ver meses pasados" : "Mes anterior"}
                      >‹</button>
                      <h3 className="cal-mes-label">
                        {new Date(calAnio, calMes).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button className="cal-nav-btn" onClick={() => {
                        if (calMes === 11) { setCalMes(0); setCalAnio(calAnio + 1); }
                        else setCalMes(calMes + 1);
                        setCalDiaSeleccionado(null);
                        setFormReserva({ ...formReserva, fecha: '', hora_inicio: '10:00:00' });
                      }}>›</button>
                    </div>

                    {/* Días de la semana */}
                    <div className="cal-weekdays">
                      {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
                        <div key={d} className="cal-weekday">{d}</div>
                      ))}
                    </div>

                    {/* Grid de días */}
                    <div className="cal-grid">
                      {(() => {
                        const primerDia = new Date(calAnio, calMes, 1).getDay();
                        const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();
                        const hoyStr = new Date().toISOString().split('T')[0];
                        const celdas = [];

                        for (let i = 0; i < primerDia; i++) {
                          celdas.push(<div key={`vacio-${i}`} className="cal-day vacio" />);
                        }

                        for (let d = 1; d <= diasEnMes; d++) {
                          const fechaStr = `${calAnio}-${String(calMes + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                          const esPasado = fechaStr < hoyStr;
                          const esHoy = fechaStr === hoyStr;
                          const esSeleccionado = fechaStr === formReserva.fecha;
                          const esDomingo = new Date(calAnio, calMes, d).getDay() === 0;

                          celdas.push(
                            <button
                              key={d}
                              type="button"
                              disabled={esPasado || esDomingo}
                              className={`cal-day${esPasado || esDomingo ? ' bloqueado' : ''}${esHoy ? ' hoy' : ''}${esSeleccionado ? ' seleccionado' : ''}`}
                              onClick={() => {
                                if (esPasado || esDomingo) return;
                                setCalDiaSeleccionado(fechaStr);
                                setFormReserva({ ...formReserva, fecha: fechaStr, hora_inicio: '10:00:00' });
                              }}
                            >
                              {d}
                              {esHoy && <span className="cal-hoy-dot" />}
                            </button>
                          );
                        }
                        return celdas;
                      })()}
                    </div>

                    {calDiaSeleccionado && (
                      <div className="cal-slots">
                        <p className="cal-slots-title">⏰ Elige tu horario para el {new Date(calDiaSeleccionado + 'T12:00:00').toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' })}:</p>
                        <div className="cal-slots-grid">
                          {HORARIOS_DISPONIBLES.map(h => {
                            const [hH, hM] = h.valor.split(':').map(Number);
                            const minIni = hH * 60 + hM;
                            const minFin = minIni + duracionTotal;
                            const estaOcupada = horasOcupadas.some(ocupada => {
                              const [oH1, oM1] = ocupada.hora_inicio.split(':').map(Number);
                              const [oH2, oM2] = ocupada.hora_fin.split(':').map(Number);
                              return minIni < (oH2 * 60 + oM2) && minFin > (oH1 * 60 + oM1);
                            });
                            const seleccionado = formReserva.hora_inicio === h.valor;

                            return (
                              <button
                                key={h.valor}
                                type="button"
                                disabled={estaOcupada}
                                className={`cal-slot-btn${estaOcupada ? ' ocupado' : ''}${seleccionado ? ' seleccionado' : ''}`}
                                onClick={() => !estaOcupada && setFormReserva({ ...formReserva, hora_inicio: h.valor })}
                              >
                                {h.etiqueta}
                                {estaOcupada && <span className="slot-ocupado-label">Ocupado</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

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
                          type={verPassword ? 'text' : 'password'}
                          required
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                        <button
                          type="button"
                          className="eye-toggle-btn"
                          onClick={() => setVerPassword(!verPassword)}
                          title={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {verPassword ? '👁️' : '🔒'}
                        </button>
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
                          type={verPassword ? 'text' : 'password'}
                          required
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                        <button
                          type="button"
                          className="eye-toggle-btn"
                          onClick={() => setVerPassword(!verPassword)}
                          title={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {verPassword ? '👁️' : '🔒'}
                        </button>
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
                          type={verPassword ? 'text' : 'password'}
                          required
                          placeholder="Mínimo 6 caracteres"
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                        />
                        <button
                          type="button"
                          className="eye-toggle-btn"
                          onClick={() => setVerPassword(!verPassword)}
                          title={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {verPassword ? '👁️' : '🔒'}
                        </button>
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
