import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';
import dotenv from 'dotenv';

dotenv.config();

// Función para crear notificaciones (exportada para uso en otros módulos)
export async function crearNotificacion(titulo, mensaje, tipo, referenciaId = null, alumnoId = null, maestroId = null) {
  try {
    const db = getDB();
    await db.collection('notificaciones').insertOne({
      titulo,
      mensaje,
      tipo,
      referenciaId: referenciaId ? new ObjectId(referenciaId) : null,
      alumnoId: alumnoId ? new ObjectId(alumnoId) : null,
      maestroId: maestroId ? new ObjectId(maestroId) : null,
      leida: false,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error creando notificación:', error);
  }
}

// Función para crear notificaciones automáticas (exportada para uso en otros módulos)
export async function crearNotificacionAutomatica(tipo, datos, escuelaId = null) {
  try {
    const db = getDB();
    const notificationData = {
      tipo,
      ...datos,
      leida: false,
      timestamp: new Date()
    };
    if (escuelaId) {
      notificationData.escuelaId = escuelaId;
    }
    await db.collection('notificaciones').insertOne(notificationData);
  } catch (error) {
    console.error('Error creando notificación automática:', error);
  }
}

const router = express.Router();

// Login admin
router.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === adminPassword) {
    res.json({ success: true, token: adminPassword });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// Obtener estadísticas
router.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let queryConversations = {};
    let queryCitas = {};
    let queryMaestros = { activo: true };
    let queryAlumnos = { activo: true };
    let queryGrupos = { activo: true };
    
    if (escuelaId) {
      queryConversations = addEscuelaFilter(queryConversations, escuelaId);
      queryCitas = addEscuelaFilter(queryCitas, escuelaId);
      queryMaestros = addEscuelaFilter(queryMaestros, escuelaId);
      queryAlumnos = addEscuelaFilter(queryAlumnos, escuelaId);
      queryGrupos = addEscuelaFilter(queryGrupos, escuelaId);
    }
    
    const totalConversations = await db.collection('conversations').countDocuments(queryConversations);
    const totalCitas = await db.collection('citas').countDocuments(queryCitas);
    const citasPendientes = await db.collection('citas').countDocuments({ ...queryCitas, estado: 'pendiente' });
    const totalMaestros = await db.collection('maestros').countDocuments(queryMaestros);
    const totalAlumnos = await db.collection('alumnos').countDocuments(queryAlumnos);
    const totalGrupos = await db.collection('grupos').countDocuments(queryGrupos);
    
    // Métricas de impacto (solo conversaciones con tracking)
    const queryResueltas = addEscuelaFilter({ resueltoSinCita: true }, escuelaId);
    const queryConCita = addEscuelaFilter({ sugiereCita: true }, escuelaId);
    const queryTracking = addEscuelaFilter({
      $or: [
        { resueltoSinCita: { $exists: true } },
        { sugiereCita: { $exists: true } }
      ]
    }, escuelaId);
    
    const conversacionesResueltas = await db.collection('conversations').countDocuments(queryResueltas);
    const conversacionesConCita = await db.collection('conversations').countDocuments(queryConCita);
    const conversacionesConTracking = await db.collection('conversations').countDocuments(queryTracking);
    
    // Calcular tiempo promedio de respuesta
    const queryTiempo = addEscuelaFilter({ responseTime: { $exists: true } }, escuelaId);
    const conversacionesConTiempo = await db.collection('conversations')
      .find(queryTiempo)
      .toArray();
    
    let tiempoPromedio = 0;
    if (conversacionesConTiempo.length > 0) {
      const sumaTiempos = conversacionesConTiempo.reduce((sum, conv) => sum + (conv.responseTime || 0), 0);
      tiempoPromedio = Math.round(sumaTiempos / conversacionesConTiempo.length);
    }
    
    // Calcular tiempo ahorrado (estimación: 5 minutos por conversación resuelta sin cita)
    const minutosPorConsulta = 5;
    const tiempoAhorradoHoras = Math.round((conversacionesResueltas * minutosPorConsulta) / 60 * 10) / 10;
    
    // Tasa de resolución (conversaciones resueltas sin necesidad de cita)
    const tasaResolucion = conversacionesConTracking > 0 
      ? Math.round((conversacionesResueltas / conversacionesConTracking) * 100) 
      : 0;
    
    // Análisis de temas más consultados (últimas 100 conversaciones)
    const conversacionesRecientes = await db.collection('conversations')
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
    
    const temas = {
      horarios: 0,
      eventos: 0,
      citas: 0,
      maestros: 0,
      alumnos: 0,
      grupos: 0,
      planes: 0,
      otros: 0
    };
    
    conversacionesRecientes.forEach(conv => {
      const mensaje = (conv.userMessage || '').toLowerCase();
      if (mensaje.includes('horario') || mensaje.includes('hora')) temas.horarios++;
      else if (mensaje.includes('evento') || mensaje.includes('actividad')) temas.eventos++;
      else if (mensaje.includes('cita') || mensaje.includes('agendar')) temas.citas++;
      else if (mensaje.includes('maestro') || mensaje.includes('profesor')) temas.maestros++;
      else if (mensaje.includes('alumno') || mensaje.includes('estudiante')) temas.alumnos++;
      else if (mensaje.includes('grupo') || mensaje.includes('clase')) temas.grupos++;
      else if (mensaje.includes('plan') || mensaje.includes('pago') || mensaje.includes('costo')) temas.planes++;
      else temas.otros++;
    });
    
    const temasTraducidos = {
      horarios: 'Horarios',
      eventos: 'Eventos',
      citas: 'Citas',
      maestros: 'Maestros',
      alumnos: 'Alumnos',
      grupos: 'Grupos',
      planes: 'Planes de Pago',
      otros: 'Otros'
    };
    
    const temasMasConsultados = Object.entries(temas)
      .filter(([_, count]) => count > 0)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([tema, count]) => ({ tema: temasTraducidos[tema] || tema, count }));
    
    // Reducción de citas innecesarias (comparación)
    const reduccionCitas = totalCitas > 0 
      ? Math.round((conversacionesResueltas / (conversacionesResueltas + totalCitas)) * 100)
      : 0;
    
    res.json({
      conversations: totalConversations,
      citas: totalCitas,
      citasPendientes,
      maestros: totalMaestros,
      alumnos: totalAlumnos,
      grupos: totalGrupos,
      // Métricas de impacto
      impacto: {
        conversacionesResueltas,
        conversacionesConCita,
        tiempoAhorradoHoras,
        tiempoPromedioRespuesta: tiempoPromedio,
        tasaResolucion,
        reduccionCitas, // Porcentaje de consultas resueltas vs citas agendadas
        temasMasConsultados
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// CRUD Horarios
router.get('/api/admin/horarios', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const horarios = await db.collection('horarios').find(query).sort({ orden: 1 }).toArray();
    res.json(horarios);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo horarios' });
  }
});

router.post('/api/admin/horarios', adminAuth, async (req, res) => {
  try {
    const { titulo, descripcion, orden } = req.body;
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const horarioData = {
      titulo,
      descripcion,
      orden: orden || 0,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      horarioData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('horarios').insertOne(horarioData);
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Error creando horario' });
  }
});

router.put('/api/admin/horarios/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { titulo, descripcion, orden } = req.body;
    const db = getDB();
    await db.collection('horarios').updateOne(
      { _id: new ObjectId(id) },
      { $set: { titulo, descripcion, orden, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando horario' });
  }
});

router.delete('/api/admin/horarios/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('horarios').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando horario' });
  }
});

