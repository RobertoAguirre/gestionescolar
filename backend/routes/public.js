import express from 'express';
import { getDB } from '../utils/db.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

// GET - Obtener maestros activos (público para chatbot)
router.get('/api/maestros', async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    const query = addEscuelaFilter({ activo: true }, escuelaId);
    
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

// GET - Obtener alumnos activos (público para chatbot)
router.get('/api/alumnos', async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    const query = addEscuelaFilter({ activo: true }, escuelaId);
    
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

export default router;
