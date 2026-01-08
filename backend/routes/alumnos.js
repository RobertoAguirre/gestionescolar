import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

// GET - Listar alumnos
router.get('/api/admin/alumnos', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const alumnos = await db.collection('alumnos')
      .find(query)
      .sort({ nombre: 1 })
      .toArray();
    res.json(alumnos);
  } catch (error) {
    console.error('Error obteniendo alumnos:', error);
    res.status(500).json({ error: 'Error obteniendo alumnos' });
  }
});

  // POST - Crear alumno
  router.post('/api/admin/alumnos', adminAuth, async (req, res) => {
    try {
      const { nombre, email, telefono, grupoId, padres, perfilAccesibilidad } = req.body;

      if (!nombre) {
        return res.status(400).json({ error: 'Nombre requerido' });
      }

      const db = getDB();
      let grupoIdObj = null;
      if (grupoId && ObjectId.isValid(grupoId)) {
        grupoIdObj = new ObjectId(grupoId);
      }

      const escuelaId = req.escuelaId || getEscuelaId(req);
      
      const alumnoData = {
        nombre,
        email: email || '',
        telefono: telefono || '',
        grupoId: grupoIdObj,
        padres: Array.isArray(padres) ? padres : [],
        activo: true,
        perfilAccesibilidad: perfilAccesibilidad || {
          modoAccesible: false,
          textoSimplificado: false,
          lecturaPantalla: false,
          respuestasCortas: false,
          necesidadesEspeciales: []
        },
        timestamp: new Date()
      };
      
      if (escuelaId) {
        alumnoData.escuelaId = escuelaId;
      }
      
      const result = await db.collection('alumnos').insertOne(alumnoData);

      res.json({ success: true, id: result.insertedId });
    } catch (error) {
      console.error('Error creando alumno:', error);
      res.status(500).json({ error: 'Error creando alumno' });
    }
  });

  // PUT - Actualizar alumno
  router.put('/api/admin/alumnos/:id', adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, email, telefono, grupoId, padres, activo, perfilAccesibilidad } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const db = getDB();
      let grupoIdObj = null;
      if (grupoId && ObjectId.isValid(grupoId)) {
        grupoIdObj = new ObjectId(grupoId);
      }

      const updateData = {
        nombre,
        email,
        telefono,
        grupoId: grupoIdObj,
        padres: Array.isArray(padres) ? padres : [],
        activo: activo !== undefined ? activo : true,
        updatedAt: new Date()
      };

      if (perfilAccesibilidad) {
        updateData.perfilAccesibilidad = perfilAccesibilidad;
      }

      await db.collection('alumnos').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Error actualizando alumno:', error);
      res.status(500).json({ error: 'Error actualizando alumno' });
    }
  });

// DELETE - Eliminar alumno (soft delete)
router.delete('/api/admin/alumnos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('alumnos').updateOne(
      { _id: new ObjectId(id) },
      { $set: { activo: false, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando alumno:', error);
    res.status(500).json({ error: 'Error eliminando alumno' });
  }
});

export default router;
