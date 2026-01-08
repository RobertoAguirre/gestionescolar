import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import { generateResponse } from '../utils/ai-provider.js';

const router = express.Router();

// Configuración de Wasabi (compatible con S3)
const s3Client = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.wasabisys.com',
  region: process.env.WASABI_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY || '',
    secretAccessKey: process.env.WASABI_SECRET_KEY || ''
  }
});

const BUCKET_NAME = process.env.WASABI_BUCKET || 'gestionescolar-recursos';

// Asegurar que el directorio de uploads temporal existe
const tempDir = 'uploads/temp/';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configuración de multer para subida temporal
const upload = multer({
  dest: tempDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET - Listar recursos
router.get('/api/admin/recursos', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const { materia, tipo, maestroId, learningDifferences, busqueda } = req.query;
    
    let query = {};
    
    if (materia) {
      query.materia = materia;
    }
    if (tipo) {
      query.tipo = tipo; // 'documento', 'enlace', 'video', 'imagen', 'audio'
    }
    if (maestroId && ObjectId.isValid(maestroId)) {
      query.maestroId = new ObjectId(maestroId);
    }
    if (learningDifferences === 'true') {
      query.learningDifferences = true;
    }
    if (busqueda) {
      query.$or = [
        { titulo: { $regex: busqueda, $options: 'i' } },
        { descripcion: { $regex: busqueda, $options: 'i' } },
        { materia: { $regex: busqueda, $options: 'i' } }
      ];
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const recursos = await db.collection('recursos')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
    
    res.json(recursos);
  } catch (error) {
    console.error('Error obteniendo recursos:', error);
    res.status(500).json({ error: 'Error obteniendo recursos' });
  }
});

// GET - Obtener un recurso específico
router.get('/api/admin/recursos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const recurso = await db.collection('recursos').findOne(query);
    
    if (!recurso) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    
    res.json(recurso);
  } catch (error) {
    console.error('Error obteniendo recurso:', error);
    res.status(500).json({ error: 'Error obteniendo recurso' });
  }
});

// GET - Obtener URL de descarga/visualización del recurso
router.get('/api/admin/recursos/:id/url', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { expiresIn = 3600 } = req.query; // 1 hora por defecto
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const recurso = await db.collection('recursos').findOne(query);
    
    if (!recurso) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    
    if (recurso.tipo === 'enlace') {
      return res.json({ url: recurso.url, tipo: 'enlace' });
    }
    
    if (!recurso.archivoKey) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    
    // Generar URL firmada para Wasabi
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: recurso.archivoKey
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: parseInt(expiresIn) });
    
    res.json({ url, tipo: recurso.tipo, expiresIn: parseInt(expiresIn) });
  } catch (error) {
    console.error('Error generando URL:', error);
    res.status(500).json({ error: 'Error generando URL' });
  }
});

// POST - Crear recurso (con archivo opcional)
router.post('/api/admin/recursos', adminAuth, upload.single('archivo'), async (req, res) => {
  try {
    const { titulo, descripcion, tipo, materia, url, maestroId, learningDifferences, tags } = req.body;
    
    if (!titulo || !tipo) {
      return res.status(400).json({ error: 'Título y tipo requeridos' });
    }
    
    if (!['documento', 'enlace', 'video', 'imagen', 'audio'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    let archivoKey = null;
    let archivoNombre = null;
    let archivoTamaño = null;
    
    // Si hay archivo, subirlo a Wasabi
    if (req.file && tipo !== 'enlace') {
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
      archivoKey = `recursos/${escuelaId || 'global'}/${fileName}`;
      archivoNombre = req.file.originalname;
      archivoTamaño = req.file.size;
      
      const fileContent = fs.readFileSync(req.file.path);
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: archivoKey,
        Body: fileContent,
        ContentType: req.file.mimetype,
        Metadata: {
          originalName: archivoNombre,
          uploadedBy: req.escuelaId?.toString() || 'admin'
        }
      });
      
      await s3Client.send(command);
      
      // Eliminar archivo temporal
      fs.unlinkSync(req.file.path);
    }
    
    const recursoData = {
      titulo,
      descripcion: descripcion || '',
      tipo,
      materia: materia || '',
      url: tipo === 'enlace' ? url : null,
      maestroId: maestroId && ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
      learningDifferences: learningDifferences === 'true' || learningDifferences === true,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      archivoKey,
      archivoNombre,
      archivoTamaño,
      descargas: 0,
      visualizaciones: 0,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      recursoData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('recursos').insertOne(recursoData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando recurso:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error creando recurso' });
  }
});

// PUT - Actualizar recurso
router.put('/api/admin/recursos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, tipo, materia, url, learningDifferences, tags } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const updateData = { updatedAt: new Date() };
    
    if (titulo) updateData.titulo = titulo;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (tipo) updateData.tipo = tipo;
    if (materia !== undefined) updateData.materia = materia;
    if (url !== undefined) updateData.url = url;
    if (learningDifferences !== undefined) updateData.learningDifferences = learningDifferences === 'true' || learningDifferences === true;
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    }
    
    await db.collection('recursos').updateOne(
      query,
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando recurso:', error);
    res.status(500).json({ error: 'Error actualizando recurso' });
  }
});

