import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import Anthropic from '@anthropic-ai/sdk';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'uploads')));

// Configuración de multer para subida de archivos
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Cliente MongoDB
let db;
const client = new MongoClient(process.env.MONGODB_URI);

// Cliente Anthropic (Claude)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Conectar a MongoDB
async function connectDB() {
  try {
    await client.connect();
    db = client.db('gestion-escolar');
    console.log('✅ Conectado a MongoDB Atlas');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Función para obtener conocimiento del bot desde la BD
async function getBotKnowledge() {
  try {
    const horarios = await db.collection('horarios').find({}).toArray();
    const eventos = await db.collection('eventos').find({}).toArray();
    const planes = await db.collection('planes').find({}).toArray();
    const informacion = await db.collection('informacion').findOne({ tipo: 'general' });

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

    if (informacion) {
      knowledge += `\nINFORMACIÓN GENERAL: ${informacion.contenido}\n`;
    }

    return knowledge;
  } catch (error) {
    console.error('Error obteniendo conocimiento:', error);
    return '';
  }
}

// Sistema de prompts base para el asistente
const baseSystemPrompt = `Eres un asistente virtual amigable para una escuela. Ayudas a padres de familia con:
- Horarios de clases y actividades
- Eventos escolares
- Desempeño académico de sus hijos
- Planes de pago y cobros
- Agendamiento de citas con directivos o profesores

Sé amable, claro y conciso. Usa la información proporcionada para responder preguntas específicas. Si necesitas información que no está disponible, sugiere agendar una cita.`;

// Middleware de autenticación básica para admin
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// Endpoint: Chat con Claude
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Obtener conocimiento actualizado
    const knowledge = await getBotKnowledge();
    const systemPrompt = baseSystemPrompt + knowledge;

    // Construir historial de mensajes
    const messages = [
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Llamar a Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    });

    const assistantMessage = response.content[0].text;

    // Guardar conversación en MongoDB
    await db.collection('conversations').insertOne({
      userMessage: message,
      assistantMessage: assistantMessage,
      timestamp: new Date()
    });

    res.json({ 
      message: assistantMessage,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

// Endpoint: Chat con imagen (análisis de recibos)
app.post('/api/chat/image', upload.single('image'), async (req, res) => {
  try {
    const { message = 'Analiza esta imagen' } = req.body;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: 'Imagen requerida' });
    }

    // Convertir imagen a base64
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(imageFile.path);
    const imageBase64 = imageBuffer.toString('base64');
    const imageMediaType = imageFile.mimetype;

    // Obtener conocimiento actualizado
    const knowledge = await getBotKnowledge();
    const systemPrompt = baseSystemPrompt + knowledge + ' Puedes analizar imágenes de recibos de pago y documentos escolares.';

    // Llamar a Claude con imagen
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMediaType,
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: message
          }
        ]
      }]
    });

    const assistantMessage = response.content[0].text;

    // Limpiar archivo temporal
    fs.unlinkSync(imageFile.path);

    // Guardar en MongoDB
    await db.collection('image_analyses').insertOne({
      userMessage: message,
      assistantMessage: assistantMessage,
      timestamp: new Date()
    });

    res.json({ 
      message: assistantMessage,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error procesando imagen:', error);
    res.status(500).json({ error: 'Error procesando imagen' });
  }
});

