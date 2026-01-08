import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import crypto from 'crypto';

const router = express.Router();

// Middleware de autenticación para padres
async function authPadre(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const db = getDB();
    const sesion = await db.collection('sesiones_padres').findOne({
      token,
      expira: { $gt: new Date() }
    });
    
    if (!sesion) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    
    req.padreId = sesion.padreId;
    req.alumnoId = sesion.alumnoId;
    next();
  } catch (error) {
    console.error('Error en autenticación de padre:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
}

// Función para generar token de sesión
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST - Login de padre
router.post('/api/padres/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    
    const db = getDB();
    
    // Buscar padre por email
    const alumnos = await db.collection('alumnos').find({ activo: true }).toArray();
    let padreEncontrado = null;
    let alumnoAsociado = null;
    
    for (const alumno of alumnos) {
      if (alumno.padres && Array.isArray(alumno.padres)) {
        const padre = alumno.padres.find(p => p.email === email);
        if (padre) {
          // Verificar contraseña (simple, se puede mejorar con hash)
          if (padre.password === password) {
            padreEncontrado = padre;
            alumnoAsociado = alumno;
            break;
          }
        }
      }
    }
    
    if (!padreEncontrado) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Generar token de sesión
    const token = generarToken();
    const sesion = {
      padreId: padreEncontrado.email,
      alumnoId: alumnoAsociado._id,
      token,
      timestamp: new Date(),
      expira: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    };
    
    await db.collection('sesiones_padres').insertOne(sesion);
    
    res.json({
      success: true,
      token,
      padre: {
        nombre: padreEncontrado.nombre,
        email: padreEncontrado.email
      },
      alumno: {
        id: alumnoAsociado._id,
        nombre: alumnoAsociado.nombre
      }
    });
  } catch (error) {
    console.error('Error en login de padre:', error);
    res.status(500).json({ error: 'Error en login' });
  }
});

// Middleware de autenticación para padres
export async function authPadre(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const db = getDB();
    const sesion = await db.collection('sesiones_padres').findOne({
      token,
      expira: { $gt: new Date() }
    });
    
    if (!sesion) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    
    req.padreId = sesion.padreId;
    req.alumnoId = sesion.alumnoId;
    next();
  } catch (error) {
    console.error('Error en autenticación de padre:', error);
    res.status(500).json({ error: 'Error en autenticación' });
  }
}

// GET - Información del hijo del padre autenticado
router.get('/api/padres/mi-hijo', authPadre, async (req, res) => {
  try {
    const db = getDB();
    const alumno = await db.collection('alumnos').findOne({ _id: req.alumnoId });
    
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    // Obtener grupo si existe
    let grupo = null;
    if (alumno.grupoId) {
      grupo = await db.collection('grupos').findOne({ _id: alumno.grupoId });
    }
    
    res.json({
      alumno: {
        id: alumno._id,
        nombre: alumno.nombre,
        email: alumno.email,
        telefono: alumno.telefono,
        grupo: grupo ? {
          id: grupo._id,
          nombre: grupo.nombre,
          nivel: grupo.nivel
        } : null
      }
    });
  } catch (error) {
    console.error('Error obteniendo información del hijo:', error);
    res.status(500).json({ error: 'Error obteniendo información' });
  }
});

// GET - Calificaciones del hijo
router.get('/api/padres/calificaciones', authPadre, async (req, res) => {
  try {
    const db = getDB();
    const { periodo } = req.query;
    
    let query = { alumnoId: req.alumnoId };
    if (periodo) {
      query.periodo = periodo;
    }
    
    const calificaciones = await db.collection('calificaciones')
      .find(query)
      .sort({ fecha: -1 })
      .toArray();
    
    // Calcular promedios por materia
    const promediosPorMateria = {};
    calificaciones.forEach(cal => {
      if (!promediosPorMateria[cal.materia]) {
        promediosPorMateria[cal.materia] = { suma: 0, count: 0 };
      }
      promediosPorMateria[cal.materia].suma += cal.calificacion;
      promediosPorMateria[cal.materia].count++;
    });
    
    const promedios = Object.entries(promediosPorMateria).map(([materia, data]) => ({
      materia,
      promedio: Math.round((data.suma / data.count) * 10) / 10,
      cantidad: data.count
    }));
    
    const promedioGeneral = calificaciones.length > 0
      ? Math.round((calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length) * 10) / 10
      : 0;
    
    res.json({
      calificaciones,
      promediosPorMateria: promedios,
      promedioGeneral,
      totalCalificaciones: calificaciones.length
    });
  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo calificaciones' });
  }
});

