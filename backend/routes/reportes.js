import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

const router = express.Router();

// Función para obtener reporte mensual de uso
async function generarReporteMensualUso(escuelaId, mes, año) {
  const db = getDB();
  const inicioMes = new Date(año, mes - 1, 1);
  const finMes = new Date(año, mes, 0, 23, 59, 59);
  
  const queryConversaciones = addEscuelaFilter({
    timestamp: { $gte: inicioMes, $lte: finMes }
  }, escuelaId);
  
  const queryCitas = addEscuelaFilter({
    timestamp: { $gte: inicioMes, $lte: finMes }
  }, escuelaId);
  
  const totalConversaciones = await db.collection('conversations').countDocuments(queryConversaciones);
  const conversacionesResueltas = await db.collection('conversations').countDocuments({
    ...queryConversaciones,
    resueltoSinCita: true
  });
  const conversacionesConCita = await db.collection('conversations').countDocuments({
    ...queryConversaciones,
    sugiereCita: true
  });
  
  const totalCitas = await db.collection('citas').countDocuments(queryCitas);
  const citasCompletadas = await db.collection('citas').countDocuments({
    ...queryCitas,
    estado: 'completada'
  });
  
  const conversacionesConTiempo = await db.collection('conversations')
    .find({ ...queryConversaciones, responseTime: { $exists: true } })
    .toArray();
  
  const tiempoPromedio = conversacionesConTiempo.length > 0
    ? Math.round(conversacionesConTiempo.reduce((sum, c) => sum + (c.responseTime || 0), 0) / conversacionesConTiempo.length)
    : 0;
  
  return {
    periodo: `${mes}/${año}`,
    conversaciones: {
      total: totalConversaciones,
      resueltas: conversacionesResueltas,
      conCita: conversacionesConCita,
      tiempoPromedio: tiempoPromedio
    },
    citas: {
      total: totalCitas,
      completadas: citasCompletadas
    },
    tiempoAhorrado: Math.round((conversacionesResueltas * 5) / 60 * 10) / 10 // Horas estimadas
  };
}

// Función para obtener reporte de impacto
async function generarReporteImpacto(escuelaId, fechaInicio, fechaFin) {
  const db = getDB();
  
  const queryBase = addEscuelaFilter({
    timestamp: { $gte: fechaInicio, $lte: fechaFin }
  }, escuelaId);
  
  const conversacionesResueltas = await db.collection('conversations').countDocuments({
    ...queryBase,
    resueltoSinCita: true
  });
  
  const conversacionesConCita = await db.collection('conversations').countDocuments({
    ...queryBase,
    sugiereCita: true
  });
  
  const totalInteracciones = conversacionesResueltas + conversacionesConCita;
  const tasaResolucion = totalInteracciones > 0
    ? Math.round((conversacionesResueltas / totalInteracciones) * 100)
    : 0;
  
  const tiempoAhorrado = Math.round((conversacionesResueltas * 5) / 60 * 10) / 10;
  
  // Encuestas de satisfacción
  const queryEncuestas = addEscuelaFilter({
    timestamp: { $gte: fechaInicio, $lte: fechaFin }
  }, escuelaId);
  
  const encuestas = await db.collection('encuestas_satisfaccion')
    .find(queryEncuestas)
    .toArray();
  
  const promedioSatisfaccion = encuestas.length > 0
    ? (encuestas.reduce((sum, e) => sum + (e.calificacion || 0), 0) / encuestas.length).toFixed(1)
    : 0;
  
  return {
    periodo: {
      inicio: fechaInicio.toLocaleDateString('es-ES'),
      fin: fechaFin.toLocaleDateString('es-ES')
    },
    conversaciones: {
      resueltas: conversacionesResueltas,
      conCita: conversacionesConCita,
      totalInteracciones: totalInteracciones
    },
    metricas: {
      tasaResolucion,
      tiempoAhorrado,
      promedioSatisfaccion: parseFloat(promedioSatisfaccion)
    }
  };
}

