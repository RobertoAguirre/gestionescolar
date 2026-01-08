import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

// GET - Listar calificaciones
router.get('/api/admin/calificaciones', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const { alumnoId, grupoId, materia, periodo } = req.query;
    
    let query = {};
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      query.alumnoId = new ObjectId(alumnoId);
    }
    if (grupoId && ObjectId.isValid(grupoId)) {
      query.grupoId = new ObjectId(grupoId);
    }
    if (materia) {
      query.materia = materia;
    }
    if (periodo) {
      query.periodo = periodo;
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const calificaciones = await db.collection('calificaciones')
      .find(query)
      .sort({ fecha: -1, materia: 1 })
      .toArray();
    
    res.json(calificaciones);
  } catch (error) {
    console.error('Error obteniendo calificaciones:', error);
    res.status(500).json({ error: 'Error obteniendo calificaciones' });
  }
});

// POST - Crear calificación
router.post('/api/admin/calificaciones', adminAuth, async (req, res) => {
  try {
    const { alumnoId, grupoId, materia, calificacion, periodo, fecha, observaciones } = req.body;
    
    if (!alumnoId || !materia || calificacion === undefined) {
      return res.status(400).json({ error: 'Alumno, materia y calificación requeridos' });
    }
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    if (calificacion < 0 || calificacion > 100) {
      return res.status(400).json({ error: 'Calificación debe estar entre 0 y 100' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const calificacionData = {
      alumnoId: new ObjectId(alumnoId),
      grupoId: grupoId && ObjectId.isValid(grupoId) ? new ObjectId(grupoId) : null,
      materia: materia.trim(),
      calificacion: parseFloat(calificacion),
      periodo: periodo || 'general',
      fecha: fecha ? new Date(fecha) : new Date(),
      observaciones: observaciones || '',
      timestamp: new Date()
    };
    
    if (escuelaId) {
      calificacionData.escuelaId = escuelaId;
    }

    const result = await db.collection('calificaciones').insertOne(calificacionData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando calificación:', error);
    res.status(500).json({ error: 'Error creando calificación' });
  }
});

// PUT - Actualizar calificación
router.put('/api/admin/calificaciones/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { materia, calificacion, periodo, fecha, observaciones } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    if (calificacion !== undefined && (calificacion < 0 || calificacion > 100)) {
      return res.status(400).json({ error: 'Calificación debe estar entre 0 y 100' });
    }
    
    const db = getDB();
    const updateData = { updatedAt: new Date() };
    
    if (materia) updateData.materia = materia.trim();
    if (calificacion !== undefined) updateData.calificacion = parseFloat(calificacion);
    if (periodo) updateData.periodo = periodo;
    if (fecha) updateData.fecha = new Date(fecha);
    if (observaciones !== undefined) updateData.observaciones = observaciones;
    
    await db.collection('calificaciones').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando calificación:', error);
    res.status(500).json({ error: 'Error actualizando calificación' });
  }
});

// DELETE - Eliminar calificación
router.delete('/api/admin/calificaciones/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('calificaciones').deleteOne({ _id: new ObjectId(id) });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando calificación:', error);
    res.status(500).json({ error: 'Error eliminando calificación' });
  }
});

// GET - Promedios por alumno
router.get('/api/admin/calificaciones/promedios/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const { periodo } = req.query;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    let query = { alumnoId: new ObjectId(alumnoId) };
    if (periodo) {
      query.periodo = periodo;
    }
    
    const calificaciones = await db.collection('calificaciones')
      .find(query)
      .toArray();
    
    // Calcular promedios por materia
    const promediosPorMateria = {};
    calificaciones.forEach(cal => {
      if (!promediosPorMateria[cal.materia]) {
        promediosPorMateria[cal.materia] = { suma: 0, count: 0, calificaciones: [] };
      }
      promediosPorMateria[cal.materia].suma += cal.calificacion;
      promediosPorMateria[cal.materia].count++;
      promediosPorMateria[cal.materia].calificaciones.push(cal.calificacion);
    });
    
    const promedios = Object.entries(promediosPorMateria).map(([materia, data]) => ({
      materia,
      promedio: Math.round((data.suma / data.count) * 10) / 10,
      cantidad: data.count,
      calificaciones: data.calificaciones
    }));
    
    // Promedio general
    const promedioGeneral = calificaciones.length > 0
      ? Math.round((calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length) * 10) / 10
      : 0;
    
    res.json({
      alumnoId,
      periodo: periodo || 'todos',
      promedioGeneral,
      promediosPorMateria: promedios,
      totalCalificaciones: calificaciones.length
    });
  } catch (error) {
    console.error('Error calculando promedios:', error);
    res.status(500).json({ error: 'Error calculando promedios' });
  }
});