// DELETE - Eliminar recurso
router.delete('/api/admin/recursos/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const recurso = await db.collection('recursos').findOne(query);
    
    if (recurso && recurso.archivoKey) {
      // Eliminar archivo de Wasabi
      try {
        const command = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: recurso.archivoKey
        });
        await s3Client.send(command);
      } catch (error) {
        console.error('Error eliminando archivo de Wasabi:', error);
      }
    }
    
    await db.collection('recursos').deleteOne(query);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando recurso:', error);
    res.status(500).json({ error: 'Error eliminando recurso' });
  }
});

// POST - Compartir recurso (por maestro)
router.post('/api/maestros/recursos', upload.single('archivo'), async (req, res) => {
  try {
    const { maestroId, titulo, descripcion, tipo, materia, url, learningDifferences, tags } = req.body;
    
    if (!maestroId || !titulo || !tipo) {
      return res.status(400).json({ error: 'Maestro, título y tipo requeridos' });
    }
    
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    
    let archivoKey = null;
    let archivoNombre = null;
    let archivoTamaño = null;
    
    if (req.file && tipo !== 'enlace') {
      const fileExtension = req.file.originalname.split('.').pop();
      const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
      archivoKey = `recursos/${escuelaId || 'global'}/${fileName}`;
      archivoNombre = req.file.originalname;
      archivoTamaño = req.file.size;
      
      const fileContent = fs.readFileSync(req.file.path);
      
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: archivoKey,
        Body: fileContent,
        ContentType: req.file.mimetype
      });
      
      await s3Client.send(command);
      fs.unlinkSync(req.file.path);
    }
    
    const recursoData = {
      titulo,
      descripcion: descripcion || '',
      tipo,
      materia: materia || '',
      url: tipo === 'enlace' ? url : null,
      maestroId: ObjectId.isValid(maestroId) ? new ObjectId(maestroId) : null,
      learningDifferences: learningDifferences === 'true' || learningDifferences === true,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      archivoKey,
      archivoNombre,
      archivoTamaño,
      descargas: 0,
      visualizaciones: 0,
      timestamp: new Date()
    };
    
    if (escuelaId) {
      recursoData.escuelaId = escuelaId;
    }
    
    const result = await db.collection('recursos').insertOne(recursoData);
    
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error compartiendo recurso:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error compartiendo recurso' });
  }
});

// POST - Registrar visualización/descarga
router.post('/api/recursos/:id/registrar-uso', async (req, res) => {
  try {
    const { id } = req.params;
    const { accion } = req.body; // 'visualizacion' o 'descarga'
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    let query = { _id: new ObjectId(id) };
    query = addEscuelaFilter(query, escuelaId);
    
    const updateData = {};
    if (accion === 'descarga') {
      updateData.$inc = { descargas: 1 };
    } else {
      updateData.$inc = { visualizaciones: 1 };
    }
    
    await db.collection('recursos').updateOne(query, updateData);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error registrando uso:', error);
    res.status(500).json({ error: 'Error registrando uso' });
  }
});

