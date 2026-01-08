import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId } from '../utils/multi-escuela.js';

// Función para crear notificaciones automáticas
async function crearNotificacionAutomatica(tipo, datos) {
  try {
    const db = getDB();
    await db.collection('notificaciones').insertOne({
      tipo,
      ...datos,
      leida: false,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error creando notificación automática:', error);
  }
}

const router = express.Router();

// POST - Agendar cita (público)
router.post('/api/citas', async (req, res) => {
  try {
    const { nombre, email, telefono, motivo, fecha, tipo, alumnoId, maestroId } = req.body;

    if (!nombre || !email || !motivo || !fecha || !tipo) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const db = getDB();
    let alumnoIdObj = null;
    let maestroIdObj = null;
    
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      alumnoIdObj = new ObjectId(alumnoId);
    }
    if (maestroId && ObjectId.isValid(maestroId)) {
      maestroIdObj = new ObjectId(maestroId);
    }

    const escuelaId = getEscuelaId(req);
    
    const cita = {
      nombre,
      email,
      telefono: telefono || '',
      motivo,
      fecha: new Date(fecha),
      tipo, // 'directivo' o 'maestro'
      alumnoId: alumnoIdObj,
      maestroId: maestroIdObj,
      estado: 'pendiente',
      timestamp: new Date()
    };
    
    if (escuelaId) {
      cita.escuelaId = escuelaId;
    }

    const result = await db.collection('citas').insertOne(cita);
    
    // Crear notificación automática de cita agendada
    await crearNotificacionAutomatica('cita_agendada', {
      citaId: result.insertedId,
      alumnoId: alumnoIdObj,
      maestroId: maestroIdObj,
      titulo: 'Cita agendada',
      mensaje: `Cita agendada con ${tipo === 'maestro' ? 'maestro' : 'directivo'} para ${nombre}. Fecha: ${new Date(fecha).toLocaleString('es-ES')}`
    });

    res.json({
      success: true,
      citaId: result.insertedId,
      message: 'Cita agendada exitosamente'
    });
  } catch (error) {
    console.error('Error agendando cita:', error);
    res.status(500).json({ error: 'Error agendando cita' });
  }
});

// GET - Obtener citas (público)
router.get('/api/citas', async (req, res) => {
  try {
    const db = getDB();
    const citas = await db.collection('citas')
      .find({})
      .sort({ fecha: 1 })
      .toArray();

    res.json(citas);
  } catch (error) {
    console.error('Error obteniendo citas:', error);
    res.status(500).json({ error: 'Error obteniendo citas' });
  }
});

// GET - Obtener citas (admin)
router.get('/api/admin/citas', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const citas = await db.collection('citas')
      .find({})
      .sort({ fecha: 1 })
      .toArray();
    res.json(citas);
  } catch (error) {
    console.error('Error obteniendo citas:', error);
    res.status(500).json({ error: 'Error obteniendo citas' });
  }
});

// PUT - Actualizar estado de cita (admin)
router.put('/api/admin/citas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const updateData = { updatedAt: new Date() };
    if (estado) updateData.estado = estado;
    if (notas !== undefined) updateData.notas = notas;
    
    await db.collection('citas').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    // Si se actualiza el estado, crear notificación
    if (estado) {
      const cita = await db.collection('citas').findOne({ _id: new ObjectId(id) });
      if (cita) {
        await crearNotificacionAutomatica('cita_actualizada', {
          citaId: cita._id,
          alumnoId: cita.alumnoId,
          maestroId: cita.maestroId,
          titulo: `Cita ${estado}`,
          mensaje: `Su cita ha sido ${estado}. ${notas ? 'Notas: ' + notas : ''}`
        });
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando cita:', error);
    res.status(500).json({ error: 'Error actualizando cita' });
  }
});

export default router;