// Endpoint: Agendar cita
app.post('/api/citas', async (req, res) => {
  try {
    const { nombre, email, telefono, motivo, fecha, tipo } = req.body;

    if (!nombre || !email || !motivo || !fecha || !tipo) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    const cita = {
      nombre,
      email,
      telefono: telefono || '',
      motivo,
      fecha: new Date(fecha),
      tipo, // 'directivo' o 'profesor'
      estado: 'pendiente',
      timestamp: new Date()
    };

    const result = await db.collection('citas').insertOne(cita);

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

// Endpoint: Obtener citas
app.get('/api/citas', async (req, res) => {
  try {
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

// ========== ENDPOINTS DE ADMIN ==========

// Login admin
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === adminPassword) {
    res.json({ success: true, token: adminPassword });
  } else {
    res.status(401).json({ error: 'Contraseña incorrecta' });
  }
});

// Obtener estadísticas
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const totalConversations = await db.collection('conversations').countDocuments();
    const totalCitas = await db.collection('citas').countDocuments();
    const citasPendientes = await db.collection('citas').countDocuments({ estado: 'pendiente' });
    
    res.json({
      conversations: totalConversations,
      citas: totalCitas,
      citasPendientes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// CRUD Horarios
app.get('/api/admin/horarios', adminAuth, async (req, res) => {
  try {
    const horarios = await db.collection('horarios').find({}).sort({ orden: 1 }).toArray();
    res.json(horarios);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo horarios' });
  }
});

app.post('/api/admin/horarios', adminAuth, async (req, res) => {
  try {
    const { titulo, descripcion, orden } = req.body;
    const result = await db.collection('horarios').insertOne({
      titulo,
      descripcion,
      orden: orden || 0,
      timestamp: new Date()
    });
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Error creando horario' });
  }
});

app.put('/api/admin/horarios/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, orden } = req.body;
    await db.collection('horarios').updateOne(
      { _id: new ObjectId(id) },
      { $set: { titulo, descripcion, orden, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando horario' });
  }
});

app.delete('/api/admin/horarios/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('horarios').deleteOne({ _id: new (await import('mongodb')).ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando horario' });
  }
});

// CRUD Eventos
app.get('/api/admin/eventos', adminAuth, async (req, res) => {
  try {
    const eventos = await db.collection('eventos').find({}).sort({ fecha: 1 }).toArray();
    res.json(eventos);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo eventos' });
  }
});

app.post('/api/admin/eventos', adminAuth, async (req, res) => {
  try {
    const { titulo, descripcion, fecha } = req.body;
    const result = await db.collection('eventos').insertOne({
      titulo,
      descripcion,
      fecha: new Date(fecha),
      timestamp: new Date()
    });
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Error creando evento' });
  }
});

app.put('/api/admin/eventos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, fecha } = req.body;
    await db.collection('eventos').updateOne(
      { _id: new ObjectId(id) },
      { $set: { titulo, descripcion, fecha: new Date(fecha), updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando evento' });
  }
});

app.delete('/api/admin/eventos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('eventos').deleteOne({ _id: new (await import('mongodb')).ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando evento' });
  }
});

// CRUD Planes de Pago
app.get('/api/admin/planes', adminAuth, async (req, res) => {
  try {
    const planes = await db.collection('planes').find({}).sort({ nombre: 1 }).toArray();
    res.json(planes);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo planes' });
  }
});

app.post('/api/admin/planes', adminAuth, async (req, res) => {
  try {
    const { nombre, descripcion, costo } = req.body;
    const result = await db.collection('planes').insertOne({
      nombre,
      descripcion,
      costo,
      timestamp: new Date()
    });
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Error creando plan' });
  }
});

app.put('/api/admin/planes/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, costo } = req.body;
    await db.collection('planes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { nombre, descripcion, costo, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando plan' });
  }
});

app.delete('/api/admin/planes/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection('planes').deleteOne({ _id: new (await import('mongodb')).ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando plan' });
  }
});

// Información General
app.get('/api/admin/informacion', adminAuth, async (req, res) => {
  try {
    const info = await db.collection('informacion').findOne({ tipo: 'general' });
    res.json(info || { contenido: '' });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo información' });
  }
});

app.post('/api/admin/informacion', adminAuth, async (req, res) => {
  try {
    const { contenido } = req.body;
    await db.collection('informacion').updateOne(
      { tipo: 'general' },
      { $set: { contenido, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error guardando información' });
  }
});

// Gestión de Citas
app.get('/api/admin/citas', adminAuth, async (req, res) => {
  try {
    const citas = await db.collection('citas').find({}).sort({ fecha: 1 }).toArray();
    res.json(citas);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo citas' });
  }
});

app.put('/api/admin/citas/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    await db.collection('citas').updateOne(
      { _id: new ObjectId(id) },
      { $set: { estado, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando cita' });
  }
});

// Conversaciones recientes
app.get('/api/admin/conversaciones', adminAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const conversaciones = await db.collection('conversations')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    res.json(conversaciones);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo conversaciones' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Iniciar servidor
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();


