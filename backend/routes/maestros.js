import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

// GET - Listar maestros
router.get('/api/admin/maestros', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({}, escuelaId);
    
    const maestros = await db.collection('maestros')
      .find(query)
      .sort({ nombre: 1 })
      .toArray();
    res.json(maestros);
  } catch (error) {
    console.error('Error obteniendo maestros:', error);
    res.status(500).json({ error: 'Error obteniendo maestros' });
  }
});

// POST - Crear maestro
router.post('/api/admin/maestros', adminAuth, async (req, res) => {
  try {
    const { nombre, email, telefono, especialidad, horariosDisponibles } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const maestroData = {
      nombre,
      email: email || '',
      telefono: telefono || '',
      especialidad: especialidad || '',
      horariosDisponibles: horariosDisponibles || '',
      activo: true,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      maestroData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('maestros').insertOne(maestroData);

    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando maestro:', error);
    res.status(500).json({ error: 'Error creando maestro' });
  }
});

// PUT - Actualizar maestro
router.put('/api/admin/maestros/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, telefono, especialidad, horariosDisponibles, activo } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const db = getDB();
    await db.collection('maestros').updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          nombre, 
          email, 
          telefono, 
          especialidad, 
          horariosDisponibles,
          activo: activo !== undefined ? activo : true,
          updatedAt: new Date() 
        } 
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando maestro:', error);
    res.status(500).json({ error: 'Error actualizando maestro' });
  }
});

// DELETE - Eliminar maestro (soft delete)
router.delete('/api/admin/maestros/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const db = getDB();
    await db.collection('maestros').updateOne(
      { _id: new ObjectId(id) },
      { $set: { activo: false, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando maestro:', error);
    res.status(500).json({ error: 'Error eliminando maestro' });
  }
});

export default router;
