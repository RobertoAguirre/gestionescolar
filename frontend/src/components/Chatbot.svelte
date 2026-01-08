<script>
  import { onMount } from 'svelte';
  
  let messages = [];
  let inputMessage = '';
  let isLoading = false;
  let showCitaForm = false;
  let modoAccesible = false;
  let textoSimplificado = false;
  let lecturaPantalla = false;
  let respuestasCortas = false;
  let alumnoSeleccionado = '';
  let perfilAccesibilidad = null;
  let fileInput;
  let history = [];
  let maestros = [];
  let alumnos = [];
  let maestroSelect;
  let tipoCitaSelect;
  let showMaestroSelect = false;
  let showEncuestaForm = false;
  let encuestaTipo = 'chatbot';
  let encuestaCalificacion = 5;
  let encuestaComentarios = '';
  let encuestaNombre = '';
  let encuestaEmail = '';

  onMount(async () => {
    messages = [{
      role: 'assistant',
      content: '¡Hola! Soy tu asistente virtual. Puedo ayudarte con horarios, eventos, desempeño escolar, planes de pago y más. ¿En qué puedo ayudarte?'
    }];
    await loadMaestrosYAlumnos();
  });

  async function enviarEncuesta() {
    if (!encuestaCalificacion) {
      alert('Por favor selecciona una calificación');
      return;
    }
    
    try {
      const res = await fetch('/api/encuestas/satisfaccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: encuestaTipo,
          calificacion: encuestaCalificacion,
          comentarios: encuestaComentarios,
          nombre: encuestaNombre,
          email: encuestaEmail
        })
      });
      
      if (res.ok) {
        alert('¡Gracias por tu feedback!');
        showEncuestaForm = false;
        encuestaCalificacion = 5;
        encuestaComentarios = '';
        encuestaNombre = '';
        encuestaEmail = '';
      } else {
        alert('Error enviando encuesta');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error enviando encuesta');
    }
  }

  async function loadMaestrosYAlumnos() {
    try {
      const [maestrosRes, alumnosRes] = await Promise.all([
        fetch('/api/maestros'),
        fetch('/api/alumnos')
      ]);
      maestros = await maestrosRes.json();
      alumnos = await alumnosRes.json();
      
      // Cargar perfil de accesibilidad si hay un alumno seleccionado
      if (alumnoSeleccionado) {
        await cargarPerfilAccesibilidad(alumnoSeleccionado);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  }

  async function cargarPerfilAccesibilidad(alumnoId) {
    try {
      const response = await fetch(`/api/admin/accesibilidad/${alumnoId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken') || ''}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.perfilAccesibilidad) {
          perfilAccesibilidad = data.perfilAccesibilidad;
          modoAccesible = perfilAccesibilidad.modoAccesible || false;
          textoSimplificado = perfilAccesibilidad.textoSimplificado || false;
          lecturaPantalla = perfilAccesibilidad.lecturaPantalla || false;
          respuestasCortas = perfilAccesibilidad.respuestasCortas || false;
        }
      }
    } catch (error) {
      console.error('Error cargando perfil de accesibilidad:', error);
    }
  }

  function handleAlumnoChange() {
    if (alumnoSeleccionado) {
      cargarPerfilAccesibilidad(alumnoSeleccionado);
    } else {
      // Resetear perfil si no hay alumno seleccionado
      modoAccesible = false;
      textoSimplificado = false;
      lecturaPantalla = false;
      respuestasCortas = false;
      perfilAccesibilidad = null;
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = { role: 'user', content: inputMessage };
    messages = [...messages, userMsg];
    history.push(userMsg);
    const currentInput = inputMessage;
    inputMessage = '';
    isLoading = true;

    try {
      // Construir perfil de accesibilidad
      const perfilAccesibilidad = {
        modoAccesible: modoAccesible,
        textoSimplificado: textoSimplificado,
        lecturaPantalla: lecturaPantalla,
        respuestasCortas: respuestasCortas
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentInput,
          history: history.slice(-10), // Últimos 10 mensajes
          alumnoId: alumnoSeleccionado || null,
          perfilAccesibilidad: Object.values(perfilAccesibilidad).some(v => v) ? perfilAccesibilidad : null
        })
      });

      const data = await response.json();
      const assistantMsg = { role: 'assistant', content: data.message };
      messages = [...messages, assistantMsg];
      history.push(assistantMsg);

      // Detectar si el asistente sugiere agendar cita
      if (data.message.toLowerCase().includes('cita') || data.message.toLowerCase().includes('agendar')) {
        showCitaForm = true;
      }
    } catch (error) {
      console.error('Error:', error);
      messages = [...messages, {
        role: 'assistant',
        content: 'Lo siento, hubo un error. Por favor intenta de nuevo.'
      }];
    } finally {
      isLoading = false;
    }
  }

  async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen');
      return;
    }

    isLoading = true;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('message', 'Analiza este recibo de pago o documento escolar');
    
    // Agregar perfil de accesibilidad si está activo
    const perfilAccesibilidad = {
      modoAccesible: modoAccesible,
      textoSimplificado: textoSimplificado,
      lecturaPantalla: lecturaPantalla,
      respuestasCortas: respuestasCortas
    };
    if (Object.values(perfilAccesibilidad).some(v => v)) {
      formData.append('perfilAccesibilidad', JSON.stringify(perfilAccesibilidad));
    }
    if (alumnoSeleccionado) {
      formData.append('alumnoId', alumnoSeleccionado);
    }

    try {
      const response = await fetch('/api/chat/image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      messages = [...messages, 
        { role: 'user', content: '📷 Imagen enviada' },
        { role: 'assistant', content: data.message }
      ];
    } catch (error) {
      console.error('Error:', error);
      messages = [...messages, {
        role: 'assistant',
        content: 'Error procesando la imagen. Por favor intenta de nuevo.'
      }];
    } finally {
      isLoading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  async function submitCita(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const nombre = formData.get('nombre');
    const email = formData.get('email');
    const fecha = formData.get('fecha');
    const tipo = formData.get('tipo');
    const maestroId = formData.get('maestroId');
    const alumnoId = formData.get('alumnoId');
    
    if (!nombre || !nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('El email es requerido y debe ser válido');
      return;
    }
    
    if (!fecha) {
      alert('La fecha es requerida');
      return;
    }
    
    try {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) {
        alert('La fecha no es válida');
        return;
      }
      if (fechaObj < new Date()) {
        alert('La fecha no puede ser en el pasado');
        return;
      }
    } catch (error) {
      alert('Error validando la fecha');
      return;
    }
    
    if (tipo === 'maestro') {
      if (!maestroId || !maestroId.trim()) {
        alert('Debes seleccionar un maestro');
        return;
      }
    }
    
    const citaData = {
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: formData.get('telefono') || '',
      motivo: formData.get('motivo') || '',
      fecha,
      tipo,
      maestroId: (tipo === 'maestro' && maestroId) ? maestroId : null,
      alumnoId: (alumnoId && alumnoId.trim()) ? alumnoId : null
    };

    try {
      const response = await fetch('/api/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(citaData)
      });

      const data = await response.json();
      if (data.success) {
        messages = [...messages, {
          role: 'assistant',
          content: `✅ Cita agendada exitosamente para ${new Date(citaData.fecha).toLocaleString('es-ES')}. Te contactaremos pronto.`
        }];
        showCitaForm = false;
        showMaestroSelect = false;
        event.target.reset();
        if (maestroSelect) maestroSelect.value = '';
      } else {
        alert(data.error || 'Error agendando la cita');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error agendando la cita');
    }
  }

  function handleTipoChange(event) {
    const tipo = event.target.value;
    showMaestroSelect = tipo === 'maestro';
    if (tipo !== 'maestro' && maestroSelect) {
      maestroSelect.value = '';
    }
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chatbot-container">
  <div class="chatbot-header">
    <h1>💬 Asistente Escolar</h1>
  </div>
  
  <!-- Panel de accesibilidad -->
  <div class="accesibilidad-panel">
    <h3>⚙️ Configuración de Accesibilidad</h3>
    <div class="accesibilidad-controls">
      <label>
        <input type="checkbox" bind:checked={modoAccesible} />
        Modo Accesible
      </label>
      <label>
        <input type="checkbox" bind:checked={textoSimplificado} />
        Texto Simplificado
      </label>
      <label>
        <input type="checkbox" bind:checked={lecturaPantalla} />
        Soporte Lectura de Pantalla
      </label>
      <label>
        <input type="checkbox" bind:checked={respuestasCortas} />
        Respuestas Cortas
      </label>
    </div>
    <div class="alumno-selector">
      <label>Seleccionar alumno (para cargar perfil automático):</label>
      <select bind:value={alumnoSeleccionado} on:change={handleAlumnoChange}>
        <option value="">Sin alumno específico</option>
        {#each alumnos as a}
          <option value={String(a._id)}>{a.nombre}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="messages-container">
    {#each messages as msg}
      <div class={`message ${msg.role}`}>
        <div class="message-content">
          {msg.content}
        </div>
      </div>
    {/each}
    {#if isLoading}
      <div class="message assistant">
        <div class="message-content typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    {/if}
  </div>

  {#if showCitaForm}
    <div class="cita-form">
      <h3>📅 Agendar Cita</h3>
      <form on:submit={submitCita}>
        <input type="text" name="nombre" placeholder="Nombre completo" required />
        <input type="email" name="email" placeholder="Email" required />
        <input type="tel" name="telefono" placeholder="Teléfono" />
        <select name="tipo" bind:this={tipoCitaSelect} required on:change={handleTipoChange}>
          <option value="">Selecciona tipo</option>
          <option value="directivo">Directivo</option>
          <option value="maestro">Maestro</option>
        </select>
        {#if showMaestroSelect}
          <select name="maestroId" bind:this={maestroSelect} required>
            <option value="">Selecciona un maestro</option>
            {#each maestros as m}
              <option value={String(m._id)}>{m.nombre} {m.especialidad ? `- ${m.especialidad}` : ''}</option>
            {/each}
          </select>
        {/if}
        <select name="alumnoId">
          <option value="">Selecciona un alumno (opcional)</option>
          {#each alumnos as a}
            <option value={String(a._id)}>{a.nombre}</option>
          {/each}
        </select>
        <input type="datetime-local" name="fecha" required />
        <textarea name="motivo" placeholder="Motivo de la cita" required></textarea>
        <div class="form-actions">
          <button type="submit">Agendar</button>
          <button type="button" on:click={() => showCitaForm = false}>Cancelar</button>
        </div>
    </form>
  </div>
{/if}

{#if showEncuestaForm}
  <div class="modal">
    <div class="modal-content">
      <h3>⭐ Encuesta de Satisfacción</h3>
      <p>¿Cómo calificarías tu experiencia con el chatbot?</p>
      <form on:submit|preventDefault={enviarEncuesta}>
        <label>
          Tipo de evaluación:
          <select bind:value={encuestaTipo}>
            <option value="chatbot">Chatbot</option>
            <option value="comunicacion">Comunicación</option>
            <option value="sistema">Sistema General</option>
          </select>
        </label>
        <label>
          Calificación (1-5 estrellas):
          <select bind:value={encuestaCalificacion}>
            <option value={1}>1 ⭐</option>
            <option value={2}>2 ⭐⭐</option>
            <option value={3}>3 ⭐⭐⭐</option>
            <option value={4}>4 ⭐⭐⭐⭐</option>
            <option value={5}>5 ⭐⭐⭐⭐⭐</option>
          </select>
        </label>
        <label>
          Comentarios (opcional):
          <textarea bind:value={encuestaComentarios} rows="3" placeholder="Tu opinión nos ayuda a mejorar..."></textarea>
        </label>
        <label>
          Nombre (opcional):
          <input type="text" bind:value={encuestaNombre} />
        </label>
        <label>
          Email (opcional):
          <input type="email" bind:value={encuestaEmail} />
        </label>
        <div class="modal-actions">
          <button type="submit">Enviar</button>
          <button type="button" on:click={() => showEncuestaForm = false}>Cancelar</button>
        </div>
      </form>
    </div>
  </div>
{/if}

  <div class="input-container">
    <input
      type="file"
      accept="image/*"
      bind:this={fileInput}
      on:change={handleImageUpload}
      style="display: none;"
      id="file-input"
    />
    <label for="file-input" class="file-button" title="Subir imagen">
      📷
    </label>
    <input
      type="text"
      bind:value={inputMessage}
      on:keypress={handleKeyPress}
      placeholder="Escribe tu mensaje..."
      disabled={isLoading}
    />
    <button on:click={sendMessage} disabled={isLoading || !inputMessage.trim()}>
      ➤
    </button>
    <button class="feedback-button" on:click={() => showEncuestaForm = true} title="Dar feedback">
      ⭐
    </button>
  </div>
</div>

<style>
  .accesibilidad-panel {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    margin: 15px;
    border: 2px solid #e9ecef;
  }

  .accesibilidad-panel h3 {
    margin: 0 0 15px 0;
    font-size: 1rem;
    color: #495057;
  }

  .accesibilidad-controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
    margin-bottom: 15px;
  }

  .accesibilidad-controls label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .accesibilidad-controls input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .alumno-selector {
    margin-top: 10px;
  }

  .alumno-selector label {
    display: block;
    margin-bottom: 5px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #495057;
  }

  .alumno-selector select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .chatbot-container {
    background: white;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    height: 80vh;
    max-height: 700px;
    overflow: hidden;
  }

  .chatbot-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    text-align: center;
  }

  .chatbot-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .message {
    display: flex;
    max-width: 75%;
    animation: fadeIn 0.3s;
  }

  .message.user {
    align-self: flex-end;
    margin-left: auto;
  }

  .message.assistant {
    align-self: flex-start;
  }

  .message-content {
    padding: 12px 16px;
    border-radius: 18px;
    word-wrap: break-word;
    line-height: 1.5;
  }

  .message.user .message-content {
    background: #667eea;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .message.assistant .message-content {
    background: #f0f0f0;
    color: #333;
    border-bottom-left-radius: 4px;
  }

  .typing {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
  }

  .typing span {
    width: 8px;
    height: 8px;
    background: #999;
    border-radius: 50%;
    animation: typing 1.4s infinite;
  }

  .typing span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-10px); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .cita-form {
    background: #f8f9fa;
    padding: 20px;
    border-top: 2px solid #667eea;
  }

  .cita-form h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .cita-form form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .cita-form input,
  .cita-form select,
  .cita-form textarea {
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 14px;
    width: 100%;
    margin-bottom: 10px;
  }

  .cita-form textarea {
    min-height: 80px;
    resize: vertical;
  }

  .form-actions {
    display: flex;
    gap: 10px;
  }

  .form-actions button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
  }

  .form-actions button[type="submit"] {
    background: #667eea;
    color: white;
  }

  .form-actions button[type="button"] {
    background: #e0e0e0;
    color: #333;
  }

  .input-container {
    display: flex;
    gap: 10px;
    padding: 15px;
    background: #f8f9fa;
    border-top: 1px solid #e0e0e0;
  }

  .file-button {
    background: #667eea;
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .file-button:hover {
    background: #5568d3;
  }

  .input-container input[type="text"] {
    flex: 1;
    padding: 12px 16px;
    border: 1px solid #ddd;
    border-radius: 12px;
    font-size: 14px;
    outline: none;
  }

  .input-container input[type="text"]:focus {
    border-color: #667eea;
  }

  .input-container button {
    background: #667eea;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.2rem;
    transition: background 0.2s;
  }

  .input-container button:hover:not(:disabled) {
    background: #5568d3;
  }

  .input-container button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .feedback-button {
    background: #ffc107;
    color: #333;
    padding: 12px 16px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    border: none;
  }

  .feedback-button:hover {
    background: #ffb300;
  }
</style>

