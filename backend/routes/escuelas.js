import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Middleware para verificar si es super admin
async function isSuperAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';
    
    if (authHeader && authHeader === `Bearer ${superAdminPassword}`) {
      req.isSuperAdmin = true;
      return next();
    } else {
      req.isSuperAdmin = false;
      // Si no es super admin, verificar si es admin normal
      return adminAuth(req, res, next);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error en autenticación' });
  }
}

// GET - Listar todas las escuelas (solo super admin)
router.get('/api/super-admin/escuelas', isSuperAdmin, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Solo super administradores pueden acceder' });
    }
    
    const db = getDB();
    const escuelas = await db.collection('escuelas')
      .find({})
      .sort({ nombre: 1 })
      .toArray();
    
    res.json(escuelas);
  } catch (error) {
    console.error('Error obteniendo escuelas:', error);
    res.status(500).json({ error: 'Error obteniendo escuelas' });
  }
});

// POST - Crear nueva escuela (solo super admin)
router.post('/api/super-admin/escuelas', isSuperAdmin, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Solo super administradores pueden crear escuelas' });
    }
    
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
    
    const escuela = {
      nombre,
      codigo,
      direccion: direccion || '',
      telefono: telefono || '',
      email: email || '',
      activa: true,
      configuracion: {
        adminPassword: adminPassword || crypto.randomBytes(16).toString('hex'),
        aiProvider: 'claude',
        timezone: 'America/Mexico_City'
      },
      timestamp: new Date()
    };
    
    const result = await db.collection('escuelas').insertOne(escuela);
    
    // Si se proporciona adminEmail, crear usuario admin para esta escuela
    if (adminEmail && adminPassword) {
      await db.collection('usuarios').insertOne({
        escuelaId: result.insertedId,
        email: adminEmail,
        password: adminPassword, // En producción, debería ser hash
        rol: 'admin_escuela',
        activo: true,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, id: result.insertedId, escuela });
  } catch (error) {
    console.error('Error creando escuela:', error);
    res.status(500).json({ error: 'Error creando escuela' });
  }
});

// PUT - Actualizar escuela (solo super admin)
router.put('/api/super-admin/escuelas/:id', isSuperAdmin, async (req, res) => {
  try {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Solo super administradores pueden actualizar escuelas' });
    }
    
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