// Función para obtener reporte académico
async function generarReporteAcademico(escuelaId, periodo) {
  const db = getDB();
  
  const queryAlumnos = addEscuelaFilter({ activo: true }, escuelaId);
  const alumnos = await db.collection('alumnos').find(queryAlumnos).toArray();
  
  const queryCalificaciones = addEscuelaFilter({
    periodo: periodo || { $exists: true }
  }, escuelaId);
  
  const calificaciones = await db.collection('calificaciones')
    .find(queryCalificaciones)
    .toArray();
  
  const queryAsistencia = addEscuelaFilter({
    periodo: periodo || { $exists: true }
  }, escuelaId);
  
  const asistencias = await db.collection('asistencia')
    .find(queryAsistencia)
    .toArray();
  
  // Calcular promedios por alumno
  const promediosPorAlumno = {};
  alumnos.forEach(alumno => {
    const califsAlumno = calificaciones.filter(c => 
      String(c.alumnoId) === String(alumno._id)
    );
    if (califsAlumno.length > 0) {
      const promedio = califsAlumno.reduce((sum, c) => sum + c.calificacion, 0) / califsAlumno.length;
      promediosPorAlumno[alumno._id] = {
        nombre: alumno.nombre,
        promedio: Math.round(promedio * 10) / 10,
        totalCalificaciones: califsAlumno.length
      };
    }
  });
  
  // Calcular estadísticas de asistencia
  const estadisticasAsistencia = {};
  alumnos.forEach(alumno => {
    const asistAlumno = asistencias.filter(a => 
      String(a.alumnoId) === String(alumno._id)
    );
    if (asistAlumno.length > 0) {
      const presentes = asistAlumno.filter(a => a.estado === 'presente').length;
      const porcentaje = (presentes / asistAlumno.length) * 100;
      estadisticasAsistencia[alumno._id] = {
        nombre: alumno.nombre,
        porcentajeAsistencia: Math.round(porcentaje * 10) / 10,
        totalClases: asistAlumno.length,
        presentes,
        ausentes: asistAlumno.length - presentes
      };
    }
  });
  
  // Alumnos en riesgo
  const alumnosEnRiesgo = alumnos.filter(alumno => {
    const promedio = promediosPorAlumno[alumno._id]?.promedio || 100;
    const asistencia = estadisticasAsistencia[alumno._id]?.porcentajeAsistencia || 100;
    return promedio < 70 || asistencia < 80;
  }).map(alumno => ({
    nombre: alumno.nombre,
    promedio: promediosPorAlumno[alumno._id]?.promedio || 'N/A',
    asistencia: estadisticasAsistencia[alumno._id]?.porcentajeAsistencia || 'N/A'
  }));
  
  return {
    periodo: periodo || 'Todos los periodos',
    totalAlumnos: alumnos.length,
    totalCalificaciones: calificaciones.length,
    totalAsistencias: asistencias.length,
    promediosPorAlumno: Object.values(promediosPorAlumno),
    estadisticasAsistencia: Object.values(estadisticasAsistencia),
    alumnosEnRiesgo,
    promedioGeneral: calificaciones.length > 0
      ? Math.round((calificaciones.reduce((sum, c) => sum + c.calificacion, 0) / calificaciones.length) * 10) / 10
      : 0
  };
}

// GET - Reporte mensual de uso
router.get('/api/admin/reportes/mensual-uso', adminAuth, async (req, res) => {
  try {
    const { mes, año } = req.query;
    const mesNum = parseInt(mes) || new Date().getMonth() + 1;
    const añoNum = parseInt(año) || new Date().getFullYear();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const reporte = await generarReporteMensualUso(escuelaId, mesNum, añoNum);
    res.json(reporte);
  } catch (error) {
    console.error('Error generando reporte mensual:', error);
    res.status(500).json({ error: 'Error generando reporte mensual' });
  }
});

// GET - Reporte de impacto
router.get('/api/admin/reportes/impacto', adminAuth, async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const inicio = fechaInicio ? new Date(fechaInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const fin = fechaFin ? new Date(fechaFin) : new Date();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const reporte = await generarReporteImpacto(escuelaId, inicio, fin);
    res.json(reporte);
  } catch (error) {
    console.error('Error generando reporte de impacto:', error);
    res.status(500).json({ error: 'Error generando reporte de impacto' });
  }
});

// GET - Reporte académico
router.get('/api/admin/reportes/academico', adminAuth, async (req, res) => {
  try {
    const { periodo } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const reporte = await generarReporteAcademico(escuelaId, periodo);
    res.json(reporte);
  } catch (error) {
    console.error('Error generando reporte académico:', error);
    res.status(500).json({ error: 'Error generando reporte académico' });
  }
});

