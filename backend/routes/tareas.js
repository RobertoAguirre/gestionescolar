import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';
import { crearNotificacionAutomatica } from './admin.js';

const router = express.Router();

// GET - Listar tareas
router.get('/api/admin/tareas', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const { grupoId, maestroId, alumnoId, estado, tipo } = req.query;
    
    let query = {};
    if (grupoId && ObjectId.isValid(grupoId)) {
      query.grupoId = new ObjectId(grupoId);
    }
    if (maestroId && ObjectId.isValid(maestroId)) {
      query.maestroId = new ObjectId(maestroId);
    }
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      query.alumnos = { $in: [new ObjectId(alumnoId)] };
    }
    if (estado) {
      query.estado = estado; // 'pendiente', 'en_proceso', 'entregada', 'calificada', 'vencida'
    }
    if (tipo) {
      query.tipo = tipo; // 'tarea', 'examen', 'evaluacion', 'proyecto'
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const tareas = await db.collection('tareas')
      .find(query)
      .sort({ fechaLimite: 1 })
      .toArray();
    
    res.json(tareas);
  } catch (error) {
    console.error('Error obteniendo tareas:', error);
    res.status(500).json({ error: 'Error obteniendo tareas' });
  }
});

// GET - Obtener una tarea específica
router.get('/api/admin/tareas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const tarea = await db.collection('tareas').findOne(query);
    
    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    res.json(tarea);
  } catch (error) {
    console.error('Error obteniendo tarea:', error);
    res.status(500).json({ error: 'Error obteniendo tarea' });
  }
});

// POST - Crear tarea
router.post('/api/admin/tareas', adminAuth, async (req, res) => {
  try {
    const { titulo, descripcion, tipo, grupoId, maestroId, alumnos, fechaLimite, fechaEntrega, puntos, enviarRecordatorio } = req.body;
    
    if (!titulo || !tipo || !fechaLimite) {
      return res.status(400).json({ error: 'Título, tipo y fecha límite requeridos' });
    }
    
    if (!['tarea', 'examen', 'evaluacion', 'proyecto'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Debe ser: tarea, examen, evaluacion o proyecto' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const tareaData = {
      titulo,
      descripcion: descripcion || '',
      tipo,
      grupoId: grupoId && ObjectId.isValid(grupoId) ? new ObjectId(grupoId) : null,
      maestroId: maestroId && ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
      alumnos: Array.isArray(alumnos) ? alumnos.map(a => ObjectId.isValid(a) ? new ObjectId(a) : null).filter(a => a !== null) : [],
      fechaLimite: new Date(fechaLimite),
      fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      puntos: puntos || 100,
      estado: 'pendiente',
      entregas: [],
      timestamp: new Date()
    };
    
    if (escuelaId) {
      tareaData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('tareas').insertOne(tareaData);
    
    // Crear recordatorio automático si se solicita
    if (enviarRecordatorio) {
      const fechaLimiteObj = new Date(fechaLimite);
      const fechaRecordatorio = new Date(fechaLimiteObj);
      fechaRecordatorio.setDate(fechaLimiteObj.getDate() - 1); // Recordatorio 1 día antes
      
      if (fechaRecordatorio > new Date()) {
        await crearNotificacionAutomatica('recordatorio_tarea', {
          tareaId: result.insertedId,
          titulo: `Recordatorio: ${titulo}`,
          mensaje: `Tienes una ${tipo} pendiente: ${titulo}. Fecha límite: ${fechaLimiteObj.toLocaleDateString('es-ES')}`,
          fechaRecordatorio
        }, escuelaId);
      }
    }
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando tarea:', error);
    res.status(500).json({ error: 'Error creando tarea' });
  }
});

// PUT - Actualizar tarea
router.put('/api/admin/tareas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, tipo, fechaLimite, fechaEntrega, puntos, estado, enviarRecordatorio } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const updateData = { updatedAt: new Date() };
    
    if (titulo) updateData.titulo = titulo;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (tipo) updateData.tipo = tipo;
    if (fechaLimite) updateData.fechaLimite = new Date(fechaLimite);
    if (fechaEntrega !== undefined) updateData.fechaEntrega = fechaEntrega ? new Date(fechaEntrega) : null;
    if (puntos !== undefined) updateData.puntos = puntos;
    if (estado) updateData.estado = estado;
    
    await db.collection('tareas').updateOne(
      query,
      { $set: updateData }
    );
    
    if (enviarRecordatorio && fechaLimite) {
      const fechaLimiteObj = new Date(fechaLimite);
      const fechaRecordatorio = new Date(fechaLimiteObj);
      fechaRecordatorio.setDate(fechaLimiteObj.getDate() - 1);
      
      if (fechaRecordatorio > new Date()) {
        await crearNotificacionAutomatica('recordatorio_tarea_actualizada', {
          tareaId: new ObjectId(id),
          titulo: `Tarea Actualizada: ${titulo || 'Sin título'}`,
          mensaje: `La fecha límite ha sido actualizada. Nueva fecha: ${fechaLimiteObj.toLocaleDateString('es-ES')}`
        }, escuelaId);
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando tarea:', error);
    res.status(500).json({ error: 'Error actualizando tarea' });
  }
});

// DELETE - Eliminar tarea
router.delete('/api/admin/tareas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    await db.collection('tareas').deleteOne(query);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando tarea:', error);
    res.status(500).json({ error: 'Error eliminando tarea' });
  }
});