// GET - Historial académico completo por alumno
router.get('/api/admin/calificaciones/historial/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const calificaciones = await db.collection('calificaciones')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .sort({ fecha: -1, materia: 1 })
      .toArray();
    
    // Agrupar por periodo
    const porPeriodo = {};
    calificaciones.forEach(cal => {
      const periodo = cal.periodo || 'general';
      if (!porPeriodo[periodo]) {
        porPeriodo[periodo] = [];
      }
      porPeriodo[periodo].push(cal);
    });
    
    // Calcular promedios por periodo
    const promediosPorPeriodo = Object.entries(porPeriodo).map(([periodo, cals]) => {
      const promedio = cals.reduce((sum, cal) => sum + cal.calificacion, 0) / cals.length;
      return {
        periodo,
        promedio: Math.round(promedio * 10) / 10,
        cantidad: cals.length,
        calificaciones: cals
      };
    });
    
    res.json({
      alumnoId,
      totalCalificaciones: calificaciones.length,
      calificaciones: calificaciones,
      promediosPorPeriodo: promediosPorPeriodo.sort((a, b) => b.periodo.localeCompare(a.periodo))
    });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error obteniendo historial' });
  }
});

// GET - Recomendaciones personalizadas basadas en calificaciones
router.get('/api/admin/calificaciones/recomendaciones/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const calificaciones = await db.collection('calificaciones')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .toArray();
    
    if (calificaciones.length === 0) {
      return res.json({ recomendaciones: [] });
    }
    
    // Calcular promedios por materia
    const promediosPorMateria = {};
    calificaciones.forEach(cal => {
      if (!promediosPorMateria[cal.materia]) {
        promediosPorMateria[cal.materia] = { suma: 0, count: 0 };
      }
      promediosPorMateria[cal.materia].suma += cal.calificacion;
      promediosPorMateria[cal.materia].count++;
    });
    
    const recomendaciones = [];
    
    // Identificar materias con bajo rendimiento
    Object.entries(promediosPorMateria).forEach(([materia, data]) => {
      const promedio = data.suma / data.count;
      if (promedio < 70) {
        recomendaciones.push({
          tipo: 'bajo_rendimiento',
          materia,
          promedio: Math.round(promedio * 10) / 10,
          mensaje: `Se recomienda apoyo adicional en ${materia}. El promedio actual es ${Math.round(promedio * 10) / 10}/100.`,
          prioridad: promedio < 60 ? 'alta' : 'media'
        });
      } else if (promedio >= 90) {
        recomendaciones.push({
          tipo: 'excelente',
          materia,
          promedio: Math.round(promedio * 10) / 10,
          mensaje: `Excelente desempeño en ${materia}. Se recomienda mantener el nivel y considerar actividades de enriquecimiento.`,
          prioridad: 'baja'
        });
      }
    });
    
    // Recomendación general si el promedio general es bajo
    const promedioGeneral = calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length;
    if (promedioGeneral < 70) {
      recomendaciones.push({
        tipo: 'general',
        mensaje: `El promedio general es ${Math.round(promedioGeneral * 10) / 10}/100. Se recomienda una reunión con padres y apoyo académico integral.`,
        prioridad: 'alta'
      });
    }
    
    res.json({
      alumnoId,
      promedioGeneral: Math.round(promedioGeneral * 10) / 10,
      recomendaciones: recomendaciones.sort((a, b) => {
        const prioridadOrder = { alta: 3, media: 2, baja: 1 };
        return prioridadOrder[b.prioridad] - prioridadOrder[a.prioridad];
      })
    });
  } catch (error) {
    console.error('Error obteniendo recomendaciones:', error);
    res.status(500).json({ error: 'Error obteniendo recomendaciones' });
  }
});

