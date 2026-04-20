import { getDB } from './db.js';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';

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
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return 'guest';
  const token = authHeader.slice(7).trim();
  const secret = process.env.JWT_SECRET || '';
  if (!secret || !token) return 'guest';
  try {
    const payload = jwt.verify(token, secret);
    return payload.role || 'guest';
  } catch {
    return 'guest';
  }
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