// POST - Asignar tarea a alumnos (por maestro)
router.post('/api/maestros/tareas', async (req, res) => {
  try {
    const { maestroId, grupoId, titulo, descripcion, tipo, alumnos, fechaLimite, puntos } = req.body;
    
    if (!maestroId || !titulo || !tipo || !fechaLimite) {
      return res.status(400).json({ error: 'Maestro, título, tipo y fecha límite requeridos' });
    }
    
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    
    const tareaData = {
      titulo,
      descripcion: descripcion || '',
      tipo: tipo || 'tarea',
      grupoId: grupoId && ObjectId.isValid(grupoId) ? new ObjectId(grupoId) : null,
      maestroId: ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
      alumnos: Array.isArray(alumnos) ? alumnos.map(a => ObjectId.isValid(a) ? new ObjectId(a) : null).filter(a => a !== null) : [],
      fechaLimite: new Date(fechaLimite),
      puntos: puntos || 100,
      estado: 'pendiente',
      entregas: [],
      timestamp: new Date()
    };
    
    if (escuelaId) {
      tareaData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('tareas').insertOne(tareaData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error asignando tarea:', error);
    res.status(500).json({ error: 'Error asignando tarea' });
  }
});

// POST - Entregar tarea (por alumno)
router.post('/api/tareas/:id/entregar', async (req, res) => {
  try {
    const { id } = req.params;
    const { alumnoId, archivo, comentarios } = req.body;
    
    if (!ObjectId.isValid(id) || !alumnoId || !ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }
    
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const tarea = await db.collection('tareas').findOne(query);
    
    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    // Verificar si ya existe una entrega de este alumno
    const entregaExistente = tarea.entregas?.find(e => String(e.alumnoId) === String(alumnoId));
    
    const entrega = {
      alumnoId: new ObjectId(alumnoId),
      archivo: archivo || '',
      comentarios: comentarios || '',
      fechaEntrega: new Date(),
      calificacion: null,
      estado: 'entregada'
    };
    
    if (entregaExistente) {
      // Actualizar entrega existente
      const updateQuery = { _id: new ObjectId(id), 'entregas.alumnoId': new ObjectId(alumnoId) };
      const updateQueryWithEscuela = addEscuelaFilter(updateQuery, escuelaId);
      
      await db.collection('tareas').updateOne(
        updateQueryWithEscuela,
        { 
          $set: { 
            'entregas.$.archivo': entrega.archivo,
            'entregas.$.comentarios': entrega.comentarios,
            'entregas.$.fechaEntrega': entrega.fechaEntrega,
            'entregas.$.estado': 'entregada',
            updatedAt: new Date()
          }
        }
      );
    } else {
      // Agregar nueva entrega
      await db.collection('tareas').updateOne(
        query,
        { 
          $push: { entregas: entrega },
          $set: { updatedAt: new Date() }
        }
      );
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error entregando tarea:', error);
    res.status(500).json({ error: 'Error entregando tarea' });
  }
});

// PUT - Calificar tarea
router.put('/api/admin/tareas/:id/calificar', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { alumnoId, calificacion, comentarios } = req.body;
    
    if (!ObjectId.isValid(id) || !alumnoId || !ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'IDs inválidos' });
    }
    
    if (calificacion === undefined || calificacion < 0 || calificacion > 100) {
      return res.status(400).json({ error: 'Calificación debe estar entre 0 y 100' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const tarea = await db.collection('tareas').findOne(query);
    
    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const entregaExistente = tarea.entregas?.find(e => String(e.alumnoId) === String(alumnoId));
    
    if (!entregaExistente) {
      return res.status(404).json({ error: 'No existe entrega de este alumno' });
    }
    
    const updateQuery = { _id: new ObjectId(id), 'entregas.alumnoId': new ObjectId(alumnoId) };
    const updateQueryWithEscuela = addEscuelaFilter(updateQuery, escuelaId);
    
    await db.collection('tareas').updateOne(
      updateQueryWithEscuela,
      { 
        $set: { 
          'entregas.$.calificacion': parseFloat(calificacion),
          'entregas.$.comentariosCalificacion': comentarios || '',
          'entregas.$.estado': 'calificada',
          'entregas.$.fechaCalificacion': new Date(),
          updatedAt: new Date()
        }
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error calificando tarea:', error);
    res.status(500).json({ error: 'Error calificando tarea' });
  }
});

// GET - Tareas pendientes por alumno
router.get('/api/tareas/pendientes/:alumnoId', async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const escuelaId = getEscuelaId(req);
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const escuelaIdFilter = addEscuelaFilter({}, escuelaId);
    
    // Obtener el alumno para verificar su grupo
    const alumno = await db.collection('alumnos').findOne({
      _id: new ObjectId(alumnoId),
      ...escuelaIdFilter
    });
    
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    // Buscar tareas asignadas directamente al alumno
    let queryAlumno = {
      alumnos: new ObjectId(alumnoId),
      fechaLimite: { $gte: new Date() },
      estado: { $in: ['pendiente', 'en_proceso'] }
    };
    queryAlumno = addEscuelaFilter(queryAlumno, escuelaId);
    
    const tareasAlumno = await db.collection('tareas').find(queryAlumno).toArray();
    
    // Buscar tareas del grupo del alumno
    let tareasGrupo = [];
    if (alumno.grupoId) {
      let queryGrupo = {
        grupoId: alumno.grupoId,
        fechaLimite: { $gte: new Date() },
        estado: { $in: ['pendiente', 'en_proceso'] }
      };
      queryGrupo = addEscuelaFilter(queryGrupo, escuelaId);
      
      tareasGrupo = await db.collection('tareas').find(queryGrupo).toArray();
    }
    
    // Combinar y eliminar duplicados
    const todasTareas = [...tareasAlumno, ...tareasGrupo];
    const tareasUnicas = todasTareas.filter((tarea, index, self) =>
      index === self.findIndex(t => String(t._id) === String(tarea._id))
    );
    
    res.json(tareasUnicas.sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite)));
  } catch (error) {
    console.error('Error obteniendo tareas pendientes:', error);
    res.status(500).json({ error: 'Error obteniendo tareas pendientes' });
  }
});

