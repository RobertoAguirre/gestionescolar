import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { generateResponse } from '../utils/ai-provider.js';

const router = express.Router();

// Función para calcular riesgo académico
function calcularRiesgoAcademico(calificaciones, asistencia, objetivos) {
  let puntajeRiesgo = 0;
  const factores = {
    calificaciones: 0,
    asistencia: 0,
    tendencia: 0,
    objetivos: 0
  };

  // Factor 1: Calificaciones (0-40 puntos de riesgo)
  if (calificaciones.length > 0) {
    const promedio = calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length;
    factores.calificaciones = promedio;
    
    if (promedio < 60) puntajeRiesgo += 40;
    else if (promedio < 70) puntajeRiesgo += 25;
    else if (promedio < 80) puntajeRiesgo += 10;
    
    // Tendencias (últimas 3 calificaciones)
    if (calificaciones.length >= 3) {
      const ultimas3 = calificaciones.slice(-3).map(c => c.calificacion);
      const tendencia = (ultimas3[2] + ultimas3[1]) / 2 - ultimas3[0];
      factores.tendencia = tendencia;
      
      if (tendencia < -10) puntajeRiesgo += 15; // Tendencia descendente
    }
  } else {
    puntajeRiesgo += 20; // Sin calificaciones registradas
  }

  // Factor 2: Asistencia (0-30 puntos de riesgo)
  if (asistencia.total > 0) {
    const porcentajeAsistencia = ((asistencia.presente + asistencia.justificado) / asistencia.total) * 100;
    factores.asistencia = porcentajeAsistencia;
    
    if (porcentajeAsistencia < 70) puntajeRiesgo += 30;
    else if (porcentajeAsistencia < 80) puntajeRiesgo += 20;
    else if (porcentajeAsistencia < 90) puntajeRiesgo += 10;
  } else {
    puntajeRiesgo += 10; // Sin datos de asistencia
  }

  // Factor 3: Objetivos no cumplidos (0-20 puntos de riesgo)
  if (objetivos.length > 0) {
    const objetivosNoCumplidos = objetivos.filter(obj => !obj.cumplido).length;
    const porcentajeNoCumplidos = (objetivosNoCumplidos / objetivos.length) * 100;
    factores.objetivos = porcentajeNoCumplidos;
    
    if (porcentajeNoCumplidos > 70) puntajeRiesgo += 20;
    else if (porcentajeNoCumplidos > 50) puntajeRiesgo += 10;
  }

  // Clasificar nivel de riesgo
  let nivelRiesgo = 'bajo';
  if (puntajeRiesgo >= 60) nivelRiesgo = 'alto';
  else if (puntajeRiesgo >= 35) nivelRiesgo = 'medio';
  
  return {
    puntajeRiesgo: Math.min(puntajeRiesgo, 100),
    nivelRiesgo,
    factores
  };
}

