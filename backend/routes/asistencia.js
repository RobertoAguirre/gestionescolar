import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

// Función para crear notificaciones automáticas
async function crearNotificacionAutomatica(tipo, datos) {
  try {
    const db = getDB();
    await db.collection('notificaciones').insertOne({
      tipo,
      ...datos,
      leida: false,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error creando notificación automática:', error);
  }
}

const router = express.Router();

// GET - Listar registros de asistencia
router.get('/api/admin/asistencia', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const { alumnoId, grupoId, fecha, periodo } = req.query;
    
    let query = {};
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      query.alumnoId = new ObjectId(alumnoId);
    }
    if (grupoId && ObjectId.isValid(grupoId)) {
      query.grupoId = new ObjectId(grupoId);
    }
    if (fecha) {
      const fechaInicio = new Date(fecha);
      fechaInicio.setHours(0, 0, 0, 0);
      const fechaFin = new Date(fecha);
      fechaFin.setHours(23, 59, 59, 999);
      query.fecha = { $gte: fechaInicio, $lte: fechaFin };
    }
    if (periodo) {
      query.periodo = periodo;
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const asistencia = await db.collection('asistencia')
      .find(query)
      .sort({ fecha: -1 })
      .toArray();
    
    res.json(asistencia);
  } catch (error) {
    console.error('Error obteniendo asistencia:', error);
    res.status(500).json({ error: 'Error obteniendo asistencia' });
  }
});

// POST - Registrar asistencia
router.post('/api/admin/asistencia', adminAuth, async (req, res) => {
  try {
    const { alumnoId, grupoId, fecha, estado, observaciones } = req.body;
    
    if (!alumnoId || !fecha || !estado) {
      return res.status(400).json({ error: 'Alumno, fecha y estado requeridos' });
    }
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    if (!['presente', 'ausente', 'tardanza', 'justificado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Debe ser: presente, ausente, tardanza o justificado' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const fechaObj = new Date(fecha);
    fechaObj.setHours(0, 0, 0, 0);
    
    // Verificar si ya existe un registro para este alumno en esta fecha
    const existente = await db.collection('asistencia').findOne({
      alumnoId: new ObjectId(alumnoId),
      fecha: fechaObj
    });
    
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un registro de asistencia para este alumno en esta fecha' });
    }
    
    const asistenciaData = {
      alumnoId: new ObjectId(alumnoId),
      grupoId: grupoId && ObjectId.isValid(grupoId) ? new ObjectId(grupoId) : null,
      fecha: fechaObj,
      estado,
      observaciones: observaciones || '',
      periodo: req.body.periodo || 'general',
      timestamp: new Date()
    };
    
    if (escuelaId) {
      asistenciaData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('asistencia').insertOne(asistenciaData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error registrando asistencia:', error);
    res.status(500).json({ error: 'Error registrando asistencia' });
  }
});

// PUT - Actualizar asistencia
router.put('/api/admin/asistencia/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, observaciones, fecha } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    if (estado && !['presente', 'ausente', 'tardanza', 'justificado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    
    const db = getDB();
    const updateData = { updatedAt: new Date() };
    
    if (estado) updateData.estado = estado;
    if (observaciones !== undefined) updateData.observaciones = observaciones;
    if (fecha) {
      const fechaObj = new Date(fecha);
      fechaObj.setHours(0, 0, 0, 0);
      updateData.fecha = fechaObj;
    }
    
    await db.collection('asistencia').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando asistencia:', error);
    res.status(500).json({ error: 'Error actualizando asistencia' });
  }
});

// DELETE - Eliminar registro de asistencia
router.delete('/api/admin/asistencia/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('asistencia').deleteOne({ _id: new ObjectId(id) });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando asistencia:', error);
    res.status(500).json({ error: 'Error eliminando asistencia' });
  }
});