// GET - Calendario académico
router.get('/api/admin/calendario-academico', adminAuth, async (req, res) => {
  try {
    const { mes, año } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const db = getDB();
    const mesNum = parseInt(mes) || new Date().getMonth() + 1;
    const añoNum = parseInt(año) || new Date().getFullYear();
    
    const inicioMes = new Date(añoNum, mesNum - 1, 1);
    const finMes = new Date(añoNum, mesNum, 0, 23, 59, 59);
    
    // Tareas y exámenes
    const queryTareas = addEscuelaFilter({
      fechaLimite: { $gte: inicioMes, $lte: finMes }
    }, escuelaId);
    
    const tareas = await db.collection('tareas').find(queryTareas).toArray();
    
    // Eventos
    const queryEventos = addEscuelaFilter({
      fecha: { $gte: inicioMes, $lte: finMes }
    }, escuelaId);
    
    const eventos = await db.collection('eventos').find(queryEventos).toArray();
    
    // Citas importantes
    const queryCitas = addEscuelaFilter({
      fecha: { $gte: inicioMes, $lte: finMes },
      tipo: 'directivo'
    }, escuelaId);
    
    const citas = await db.collection('citas').find(queryCitas).toArray();
    
    // Agrupar por fecha
    const calendario = {};
    
    tareas.forEach(tarea => {
      const fechaKey = new Date(tarea.fechaLimite).toISOString().split('T')[0];
      if (!calendario[fechaKey]) {
        calendario[fechaKey] = { tareas: [], eventos: [], citas: [] };
      }
      calendario[fechaKey].tareas.push({
        id: tarea._id,
        titulo: tarea.titulo,
        tipo: tarea.tipo,
        puntos: tarea.puntos
      });
    });
    
    eventos.forEach(evento => {
      const fechaKey = new Date(evento.fecha).toISOString().split('T')[0];
      if (!calendario[fechaKey]) {
        calendario[fechaKey] = { tareas: [], eventos: [], citas: [] };
      }
      calendario[fechaKey].eventos.push({
        id: evento._id,
        titulo: evento.titulo,
        descripcion: evento.descripcion
      });
    });
    
    citas.forEach(cita => {
      const fechaKey = new Date(cita.fecha).toISOString().split('T')[0];
      if (!calendario[fechaKey]) {
        calendario[fechaKey] = { tareas: [], eventos: [], citas: [] };
      }
      calendario[fechaKey].citas.push({
        id: cita._id,
        nombre: cita.nombre,
        motivo: cita.motivo
      });
    });
    
    res.json({
      mes: mesNum,
      año: añoNum,
      calendario
    });
  } catch (error) {
    console.error('Error obteniendo calendario académico:', error);
    res.status(500).json({ error: 'Error obteniendo calendario académico' });
  }
});

