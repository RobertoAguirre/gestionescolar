import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

// GET - Listar espacios
router.get('/api/admin/espacios', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const espacios = await db.collection('espacios')
      .find(query)
      .sort({ nombre: 1 })
      .toArray();
    res.json(espacios);
  } catch (error) {
    console.error('Error obteniendo espacios:', error);
    res.status(500).json({ error: 'Error obteniendo espacios' });
  }
});

// POST - Crear espacio
router.post('/api/admin/espacios', adminAuth, async (req, res) => {
  try {
    const { nombre, tipo, capacidad, equipamiento } = req.body;
    
    if (!nombre || !tipo) {
      return res.status(400).json({ error: 'Nombre y tipo requeridos' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const capacidadNum = capacidad ? parseInt(capacidad, 10) : 0;
    
    const espacioData = {
      nombre,
      tipo, // 'salon' o 'laboratorio'
      capacidad: isNaN(capacidadNum) ? 0 : capacidadNum,
      equipamiento: equipamiento || '',
      activo: true,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      espacioData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('espacios').insertOne(espacioData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando espacio:', error);
    res.status(500).json({ error: 'Error creando espacio' });
  }
});

// PUT - Actualizar espacio
router.put('/api/admin/espacios/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, capacidad, equipamiento, activo } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const db = getDB();
    const capacidadNum = capacidad ? parseInt(capacidad, 10) : 0;
    
    await db.collection('espacios').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          nombre, 
          tipo, 
          capacidad: isNaN(capacidadNum) ? 0 : capacidadNum, 
          equipamiento,
          activo: activo !== undefined ? activo : true,
          updatedAt: new Date() 
        } 
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando espacio:', error);
    res.status(500).json({ error: 'Error actualizando espacio' });
  }
});

// DELETE - Eliminar espacio (soft delete)
router.delete('/api/admin/espacios/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('espacios').updateOne(
      { _id: new ObjectId(id) },
      { $set: { activo: false, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando espacio:', error);
    res.status(500).json({ error: 'Error eliminando espacio' });
  }
});

export default router;