// GET - Alertas tempranas (alumnos con bajo rendimiento)
router.get('/api/admin/calificaciones/alertas', adminAuth, async (req, res) => {
  try {
    const { umbral = 70 } = req.query;
    const umbralNum = parseFloat(umbral);
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let queryAlumnos = { activo: true };
    queryAlumnos = addEscuelaFilter(queryAlumnos, escuelaId);
    const alumnos = await db.collection('alumnos').find(queryAlumnos).toArray();
    
    const alertas = [];
    
    for (const alumno of alumnos) {
      let queryCalificaciones = { alumnoId: alumno._id };
      queryCalificaciones = addEscuelaFilter(queryCalificaciones, escuelaId);
      const calificaciones = await db.collection('calificaciones')
        .find(queryCalificaciones)
        .toArray();
      
      if (calificaciones.length > 0) {
        const promedio = calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length;
        
        if (promedio < umbralNum) {
          alertas.push({
            alumnoId: alumno._id,
            alumnoNombre: alumno.nombre,
            promedio: Math.round(promedio * 10) / 10,
            totalCalificaciones: calificaciones.length,
            grupoId: alumno.grupoId
          });
        }
      }
    }
    
    // Agregar notificaciones automáticas (marcar como notificadas)
    const notificaciones = await db.collection('notificaciones')
      .find({ tipo: 'bajo_rendimiento', leida: false })
      .toArray();
    
    // Crear notificaciones para nuevas alertas
    for (const alerta of alertas) {
      const existeNotificacion = notificaciones.find(n => 
        String(n.alumnoId) === String(alerta.alumnoId)
      );
      
      if (!existeNotificacion) {
        // Obtener datos del alumno para notificar a padres
        let queryAlumno = { _id: alerta.alumnoId };
        queryAlumno = addEscuelaFilter(queryAlumno, escuelaId);
        const alumno = await db.collection('alumnos').findOne(queryAlumno);
        
        const notificacionData = {
          tipo: 'bajo_rendimiento',
          alumnoId: alerta.alumnoId,
          titulo: `Alerta académica: ${alerta.alumnoNombre}`,
          mensaje: `El alumno ${alerta.alumnoNombre} tiene un promedio de ${alerta.promedio}/100. Se recomienda atención inmediata.`,
          leida: false,
          timestamp: new Date()
        };
        if (escuelaId) {
          notificacionData.escuelaId = escuelaId;
        }
        await db.collection('notificaciones').insertOne(notificacionData);
        
        // Crear mensaje automático a padres si tiene email
        if (alumno && alumno.email) {
          const mensajeData = {
            alumnoId: alerta.alumnoId,
            tipo: 'sistema',
            asunto: 'Alerta académica - Bajo rendimiento',
            mensaje: `Estimado padre/madre de ${alerta.alumnoNombre},\n\nLe informamos que el promedio académico actual es de ${alerta.promedio}/100, lo cual requiere atención. Le recomendamos agendar una cita para revisar el caso.\n\nAtentamente,\nEquipo Administrativo`,
            leido: false,
            timestamp: new Date()
          };
          if (escuelaId) {
            mensajeData.escuelaId = escuelaId;
          }
          await db.collection('mensajes').insertOne(mensajeData);
        }
      }
    }
    
    res.json({
      umbral: umbralNum,
      totalAlertas: alertas.length,
      alertas: alertas.sort((a, b) => a.promedio - b.promedio)
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({ error: 'Error obteniendo alertas' });
  }
});

export default router;