// GET - Fechas importantes
router.get('/api/admin/fechas-importantes', adminAuth, async (req, res) => {
  try {
    const { dias = 30 } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const db = getDB();
    const fechaInicio = new Date();
    const fechaFin = new Date();
    fechaFin.setDate(fechaFin.getDate() + parseInt(dias));
    
    // Tareas próximas a vencer
    const queryTareas = addEscuelaFilter({
      fechaLimite: { $gte: fechaInicio, $lte: fechaFin },
      estado: { $in: ['pendiente', 'en_proceso'] }
    }, escuelaId);
    
    const tareasProximas = await db.collection('tareas')
      .find(queryTareas)
      .sort({ fechaLimite: 1 })
      .toArray();
    
    // Exámenes próximos
    const examenesProximos = tareasProximas.filter(t => t.tipo === 'examen' || t.tipo === 'evaluacion');
    
    // Eventos próximos
    const queryEventos = addEscuelaFilter({
      fecha: { $gte: fechaInicio, $lte: fechaFin }
    }, escuelaId);
    
    const eventosProximos = await db.collection('eventos')
      .find(queryEventos)
      .sort({ fecha: 1 })
      .toArray();
    
    res.json({
      periodo: {
        inicio: fechaInicio.toLocaleDateString('es-ES'),
        fin: fechaFin.toLocaleDateString('es-ES'),
        dias: parseInt(dias)
      },
      tareasProximas,
      examenesProximos,
      eventosProximos
    });
  } catch (error) {
    console.error('Error obteniendo fechas importantes:', error);
    res.status(500).json({ error: 'Error obteniendo fechas importantes' });
  }
});

export default router;
