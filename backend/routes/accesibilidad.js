import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';

const router = express.Router();

// GET - Obtener perfil de accesibilidad de un alumno
router.get('/api/admin/accesibilidad/:alumnoId', adminAuth, async (req, res) => {
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
    
    res.json({
      alumnoId: alumno._id,
      alumnoNombre: alumno.nombre,
      perfilAccesibilidad: alumno.perfilAccesibilidad || {
        modoAccesible: false,
        textoSimplificado: false,
        lecturaPantalla: false,
        respuestasCortas: false,
        necesidadesEspeciales: []
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil de accesibilidad:', error);
    res.status(500).json({ error: 'Error obteniendo perfil de accesibilidad' });
  }
});

// PUT - Actualizar perfil de accesibilidad
router.put('/api/admin/accesibilidad/:alumnoId', adminAuth, async (req, res) => {
  try {
    const { alumnoId } = req.params;
    const { perfilAccesibilidad } = req.body;
    
    if (!ObjectId.isValid(alumnoId)) {
      return res.status(400).json({ error: 'ID de alumno inválido' });
    }
    
    if (!perfilAccesibilidad) {
      return res.status(400).json({ error: 'Perfil de accesibilidad requerido' });
    }
    
    const db = getDB();
    await db.collection('alumnos').updateOne(
      { _id: new ObjectId(alumnoId) },
      { 
        $set: { 
          perfilAccesibilidad: {
            modoAccesible: perfilAccesibilidad.modoAccesible || false,
            textoSimplificado: perfilAccesibilidad.textoSimplificado || false,
            lecturaPantalla: perfilAccesibilidad.lecturaPantalla || false,
            respuestasCortas: perfilAccesibilidad.respuestasCortas || false,
            necesidadesEspeciales: Array.isArray(perfilAccesibilidad.necesidadesEspeciales) 
              ? perfilAccesibilidad.necesidadesEspeciales 
              : []
          },
          updatedAt: new Date()
        } 
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando perfil de accesibilidad:', error);
    res.status(500).json({ error: 'Error actualizando perfil de accesibilidad' });
  }
});

// GET - Listar alumnos con perfiles de accesibilidad
router.get('/api/admin/accesibilidad', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const alumnos = await db.collection('alumnos')
      .find({ activo: true })
      .project({ 
        nombre: 1, 
        email: 1, 
        perfilAccesibilidad: 1 
      })
      .toArray();
    
    const perfiles = alumnos.map(alumno => ({
      alumnoId: alumno._id,
      alumnoNombre: alumno.nombre,
      email: alumno.email,
      perfilAccesibilidad: alumno.perfilAccesibilidad || {
        modoAccesible: false,
        textoSimplificado: false,
        lecturaPantalla: false,
        respuestasCortas: false,
        necesidadesEspeciales: []
      }
    }));
    
    res.json(perfiles);
  } catch (error) {
    console.error('Error obteniendo perfiles de accesibilidad:', error);
    res.status(500).json({ error: 'Error obteniendo perfiles de accesibilidad' });
  }
});

export default router;
