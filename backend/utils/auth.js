import dotenv from 'dotenv';
import { getDB } from './db.js';
import { ObjectId } from 'mongodb';
import { getEscuelaId } from './multi-escuela.js';

dotenv.config();

export const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';
    
    // Verificar super admin
    if (authHeader === `Bearer ${superAdminPassword}`) {
      req.isSuperAdmin = true;
      req.rol = 'super_admin';
      return next();
    }
    
    // Verificar admin de escuela
    if (authHeader === `Bearer ${adminPassword}`) {
      req.isSuperAdmin = false;
      req.rol = 'admin_escuela';
      
      // Si hay escuelaId en el header, verificar que existe y está activa
      const escuelaId = getEscuelaId(req);
      if (escuelaId) {
        const db = getDB();
        const escuela = await db.collection('escuelas').findOne({ 
          _id: escuelaId,
          activa: true 
        });
        
        if (!escuela) {
          return res.status(404).json({ error: 'Escuela no encontrada o inactiva' });
        }
        
        req.escuelaId = escuelaId;
      }
      
      return next();
    }
    
    // Verificar admin de escuela específica (por código)
    const escuelaId = getEscuelaId(req);
    if (escuelaId) {
      const db = getDB();
      const escuela = await db.collection('escuelas').findOne({ 
        _id: escuelaId,
        activa: true 
      });
      
      if (escuela && authHeader === `Bearer ${escuela.configuracion?.adminPassword || adminPassword}`) {
        req.isSuperAdmin = false;
        req.rol = 'admin_escuela';
        req.escuelaId = escuelaId;
        return next();
      }
    }
    
    return res.status(401).json({ error: 'No autorizado' });
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ error: 'Error en autenticación' });
  }
};
