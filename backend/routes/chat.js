import express from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { getBotKnowledge } from '../utils/knowledge.js';
import { generateResponse } from '../utils/ai-provider.js';
import { getEscuelaId } from '../utils/multi-escuela.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const router = express.Router();

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

const baseSystemPrompt = `Eres un asistente virtual amigable para una escuela. Ayudas a padres de familia con:
- Horarios de clases y actividades
- Eventos escolares
- Desempeño académico de sus hijos
- Planes de pago y cobros
- Agendamiento de citas con directivos o profesores
- Información sobre maestros, alumnos, grupos y espacios escolares

Sé amable, claro y conciso. Usa la información proporcionada para responder preguntas específicas. Si necesitas información que no está disponible, sugiere agendar una cita.`;

// POST - Chat con IA (Claude o Gemini)
router.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, history = [], alumnoId, perfilAccesibilidad } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const escuelaId = getEscuelaId(req);
    const knowledge = await getBotKnowledge(escuelaId);
    const systemPrompt = baseSystemPrompt + knowledge;

    // Obtener perfil de accesibilidad del alumno si se proporciona
    let perfil = null;
    if (alumnoId) {
      const db = getDB();
      const alumno = await db.collection('alumnos').findOne({ 
        _id: new ObjectId(alumnoId) 
      });
      if (alumno && alumno.perfilAccesibilidad) {
        perfil = alumno.perfilAccesibilidad;
      }
    }
    
    // Usar perfil proporcionado o del alumno
    const perfilFinal = perfilAccesibilidad || perfil || {};

    // Adaptar prompt según perfil de accesibilidad
    if (perfilFinal.modoAccesible || perfilFinal.textoSimplificado) {
      systemPrompt += '\n\nIMPORTANTE: Responde con lenguaje simple y claro. Usa frases cortas. Evita términos técnicos complejos.';
    }
    if (perfilFinal.respuestasCortas) {
      systemPrompt += '\n\nIMPORTANTE: Responde de forma muy breve y concisa. Máximo 2-3 oraciones.';
    }
    if (perfilFinal.lecturaPantalla) {
      systemPrompt += '\n\nIMPORTANTE: Responde de forma accesible para lectores de pantalla. Usa estructura clara, evita emojis complejos, y organiza la información de forma lógica.';
    }

    const messages = [
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // Determinar estilo de respuesta
    let responseStyle = 'normal';
    if (perfilFinal.modoAccesible) responseStyle = 'accessible';
    else if (perfilFinal.textoSimplificado) responseStyle = 'simplified';
    else if (perfilFinal.respuestasCortas) responseStyle = 'short';

    const assistantMessage = await generateResponse(messages, systemPrompt, {
      maxTokens: perfilFinal.respuestasCortas ? 512 : 1024,
      responseStyle: responseStyle
    });

    const responseTime = Date.now() - startTime;
    
    // Detectar si se sugiere agendar cita
    const sugiereCita = assistantMessage.toLowerCase().includes('cita') || 
                        assistantMessage.toLowerCase().includes('agendar');

          const db = getDB();
          const escuelaId = getEscuelaId(req);
          
          const conversationData = {
            userMessage: message,
            assistantMessage: assistantMessage,
            timestamp: new Date(),
            responseTime: responseTime,
            sugiereCita: sugiereCita,
            resueltoSinCita: !sugiereCita,
            alumnoId: alumnoId || null,
            perfilAccesibilidad: perfilFinal
          };
          
          if (escuelaId) {
            conversationData.escuelaId = escuelaId;
          }
          
          await db.collection('conversations').insertOne(conversationData);

    res.json({ 
      message: assistantMessage,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error en chat:', error);
    res.status(500).json({ error: 'Error procesando mensaje' });
  }
});

// POST - Chat con imagen
router.post('/api/chat/image', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { message = 'Analiza esta imagen', alumnoId, perfilAccesibilidad } = req.body;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: 'Imagen requerida' });
    }

    // Obtener perfil de accesibilidad si se proporciona
    let perfil = null;
    if (alumnoId) {
      const db = getDB();
      const alumno = await db.collection('alumnos').findOne({ 
        _id: new ObjectId(alumnoId) 
      });
      if (alumno && alumno.perfilAccesibilidad) {
        perfil = alumno.perfilAccesibilidad;
      }
    }
    const perfilFinal = perfilAccesibilidad || perfil || {};

    const imageBuffer = fs.readFileSync(imageFile.path);
    const imageBase64 = imageBuffer.toString('base64');
    const imageMediaType = imageFile.mimetype;

    const escuelaId = getEscuelaId(req);
    const knowledge = await getBotKnowledge(escuelaId);
    let systemPrompt = baseSystemPrompt + knowledge + ' Puedes analizar imágenes de recibos de pago y documentos escolares.';

    // Adaptar prompt según perfil
    if (perfilFinal.modoAccesible || perfilFinal.textoSimplificado) {
      systemPrompt += '\n\nIMPORTANTE: Responde con lenguaje simple y claro sobre la imagen.';
    }

    // Nota: Análisis de imágenes solo disponible con Claude por ahora
    // Para Gemini se necesitaría implementación adicional
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: perfilFinal.respuestasCortas ? 512 : 1024,
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
    const responseTime = Date.now() - startTime;

    fs.unlinkSync(imageFile.path);

    const sugiereCita = assistantMessage.toLowerCase().includes('cita') ||
                        assistantMessage.toLowerCase().includes('agendar');

    const db = getDB();
    const escuelaIdImg = getEscuelaId(req);
    
    const imageAnalysisData = {
      userMessage: message,
      assistantMessage: assistantMessage,
      timestamp: new Date(),
      responseTime: responseTime,
      sugiereCita: sugiereCita,
      resueltoSinCita: !sugiereCita,
      alumnoId: alumnoId || null,
      perfilAccesibilidad: perfilFinal
    };
    
    if (escuelaIdImg) {
      imageAnalysisData.escuelaId = escuelaIdImg;
    }
    
    await db.collection('image_analyses').insertOne(imageAnalysisData);

    res.json({ 
      message: assistantMessage,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error procesando imagen:', error);
    res.status(500).json({ error: 'Error procesando imagen' });
  }
});

export default router;
