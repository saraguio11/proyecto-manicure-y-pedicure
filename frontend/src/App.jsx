import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:4000/api';

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
  const mostrarAlerta = (texto, tipo = 'success') => {
    setAlerta({ texto, tipo });
    setTimeout(() => setAlerta(null), 4500);
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

  useEffect(() => {
    cargarServicios();
  }, []);

  useEffect(() => {
    if (usuario && token) {
      if (usuario.rol === 'Administradora' || usuario.rol_id === 2) {
        cargarCitasAdmin();
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
        setTimeout(() => {
          document.getElementById('mis-citas')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
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

  return (
    <div className="app-container">
      {alerta && (
        <div className={`toast-notification toast-${alerta.tipo}`}>
          <span>{alerta.tipo === 'success' ? '✓' : alerta.tipo === 'warning' ? '⚠️' : '✕'}</span>
          <p>{alerta.texto}</p>
        </div>
      )}

      {/* NAVBAR */}
      <header className="navbar">
        <div className="logo">
          ✦ <span>Glam Nails</span> Studio & Spa
        </div>

        <nav className="nav-links">
          {!esAdmin && (
            <>
              <a href="#servicios">Tratamientos</a>
              <a href="#reservar">Reservar Cita</a>
              {usuario && <a href="#mis-citas">Mis Citas</a>}
            </>
          )}
        </nav>

        <div className="nav-actions">
          {usuario ? (
            <div className="user-logged-info">
              <span className="user-greeting">
                Hola, <strong>{usuario.nombre_completo || usuario.nombre}</strong>
                {esAdmin && <span className="badge-admin">Admin</span>}
              </span>
              <button className="btn-logout" onClick={cerrarSesion}>Cerrar Sesión</button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button className="btn-cliente-login" onClick={() => { setAuthError(''); setTipoModal('login_cliente'); }}>
                ✦ Soy Clienta
              </button>
              <button className="btn-admin-access" onClick={() => { setAuthError(''); setTipoModal('login_admin'); }}>
                🔒 Administradora
              </button>
            </div>
          )}
        </div>
      </header>

      {/* PANEL ADMIN EXCLUSIVO */}
      {esAdmin ? (
        <main className="section admin-panel">
          <div className="admin-header">
            <div>
              <span className="badge">Zona de Gestión Segura</span>
              <h2>Panel de Control - Administradora</h2>
              <p>Revisa y gestiona las citas de todas las clientas, estados y pagos.</p>
            </div>
            <div className="filter-box">
              <label>Estado:</label>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todas</option>
                <option value="1">Pendientes</option>
                <option value="2">Confirmadas</option>
                <option value="4">Atendidas</option>
                <option value="3">Canceladas</option>
              </select>
              <button onClick={cargarCitasAdmin} className="refresh-btn">🔄 Refrescar</button>
            </div>
          </div>

          {cargandoCitas ? (
            <p className="loading">Cargando citas...</p>
          ) : citasAdmin.length === 0 ? (
            <div className="empty-box">No hay citas registradas con este filtro.</div>
          ) : (
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th># ID</th>
                    <th>Clienta</th>
                    <th>Servicio(s)</th>
                    <th>Fecha & Horario</th>
                    <th>Total</th>
                    <th>Estado Cita</th>
                    <th>Estado Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {citasAdmin.map((c) => (
                    <tr key={c.id}>
                      <td><strong>#{c.id}</strong></td>
                      <td>
                        <strong>{c.cliente_nombre}</strong>
                        <br />
                        <small>📞 {c.cliente_telefono}</small>
                      </td>
                      <td>
                        <strong>{c.servicio_nombre}</strong>
                        <br />
                        <small className="text-muted">⏱ {c.duracion_min} min en total</small>
                      </td>
                      <td>
                        📅 {c.fecha?.substring(0, 10)}
                        <br />
                        🕒 {c.hora_inicio?.substring(0, 5)} - {c.hora_fin?.substring(0, 5)}
                      </td>
                      <td><strong>${Number(c.precio).toLocaleString()} COP</strong></td>
                      <td>
                        <span className={`badge-state state-${c.estado_id}`}>{c.estado_nombre}</span>
                      </td>
                      <td>
                        <select 
                          value={c.estado_pago}
                          className="select-pago"
                          onChange={(e) => actualizarPago(c.id, e.target.value)}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="parcial">Parcial</option>
                          <option value="pagado">Pagado</option>
                        </select>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {c.estado_id !== 2 && (
                            <button className="btn-act btn-confirm" onClick={() => actualizarEstadoCita(c.id, 2)}>✓ Confirmar</button>
                          )}
                          {c.estado_id !== 4 && (
                            <button className="btn-act btn-attend" onClick={() => actualizarEstadoCita(c.id, 4)}>🌟 Atendida</button>
                          )}
                          {c.estado_id !== 3 && (
                            <button className="btn-act btn-cancel" onClick={() => actualizarEstadoCita(c.id, 3)}>✕ Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      ) : (
        /* VISTA CLIENTA */
        <main>
          <section className="hero">
            <span className="badge">Salón & Spa de Alta Gama</span>
            <h1>Elegancia y Perfección en Cada Detalle</h1>
            <p>Puedes elegir <strong>uno o varios tratamientos continuos</strong> para el mismo día (ej. Manicure + Pedicure).</p>
          </section>

          {/* Catálogo con Selección Múltiple */}
          <section id="servicios" className="section">
            <div className="section-header">
              <h2>Nuestros Tratamientos Exclusivos</h2>
              <p>Puedes elegir hasta un <strong>máximo de 2 servicios</strong> para tu cita (ej. Manicure + Pedicure)</p>
            </div>

            {cargandoServicios ? (
              <p className="loading">Cargando catálogo...</p>
            ) : (
              <div className="grid-cards">
                {servicios.map((s) => {
                  const img = s.imagen_url || IMAGENES_SERVICIOS[s.id] || IMAGENES_SERVICIOS[1];
                  const sel = serviciosSeleccionados.some(item => item.id === s.id);
                  return (
                    <div
                      key={s.id}
                      className={`service-card ${sel ? 'selected' : ''}`}
                      onClick={() => toggleServicio(s)}
                    >
                      <div className="image-wrapper">
                        <img src={img} alt={s.nombre} />
                        <span className="price-tag">${Number(s.precio).toLocaleString()} COP</span>
                      </div>
                      <div className="card-body">
                        <h3>{s.nombre}</h3>
                        <p className="desc">{s.descripcion}</p>
                        <div className="duration">⏱ {s.duracion_min} minutos</div>
                        <button className="select-btn">
                          {sel ? 'Añadido al Combo ✓' : '+ Agregar Servicio'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Formulario de Reserva con Resumen Dinámico de Combo */}
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

          {/* MIS CITAS */}
          {usuario && (
            <section id="mis-citas" className="section mis-citas-section">
              <div className="section-header">
                <h2>Mis Citas Reservadas</h2>
                <p>Historial y citas confirmadas para tus próximos servicios</p>
              </div>

              {cargandoCitas ? (
                <p className="loading">Cargando tus citas...</p>
              ) : misCitas.length === 0 ? (
                <div className="empty-box">Aún no tienes citas agendadas. ¡Selecciona tus servicios favoritos arriba!</div>
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
        </main>
      )}

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

      <footer className="footer">
        <p>© 2026 Glam Nails Studio & Spa — Arte y cuidado premium en tus manos</p>
      </footer>
    </div>
  );
}

export default App;
