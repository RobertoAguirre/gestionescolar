import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';

const router = express.Router();

// GET - Dashboard de progreso por alumno
router.get('/api/admin/progreso/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const { periodo } = req.query;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const alumno = await db.collection('alumnos').findOne({ _id: new ObjectId(alumnoId) });
    
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    // Obtener calificaciones
    let queryCalificaciones = { alumnoId: new ObjectId(alumnoId) };
    if (periodo) {
      queryCalificaciones.periodo = periodo;
    }
    
    const calificaciones = await db.collection('calificaciones')
      .find(queryCalificaciones)
      .sort({ fecha: 1 })
      .toArray();
    
    // Calcular evolución por materia
    const evolucionPorMateria = {};
    calificaciones.forEach(cal => {
      if (!evolucionPorMateria[cal.materia]) {
        evolucionPorMateria[cal.materia] = [];
      }
      evolucionPorMateria[cal.materia].push({
        fecha: cal.fecha,
        calificacion: cal.calificacion,
        periodo: cal.periodo
      });
    });
    
    // Calcular promedios por periodo
    const promediosPorPeriodo = {};
    calificaciones.forEach(cal => {
      const periodoKey = cal.periodo || 'general';
      if (!promediosPorPeriodo[periodoKey]) {
        promediosPorPeriodo[periodoKey] = { suma: 0, count: 0 };
      }
      promediosPorPeriodo[periodoKey].suma += cal.calificacion;
      promediosPorPeriodo[periodoKey].count++;
    });
    
    const promedios = Object.entries(promediosPorPeriodo).map(([periodo, data]) => ({
      periodo,
      promedio: Math.round((data.suma / data.count) * 10) / 10,
      cantidad: data.count
    }));
    
    // Promedio general
    const promedioGeneral = calificaciones.length > 0
      ? Math.round((calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length) * 10) / 10
      : 0;
    
    // Comparativa con grupo
    let comparativaGrupo = null;
    if (alumno.grupoId) {
      const alumnosGrupo = await db.collection('alumnos')
        .find({ grupoId: alumno.grupoId, activo: true })
        .toArray();
      
      const alumnosIds = alumnosGrupo.map(a => a._id);
      const calificacionesGrupo = await db.collection('calificaciones')
        .find({ alumnoId: { $in: alumnosIds }, ...(periodo ? { periodo } : {}) })
        .toArray();
      
      if (calificacionesGrupo.length > 0) {
        const promedioGrupo = calificacionesGrupo.reduce((sum, cal) => sum + cal.calificacion, 0) / calificacionesGrupo.length;
        comparativaGrupo = {
          promedioGrupo: Math.round(promedioGrupo * 10) / 10,
          promedioAlumno: promedioGeneral,
          diferencia: Math.round((promedioGeneral - promedioGrupo) * 10) / 10,
          posicion: alumnosGrupo.length > 1 ? 
            alumnosGrupo.filter(a => {
              // Calcular promedio de cada alumno para determinar posición
              const calsAlumno = calificacionesGrupo.filter(c => String(c.alumnoId) === String(a._id));
              if (calsAlumno.length === 0) return false;
              const promAlumno = calsAlumno.reduce((sum, cal) => sum + cal.calificacion, 0) / calsAlumno.length;
              return promAlumno < promedioGeneral;
            }).length + 1 : 1,
          totalAlumnos: alumnosGrupo.length
        };
      }
    }
    
    // Áreas de mejora (materias con promedio < 70)
    const areasMejora = Object.entries(evolucionPorMateria)
      .map(([materia, evo]) => {
        const promedio = evo.reduce((sum, e) => sum + e.calificacion, 0) / evo.length;
        return { materia, promedio: Math.round(promedio * 10) / 10, calificaciones: evo };
      })
      .filter(m => m.promedio < 70)
      .sort((a, b) => a.promedio - b.promedio);
    
    // Obtener objetivos del alumno
    const objetivos = await db.collection('objetivos')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .sort({ fechaCreacion: -1 })
      .toArray();
    
    // Calcular logros (objetivos cumplidos)
    const logros = objetivos.filter(obj => {
      if (!obj.meta) return false;
      const materia = obj.materia;
      const calificacionesMateria = calificaciones.filter(c => c.materia === materia);
      if (calificacionesMateria.length === 0) return false;
      const promedioMateria = calificacionesMateria.reduce((sum, cal) => sum + cal.calificacion, 0) / calificacionesMateria.length;
      return promedioMateria >= obj.meta;
    });
    
    res.json({
      alumnoId: alumno._id,
      alumnoNombre: alumno.nombre,
      periodo: periodo || 'todos',
      promedioGeneral,
      promediosPorPeriodo: promedios,
      evolucionPorMateria,
      comparativaGrupo,
      areasMejora,
      objetivos: objetivos.map(obj => ({
        ...obj,
        cumplido: logros.some(l => String(l._id) === String(obj._id))
      })),
      logros: logros.length,
      totalObjetivos: objetivos.length
    });
  } catch (error) {
    console.error('Error obteniendo progreso:', error);
    res.status(500).json({ error: 'Error obteniendo progreso' });
  }
});

