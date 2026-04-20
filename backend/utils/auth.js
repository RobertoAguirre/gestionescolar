import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDB } from './db.js';
import { getEscuelaId } from './multi-escuela.js';

dotenv.config();

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

export function getJwtSecret() {
  return process.env.JWT_SECRET || '';
}

async function comparePassword(plainPassword, plainEnvPassword, hashEnvPassword) {
  const trimmedPlain =
    typeof plainPassword === 'string' ? plainPassword.trim() : plainPassword;
  const trimmedEnv =
    typeof plainEnvPassword === 'string' ? plainEnvPassword.trim() : plainEnvPassword;

  if (hashEnvPassword && String(hashEnvPassword).trim()) {
    try {
      return await bcrypt.compare(trimmedPlain, String(hashEnvPassword).trim());
    } catch {
      return false;
    }
  }
  if (!trimmedEnv) return false;
  return trimmedPlain === trimmedEnv;
}

export async function verifyAdminCredentials(password, escuelaId = null) {
  const p = typeof password === 'string' ? password.trim() : password;
  if (!p) return null;

  const isSuperAdmin = await comparePassword(
    p,
    process.env.SUPER_ADMIN_PASSWORD || '',
    process.env.SUPER_ADMIN_PASSWORD_HASH || ''
  );
  if (isSuperAdmin) {
    return { role: 'super_admin', escuelaId: null };
  }

  const isGlobalAdmin = await comparePassword(
    p,
    process.env.ADMIN_PASSWORD || '',
    process.env.ADMIN_PASSWORD_HASH || ''
  );
  if (isGlobalAdmin) {
    return { role: 'admin_escuela', escuelaId: escuelaId || null };
  }

  if (!escuelaId) return null;

  const db = getDB();
  const escuela = await db.collection('escuelas').findOne({
    _id: escuelaId,
    activa: true
  });

  if (!escuela) return null;

  const escuelaPassword = escuela.configuracion?.adminPassword || '';
  if (!escuelaPassword) return null;

  const validEscuelaAdmin = escuelaPassword.startsWith('$2')
    ? await bcrypt.compare(p, escuelaPassword)
    : escuelaPassword === p;

  if (!validEscuelaAdmin) return null;

  return { role: 'admin_escuela', escuelaId };
}

export function createAdminToken({ role, escuelaId = null }) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET no configurado');
  }

  return jwt.sign(
    {
      role,
      escuelaId: escuelaId ? String(escuelaId) : null
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function validateEscuelaIfNeeded(req, escuelaId) {
  if (!escuelaId) return null;
  const db = getDB();
  const escuela = await db.collection('escuelas').findOne({
    _id: escuelaId,
    activa: true
  });
  if (!escuela) return false;
  req.escuelaId = escuelaId;
  return true;
}

export const adminAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Token requerido' });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return res.status(500).json({ error: 'JWT_SECRET no configurado' });
    }

    try {
      const payload = jwt.verify(token, secret);
      req.isSuperAdmin = payload.role === 'super_admin';
      req.rol = payload.role || 'admin_escuela';

      if (payload.escuelaId && ObjectId.isValid(payload.escuelaId)) {
        const escuelaId = new ObjectId(payload.escuelaId);
        const isValidEscuela = await validateEscuelaIfNeeded(req, escuelaId);
        if (!isValidEscuela) {
          return res.status(404).json({ error: 'Escuela no encontrada o inactiva' });
        }
      } else {
        const escuelaFromRequest = getEscuelaId(req);
        if (escuelaFromRequest) {
          const isValidEscuela = await validateEscuelaIfNeeded(req, escuelaFromRequest);
          if (!isValidEscuela) {
            return res.status(404).json({ error: 'Escuela no encontrada o inactiva' });
          }
        }
      }

      return next();
    } catch (_jwtError) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ error: 'Error en autenticación' });
  }
};

/** Solo JWT con rol super_admin (rutas /api/super-admin/*) */
export function requireSuperAdmin(req, res, next) {
  adminAuth(req, res, () => {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: 'Solo super administradores pueden acceder' });
    }
    return next();
  });
}
