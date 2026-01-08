import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';

const router = express.Router();

// POST - Crear encuesta de satisfacción (público)
router.post('/api/encuestas/satisfaccion', async (req, res) => {
  try {
    const { tipo, calificacion, comentarios, email, nombre } = req.body;
    
    if (!tipo || !calificacion) {
      return res.status(400).json({ error: 'Tipo y calificación requeridos' });
    }
    
    if (!['chatbot', 'comunicacion', 'sistema'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Debe ser: chatbot, comunicacion o sistema' });
    }
    
    if (calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ error: 'Calificación debe estar entre 1 y 5' });
    }
    
    const db = getDB();
    const encuesta = {
      tipo: 'satisfaccion',
      subtipo: tipo, // 'chatbot', 'comunicacion', 'sistema'
      calificacion: parseInt(calificacion),
      comentarios: comentarios || '',
      email: email || '',
      nombre: nombre || '',
      timestamp: new Date()
    };
    
    const result = await db.collection('encuestas').insertOne(encuesta);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando encuesta de satisfacción:', error);
    res.status(500).json({ error: 'Error creando encuesta' });
  }
});

// POST - Crear sugerencia de mejora (público)
router.post('/api/encuestas/sugerencias', async (req, res) => {
  try {
    const { sugerencia, categoria, email, nombre } = req.body;
    
    if (!sugerencia || !sugerencia.trim()) {
      return res.status(400).json({ error: 'Sugerencia requerida' });
    }
    
    const db = getDB();
    const encuesta = {
      tipo: 'sugerencia',
      categoria: categoria || 'general',
      sugerencia: sugerencia.trim(),
      email: email || '',
      nombre: nombre || '',
      revisada: false,
      timestamp: new Date()
    };
    
    const result = await db.collection('encuestas').insertOne(encuesta);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando sugerencia:', error);
    res.status(500).json({ error: 'Error creando sugerencia' });
  }
});

// POST - Feedback de maestros (requiere autenticación de maestro o admin)
router.post('/api/encuestas/feedback-maestros', adminAuth, async (req, res) => {
  try {
    const { maestroId, eficiencia, tiempoAhorrado, casosExitosos, comentarios } = req.body;
    
    if (!maestroId || !eficiencia) {
      return res.status(400).json({ error: 'Maestro ID y evaluación de eficiencia requeridos' });
    }
    
    if (!ObjectId.isValid(maestroId)) {
      return res.status(400).json({ error: 'ID de maestro inválido' });
    }
    
    if (eficiencia < 1 || eficiencia > 5) {
      return res.status(400).json({ error: 'Eficiencia debe estar entre 1 y 5' });
    }
    
    const db = getDB();
    const feedback = {
      tipo: 'feedback_maestro',
      maestroId: new ObjectId(maestroId),
      eficiencia: parseInt(eficiencia),
      tiempoAhorrado: tiempoAhorrado ? parseFloat(tiempoAhorrado) : null, // horas
      casosExitosos: casosExitosos || '',
      comentarios: comentarios || '',
      timestamp: new Date()
    };
    
    const result = await db.collection('encuestas').insertOne(feedback);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando feedback de maestro:', error);
    res.status(500).json({ error: 'Error creando feedback' });
  }
});

// GET - Obtener todas las encuestas (admin)
router.get('/api/admin/encuestas', adminAuth, async (req, res) => {
  try {
    const { tipo, subtipo, revisada } = req.query;
    const db = getDB();
    
    let query = {};
    if (tipo) query.tipo = tipo;
    if (subtipo) query.subtipo = subtipo;
    if (revisada !== undefined) query.revisada = revisada === 'true';
    
    const encuestas = await db.collection('encuestas')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
    
    res.json(encuestas);
  } catch (error) {
    console.error('Error obteniendo encuestas:', error);
    res.status(500).json({ error: 'Error obteniendo encuestas' });
  }
});