// CRUD Eventos
router.get('/api/admin/eventos', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const eventos = await db.collection('eventos').find(query).sort({ fecha: 1 }).toArray();
    res.json(eventos);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo eventos' });
  }
});

router.post('/api/admin/eventos', adminAuth, async (req, res) => {
  try {
    const { titulo, descripcion, fecha, enviarRecordatorio } = req.body;
    if (!titulo || !descripcion || !fecha) {
      return res.status(400).json({ error: 'Título, descripción y fecha requeridos' });
    }
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const fechaEvento = new Date(fecha);
    
    const eventoData = {
      titulo,
      descripcion,
      fecha: fechaEvento,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      eventoData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('eventos').insertOne(eventoData);
    
    // Crear recordatorio automático si se solicita
    if (enviarRecordatorio) {
      await crearNotificacionAutomatica('recordatorio_evento', {
        eventoId: result.insertedId,
        titulo: `Recordatorio: ${titulo}`,
        mensaje: `Recordatorio: ${titulo} - ${descripcion.substring(0, 100)}... Fecha: ${fechaEvento.toLocaleDateString('es-ES')}`
      });
      
      // Enviar mensaje automático a todos los padres con alumnos activos
      const alumnos = await db.collection('alumnos').find({ activo: true }).toArray();
      for (const alumno of alumnos) {
        if (alumno.email) {
          await db.collection('mensajes').insertOne({
            alumnoId: alumno._id,
            tipo: 'sistema',
            asunto: `Recordatorio: ${titulo}`,
            mensaje: `Estimado padre/madre de ${alumno.nombre},\n\nLe recordamos que tenemos el evento: ${titulo}\n${descripcion}\n\nFecha: ${fechaEvento.toLocaleDateString('es-ES')}\n\nEsperamos su participación.\n\nAtentamente,\nEquipo Administrativo`,
            leido: false,
            timestamp: new Date()
          });
        }
      }
    }
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando evento:', error);
    res.status(500).json({ error: 'Error creando evento' });
  }
});

router.put('/api/admin/eventos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { titulo, descripcion, fecha } = req.body;
    const db = getDB();
    await db.collection('eventos').updateOne(
      { _id: new ObjectId(id) },
      { $set: { titulo, descripcion, fecha: new Date(fecha), updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando evento' });
  }
});

router.delete('/api/admin/eventos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('eventos').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando evento' });
  }
});

