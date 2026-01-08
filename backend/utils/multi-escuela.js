import { getDB } from './db.js';
import { ObjectId } from 'mongodb';

// Función para obtener el escuelaId del request
export function getEscuelaId(req) {
  // Prioridad: header X-Escuela-Id > query param > default
  const headerId = req.headers['x-escuela-id'];
  const queryId = req.query.escuelaId;
  
  if (headerId && ObjectId.isValid(headerId)) {
    return new ObjectId(headerId);
  }
  
  if (queryId && ObjectId.isValid(queryId)) {
    return new ObjectId(queryId);
  }
  
  // Si no hay escuelaId, retornar null (compatibilidad con sistema existente)
  return null;
}

// Middleware para agregar filtro de escuela a las queries
export function addEscuelaFilter(query, escuelaId) {
  if (escuelaId) {
    query.escuelaId = escuelaId;
  }
  // Si no hay escuelaId, no agregar filtro (compatibilidad hacia atrás)
  return query;
}

// Función para verificar que un recurso pertenece a una escuela
export async function verifyEscuelaResource(collection, resourceId, escuelaId) {
  if (!escuelaId) {
    // Si no hay escuelaId, permitir acceso (compatibilidad)
    return true;
  }
  
  const db = getDB();
  const resource = await db.collection(collection).findOne({ 
    _id: new ObjectId(resourceId) 
  });
  
  if (!resource) {
    return false;
  }
  
  // Si el recurso no tiene escuelaId, permitir acceso (compatibilidad)
  if (!resource.escuelaId) {
    return true;
  }
  
  return String(resource.escuelaId) === String(escuelaId);
}

// Función para obtener el rol del usuario desde el token
export function getUserRole(req) {
  // Por ahora, simplificado. En producción debería venir del token JWT
  const authHeader = req.headers.authorization;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (authHeader === `Bearer ${superAdminPassword}`) {
    return 'super_admin';
  }
  
  if (authHeader === `Bearer ${adminPassword}`) {
    return 'admin_escuela';
  }
  
  // Verificar si es padre (token de sesión)
  // Esto se maneja en el middleware de padres
  
  return 'guest';
}

// Función para verificar permisos
export function hasPermission(role, action, resource) {
  const permissions = {
    super_admin: ['*'], // Todos los permisos
    admin_escuela: [
      'read:*',
      'write:*',
      'delete:*',
      'manage:escuela',
      'manage:maestros',
      'manage:alumnos',
      'manage:grupos',
      'manage:calificaciones',
      'manage:asistencia'
    ],
    maestro: [
      'read:alumnos',
      'read:grupos',
      'write:calificaciones',
      'write:asistencia',
      'read:calificaciones',
      'read:asistencia'
    ],
    padre: [
      'read:alumno_propio',
      'read:calificaciones_propias',
      'read:asistencia_propia',
      'write:citas'
    ]
  };
  
  if (role === 'super_admin') {
    return true;
  }
  
  const rolePermissions = permissions[role] || [];
  
  // Verificar permiso específico o wildcard
  return rolePermissions.includes('*') || 
         rolePermissions.includes(`${action}:*`) ||
         rolePermissions.includes(`${action}:${resource}`);
}
