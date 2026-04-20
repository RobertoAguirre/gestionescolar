import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth, requireSuperAdmin } from '../utils/auth.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = express.Router();

// GET - Listar todas las escuelas (solo super admin)
router.get('/api/super-admin/escuelas', requireSuperAdmin, async (req, res) => {
  try {
    const db = getDB();
    const escuelas = await db.collection('escuelas')
      .find({})
      .sort({ nombre: 1 })
      .toArray();

    const safe = escuelas.map((e) => {
      const copy = { ...e };
      if (copy.configuracion?.adminPassword) delete copy.configuracion.adminPassword;
      return copy;
    });

    res.json(safe);
  } catch (error) {
    console.error('Error obteniendo escuelas:', error);
    res.status(500).json({ error: 'Error obteniendo escuelas' });
  }
});

// POST - Crear nueva escuela (solo super admin)
router.post('/api/super-admin/escuelas', requireSuperAdmin, async (req, res) => {
  try {
    const { nombre, codigo, direccion, telefono, email, adminEmail, adminPassword } = req.body;
    
    if (!nombre || !codigo) {
      return res.status(400).json({ error: 'Nombre y código requeridos' });
    }
    
    const db = getDB();
    
    // Verificar que el código no exista
    const existe = await db.collection('escuelas').findOne({ codigo });
    if (existe) {
      return res.status(400).json({ error: 'El código de escuela ya existe' });
    }
    
    const plainAdminEscuela = adminPassword || crypto.randomBytes(16).toString('hex');
    const adminPasswordHash = await bcrypt.hash(plainAdminEscuela, 10);

    const escuela = {
      nombre,
      codigo,
      direccion: direccion || '',
      telefono: telefono || '',
      email: email || '',
      activa: true,
      configuracion: {
        adminPassword: adminPasswordHash,
        aiProvider: 'claude',
        timezone: 'America/Mexico_City'
      },
      timestamp: new Date()
    };
    
    const result = await db.collection('escuelas').insertOne(escuela);
    
    // Si se proporciona adminEmail, crear usuario admin para esta escuela
    if (adminEmail && adminPassword) {
      const usuarioHash = await bcrypt.hash(adminPassword, 10);
      await db.collection('usuarios').insertOne({
        escuelaId: result.insertedId,
        email: adminEmail,
        passwordHash: usuarioHash,
        rol: 'admin_escuela',
        activo: true,
        timestamp: new Date()
      });
    }
    
    const escuelaResp = await db.collection('escuelas').findOne({ _id: result.insertedId });
    if (escuelaResp?.configuracion) {
      delete escuelaResp.configuracion.adminPassword;
    }
    res.json({
      success: true,
      id: result.insertedId,
      escuela: escuelaResp,
      initialAdminPassword: plainAdminEscuela
    });
  } catch (error) {
    console.error('Error creando escuela:', error);
    res.status(500).json({ error: 'Error creando escuela' });
  }
});

// PUT - Actualizar escuela (solo super admin)
router.put('/api/super-admin/escuelas/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, codigo, direccion, telefono, email, activa } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    
    const db = getDB();
    const updateData = { updatedAt: new Date() };
    
    if (nombre) updateData.nombre = nombre;
    if (codigo) {
      // Verificar que el código no exista en otra escuela
      const existe = await db.collection('escuelas').findOne({ 
        codigo, 
        _id: { $ne: new ObjectId(id) } 
      });
      if (existe) {
        return res.status(400).json({ error: 'El código de escuela ya existe' });
      }
      updateData.codigo = codigo;
    }
    if (direccion !== undefined) updateData.direccion = direccion;
    if (telefono !== undefined) updateData.telefono = telefono;
    if (email !== undefined) updateData.email = email;
    if (activa !== undefined) updateData.activa = activa;
    
    await db.collection('escuelas').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando escuela:', error);
    res.status(500).json({ error: 'Error actualizando escuela' });
  }
});

// GET - Obtener información de la escuela actual (admin de escuela)
router.get('/api/admin/escuela', adminAuth, async (req, res) => {
  try {
    const escuelaId = req.headers['x-escuela-id'];
    
    if (!escuelaId || !ObjectId.isValid(escuelaId)) {
      return res.status(400).json({ error: 'ID de escuela requerido' });
    }
    
    const db = getDB();
    const escuela = await db.collection('escuelas').findOne({ 
      _id: new ObjectId(escuelaId),
      activa: true 
    });
    
    if (!escuela) {
      return res.status(404).json({ error: 'Escuela no encontrada' });
    }
    
    // No devolver la contraseña
    delete escuela.configuracion?.adminPassword;
    
    res.json(escuela);
  } catch (error) {
    console.error('Error obteniendo escuela:', error);
    res.status(500).json({ error: 'Error obteniendo escuela' });
  }
});

export default router;
