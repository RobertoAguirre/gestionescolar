<script>
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { fetchAPI } from '../config.js';
  
  let isAuthenticated = false;
  let token = '';
  let padre = null;
  let alumno = null;
  let calificaciones = [];
  let progreso = null;
  let eventos = [];
  let citas = [];
  let pagosEstadoCuenta = [];
  let pagosResumen = null;
  let historial = [];
  let pickupEstado = null;
  let pickupQrDataUrl = '';
  let pickupNota = '';
  let pickupLoading = false;
  let activeTab = 'dashboard';
  
  let loginEmail = '';
  let loginPassword = '';
  let isLoading = false;
  
  let showCitaForm = false;
  let newCita = { motivo: '', fecha: '', tipo: 'directivo', maestroId: '' };
  let cargoPagoSeleccionado = '';
  let maestros = [];

  onMount(() => {
    // Verificar si hay token guardado
    const savedToken = localStorage.getItem('padreToken');
    if (savedToken) {
      token = savedToken;
      verificarSesion();
    }
  });

  async function verificarSesion() {
    try {
      const res = await fetchAPI('/api/padres/mi-hijo', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        alumno = data.alumno;
        isAuthenticated = true;
        await cargarDatos();
      } else {
        localStorage.removeItem('padreToken');
        token = '';
        isAuthenticated = false;
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
      localStorage.removeItem('padreToken');
      token = '';
      isAuthenticated = false;
    }
  }

  async function login() {
    if (!loginEmail || !loginPassword) {
      alert('Email y contraseña requeridos');
      return;
    }
    
    isLoading = true;
    try {
      const res = await fetchAPI('/api/padres/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      
      const data = await res.json();
      
      if (data.success) {
        token = data.token;
        padre = data.padre;
        alumno = data.alumno;
        localStorage.setItem('padreToken', token);
        isAuthenticated = true;
        await cargarDatos();
        loginEmail = '';
        loginPassword = '';
      } else {
        alert(data.error || 'Error en el login');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error en el login');
    } finally {
      isLoading = false;
    }
  }

  async function logout() {
    try {
      await fetchAPI('/api/padres/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error en logout:', error);
    }
    
    localStorage.removeItem('padreToken');
    token = '';
    isAuthenticated = false;
    padre = null;
    alumno = null;
    calificaciones = [];
    progreso = null;
    eventos = [];
    citas = [];
    historial = [];
    pickupEstado = null;
    pickupQrDataUrl = '';
    pickupNota = '';
  }

  function getAuthHeaders() {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async function cargarDatos() {
    await Promise.all([
      cargarCalificaciones(),
      cargarProgreso(),
      cargarEventos(),
      cargarCitas(),
      cargarPagosEstadoCuenta(),
      cargarHistorial(),
      cargarMaestros(),
      cargarPickupEstado()
    ]);
  }

  async function cargarPickupEstado() {
    try {
      const res = await fetchAPI('/api/padres/pickup/estado', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        pickupEstado = data?.solicitud || null;
        await actualizarQrPickup();
      }
    } catch (error) {
      console.error('Error cargando pickup seguro:', error);
    }
  }

  async function solicitarPickup() {
    pickupLoading = true;
    try {
      const res = await fetchAPI('/api/padres/pickup/solicitar', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nota: pickupNota })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error solicitando pickup');
        return;
      }
      pickupEstado = data.solicitud || null;
      await actualizarQrPickup();
      pickupNota = '';
      alert('Solicitud de pickup creada. Muestra el codigo en recepcion.');
    } catch (error) {
      alert('Error solicitando pickup');
    } finally {
      pickupLoading = false;
    }
  }

  async function actualizarQrPickup() {
    if (!pickupEstado?.pickupToken || pickupEstado.estado !== 'pendiente') {
      pickupQrDataUrl = '';
      return;
    }
    try {
      pickupQrDataUrl = await QRCode.toDataURL(
        JSON.stringify({
          type: 'pickup_qr',
          token: pickupEstado.pickupToken
        }),
        { margin: 1, width: 220 }
      );
    } catch {
      pickupQrDataUrl = '';
    }
  }

  async function cargarCalificaciones() {
    try {
      const res = await fetchAPI('/api/padres/calificaciones', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        calificaciones = data.calificaciones || [];
      }
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
    }
  }

  async function cargarProgreso() {
    try {
      const res = await fetchAPI('/api/padres/progreso', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        progreso = await res.json();
      }
    } catch (error) {
      console.error('Error cargando progreso:', error);
    }
  }

  async function cargarEventos() {
    try {
      const res = await fetchAPI('/api/padres/eventos', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        eventos = await res.json();
      }
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  async function cargarCitas() {
    try {
      const res = await fetchAPI('/api/padres/citas', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        citas = await res.json();
      }
    } catch (error) {
      console.error('Error cargando citas:', error);
    }
  }

  async function cargarHistorial() {
    try {
      const res = await fetchAPI('/api/padres/historial', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        historial = data.historial || [];
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  }

  async function cargarPagosEstadoCuenta() {
    try {
      const res = await fetchAPI('/api/padres/pagos/estado-cuenta', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        pagosResumen = data.resumen || null;
        pagosEstadoCuenta = data.cargos || [];
      }
    } catch (error) {
      console.error('Error cargando estado de cuenta:', error);
    }
  }

  async function crearIntencionPago() {
    if (!cargoPagoSeleccionado) {
      alert('Selecciona un cargo');
      return;
    }
    try {
      const res = await fetchAPI('/api/padres/pagos/intencion', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ cargoId: cargoPagoSeleccionado, metodo: 'transferencia' })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Error iniciando pago');
        return;
      }
      alert(data.message || 'Intención de pago registrada');
      cargoPagoSeleccionado = '';
      await cargarPagosEstadoCuenta();
    } catch (error) {
      alert('Error iniciando pago');
    }
  }

  async function cargarMaestros() {
    try {
      const res = await fetchAPI('/api/maestros');
      if (res.ok) {
        maestros = await res.json();
      }
    } catch (error) {
      console.error('Error cargando maestros:', error);
    }
  }

  async function agendarCita() {
    if (!newCita.motivo || !newCita.fecha || !newCita.tipo) {
      alert('Completa todos los campos requeridos');
      return;
    }
    
    try {
      const res = await fetchAPI('/api/padres/citas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newCita)
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('Cita agendada exitosamente');
        showCitaForm = false;
        newCita = { motivo: '', fecha: '', tipo: 'directivo', maestroId: '' };
        await cargarCitas();
      } else {
        alert(data.error || 'Error agendando cita');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error agendando cita');
    }
  }

  function getTipoIcono(tipo) {
    if (tipo === 'conversacion') return '💬';
    if (tipo === 'mensaje') return '📧';
    if (tipo === 'notificacion') return '🔔';
    return '📋';
  }
</script>

{#if !isAuthenticated}
  <div class="login-container">
    <div class="login-box">
      <h1>👨‍👩‍👧 Portal de Padres</h1>
      <p>Accede a la información de tu hijo</p>
      <form on:submit|preventDefault={login}>
        <input 
          type="email" 
          bind:value={loginEmail} 
          placeholder="Email" 
          required 
          disabled={isLoading}
        />
        <input 
          type="password" 
          bind:value={loginPassword} 
          placeholder="Contraseña" 
          required 
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  </div>
{:else}
  <div class="portal-container">
    <div class="portal-header">
      <div>
        <h1>👨‍👩‍👧 Portal de Padres</h1>
        <p>Bienvenido, {padre?.nombre || 'Padre'}</p>
      </div>
      <button on:click={logout} class="logout-btn">Cerrar Sesión</button>
    </div>

    {#if alumno}
      <div class="alumno-info">
        <h2>👨‍🎓 {alumno.nombre}</h2>
        {#if alumno.grupo}
          <p>Grupo: {alumno.grupo.nombre} {alumno.grupo.nivel ? `(${alumno.grupo.nivel})` : ''}</p>
        {/if}
      </div>
    {/if}

    <div class="tabs">
      <button
        class:active={activeTab === 'dashboard'}
        on:click={() => activeTab = 'dashboard'}
      >
        📊 Resumen
      </button>
      <button
        class:active={activeTab === 'calificaciones'}
        on:click={() => activeTab = 'calificaciones'}
      >
        📚 Calificaciones
      </button>
      <button
        class:active={activeTab === 'progreso'}
        on:click={() => activeTab = 'progreso'}
      >
        📈 Progreso
      </button>
      <button
        class:active={activeTab === 'eventos'}
        on:click={() => activeTab = 'eventos'}
      >
        📅 Eventos
      </button>
      <button
        class:active={activeTab === 'citas'}
        on:click={() => activeTab = 'citas'}
      >
        📋 Citas
      </button>
      <button
        class:active={activeTab === 'pagos'}
        on:click={() => { activeTab = 'pagos'; cargarPagosEstadoCuenta(); }}
      >
        💳 Pagos
      </button>
      <button
        class:active={activeTab === 'historial'}
        on:click={() => activeTab = 'historial'}
      >
        📜 Historial
      </button>
      <button
        class:active={activeTab === 'pickup'}
        on:click={() => { activeTab = 'pickup'; cargarPickupEstado(); }}
      >
        🚗 Pickup Seguro
      </button>
    </div>

    <div class="content">
      {#if activeTab === 'dashboard'}
        <div class="section">
          <h2>📊 Resumen General</h2>
          
          <div class="dashboard-grid">
            {#if progreso}
              <div class="dashboard-card">
                <h3>Promedio General</h3>
                <div class="dashboard-value">{progreso.promedioGeneral}/100</div>
              </div>
              <div class="dashboard-card">
                <h3>Objetivos</h3>
                <div class="dashboard-value">{progreso.objetivos.cumplidos}/{progreso.objetivos.total}</div>
                <p>Objetivos cumplidos</p>
              </div>
            {/if}
            <div class="dashboard-card">
              <h3>Calificaciones</h3>
              <div class="dashboard-value">{calificaciones.length}</div>
              <p>Total registradas</p>
            </div>
            <div class="dashboard-card">
              <h3>Próximos Eventos</h3>
              <div class="dashboard-value">{eventos.length}</div>
              <p>Eventos programados</p>
            </div>
            <div class="dashboard-card">
              <h3>Citas</h3>
              <div class="dashboard-value">{citas.length}</div>
              <p>Citas agendadas</p>
            </div>
          </div>

          {#if progreso && Object.keys(progreso.evolucionPorMateria).length > 0}
            <div class="evolucion-section">
              <h3>📈 Evolución Reciente</h3>
              <div class="evolucion-list">
                {#each Object.entries(progreso.evolucionPorMateria) as [materia, puntos]}
                  {@const ultimo = puntos[puntos.length - 1]}
                  {@const anterior = puntos.length > 1 ? puntos[puntos.length - 2] : null}
                  <div class="evolucion-item">
                    <strong>{materia}</strong>
                    <div class="evolucion-valor">
                      <span class="valor-actual">{ultimo.calificacion}/100</span>
                      {#if anterior}
                        {@const cambio = ultimo.calificacion - anterior.calificacion}
                        <span class={cambio >= 0 ? 'cambio-positivo' : 'cambio-negativo'}>
                          {cambio >= 0 ? '+' : ''}{cambio}
                        </span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'calificaciones'}
        <div class="section">
          <h2>📚 Calificaciones</h2>
          
          {#if calificaciones.length > 0}
            <div class="calificaciones-list">
              {#each calificaciones as cal}
                <div class="calificacion-item">
                  <div class="calificacion-header">
                    <strong>{cal.materia}</strong>
                    <span class="calificacion-valor">{cal.calificacion}/100</span>
                  </div>
                  <p>📅 {new Date(cal.fecha).toLocaleDateString('es-ES')} | Periodo: {cal.periodo}</p>
                  {#if cal.observaciones}
                    <small>📝 {cal.observaciones}</small>
                  {/if}
                  {#if cal.calificacion < 70}
                    <span class="badge badge-bajo">Bajo rendimiento</span>
                  {:else if cal.calificacion >= 90}
                    <span class="badge badge-excelente">Excelente</span>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-state">No hay calificaciones registradas</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'progreso'}
        <div class="section">
          <h2>📈 Progreso Académico</h2>
          
          {#if progreso}
            <div class="progreso-content">
              <div class="progreso-card">
                <h3>Promedio General</h3>
                <div class="progreso-promedio">{progreso.promedioGeneral}/100</div>
              </div>

              {#if Object.keys(progreso.evolucionPorMateria).length > 0}
                <div class="evolucion-graficas">
                  <h3>Evolución por Materia</h3>
                  {#each Object.entries(progreso.evolucionPorMateria) as [materia, puntos]}
                    <div class="grafica-materia">
                      <h4>{materia}</h4>
                      <div class="grafica-bars">
                        {#each puntos as punto}
                          <div class="grafica-bar-wrapper">
                            <div 
                              class="grafica-bar" 
                              style="height: {punto.calificacion}%"
                              title="{punto.calificacion}/100"
                            ></div>
                            <small>{new Date(punto.fecha).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</small>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <p class="empty-state">No hay datos de progreso disponibles</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'eventos'}
        <div class="section">
          <h2>📅 Próximos Eventos</h2>
          
          {#if eventos.length > 0}
            <div class="eventos-list">
              {#each eventos as evento}
                <div class="evento-item">
                  <div class="evento-fecha">
                    {new Date(evento.fecha).toLocaleDateString('es-ES', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                  <h3>{evento.titulo}</h3>
                  <p>{evento.descripcion}</p>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-state">No hay eventos próximos</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'citas'}
        <div class="section">
          <h2>📋 Citas Agendadas</h2>
          
          <button on:click={() => showCitaForm = !showCitaForm} class="btn-primary">
            {showCitaForm ? 'Cancelar' : '+ Agendar Nueva Cita'}
          </button>

          {#if showCitaForm}
            <div class="cita-form">
              <h3>Agendar Cita</h3>
              <form on:submit|preventDefault={agendarCita}>
                <select bind:value={newCita.tipo} required>
                  <option value="directivo">Directivo</option>
                  <option value="maestro">Maestro</option>
                </select>
                {#if newCita.tipo === 'maestro'}
                  <select bind:value={newCita.maestroId}>
                    <option value="">Selecciona un maestro (opcional)</option>
                    {#each maestros.filter(m => m.activo !== false) as m}
                      <option value={String(m._id)}>{m.nombre}</option>
                    {/each}
                  </select>
                {/if}
                <input type="datetime-local" bind:value={newCita.fecha} required />
                <textarea bind:value={newCita.motivo} placeholder="Motivo de la cita" required></textarea>
                <button type="submit">Agendar</button>
              </form>
            </div>
          {/if}

          {#if citas.length > 0}
            <div class="citas-list">
              {#each citas as cita}
                <div class="cita-item">
                  <div class="cita-header">
                    <strong>{cita.motivo}</strong>
                    <span class={`badge badge-${cita.estado}`}>{cita.estado}</span>
                  </div>
                  <p>📅 {new Date(cita.fecha).toLocaleString('es-ES')}</p>
                  <p>Tipo: {cita.tipo === 'maestro' ? 'Maestro' : 'Directivo'}</p>
                  {#if cita.notas}
                    <small>📝 Notas: {cita.notas}</small>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-state">No hay citas agendadas</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'pagos'}
        <div class="section">
          <h2>💳 Estado de Cuenta y Pagos</h2>

          {#if pagosResumen}
            <div class="dashboard-grid">
              <div class="dashboard-card">
                <h3>Total Facturado</h3>
                <div class="dashboard-value">${pagosResumen.totalFacturado?.toFixed(2) || '0.00'}</div>
              </div>
              <div class="dashboard-card">
                <h3>Total Pagado</h3>
                <div class="dashboard-value">${pagosResumen.totalPagado?.toFixed(2) || '0.00'}</div>
              </div>
              <div class="dashboard-card">
                <h3>Total Pendiente</h3>
                <div class="dashboard-value">${pagosResumen.totalPendiente?.toFixed(2) || '0.00'}</div>
              </div>
            </div>
          {/if}

          <div class="cita-form">
            <h3>Iniciar pago</h3>
            <form on:submit|preventDefault={crearIntencionPago}>
              <select bind:value={cargoPagoSeleccionado} required>
                <option value="">Selecciona cargo pendiente</option>
                {#each pagosEstadoCuenta.filter(c => c.estado !== 'pagado') as cargo}
                  <option value={cargo._id}>
                    {cargo.conceptoNombre} - ${cargo.saldoPendiente} (vence {new Date(cargo.fechaLimite).toLocaleDateString('es-ES')})
                  </option>
                {/each}
              </select>
              <button type="submit">Solicitar pago</button>
            </form>
            <small>Cuando Stripe esté configurado, este flujo abrirá checkout automático.</small>
          </div>

          <div class="citas-list">
            {#each pagosEstadoCuenta as cargo}
              <div class="cita-item">
                <div class="cita-header">
                  <strong>{cargo.conceptoNombre}</strong>
                  <span class={`badge badge-${cargo.estado}`}>{cargo.estado}</span>
                </div>
                <p>Monto: ${cargo.monto}</p>
                <p>Pendiente: ${cargo.saldoPendiente}</p>
                <p>Fecha límite: {new Date(cargo.fechaLimite).toLocaleDateString('es-ES')}</p>
              </div>
            {:else}
              <p class="empty-state">No hay cargos registrados.</p>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'historial'}
        <div class="section">
          <h2>📜 Historial de Interacciones</h2>
          
          {#if historial.length > 0}
            <div class="historial-list">
              {#each historial as item}
                <div class="historial-item">
                  <div class="historial-icon">{getTipoIcono(item.tipo)}</div>
                  <div class="historial-content">
                    <div class="historial-header">
                      <strong>
                        {#if item.tipo === 'conversacion'}
                          Conversación con Chatbot
                        {:else if item.tipo === 'mensaje'}
                          Mensaje: {item.asunto || 'Sin asunto'}
                        {:else if item.tipo === 'notificacion'}
                          Notificación: {item.titulo || 'Sin título'}
                        {/if}
                      </strong>
                      <small>{new Date(item.timestamp).toLocaleString('es-ES')}</small>
                    </div>
                    <p>
                      {#if item.tipo === 'conversacion'}
                        {item.userMessage || item.assistantMessage || 'Sin contenido'}
                      {:else if item.tipo === 'mensaje'}
                        {item.mensaje || 'Sin contenido'}
                      {:else if item.tipo === 'notificacion'}
                        {item.mensaje || 'Sin contenido'}
                      {/if}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="empty-state">No hay historial de interacciones</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'pickup'}
        <div class="section">
          <h2>🚗 Pickup Seguro (Piloto)</h2>
          <p class="pickup-help">
            Genera un codigo temporal para avisar que vienes por tu hijo y validarlo en recepcion.
          </p>

          {#if pickupEstado && pickupEstado.estado === 'pendiente'}
            <div class="pickup-card">
              <h3>Codigo activo</h3>
              <div class="pickup-code">{pickupEstado.codigo}</div>
              {#if pickupQrDataUrl}
                <img src={pickupQrDataUrl} alt="QR de pickup seguro" class="pickup-qr" />
              {/if}
              <p>Expira: {new Date(pickupEstado.expiresAt).toLocaleString('es-ES')}</p>
            </div>
          {:else if pickupEstado}
            <p class="pickup-status">Ultimo estado: {pickupEstado.estado}</p>
          {/if}

          <div class="cita-form">
            <h3>Nueva solicitud</h3>
            <textarea
              bind:value={pickupNota}
              placeholder="Nota opcional (ej. llego en 10 min, estare en puerta principal)"
            ></textarea>
            <button on:click={solicitarPickup} disabled={pickupLoading}>
              {pickupLoading ? 'Generando...' : 'Generar codigo de pickup'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .login-box {
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    text-align: center;
    min-width: 350px;
  }

  .login-box h1 {
    margin-bottom: 10px;
    color: #333;
  }

  .login-box p {
    color: #6c757d;
    margin-bottom: 25px;
  }

  .login-box input {
    width: 100%;
    padding: 12px;
    margin-bottom: 15px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 16px;
    box-sizing: border-box;
  }

  .login-box button {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .login-box button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .portal-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .portal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
  }

  .portal-header h1 {
    margin: 0;
    font-size: 1.8rem;
  }

  .portal-header p {
    margin: 5px 0 0 0;
    opacity: 0.9;
  }

  .logout-btn {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }

  .logout-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .alumno-info {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 25px;
  }

  .alumno-info h2 {
    margin: 0 0 5px 0;
    color: #333;
  }

  .alumno-info p {
    margin: 0;
    color: #6c757d;
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 25px;
    flex-wrap: wrap;
  }

  .tabs button {
    padding: 12px 20px;
    background: #f8f9fa;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .tabs button.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-color: transparent;
  }

  .tabs button:hover {
    background: #e9ecef;
  }

  .tabs button.active:hover {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .section {
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .section h2 {
    margin: 0 0 25px 0;
    color: #333;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .dashboard-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
  }

  .dashboard-card h3 {
    margin: 0 0 10px 0;
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .dashboard-value {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 5px;
  }

  .dashboard-card p {
    margin: 0;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .evolucion-section {
    margin-top: 30px;
  }

  .evolucion-section h3 {
    margin: 0 0 15px 0;
    color: #333;
  }

  .evolucion-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .evolucion-item {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .evolucion-valor {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .valor-actual {
    font-size: 1.2rem;
    font-weight: 700;
    color: #333;
  }

  .cambio-positivo {
    color: #28a745;
    font-weight: 600;
  }

  .cambio-negativo {
    color: #dc3545;
    font-weight: 600;
  }

  .calificaciones-list, .eventos-list, .citas-list, .historial-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .calificacion-item, .evento-item, .cita-item {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid #667eea;
  }

  .calificacion-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .calificacion-valor {
    font-size: 1.5rem;
    font-weight: 700;
    color: #667eea;
  }

  .evento-fecha {
    color: #667eea;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .evento-item h3 {
    margin: 0 0 8px 0;
    color: #333;
  }

  .cita-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .btn-primary {
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 20px;
  }

  .cita-form {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .cita-form h3 {
    margin: 0 0 15px 0;
  }

  .cita-form select,
  .cita-form input,
  .cita-form textarea {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .cita-form textarea {
    min-height: 80px;
    resize: vertical;
  }

  .cita-form button {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }

  .historial-item {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    display: flex;
    gap: 15px;
    border-left: 4px solid #667eea;
  }

  .historial-icon {
    font-size: 1.5rem;
  }

  .historial-content {
    flex: 1;
  }

  .historial-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .historial-header strong {
    color: #333;
  }

  .historial-header small {
    color: #6c757d;
  }

  .progreso-content {
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  .progreso-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
  }

  .progreso-card h3 {
    margin: 0 0 15px 0;
    opacity: 0.9;
  }

  .progreso-promedio {
    font-size: 3rem;
    font-weight: 700;
  }

  .evolucion-graficas {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .evolucion-graficas h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .grafica-materia {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
  }

  .grafica-materia h4 {
    margin: 0 0 15px 0;
    color: #333;
  }

  .grafica-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 150px;
    gap: 10px;
  }

  .grafica-bar-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
  }

  .grafica-bar {
    width: 100%;
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px 4px 0 0;
    min-height: 5px;
    transition: height 0.3s ease;
  }

  .grafica-bar-wrapper small {
    margin-top: 5px;
    font-size: 0.7rem;
    color: #6c757d;
    text-align: center;
  }

  .badge {
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .badge-bajo {
    background: #dc3545;
    color: white;
  }

  .badge-excelente {
    background: #28a745;
    color: white;
  }

  .badge-pendiente {
    background: #ffc107;
    color: #333;
  }

  .badge-confirmada {
    background: #28a745;
    color: white;
  }

  .badge-cancelada {
    background: #dc3545;
    color: white;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #6c757d;
    font-style: italic;
  }

  .pickup-help {
    margin-bottom: 15px;
    color: #495057;
  }

  .pickup-card {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 18px;
    margin-bottom: 20px;
    text-align: center;
  }

  .pickup-code {
    font-size: 2.2rem;
    font-weight: 700;
    letter-spacing: 4px;
    margin: 8px 0;
    color: #343a40;
  }

  .pickup-qr {
    width: 220px;
    height: 220px;
    display: block;
    margin: 12px auto;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    background: #fff;
    padding: 8px;
    box-sizing: border-box;
  }

  .pickup-status {
    margin-bottom: 15px;
    color: #6c757d;
  }
</style>
