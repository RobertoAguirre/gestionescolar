import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getJwtSecret } from '../utils/auth.js';

const router = express.Router();

function alumnoIdFilter(alumnoId) {
  return {
    $or: [
      { alumnoId },
      { alumnoId: String(alumnoId) }
    ]
  };
}

// POST - Login de padre
router.post('/api/padres/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    
    const db = getDB();
    
    const secret = getJwtSecret();
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado' });
    }

    // Buscar alumno/padre por email (evita escanear toda la colección)
    const alumnoAsociado = await db.collection('alumnos').findOne({
      activo: true,
      'padres.email': email
    });

    if (!alumnoAsociado || !Array.isArray(alumnoAsociado.padres)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const padreIndex = alumnoAsociado.padres.findIndex(p => p.email === email);
    const padreEncontrado = padreIndex >= 0 ? alumnoAsociado.padres[padreIndex] : null;

    if (!padreEncontrado) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    let isValidPassword = false;
    if (padreEncontrado.passwordHash) {
      isValidPassword = await bcrypt.compare(password, padreEncontrado.passwordHash);
    } else if (padreEncontrado.password) {
      isValidPassword = padreEncontrado.password === password;
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Migración automática: si aún tenía password plano, se guarda hash
    if (!padreEncontrado.passwordHash && padreEncontrado.password) {
      const hash = await bcrypt.hash(password, 10);
      await db.collection('alumnos').updateOne(
        { _id: alumnoAsociado._id, 'padres.email': email },
        {
          $set: { 'padres.$.passwordHash': hash },
          $unset: { 'padres.$.password': '' }
        }
      );
    }

    const token = jwt.sign(
      {
        role: 'padre',
        padreId: padreEncontrado.email,
        alumnoId: String(alumnoAsociado._id)
      },
      secret,
      { expiresIn: '7d' }
    );
    
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
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado' });
    }

    let payload = null;
    try {
      payload = jwt.verify(token, secret);
    } catch (_jwtError) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (!payload || payload.role !== 'padre' || !payload.padreId || !payload.alumnoId) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    if (!ObjectId.isValid(payload.alumnoId)) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    req.padreId = payload.padreId;
    req.alumnoId = new ObjectId(payload.alumnoId);
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
    
    let query = alumnoIdFilter(req.alumnoId);
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
      .find(alumnoIdFilter(req.alumnoId))
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
      .find(alumnoIdFilter(req.alumnoId))
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
          ...alumnoIdFilter(req.alumnoId).$or
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
      .find(alumnoIdFilter(req.alumnoId))
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Historial de mensajes recibidos
    const mensajes = await db.collection('mensajes')
      .find(alumnoIdFilter(req.alumnoId))
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Historial de notificaciones
    const notificaciones = await db.collection('notificaciones')
      .find(alumnoIdFilter(req.alumnoId))
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
    // JWT es stateless; en logout cliente elimina token localmente.
    // Se mantiene limpieza de sesiones legacy si existieran.
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    if (token) {
      const db = getDB();
      await db.collection('sesiones_padres').deleteOne({ token });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error en logout' });
  }
});

export default router;
