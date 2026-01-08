<script>
  import { onMount } from 'svelte';
  
  let isAuthenticated = false;
  let password = '';
  let activeTab = 'horarios';
  let stats = { conversations: 0, citas: 0, citasPendientes: 0 };
  let authToken = '';

  // Datos
  let horarios = [];
  let eventos = [];
  let planes = [];
  let citas = [];
  let informacion = { contenido: '' };

  // Formularios
  let editingHorario = null;
  let editingEvento = null;
  let editingPlan = null;
  let newHorario = { titulo: '', descripcion: '', orden: 0 };
  let newEvento = { titulo: '', descripcion: '', fecha: '' };
  let newPlan = { nombre: '', descripcion: '', costo: '' };

  onMount(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      authToken = token;
      isAuthenticated = true;
      loadData();
    }
  });

  async function login() {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();
      if (data.success) {
        authToken = data.token;
        localStorage.setItem('adminToken', data.token);
        isAuthenticated = true;
        loadData();
      } else {
        alert('Contraseña incorrecta');
      }
    } catch (error) {
      alert('Error al iniciar sesión');
    }
  }

  function logout() {
    isAuthenticated = false;
    authToken = '';
    localStorage.removeItem('adminToken');
  }

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
  }

  async function loadData() {
    await Promise.all([
      loadStats(),
      loadHorarios(),
      loadEventos(),
      loadPlanes(),
      loadCitas(),
      loadInformacion()
    ]);
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
      stats = await res.json();
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  async function loadHorarios() {
    try {
      const res = await fetch('/api/admin/horarios', { headers: getAuthHeaders() });
      horarios = await res.json();
    } catch (error) {
      console.error('Error cargando horarios:', error);
    }
  }

  async function loadEventos() {
    try {
      const res = await fetch('/api/admin/eventos', { headers: getAuthHeaders() });
      eventos = await res.json();
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  async function loadPlanes() {
    try {
      const res = await fetch('/api/admin/planes', { headers: getAuthHeaders() });
      planes = await res.json();
    } catch (error) {
      console.error('Error cargando planes:', error);
    }
  }

  async function loadCitas() {
    try {
      const res = await fetch('/api/admin/citas', { headers: getAuthHeaders() });
      citas = await res.json();
    } catch (error) {
      console.error('Error cargando citas:', error);
    }
  }

  async function loadInformacion() {
    try {
      const res = await fetch('/api/admin/informacion', { headers: getAuthHeaders() });
      informacion = await res.json();
    } catch (error) {
      console.error('Error cargando información:', error);
    }
  }

  // Horarios
  async function saveHorario() {
    try {
      const url = editingHorario 
        ? `/api/admin/horarios/${editingHorario._id}`
        : '/api/admin/horarios';
      const method = editingHorario ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newHorario)
      });
      
      await loadHorarios();
      editingHorario = null;
      newHorario = { titulo: '', descripcion: '', orden: 0 };
    } catch (error) {
      alert('Error guardando horario');
    }
  }

  function editHorario(h) {
    editingHorario = h;
    newHorario = { ...h };
  }

  async function deleteHorario(id) {
    if (!confirm('¿Eliminar este horario?')) return;
    try {
      await fetch(`/api/admin/horarios/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadHorarios();
    } catch (error) {
      alert('Error eliminando horario');
    }
  }

  // Eventos
  async function saveEvento() {
    try {
      const url = editingEvento 
        ? `/api/admin/eventos/${editingEvento._id}`
        : '/api/admin/eventos';
      const method = editingEvento ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newEvento)
      });
      
      await loadEventos();
      editingEvento = null;
      newEvento = { titulo: '', descripcion: '', fecha: '' };
    } catch (error) {
      alert('Error guardando evento');
    }
  }

  function editEvento(e) {
    editingEvento = e;
    const fecha = new Date(e.fecha).toISOString().slice(0, 16);
    newEvento = { ...e, fecha };
  }

  async function deleteEvento(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      await fetch(`/api/admin/eventos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadEventos();
    } catch (error) {
      alert('Error eliminando evento');
    }
  }

  // Planes
  async function savePlan() {
    try {
      const url = editingPlan 
        ? `/api/admin/planes/${editingPlan._id}`
        : '/api/admin/planes';
      const method = editingPlan ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newPlan)
      });
      
      await loadPlanes();
      editingPlan = null;
      newPlan = { nombre: '', descripcion: '', costo: '' };
    } catch (error) {
      alert('Error guardando plan');
    }
  }

  function editPlan(p) {
    editingPlan = p;
    newPlan = { ...p };
  }

  async function deletePlan(id) {
    if (!confirm('¿Eliminar este plan?')) return;
    try {
      await fetch(`/api/admin/planes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadPlanes();
    } catch (error) {
      alert('Error eliminando plan');
    }
  }

  // Información
  async function saveInformacion() {
    try {
      await fetch('/api/admin/informacion', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ contenido: informacion.contenido })
      });
      alert('Información guardada');
    } catch (error) {
      alert('Error guardando información');
    }
  }

  // Citas
  async function updateCitaEstado(id, estado) {
    try {
      await fetch(`/api/admin/citas/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ estado })
      });
      await loadCitas();
      await loadStats();
    } catch (error) {
      alert('Error actualizando cita');
    }
  }
