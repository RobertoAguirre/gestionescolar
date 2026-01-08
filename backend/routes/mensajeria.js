import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';

const router = express.Router();

// GET - Listar mensajes
router.get('/api/admin/mensajes', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const { alumnoId, maestroId, padreId, tipo } = req.query;
    
    let query = {};
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      query.alumnoId = new ObjectId(alumnoId);
    }
    if (maestroId && ObjectId.isValid(maestroId)) {
      query.maestroId = new ObjectId(maestroId);
    }
    if (padreId) {
      query.padreId = padreId;
    }
    if (tipo) {
      query.tipo = tipo; // 'maestro-padre', 'admin-padre', 'sistema'
    }
    
    const mensajes = await db.collection('mensajes')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
    
    res.json(mensajes);
  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error obteniendo mensajes' });
  }
});

// POST - Enviar mensaje
router.post('/api/admin/mensajes', adminAuth, async (req, res) => {
  try {
    const { alumnoId, maestroId, padreId, tipo, asunto, mensaje, respuestaRapidaId } = req.body;
    
    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }
    
    const db = getDB();
    
    // Si se usa una respuesta rápida, obtener su contenido
    let contenidoMensaje = mensaje;
    if (respuestaRapidaId && ObjectId.isValid(respuestaRapidaId)) {
      const respuestaRapida = await db.collection('respuestas_rapidas').findOne({
        _id: new ObjectId(respuestaRapidaId)
      });
      if (respuestaRapida) {
        contenidoMensaje = respuestaRapida.contenido;
      }
    }
    
    const mensajeData = {
      alumnoId: alumnoId && ObjectId.isValid(alumnoId) ? new ObjectId(alumnoId) : null,
      maestroId: maestroId && ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
      padreId: padreId || null,
      tipo: tipo || 'admin-padre',
      asunto: asunto || 'Mensaje de la escuela',
      mensaje: contenidoMensaje,
      leido: false,
      timestamp: new Date()
    };
    
    const result = await db.collection('mensajes').insertOne(mensajeData);
    
    // Crear notificación automática
    await db.collection('notificaciones').insertOne({
      tipo: 'mensaje',
      alumnoId: mensajeData.alumnoId,
      maestroId: mensajeData.maestroId,
      titulo: mensajeData.asunto,
      mensaje: mensajeData.mensaje.substring(0, 100) + (mensajeData.mensaje.length > 100 ? '...' : ''),
      leida: false,
      timestamp: new Date()
    });
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ error: 'Error enviando mensaje' });
  }
});

// PUT - Marcar mensaje como leído
router.put('/api/admin/mensajes/:id/leido', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('mensajes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { leido: true, leidoAt: new Date() } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marcando mensaje como leído:', error);
    res.status(500).json({ error: 'Error marcando mensaje' });
  }
});

// DELETE - Eliminar mensaje
router.delete('/api/admin/mensajes/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('mensajes').deleteOne({ _id: new ObjectId(id) });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando mensaje:', error);
    res.status(500).json({ error: 'Error eliminando mensaje' });
  }
});

// Respuestas rápidas predefinidas
router.get('/api/admin/respuestas-rapidas', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const respuestas = await db.collection('respuestas_rapidas')
      .find({})
      .sort({ categoria: 1, titulo: 1 })
      .toArray();
    res.json(respuestas);
  } catch (error) {
    console.error('Error obteniendo respuestas rápidas:', error);
    res.status(500).json({ error: 'Error obteniendo respuestas rápidas' });
  }
});

router.post('/api/admin/respuestas-rapidas', adminAuth, async (req, res) => {
  try {
    const { titulo, contenido, categoria } = req.body;
    
    if (!titulo || !contenido) {
      return res.status(400).json({ error: 'Título y contenido requeridos' });
    }
    
    const db = getDB();
    const result = await db.collection('respuestas_rapidas').insertOne({
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      categoria: categoria || 'general',
      timestamp: new Date()
    });
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando respuesta rápida:', error);
    res.status(500).json({ error: 'Error creando respuesta rápida' });
  }
});

router.put('/api/admin/respuestas-rapidas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, contenido, categoria } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const updateData = { updatedAt: new Date() };
    if (titulo) updateData.titulo = titulo.trim();
    if (contenido) updateData.contenido = contenido.trim();
    if (categoria) updateData.categoria = categoria;
    
    await db.collection('respuestas_rapidas').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando respuesta rápida:', error);
    res.status(500).json({ error: 'Error actualizando respuesta rápida' });
  }
});

router.delete('/api/admin/respuestas-rapidas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('respuestas_rapidas').deleteOne({ _id: new ObjectId(id) });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando respuesta rápida:', error);
    res.status(500).json({ error: 'Error eliminando respuesta rápida' });
  }
});

export default router;