// GET - Estadísticas de encuestas (admin)
router.get('/api/admin/encuestas/estadisticas', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    
    // Satisfacción del chatbot
    const satisfaccionChatbot = await db.collection('encuestas')
      .find({ tipo: 'satisfaccion', subtipo: 'chatbot' })
      .toArray();
    
    const promedioChatbot = satisfaccionChatbot.length > 0
      ? satisfaccionChatbot.reduce((sum, e) => sum + e.calificacion, 0) / satisfaccionChatbot.length
      : 0;
    
    // Satisfacción con comunicación
    const satisfaccionComunicacion = await db.collection('encuestas')
      .find({ tipo: 'satisfaccion', subtipo: 'comunicacion' })
      .toArray();
    
    const promedioComunicacion = satisfaccionComunicacion.length > 0
      ? satisfaccionComunicacion.reduce((sum, e) => sum + e.calificacion, 0) / satisfaccionComunicacion.length
      : 0;
    
    // Satisfacción con sistema
    const satisfaccionSistema = await db.collection('encuestas')
      .find({ tipo: 'satisfaccion', subtipo: 'sistema' })
      .toArray();
    
    const promedioSistema = satisfaccionSistema.length > 0
      ? satisfaccionSistema.reduce((sum, e) => sum + e.calificacion, 0) / satisfaccionSistema.length
      : 0;
    
    // Sugerencias
    const sugerencias = await db.collection('encuestas')
      .find({ tipo: 'sugerencia' })
      .toArray();
    
    const sugerenciasRevisadas = sugerencias.filter(s => s.revisada).length;
    
    // Feedback de maestros
    const feedbackMaestros = await db.collection('encuestas')
      .find({ tipo: 'feedback_maestro' })
      .toArray();
    
    const promedioEficiencia = feedbackMaestros.length > 0
      ? feedbackMaestros.reduce((sum, f) => sum + f.eficiencia, 0) / feedbackMaestros.length
      : 0;
    
    const tiempoAhorradoTotal = feedbackMaestros
      .filter(f => f.tiempoAhorrado !== null)
      .reduce((sum, f) => sum + f.tiempoAhorrado, 0);
    
    const casosExitosos = feedbackMaestros
      .filter(f => f.casosExitosos && f.casosExitosos.trim())
      .map(f => f.casosExitosos);
    
    // Distribución de calificaciones
    const distribucionChatbot = {
      1: satisfaccionChatbot.filter(e => e.calificacion === 1).length,
      2: satisfaccionChatbot.filter(e => e.calificacion === 2).length,
      3: satisfaccionChatbot.filter(e => e.calificacion === 3).length,
      4: satisfaccionChatbot.filter(e => e.calificacion === 4).length,
      5: satisfaccionChatbot.filter(e => e.calificacion === 5).length
    };
    
    res.json({
      satisfaccion: {
        chatbot: {
          promedio: Math.round(promedioChatbot * 10) / 10,
          total: satisfaccionChatbot.length,
          distribucion: distribucionChatbot
        },
        comunicacion: {
          promedio: Math.round(promedioComunicacion * 10) / 10,
          total: satisfaccionComunicacion.length
        },
        sistema: {
          promedio: Math.round(promedioSistema * 10) / 10,
          total: satisfaccionSistema.length
        }
      },
      sugerencias: {
        total: sugerencias.length,
        revisadas: sugerenciasRevisadas,
        pendientes: sugerencias.length - sugerenciasRevisadas
      },
      feedbackMaestros: {
        total: feedbackMaestros.length,
        promedioEficiencia: Math.round(promedioEficiencia * 10) / 10,
        tiempoAhorradoTotal: Math.round(tiempoAhorradoTotal * 10) / 10,
        casosExitosos: casosExitosos.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas de encuestas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// PUT - Marcar sugerencia como revisada (admin)
router.put('/api/admin/encuestas/:id/revisada', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('encuestas').updateOne(
      { _id: new ObjectId(id) },
      { $set: { revisada: true, revisadaAt: new Date() } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error marcando sugerencia como revisada:', error);
    res.status(500).json({ error: 'Error actualizando sugerencia' });
  }
});

// DELETE - Eliminar encuesta (admin)
router.delete('/api/admin/encuestas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    await db.collection('encuestas').deleteOne({ _id: new ObjectId(id) });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando encuesta:', error);
    res.status(500).json({ error: 'Error eliminando encuesta' });
  }
});

export default router;
