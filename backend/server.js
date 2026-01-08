import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from './utils/db.js';

// Importar rutas
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import maestrosRoutes from './routes/maestros.js';
import alumnosRoutes from './routes/alumnos.js';
import espaciosRoutes from './routes/espacios.js';
import gruposRoutes from './routes/grupos.js';
import citasRoutes from './routes/citas.js';
import publicRoutes from './routes/public.js';
import calificacionesRoutes from './routes/calificaciones.js';
import asistenciaRoutes from './routes/asistencia.js';
import mensajeriaRoutes from './routes/mensajeria.js';
import accesibilidadRoutes from './routes/accesibilidad.js';
import progresoRoutes from './routes/progreso.js';
import analisisPredictivoRoutes from './routes/analisis-predictivo.js';
import padresRoutes from './routes/padres.js';
import encuestasRoutes from './routes/encuestas.js';
import escuelasRoutes from './routes/escuelas.js';
import reportesRoutes from './routes/reportes.js';
import tareasRoutes from './routes/tareas.js';
import recursosRoutes from './routes/recursos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'uploads')));

// Rutas
app.use(chatRoutes);
app.use(adminRoutes);
app.use(maestrosRoutes);
app.use(alumnosRoutes);
app.use(espaciosRoutes);
app.use(gruposRoutes);
app.use(citasRoutes);
app.use(publicRoutes);
app.use(calificacionesRoutes);
app.use(asistenciaRoutes);
app.use(mensajeriaRoutes);
app.use(accesibilidadRoutes);
app.use(progresoRoutes);
app.use(analisisPredictivoRoutes);
app.use(padresRoutes);
app.use(encuestasRoutes);
app.use(escuelasRoutes);
app.use(reportesRoutes);
app.use(tareasRoutes);
app.use(recursosRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Iniciar servidor
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

startServer();