// Objetivos y metas
router.get('/api/admin/objetivos', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.query;
    const db = getDB();
    
    let query = {};
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      query.alumnoId = new ObjectId(alumnoId);
    }
    
    const objetivos = await db.collection('objetivos')
      .find(query)
      .sort({ fechaCreacion: -1 })
      .toArray();
    
    res.json(objetivos);
  } catch (error) {
    console.error('Error obteniendo objetivos:', error);
    res.status(500).json({ error: 'Error obteniendo objetivos' });
  }
});

router.post('/api/admin/objetivos', adminAuth, async (req, res) => {
  try {
    const { alumnoId, materia, meta, descripcion, fechaLimite } = req.body;
    
    if (!alumnoId || !materia || meta === undefined) {
      return res.status(400).json({ error: 'Alumno, materia y meta requeridos' });
    }
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    if (meta < 0 || meta > 100) {
      return res.status(400).json({ error: 'Meta debe estar entre 0 y 100' });
    }
    
    const db = getDB();
    const objetivo = {
      alumnoId: new ObjectId(alumnoId),
      materia: materia.trim(),
      meta: parseFloat(meta),
      descripcion: descripcion || '',
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
      cumplido: false,
      fechaCreacion: new Date()
    };
    
    const result = await db.collection('objetivos').insertOne(objetivo);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando objetivo:', error);
    res.status(500).json({ error: 'Error creando objetivo' });
  }
});

router.put('/api/admin/objetivos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { materia, meta, descripcion, fechaLimite, cumplido } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const updateData = { updatedAt: new Date() };
    
    if (materia) updateData.materia = materia.trim();
    if (meta !== undefined) {
      if (meta < 0 || meta > 100) {
        return res.status(400).json({ error: 'Meta debe estar entre 0 y 100' });
      }
      updateData.meta = parseFloat(meta);
    }
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (fechaLimite !== undefined) updateData.fechaLimite = fechaLimite ? new Date(fechaLimite) : null;
    if (cumplido !== undefined) {
      updateData.cumplido = cumplido;
      if (cumplido) {
        updateData.fechaCumplimiento = new Date();
      }
    }
    
    await db.collection('objetivos').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando objetivo:', error);
    res.status(500).json({ error: 'Error actualizando objetivo' });
  }
});

router.delete('/api/admin/objetivos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('objetivos').deleteOne({ _id: new ObjectId(id) });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando objetivo:', error);
    res.status(500).json({ error: 'Error eliminando objetivo' });
  }
});

// GET - Logros y avances
router.get('/api/admin/progreso/:alumnoId/logros', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const objetivos = await db.collection('objetivos')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .toArray();
    
    const calificaciones = await db.collection('calificaciones')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .sort({ fecha: 1 })
      .toArray();
    
    // Calcular logros
    const logros = [];
    objetivos.forEach(obj => {
      if (obj.meta) {
        const calificacionesMateria = calificaciones.filter(c => c.materia === obj.materia);
        if (calificacionesMateria.length > 0) {
          const promedioMateria = calificacionesMateria.reduce((sum, cal) => sum + cal.calificacion, 0) / calificacionesMateria.length;
          if (promedioMateria >= obj.meta) {
            logros.push({
              objetivoId: obj._id,
              materia: obj.materia,
              meta: obj.meta,
              promedioAlcanzado: Math.round(promedioMateria * 10) / 10,
              fechaCumplimiento: obj.fechaCumplimiento || new Date()
            });
          }
        }
      }
    });
    
    // Avances significativos (mejora de 10+ puntos en una materia)
    const avances = [];
    const materias = [...new Set(calificaciones.map(c => c.materia))];
    materias.forEach(materia => {
      const calsMateria = calificaciones.filter(c => c.materia === materia).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      if (calsMateria.length >= 2) {
        const primera = calsMateria[0].calificacion;
        const ultima = calsMateria[calsMateria.length - 1].calificacion;
        const mejora = ultima - primera;
        if (mejora >= 10) {
          avances.push({
            materia,
            mejora: Math.round(mejora * 10) / 10,
            desde: primera,
            hasta: ultima,
            fecha: calsMateria[calsMateria.length - 1].fecha
          });
        }
      }
    });
    
    res.json({
      logros,
      avances,
      totalLogros: logros.length,
      totalAvances: avances.length
    });
  } catch (error) {
    console.error('Error obteniendo logros:', error);
    res.status(500).json({ error: 'Error obteniendo logros' });
  }
});

export default router;