// CRUD Planes de Pago
router.get('/api/admin/planes', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const planes = await db.collection('planes').find(query).sort({ nombre: 1 }).toArray();
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo planes' });
  }
});

router.post('/api/admin/planes', adminAuth, async (req, res) => {
  try {
    const { nombre, descripcion, costo } = req.body;
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const planData = {
      nombre,
      descripcion,
      costo,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      planData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('planes').insertOne(planData);
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Error creando plan' });
  }
});

router.put('/api/admin/planes/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { nombre, descripcion, costo } = req.body;
    const db = getDB();
    await db.collection('planes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { nombre, descripcion, costo, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando plan' });
  }
});

router.delete('/api/admin/planes/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('planes').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando plan' });
  }
});

// Información General
router.get('/api/admin/informacion', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({ tipo: 'general' }, escuelaId);
    
    const info = await db.collection('informacion').findOne(query);
    res.json(info || { contenido: '' });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo información' });
  }
});

router.post('/api/admin/informacion', adminAuth, async (req, res) => {
  try {
    const { contenido } = req.body;
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const query = addEscuelaFilter({ tipo: 'general' }, escuelaId);
    const updateData = { contenido, updatedAt: new Date() };
    
    if (escuelaId) {
      updateData.escuelaId = escuelaId;
    }
    
    await db.collection('informacion').updateOne(
      query,
      { $set: updateData },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error guardando información' });
  }
});

// Conversaciones recientes
router.get('/api/admin/conversaciones', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const db = getDB();
    const conversaciones = await db.collection('conversations')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    res.json(conversaciones);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo conversaciones' });
  }
});

// Notificaciones
router.get('/api/admin/notificaciones', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const notificaciones = await db.collection('notificaciones')
      .find({ leida: false })
      .sort({ timestamp: -1 })
      .toArray();
    res.json(notificaciones);
  } catch (error) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

router.put('/api/admin/notificaciones/:id/leida', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('notificaciones').updateOne(
      { _id: new ObjectId(id) },
      { $set: { leida: true, leidaAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marcando notificación como leída:', error);
    res.status(500).json({ error: 'Error marcando notificación' });
  }
});

export default router;