// GET - Estadísticas de asistencia por alumno
router.get('/api/admin/asistencia/estadisticas/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const { periodo } = req.query;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let query = { alumnoId: new ObjectId(alumnoId) };
    if (periodo) {
      query.periodo = periodo;
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const registros = await db.collection('asistencia')
      .find(query)
      .toArray();
    
    const estadisticas = {
      total: registros.length,
      presente: registros.filter(r => r.estado === 'presente').length,
      ausente: registros.filter(r => r.estado === 'ausente').length,
      tardanza: registros.filter(r => r.estado === 'tardanza').length,
      justificado: registros.filter(r => r.estado === 'justificado').length
    };
    
    const porcentajeAsistencia = estadisticas.total > 0
      ? Math.round(((estadisticas.presente + estadisticas.justificado) / estadisticas.total) * 100 * 10) / 10
      : 0;
    
    res.json({
      alumnoId,
      periodo: periodo || 'todos',
      estadisticas,
      porcentajeAsistencia,
      registros: registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de asistencia:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas de asistencia' });
  }
});

// GET - Alertas de ausentismo
router.get('/api/admin/asistencia/alertas', adminAuth, async (req, res) => {
  try {
    const { umbral = 80 } = req.query;
    const umbralNum = parseFloat(umbral);
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const db = getDB();
    const queryAlumnos = addEscuelaFilter({ activo: true }, escuelaId);
    const alumnos = await db.collection('alumnos').find(queryAlumnos).toArray();
    
    const alertas = [];
    
    for (const alumno of alumnos) {
      const queryRegistros = addEscuelaFilter({ alumnoId: alumno._id }, escuelaId);
      const registros = await db.collection('asistencia')
        .find(queryRegistros)
        .toArray();
      
      if (registros.length > 0) {
        const presente = registros.filter(r => r.estado === 'presente' || r.estado === 'justificado').length;
        const porcentaje = (presente / registros.length) * 100;
        
        if (porcentaje < umbralNum) {
          const ausencias = registros.filter(r => r.estado === 'ausente').length;
          alertas.push({
            alumnoId: alumno._id,
            alumnoNombre: alumno.nombre,
            porcentajeAsistencia: Math.round(porcentaje * 10) / 10,
            totalRegistros: registros.length,
            ausencias,
            grupoId: alumno.grupoId
          });
          
          await crearNotificacionAutomatica('ausentismo', {
            alumnoId: alumno._id,
            titulo: `Alerta de ausentismo: ${alumno.nombre}`,
            mensaje: `El alumno ${alumno.nombre} tiene un porcentaje de asistencia del ${Math.round(porcentaje * 10) / 10}% (${ausencias} ausencias). Se requiere atención.`
          });
        }
      }
    }
    
    res.json({
      umbral: umbralNum,
      totalAlertas: alertas.length,
      alertas: alertas.sort((a, b) => a.porcentajeAsistencia - b.porcentajeAsistencia)
    });
  } catch (error) {
    console.error('Error obteniendo alertas de ausentismo:', error);
    res.status(500).json({ error: 'Error obteniendo alertas de ausentismo' });
  }
});

// POST - Toma de asistencia por maestros (endpoint simplificado para maestros)
router.post('/api/maestros/asistencia', async (req, res) => {
  try {
    const { maestroId, grupoId, fecha, alumnos } = req.body; // alumnos: [{ alumnoId, estado, observaciones }]
    
    if (!maestroId || !grupoId || !fecha || !Array.isArray(alumnos) || alumnos.length === 0) {
      return res.status(400).json({ error: 'Maestro, grupo, fecha y lista de alumnos requeridos' });
    }
    
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    const fechaObj = new Date(fecha);
    fechaObj.setHours(0, 0, 0, 0);
    
    const resultados = [];
    
    for (const item of alumnos) {
      if (!item.alumnoId || !item.estado) continue;
      
      if (!['presente', 'ausente', 'tardanza', 'justificado'].includes(item.estado)) {
        continue;
      }
      
      // Verificar si ya existe
      const existente = await db.collection('asistencia').findOne({
        alumnoId: new ObjectId(item.alumnoId),
        fecha: fechaObj
      });
      
      if (existente) {
        // Actualizar existente
        await db.collection('asistencia').updateOne(
          { _id: existente._id },
          { $set: { estado: item.estado, observaciones: item.observaciones || '', updatedAt: new Date() } }
        );
        resultados.push({ alumnoId: item.alumnoId, accion: 'actualizado' });
      } else {
        // Crear nuevo
        const asistenciaData = {
          alumnoId: new ObjectId(item.alumnoId),
          grupoId: ObjectId.isValid(grupoId) ? new ObjectId(grupoId) : null,
          maestroId: ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
          fecha: fechaObj,
          estado: item.estado,
          observaciones: item.observaciones || '',
          periodo: item.periodo || 'general',
          timestamp: new Date()
        };
        
        if (escuelaId) {
          asistenciaData.escuelaId = escuelaId;
        }
        
        await db.collection('asistencia').insertOne(asistenciaData);
        resultados.push({ alumnoId: item.alumnoId, accion: 'creado' });
      }
    }
    
    res.json({ success: true, resultados });
  } catch (error) {
    console.error('Error registrando asistencia por maestro:', error);
    res.status(500).json({ error: 'Error registrando asistencia' });
  }
});

// GET - Estadísticas de asistencia por grupo
router.get('/api/admin/asistencia/estadisticas-grupo/:grupoId', adminAuth, async (req, res) => {
  try {
    const { grupoId } = req.params;
    const { periodo, fechaInicio, fechaFin } = req.query;
    
    if (!ObjectId.isValid(grupoId)) {
      return res.status(400).json({ error: 'ID de grupo inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let query = { grupoId: new ObjectId(grupoId) };
    if (periodo) {
      query.periodo = periodo;
    }
    if (fechaInicio || fechaFin) {
      query.fecha = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        query.fecha.$gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        query.fecha.$lte = fin;
      }
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const registros = await db.collection('asistencia').find(query).toArray();
    
    const totalRegistros = registros.length;
    const presentes = registros.filter(r => r.estado === 'presente').length;
    const ausentes = registros.filter(r => r.estado === 'ausente').length;
    const tardanzas = registros.filter(r => r.estado === 'tardanza').length;
    const justificados = registros.filter(r => r.estado === 'justificado').length;
    
    const porcentajeAsistencia = totalRegistros > 0
      ? Math.round(((presentes + justificados) / totalRegistros) * 100 * 10) / 10
      : 0;
    
    // Estadísticas por alumno del grupo
    const grupo = await db.collection('grupos').findOne({ _id: new ObjectId(grupoId) });
    const alumnosGrupo = grupo && grupo.alumnos ? grupo.alumnos : [];
    
    const estadisticasPorAlumno = [];
    for (const alumnoId of alumnosGrupo) {
      const registrosAlumno = registros.filter(r => String(r.alumnoId) === String(alumnoId));
      if (registrosAlumno.length > 0) {
        const presentesAlumno = registrosAlumno.filter(r => r.estado === 'presente' || r.estado === 'justificado').length;
        const porcentajeAlumno = Math.round((presentesAlumno / registrosAlumno.length) * 100 * 10) / 10;
        
        const alumno = await db.collection('alumnos').findOne({ _id: new ObjectId(alumnoId) });
        estadisticasPorAlumno.push({
          alumnoId,
          alumnoNombre: alumno ? alumno.nombre : 'Desconocido',
          porcentajeAsistencia: porcentajeAlumno,
          totalRegistros: registrosAlumno.length,
          presentes: registrosAlumno.filter(r => r.estado === 'presente').length,
          ausentes: registrosAlumno.filter(r => r.estado === 'ausente').length
        });
      }
    }
    
    res.json({
      grupoId,
      periodo: periodo || 'todos',
      estadisticas: {
        totalRegistros,
        presentes,
        ausentes,
        tardanzas,
        justificados,
        porcentajeAsistencia
      },
      estadisticasPorAlumno: estadisticasPorAlumno.sort((a, b) => a.porcentajeAsistencia - b.porcentajeAsistencia)
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de grupo:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas de grupo' });
  }
});

// GET - Tendencias y patrones de asistencia
router.get('/api/admin/asistencia/tendencias', adminAuth, async (req, res) => {
  try {
    const { grupoId, alumnoId, meses = 6 } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const db = getDB();
    const mesesNum = parseInt(meses);
    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - mesesNum);
    fechaInicio.setHours(0, 0, 0, 0);
    
    let query = { fecha: { $gte: fechaInicio } };
    if (grupoId && ObjectId.isValid(grupoId)) {
      query.grupoId = new ObjectId(grupoId);
    }
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      query.alumnoId = new ObjectId(alumnoId);
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const registros = await db.collection('asistencia')
      .find(query)
      .sort({ fecha: 1 })
      .toArray();
    
    // Agrupar por mes
    const porMes = {};
    registros.forEach(reg => {
      const fecha = new Date(reg.fecha);
      const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      
      if (!porMes[mesKey]) {
        porMes[mesKey] = { total: 0, presentes: 0, ausentes: 0, tardanzas: 0, justificados: 0 };
      }
      
      porMes[mesKey].total++;
      if (reg.estado === 'presente') porMes[mesKey].presentes++;
      else if (reg.estado === 'ausente') porMes[mesKey].ausentes++;
      else if (reg.estado === 'tardanza') porMes[mesKey].tardanzas++;
      else if (reg.estado === 'justificado') porMes[mesKey].justificados++;
    });
    
    // Calcular porcentajes por mes
    const tendencias = Object.entries(porMes).map(([mes, datos]) => ({
      mes,
      total: datos.total,
      presentes: datos.presentes,
      ausentes: datos.ausentes,
      tardanzas: datos.tardanzas,
      justificados: datos.justificados,
      porcentajeAsistencia: datos.total > 0
        ? Math.round(((datos.presentes + datos.justificados) / datos.total) * 100 * 10) / 10
        : 0
    })).sort((a, b) => a.mes.localeCompare(b.mes));
    
    // Detectar patrones
    const patrones = [];
    if (tendencias.length >= 2) {
      const ultimos2 = tendencias.slice(-2);
      const tendencia = ultimos2[1].porcentajeAsistencia - ultimos2[0].porcentajeAsistencia;
      
      if (tendencia < -5) {
        patrones.push({
          tipo: 'descendente',
          descripcion: 'Tendencia descendente en asistencia detectada',
          cambio: Math.abs(tendencia)
        });
      } else if (tendencia > 5) {
        patrones.push({
          tipo: 'ascendente',
          descripcion: 'Mejora en asistencia detectada',
          cambio: tendencia
        });
      }
    }
    
    // Días de la semana con más ausencias
    const porDiaSemana = {};
    registros.filter(r => r.estado === 'ausente').forEach(reg => {
      const fecha = new Date(reg.fecha);
      const dia = fecha.getDay(); // 0 = domingo, 1 = lunes, etc.
      porDiaSemana[dia] = (porDiaSemana[dia] || 0) + 1;
    });
    
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diasConMasAusencias = Object.entries(porDiaSemana)
      .map(([dia, count]) => ({ dia: diasSemana[parseInt(dia)], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    
    res.json({
      periodo: {
        inicio: fechaInicio.toLocaleDateString('es-ES'),
        fin: new Date().toLocaleDateString('es-ES'),
        meses: mesesNum
      },
      tendencias,
      patrones,
      diasConMasAusencias,
      resumen: {
        totalRegistros: registros.length,
        promedioAsistencia: tendencias.length > 0
          ? Math.round((tendencias.reduce((sum, t) => sum + t.porcentajeAsistencia, 0) / tendencias.length) * 10) / 10
          : 0
      }
    });
  } catch (error) {
    console.error('Error obteniendo tendencias:', error);
    res.status(500).json({ error: 'Error obteniendo tendencias' });
  }
});

export default router;
