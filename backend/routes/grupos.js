import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

// GET - Listar grupos
router.get('/api/admin/grupos', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const grupos = await db.collection('grupos')
      .find(query)
      .sort({ nombre: 1 })
      .toArray();
    res.json(grupos);
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    res.status(500).json({ error: 'Error obteniendo grupos' });
  }
});

// POST - Crear grupo
router.post('/api/admin/grupos', adminAuth, async (req, res) => {
  try {
    const { nombre, nivel, maestroId, espacioId, horario, alumnos } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let maestroIdObj = null;
    let espacioIdObj = null;
    
    if (maestroId && ObjectId.isValid(maestroId)) {
      maestroIdObj = new ObjectId(maestroId);
    }
    if (espacioId && ObjectId.isValid(espacioId)) {
      espacioIdObj = new ObjectId(espacioId);
    }

    const grupoData = {
      nombre,
      nivel: nivel || '',
      maestroId: maestroIdObj,
      espacioId: espacioIdObj,
      horario: horario || '',
      alumnos: Array.isArray(alumnos) ? alumnos : [],
      activo: true,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      grupoData.escuelaId = escuelaId;
    }

    const result = await db.collection('grupos').insertOne(grupoData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando grupo:', error);
    res.status(500).json({ error: 'Error creando grupo' });
  }
});

// PUT - Actualizar grupo
router.put('/api/admin/grupos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, nivel, maestroId, espacioId, horario, alumnos, activo } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const db = getDB();
    let maestroIdObj = null;
    let espacioIdObj = null;
    
    if (maestroId && ObjectId.isValid(maestroId)) {
      maestroIdObj = new ObjectId(maestroId);
    }
    if (espacioId && ObjectId.isValid(espacioId)) {
      espacioIdObj = new ObjectId(espacioId);
    }

    await db.collection('grupos').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          nombre, 
          nivel, 
          maestroId: maestroIdObj,
          espacioId: espacioIdObj,
          horario, 
          alumnos: Array.isArray(alumnos) ? alumnos : [],
          activo: activo !== undefined ? activo : true,
          updatedAt: new Date() 
        } 
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando grupo:', error);
    res.status(500).json({ error: 'Error actualizando grupo' });
  }
});

// DELETE - Eliminar grupo (soft delete)
router.delete('/api/admin/grupos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('grupos').updateOne(
      { _id: new ObjectId(id) },
      { $set: { activo: false, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando grupo:', error);
    res.status(500).json({ error: 'Error eliminando grupo' });
  }
});

export default router;
