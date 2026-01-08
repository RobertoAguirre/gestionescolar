# Sistema de Gestión Escolar con Asistente IA

Aplicación web con chatbot asistente usando Google Claude para ayudar a padres de familia con información escolar.

## 🚀 Características

- 💬 Chatbot conversacional con Google Claude
- 📷 Análisis de imágenes (recibos de pago, documentos)
- 📅 Sistema de agendamiento de citas
- ⚙️ **Panel de administración para entrenar el bot**
- 🎨 Interfaz minimalista y amigable
- 📱 Preparado para cliente móvil futuro

## 🛠️ Tecnologías

- **Frontend**: Svelte + Vite
- **Backend**: Node.js + Express
- **Base de datos**: MongoDB Atlas
- **IA**: Google Claude (Anthropic API)

## 📦 Instalación

1. Instalar dependencias:
```bash
npm run install:all
```

2. Configurar variables de entorno en `backend/.env`:
```env
MONGODB_URI=tu_url_de_mongodb_atlas
ANTHROPIC_API_KEY=tu_clave_api_anthropic
ADMIN_PASSWORD=admin123
PORT=3000
NODE_ENV=development
```

3. Iniciar la aplicación:

```bash
npm run dev
```

Esto iniciará tanto el backend como el frontend simultáneamente.

4. Abrir en navegador: `http://localhost:5173`

## 📁 Estructura

```
GestionEscolar/
├── backend/
│   ├── server.js          # Servidor Express
│   ├── package.json
│   └── .env              # Variables de entorno
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chatbot.svelte
│   │   │   └── AdminPanel.svelte
│   │   ├── App.svelte
│   │   ├── main.js
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔧 Funcionalidades

### Chat
- Conversación natural con el asistente
- Historial de mensajes
- Respuestas contextuales

### Análisis de Imágenes
- Subida de imágenes (recibos, documentos)
- Análisis automático con Claude Vision
- Respuestas sobre el contenido

### Agendamiento de Citas
- Formulario integrado
- Selección de tipo (directivo/profesor)
- Almacenamiento en MongoDB

### Panel de Administración
- 🔐 Autenticación con contraseña
- 📊 Estadísticas de uso (conversaciones, citas)
- 📅 Gestión de horarios escolares
- 🎉 Gestión de eventos
- 💰 Gestión de planes de pago
- ℹ️ Información general del bot
- 📋 Gestión de citas (confirmar/cancelar)
- 🤖 El bot se entrena automáticamente con la información agregada

**Acceso**: Click en el botón "⚙️ Admin" en la esquina superior derecha

## 📝 Notas

- El asistente puede ayudar con: horarios, eventos, desempeño escolar, planes de pago
- Las conversaciones se guardan en MongoDB
- Las imágenes se procesan temporalmente y luego se eliminan
- **El bot utiliza la información del panel admin para responder preguntas específicas**
- Cambia `ADMIN_PASSWORD` en producción por seguridad

