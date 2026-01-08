import { getDB } from './db.js';
import { ObjectId } from 'mongodb';
import { addEscuelaFilter } from './multi-escuela.js';

export async function getBotKnowledge(escuelaId = null) {
  try {
    const db = getDB();
    
    const queryHorarios = addEscuelaFilter({}, escuelaId);
    const queryEventos = addEscuelaFilter({}, escuelaId);
    const queryPlanes = addEscuelaFilter({}, escuelaId);
    const queryInfo = addEscuelaFilter({ tipo: 'general' }, escuelaId);
    const queryMaestros = addEscuelaFilter({ activo: true }, escuelaId);
    const queryAlumnos = addEscuelaFilter({ activo: true }, escuelaId);
    const queryGrupos = addEscuelaFilter({ activo: true }, escuelaId);
    const queryEspacios = addEscuelaFilter({ activo: true }, escuelaId);
    const queryCalificaciones = addEscuelaFilter({}, escuelaId);
    
    const horarios = await db.collection('horarios').find(queryHorarios).toArray();
    const eventos = await db.collection('eventos').find(queryEventos).toArray();
    const planes = await db.collection('planes').find(queryPlanes).toArray();
    const informacion = await db.collection('informacion').findOne(queryInfo);
    
    // Nuevas entidades LMS
    const maestros = await db.collection('maestros').find(queryMaestros).toArray();
    const alumnos = await db.collection('alumnos').find(queryAlumnos).toArray();
    const grupos = await db.collection('grupos').find(queryGrupos).toArray();
    const espacios = await db.collection('espacios').find(queryEspacios).toArray();
    const calificaciones = await db.collection('calificaciones').find(queryCalificaciones).toArray();

    let knowledge = '\n\nINFORMACIÓN ACTUALIZADA DE LA ESCUELA:\n';
    
    if (horarios.length > 0) {
      knowledge += '\nHORARIOS:\n';
      horarios.forEach(h => {
        knowledge += `- ${h.titulo}: ${h.descripcion}\n`;
      });
    }

    if (eventos.length > 0) {
      knowledge += '\nEVENTOS:\n';
      eventos.forEach(e => {
        knowledge += `- ${e.titulo} (${new Date(e.fecha).toLocaleDateString('es-ES')}): ${e.descripcion}\n`;
      });
    }

    if (planes.length > 0) {
      knowledge += '\nPLANES DE PAGO:\n';
      planes.forEach(p => {
        knowledge += `- ${p.nombre}: ${p.descripcion} - Costo: ${p.costo}\n`;
      });
    }

    if (maestros.length > 0) {
      knowledge += '\nMAESTROS:\n';
      maestros.forEach(m => {
        knowledge += `- ${m.nombre} (${m.especialidad || 'Sin especialidad'}) - Email: ${m.email || 'N/A'}\n`;
      });
    }

    if (grupos.length > 0) {
      knowledge += '\nGRUPOS:\n';
      for (const grupo of grupos) {
        let maestro = null;
        let espacio = null;
        
        if (grupo.maestroId) {
          const maestroIdStr = grupo.maestroId.toString ? grupo.maestroId.toString() : String(grupo.maestroId);
          maestro = maestros.find(m => {
            const mIdStr = m._id.toString ? m._id.toString() : String(m._id);
            return mIdStr === maestroIdStr;
          });
        }
        
        if (grupo.espacioId) {
          const espacioIdStr = grupo.espacioId.toString ? grupo.espacioId.toString() : String(grupo.espacioId);
          espacio = espacios.find(e => {
            const eIdStr = e._id.toString ? e._id.toString() : String(e._id);
            return eIdStr === espacioIdStr;
          });
        }
        
        knowledge += `- ${grupo.nombre} (${grupo.nivel || 'N/A'})`;
        if (maestro) knowledge += ` - Maestro: ${maestro.nombre}`;
        if (espacio) knowledge += ` - Salón: ${espacio.nombre}`;
        if (grupo.horario) knowledge += ` - Horario: ${grupo.horario}`;
        knowledge += '\n';
      }
    }

    if (alumnos.length > 0) {
      knowledge += '\nALUMNOS:\n';
      alumnos.forEach(a => {
        let grupo = null;
        if (a.grupoId) {
          const grupoIdStr = a.grupoId.toString ? a.grupoId.toString() : String(a.grupoId);
          grupo = grupos.find(g => {
            const gIdStr = g._id.toString ? g._id.toString() : String(g._id);
            return gIdStr === grupoIdStr;
          });
        }
        knowledge += `- ${a.nombre}`;
        if (grupo) knowledge += ` - Grupo: ${grupo.nombre}`;
        if (a.email) knowledge += ` - Email: ${a.email}`;
        knowledge += '\n';
      });
    }

    if (espacios.length > 0) {
      knowledge += '\nESPACIOS (SALONES/LABORATORIOS):\n';
      espacios.forEach(e => {
        knowledge += `- ${e.nombre} (${e.tipo}) - Capacidad: ${e.capacidad || 'N/A'}\n`;
      });
    }

    if (calificaciones.length > 0) {
      knowledge += '\nCALIFICACIONES Y RENDIMIENTO ACADÉMICO:\n';
      // Agrupar por alumno
      const calificacionesPorAlumno = {};
      calificaciones.forEach(cal => {
        const alumnoIdStr = cal.alumnoId.toString ? cal.alumnoId.toString() : String(cal.alumnoId);
        if (!calificacionesPorAlumno[alumnoIdStr]) {
          calificacionesPorAlumno[alumnoIdStr] = [];
        }
        calificacionesPorAlumno[alumnoIdStr].push(cal);
      });
      
      for (const [alumnoIdStr, cals] of Object.entries(calificacionesPorAlumno)) {
        const alumno = alumnos.find(a => {
          const aIdStr = a._id.toString ? a._id.toString() : String(a._id);
          return aIdStr === alumnoIdStr;
        });
        if (alumno) {
          const promedio = cals.reduce((sum, cal) => sum + cal.calificacion, 0) / cals.length;
          knowledge += `- ${alumno.nombre}: Promedio ${Math.round(promedio * 10) / 10}/100`;
          const materias = [...new Set(cals.map(cal => cal.materia))];
          knowledge += ` - Materias: ${materias.join(', ')}\n`;
        }
      }
    }

    if (informacion) {
      knowledge += `\nINFORMACIÓN GENERAL: ${informacion.contenido}\n`;
    }

    return knowledge;
  } catch (error) {
    console.error('Error obteniendo conocimiento:', error);
    return '';
  }
}