// GET - Análisis predictivo de un alumno
router.get('/api/admin/analisis-predictivo/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    const db = getDB();
    const alumno = await db.collection('alumnos').findOne({ _id: new ObjectId(alumnoId) });
    
    if (!alumno) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    // Obtener datos del alumno
    const calificaciones = await db.collection('calificaciones')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .sort({ fecha: 1 })
      .toArray();
    
    const registrosAsistencia = await db.collection('asistencia')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .toArray();
    
    const asistencia = {
      total: registrosAsistencia.length,
      presente: registrosAsistencia.filter(r => r.estado === 'presente').length,
      ausente: registrosAsistencia.filter(r => r.estado === 'ausente').length,
      tardanza: registrosAsistencia.filter(r => r.estado === 'tardanza').length,
      justificado: registrosAsistencia.filter(r => r.estado === 'justificado').length
    };
    
    const objetivos = await db.collection('objetivos')
      .find({ alumnoId: new ObjectId(alumnoId) })
      .toArray();
    
    // Calcular riesgo académico
    const riesgo = calcularRiesgoAcademico(calificaciones, asistencia, objetivos);
    
    // Preparar datos para IA
    const promedioGeneral = calificaciones.length > 0
      ? calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length
      : 0;
    
    const porcentajeAsistencia = asistencia.total > 0
      ? ((asistencia.presente + asistencia.justificado) / asistencia.total) * 100
      : 0;
    
    // Generar recomendaciones con IA
    let recomendacionesIA = null;
    try {
      const promptIA = `Eres un experto en educación. Analiza el siguiente caso de un estudiante y proporciona recomendaciones específicas:

ALUMNO: ${alumno.nombre}
PROMEDIO GENERAL: ${Math.round(promedioGeneral * 10) / 10}/100
PORCENTAJE DE ASISTENCIA: ${Math.round(porcentajeAsistencia * 10) / 10}%
NIVEL DE RIESGO: ${riesgo.nivelRiesgo.toUpperCase()}
PUNTAJE DE RIESGO: ${riesgo.puntajeRiesgo}/100

FACTORES DE RIESGO:
- Calificaciones: ${riesgo.factores.calificaciones}/100
- Asistencia: ${riesgo.factores.asistencia}%
- Tendencia: ${riesgo.factores.tendencia > 0 ? '+' : ''}${Math.round(riesgo.factores.tendencia * 10) / 10} puntos
- Objetivos no cumplidos: ${riesgo.factores.objetivos}%

MATERIAS CON CALIFICACIONES:
${calificaciones.length > 0 ? calificaciones.map(c => `- ${c.materia}: ${c.calificacion}/100`).join('\n') : 'Sin calificaciones registradas'}

Proporciona recomendaciones en el siguiente formato JSON:
{
  "recomendacionesIntervencion": ["recomendación 1", "recomendación 2", "recomendación 3"],
  "sugerenciasActividades": ["actividad 1", "actividad 2", "actividad 3"],
  "recursosApoyo": ["recurso 1", "recurso 2", "recurso 3"],
  "estrategiasAprendizaje": ["estrategia 1", "estrategia 2", "estrategia 3"]
}

Responde SOLO con el JSON, sin texto adicional.`;

      const respuestaIA = await generateResponse(
        [{ role: 'user', content: promptIA }],
        'Eres un experto en educación y análisis académico. Proporciona recomendaciones prácticas y específicas.',
        { maxTokens: 800, responseStyle: 'normal' }
      );
      
      // Intentar parsear JSON de la respuesta
      try {
        const jsonMatch = respuestaIA.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recomendacionesIA = JSON.parse(jsonMatch[0]);
        } else {
          // Si no hay JSON, crear recomendaciones básicas
          recomendacionesIA = {
            recomendacionesIntervencion: ['Revisar el caso con el equipo docente', 'Establecer comunicación con los padres', 'Implementar plan de apoyo académico'],
            sugerenciasActividades: ['Sesiones de refuerzo', 'Tutorías personalizadas', 'Actividades de práctica'],
            recursosApoyo: ['Material de estudio adicional', 'Plataformas educativas', 'Apoyo psicopedagógico'],
            estrategiasAprendizaje: ['Aprendizaje activo', 'Técnicas de estudio', 'Organización del tiempo']
          };
        }
      } catch (parseError) {
        // Si falla el parseo, usar recomendaciones básicas
        recomendacionesIA = {
          recomendacionesIntervencion: ['Revisar el caso con el equipo docente', 'Establecer comunicación con los padres', 'Implementar plan de apoyo académico'],
          sugerenciasActividades: ['Sesiones de refuerzo', 'Tutorías personalizadas', 'Actividades de práctica'],
          recursosApoyo: ['Material de estudio adicional', 'Plataformas educativas', 'Apoyo psicopedagógico'],
          estrategiasAprendizaje: ['Aprendizaje activo', 'Técnicas de estudio', 'Organización del tiempo']
        };
      }
    } catch (error) {
      console.error('Error generando recomendaciones con IA:', error);
      // Recomendaciones básicas si falla la IA
      recomendacionesIA = {
        recomendacionesIntervencion: ['Revisar el caso con el equipo docente', 'Establecer comunicación con los padres'],
        sugerenciasActividades: ['Sesiones de refuerzo', 'Tutorías personalizadas'],
        recursosApoyo: ['Material de estudio adicional', 'Apoyo psicopedagógico'],
        estrategiasAprendizaje: ['Aprendizaje activo', 'Técnicas de estudio']
      };
    }
    
    res.json({
      alumnoId: alumno._id,
      alumnoNombre: alumno.nombre,
      riesgo,
      datos: {
        promedioGeneral: Math.round(promedioGeneral * 10) / 10,
        porcentajeAsistencia: Math.round(porcentajeAsistencia * 10) / 10,
        totalCalificaciones: calificaciones.length,
        totalAsistencias: asistencia.total,
        objetivosTotal: objetivos.length,
        objetivosCumplidos: objetivos.filter(obj => obj.cumplido).length
      },
      recomendaciones: recomendacionesIA
    });
  } catch (error) {
    console.error('Error en análisis predictivo:', error);
    res.status(500).json({ error: 'Error en análisis predictivo' });
  }
});

// GET - Lista de alumnos en riesgo
router.get('/api/admin/analisis-predictivo/riesgo', adminAuth, async (req, res) => {
  try {
    const { nivelRiesgo, limite = 50 } = req.query;
    const db = getDB();
    
    const alumnos = await db.collection('alumnos')
      .find({ activo: true })
      .limit(parseInt(limite))
      .toArray();
    
    const alumnosEnRiesgo = [];
    
    for (const alumno of alumnos) {
      const calificaciones = await db.collection('calificaciones')
        .find({ alumnoId: alumno._id })
        .toArray();
      
      const registrosAsistencia = await db.collection('asistencia')
        .find({ alumnoId: alumno._id })
        .toArray();
      
      const asistencia = {
        total: registrosAsistencia.length,
        presente: registrosAsistencia.filter(r => r.estado === 'presente').length,
        justificado: registrosAsistencia.filter(r => r.estado === 'justificado').length
      };
      
      const objetivos = await db.collection('objetivos')
        .find({ alumnoId: alumno._id })
        .toArray();
      
      const riesgo = calcularRiesgoAcademico(calificaciones, asistencia, objetivos);
      
      if (!nivelRiesgo || riesgo.nivelRiesgo === nivelRiesgo) {
        alumnosEnRiesgo.push({
          alumnoId: alumno._id,
          alumnoNombre: alumno.nombre,
          grupoId: alumno.grupoId,
          riesgo: {
            puntaje: riesgo.puntajeRiesgo,
            nivel: riesgo.nivelRiesgo
          },
          promedio: calificaciones.length > 0
            ? Math.round((calificaciones.reduce((sum, cal) => sum + cal.calificacion, 0) / calificaciones.length) * 10) / 10
            : 0
        });
      }
    }
    
    // Ordenar por puntaje de riesgo (mayor a menor)
    alumnosEnRiesgo.sort((a, b) => b.riesgo.puntaje - a.riesgo.puntaje);
    
    res.json({
      total: alumnosEnRiesgo.length,
      alumnos: alumnosEnRiesgo
    });
  } catch (error) {
    console.error('Error obteniendo alumnos en riesgo:', error);
    res.status(500).json({ error: 'Error obteniendo alumnos en riesgo' });
  }
});

export default router;
