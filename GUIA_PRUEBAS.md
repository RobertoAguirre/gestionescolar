# 🧪 Guía para Probar la Aplicación

## 📋 Requisitos Previos

1. **Node.js** instalado (versión 18 o superior)
2. **MongoDB Atlas** - Base de datos en la nube (gratis)
3. **API Keys**:
   - Anthropic API Key (para Claude)
   - Wasabi credentials (opcional, para recursos)

## 🚀 Pasos para Probar

### 1. Instalar Dependencias

```bash
# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

### 2. Configurar Variables de Entorno

Crea o edita el archivo `backend/.env` con:

```env
# Base de datos MongoDB
MONGODB_URI=tu_url_de_mongodb_atlas

# API de IA (Anthropic Claude)
ANTHROPIC_API_KEY=tu_clave_api_anthropic

# Contraseña del panel de administración
ADMIN_PASSWORD=admin123

# Puerto del servidor
PORT=3000

# Entorno
NODE_ENV=development

# Wasabi (opcional, para recursos)
WASABI_ENDPOINT=https://s3.wasabisys.com
WASABI_REGION=us-east-1
WASABI_ACCESS_KEY=tu_access_key
WASABI_SECRET_KEY=tu_secret_key
WASABI_BUCKET=gestionescolar-recursos
```

### 3. Iniciar el Backend

En una terminal:

```bash
cd backend
npm run dev
```

El servidor debería iniciar en `http://localhost:3000`

### 4. Iniciar el Frontend

En otra terminal:

```bash
cd frontend
npm run dev
```

El frontend debería iniciar en `http://localhost:5173`

### 5. Acceder a la Aplicación

Abre tu navegador en: **http://localhost:5173**

## 🧪 Pruebas Básicas

### 1. Probar el Chatbot

1. Abre la aplicación en el navegador
2. En el chatbot, prueba preguntas como:
   - "¿Cuáles son los horarios de clases?"
   - "¿Qué eventos hay próximamente?"
   - "Necesito información sobre planes de pago"

### 2. Probar el Panel de Administración

1. Haz clic en el botón **"⚙️ Admin"** (esquina superior derecha)
2. Ingresa la contraseña: `admin123`
3. Explora las diferentes secciones:
   - **Dashboard**: Ver estadísticas generales
   - **Horarios**: Agregar/editar horarios
   - **Eventos**: Crear eventos escolares
   - **Planes de Pago**: Gestionar planes
   - **Maestros**: CRUD de maestros
   - **Alumnos**: CRUD de alumnos
   - **Grupos**: Gestionar grupos
   - **Espacios**: Gestionar aulas/laboratorios
   - **Citas**: Ver y gestionar citas
   - **Calificaciones**: Registrar calificaciones
   - **Asistencia**: Registrar asistencia
   - **Tareas**: Crear y gestionar tareas
   - **Recursos**: Subir y compartir recursos
   - Y más...

### 3. Probar Funcionalidades Específicas

#### Crear un Maestro
1. Ve a **Maestros** en el panel admin
2. Completa el formulario
3. Guarda
4. Verifica que aparezca en la lista

#### Crear un Alumno
1. Ve a **Alumnos** en el panel admin
2. Completa el formulario (asigna a un grupo)
3. Guarda
4. Verifica que aparezca en la lista

#### Crear una Tarea
1. Ve a **Tareas y Actividades**
2. Completa el formulario
3. Asigna a un grupo o alumnos específicos
4. Guarda
5. Verifica en el calendario académico

#### Subir un Recurso
1. Ve a **Recursos y Materiales**
2. Completa el formulario
3. Selecciona un archivo (si no es enlace)
4. Guarda
5. Verifica que aparezca en la lista

#### Probar Recomendaciones con IA
1. Ve a **Recursos y Materiales**
2. Haz clic en **"🤖 Recomendaciones con IA"**
3. Espera a que se generen las recomendaciones

## 🔍 Verificar que Todo Funciona

### Backend
- ✅ El servidor inicia sin errores
- ✅ Se conecta a MongoDB
- ✅ Las rutas responden correctamente

### Frontend
- ✅ La aplicación carga sin errores
- ✅ El chatbot responde
- ✅ El panel admin se puede acceder
- ✅ Los formularios funcionan

## 🐛 Solución de Problemas

### Error: "Cannot connect to MongoDB"
- Verifica que `MONGODB_URI` esté correcto en `.env`
- Verifica que tu IP esté en la whitelist de MongoDB Atlas

### Error: "API Key inválida"
- Verifica que `ANTHROPIC_API_KEY` esté correcto
- Asegúrate de tener créditos en tu cuenta de Anthropic

### Error: "Puerto en uso"
- Cambia el `PORT` en `.env` a otro puerto (ej: 3001)
- O cierra el proceso que está usando el puerto

### Error: "Module not found"
- Ejecuta `npm install` en el directorio correspondiente
- Verifica que todas las dependencias estén instaladas

## 📝 Notas Importantes

- **Primera vez**: La base de datos estará vacía, agrega datos desde el panel admin
- **Chatbot**: Necesita datos en la BD para responder preguntas específicas
- **Recursos**: Requiere Wasabi configurado para subir archivos
- **Multi-escuela**: El sistema soporta múltiples escuelas, usa el header `X-Escuela-Id`

## 🎯 Pruebas Recomendadas por Módulo

1. **Sistema Base**: Horarios, Eventos, Planes, Info
2. **Gestión**: Maestros, Alumnos, Grupos, Espacios
3. **Citas**: Crear citas desde el chatbot y gestionarlas
4. **Académico**: Calificaciones, Asistencia, Tareas
5. **Comunicación**: Notificaciones, Mensajería
6. **IA**: Chatbot, Análisis Predictivo, Recomendaciones
7. **Recursos**: Subir archivos, compartir, recomendaciones
8. **Reportes**: Generar y exportar reportes

¡Listo para probar! 🚀