</script>

{#if !isAuthenticated}
  <div class="login-container">
    <div class="login-box">
      <h1>🔐 Panel de Administración</h1>
      <input
        type="password"
        bind:value={password}
        placeholder="Contraseña"
        on:keypress={(e) => e.key === 'Enter' && login()}
      />
      <button on:click={login}>Ingresar</button>
    </div>
  </div>
{:else}
  <div class="admin-container">
    <header>
      <h1>⚙️ Panel de Administración</h1>
      <button on:click={logout} class="logout-btn">Salir</button>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">{stats.conversations}</div>
        <div class="stat-label">Conversaciones</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.citas}</div>
        <div class="stat-label">Total Citas</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{stats.citasPendientes}</div>
        <div class="stat-label">Citas Pendientes</div>
      </div>
    </div>

    <div class="tabs">
      <button
        class:active={activeTab === 'horarios'}
        on:click={() => activeTab = 'horarios'}
      >
        📅 Horarios
      </button>
      <button
        class:active={activeTab === 'eventos'}
        on:click={() => activeTab = 'eventos'}
      >
        🎉 Eventos
      </button>
      <button
        class:active={activeTab === 'planes'}
        on:click={() => activeTab = 'planes'}
      >
        💰 Planes
      </button>
      <button
        class:active={activeTab === 'informacion'}
        on:click={() => activeTab = 'informacion'}
      >
        ℹ️ Información
      </button>
      <button
        class:active={activeTab === 'citas'}
        on:click={() => activeTab = 'citas'}
      >
        📋 Citas
      </button>
    </div>

    <div class="content">
      {#if activeTab === 'horarios'}
        <div class="section">
          <h2>Gestionar Horarios</h2>
          <form on:submit|preventDefault={saveHorario} class="form">
            <input bind:value={newHorario.titulo} placeholder="Título" required />
            <textarea bind:value={newHorario.descripcion} placeholder="Descripción" required></textarea>
            <input type="number" bind:value={newHorario.orden} placeholder="Orden" />
            <button type="submit">{editingHorario ? 'Actualizar' : 'Agregar'}</button>
            {#if editingHorario}
              <button type="button" on:click={() => { editingHorario = null; newHorario = { titulo: '', descripcion: '', orden: 0 }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each horarios as h}
              <div class="item">
                <div>
                  <strong>{h.titulo}</strong>
                  <p>{h.descripcion}</p>
                </div>
                <div class="actions">
                  <button on:click={() => editHorario(h)}>✏️</button>
                  <button on:click={() => deleteHorario(h._id)}>🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'eventos'}
        <div class="section">
          <h2>Gestionar Eventos</h2>
          <form on:submit|preventDefault={saveEvento} class="form">
            <input bind:value={newEvento.titulo} placeholder="Título" required />
            <textarea bind:value={newEvento.descripcion} placeholder="Descripción" required></textarea>
            <input type="datetime-local" bind:value={newEvento.fecha} required />
            <button type="submit">{editingEvento ? 'Actualizar' : 'Agregar'}</button>
            {#if editingEvento}
              <button type="button" on:click={() => { editingEvento = null; newEvento = { titulo: '', descripcion: '', fecha: '' }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each eventos as e}
              <div class="item">
                <div>
                  <strong>{e.titulo}</strong>
                  <p>{e.descripcion}</p>
                  <small>{new Date(e.fecha).toLocaleString('es-ES')}</small>
                </div>
                <div class="actions">
                  <button on:click={() => editEvento(e)}>✏️</button>
                  <button on:click={() => deleteEvento(e._id)}>🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'planes'}
        <div class="section">
          <h2>Gestionar Planes de Pago</h2>
          <form on:submit|preventDefault={savePlan} class="form">
            <input bind:value={newPlan.nombre} placeholder="Nombre del plan" required />
            <textarea bind:value={newPlan.descripcion} placeholder="Descripción" required></textarea>
            <input bind:value={newPlan.costo} placeholder="Costo" required />
            <button type="submit">{editingPlan ? 'Actualizar' : 'Agregar'}</button>
            {#if editingPlan}
              <button type="button" on:click={() => { editingPlan = null; newPlan = { nombre: '', descripcion: '', costo: '' }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each planes as p}
              <div class="item">
                <div>
                  <strong>{p.nombre}</strong>
                  <p>{p.descripcion}</p>
                  <small>Costo: ${p.costo}</small>
                </div>
                <div class="actions">
                  <button on:click={() => editPlan(p)}>✏️</button>
                  <button on:click={() => deletePlan(p._id)}>🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'informacion'}
        <div class="section">
          <h2>Información General</h2>
          <textarea
            bind:value={informacion.contenido}
            placeholder="Información general que el bot debe conocer..."
            class="large-textarea"
          ></textarea>
          <button on:click={saveInformacion}>💾 Guardar Información</button>
        </div>
      {/if}

      {#if activeTab === 'citas'}
        <div class="section">
          <h2>Gestionar Citas</h2>
          <div class="list">
            {#each citas as c}
              <div class="item cita-item">
                <div>
                  <strong>{c.nombre}</strong>
                  <p>{c.motivo}</p>
                  <small>📧 {c.email} | 📞 {c.telefono}</small>
                  <small>📅 {new Date(c.fecha).toLocaleString('es-ES')} | Tipo: {c.tipo}</small>
                  <span class="badge badge-{c.estado}">{c.estado}</span>
                </div>
                <div class="actions">
                  {#if c.estado === 'pendiente'}
                    <button on:click={() => updateCitaEstado(c._id, 'confirmada')}>✅ Confirmar</button>
                    <button on:click={() => updateCitaEstado(c._id, 'cancelada')}>❌ Cancelar</button>
                  {/if}
                </div>
              </div>
            {/each}
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
    min-width: 300px;
  }

  .login-box h1 {
    margin-bottom: 30px;
    color: #333;
  }

  .login-box input {
    width: 100%;
    padding: 12px;
    margin-bottom: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
  }

  .login-box button {
    width: 100%;
    padding: 12px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .admin-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background: white;
    min-height: 100vh;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #f0f0f0;
  }

  header h1 {
    color: #333;
  }

  .logout-btn {
    padding: 10px 20px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: bold;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    flex-wrap: wrap;
  }

  .tabs button {
    padding: 12px 24px;
    border: 2px solid #ddd;
    background: white;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .tabs button.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .section {
    background: #f8f9fa;
    padding: 30px;
    border-radius: 12px;
  }

  .section h2 {
    margin-bottom: 20px;
    color: #333;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 30px;
  }

  .form input,
  .form textarea {
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
  }

  .form textarea {
    min-height: 80px;
    resize: vertical;
  }

  .form button {
    padding: 12px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }

  .large-textarea {
    min-height: 300px;
    width: 100%;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    font-family: inherit;
    margin-bottom: 15px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .item {
    background: white;
    padding: 20px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .item strong {
    display: block;
    margin-bottom: 5px;
    color: #333;
  }

  .item p {
    margin: 5px 0;
    color: #666;
    font-size: 14px;
  }

  .item small {
    display: block;
    color: #999;
    font-size: 12px;
    margin-top: 5px;
  }

  .actions {
    display: flex;
    gap: 10px;
  }

  .actions button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
  }

  .actions button:first-child {
    background: #3498db;
    color: white;
  }

  .actions button:last-child {
    background: #e74c3c;
    color: white;
  }

  .cita-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .cita-item .actions {
    margin-top: 15px;
    width: 100%;
  }

  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    margin-top: 10px;
  }

  .badge-pendiente {
    background: #f39c12;
    color: white;
  }

  .badge-confirmada {
    background: #27ae60;
    color: white;
  }

  .badge-cancelada {
    background: #e74c3c;
    color: white;
  }
</style>