// GET - Exportar reporte a Excel
router.get('/api/admin/reportes/exportar/excel', adminAuth, async (req, res) => {
  try {
    const { tipo, mes, año, periodo, fechaInicio, fechaFin } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let datos = {};
    let nombreArchivo = 'reporte';
    
    if (tipo === 'mensual-uso') {
      const mesNum = parseInt(mes) || new Date().getMonth() + 1;
      const añoNum = parseInt(año) || new Date().getFullYear();
      datos = await generarReporteMensualUso(escuelaId, mesNum, añoNum);
      nombreArchivo = `reporte-mensual-${mesNum}-${añoNum}`;
    } else if (tipo === 'impacto') {
      const inicio = fechaInicio ? new Date(fechaInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fin = fechaFin ? new Date(fechaFin) : new Date();
      datos = await generarReporteImpacto(escuelaId, inicio, fin);
      nombreArchivo = `reporte-impacto-${inicio.toISOString().split('T')[0]}-${fin.toISOString().split('T')[0]}`;
    } else if (tipo === 'academico') {
      datos = await generarReporteAcademico(escuelaId, periodo);
      nombreArchivo = `reporte-academico-${periodo || 'todos'}`;
    }
    
    // Convertir datos a formato Excel
    const workbook = XLSX.utils.book_new();
    
    // Crear hoja principal
    const datosAplanados = [];
    const aplanar = (obj, prefijo = '') => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          aplanar(obj[key], `${prefijo}${key}.`);
        } else if (Array.isArray(obj[key])) {
          obj[key].forEach((item, index) => {
            if (typeof item === 'object') {
              aplanar(item, `${prefijo}${key}[${index}].`);
            } else {
              datosAplanados.push({ Campo: `${prefijo}${key}[${index}]`, Valor: item });
            }
          });
        } else {
          datosAplanados.push({ Campo: `${prefijo}${key}`, Valor: obj[key] });
        }
      }
    };
    
    aplanar(datos);
    const worksheet = XLSX.utils.json_to_sheet(datosAplanados);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    
    // Generar buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exportando a Excel:', error);
    res.status(500).json({ error: 'Error exportando a Excel' });
  }
});

// GET - Exportar reporte a PDF
router.get('/api/admin/reportes/exportar/pdf', adminAuth, async (req, res) => {
  try {
    const { tipo, mes, año, periodo, fechaInicio, fechaFin } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let datos = {};
    let titulo = 'Reporte';
    
    if (tipo === 'mensual-uso') {
      const mesNum = parseInt(mes) || new Date().getMonth() + 1;
      const añoNum = parseInt(año) || new Date().getFullYear();
      datos = await generarReporteMensualUso(escuelaId, mesNum, añoNum);
      titulo = `Reporte Mensual de Uso - ${mesNum}/${añoNum}`;
    } else if (tipo === 'impacto') {
      const inicio = fechaInicio ? new Date(fechaInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fin = fechaFin ? new Date(fechaFin) : new Date();
      datos = await generarReporteImpacto(escuelaId, inicio, fin);
      titulo = `Reporte de Impacto - ${inicio.toLocaleDateString('es-ES')} a ${fin.toLocaleDateString('es-ES')}`;
    } else if (tipo === 'academico') {
      datos = await generarReporteAcademico(escuelaId, periodo);
      titulo = `Reporte Académico - ${periodo || 'Todos los periodos'}`;
    }
    
    // Crear PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte.pdf"`);
    
    doc.pipe(res);
    
    // Título
    doc.fontSize(20).text(titulo, { align: 'center' });
    doc.moveDown();
    
    // Fecha de generación
    doc.fontSize(10).text(`Generado el: ${new Date().toLocaleString('es-ES')}`, { align: 'right' });
    doc.moveDown(2);
    
    // Contenido
    doc.fontSize(12);
    const contenido = JSON.stringify(datos, null, 2);
    const lineas = contenido.split('\n');
    lineas.forEach(linea => {
      if (linea.length > 0) {
        doc.text(linea, { align: 'left' });
      }
    });
    
    doc.end();
  } catch (error) {
    console.error('Error exportando a PDF:', error);
    res.status(500).json({ error: 'Error exportando a PDF' });
  }
});

// GET - Datos para análisis externo (JSON)
router.get('/api/admin/reportes/datos-analisis', adminAuth, async (req, res) => {
  try {
    const { tipo, mes, año, periodo, fechaInicio, fechaFin } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let datos = {};
    
    if (tipo === 'mensual-uso') {
      const mesNum = parseInt(mes) || new Date().getMonth() + 1;
      const añoNum = parseInt(año) || new Date().getFullYear();
      datos = await generarReporteMensualUso(escuelaId, mesNum, añoNum);
    } else if (tipo === 'impacto') {
      const inicio = fechaInicio ? new Date(fechaInicio) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const fin = fechaFin ? new Date(fechaFin) : new Date();
      datos = await generarReporteImpacto(escuelaId, inicio, fin);
    } else if (tipo === 'academico') {
      datos = await generarReporteAcademico(escuelaId, periodo);
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="datos-analisis.json"');
    res.json(datos);
  } catch (error) {
    console.error('Error generando datos para análisis:', error);
    res.status(500).json({ error: 'Error generando datos para análisis' });
  }
});

export default router;