// GET - Progreso del hijo
router.get('/api/padres/progreso', authPadre, async (req, res) => {
  try {
    const db = getDB();
    
    const calificaciones = await db.collection('calificaciones')
      .find({ alumnoId: req.alumnoId })
      .sort({ fecha: 1 })
      .toArray();
    
    // Evolución por materia
    const evolucionPorMateria = {};
    calificaciones.forEach(cal => {
      if (!evolucionPorMateria[cal.materia]) {
        evolucionPorMateria[cal.materia] = [];
      }
      evolucionPorMateria[cal.materia].push({
        fecha: cal.fecha,
        calificacion: cal.calificacion
      });
    });
    
    // Promedio general
    const promedioGeneral = calificaciones.length > 0
      ? Math.round((calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length) * 10) / 10
      : 0;
    
    // Objetivos
    const objetivos = await db.collection('objetivos')
      .find({ alumnoId: req.alumnoId })
      .toArray();
    
    const objetivosCumplidos = objetivos.filter(obj => {
      if (!obj.meta) return false;
      const calificacionesMateria = calificaciones.filter(c => c.materia === obj.materia);
      if (calificacionesMateria.length === 0) return false;
      const promedioMateria = calificacionesMateria.reduce((sum, cal) => sum + cal.calificacion, 0) / calificacionesMateria.length;
      return promedioMateria >= obj.meta;
    }).length;
    
    res.json({
      promedioGeneral,
      evolucionPorMateria,
      objetivos: {
        total: objetivos.length,
        cumplidos: objetivosCumplidos
      }
    });
  } catch (error) {
    console.error('Error obteniendo progreso:', error);
    res.status(500).json({ error: 'Error obteniendo progreso' });
  }
});

// GET - Próximos eventos
router.get('/api/padres/eventos', authPadre, async (req, res) => {
  try {
    const db = getDB();
    const ahora = new Date();
    
    const eventos = await db.collection('eventos')
      .find({ fecha: { $gte: ahora } })
      .sort({ fecha: 1 })
      .limit(10)
      .toArray();
    
    res.json(eventos);
  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    res.status(500).json({ error: 'Error obteniendo eventos' });
  }
});

// GET - Citas agendadas
router.get('/api/padres/citas', authPadre, async (req, res) => {
  try {
    const db = getDB();
    
    // Buscar citas por email del padre o por alumnoId
    const alumno = await db.collection('alumnos').findOne({ _id: req.alumnoId });
    const emailPadre = req.padreId;
    
    const citas = await db.collection('citas')
      .find({
        $or: [
          { email: emailPadre },
          { alumnoId: req.alumnoId }
        ]
      })
      .sort({ fecha: 1 })
      .toArray();
    
    res.json(citas);
  } catch (error) {
    console.error('Error obteniendo citas:', error);
    res.status(500).json({ error: 'Error obteniendo citas' });
  }
});

// GET - Historial de interacciones
router.get('/api/padres/historial', authPadre, async (req, res) => {
  try {
    const db = getDB();
    
    // Historial de conversaciones con el chatbot relacionadas con el alumno
    const conversaciones = await db.collection('conversations')
      .find({ alumnoId: req.alumnoId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Historial de mensajes recibidos
    const mensajes = await db.collection('mensajes')
      .find({ alumnoId: req.alumnoId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Historial de notificaciones
    const notificaciones = await db.collection('notificaciones')
      .find({ alumnoId: req.alumnoId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Combinar y ordenar por fecha
    const historial = [
      ...conversaciones.map(c => ({ tipo: 'conversacion', ...c })),
      ...mensajes.map(m => ({ tipo: 'mensaje', ...m })),
      ...notificaciones.map(n => ({ tipo: 'notificacion', ...n }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      historial: historial.slice(0, 50),
      total: historial.length
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// POST - Agendar cita desde portal de padres
router.post('/api/padres/citas', authPadre, async (req, res) => {
  try {
    const { motivo, fecha, tipo, maestroId } = req.body;
    
    if (!motivo || !fecha || !tipo) {
      return res.status(400).json({ error: 'Motivo, fecha y tipo requeridos' });
    }
    
    const db = getDB();
    const alumno = await db.collection('alumnos').findOne({ _id: req.alumnoId });
    
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    // Obtener información del padre
    const padre = alumno.padres?.find(p => p.email === req.padreId);
    
    const cita = {
      nombre: padre?.nombre || 'Padre de ' + alumno.nombre,
      email: req.padreId,
      telefono: padre?.telefono || alumno.telefono || '',
      motivo,
      fecha: new Date(fecha),
      tipo,
      alumnoId: req.alumnoId,
      maestroId: maestroId && ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
      estado: 'pendiente',
      timestamp: new Date()
    };
    
    const result = await db.collection('citas').insertOne(cita);
    
    res.json({
      success: true,
      citaId: result.insertedId,
      message: 'Cita agendada exitosamente'
    });
  } catch (error) {
    console.error('Error agendando cita:', error);
    res.status(500).json({ error: 'Error agendando cita' });
  }
});

// POST - Logout
router.post('/api/padres/logout', authPadre, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const db = getDB();
    
    await db.collection('sesiones_padres').deleteOne({ token });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error en logout' });
  }
});

export default router;
