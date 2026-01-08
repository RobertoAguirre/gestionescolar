<script>
  import { onMount } from 'svelte';
  import { API_URL } from '../config.js';
  
  let isAuthenticated = false;
  let password = '';
  let activeTab = 'dashboard';
  let isSuperAdmin = false;
  let escuelas = [];
  let escuelaId = '';
  let stats = { 
    conversations: 0, 
    citas: 0, 
    citasPendientes: 0, 
    maestros: 0, 
    alumnos: 0, 
    grupos: 0,
    impacto: {
      conversacionesResueltas: 0,
      conversacionesConCita: 0,
      tiempoAhorradoHoras: 0,
      tiempoPromedioRespuesta: 0,
      tasaResolucion: 0,
      temasMasConsultados: []
    }
  };
  let authToken = '';
  
  // Búsquedas y filtros
  let searchMaestros = '';
  let searchAlumnos = '';
  let searchGrupos = '';
  let searchEspacios = '';
  let searchCitas = '';

  // Datos
  let horarios = [];
  let eventos = [];
  let planes = [];
  let citas = [];
  let informacion = { contenido: '' };
  let maestros = [];
  let alumnos = [];
  let espacios = [];
  let grupos = [];
  let calificaciones = [];
  let alertas = [];
  let asistencia = [];
  let alertasAusentismo = [];
  let notificaciones = [];
  let mensajes = [];
  let respuestasRapidas = [];
  let progresoData = null;
  let objetivos = [];
  let logrosData = null;
  let analisisPredictivo = null;
  let alumnosEnRiesgo = [];
  let tipoReporte = 'mensual-uso';
  let tareas = [];
  let calendarioAcademico = null;
  let fechasImportantes = null;
  let newTarea = { titulo: '', descripcion: '', tipo: 'tarea', grupoId: '', maestroId: '', alumnos: [], fechaLimite: '', puntos: 100, enviarRecordatorio: false };
  let editingTarea = null;
  let tareaSeleccionada = null;
  let entregaTarea = { archivo: '', comentarios: '' };
  let calificacionTarea = { calificacion: '', comentarios: '' };
  let recursos = [];
  let newRecurso = { titulo: '', descripcion: '', tipo: 'documento', materia: '', url: '', maestroId: '', learningDifferences: false, tags: '' };
  let editingRecurso = null;
  let recursoSeleccionado = null;
  let recomendacionesRecursos = null;
  let materiaSeleccionadaRecursos = '';
  let busquedaRecursos = '';
  let reporteMes = new Date().getMonth() + 1;
  let reporteAño = new Date().getFullYear();
  let reportePeriodo = '';
  let reporteFechaInicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let reporteFechaFin = new Date().toISOString().split('T')[0];
  let datosReporte = null;

  // Formularios
  let editingHorario = null;
  let editingEvento = null;
  let editingPlan = null;
  let editingMaestro = null;
  let editingAlumno = null;
  let editingEspacio = null;
  let editingGrupo = null;
  let editingCalificacion = null;
  let newHorario = { titulo: '', descripcion: '', orden: 0 };
  let newEvento = { titulo: '', descripcion: '', fecha: '', enviarRecordatorio: false };
  let newPlan = { nombre: '', descripcion: '', costo: '' };
  let newMaestro = { nombre: '', email: '', telefono: '', especialidad: '', horariosDisponibles: '' };
  let newAlumno = { nombre: '', email: '', telefono: '', grupoId: '', padres: [], padresTexto: '' };
  let newEspacio = { nombre: '', tipo: 'salon', capacidad: 0, equipamiento: '' };
  let newGrupo = { nombre: '', nivel: '', maestroId: '', espacioId: '', horario: '', alumnos: [] };
  let newCalificacion = { alumnoId: '', grupoId: '', materia: '', calificacion: '', periodo: 'general', fecha: '', observaciones: '' };
  let newAsistencia = { alumnoId: '', grupoId: '', fecha: '', estado: 'presente', observaciones: '', periodo: 'general' };
  let editingAsistencia = null;
  let estadisticasAsistencia = null;
  let estadisticasGrupo = null;
  let tendenciasAsistencia = null;
  let grupoSeleccionadoAsistencia = '';
  let alumnoSeleccionadoAsistencia = '';

  onMount(() => {
    const token = localStorage.getItem('adminToken');
    const savedEscuelaId = localStorage.getItem('escuelaId');
    if (token) {
      authToken = token;
      isAuthenticated = true;
      if (savedEscuelaId) {
        escuelaId = savedEscuelaId;
      }
      checkSuperAdmin();
      loadData();
    }
  });

  async function checkSuperAdmin() {
    try {
      const res = await fetch(`${API_URL}/api/super-admin/escuelas', { headers: getAuthHeaders() });
      if (res.ok) {
        escuelas = await res.json();
        isSuperAdmin = true;
        if (escuelas.length > 0 && !escuelaId) {
          escuelaId = String(escuelas[0]._id);
          localStorage.setItem('escuelaId', escuelaId);
        }
      } else {
        isSuperAdmin = false;
      }
    } catch (error) {
      isSuperAdmin = false;
    }
  }

  async function login() {
    try {
      const response = await fetch(`${API_URL}/api/admin/login', {
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
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
    
    if (escuelaId) {
      headers['X-Escuela-Id'] = escuelaId;
    }
    
    return headers;
  }

  async function loadData() {
    await Promise.all([
      loadStats(),
      loadHorarios(),
      loadEventos(),
      loadPlanes(),
      loadCitas(),
      loadInformacion(),
      loadMaestros(),
      loadAlumnos(),
      loadEspacios(),
      loadGrupos(),
      loadCalificaciones(),
      loadAlertas(),
      loadAsistencia(),
      loadAlertasAusentismo(),
      loadNotificaciones(),
      loadMensajes(),
      loadRespuestasRapidas(),
      loadAlumnosEnRiesgo(),
      loadRecursos()
    ]);
  }

  async function loadStats() {
    try {
      const res = await fetch(`${API_URL}/api/admin/stats', { headers: getAuthHeaders() });
      stats = await res.json();
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  }

  async function loadHorarios() {
    try {
      const res = await fetch(`${API_URL}/api/admin/horarios', { headers: getAuthHeaders() });
      horarios = await res.json();
    } catch (error) {
      console.error('Error cargando horarios:', error);
    }
  }

  async function loadEventos() {
    try {
      const res = await fetch(`${API_URL}/api/admin/eventos', { headers: getAuthHeaders() });
      eventos = await res.json();
    } catch (error) {
      console.error('Error cargando eventos:', error);
    }
  }

  async function loadPlanes() {
    try {
      const res = await fetch(`${API_URL}/api/admin/planes', { headers: getAuthHeaders() });
      planes = await res.json();
    } catch (error) {
      console.error('Error cargando planes:', error);
    }
  }

  async function loadCitas() {
    try {
      const res = await fetch(`${API_URL}/api/admin/citas', { headers: getAuthHeaders() });
      citas = await res.json();
    } catch (error) {
      console.error('Error cargando citas:', error);
    }
  }

  async function loadInformacion() {
    try {
      const res = await fetch(`${API_URL}/api/admin/informacion', { headers: getAuthHeaders() });
      informacion = await res.json();
    } catch (error) {
      console.error('Error cargando información:', error);
    }
  }

  // Horarios
  async function saveHorario() {
    if (!newHorario.titulo.trim()) {
      alert('El título es requerido');
      return;
    }
    if (!newHorario.descripcion.trim()) {
      alert('La descripción es requerida');
      return;
    }
    
    try {
      const url = editingHorario 
        ? `${API_URL}/api/admin/horarios/${editingHorario._id}`
        : `${API_URL}/api/admin/horarios`;
      const method = editingHorario ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newHorario)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando horario');
      }
      
      await loadHorarios();
      editingHorario = null;
      newHorario = { titulo: '', descripcion: '', orden: 0 };
    } catch (error) {
      alert(error.message || 'Error guardando horario');
    }
  }

  function editHorario(h) {
    editingHorario = h;
    newHorario = { ...h };
  }

  async function deleteHorario(id) {
    if (!confirm('¿Eliminar este horario?')) return;
    try {
      await fetch(`${API_URL}/api/admin/horarios/${id}`, {
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
        ? `${API_URL}/api/admin/eventos/${editingEvento._id}`
        : `${API_URL}/api/admin/eventos`;
      const method = editingEvento ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newEvento)
      });
      
      await loadEventos();
      editingEvento = null;
      newEvento = { titulo: '', descripcion: '', fecha: '', enviarRecordatorio: false };
    } catch (error) {
      alert('Error guardando evento');
    }
  }

  function editEvento(e) {
    editingEvento = e;
    const fecha = new Date(e.fecha).toISOString().slice(0, 16);
    newEvento = { ...e, fecha, enviarRecordatorio: false };
  }

  async function deleteEvento(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    try {
      await fetch(`${API_URL}/api/admin/eventos/${id}`, {
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
        ? `${API_URL}/api/admin/planes/${editingPlan._id}`
        : `${API_URL}/api/admin/planes`;
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
      await fetch(`${API_URL}/api/admin/planes/${id}`, {
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
      await fetch(`${API_URL}/api/admin/informacion', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ contenido: informacion.contenido })
      });
      alert('Información guardada');
    } catch (error) {
      alert('Error guardando información');
    }
  }

  // Maestros
  async function loadMaestros() {
    try {
      const res = await fetch(`${API_URL}/api/admin/maestros', { headers: getAuthHeaders() });
      maestros = await res.json();
    } catch (error) {
      console.error('Error cargando maestros:', error);
    }
  }

  async function saveMaestro() {
    if (!newMaestro.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }
    
    if (newMaestro.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMaestro.email)) {
      alert('El email no es válido');
      return;
    }
    
    try {
      const url = editingMaestro 
        ? `${API_URL}/api/admin/maestros/${editingMaestro._id}`
        : `${API_URL}/api/admin/maestros`;
      const method = editingMaestro ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newMaestro)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando maestro');
      }
      
      await loadMaestros();
      await loadStats();
      editingMaestro = null;
      newMaestro = { nombre: '', email: '', telefono: '', especialidad: '', horariosDisponibles: '' };
    } catch (error) {
      alert(error.message || 'Error guardando maestro');
    }
  }

  function editMaestro(m) {
    editingMaestro = m;
    newMaestro = { ...m };
  }

  async function deleteMaestro(id) {
    if (!confirm('¿Eliminar este maestro?')) return;
    try {
      await fetch(`${API_URL}/api/admin/maestros/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadMaestros();
      await loadStats();
    } catch (error) {
      alert('Error eliminando maestro');
    }
  }

  // Alumnos
  async function loadAlumnos() {
    try {
      const res = await fetch(`${API_URL}/api/admin/alumnos', { headers: getAuthHeaders() });
      alumnos = await res.json();
    } catch (error) {
      console.error('Error cargando alumnos:', error);
    }
  }

  async function saveAlumno() {
    if (!newAlumno.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }
    
    if (newAlumno.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAlumno.email)) {
      alert('El email no es válido');
      return;
    }
    
    try {
      const url = editingAlumno 
        ? `${API_URL}/api/admin/alumnos/${editingAlumno._id}`
        : `${API_URL}/api/admin/alumnos`;
      const method = editingAlumno ? 'PUT' : 'POST';
      
      const data = { ...newAlumno };
      if (data.grupoId === '') data.grupoId = null;
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando alumno');
      }
      
      await loadAlumnos();
      await loadStats();
      editingAlumno = null;
      newAlumno = { nombre: '', email: '', telefono: '', grupoId: '', padres: [], padresTexto: '' };
    } catch (error) {
      alert(error.message || 'Error guardando alumno');
    }
  }

  function editAlumno(a) {
    editingAlumno = a;
    const padresTexto = (a.padres || []).map(p => `${p.nombre}|${p.email}|${p.password || ''}`).join('\n');
    newAlumno = { 
      ...a, 
      grupoId: a.grupoId ? String(a.grupoId) : '',
      padres: a.padres || [],
      padresTexto: padresTexto
    };
  }

  async function deleteAlumno(id) {
    if (!confirm('¿Eliminar este alumno?')) return;
    try {
      await fetch(`${API_URL}/api/admin/alumnos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadAlumnos();
      await loadStats();
    } catch (error) {
      alert('Error eliminando alumno');
    }
  }

  // Espacios
  async function loadEspacios() {
    try {
      const res = await fetch(`${API_URL}/api/admin/espacios', { headers: getAuthHeaders() });
      espacios = await res.json();
    } catch (error) {
      console.error('Error cargando espacios:', error);
    }
  }

  async function saveEspacio() {
    if (!newEspacio.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }
    
    if (!newEspacio.tipo) {
      alert('El tipo es requerido');
      return;
    }
    
    if (newEspacio.capacidad < 0) {
      alert('La capacidad no puede ser negativa');
      return;
    }
    
    try {
      const url = editingEspacio 
        ? `${API_URL}/api/admin/espacios/${editingEspacio._id}`
        : `${API_URL}/api/admin/espacios`;
      const method = editingEspacio ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newEspacio)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando espacio');
      }
      
      await loadEspacios();
      editingEspacio = null;
      newEspacio = { nombre: '', tipo: 'salon', capacidad: 0, equipamiento: '' };
    } catch (error) {
      alert(error.message || 'Error guardando espacio');
    }
  }

  function editEspacio(e) {
    editingEspacio = e;
    newEspacio = { ...e };
  }

  async function deleteEspacio(id) {
    if (!confirm('¿Eliminar este espacio?')) return;
    try {
      await fetch(`${API_URL}/api/admin/espacios/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadEspacios();
    } catch (error) {
      alert('Error eliminando espacio');
    }
  }

  // Grupos
  async function loadGrupos() {
    try {
      const res = await fetch(`${API_URL}/api/admin/grupos', { headers: getAuthHeaders() });
      grupos = await res.json();
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  }

  async function saveGrupo() {
    if (!newGrupo.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }
    
    try {
      const url = editingGrupo 
        ? `${API_URL}/api/admin/grupos/${editingGrupo._id}`
        : `${API_URL}/api/admin/grupos`;
      const method = editingGrupo ? 'PUT' : 'POST';
      
      const data = { ...newGrupo };
      if (data.maestroId === '') data.maestroId = null;
      if (data.espacioId === '') data.espacioId = null;
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando grupo');
      }
      
      await loadGrupos();
      await loadStats();
      editingGrupo = null;
      newGrupo = { nombre: '', nivel: '', maestroId: '', espacioId: '', horario: '', alumnos: [] };
    } catch (error) {
      alert(error.message || 'Error guardando grupo');
    }
  }

  function editGrupo(g) {
    editingGrupo = g;
    newGrupo = { ...g, maestroId: g.maestroId || '', espacioId: g.espacioId || '' };
  }

  async function deleteGrupo(id) {
    if (!confirm('¿Eliminar este grupo?')) return;
    try {
      await fetch(`${API_URL}/api/admin/grupos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadGrupos();
      await loadStats();
    } catch (error) {
      alert('Error eliminando grupo');
    }
  }

  // Citas
  async function updateCitaEstado(id, estado) {
    try {
      await fetch(`${API_URL}/api/admin/citas/${id}`, {
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

  // Calificaciones
  async function loadCalificaciones() {
    try {
      const res = await fetch(`${API_URL}/api/admin/calificaciones', { headers: getAuthHeaders() });
      calificaciones = await res.json();
    } catch (error) {
      console.error('Error cargando calificaciones:', error);
    }
  }

  async function loadAlertas() {
    try {
      const res = await fetch(`${API_URL}/api/admin/calificaciones/alertas?umbral=70', { headers: getAuthHeaders() });
      const data = await res.json();
      alertas = data.alertas || [];
    } catch (error) {
      console.error('Error cargando alertas:', error);
    }
  }

  async function saveCalificacion() {
    if (!newCalificacion.alumnoId) {
      alert('Debes seleccionar un alumno');
      return;
    }
    if (!newCalificacion.materia || !newCalificacion.materia.trim()) {
      alert('La materia es requerida');
      return;
    }
    if (!newCalificacion.calificacion || newCalificacion.calificacion < 0 || newCalificacion.calificacion > 100) {
      alert('La calificación debe estar entre 0 y 100');
      return;
    }
    
    try {
      const url = editingCalificacion 
        ? `${API_URL}/api/admin/calificaciones/${editingCalificacion._id}`
        : `${API_URL}/api/admin/calificaciones`;
      const method = editingCalificacion ? 'PUT' : 'POST';
      
      const data = { ...newCalificacion };
      data.calificacion = parseFloat(data.calificacion);
      if (data.grupoId === '') data.grupoId = null;
      if (!data.fecha) data.fecha = new Date().toISOString().split('T')[0];
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando calificación');
      }
      
      await loadCalificaciones();
      await loadAlertas();
      editingCalificacion = null;
      newCalificacion = { alumnoId: '', grupoId: '', materia: '', calificacion: '', periodo: 'general', fecha: '', observaciones: '' };
    } catch (error) {
      alert(error.message || 'Error guardando calificación');
    }
  }

  function editCalificacion(c) {
    editingCalificacion = c;
    const fecha = c.fecha ? new Date(c.fecha).toISOString().split('T')[0] : '';
    newCalificacion = { 
      ...c, 
      alumnoId: String(c.alumnoId),
      grupoId: c.grupoId ? String(c.grupoId) : '',
      fecha: fecha
    };
  }

  async function deleteCalificacion(id) {
    if (!confirm('¿Eliminar esta calificación?')) return;
    try {
      await fetch(`${API_URL}/api/admin/calificaciones/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadCalificaciones();
      await loadAlertas();
    } catch (error) {
      alert('Error eliminando calificación');
    }
  }

  async function verPromedios(alumnoId) {
    try {
      const res = await fetch(`${API_URL}/api/admin/calificaciones/promedios/${alumnoId}`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      let mensaje = `Promedio General: ${data.promedioGeneral}/100\n\nPromedios por Materia:\n`;
      data.promediosPorMateria.forEach(p => {
        mensaje += `- ${p.materia}: ${p.promedio}/100 (${p.cantidad} calificaciones)\n`;
      });
      alert(mensaje);
    } catch (error) {
      alert('Error obteniendo promedios');
    }
  }

  async function verHistorialAcademico(alumnoId) {
    try {
      const res = await fetch(`${API_URL}/api/admin/calificaciones/historial/${alumnoId}`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      let mensaje = `Historial Académico (${data.totalCalificaciones} calificaciones)\n\n`;
      data.promediosPorPeriodo.forEach(p => {
        mensaje += `Periodo ${p.periodo}: Promedio ${p.promedio}/100 (${p.cantidad} calificaciones)\n`;
      });
      alert(mensaje);
    } catch (error) {
      alert('Error obteniendo historial');
    }
  }

  async function verRecomendaciones(alumnoId) {
    try {
      const res = await fetch(`${API_URL}/api/admin/calificaciones/recomendaciones/${alumnoId}`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      let mensaje = `Recomendaciones para el alumno\nPromedio General: ${data.promedioGeneral}/100\n\n`;
      if (data.recomendaciones.length === 0) {
        mensaje += 'No hay recomendaciones específicas en este momento.';
      } else {
        data.recomendaciones.forEach(r => {
          mensaje += `[${r.prioridad.toUpperCase()}] ${r.mensaje}\n\n`;
        });
      }
      alert(mensaje);
    } catch (error) {
      alert('Error obteniendo recomendaciones');
    }
  }

  // Asistencia
  async function loadAsistencia() {
    try {
      const res = await fetch(`${API_URL}/api/admin/asistencia', { headers: getAuthHeaders() });
      asistencia = await res.json();
    } catch (error) {
      console.error('Error cargando asistencia:', error);
    }
  }

  async function loadAlertasAusentismo() {
    try {
      const res = await fetch(`${API_URL}/api/admin/asistencia/alertas?umbral=80', { headers: getAuthHeaders() });
      const data = await res.json();
      alertasAusentismo = data.alertas || [];
    } catch (error) {
      console.error('Error cargando alertas de ausentismo:', error);
    }
  }

  async function saveAsistencia() {
    try {
      const url = editingAsistencia 
        ? `${API_URL}/api/admin/asistencia/${editingAsistencia._id}`
        : `${API_URL}/api/admin/asistencia`;
      const method = editingAsistencia ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newAsistencia)
      });
      
      if (res.ok) {
        await loadAsistencia();
        newAsistencia = { alumnoId: '', grupoId: '', fecha: '', estado: 'presente', observaciones: '', periodo: 'general' };
        editingAsistencia = null;
        if (alumnoSeleccionadoAsistencia) cargarEstadisticasAlumno();
        if (grupoSeleccionadoAsistencia) cargarEstadisticasGrupo();
      } else {
        alert('Error guardando asistencia');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error guardando asistencia');
    }
  }

  function editAsistencia(asis) {
    editingAsistencia = asis;
    newAsistencia = {
      alumnoId: String(asis.alumnoId),
      grupoId: asis.grupoId ? String(asis.grupoId) : '',
      fecha: new Date(asis.fecha).toISOString().split('T')[0],
      estado: asis.estado,
      observaciones: asis.observaciones || '',
      periodo: asis.periodo || 'general'
    };
  }

  async function deleteAsistencia(id) {
    if (!confirm('¿Eliminar este registro de asistencia?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/asistencia/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await loadAsistencia();
        if (alumnoSeleccionadoAsistencia) cargarEstadisticasAlumno();
        if (grupoSeleccionadoAsistencia) cargarEstadisticasGrupo();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error eliminando asistencia');
    }
  }

  async function verEstadisticasAlumno(alumnoId) {
    try {
      const res = await fetch(`${API_URL}/api/admin/asistencia/estadisticas/${alumnoId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        estadisticasAsistencia = await res.json();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function cargarEstadisticasAlumno() {
    if (!alumnoSeleccionadoAsistencia) {
      estadisticasAsistencia = null;
      return;
    }
    await verEstadisticasAlumno(alumnoSeleccionadoAsistencia);
  }

  async function cargarEstadisticasGrupo() {
    if (!grupoSeleccionadoAsistencia) {
      estadisticasGrupo = null;
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/asistencia/estadisticas-grupo/${grupoSeleccionadoAsistencia}`, { headers: getAuthHeaders() });
      if (res.ok) {
        estadisticasGrupo = await res.json();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function cargarTendencias() {
    try {
      const params = new URLSearchParams();
      if (grupoSeleccionadoAsistencia) params.append('grupoId', grupoSeleccionadoAsistencia);
      if (alumnoSeleccionadoAsistencia) params.append('alumnoId', alumnoSeleccionadoAsistencia);
      params.append('meses', '6');
      
      const res = await fetch(`${API_URL}/api/admin/asistencia/tendencias?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        tendenciasAsistencia = await res.json();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  // Notificaciones
  async function loadNotificaciones() {
    try {
      const res = await fetch(`${API_URL}/api/admin/notificaciones', { headers: getAuthHeaders() });
      notificaciones = await res.json();
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }

  async function marcarNotificacionLeida(id) {
    try {
      await fetch(`${API_URL}/api/admin/notificaciones/${id}/leida`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      await loadNotificaciones();
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  }

  // Mensajería
  async function loadMensajes() {
    try {
      const res = await fetch(`${API_URL}/api/admin/mensajes', { headers: getAuthHeaders() });
      mensajes = await res.json();
    } catch (error) {
      console.error('Error cargando mensajes:', error);
    }
  }

  async function loadRespuestasRapidas() {
    try {
      const res = await fetch(`${API_URL}/api/admin/respuestas-rapidas', { headers: getAuthHeaders() });
      respuestasRapidas = await res.json();
    } catch (error) {
      console.error('Error cargando respuestas rápidas:', error);
    }
  }

  let newMensaje = { alumnoId: '', maestroId: '', tipo: 'admin-padre', asunto: '', mensaje: '', respuestaRapidaId: '' };
  let newRespuestaRapida = { titulo: '', contenido: '', categoria: 'general' };
  let editingRespuestaRapida = null;
  let editingPerfilAccesibilidad = null;
  let perfilAccesibilidadEdit = {
    modoAccesible: false,
    textoSimplificado: false,
    lecturaPantalla: false,
    respuestasCortas: false,
    necesidadesEspeciales: []
  };
  let alumnoProgresoSeleccionado = '';
  let newObjetivo = { alumnoId: '', materia: '', meta: '', descripcion: '', fechaLimite: '' };
  let editingObjetivo = null;
  let alumnoAnalisisSeleccionado = '';
  let filtroRiesgo = 'todos';

  async function enviarMensaje() {
    if (!newMensaje.mensaje && !newMensaje.respuestaRapidaId) {
      alert('Debes escribir un mensaje o seleccionar una respuesta rápida');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/api/admin/mensajes', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newMensaje)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error enviando mensaje');
      }
      
      await loadMensajes();
      await loadNotificaciones();
      newMensaje = { alumnoId: '', maestroId: '', tipo: 'admin-padre', asunto: '', mensaje: '', respuestaRapidaId: '' };
      alert('Mensaje enviado exitosamente');
    } catch (error) {
      alert(error.message || 'Error enviando mensaje');
    }
  }

  async function usarRespuestaRapida(id) {
    const respuesta = respuestasRapidas.find(r => String(r._id) === String(id));
    if (respuesta) {
      newMensaje.respuestaRapidaId = String(id);
      newMensaje.mensaje = respuesta.contenido;
      newMensaje.asunto = respuesta.titulo;
    }
  }

  async function saveRespuestaRapida() {
    if (!newRespuestaRapida.titulo || !newRespuestaRapida.contenido) {
      alert('Título y contenido requeridos');
      return;
    }
    
    try {
      const url = editingRespuestaRapida 
        ? `${API_URL}/api/admin/respuestas-rapidas/${editingRespuestaRapida._id}`
        : `${API_URL}/api/admin/respuestas-rapidas`;
      const method = editingRespuestaRapida ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(newRespuestaRapida)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando respuesta rápida');
      }
      
      await loadRespuestasRapidas();
      editingRespuestaRapida = null;
      newRespuestaRapida = { titulo: '', contenido: '', categoria: 'general' };
    } catch (error) {
      alert(error.message || 'Error guardando respuesta rápida');
    }
  }

  function editRespuestaRapida(r) {
    editingRespuestaRapida = r;
    newRespuestaRapida = { ...r };
  }

  async function deleteRespuestaRapida(id) {
    if (!confirm('¿Eliminar esta respuesta rápida?')) return;
    try {
      await fetch(`${API_URL}/api/admin/respuestas-rapidas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadRespuestasRapidas();
    } catch (error) {
      alert('Error eliminando respuesta rápida');
    }
  }

  // Perfiles de accesibilidad
  async function editarPerfilAccesibilidad(alumno) {
    editingPerfilAccesibilidad = alumno;
    try {
      const res = await fetch(`${API_URL}/api/admin/accesibilidad/${alumno._id}`, { 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        const data = await res.json();
        perfilAccesibilidadEdit = data.perfilAccesibilidad || {
          modoAccesible: false,
          textoSimplificado: false,
          lecturaPantalla: false,
          respuestasCortas: false,
          necesidadesEspeciales: []
        };
      } else {
        perfilAccesibilidadEdit = {
          modoAccesible: false,
          textoSimplificado: false,
          lecturaPantalla: false,
          respuestasCortas: false,
          necesidadesEspeciales: []
        };
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      perfilAccesibilidadEdit = {
        modoAccesible: false,
        textoSimplificado: false,
        lecturaPantalla: false,
        respuestasCortas: false,
        necesidadesEspeciales: []
      };
    }
  }

  async function guardarPerfilAccesibilidad() {
    if (!editingPerfilAccesibilidad) return;
    
    try {
      const response = await fetch(`${API_URL}/api/admin/accesibilidad/${editingPerfilAccesibilidad._id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ perfilAccesibilidad: perfilAccesibilidadEdit })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando perfil');
      }
      
      await loadAlumnos();
      editingPerfilAccesibilidad = null;
      alert('Perfil de accesibilidad guardado exitosamente');
    } catch (error) {
      alert(error.message || 'Error guardando perfil de accesibilidad');
    }
  }

  // Progreso académico
  async function cargarProgreso() {
    if (!alumnoProgresoSeleccionado) {
      progresoData = null;
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/admin/progreso/${alumnoProgresoSeleccionado}`, { 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        progresoData = await res.json();
        await loadObjetivos();
        await loadLogros();
      }
    } catch (error) {
      console.error('Error cargando progreso:', error);
    }
  }

  async function loadObjetivos() {
    if (!alumnoProgresoSeleccionado) {
      objetivos = [];
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/objetivos?alumnoId=${alumnoProgresoSeleccionado}`, { 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        objetivos = await res.json();
      }
    } catch (error) {
      console.error('Error cargando objetivos:', error);
    }
  }

  async function loadLogros() {
    if (!alumnoProgresoSeleccionado) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/progreso/${alumnoProgresoSeleccionado}/logros`, { 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        logrosData = await res.json();
      }
    } catch (error) {
      console.error('Error cargando logros:', error);
    }
  }

  async function saveObjetivo() {
    if (!newObjetivo.alumnoId || !newObjetivo.materia || !newObjetivo.meta) {
      alert('Alumno, materia y meta son requeridos');
      return;
    }
    
    try {
      const url = editingObjetivo 
        ? `${API_URL}/api/admin/objetivos/${editingObjetivo._id}`
        : `${API_URL}/api/admin/objetivos`;
      const method = editingObjetivo ? 'PUT' : 'POST';
      
      const data = { ...newObjetivo };
      data.meta = parseFloat(data.meta);
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error guardando objetivo');
      }
      
      await loadObjetivos();
      await cargarProgreso();
      editingObjetivo = null;
      newObjetivo = { alumnoId: '', materia: '', meta: '', descripcion: '', fechaLimite: '' };
    } catch (error) {
      alert(error.message || 'Error guardando objetivo');
    }
  }

  function editObjetivo(obj) {
    editingObjetivo = obj;
    newObjetivo = { 
      ...obj, 
      alumnoId: String(obj.alumnoId),
      fechaLimite: obj.fechaLimite ? new Date(obj.fechaLimite).toISOString().split('T')[0] : ''
    };
  }

  async function deleteObjetivo(id) {
    if (!confirm('¿Eliminar este objetivo?')) return;
    try {
      await fetch(`${API_URL}/api/admin/objetivos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await loadObjetivos();
      await cargarProgreso();
    } catch (error) {
      alert('Error eliminando objetivo');
    }
  }

  function getMateriasUnicas() {
    if (!progresoData) return [];
    return [...new Set(Object.keys(progresoData.evolucionPorMateria || {}))];
  }

  // Análisis predictivo
  async function cargarAnalisisPredictivo() {
    if (!alumnoAnalisisSeleccionado) {
      analisisPredictivo = null;
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/admin/analisis-predictivo/${alumnoAnalisisSeleccionado}`, { 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        analisisPredictivo = await res.json();
      }
    } catch (error) {
      console.error('Error cargando análisis predictivo:', error);
    }
  }

  async function loadAlumnosEnRiesgo() {
    try {
      const url = filtroRiesgo !== 'todos' 
        ? `${API_URL}/api/admin/analisis-predictivo/riesgo?nivelRiesgo=${filtroRiesgo}`
        : `${API_URL}/api/admin/analisis-predictivo/riesgo`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        alumnosEnRiesgo = data.alumnos || [];
      }
    } catch (error) {
      console.error('Error cargando alumnos en riesgo:', error);
    }
  }

  function getColorRiesgo(nivel) {
    if (nivel === 'alto') return '#dc3545';
    if (nivel === 'medio') return '#ffc107';
    return '#28a745';
  }

  function getIconoRiesgo(nivel) {
    if (nivel === 'alto') return '🔴';
    if (nivel === 'medio') return '🟡';
    return '🟢';
  }

  // Encuestas y feedback
  async function loadEncuestas() {
    try {
      const url = filtroEncuestas !== 'todos' 
        ? `${API_URL}/api/admin/encuestas?tipo=${filtroEncuestas}`
        : `${API_URL}/api/admin/encuestas`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        encuestas = await res.json();
      }
    } catch (error) {
      console.error('Error cargando encuestas:', error);
    }
  }

  async function loadEstadisticasEncuestas() {
    try {
      const res = await fetch(`${API_URL}/api/admin/encuestas/estadisticas', { headers: getAuthHeaders() });
      if (res.ok) {
        estadisticasEncuestas = await res.json();
      }
    } catch (error) {
      console.error('Error cargando estadísticas de encuestas:', error);
    }
  }

  async function marcarSugerenciaRevisada(id) {
    try {
      const res = await fetch(`${API_URL}/api/admin/encuestas/${id}/revisada`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await loadEncuestas();
      }
    } catch (error) {
      console.error('Error marcando sugerencia:', error);
    }
  }

  async function guardarFeedbackMaestro() {
    if (!newFeedbackMaestro.maestroId || !newFeedbackMaestro.eficiencia) {
      alert('Maestro y evaluación de eficiencia requeridos');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/encuestas/feedback-maestros', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newFeedbackMaestro)
      });
      
      if (res.ok) {
        alert('Feedback guardado exitosamente');
        newFeedbackMaestro = { maestroId: '', eficiencia: '', tiempoAhorrado: '', casosExitosos: '', comentarios: '' };
        await loadEncuestas();
        await loadEstadisticasEncuestas();
      } else {
        const data = await res.json();
        alert(data.error || 'Error guardando feedback');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error guardando feedback');
    }
  }

  function getTipoEncuestaIcono(tipo) {
    if (tipo === 'satisfaccion') return '⭐';
    if (tipo === 'sugerencia') return '💡';
    if (tipo === 'feedback_maestro') return '👨‍🏫';
    return '📋';
  }

  // Funciones de reportes
  async function generarReporte() {
    try {
      let url = '';
      const params = new URLSearchParams();
      
      if (tipoReporte === 'mensual-uso') {
        url = `${API_URL}/api/admin/reportes/mensual-uso';
        params.append('mes', reporteMes);
        params.append('año', reporteAño);
      } else if (tipoReporte === 'impacto') {
        url = `${API_URL}/api/admin/reportes/impacto';
        params.append('fechaInicio', reporteFechaInicio);
        params.append('fechaFin', reporteFechaFin);
      } else if (tipoReporte === 'academico') {
        url = `${API_URL}/api/admin/reportes/academico';
        if (reportePeriodo) params.append('periodo', reportePeriodo);
      }
      
      const res = await fetch(`${url}?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        datosReporte = await res.json();
      } else {
        alert('Error generando reporte');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error generando reporte');
    }
  }

  function exportarReporte(formato) {
    const params = new URLSearchParams();
    params.append('tipo', tipoReporte);
    
    if (tipoReporte === 'mensual-uso') {
      params.append('mes', reporteMes);
      params.append('año', reporteAño);
    } else if (tipoReporte === 'impacto') {
      params.append('fechaInicio', reporteFechaInicio);
      params.append('fechaFin', reporteFechaFin);
    } else if (tipoReporte === 'academico') {
      if (reportePeriodo) params.append('periodo', reportePeriodo);
    }
    
    const url = formato === 'excel' 
      ? `${API_URL}/api/admin/reportes/exportar/excel?${params.toString()}`
      : formato === 'pdf'
      ? `${API_URL}/api/admin/reportes/exportar/pdf?${params.toString()}`
      : `${API_URL}/api/admin/reportes/datos-analisis?${params.toString()}`;
    
    window.open(url, '_blank');
  }

  // Funciones de tareas
  async function loadTareas() {
    try {
      const res = await fetch(`${API_URL}/api/admin/tareas', { headers: getAuthHeaders() });
      if (res.ok) {
        tareas = await res.json();
      }
    } catch (error) {
      console.error('Error cargando tareas:', error);
    }
  }

  async function saveTarea() {
    try {
      const url = editingTarea 
        ? `${API_URL}/api/admin/tareas/${editingTarea._id}`
        : `${API_URL}/api/admin/tareas`;
      const method = editingTarea ? 'PUT' : 'POST';
      
      const tareaData = {
        ...newTarea,
        alumnos: newTarea.alumnos.filter(a => a).map(a => String(a))
      };
      
      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(tareaData)
      });
      
      if (res.ok) {
        await loadTareas();
        newTarea = { titulo: '', descripcion: '', tipo: 'tarea', grupoId: '', maestroId: '', alumnos: [], fechaLimite: '', puntos: 100, enviarRecordatorio: false };
        editingTarea = null;
        await loadFechasImportantes();
      } else {
        alert('Error guardando tarea');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error guardando tarea');
    }
  }

  function editTarea(tarea) {
    editingTarea = tarea;
    newTarea = {
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || '',
      tipo: tarea.tipo,
      grupoId: tarea.grupoId ? String(tarea.grupoId) : '',
      maestroId: tarea.maestroId ? String(tarea.maestroId) : '',
      alumnos: tarea.alumnos ? tarea.alumnos.map(a => String(a)) : [],
      fechaLimite: new Date(tarea.fechaLimite).toISOString().split('T')[0],
      puntos: tarea.puntos || 100,
      enviarRecordatorio: false
    };
  }

  async function deleteTarea(id) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/tareas/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await loadTareas();
        await loadFechasImportantes();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error eliminando tarea');
    }
  }

  async function verTarea(tarea) {
    try {
      const res = await fetch(`${API_URL}/api/admin/tareas/${tarea._id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        tareaSeleccionada = await res.json();
      } else {
        tareaSeleccionada = tarea; // Usar la tarea original si falla
      }
    } catch (error) {
      console.error('Error:', error);
      tareaSeleccionada = tarea; // Usar la tarea original si falla
    }
  }

  async function entregarTarea(tareaId, alumnoId) {
    try {
      const res = await fetch(`${API_URL}/api/tareas/${tareaId}/entregar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          alumnoId,
          archivo: entregaTarea.archivo,
          comentarios: entregaTarea.comentarios
        })
      });
      
      if (res.ok) {
        await loadTareas();
        entregaTarea = { archivo: '', comentarios: '' };
        if (tareaSeleccionada) {
          const updated = await fetch(`${API_URL}/api/admin/tareas/${tareaId}`, { headers: getAuthHeaders() });
          if (updated.ok) {
            tareaSeleccionada = await updated.json();
          }
        }
      } else {
        alert('Error entregando tarea');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error entregando tarea');
    }
  }

  async function calificarTarea(tareaId, alumnoId) {
    try {
      const res = await fetch(`${API_URL}/api/admin/tareas/${tareaId}/calificar`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          alumnoId,
          calificacion: parseFloat(calificacionTarea.calificacion),
          comentarios: calificacionTarea.comentarios
        })
      });
      
      if (res.ok) {
        await loadTareas();
        calificacionTarea = { calificacion: '', comentarios: '' };
        if (tareaSeleccionada) {
          const updated = await fetch(`${API_URL}/api/admin/tareas/${tareaId}`, { headers: getAuthHeaders() });
          if (updated.ok) {
            tareaSeleccionada = await updated.json();
          }
        }
      } else {
        alert('Error calificando tarea');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error calificando tarea');
    }
  }

  async function loadCalendarioAcademico() {
    try {
      const mes = new Date().getMonth() + 1;
      const año = new Date().getFullYear();
      const res = await fetch(`${API_URL}/api/admin/calendario-academico?mes=${mes}&año=${año}`, { headers: getAuthHeaders() });
      if (res.ok) {
        calendarioAcademico = await res.json();
      }
    } catch (error) {
      console.error('Error cargando calendario:', error);
    }
  }

  async function loadFechasImportantes() {
    try {
      const res = await fetch(`${API_URL}/api/admin/fechas-importantes?dias=30', { headers: getAuthHeaders() });
      if (res.ok) {
        fechasImportantes = await res.json();
      }
    } catch (error) {
      console.error('Error cargando fechas importantes:', error);
    }
  }

  // Funciones de recursos
  async function loadRecursos() {
    try {
      const params = new URLSearchParams();
      if (materiaSeleccionadaRecursos) params.append('materia', materiaSeleccionadaRecursos);
      if (busquedaRecursos) params.append('busqueda', busquedaRecursos);
      
      const res = await fetch(`${API_URL}/api/admin/recursos?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        recursos = await res.json();
      }
    } catch (error) {
      console.error('Error cargando recursos:', error);
    }
  }

  async function saveRecurso() {
    try {
      const formData = new FormData();
      formData.append('titulo', newRecurso.titulo);
      formData.append('descripcion', newRecurso.descripcion || '');
      formData.append('tipo', newRecurso.tipo);
      formData.append('materia', newRecurso.materia || '');
      formData.append('url', newRecurso.url || '');
      formData.append('maestroId', newRecurso.maestroId || '');
      formData.append('learningDifferences', newRecurso.learningDifferences);
      formData.append('tags', newRecurso.tags || '');
      
      const fileInput = document.querySelector('#archivo-recurso');
      if (fileInput && fileInput.files[0]) {
        formData.append('archivo', fileInput.files[0]);
      }
      
      const url = editingRecurso 
        ? `${API_URL}/api/admin/recursos/${editingRecurso._id}`
        : `${API_URL}/api/admin/recursos`;
      const method = editingRecurso ? 'PUT' : 'POST';
      
      const headers = getAuthHeaders();
      delete headers['Content-Type']; // Dejar que el navegador establezca el Content-Type para FormData
      
      const res = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? formData : JSON.stringify(newRecurso)
      });
      
      if (res.ok) {
        await loadRecursos();
        newRecurso = { titulo: '', descripcion: '', tipo: 'documento', materia: '', url: '', maestroId: '', learningDifferences: false, tags: '' };
        editingRecurso = null;
        if (fileInput) fileInput.value = '';
      } else {
        alert('Error guardando recurso');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error guardando recurso');
    }
  }

  function editRecurso(recurso) {
    editingRecurso = recurso;
    newRecurso = {
      titulo: recurso.titulo,
      descripcion: recurso.descripcion || '',
      tipo: recurso.tipo,
      materia: recurso.materia || '',
      url: recurso.url || '',
      maestroId: recurso.maestroId ? String(recurso.maestroId) : '',
      learningDifferences: recurso.learningDifferences || false,
      tags: Array.isArray(recurso.tags) ? recurso.tags.join(', ') : (recurso.tags || '')
    };
  }

  async function deleteRecurso(id) {
    if (!confirm('¿Eliminar este recurso?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/recursos/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await loadRecursos();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error eliminando recurso');
    }
  }

  async function verRecurso(recurso) {
    try {
      const res = await fetch(`${API_URL}/api/admin/recursos/${recurso._id}/url`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
          // Registrar visualización
          await fetch(`${API_URL}/api/recursos/${recurso._id}/registrar-uso`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ accion: 'visualizacion' })
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function descargarRecurso(recurso) {
    try {
      const res = await fetch(`${API_URL}/api/admin/recursos/${recurso._id}/url`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.open(data.url, '_blank');
          // Registrar descarga
          await fetch(`${API_URL}/api/recursos/${recurso._id}/registrar-uso`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ accion: 'descarga' })
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function cargarRecomendacionesRecursos() {
    try {
      const params = new URLSearchParams();
      if (materiaSeleccionadaRecursos) params.append('materia', materiaSeleccionadaRecursos);
      
      const res = await fetch(`${API_URL}/api/recursos/recomendaciones?${params.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        recomendacionesRecursos = await res.json();
      }
    } catch (error) {
      console.error('Error cargando recomendaciones:', error);
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
      {#if isSuperAdmin && escuelas.length > 0}
        <select bind:value={escuelaId} on:change={() => { localStorage.setItem('escuelaId', escuelaId); loadData(); }} class="escuela-selector">
          {#each escuelas as escuela}
            <option value={String(escuela._id)}>{escuela.nombre} ({escuela.codigo})</option>
          {/each}
        </select>
      {/if}
      <button on:click={logout} class="logout-btn">Salir</button>
    </header>

    <div class="admin-layout">
      <aside class="sidebar">
        <nav class="sidebar-nav">
          <button
            class:active={activeTab === 'dashboard'}
            on:click={() => activeTab = 'dashboard'}
          >
            📊 Dashboard
          </button>
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
          <button
            class:active={activeTab === 'maestros'}
            on:click={() => activeTab = 'maestros'}
          >
            👨‍🏫 Maestros
          </button>
          <button
            class:active={activeTab === 'alumnos'}
            on:click={() => activeTab = 'alumnos'}
          >
            👨‍🎓 Alumnos
          </button>
          <button
            class:active={activeTab === 'espacios'}
            on:click={() => activeTab = 'espacios'}
          >
            🏫 Espacios
          </button>
          <button
            class:active={activeTab === 'grupos'}
            on:click={() => activeTab = 'grupos'}
          >
            👥 Grupos
          </button>
          <button
            class:active={activeTab === 'calificaciones'}
            on:click={() => activeTab = 'calificaciones'}
          >
            📊 Calificaciones
          </button>
          <button
            class:active={activeTab === 'asistencia'}
            on:click={() => { activeTab = 'asistencia'; loadAsistencia(); loadAlertasAusentismo(); }}
          >
            ✅ Asistencia
          </button>
          <button
            class:active={activeTab === 'mensajeria'}
            on:click={() => activeTab = 'mensajeria'}
          >
            💬 Mensajería
          </button>
          <button
            class:active={activeTab === 'progreso'}
            on:click={() => activeTab = 'progreso'}
          >
            📈 Progreso Académico
          </button>
          <button
            class:active={activeTab === 'analisis'}
            on:click={() => activeTab = 'analisis'}
          >
            🤖 Análisis Predictivo
          </button>
          <button
            class:active={activeTab === 'encuestas'}
            on:click={() => activeTab = 'encuestas'}
          >
            📋 Encuestas y Feedback
          </button>
          <button
            class:active={activeTab === 'reportes'}
            on:click={() => activeTab = 'reportes'}
          >
            📄 Reportes
          </button>
          <button
            class:active={activeTab === 'tareas'}
            on:click={() => { activeTab = 'tareas'; loadTareas(); loadCalendarioAcademico(); loadFechasImportantes(); }}
          >
            📝 Tareas y Actividades
          </button>
        </nav>
      </aside>

      <main class="main-content">
        {#if activeTab === 'dashboard'}
          <div class="stats-overview">
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
            <div class="stat-card">
              <div class="stat-value">{stats.maestros}</div>
              <div class="stat-label">Maestros</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.alumnos}</div>
              <div class="stat-label">Alumnos</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">{stats.grupos}</div>
              <div class="stat-label">Grupos</div>
            </div>
          </div>
        {/if}

    <div class="content">
      {#if activeTab === 'dashboard'}
        <div class="section">
          <h2>📊 Resumen General</h2>
          <div class="dashboard-grid">
            <div class="dashboard-card">
              <h3>👨‍🏫 Maestros</h3>
              <div class="dashboard-value">{stats.maestros}</div>
              <p>Maestros activos en el sistema</p>
            </div>
            <div class="dashboard-card">
              <h3>👨‍🎓 Alumnos</h3>
              <div class="dashboard-value">{stats.alumnos}</div>
              <p>Alumnos registrados</p>
            </div>
            <div class="dashboard-card">
              <h3>👥 Grupos</h3>
              <div class="dashboard-value">{stats.grupos}</div>
              <p>Grupos activos</p>
            </div>
            <div class="dashboard-card">
              <h3>📋 Citas</h3>
              <div class="dashboard-value">{stats.citas}</div>
              <p>Total de citas agendadas</p>
              <small class="pending-badge">{stats.citasPendientes} pendientes</small>
            </div>
            <div class="dashboard-card">
              <h3>💬 Conversaciones</h3>
              <div class="dashboard-value">{stats.conversations}</div>
              <p>Interacciones con el chatbot</p>
            </div>
            <div class="dashboard-card">
              <h3>📊 Calificaciones</h3>
              <div class="dashboard-value">{calificaciones.length}</div>
              <p>Calificaciones registradas</p>
              {#if alertas.length > 0}
                <small class="pending-badge">{alertas.length} alertas</small>
              {/if}
            </div>
            <div class="dashboard-card">
              <h3>📅 Próximos Eventos</h3>
              <div class="dashboard-value">{eventos.filter(e => {
                try {
                  const fechaEvento = new Date(e.fecha);
                  return fechaEvento && !isNaN(fechaEvento.getTime()) && fechaEvento >= new Date();
                } catch {
                  return false;
                }
              }).length}</div>
              <p>Eventos programados</p>
            </div>
            <div class="dashboard-card">
              <h3>🏫 Espacios</h3>
              <div class="dashboard-value">{espacios.filter(e => e.activo !== false).length}</div>
              <p>Espacios disponibles</p>
            </div>
          </div>
          
          <div class="dashboard-impact">
            <h2>📊 Métricas de Impacto</h2>
            <div class="impact-grid">
              <div class="impact-card">
                <h3>⏱️ Tiempo Ahorrado</h3>
                <div class="impact-value">{stats.impacto?.tiempoAhorradoHoras || 0} horas</div>
                <p>Estimado a maestros</p>
              </div>
              <div class="impact-card">
                <h3>✅ Tasa de Resolución</h3>
                <div class="impact-value">{stats.impacto?.tasaResolucion || 0}%</div>
                <p>Consultas resueltas sin cita</p>
              </div>
              <div class="impact-card">
                <h3>⚡ Tiempo de Respuesta</h3>
                <div class="impact-value">
                  {#if stats.impacto?.tiempoPromedioRespuesta}
                    {@const segundos = Math.round(stats.impacto.tiempoPromedioRespuesta / 1000 * 10) / 10}
                    {segundos < 1 ? `${stats.impacto.tiempoPromedioRespuesta}ms` : `${segundos}s`}
                  {:else}
                    0ms
                  {/if}
                </div>
                <p>Promedio del chatbot</p>
              </div>
              <div class="impact-card">
                <h3>💬 Consultas Resueltas</h3>
                <div class="impact-value">{stats.impacto?.conversacionesResueltas || 0}</div>
                <p>Sin necesidad de cita</p>
              </div>
              <div class="impact-card">
                <h3>📉 Reducción Citas</h3>
                <div class="impact-value">{stats.impacto?.reduccionCitas || 0}%</div>
                <p>Consultas resueltas vs citas agendadas</p>
              </div>
            </div>
            
            {#if stats.impacto?.temasMasConsultados && stats.impacto.temasMasConsultados.length > 0}
              <div class="temas-section">
                <h3>🔍 Temas Más Consultados</h3>
                <div class="temas-list">
                  {#each stats.impacto.temasMasConsultados as tema}
                    <div class="tema-item">
                      <span class="tema-nombre">{tema.tema}</span>
                      <span class="tema-count">{tema.count} consultas</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          
          <div class="dashboard-recent">
            <h3>📋 Citas Recientes</h3>
            <div class="list">
              {#each citas.slice(0, 5).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) as c}
                {@const maestro = c.maestroId ? maestros.find(m => String(m._id) === String(c.maestroId)) : null}
                {@const alumno = c.alumnoId ? alumnos.find(a => String(a._id) === String(c.alumnoId)) : null}
                <div class="item cita-item">
                  <div>
                    <strong>{c.nombre}</strong>
                    <p>{c.motivo}</p>
                    <small>📅 {new Date(c.fecha).toLocaleString('es-ES')} | {c.tipo}</small>
                    {#if maestro}
                      <small>👨‍🏫 Maestro: {maestro.nombre}</small>
                    {/if}
                    {#if alumno}
                      <small>👨‍🎓 Alumno: {alumno.nombre}</small>
                    {/if}
                    <span class={`badge badge-${c.estado}`}>{c.estado}</span>
                  </div>
                </div>
              {/each}
              {#if citas.length === 0}
                <p class="empty-state">No hay citas registradas</p>
              {/if}
            </div>
          </div>
          
          <div class="dashboard-recent">
            <h3>📊 Resumen de Grupos</h3>
            <div class="list">
              {#each grupos.filter(g => g.activo !== false).slice(0, 5) as g}
                {@const maestroIdStr = g.maestroId ? String(g.maestroId) : ''}
                {@const maestro = maestroIdStr ? maestros.find(m => String(m._id) === maestroIdStr) : null}
                <div class="item">
                  <div>
                    <strong>{g.nombre}</strong>
                    <p>{g.nivel || 'Sin nivel'}</p>
                    {#if maestro}
                      <small>👨‍🏫 {maestro.nombre}</small>
                    {/if}
                    <small>👥 {g.alumnos?.length || 0} alumnos</small>
                  </div>
                </div>
              {/each}
              {#if grupos.filter(g => g.activo !== false).length === 0}
                <p class="empty-state">No hay grupos registrados</p>
              {/if}
            </div>
          </div>
        </div>
      {/if}

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
            <label>
              <input type="checkbox" bind:checked={newEvento.enviarRecordatorio} />
              Enviar recordatorio automático a padres
            </label>
            <button type="submit">{editingEvento ? 'Actualizar' : 'Agregar'}</button>
            {#if editingEvento}
              <button type="button" on:click={() => { editingEvento = null; newEvento = { titulo: '', descripcion: '', fecha: '', enviarRecordatorio: false }; }}>Cancelar</button>
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
          <div class="search-box">
            <input 
              type="text" 
              bind:value={searchCitas} 
              placeholder="🔍 Buscar citas..." 
              class="search-input"
            />
          </div>
          <div class="list">
            {#each citas.filter(c => 
              !searchCitas || 
              c.nombre.toLowerCase().includes(searchCitas.toLowerCase()) ||
              c.motivo.toLowerCase().includes(searchCitas.toLowerCase()) ||
              (c.email && c.email.toLowerCase().includes(searchCitas.toLowerCase()))
            ) as c}
              {@const maestro = c.maestroId ? maestros.find(m => String(m._id) === String(c.maestroId)) : null}
              {@const alumno = c.alumnoId ? alumnos.find(a => String(a._id) === String(c.alumnoId)) : null}
              <div class="item cita-item">
                <div>
                  <strong>{c.nombre}</strong>
                  <p>{c.motivo}</p>
                  <small>📧 {c.email} | 📞 {c.telefono || 'N/A'}</small>
                  <small>📅 {new Date(c.fecha).toLocaleString('es-ES')} | Tipo: {c.tipo}</small>
                  {#if maestro}
                    <small>👨‍🏫 Maestro: {maestro.nombre} {maestro.especialidad ? `(${maestro.especialidad})` : ''}</small>
                  {/if}
                  {#if alumno}
                    <small>👨‍🎓 Alumno: {alumno.nombre}</small>
                  {/if}
                  {#if c.notas}
                    <small>📝 Notas: {c.notas}</small>
                  {/if}
                  <span class={`badge badge-${c.estado}`}>{c.estado}</span>
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

      {#if activeTab === 'maestros'}
        <div class="section">
          <h2>Gestionar Maestros</h2>
          <div class="search-box">
            <input 
              type="text" 
              bind:value={searchMaestros} 
              placeholder="🔍 Buscar maestros..." 
              class="search-input"
            />
          </div>
          <form on:submit|preventDefault={saveMaestro} class="form">
            <input bind:value={newMaestro.nombre} placeholder="Nombre completo" required />
            <input bind:value={newMaestro.email} type="email" placeholder="Email" />
            <input bind:value={newMaestro.telefono} placeholder="Teléfono" />
            <input bind:value={newMaestro.especialidad} placeholder="Especialidad" />
            <input bind:value={newMaestro.horariosDisponibles} placeholder="Horarios disponibles" />
            <button type="submit">{editingMaestro ? 'Actualizar' : 'Agregar'}</button>
            {#if editingMaestro}
              <button type="button" on:click={() => { editingMaestro = null; newMaestro = { nombre: '', email: '', telefono: '', especialidad: '', horariosDisponibles: '' }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each maestros.filter(m => 
              !searchMaestros || 
              m.nombre.toLowerCase().includes(searchMaestros.toLowerCase()) ||
              (m.especialidad && m.especialidad.toLowerCase().includes(searchMaestros.toLowerCase())) ||
              (m.email && m.email.toLowerCase().includes(searchMaestros.toLowerCase()))
            ) as m}
              {@const gruposDelMaestro = grupos.filter(g => g.maestroId && String(g.maestroId) === String(m._id))}
              <div class="item">
                <div>
                  <strong>{m.nombre}</strong>
                  <p>{m.especialidad || 'Sin especialidad'}</p>
                  <small>📧 {m.email || 'N/A'} | 📞 {m.telefono || 'N/A'}</small>
                  {#if m.horariosDisponibles}
                    <small>🕐 {m.horariosDisponibles}</small>
                  {/if}
                  {#if gruposDelMaestro.length > 0}
                    <small>👥 Grupos: {gruposDelMaestro.map(g => g.nombre).join(', ')}</small>
                  {/if}
                </div>
                <div class="actions">
                  <button on:click={() => editMaestro(m)}>✏️</button>
                  <button on:click={() => deleteMaestro(m._id)}>🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'alumnos'}
        <div class="section">
          <h2>Gestionar Alumnos</h2>
          <div class="search-box">
            <input 
              type="text" 
              bind:value={searchAlumnos} 
              placeholder="🔍 Buscar alumnos..." 
              class="search-input"
            />
          </div>
          <form on:submit|preventDefault={saveAlumno} class="form">
            <input bind:value={newAlumno.nombre} placeholder="Nombre completo" required />
            <input bind:value={newAlumno.email} type="email" placeholder="Email" />
            <input bind:value={newAlumno.telefono} placeholder="Teléfono" />
            <select bind:value={newAlumno.grupoId}>
              <option value="">Sin grupo</option>
              {#each grupos.filter(g => g.activo !== false) as g}
                <option value={String(g._id)}>{g.nombre}</option>
              {/each}
            </select>
            <div class="padres-section">
              <label>Padres (formato: nombre|email|password, uno por línea):</label>
              <textarea 
                bind:value={newAlumno.padresTexto} 
                placeholder="Ejemplo:&#10;Juan Pérez|juan@email.com|contraseña123&#10;María García|maria@email.com|contraseña456"
                rows="3"
                on:input={(e) => {
                  const texto = e.target.value;
                  if (texto.trim()) {
                    newAlumno.padres = texto.split('\n').map(line => {
                      const [nombre, email, password] = line.split('|').map(s => s.trim());
                      if (nombre && email && password) {
                        return { nombre, email, password };
                      }
                      return null;
                    }).filter(p => p !== null);
                  } else {
                    newAlumno.padres = [];
                  }
                }}
              ></textarea>
              <small>Formato: nombre|email|contraseña (uno por línea)</small>
            </div>
            <button type="submit">{editingAlumno ? 'Actualizar' : 'Agregar'}</button>
            {#if editingAlumno}
              <button type="button" on:click={() => { editingAlumno = null; newAlumno = { nombre: '', email: '', telefono: '', grupoId: '', padres: [], padresTexto: '' }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each alumnos.filter(a => 
              !searchAlumnos || 
              a.nombre.toLowerCase().includes(searchAlumnos.toLowerCase()) ||
              (a.email && a.email.toLowerCase().includes(searchAlumnos.toLowerCase()))
            ) as a}
              <div class="item">
                <div>
                  <strong>{a.nombre}</strong>
                  <p>📧 {a.email || 'N/A'} | 📞 {a.telefono || 'N/A'}</p>
                  {#if a.grupoId}
                    {@const grupoIdStr = String(a.grupoId)}
                    {@const grupo = grupos.find(g => String(g._id) === grupoIdStr)}
                    {#if grupo}
                      <small>👥 Grupo: {grupo.nombre} {grupo.nivel ? `(${grupo.nivel})` : ''}</small>
                    {:else}
                      <small>👥 Grupo: No encontrado</small>
                    {/if}
                  {:else}
                    <small>👥 Grupo: Sin asignar</small>
                  {/if}
                </div>
                <div class="actions">
                  <button on:click={() => editarPerfilAccesibilidad(a)} title="Editar perfil de accesibilidad">♿</button>
                  <button on:click={() => editAlumno(a)}>✏️</button>
                  <button on:click={() => deleteAlumno(a._id)}>🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'espacios'}
        <div class="section">
          <h2>Gestionar Espacios (Salones/Laboratorios)</h2>
          <div class="search-box">
            <input 
              type="text" 
              bind:value={searchEspacios} 
              placeholder="🔍 Buscar espacios..." 
              class="search-input"
            />
          </div>
          <form on:submit|preventDefault={saveEspacio} class="form">
            <input bind:value={newEspacio.nombre} placeholder="Nombre del espacio" required />
            <select bind:value={newEspacio.tipo} required>
              <option value="salon">Salón</option>
              <option value="laboratorio">Laboratorio</option>
            </select>
            <input type="number" bind:value={newEspacio.capacidad} placeholder="Capacidad" />
            <input bind:value={newEspacio.equipamiento} placeholder="Equipamiento" />
            <button type="submit">{editingEspacio ? 'Actualizar' : 'Agregar'}</button>
            {#if editingEspacio}
              <button type="button" on:click={() => { editingEspacio = null; newEspacio = { nombre: '', tipo: 'salon', capacidad: 0, equipamiento: '' }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each espacios.filter(e => 
              !searchEspacios || 
              e.nombre.toLowerCase().includes(searchEspacios.toLowerCase()) ||
              e.tipo.toLowerCase().includes(searchEspacios.toLowerCase())
            ) as e}
              {@const gruposEnEspacio = grupos.filter(g => g.espacioId && String(g.espacioId) === String(e._id))}
              <div class="item">
                <div>
                  <strong>{e.nombre}</strong>
                  <p>{e.tipo === 'salon' ? '🏫 Salón' : '🔬 Laboratorio'}</p>
                  <small>👥 Capacidad: {e.capacidad || 'N/A'}</small>
                  {#if e.equipamiento}
                    <small>⚙️ {e.equipamiento}</small>
                  {/if}
                  {#if gruposEnEspacio.length > 0}
                    <small>👥 Grupos: {gruposEnEspacio.map(g => g.nombre).join(', ')}</small>
                  {/if}
                </div>
                <div class="actions">
                  <button on:click={() => editEspacio(e)}>✏️</button>
                  <button on:click={() => deleteEspacio(e._id)}>🗑️</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'grupos'}
        <div class="section">
          <h2>Gestionar Grupos</h2>
          <div class="search-box">
            <input 
              type="text" 
              bind:value={searchGrupos} 
              placeholder="🔍 Buscar grupos..." 
              class="search-input"
            />
          </div>
          <form on:submit|preventDefault={saveGrupo} class="form">
            <input bind:value={newGrupo.nombre} placeholder="Nombre del grupo" required />
            <input bind:value={newGrupo.nivel} placeholder="Nivel" />
            <select bind:value={newGrupo.maestroId}>
              <option value="">Sin maestro</option>
              {#each maestros.filter(m => m.activo !== false) as m}
                <option value={String(m._id)}>{m.nombre}</option>
              {/each}
            </select>
            <select bind:value={newGrupo.espacioId}>
              <option value="">Sin espacio</option>
              {#each espacios.filter(e => e.activo !== false) as e}
                <option value={String(e._id)}>{e.nombre} ({e.tipo})</option>
              {/each}
            </select>
            <input bind:value={newGrupo.horario} placeholder="Horario" />
            <button type="submit">{editingGrupo ? 'Actualizar' : 'Agregar'}</button>
            {#if editingGrupo}
              <button type="button" on:click={() => { editingGrupo = null; newGrupo = { nombre: '', nivel: '', maestroId: '', espacioId: '', horario: '', alumnos: [] }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each grupos.filter(g => 
              !searchGrupos || 
              g.nombre.toLowerCase().includes(searchGrupos.toLowerCase()) ||
              (g.nivel && g.nivel.toLowerCase().includes(searchGrupos.toLowerCase()))
            ) as g}
              {@const maestroIdStr = g.maestroId ? String(g.maestroId) : ''}
              {@const espacioIdStr = g.espacioId ? String(g.espacioId) : ''}
              {@const maestro = maestroIdStr ? maestros.find(m => String(m._id) === maestroIdStr) : null}
              {@const espacio = espacioIdStr ? espacios.find(e => String(e._id) === espacioIdStr) : null}
              <div class="item grupo-item">
                <div class="grupo-header">
                  <div>
                    <strong>{g.nombre}</strong>
                    <p>{g.nivel || 'Sin nivel'}</p>
                    {#if maestro}
                      <small>👨‍🏫 Maestro: {maestro.nombre} {maestro.especialidad ? `(${maestro.especialidad})` : ''}</small>
                    {:else}
                      <small>👨‍🏫 Maestro: Sin asignar</small>
                    {/if}
                    {#if espacio}
                      <small>🏫 Espacio: {espacio.nombre} ({espacio.tipo})</small>
                    {:else}
                      <small>🏫 Espacio: Sin asignar</small>
                    {/if}
                    {#if g.horario}
                      <small>🕐 Horario: {g.horario}</small>
                    {/if}
                    <small>👥 Alumnos: {g.alumnos?.length || 0}</small>
                  </div>
                  <div class="actions">
                    <button on:click={() => editGrupo(g)}>✏️</button>
                    <button on:click={() => deleteGrupo(g._id)}>🗑️</button>
                  </div>
                </div>
                {#if g.alumnos && g.alumnos.length > 0}
                  <div class="grupo-alumnos">
                    <strong>Alumnos del grupo:</strong>
                    <div class="alumnos-list">
                      {#each g.alumnos as alumnoId}
                        {@const alumno = alumnos.find(a => String(a._id) === String(alumnoId))}
                        {#if alumno}
                          <span class="alumno-tag">{alumno.nombre}</span>
                        {:else}
                          <span class="alumno-tag">ID: {String(alumnoId).slice(0, 8)}...</span>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div class="grupo-alumnos">
                    <small class="empty-state">No hay alumnos asignados a este grupo</small>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'calificaciones'}
        <div class="section">
          <h2>Gestionar Calificaciones</h2>
          
          {#if notificaciones.length > 0}
            <div class="notificaciones-box">
              <h3>🔔 Notificaciones Automáticas</h3>
              <div class="notificaciones-list">
                {#each notificaciones as notif}
                  <div class="notificacion-item">
                    <div>
                      <strong>{notif.titulo}</strong>
                      <p>{notif.mensaje}</p>
                      <small>📅 {new Date(notif.timestamp).toLocaleString('es-ES')}</small>
                    </div>
                    <button on:click={() => marcarNotificacionLeida(notif._id)}>✓ Marcar como leída</button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          
          {#if alertas.length > 0}
            <div class="alertas-box">
              <h3>⚠️ Alertas de Bajo Rendimiento</h3>
              <div class="alertas-list">
                {#each alertas as alerta}
                  {@const grupo = grupos.find(g => String(g._id) === String(alerta.grupoId))}
                  <div class="alerta-item">
                    <strong>{alerta.alumnoNombre}</strong>
                    <span class="alerta-promedio">Promedio: {alerta.promedio}/100</span>
                    {#if grupo}
                      <small>Grupo: {grupo.nombre}</small>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          
          {#if alertasAusentismo.length > 0}
            <div class="alertas-box" style="background: #f8d7da; border-color: #dc3545;">
              <h3>🚨 Alertas de Ausentismo</h3>
              <div class="alertas-list">
                {#each alertasAusentismo as alerta}
                  {@const grupo = grupos.find(g => String(g._id) === String(alerta.grupoId))}
                  <div class="alerta-item">
                    <strong>{alerta.alumnoNombre}</strong>
                    <span class="alerta-promedio">Asistencia: {alerta.porcentajeAsistencia}%</span>
                    <small>Ausencias: {alerta.ausencias}</small>
                    {#if grupo}
                      <small>Grupo: {grupo.nombre}</small>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          
          <form on:submit|preventDefault={saveCalificacion} class="form">
            <select bind:value={newCalificacion.alumnoId} required>
              <option value="">Selecciona un alumno</option>
              {#each alumnos.filter(a => a.activo !== false) as a}
                <option value={String(a._id)}>{a.nombre}</option>
              {/each}
            </select>
            <select bind:value={newCalificacion.grupoId}>
              <option value="">Sin grupo (opcional)</option>
              {#each grupos.filter(g => g.activo !== false) as g}
                <option value={String(g._id)}>{g.nombre}</option>
              {/each}
            </select>
            <input bind:value={newCalificacion.materia} placeholder="Materia" required />
            <input 
              type="number" 
              bind:value={newCalificacion.calificacion} 
              placeholder="Calificación (0-100)" 
              min="0" 
              max="100" 
              step="0.1"
              required 
            />
            <input bind:value={newCalificacion.periodo} placeholder="Periodo (ej: Q1, Q2, Anual)" />
            <input type="date" bind:value={newCalificacion.fecha} />
            <textarea bind:value={newCalificacion.observaciones} placeholder="Observaciones (opcional)"></textarea>
            <button type="submit">{editingCalificacion ? 'Actualizar' : 'Agregar'}</button>
            {#if editingCalificacion}
              <button type="button" on:click={() => { editingCalificacion = null; newCalificacion = { alumnoId: '', grupoId: '', materia: '', calificacion: '', periodo: 'general', fecha: '', observaciones: '' }; }}>Cancelar</button>
            {/if}
          </form>
          <div class="list">
            {#each calificaciones as cal}
              {@const alumno = alumnos.find(a => String(a._id) === String(cal.alumnoId))}
              {@const grupo = cal.grupoId ? grupos.find(g => String(g._id) === String(cal.grupoId)) : null}
              <div class="item">
                <div>
                  <strong>{alumno ? alumno.nombre : 'Alumno no encontrado'}</strong>
                  <p>{cal.materia} - {cal.calificacion}/100</p>
                  <small>📅 {new Date(cal.fecha).toLocaleDateString('es-ES')} | Periodo: {cal.periodo}</small>
                  {#if grupo}
                    <small>👥 Grupo: {grupo.nombre}</small>
                  {/if}
                  {#if cal.observaciones}
                    <small>📝 {cal.observaciones}</small>
                  {/if}
                  {#if cal.calificacion < 70}
                    <span class="badge badge-bajo">Bajo rendimiento</span>
                  {:else if cal.calificacion >= 90}
                    <span class="badge badge-excelente">Excelente</span>
                  {/if}
                </div>
                <div class="actions">
                  <button on:click={() => verPromedios(cal.alumnoId)} title="Ver promedios">📈</button>
                  <button on:click={() => verHistorialAcademico(cal.alumnoId)} title="Ver historial">📚</button>
                  <button on:click={() => verRecomendaciones(cal.alumnoId)} title="Ver recomendaciones">💡</button>
                  <button on:click={() => editCalificacion(cal)}>✏️</button>
                  <button on:click={() => deleteCalificacion(cal._id)}>🗑️</button>
                </div>
              </div>
            {/each}
            {#if calificaciones.length === 0}
              <p class="empty-state">No hay calificaciones registradas</p>
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === 'asistencia'}
        <div class="section">
          <h2>✅ Control de Asistencia</h2>
          
          <div class="asistencia-controls">
            <div class="control-group">
              <label>Filtrar por grupo:</label>
              <select bind:value={grupoSeleccionadoAsistencia} on:change={() => { loadAsistencia(); cargarEstadisticasGrupo(); }}>
                <option value="">Todos los grupos</option>
                {#each grupos.filter(g => g.activo !== false) as g}
                  <option value={String(g._id)}>{g.nombre}</option>
                {/each}
              </select>
            </div>
            <div class="control-group">
              <label>Filtrar por alumno:</label>
              <select bind:value={alumnoSeleccionadoAsistencia} on:change={() => { loadAsistencia(); cargarEstadisticasAlumno(); }}>
                <option value="">Todos los alumnos</option>
                {#each alumnos.filter(a => a.activo !== false) as a}
                  <option value={String(a._id)}>{a.nombre}</option>
                {/each}
              </select>
            </div>
            <button on:click={cargarTendencias} class="btn-secondary">📈 Ver Tendencias</button>
          </div>

          <form on:submit|preventDefault={saveAsistencia} class="form">
            <h3>{editingAsistencia ? 'Editar' : 'Nuevo'} Registro de Asistencia</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Alumno *</label>
                <select bind:value={newAsistencia.alumnoId} required>
                  <option value="">Seleccionar alumno</option>
                  {#each alumnos.filter(a => a.activo !== false) as a}
                    <option value={String(a._id)}>{a.nombre}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label>Grupo</label>
                <select bind:value={newAsistencia.grupoId}>
                  <option value="">Sin grupo</option>
                  {#each grupos.filter(g => g.activo !== false) as g}
                    <option value={String(g._id)}>{g.nombre}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Fecha *</label>
                <input type="date" bind:value={newAsistencia.fecha} required />
              </div>
              <div class="form-group">
                <label>Estado *</label>
                <select bind:value={newAsistencia.estado} required>
                  <option value="presente">✅ Presente</option>
                  <option value="ausente">❌ Ausente</option>
                  <option value="tardanza">⏰ Tardanza</option>
                  <option value="justificado">📝 Justificado</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Período</label>
                <input type="text" bind:value={newAsistencia.periodo} placeholder="general" />
              </div>
              <div class="form-group">
                <label>Observaciones</label>
                <input type="text" bind:value={newAsistencia.observaciones} />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit">{editingAsistencia ? 'Actualizar' : 'Registrar'}</button>
              {#if editingAsistencia}
                <button type="button" on:click={() => { editingAsistencia = null; newAsistencia = { alumnoId: '', grupoId: '', fecha: '', estado: 'presente', observaciones: '', periodo: 'general' }; }}>Cancelar</button>
              {/if}
            </div>
          </form>

          {#if estadisticasAsistencia}
            <div class="estadisticas-box">
              <h3>📊 Estadísticas del Alumno</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <strong>Porcentaje de Asistencia:</strong>
                  <span class="stat-value">{estadisticasAsistencia.porcentajeAsistencia}%</span>
                </div>
                <div class="stat-item">
                  <strong>Total Registros:</strong>
                  <span>{estadisticasAsistencia.estadisticas.total}</span>
                </div>
                <div class="stat-item">
                  <strong>Presentes:</strong>
                  <span>{estadisticasAsistencia.estadisticas.presente}</span>
                </div>
                <div class="stat-item">
                  <strong>Ausentes:</strong>
                  <span>{estadisticasAsistencia.estadisticas.ausente}</span>
                </div>
                <div class="stat-item">
                  <strong>Tardanzas:</strong>
                  <span>{estadisticasAsistencia.estadisticas.tardanza}</span>
                </div>
                <div class="stat-item">
                  <strong>Justificados:</strong>
                  <span>{estadisticasAsistencia.estadisticas.justificado}</span>
                </div>
              </div>
            </div>
          {/if}

          {#if estadisticasGrupo}
            <div class="estadisticas-box">
              <h3>📊 Estadísticas del Grupo</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <strong>Porcentaje General:</strong>
                  <span class="stat-value">{estadisticasGrupo.estadisticas.porcentajeAsistencia}%</span>
                </div>
                <div class="stat-item">
                  <strong>Total Registros:</strong>
                  <span>{estadisticasGrupo.estadisticas.totalRegistros}</span>
                </div>
              </div>
              <h4>Por Alumno:</h4>
              <div class="list">
                {#each estadisticasGrupo.estadisticasPorAlumno as est}
                  <div class="item">
                    <strong>{est.alumnoNombre}</strong>
                    <span>Asistencia: {est.porcentajeAsistencia}%</span>
                    <small>Presentes: {est.presentes} | Ausentes: {est.ausentes}</small>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if tendenciasAsistencia}
            <div class="estadisticas-box">
              <h3>📈 Tendencias y Patrones</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <strong>Promedio de Asistencia:</strong>
                  <span class="stat-value">{tendenciasAsistencia.resumen.promedioAsistencia}%</span>
                </div>
                <div class="stat-item">
                  <strong>Total Registros:</strong>
                  <span>{tendenciasAsistencia.resumen.totalRegistros}</span>
                </div>
              </div>
              {#if tendenciasAsistencia.patrones.length > 0}
                <h4>Patrones Detectados:</h4>
                {#each tendenciasAsistencia.patrones as patron}
                  <div class="patron-item">
                    <strong>{patron.tipo === 'descendente' ? '⚠️' : '✅'} {patron.descripcion}</strong>
                    <small>Cambio: {patron.cambio}%</small>
                  </div>
                {/each}
              {/if}
              {#if tendenciasAsistencia.diasConMasAusencias.length > 0}
                <h4>Días con Más Ausencias:</h4>
                {#each tendenciasAsistencia.diasConMasAusencias as dia}
                  <div class="patron-item">
                    <strong>{dia.dia}:</strong> <span>{dia.count} ausencias</span>
                  </div>
                {/each}
              {/if}
            </div>
          {/if}

          <div class="list">
            {#each asistencia.filter(a => {
              if (grupoSeleccionadoAsistencia && String(a.grupoId) !== grupoSeleccionadoAsistencia) return false;
              if (alumnoSeleccionadoAsistencia && String(a.alumnoId) !== alumnoSeleccionadoAsistencia) return false;
              return true;
            }) as asis}
              {@const alumno = alumnos.find(a => String(a._id) === String(asis.alumnoId))}
              {@const grupo = asis.grupoId ? grupos.find(g => String(g._id) === String(asis.grupoId)) : null}
              <div class="item">
                <div>
                  <strong>{alumno ? alumno.nombre : 'Alumno no encontrado'}</strong>
                  <p>
                    {#if asis.estado === 'presente'}✅ Presente
                    {:else if asis.estado === 'ausente'}❌ Ausente
                    {:else if asis.estado === 'tardanza'}⏰ Tardanza
                    {:else}📝 Justificado{/if}
                  </p>
                  <small>📅 {new Date(asis.fecha).toLocaleDateString('es-ES')} | Período: {asis.periodo || 'general'}</small>
                  {#if grupo}
                    <small>👥 Grupo: {grupo.nombre}</small>
                  {/if}
                  {#if asis.observaciones}
                    <small>📝 {asis.observaciones}</small>
                  {/if}
                </div>
                <div class="actions">
                  <button on:click={() => verEstadisticasAlumno(asis.alumnoId)} title="Ver estadísticas">📊</button>
                  <button on:click={() => editAsistencia(asis)}>✏️</button>
                  <button on:click={() => deleteAsistencia(asis._id)}>🗑️</button>
                </div>
              </div>
            {/each}
            {#if asistencia.length === 0}
              <p class="empty-state">No hay registros de asistencia</p>
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === 'mensajeria'}
        <div class="section">
          <h2>💬 Mensajería y Comunicación</h2>
          
          <div class="mensajeria-container">
            <div class="mensajeria-form">
              <h3>Enviar Mensaje</h3>
              <form on:submit|preventDefault={enviarMensaje} class="form">
                <select bind:value={newMensaje.alumnoId}>
                  <option value="">Selecciona un alumno (opcional)</option>
                  {#each alumnos.filter(a => a.activo !== false) as a}
                    <option value={String(a._id)}>{a.nombre}</option>
                  {/each}
                </select>
                <select bind:value={newMensaje.maestroId}>
                  <option value="">Selecciona un maestro (opcional)</option>
                  {#each maestros.filter(m => m.activo !== false) as m}
                    <option value={String(m._id)}>{m.nombre}</option>
                  {/each}
                </select>
                <select bind:value={newMensaje.tipo}>
                  <option value="admin-padre">Admin - Padre</option>
                  <option value="maestro-padre">Maestro - Padre</option>
                  <option value="sistema">Sistema</option>
                </select>
                <input bind:value={newMensaje.asunto} placeholder="Asunto" />
                <textarea bind:value={newMensaje.mensaje} placeholder="Mensaje" rows="4"></textarea>
                
                {#if respuestasRapidas.length > 0}
                  <div class="respuestas-rapidas-selector">
                    <label>O usar respuesta rápida:</label>
                    <select bind:value={newMensaje.respuestaRapidaId} on:change={(e) => usarRespuestaRapida(e.target.value)}>
                      <option value="">Selecciona una respuesta rápida</option>
                      {#each respuestasRapidas as r}
                        <option value={String(r._id)}>{r.titulo} ({r.categoria})</option>
                      {/each}
                    </select>
                  </div>
                {/if}
                
                <button type="submit">Enviar Mensaje</button>
              </form>
            </div>
            
            <div class="respuestas-rapidas-section">
              <h3>Respuestas Rápidas Predefinidas</h3>
              <form on:submit|preventDefault={saveRespuestaRapida} class="form">
                <input bind:value={newRespuestaRapida.titulo} placeholder="Título" required />
                <textarea bind:value={newRespuestaRapida.contenido} placeholder="Contenido" rows="3" required></textarea>
                <select bind:value={newRespuestaRapida.categoria}>
                  <option value="general">General</option>
                  <option value="academico">Académico</option>
                  <option value="asistencia">Asistencia</option>
                  <option value="citas">Citas</option>
                  <option value="eventos">Eventos</option>
                </select>
                <button type="submit">{editingRespuestaRapida ? 'Actualizar' : 'Agregar'}</button>
                {#if editingRespuestaRapida}
                  <button type="button" on:click={() => { editingRespuestaRapida = null; newRespuestaRapida = { titulo: '', contenido: '', categoria: 'general' }; }}>Cancelar</button>
                {/if}
              </form>
              
              <div class="list">
                {#each respuestasRapidas as r}
                  <div class="item">
                    <div>
                      <strong>{r.titulo}</strong>
                      <p>{r.contenido}</p>
                      <small>Categoría: {r.categoria}</small>
                    </div>
                    <div class="actions">
                      <button on:click={() => usarRespuestaRapida(r._id)}>📋 Usar</button>
                      <button on:click={() => editRespuestaRapida(r)}>✏️</button>
                      <button on:click={() => deleteRespuestaRapida(r._id)}>🗑️</button>
                    </div>
                  </div>
                {/each}
                {#if respuestasRapidas.length === 0}
                  <p class="empty-state">No hay respuestas rápidas definidas</p>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="mensajes-list">
            <h3>Mensajes Enviados</h3>
            <div class="list">
              {#each mensajes as msg}
                {@const alumno = msg.alumnoId ? alumnos.find(a => String(a._id) === String(msg.alumnoId)) : null}
                {@const maestro = msg.maestroId ? maestros.find(m => String(m._id) === String(msg.maestroId)) : null}
                <div class="item">
                  <div>
                    <strong>{msg.asunto}</strong>
                    <p>{msg.mensaje}</p>
                    <small>📅 {new Date(msg.timestamp).toLocaleString('es-ES')} | Tipo: {msg.tipo}</small>
                    {#if alumno}
                      <small>👨‍🎓 Alumno: {alumno.nombre}</small>
                    {/if}
                    {#if maestro}
                      <small>👨‍🏫 Maestro: {maestro.nombre}</small>
                    {/if}
                    {#if msg.leido}
                      <span class="badge badge-leido">Leído</span>
                    {:else}
                      <span class="badge badge-no-leido">No leído</span>
                    {/if}
                  </div>
                </div>
              {/each}
              {#if mensajes.length === 0}
                <p class="empty-state">No hay mensajes enviados</p>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if activeTab === 'progreso'}
        <div class="section">
          <h2>📈 Seguimiento de Progreso Académico</h2>
          
          <div class="progreso-selector">
            <label>Seleccionar alumno:</label>
            <select bind:value={alumnoProgresoSeleccionado} on:change={cargarProgreso}>
              <option value="">Selecciona un alumno</option>
              {#each alumnos.filter(a => a.activo !== false) as a}
                <option value={String(a._id)}>{a.nombre}</option>
              {/each}
            </select>
          </div>

          {#if progresoData}
            <div class="progreso-dashboard">
              <div class="progreso-header">
                <h3>📊 Dashboard de Progreso: {progresoData.alumnoNombre}</h3>
                <div class="progreso-stats">
                  <div class="stat-box">
                    <div class="stat-value">{progresoData.promedioGeneral}/100</div>
                    <div class="stat-label">Promedio General</div>
                  </div>
                  {#if progresoData.comparativaGrupo}
                    <div class="stat-box">
                      <div class="stat-value">{progresoData.comparativaGrupo.posicion}/{progresoData.comparativaGrupo.totalAlumnos}</div>
                      <div class="stat-label">Posición en Grupo</div>
                    </div>
                  {/if}
                  <div class="stat-box">
                    <div class="stat-value">{progresoData.logros}/{progresoData.totalObjetivos}</div>
                    <div class="stat-label">Objetivos Cumplidos</div>
                  </div>
                </div>
              </div>

              {#if progresoData.comparativaGrupo}
                <div class="comparativa-box">
                  <h4>📊 Comparativa con el Grupo</h4>
                  <div class="comparativa-content">
                    <div class="comparativa-item">
                      <span>Promedio del Alumno:</span>
                      <strong>{progresoData.comparativaGrupo.promedioAlumno}/100</strong>
                    </div>
                    <div class="comparativa-item">
                      <span>Promedio del Grupo:</span>
                      <strong>{progresoData.comparativaGrupo.promedioGrupo}/100</strong>
                    </div>
                    <div class="comparativa-item">
                      <span>Diferencia:</span>
                      <strong class={progresoData.comparativaGrupo.diferencia >= 0 ? 'positivo' : 'negativo'}>
                        {progresoData.comparativaGrupo.diferencia >= 0 ? '+' : ''}{progresoData.comparativaGrupo.diferencia}
                      </strong>
                    </div>
                  </div>
                </div>
              {/if}

              {#if progresoData.areasMejora && progresoData.areasMejora.length > 0}
                <div class="areas-mejora-box">
                  <h4>⚠️ Áreas de Mejora Identificadas</h4>
                  <div class="areas-list">
                    {#each progresoData.areasMejora as area}
                      <div class="area-item">
                        <strong>{area.materia}</strong>
                        <span class="area-promedio">{area.promedio}/100</span>
                        <div class="area-bar">
                          <div class="area-fill" style="width: {area.promedio}%"></div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if logrosData && (logrosData.logros.length > 0 || logrosData.avances.length > 0)}
                <div class="logros-box">
                  <h4>🎉 Logros y Avances</h4>
                  {#if logrosData.logros.length > 0}
                    <div class="logros-section">
                      <h5>✅ Objetivos Cumplidos</h5>
                      {#each logrosData.logros as logro}
                        <div class="logro-item">
                          <strong>{logro.materia}</strong>
                          <span>Meta: {logro.meta}/100 | Alcanzado: {logro.promedioAlcanzado}/100</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                  {#if logrosData.avances.length > 0}
                    <div class="avances-section">
                      <h5>📈 Avances Significativos</h5>
                      {#each logrosData.avances as avance}
                        <div class="avance-item">
                          <strong>{avance.materia}</strong>
                          <span>Mejora: +{avance.mejora} puntos ({avance.desde} → {avance.hasta})</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="graficas-section">
                <h4>📈 Evolución por Materia</h4>
                {#each getMateriasUnicas() as materia}
                  {@const evolucion = progresoData.evolucionPorMateria[materia]}
                  <div class="grafica-materia">
                    <h5>{materia}</h5>
                    <div class="grafica-container">
                      <div class="grafica-bars">
                        {#each evolucion as punto}
                          <div class="grafica-bar-wrapper">
                            <div 
                              class="grafica-bar" 
                              style="height: {punto.calificacion}%"
                              title="{punto.calificacion}/100 - {new Date(punto.fecha).toLocaleDateString('es-ES')}"
                            ></div>
                            <small>{new Date(punto.fecha).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}</small>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>

              <div class="objetivos-section">
                <h4>🎯 Objetivos y Metas</h4>
                <form on:submit|preventDefault={saveObjetivo} class="form">
                  <select bind:value={newObjetivo.alumnoId} required>
                    <option value="">Selecciona un alumno</option>
                    {#each alumnos.filter(a => a.activo !== false) as a}
                      <option value={String(a._id)}>{a.nombre}</option>
                    {/each}
                  </select>
                  <input bind:value={newObjetivo.materia} placeholder="Materia" required />
                  <input type="number" bind:value={newObjetivo.meta} placeholder="Meta (0-100)" min="0" max="100" step="0.1" required />
                  <textarea bind:value={newObjetivo.descripcion} placeholder="Descripción (opcional)"></textarea>
                  <input type="date" bind:value={newObjetivo.fechaLimite} placeholder="Fecha límite (opcional)" />
                  <button type="submit">{editingObjetivo ? 'Actualizar' : 'Agregar'}</button>
                  {#if editingObjetivo}
                    <button type="button" on:click={() => { editingObjetivo = null; newObjetivo = { alumnoId: '', materia: '', meta: '', descripcion: '', fechaLimite: '' }; }}>Cancelar</button>
                  {/if}
                </form>
                
                <div class="list">
                  {#each objetivos as obj}
                    {@const alumno = alumnos.find(a => String(a._id) === String(obj.alumnoId))}
                    <div class="item">
                      <div>
                        <strong>{obj.materia}</strong>
                        <p>Meta: {obj.meta}/100</p>
                        {#if obj.descripcion}
                          <small>{obj.descripcion}</small>
                        {/if}
                        {#if obj.fechaLimite}
                          <small>📅 Fecha límite: {new Date(obj.fechaLimite).toLocaleDateString('es-ES')}</small>
                        {/if}
                        {#if alumno}
                          <small>👨‍🎓 {alumno.nombre}</small>
                        {/if}
                        {#if obj.cumplido}
                          <span class="badge badge-excelente">✅ Cumplido</span>
                        {:else}
                          <span class="badge badge-pendiente">⏳ Pendiente</span>
                        {/if}
                      </div>
                      <div class="actions">
                        <button on:click={() => editObjetivo(obj)}>✏️</button>
                        <button on:click={() => deleteObjetivo(obj._id)}>🗑️</button>
                      </div>
                    </div>
                  {/each}
                  {#if objetivos.length === 0}
                    <p class="empty-state">No hay objetivos definidos</p>
                  {/if}
                </div>
              </div>
            </div>
          {:else if alumnoProgresoSeleccionado}
            <p class="empty-state">Cargando progreso...</p>
          {:else}
            <p class="empty-state">Selecciona un alumno para ver su progreso</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'analisis'}
        <div class="section">
          <h2>🤖 Análisis Predictivo con IA</h2>
          
          <div class="riesgo-overview">
            <h3>⚠️ Alumnos en Riesgo Académico</h3>
            <div class="filtro-riesgo">
              <label>Filtrar por nivel de riesgo:</label>
              <select bind:value={filtroRiesgo} on:change={loadAlumnosEnRiesgo}>
                <option value="todos">Todos</option>
                <option value="alto">Alto Riesgo</option>
                <option value="medio">Riesgo Medio</option>
                <option value="bajo">Bajo Riesgo</option>
              </select>
            </div>
            
            <div class="riesgo-stats">
              <div class="riesgo-stat">
                <div class="riesgo-stat-value" style="color: #dc3545;">
                  {alumnosEnRiesgo.filter(a => a.riesgo.nivel === 'alto').length}
                </div>
                <div class="riesgo-stat-label">Alto Riesgo</div>
              </div>
              <div class="riesgo-stat">
                <div class="riesgo-stat-value" style="color: #ffc107;">
                  {alumnosEnRiesgo.filter(a => a.riesgo.nivel === 'medio').length}
                </div>
                <div class="riesgo-stat-label">Riesgo Medio</div>
              </div>
              <div class="riesgo-stat">
                <div class="riesgo-stat-value" style="color: #28a745;">
                  {alumnosEnRiesgo.filter(a => a.riesgo.nivel === 'bajo').length}
                </div>
                <div class="riesgo-stat-label">Bajo Riesgo</div>
              </div>
            </div>
            
            <div class="list">
              {#each alumnosEnRiesgo as alumnoRiesgo}
                {@const grupo = grupos.find(g => String(g._id) === String(alumnoRiesgo.grupoId))}
                <div class="item riesgo-item" style="border-left: 4px solid {getColorRiesgo(alumnoRiesgo.riesgo.nivel)}">
                  <div>
                    <strong>{getIconoRiesgo(alumnoRiesgo.riesgo.nivel)} {alumnoRiesgo.alumnoNombre}</strong>
                    <p>Puntaje de Riesgo: {alumnoRiesgo.riesgo.puntaje}/100 | Promedio: {alumnoRiesgo.promedio}/100</p>
                    {#if grupo}
                      <small>👥 Grupo: {grupo.nombre}</small>
                    {/if}
                    <span class="badge" style="background: {getColorRiesgo(alumnoRiesgo.riesgo.nivel)}; color: white;">
                      {alumnoRiesgo.riesgo.nivel.toUpperCase()}
                    </span>
                  </div>
                  <div class="actions">
                    <button on:click={() => { alumnoAnalisisSeleccionado = String(alumnoRiesgo.alumnoId); cargarAnalisisPredictivo(); }}>📊 Analizar</button>
                  </div>
                </div>
              {/each}
              {#if alumnosEnRiesgo.length === 0}
                <p class="empty-state">No hay alumnos en riesgo con los filtros seleccionados</p>
              {/if}
            </div>
          </div>

          <div class="analisis-individual">
            <h3>📊 Análisis Individual</h3>
            <div class="analisis-selector">
              <label>Seleccionar alumno para análisis detallado:</label>
              <select bind:value={alumnoAnalisisSeleccionado} on:change={cargarAnalisisPredictivo}>
                <option value="">Selecciona un alumno</option>
                {#each alumnos.filter(a => a.activo !== false) as a}
                  <option value={String(a._id)}>{a.nombre}</option>
                {/each}
              </select>
            </div>

            {#if analisisPredictivo}
              <div class="analisis-dashboard">
                <div class="riesgo-card" style="border-color: {getColorRiesgo(analisisPredictivo.riesgo.nivelRiesgo)}">
                  <h4>🔍 Predicción de Riesgo Académico</h4>
                  <div class="riesgo-info">
                    <div class="riesgo-puntaje">
                      <div class="puntaje-value" style="color: {getColorRiesgo(analisisPredictivo.riesgo.nivelRiesgo)}">
                        {analisisPredictivo.riesgo.puntajeRiesgo}/100
                      </div>
                      <div class="puntaje-label">Puntaje de Riesgo</div>
                    </div>
                    <div class="riesgo-nivel">
                      <span class="badge-riesgo" style="background: {getColorRiesgo(analisisPredictivo.riesgo.nivelRiesgo)}">
                        {getIconoRiesgo(analisisPredictivo.riesgo.nivelRiesgo)} {analisisPredictivo.riesgo.nivelRiesgo.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div class="factores-riesgo">
                    <h5>Factores de Riesgo Analizados:</h5>
                    <div class="factores-grid">
                      <div class="factor-item">
                        <span class="factor-label">Calificaciones:</span>
                        <span class="factor-value">{analisisPredictivo.riesgo.factores.calificaciones}/100</span>
                      </div>
                      <div class="factor-item">
                        <span class="factor-label">Asistencia:</span>
                        <span class="factor-value">{Math.round(analisisPredictivo.riesgo.factores.asistencia * 10) / 10}%</span>
                      </div>
                      <div class="factor-item">
                        <span class="factor-label">Tendencia:</span>
                        <span class="factor-value" style="color: {analisisPredictivo.riesgo.factores.tendencia < 0 ? '#dc3545' : '#28a745'}">
                          {analisisPredictivo.riesgo.factores.tendencia > 0 ? '+' : ''}{Math.round(analisisPredictivo.riesgo.factores.tendencia * 10) / 10}
                        </span>
                      </div>
                      <div class="factor-item">
                        <span class="factor-label">Objetivos No Cumplidos:</span>
                        <span class="factor-value">{Math.round(analisisPredictivo.riesgo.factores.objetivos * 10) / 10}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {#if analisisPredictivo.recomendaciones}
                  <div class="recomendaciones-section">
                    <h4>💡 Recomendaciones Generadas con IA</h4>
                    
                    {#if analisisPredictivo.recomendaciones.recomendacionesIntervencion}
                      <div class="recomendacion-box">
                        <h5>🛠️ Recomendaciones de Intervención</h5>
                        <ul>
                          {#each analisisPredictivo.recomendaciones.recomendacionesIntervencion as rec}
                            <li>{rec}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}

                    {#if analisisPredictivo.recomendaciones.sugerenciasActividades}
                      <div class="recomendacion-box">
                        <h5>📚 Sugerencias de Actividades</h5>
                        <ul>
                          {#each analisisPredictivo.recomendaciones.sugerenciasActividades as act}
                            <li>{act}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}

                    {#if analisisPredictivo.recomendaciones.recursosApoyo}
                      <div class="recomendacion-box">
                        <h5>📖 Recursos de Apoyo</h5>
                        <ul>
                          {#each analisisPredictivo.recomendaciones.recursosApoyo as recurso}
                            <li>{recurso}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}

                    {#if analisisPredictivo.recomendaciones.estrategiasAprendizaje}
                      <div class="recomendacion-box">
                        <h5>🎓 Estrategias de Aprendizaje</h5>
                        <ul>
                          {#each analisisPredictivo.recomendaciones.estrategiasAprendizaje as estrategia}
                            <li>{estrategia}</li>
                          {/each}
                        </ul>
                      </div>
                    {/if}
                  </div>
                {/if}

                <div class="datos-resumen">
                  <h4>📋 Resumen de Datos</h4>
                  <div class="datos-grid">
                    <div class="dato-item">
                      <span>Promedio General:</span>
                      <strong>{analisisPredictivo.datos.promedioGeneral}/100</strong>
                    </div>
                    <div class="dato-item">
                      <span>Asistencia:</span>
                      <strong>{analisisPredictivo.datos.porcentajeAsistencia}%</strong>
                    </div>
                    <div class="dato-item">
                      <span>Calificaciones:</span>
                      <strong>{analisisPredictivo.datos.totalCalificaciones}</strong>
                    </div>
                    <div class="dato-item">
                      <span>Objetivos:</span>
                      <strong>{analisisPredictivo.datos.objetivosCumplidos}/{analisisPredictivo.datos.objetivosTotal}</strong>
                    </div>
                  </div>
                </div>
              </div>
            {:else if alumnoAnalisisSeleccionado}
              <p class="empty-state">Cargando análisis...</p>
            {:else}
              <p class="empty-state">Selecciona un alumno para ver su análisis predictivo</p>
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === 'reportes'}
        <div class="section">
          <h2>📄 Reportes y Exportación</h2>
          
          <div class="reportes-container">
            <div class="reportes-selector">
              <h3>Seleccionar Tipo de Reporte</h3>
              <select bind:value={tipoReporte} on:change={() => datosReporte = null}>
                <option value="mensual-uso">📅 Reporte Mensual de Uso</option>
                <option value="impacto">📊 Reporte de Impacto</option>
                <option value="academico">🎓 Reporte Académico</option>
              </select>
            </div>

            <div class="reportes-params">
              {#if tipoReporte === 'mensual-uso'}
                <div class="param-group">
                  <label>Mes:</label>
                  <input type="number" bind:value={reporteMes} min="1" max="12" />
                </div>
                <div class="param-group">
                  <label>Año:</label>
                  <input type="number" bind:value={reporteAño} min="2020" max="2100" />
                </div>
              {:else if tipoReporte === 'impacto'}
                <div class="param-group">
                  <label>Fecha Inicio:</label>
                  <input type="date" bind:value={reporteFechaInicio} />
                </div>
                <div class="param-group">
                  <label>Fecha Fin:</label>
                  <input type="date" bind:value={reporteFechaFin} />
                </div>
              {:else if tipoReporte === 'academico'}
                <div class="param-group">
                  <label>Período (opcional):</label>
                  <input type="text" bind:value={reportePeriodo} placeholder="Dejar vacío para todos" />
                </div>
              {/if}
            </div>

            <div class="reportes-actions">
              <button on:click={generarReporte} class="btn-primary">Generar Reporte</button>
              {#if datosReporte}
                <div class="export-buttons">
                  <button on:click={() => exportarReporte('excel')} class="btn-export">📊 Exportar a Excel</button>
                  <button on:click={() => exportarReporte('pdf')} class="btn-export">📄 Exportar a PDF</button>
                  <button on:click={() => exportarReporte('json')} class="btn-export">📋 Datos para Análisis (JSON)</button>
                </div>
              {/if}
            </div>

            {#if datosReporte}
              <div class="reporte-preview">
                <h3>Vista Previa del Reporte</h3>
                <pre>{JSON.stringify(datosReporte, null, 2)}</pre>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if activeTab === 'tareas'}
        <div class="section">
          <h2>📝 Tareas y Actividades</h2>
          
          <div class="tareas-tabs">
            <button class:active={!tareaSeleccionada} on:click={() => tareaSeleccionada = null}>📋 Lista de Tareas</button>
            <button class:active={tareaSeleccionada} on:click={() => {}}>📅 Calendario Académico</button>
            <button on:click={() => { loadFechasImportantes(); }}>📌 Fechas Importantes</button>
          </div>

          {#if !tareaSeleccionada}
            <form on:submit|preventDefault={saveTarea} class="form">
              <h3>{editingTarea ? 'Editar' : 'Nueva'} Tarea/Actividad</h3>
              <div class="form-row">
                <div class="form-group">
                  <label>Título *</label>
                  <input type="text" bind:value={newTarea.titulo} required />
                </div>
                <div class="form-group">
                  <label>Tipo *</label>
                  <select bind:value={newTarea.tipo} required>
                    <option value="tarea">📝 Tarea</option>
                    <option value="examen">📋 Examen</option>
                    <option value="evaluacion">📊 Evaluación</option>
                    <option value="proyecto">🎯 Proyecto</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Descripción</label>
                  <textarea bind:value={newTarea.descripcion} rows="3"></textarea>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Maestro</label>
                  <select bind:value={newTarea.maestroId}>
                    <option value="">Sin asignar</option>
                    {#each maestros.filter(m => m.activo !== false) as m}
                      <option value={String(m._id)}>{m.nombre}</option>
                    {/each}
                  </select>
                </div>
                <div class="form-group">
                  <label>Grupo</label>
                  <select bind:value={newTarea.grupoId}>
                    <option value="">Sin grupo</option>
                    {#each grupos.filter(g => g.activo !== false) as g}
                      <option value={String(g._id)}>{g.nombre}</option>
                    {/each}
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Fecha Límite *</label>
                  <input type="datetime-local" bind:value={newTarea.fechaLimite} required />
                </div>
                <div class="form-group">
                  <label>Puntos</label>
                  <input type="number" bind:value={newTarea.puntos} min="0" max="100" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>
                    <input type="checkbox" bind:checked={newTarea.enviarRecordatorio} />
                    Enviar recordatorio automático
                  </label>
                </div>
              </div>
              <div class="form-actions">
                <button type="submit">{editingTarea ? 'Actualizar' : 'Crear'}</button>
                {#if editingTarea}
                  <button type="button" on:click={() => { editingTarea = null; newTarea = { titulo: '', descripcion: '', tipo: 'tarea', grupoId: '', maestroId: '', alumnos: [], fechaLimite: '', puntos: 100, enviarRecordatorio: false }; }}>Cancelar</button>
                {/if}
              </div>
            </form>

            {#if fechasImportantes}
              <div class="fechas-importantes-box">
                <h3>📌 Fechas Importantes (Próximos 30 días)</h3>
                {#if fechasImportantes.tareasProximas.length > 0}
                  <div class="fechas-section">
                    <h4>📝 Tareas Próximas ({fechasImportantes.tareasProximas.length})</h4>
                    <div class="list">
                      {#each fechasImportantes.tareasProximas.slice(0, 5) as tarea}
                        <div class="item">
                          <strong>{tarea.titulo}</strong>
                          <small>📅 {new Date(tarea.fechaLimite).toLocaleDateString('es-ES')} | {tarea.tipo}</small>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
                {#if fechasImportantes.examenesProximos.length > 0}
                  <div class="fechas-section">
                    <h4>📋 Exámenes Próximos ({fechasImportantes.examenesProximos.length})</h4>
                    <div class="list">
                      {#each fechasImportantes.examenesProximos.slice(0, 5) as examen}
                        <div class="item">
                          <strong>{examen.titulo}</strong>
                          <small>📅 {new Date(examen.fechaLimite).toLocaleDateString('es-ES')}</small>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
                {#if fechasImportantes.eventosProximos.length > 0}
                  <div class="fechas-section">
                    <h4>🎉 Eventos Próximos ({fechasImportantes.eventosProximos.length})</h4>
                    <div class="list">
                      {#each fechasImportantes.eventosProximos.slice(0, 5) as evento}
                        <div class="item">
                          <strong>{evento.titulo}</strong>
                          <small>📅 {new Date(evento.fecha).toLocaleDateString('es-ES')}</small>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="list">
              {#each tareas as tarea}
                {@const grupo = tarea.grupoId ? grupos.find(g => String(g._id) === String(tarea.grupoId)) : null}
                {@const maestro = tarea.maestroId ? maestros.find(m => String(m._id) === String(tarea.maestroId)) : null}
                {@const fechaLimite = new Date(tarea.fechaLimite)}
                {@const esVencida = fechaLimite < new Date() && tarea.estado !== 'calificada'}
                <div class="item" class:tarea-vencida={esVencida}>
                  <div>
                    <strong>{tarea.titulo}</strong>
                    <p>{tarea.descripcion || 'Sin descripción'}</p>
                    <small>
                      {#if tarea.tipo === 'tarea'}📝 Tarea
                      {:else if tarea.tipo === 'examen'}📋 Examen
                      {:else if tarea.tipo === 'evaluacion'}📊 Evaluación
                      {:else}🎯 Proyecto{/if}
                      | 📅 {fechaLimite.toLocaleDateString('es-ES')} | ⭐ {tarea.puntos} puntos
                    </small>
                    {#if grupo}
                      <small>👥 Grupo: {grupo.nombre}</small>
                    {/if}
                    {#if maestro}
                      <small>👨‍🏫 Maestro: {maestro.nombre}</small>
                    {/if}
                    {#if tarea.entregas && tarea.entregas.length > 0}
                      <small>📤 {tarea.entregas.length} entrega(s)</small>
                    {/if}
                    {#if esVencida}
                      <span class="badge badge-vencida">Vencida</span>
                    {:else if tarea.estado === 'calificada'}
                      <span class="badge badge-calificada">Calificada</span>
                    {:else if tarea.estado === 'entregada'}
                      <span class="badge badge-entregada">Entregada</span>
                    {:else}
                      <span class="badge badge-pendiente">Pendiente</span>
                    {/if}
                  </div>
                  <div class="actions">
                    <button on:click={() => verTarea(tarea)} title="Ver detalles">👁️</button>
                    <button on:click={() => editTarea(tarea)}>✏️</button>
                    <button on:click={() => deleteTarea(tarea._id)}>🗑️</button>
                  </div>
                </div>
              {/each}
              {#if tareas.length === 0}
                <p class="empty-state">No hay tareas registradas</p>
              {/if}
            </div>
          {:else}
            <div class="tarea-detalle">
              <button on:click={() => tareaSeleccionada = null} class="btn-back">← Volver</button>
              <h3>{tareaSeleccionada.titulo}</h3>
              <p>{tareaSeleccionada.descripcion || 'Sin descripción'}</p>
              <div class="tarea-info">
                <div class="info-item">
                  <strong>Tipo:</strong> {tareaSeleccionada.tipo}
                </div>
                <div class="info-item">
                  <strong>Fecha Límite:</strong> {new Date(tareaSeleccionada.fechaLimite).toLocaleString('es-ES')}
                </div>
                <div class="info-item">
                  <strong>Puntos:</strong> {tareaSeleccionada.puntos}
                </div>
                <div class="info-item">
                  <strong>Estado:</strong> {tareaSeleccionada.estado}
                </div>
              </div>
              
              {#if tareaSeleccionada.entregas && tareaSeleccionada.entregas.length > 0}
                <div class="entregas-section">
                  <h4>📤 Entregas ({tareaSeleccionada.entregas.length})</h4>
                  {#each tareaSeleccionada.entregas as entrega}
                    {@const alumno = alumnos.find(a => String(a._id) === String(entrega.alumnoId))}
                    <div class="entrega-item">
                      <strong>{alumno ? alumno.nombre : 'Alumno no encontrado'}</strong>
                      <p>📅 {new Date(entrega.fechaEntrega).toLocaleString('es-ES')}</p>
                      {#if entrega.comentarios}
                        <p>💬 {entrega.comentarios}</p>
                      {/if}
                      {#if entrega.calificacion !== null}
                        <div class="calificacion-display">
                          <strong>Calificación: {entrega.calificacion}/{tareaSeleccionada.puntos}</strong>
                          {#if entrega.comentariosCalificacion}
                            <p>📝 {entrega.comentariosCalificacion}</p>
                          {/if}
                        </div>
                      {:else}
                        <div class="calificacion-form">
                          <h5>Calificar Entrega</h5>
                          <input type="number" bind:value={calificacionTarea.calificacion} min="0" max={tareaSeleccionada.puntos} placeholder="Calificación" />
                          <textarea bind:value={calificacionTarea.comentarios} placeholder="Comentarios (opcional)"></textarea>
                          <button on:click={() => calificarTarea(tareaSeleccionada._id, entrega.alumnoId)}>Calificar</button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          {#if calendarioAcademico}
            <div class="calendario-box">
              <h3>📅 Calendario Académico - {calendarioAcademico.mes}/{calendarioAcademico.año}</h3>
              <div class="calendario-grid">
                {#each Object.entries(calendarioAcademico.calendario) as [fecha, eventos]}
                  <div class="calendario-dia">
                    <strong>{new Date(fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</strong>
                    {#if eventos.tareas.length > 0}
                      <div class="calendario-tareas">
                        {#each eventos.tareas.slice(0, 3) as tarea}
                          <div class="calendario-item tarea">📝 {tarea.titulo}</div>
                        {/each}
                      </div>
                    {/if}
                    {#if eventos.eventos.length > 0}
                      <div class="calendario-eventos">
                        {#each eventos.eventos.slice(0, 2) as evento}
                          <div class="calendario-item evento">🎉 {evento.titulo}</div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'recursos'}
        <div class="section">
          <h2>📚 Biblioteca de Recursos y Materiales</h2>
          
          <div class="recursos-controls">
            <div class="control-group">
              <label>Buscar:</label>
              <input type="text" bind:value={busquedaRecursos} placeholder="Buscar recursos..." on:input={loadRecursos} />
            </div>
            <div class="control-group">
              <label>Filtrar por materia:</label>
              <select bind:value={materiaSeleccionadaRecursos} on:change={loadRecursos}>
                <option value="">Todas las materias</option>
                <option value="Matemáticas">Matemáticas</option>
                <option value="Español">Español</option>
                <option value="Ciencias">Ciencias</option>
                <option value="Historia">Historia</option>
                <option value="Inglés">Inglés</option>
                <option value="Arte">Arte</option>
                <option value="Educación Física">Educación Física</option>
              </select>
            </div>
            <button on:click={cargarRecomendacionesRecursos} class="btn-secondary">🤖 Recomendaciones con IA</button>
            <button on:click={() => { materiaSeleccionadaRecursos = ''; busquedaRecursos = ''; loadRecursos(); }} class="btn-secondary">Limpiar Filtros</button>
          </div>

          {#if recomendacionesRecursos}
            <div class="recomendaciones-box">
              <h3>🤖 Recomendaciones de Recursos (IA)</h3>
              {#if recomendacionesRecursos.recomendaciones && recomendacionesRecursos.recomendaciones.length > 0}
                <div class="list">
                  {#each recomendacionesRecursos.recomendaciones as rec}
                    {#if rec.recurso}
                      <div class="item recomendacion-item">
                        <div>
                          <strong>{rec.recurso.titulo}</strong>
                          <p>{rec.recurso.descripcion || 'Sin descripción'}</p>
                          <small>
                            {#if rec.recurso.tipo === 'documento'}📄 Documento
                            {:else if rec.recurso.tipo === 'enlace'}🔗 Enlace
                            {:else if rec.recurso.tipo === 'video'}🎥 Video
                            {:else if rec.recurso.tipo === 'imagen'}🖼️ Imagen
                            {:else}🎵 Audio{/if}
                            | {rec.recurso.materia || 'Sin materia'}
                            {#if rec.recurso.learningDifferences}
                              | ♿ Learning Differences
                            {/if}
                          </small>
                          <p class="recomendacion-razon">💡 {rec.razon}</p>
                          <span class="badge" class:badge-alta={rec.prioridad === 'alta'} class:badge-media={rec.prioridad === 'media'} class:badge-baja={rec.prioridad === 'baja'}>
                            Prioridad: {rec.prioridad}
                          </span>
                        </div>
                        <div class="actions">
                          <button on:click={() => verRecurso(rec.recurso)} title="Ver/Descargar">👁️</button>
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {:else}
                <p class="empty-state">No hay recomendaciones disponibles</p>
              {/if}
            </div>
          {/if}

          <form on:submit|preventDefault={saveRecurso} class="form" enctype="multipart/form-data">
            <h3>{editingRecurso ? 'Editar' : 'Nuevo'} Recurso</h3>
            <div class="form-row">
              <div class="form-group">
                <label>Título *</label>
                <input type="text" bind:value={newRecurso.titulo} required />
              </div>
              <div class="form-group">
                <label>Tipo *</label>
                <select bind:value={newRecurso.tipo} required>
                  <option value="documento">📄 Documento</option>
                  <option value="enlace">🔗 Enlace</option>
                  <option value="video">🎥 Video</option>
                  <option value="imagen">🖼️ Imagen</option>
                  <option value="audio">🎵 Audio</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Descripción</label>
                <textarea bind:value={newRecurso.descripcion} rows="3"></textarea>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Materia</label>
                <input type="text" bind:value={newRecurso.materia} placeholder="Ej: Matemáticas, Español..." />
              </div>
              <div class="form-group">
                <label>Maestro</label>
                <select bind:value={newRecurso.maestroId}>
                  <option value="">Sin asignar</option>
                  {#each maestros.filter(m => m.activo !== false) as m}
                    <option value={String(m._id)}>{m.nombre}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="form-row">
              {#if newRecurso.tipo === 'enlace'}
                <div class="form-group">
                  <label>URL *</label>
                  <input type="url" bind:value={newRecurso.url} required />
                </div>
              {:else}
                <div class="form-group">
                  <label>Archivo {editingRecurso ? '(dejar vacío para mantener actual)' : '*'}</label>
                  <input type="file" id="archivo-recurso" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mp3,.zip" />
                </div>
              {/if}
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tags (separados por comas)</label>
                <input type="text" bind:value={newRecurso.tags} placeholder="Ej: algebra, ejercicios, practica" />
              </div>
              <div class="form-group">
                <label>
                  <input type="checkbox" bind:checked={newRecurso.learningDifferences} />
                  Recurso para Learning Differences
                </label>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit">{editingRecurso ? 'Actualizar' : 'Crear'}</button>
              {#if editingRecurso}
                <button type="button" on:click={() => { editingRecurso = null; newRecurso = { titulo: '', descripcion: '', tipo: 'documento', materia: '', url: '', maestroId: '', learningDifferences: false, tags: '' }; }}>Cancelar</button>
              {/if}
            </div>
          </form>

          <div class="recursos-filtros">
            <button on:click={() => { materiaSeleccionadaRecursos = ''; busquedaRecursos = ''; loadRecursos(); }} class:active={!materiaSeleccionadaRecursos && !busquedaRecursos}>
              Todos
            </button>
            <button on:click={() => { window.open(`${API_URL}/api/recursos/learning-differences', '_blank'); }} class="btn-link">
              ♿ Learning Differences
            </button>
          </div>

          <div class="list">
            {#each recursos.filter(r => {
              if (materiaSeleccionadaRecursos && r.materia !== materiaSeleccionadaRecursos) return false;
              if (busquedaRecursos && !r.titulo.toLowerCase().includes(busquedaRecursos.toLowerCase()) && !r.descripcion?.toLowerCase().includes(busquedaRecursos.toLowerCase())) return false;
              return true;
            }) as recurso}
              {@const maestro = recurso.maestroId ? maestros.find(m => String(m._id) === String(recurso.maestroId)) : null}
              <div class="item recurso-item">
                <div>
                  <strong>{recurso.titulo}</strong>
                  <p>{recurso.descripcion || 'Sin descripción'}</p>
                  <small>
                    {#if recurso.tipo === 'documento'}📄 Documento
                    {:else if recurso.tipo === 'enlace'}🔗 Enlace
                    {:else if recurso.tipo === 'video'}🎥 Video
                    {:else if recurso.tipo === 'imagen'}🖼️ Imagen
                    {:else}🎵 Audio{/if}
                    {#if recurso.materia}
                      | 📚 {recurso.materia}
                    {/if}
                    {#if recurso.archivoTamaño}
                      | 📦 {Math.round(recurso.archivoTamaño / 1024)} KB
                    {/if}
                    | 👁️ {recurso.visualizaciones || 0} vistas
                    | ⬇️ {recurso.descargas || 0} descargas
                  </small>
                  {#if maestro}
                    <small>👨‍🏫 Compartido por: {maestro.nombre}</small>
                  {/if}
                  {#if recurso.tags && recurso.tags.length > 0}
                    <div class="tags">
                      {#each recurso.tags as tag}
                        <span class="tag">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if recurso.learningDifferences}
                    <span class="badge badge-learning">♿ Learning Differences</span>
                  {/if}
                </div>
                <div class="actions">
                  <button on:click={() => verRecurso(recurso)} title="Ver/Visualizar">👁️</button>
                  {#if recurso.tipo !== 'enlace'}
                    <button on:click={() => descargarRecurso(recurso)} title="Descargar">⬇️</button>
                  {/if}
                  <button on:click={() => editRecurso(recurso)}>✏️</button>
                  <button on:click={() => deleteRecurso(recurso._id)}>🗑️</button>
                </div>
              </div>
            {/each}
            {#if recursos.length === 0}
              <p class="empty-state">No hay recursos registrados</p>
            {/if}
          </div>
        </div>
      {/if}
      </div>
      </main>
    </div>
  </div>
{/if}

<!-- Modal de perfil de accesibilidad -->
{#if editingPerfilAccesibilidad}
  <div class="modal-overlay" on:click={() => editingPerfilAccesibilidad = null}>
    <div class="modal-content" on:click|stopPropagation role="dialog" aria-labelledby="modal-title">
      <h2 id="modal-title">Perfil de Accesibilidad: {editingPerfilAccesibilidad.nombre}</h2>
      <form on:submit|preventDefault={guardarPerfilAccesibilidad} class="form">
        <label>
          <input type="checkbox" bind:checked={perfilAccesibilidadEdit.modoAccesible} />
          Modo Accesible
        </label>
        <label>
          <input type="checkbox" bind:checked={perfilAccesibilidadEdit.textoSimplificado} />
          Texto Simplificado
        </label>
        <label>
          <input type="checkbox" bind:checked={perfilAccesibilidadEdit.lecturaPantalla} />
          Soporte de Lectura de Pantalla
        </label>
        <label>
          <input type="checkbox" bind:checked={perfilAccesibilidadEdit.respuestasCortas} />
          Respuestas Cortas y Claras
        </label>
        <div>
          <label>Necesidades Especiales (separadas por comas):</label>
          <input 
            type="text" 
            bind:value={perfilAccesibilidadEdit.necesidadesEspeciales} 
            placeholder="Ej: dislexia, TDAH, autismo"
            on:input={(e) => {
              const value = e.target.value;
              perfilAccesibilidadEdit.necesidadesEspeciales = value ? value.split(',').map(n => n.trim()) : [];
            }}
          />
        </div>
        <div class="form-actions">
          <button type="submit">Guardar</button>
          <button type="button" on:click={() => editingPerfilAccesibilidad = null}>Cancelar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-content h2 {
    margin: 0 0 20px 0;
  }

  .progreso-selector {
    margin-bottom: 25px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .progreso-selector label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .progreso-selector select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 1rem;
  }

  .progreso-dashboard {
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  .progreso-header h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .progreso-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .stat-box {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .comparativa-box, .areas-mejora-box, .logros-box {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    border: 2px solid #e9ecef;
  }

  .comparativa-box h4, .areas-mejora-box h4, .logros-box h4 {
    margin: 0 0 15px 0;
    color: #495057;
  }

  .comparativa-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .comparativa-item {
    display: flex;
    justify-content: space-between;
    padding: 10px;
    background: white;
    border-radius: 6px;
  }

  .positivo {
    color: #28a745;
  }

  .negativo {
    color: #dc3545;
  }

  .areas-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .area-item {
    background: white;
    padding: 15px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .area-item strong {
    color: #333;
  }

  .area-promedio {
    color: #dc3545;
    font-weight: 600;
  }

  .area-bar {
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
  }

  .area-fill {
    height: 100%;
    background: linear-gradient(90deg, #dc3545 0%, #ffc107 100%);
    transition: width 0.3s ease;
  }

  .logros-section, .avances-section {
    margin-bottom: 20px;
  }

  .logros-section h5, .avances-section h5 {
    margin: 0 0 10px 0;
    color: #495057;
  }

  .logro-item, .avance-item {
    background: white;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .graficas-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
  }

  .graficas-section h4 {
    margin: 0 0 20px 0;
    color: #495057;
  }

  .grafica-materia {
    background: white;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
  }

  .grafica-materia h5 {
    margin: 0 0 15px 0;
    color: #333;
  }

  .grafica-container {
    height: 200px;
    position: relative;
  }

  .grafica-bars {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 100%;
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

  .objetivos-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
  }

  .objetivos-section h4 {
    margin: 0 0 20px 0;
    color: #495057;
  }

  .badge-pendiente {
    background: #ffc107;
    color: #333;
  }

  .riesgo-overview {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 25px;
  }

  .filtro-riesgo {
    margin-bottom: 20px;
  }

  .filtro-riesgo label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .filtro-riesgo select {
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .riesgo-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-bottom: 20px;
  }

  .riesgo-stat {
    background: white;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
  }

  .riesgo-stat-value {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 5px;
  }

  .riesgo-stat-label {
    font-size: 0.9rem;
    color: #6c757d;
  }

  .riesgo-item {
    background: white;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 10px;
  }

  .analisis-individual {
    margin-top: 30px;
  }

  .analisis-selector {
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .analisis-selector label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .analisis-selector select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 1rem;
  }

  .analisis-dashboard {
    display: flex;
    flex-direction: column;
    gap: 25px;
  }

  .riesgo-card {
    background: white;
    padding: 25px;
    border-radius: 8px;
    border: 3px solid;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .riesgo-card h4 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .riesgo-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e9ecef;
  }

  .riesgo-puntaje {
    text-align: center;
  }

  .puntaje-value {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 5px;
  }

  .puntaje-label {
    font-size: 0.9rem;
    color: #6c757d;
  }

  .badge-riesgo {
    padding: 10px 20px;
    border-radius: 20px;
    color: white;
    font-weight: 600;
    font-size: 1.1rem;
  }

  .factores-riesgo h5 {
    margin: 0 0 15px 0;
    color: #495057;
  }

  .factores-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .factor-item {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .factor-label {
    font-weight: 600;
    color: #495057;
  }

  .factor-value {
    font-weight: 700;
    color: #333;
  }

  .recomendaciones-section {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .recomendaciones-section h4 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .recomendacion-box {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid #667eea;
  }

  .recomendacion-box h5 {
    margin: 0 0 15px 0;
    color: #495057;
  }

  .recomendacion-box ul {
    margin: 0;
    padding-left: 20px;
  }

  .recomendacion-box li {
    margin-bottom: 8px;
    line-height: 1.6;
    color: #333;
  }

  .datos-resumen {
    background: white;
    padding: 20px;
    border-radius: 8px;
    border: 2px solid #e9ecef;
  }

  .datos-resumen h4 {
    margin: 0 0 15px 0;
    color: #333;
  }

  .datos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .dato-item {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dato-item span {
    color: #6c757d;
    font-weight: 500;
  }

  .dato-item strong {
    color: #333;
    font-size: 1.1rem;
  }

  .padres-section {
    margin: 15px 0;
  }

  .padres-section label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .padres-section textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: monospace;
    box-sizing: border-box;
  }

  .padres-section small {
    display: block;
    margin-top: 5px;
    color: #6c757d;
    font-size: 0.85rem;
  }

  .encuestas-stats {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 25px;
  }

  .encuestas-stats h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .encuestas-filters {
    margin-bottom: 20px;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .encuestas-filters label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .encuestas-filters select {
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 0.9rem;
  }

  .encuestas-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 30px;
  }

  .encuesta-item {
    background: white;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid #667eea;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .encuesta-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 12px;
  }

  .encuesta-icon {
    font-size: 1.5rem;
  }

  .encuesta-info {
    flex: 1;
  }

  .encuesta-info strong {
    display: block;
    color: #333;
    margin-bottom: 4px;
  }

  .encuesta-info small {
    color: #6c757d;
    font-size: 0.85rem;
  }

  .calificacion-stars {
    font-size: 1.2rem;
    color: #ffc107;
  }

  .encuesta-comentario {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 6px;
    margin: 10px 0;
    color: #333;
    line-height: 1.6;
  }

  .encuesta-autor {
    display: block;
    margin-top: 10px;
    color: #6c757d;
    font-size: 0.85rem;
  }

  .badge-revisada {
    background: #28a745;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .btn-small {
    padding: 6px 12px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    margin-top: 8px;
  }

  .btn-small:hover {
    background: #5568d3;
  }

  .feedback-maestros-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-top: 30px;
  }

  .feedback-maestros-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .feedback-maestros-section label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #495057;
  }

  .feedback-maestros-section select,
  .feedback-maestros-section input,
  .feedback-maestros-section textarea {
    width: 100%;
    padding: 10px;
    margin-bottom: 15px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .feedback-maestros-section textarea {
    resize: vertical;
  }

  .feedback-maestros-section button {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }
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
    width: 100%;
    background: #f8f9fa;
    min-height: 100vh;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 30px;
    background: white;
    border-bottom: 2px solid #e9ecef;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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

  .admin-layout {
    display: flex;
    gap: 0;
    min-height: calc(100vh - 80px);
  }

  .sidebar {
    width: 260px;
    background: white;
    border-right: 2px solid #e9ecef;
    padding: 20px 0;
    position: sticky;
    top: 80px;
    height: calc(100vh - 80px);
    overflow-y: auto;
    overflow-x: hidden;
    flex-shrink: 0;
    scrollbar-width: thin;
    scrollbar-color: #667eea #f8f9fa;
  }

  .sidebar::-webkit-scrollbar {
    width: 6px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: #f8f9fa;
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: #667eea;
    border-radius: 3px;
  }

  .sidebar::-webkit-scrollbar-thumb:hover {
    background: #5568d3;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 10px;
  }

  .sidebar-nav button {
    padding: 12px 16px;
    border: none;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    text-align: left;
    transition: all 0.2s;
    color: #495057;
    font-size: 14px;
  }

  .sidebar-nav button:hover {
    background: #f8f9fa;
  }

  .sidebar-nav button.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .main-content {
    flex: 1;
    padding: 30px;
    overflow-x: hidden;
  }

  .stats-overview {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .stat-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 24px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
  }

  .stat-value {
    font-size: 2.5rem;
    font-weight: bold;
    margin-bottom: 8px;
  }

  .stat-label {
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .content {
    width: 100%;
  }

  .section {
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    margin-bottom: 30px;
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

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 30px;
  }

  .dashboard-card {
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    text-align: center;
  }

  .dashboard-card h3 {
    margin: 0 0 15px 0;
    color: #667eea;
    font-size: 1.1rem;
  }

  .dashboard-value {
    font-size: 3rem;
    font-weight: bold;
    color: #667eea;
    margin: 10px 0;
  }

  .dashboard-card p {
    color: #666;
    font-size: 0.9rem;
    margin: 10px 0 0 0;
  }

  .pending-badge {
    display: inline-block;
    background: #f39c12;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 0.85rem;
    margin-top: 10px;
  }

  .dashboard-recent {
    background: white;
    padding: 25px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-top: 20px;
  }

  .dashboard-recent h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .search-box {
    margin-bottom: 20px;
  }

  .search-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #667eea;
  }

  .empty-state {
    text-align: center;
    color: #999;
    padding: 40px;
    font-style: italic;
  }

  .grupo-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .grupo-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    width: 100%;
  }

  .grupo-alumnos {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #e0e0e0;
    width: 100%;
  }

  .grupo-alumnos strong {
    display: block;
    margin-bottom: 10px;
    color: #333;
    font-size: 0.9rem;
  }

  .alumnos-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .alumno-tag {
    background: #667eea;
    color: white;
    padding: 6px 12px;
    border-radius: 16px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .dashboard-impact {
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-top: 30px;
  }

  .dashboard-impact h2 {
    margin: 0 0 25px 0;
    color: #333;
    font-size: 1.5rem;
  }

  .impact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 24px;
    margin-bottom: 30px;
  }

  .impact-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 25px;
    border-radius: 12px;
    text-align: center;
  }

  .impact-card h3 {
    margin: 0 0 15px 0;
    font-size: 1rem;
    opacity: 0.9;
  }

  .impact-value {
    font-size: 2.5rem;
    font-weight: bold;
    margin: 10px 0;
  }

  .impact-card p {
    margin: 10px 0 0 0;
    font-size: 0.85rem;
    opacity: 0.9;
  }

  .temas-section {
    margin-top: 30px;
    padding-top: 30px;
    border-top: 2px solid #f0f0f0;
  }

  .temas-section h3 {
    margin: 0 0 20px 0;
    color: #333;
  }

  .temas-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .tema-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #667eea;
  }

  .tema-nombre {
    font-weight: 600;
    color: #333;
    text-transform: capitalize;
  }

  .tema-count {
    color: #667eea;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .alertas-box {
    background: #fff3cd;
    border: 2px solid #ffc107;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 25px;
  }

  .alertas-box h3 {
    margin: 0 0 15px 0;
    color: #856404;
  }

  .alertas-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .alerta-item {
    background: white;
    padding: 12px 15px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .alerta-item strong {
    color: #333;
  }

  .alerta-promedio {
    background: #dc3545;
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .badge-bajo {
    background: #dc3545;
    color: white;
  }

  .badge-excelente {
    background: #28a745;
    color: white;
  }

  .notificaciones-box {
    background: #d1ecf1;
    border: 2px solid #0c5460;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 25px;
  }

  .notificaciones-box h3 {
    margin: 0 0 15px 0;
    color: #0c5460;
  }

  .notificaciones-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .notificacion-item {
    background: white;
    padding: 12px 15px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
  }

  .notificacion-item button {
    padding: 6px 12px;
    background: #0c5460;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .notificacion-item button:hover {
    background: #0a4550;
  }

  .mensajeria-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    margin-bottom: 25px;
  }

  @media (max-width: 1024px) {
    .mensajeria-container {
      grid-template-columns: 1fr;
    }
  }

  .mensajeria-form, .respuestas-rapidas-section {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
  }

  .respuestas-rapidas-selector {
    margin: 15px 0;
    padding: 10px;
    background: #e9ecef;
    border-radius: 6px;
  }

  .respuestas-rapidas-selector label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #495057;
  }

  .mensajes-list {
    margin-top: 25px;
  }

  .badge-leido {
    background: #28a745;
    color: white;
  }

  .badge-no-leido {
    background: #ffc107;
    color: #333;
  }

  .reportes-container {
    width: 100%;
  }

  .reportes-selector {
    margin-bottom: 25px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .reportes-selector h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .reportes-selector select {
    width: 100%;
    padding: 12px;
    border: 2px solid #667eea;
    border-radius: 6px;
    font-size: 16px;
  }

  .reportes-params {
    display: flex;
    gap: 20px;
    margin-bottom: 25px;
    flex-wrap: wrap;
  }

  .param-group {
    flex: 1;
    min-width: 200px;
  }

  .param-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
  }

  .param-group input {
    width: 100%;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .reportes-actions {
    margin-bottom: 25px;
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
  }

  .btn-primary {
    padding: 12px 24px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 16px;
  }

  .btn-primary:hover {
    background: #5568d3;
  }

  .export-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .btn-export {
    padding: 10px 20px;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
  }

  .btn-export:hover {
    background: #218838;
  }

  .reporte-preview {
    margin-top: 30px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .reporte-preview h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .reporte-preview pre {
    background: white;
    padding: 15px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 12px;
    line-height: 1.5;
    max-height: 500px;
    overflow-y: auto;
  }

  .asistencia-controls {
    display: flex;
    gap: 15px;
    margin-bottom: 25px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .control-group {
    flex: 1;
    min-width: 200px;
  }

  .control-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
  }

  .control-group select {
    width: 100%;
    padding: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .btn-secondary {
    padding: 10px 20px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    height: fit-content;
  }

  .btn-secondary:hover {
    background: #5a6268;
  }

  .estadisticas-box {
    margin: 25px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .estadisticas-box h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .estadisticas-box h4 {
    margin-top: 20px;
    margin-bottom: 10px;
    color: #555;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
  }

  .stat-item {
    padding: 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid #ddd;
  }

  .stat-item strong {
    display: block;
    margin-bottom: 5px;
    color: #333;
    font-size: 0.9rem;
  }

  .stat-item .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #667eea;
  }

  .patron-item {
    padding: 10px;
    margin: 8px 0;
    background: white;
    border-radius: 6px;
    border-left: 4px solid #667eea;
  }

  .patron-item strong {
    display: block;
    margin-bottom: 5px;
    color: #333;
  }

  .patron-item small {
    color: #666;
  }

  .tareas-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 25px;
    border-bottom: 2px solid #ddd;
  }

  .tareas-tabs button {
    padding: 10px 20px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font-weight: 600;
    color: #666;
  }

  .tareas-tabs button.active {
    color: #667eea;
    border-bottom-color: #667eea;
  }

  .tareas-tabs button:hover {
    color: #667eea;
  }

  .tarea-vencida {
    border-left: 4px solid #dc3545 !important;
    background: #fff5f5;
  }

  .badge-vencida {
    background: #dc3545;
    color: white;
  }

  .badge-calificada {
    background: #28a745;
    color: white;
  }

  .badge-entregada {
    background: #17a2b8;
    color: white;
  }

  .badge-pendiente {
    background: #ffc107;
    color: #333;
  }

  .fechas-importantes-box {
    margin: 25px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .fechas-importantes-box h3 {
    margin-bottom: 20px;
    color: #333;
  }

  .fechas-section {
    margin-bottom: 20px;
  }

  .fechas-section h4 {
    margin-bottom: 10px;
    color: #555;
    font-size: 1rem;
  }

  .tarea-detalle {
    padding: 20px;
    background: white;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .btn-back {
    padding: 8px 15px;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 20px;
  }

  .tarea-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 6px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .info-item strong {
    color: #333;
    font-size: 0.9rem;
  }

  .entregas-section {
    margin-top: 25px;
    padding-top: 25px;
    border-top: 2px solid #ddd;
  }

  .entregas-section h4 {
    margin-bottom: 15px;
    color: #333;
  }

  .entrega-item {
    padding: 15px;
    margin-bottom: 15px;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 4px solid #667eea;
  }

  .calificacion-display {
    margin-top: 10px;
    padding: 10px;
    background: white;
    border-radius: 6px;
  }

  .calificacion-form {
    margin-top: 10px;
    padding: 15px;
    background: white;
    border-radius: 6px;
    border: 1px solid #ddd;
  }

  .calificacion-form h5 {
    margin-bottom: 10px;
    color: #333;
  }

  .calificacion-form input,
  .calificacion-form textarea {
    width: 100%;
    padding: 8px;
    margin-bottom: 10px;
    border: 2px solid #ddd;
    border-radius: 6px;
  }

  .calendario-box {
    margin-top: 30px;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  .calendario-box h3 {
    margin-bottom: 20px;
    color: #333;
  }

  .calendario-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 15px;
  }

  .calendario-dia {
    padding: 15px;
    background: white;
    border-radius: 6px;
    border: 1px solid #ddd;
    min-height: 120px;
  }

  .calendario-dia strong {
    display: block;
    margin-bottom: 10px;
    color: #333;
    font-size: 0.9rem;
  }

  .calendario-item {
    font-size: 0.8rem;
    padding: 4px 8px;
    margin: 4px 0;
    border-radius: 4px;
    background: #f0f0f0;
  }

  .calendario-item.tarea {
    background: #e3f2fd;
    border-left: 3px solid #2196f3;
  }

  .calendario-item.evento {
    background: #fff3e0;
    border-left: 3px solid #ff9800;
  }

  .recursos-controls {
    display: flex;
    gap: 15px;
    margin-bottom: 25px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .recursos-filtros {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }

  .recursos-filtros button {
    padding: 8px 15px;
    background: #f0f0f0;
    border: 2px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    color: #666;
  }

  .recursos-filtros button.active {
    background: #667eea;
    color: white;
    border-color: #667eea;
  }

  .recurso-item {
    border-left: 4px solid #667eea;
  }

  .tags {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .tag {
    background: #e3f2fd;
    color: #1976d2;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .badge-learning {
    background: #9c27b0;
    color: white;
  }

  .recomendaciones-box {
    margin: 25px 0;
    padding: 20px;
    background: #f0f4ff;
    border-radius: 8px;
    border: 1px solid #667eea;
  }

  .recomendaciones-box h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .recomendacion-item {
    background: white;
    border-left: 4px solid #667eea;
  }

  .recomendacion-razon {
    margin-top: 8px;
    padding: 8px;
    background: #fff9e6;
    border-radius: 4px;
    font-style: italic;
    color: #666;
  }

  .badge-alta {
    background: #dc3545;
    color: white;
  }

  .badge-media {
    background: #ffc107;
    color: #333;
  }

  .badge-baja {
    background: #28a745;
    color: white;
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .dashboard-grid {
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    
    .impact-grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .admin-layout {
      flex-direction: column;
    }

    .sidebar {
      width: 100%;
      height: auto;
      position: relative;
      top: 0;
      border-right: none;
      border-bottom: 2px solid #e9ecef;
      max-height: 300px;
    }

    .sidebar-nav {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px;
    }

    .sidebar-nav button {
      flex: 1 1 auto;
      min-width: 120px;
      text-align: center;
      padding: 10px 12px;
      font-size: 13px;
    }

    .main-content {
      padding: 20px;
    }

    .stats-overview {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 15px;
    }

    .stat-card {
      padding: 18px;
    }

    .stat-value {
      font-size: 2rem;
    }

    .dashboard-grid {
      grid-template-columns: 1fr;
      gap: 15px;
    }

    .impact-grid {
      grid-template-columns: 1fr;
      gap: 15px;
    }

    header {
      padding: 15px 20px;
      flex-wrap: wrap;
      gap: 10px;
    }

    header h1 {
      font-size: 1.2rem;
    }

    .section {
      padding: 20px;
    }
  }

  @media (max-width: 480px) {
    .main-content {
      padding: 15px;
    }

    .stats-overview {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .stat-card {
      padding: 15px;
    }

    .stat-value {
      font-size: 1.8rem;
    }

    .stat-label {
      font-size: 0.8rem;
    }

    .sidebar-nav button {
      min-width: 100px;
      font-size: 12px;
      padding: 8px 10px;
    }

    header {
      padding: 12px 15px;
    }

    header h1 {
      font-size: 1rem;
    }

    .section {
      padding: 15px;
    }
  }
</style>