// GET - Recursos por materia
router.get('/api/recursos/materia/:materia', async (req, res) => {
  try {
    const { materia } = req.params;
    const { learningDifferences } = req.query;
    const escuelaId = getEscuelaId(req);
    
    const db = getDB();
    let query = { materia: materia };
    
    if (learningDifferences === 'true') {
      query.learningDifferences = true;
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const recursos = await db.collection('recursos')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
    
    res.json(recursos);
  } catch (error) {
    console.error('Error obteniendo recursos por materia:', error);
    res.status(500).json({ error: 'Error obteniendo recursos por materia' });
  }
});

// GET - Recomendaciones de recursos con IA
router.get('/api/recursos/recomendaciones', adminAuth, async (req, res) => {
  try {
    const { alumnoId, materia, necesidad } = req.query;
    const escuelaId = req.escuelaId || getEscuelaId(req);
    
    const db = getDB();
    
    // Obtener información del alumno si se proporciona
    let alumnoInfo = null;
    if (alumnoId && ObjectId.isValid(alumnoId)) {
      const alumno = await db.collection('alumnos').findOne(
        addEscuelaFilter({ _id: new ObjectId(alumnoId) }, escuelaId)
      );
      if (alumno) {
        alumnoInfo = {
          nombre: alumno.nombre,
          perfilAccesibilidad: alumno.perfilAccesibilidad,
          necesidadesEspeciales: alumno.perfilAccesibilidad?.necesidadesEspeciales || []
        };
      }
    }
    
    // Obtener recursos disponibles
    let queryRecursos = {};
    if (materia) {
      queryRecursos.materia = materia;
    }
    queryRecursos = addEscuelaFilter(queryRecursos, escuelaId);
    
    const recursos = await db.collection('recursos').find(queryRecursos).toArray();
    
    // Generar recomendaciones con IA
    const prompt = `Eres un asistente educativo. Analiza los siguientes recursos disponibles y genera recomendaciones personalizadas.

${alumnoInfo ? `Información del alumno:
- Nombre: ${alumnoInfo.nombre}
- Necesidades especiales: ${alumnoInfo.necesidadesEspeciales.join(', ') || 'Ninguna'}
- Perfil de accesibilidad: ${JSON.stringify(alumnoInfo.perfilAccesibilidad)}
` : ''}

${necesidad ? `Necesidad específica: ${necesidad}` : ''}

Recursos disponibles:
${recursos.map(r => `- ${r.titulo} (${r.tipo}, ${r.materia}): ${r.descripcion || 'Sin descripción'}`).join('\n')}

Genera recomendaciones específicas de recursos que sean más útiles. Responde en formato JSON con un array de objetos, cada uno con:
- recursoId: ID del recurso recomendado
- razon: Por qué es recomendado
- prioridad: "alta", "media" o "baja"`;

    const response = await generateResponse(
      [{ role: 'user', content: prompt }],
      'Eres un asistente educativo experto en recomendar recursos de aprendizaje.',
      {}
    );
    
    let recomendaciones = [];
    try {
      const content = response.content[0].text;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recomendaciones = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parseando recomendaciones de IA:', error);
      // Fallback: recomendar recursos más populares
      recomendaciones = recursos
        .sort((a, b) => (b.visualizaciones || 0) + (b.descargas || 0) - (a.visualizaciones || 0) - (a.descargas || 0))
        .slice(0, 5)
        .map(r => ({
          recursoId: r._id.toString(),
          razon: 'Recurso popular y bien valorado',
          prioridad: 'media'
        }));
    }
    
    // Enriquecer con datos del recurso
    const recomendacionesEnriquecidas = recomendaciones.map(rec => {
      const recurso = recursos.find(r => String(r._id) === String(rec.recursoId));
      return {
        ...rec,
        recurso: recurso || null
      };
    }).filter(rec => rec.recurso !== null);
    
    res.json({
      recomendaciones: recomendacionesEnriquecidas,
      totalRecursos: recursos.length
    });
  } catch (error) {
    console.error('Error generando recomendaciones:', error);
    res.status(500).json({ error: 'Error generando recomendaciones' });
  }
});

// GET - Recursos para Learning Differences
router.get('/api/recursos/learning-differences', async (req, res) => {
  try {
    const { materia, tipo } = req.query;
    const escuelaId = getEscuelaId(req);
    
    const db = getDB();
    let query = { learningDifferences: true };
    
    if (materia) {
      query.materia = materia;
    }
    if (tipo) {
      query.tipo = tipo;
    }
    
    query = addEscuelaFilter(query, escuelaId);
    
    const recursos = await db.collection('recursos')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
    
    res.json(recursos);
  } catch (error) {
    console.error('Error obteniendo recursos para Learning Differences:', error);
    res.status(500).json({ error: 'Error obteniendo recursos' });
  }
});

export default router;
