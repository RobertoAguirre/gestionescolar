<script>
  import { onMount } from 'svelte';
  
  let messages = [];
  let inputMessage = '';
  let isLoading = false;
  let showCitaForm = false;
  let fileInput;
  let history = [];

  onMount(() => {
    messages = [{
      role: 'assistant',
      content: '¡Hola! Soy tu asistente virtual. Puedo ayudarte con horarios, eventos, desempeño escolar, planes de pago y más. ¿En qué puedo ayudarte?'
    }];
  });

  async function sendMessage() {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = { role: 'user', content: inputMessage };
    messages = [...messages, userMsg];
    history.push(userMsg);
    const currentInput = inputMessage;
    inputMessage = '';
    isLoading = true;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentInput,
          history: history.slice(-10) // Últimos 10 mensajes
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
    
    const citaData = {
      nombre: formData.get('nombre'),
      email: formData.get('email'),
      telefono: formData.get('telefono'),
      motivo: formData.get('motivo'),
      fecha: formData.get('fecha'),
      tipo: formData.get('tipo')
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
          content: `✅ Cita agendada exitosamente para ${citaData.fecha}. Te contactaremos pronto.`
        }];
        showCitaForm = false;
        event.target.reset();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error agendando la cita');
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

  <div class="messages-container">
    {#each messages as msg}
      <div class="message {msg.role}">
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
        <select name="tipo" required>
          <option value="">Selecciona tipo</option>
          <option value="directivo">Directivo</option>
          <option value="profesor">Profesor</option>
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
  </div>
</div>

<style>
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
</style>

