import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { authPadre } from './padres.js';
import { addEscuelaFilter, getEscuelaId } from '../utils/multi-escuela.js';

const router = express.Router();

function toObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function alumnoIdCompatFilter(alumnoId) {
  return {
    $or: [
      { alumnoId },
      { alumnoId: String(alumnoId) }
    ]
  };
}

async function crearNotificacionCobro(db, data, escuelaId = null) {
  const payload = {
    tipo: 'recordatorio_pago',
    leida: false,
    timestamp: new Date(),
    ...data
  };
  if (escuelaId) payload.escuelaId = escuelaId;
  await db.collection('notificaciones').insertOne(payload);
}

// ----------------------------
// ADMIN - Conceptos de cobro
// ----------------------------
router.get('/api/admin/cobros/conceptos', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const conceptos = await db.collection('conceptos_cobro')
      .find(addEscuelaFilter({}, escuelaId))
      .sort({ nombre: 1 })
      .toArray();
    res.json(conceptos);
  } catch (error) {
    console.error('Error obteniendo conceptos de cobro:', error);
    res.status(500).json({ error: 'Error obteniendo conceptos de cobro' });
  }
});

router.post('/api/admin/cobros/conceptos', adminAuth, async (req, res) => {
  try {
    const { nombre, monto, frecuencia = 'mensual', activo = true, descripcion = '' } = req.body;
    if (!nombre || Number.isNaN(Number(monto))) {
      return res.status(400).json({ error: 'Nombre y monto válidos son requeridos' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const concepto = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      monto: Number(monto),
      frecuencia,
      activo: !!activo,
      timestamp: new Date()
    };
    if (escuelaId) concepto.escuelaId = escuelaId;

    const result = await db.collection('conceptos_cobro').insertOne(concepto);
    res.json({ success: true, id: result.insertedId });
  } catch (error) {
    console.error('Error creando concepto de cobro:', error);
    res.status(500).json({ error: 'Error creando concepto de cobro' });
  }
});

router.put('/api/admin/cobros/conceptos/:id', adminAuth, async (req, res) => {
  try {
    const conceptoId = toObjectId(req.params.id);
    if (!conceptoId) return res.status(400).json({ error: 'ID inválido' });

    const { nombre, monto, frecuencia, activo, descripcion } = req.body;
    const updateData = { updatedAt: new Date() };
    if (nombre !== undefined) updateData.nombre = String(nombre).trim();
    if (descripcion !== undefined) updateData.descripcion = String(descripcion).trim();
    if (monto !== undefined) {
      if (Number.isNaN(Number(monto))) return res.status(400).json({ error: 'Monto inválido' });
      updateData.monto = Number(monto);
    }
    if (frecuencia !== undefined) updateData.frecuencia = frecuencia;
    if (activo !== undefined) updateData.activo = !!activo;

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({ _id: conceptoId }, escuelaId);
    await db.collection('conceptos_cobro').updateOne(query, { $set: updateData });
    res.json({ success: true });
  } catch (error) {
    console.error('Error actualizando concepto:', error);
    res.status(500).json({ error: 'Error actualizando concepto' });
  }
});

router.delete('/api/admin/cobros/conceptos/:id', adminAuth, async (req, res) => {
  try {
    const conceptoId = toObjectId(req.params.id);
    if (!conceptoId) return res.status(400).json({ error: 'ID inválido' });

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({ _id: conceptoId }, escuelaId);
    await db.collection('conceptos_cobro').deleteOne(query);
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando concepto:', error);
    res.status(500).json({ error: 'Error eliminando concepto' });
  }
});

// ----------------------------
// ADMIN - Cargos y pagos
// ----------------------------
router.post('/api/admin/cobros/cargos/generar', adminAuth, async (req, res) => {
  try {
    const { conceptoId, alumnoId, grupoId, fechaLimite, observaciones = '' } = req.body;
    const conceptoObjectId = toObjectId(conceptoId);
    if (!conceptoObjectId) return res.status(400).json({ error: 'conceptoId inválido' });
    if (!alumnoId && !grupoId) {
      return res.status(400).json({ error: 'Debes enviar alumnoId o grupoId' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const concepto = await db.collection('conceptos_cobro').findOne(
      addEscuelaFilter({ _id: conceptoObjectId, activo: true }, escuelaId)
    );
    if (!concepto) return res.status(404).json({ error: 'Concepto no encontrado o inactivo' });

    let alumnosObjetivo = [];
    if (alumnoId) {
      const alumnoObjectId = toObjectId(alumnoId);
      if (!alumnoObjectId) return res.status(400).json({ error: 'alumnoId inválido' });
      const alumno = await db.collection('alumnos').findOne(
        addEscuelaFilter({ _id: alumnoObjectId, activo: true }, escuelaId)
      );
      if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado' });
      alumnosObjetivo = [alumno];
    } else {
      const grupoObjectId = toObjectId(grupoId);
      if (!grupoObjectId) return res.status(400).json({ error: 'grupoId inválido' });
      alumnosObjetivo = await db.collection('alumnos')
        .find(addEscuelaFilter({ grupoId: grupoObjectId, activo: true }, escuelaId))
        .toArray();
    }

    if (alumnosObjetivo.length === 0) {
      return res.status(400).json({ error: 'No hay alumnos para generar cargos' });
    }

    const fechaVencimiento = fechaLimite ? new Date(fechaLimite) : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const cargos = alumnosObjetivo.map((alumno) => {
      const cargo = {
        alumnoId: alumno._id,
        conceptoId: concepto._id,
        conceptoNombre: concepto.nombre,
        monto: concepto.monto,
        saldoPendiente: concepto.monto,
        estado: 'pendiente',
        fechaLimite: fechaVencimiento,
        observaciones,
        pagos: [],
        timestamp: now
      };
      if (escuelaId) cargo.escuelaId = escuelaId;
      return cargo;
    });

    await db.collection('cargos_cobro').insertMany(cargos);
    res.json({ success: true, generados: cargos.length });
  } catch (error) {
    console.error('Error generando cargos:', error);
    res.status(500).json({ error: 'Error generando cargos' });
  }
});

router.get('/api/admin/cobros/estado-cuenta', adminAuth, async (req, res) => {
  try {
    const { alumnoId, estado } = req.query;
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);

    let query = {};
    if (alumnoId) {
      const alumnoObjectId = toObjectId(alumnoId);
      if (!alumnoObjectId) return res.status(400).json({ error: 'alumnoId inválido' });
      query.alumnoId = alumnoObjectId;
    }
    if (estado) query.estado = estado;
    query = addEscuelaFilter(query, escuelaId);

    const cargos = await db.collection('cargos_cobro')
      .find(query)
      .sort({ fechaLimite: 1 })
      .toArray();

    const alumnoIds = [...new Set(cargos.map(c => String(c.alumnoId)))].map(id => new ObjectId(id));
    const alumnos = alumnoIds.length > 0
      ? await db.collection('alumnos').find({ _id: { $in: alumnoIds } }).toArray()
      : [];
    const mapAlumnos = new Map(alumnos.map(a => [String(a._id), a]));

    const enriched = cargos.map(c => ({
      ...c,
      alumno: mapAlumnos.get(String(c.alumnoId)) ? {
        _id: mapAlumnos.get(String(c.alumnoId))._id,
        nombre: mapAlumnos.get(String(c.alumnoId)).nombre,
        grupoId: mapAlumnos.get(String(c.alumnoId)).grupoId || null
      } : null
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error obteniendo estado de cuenta:', error);
    res.status(500).json({ error: 'Error obteniendo estado de cuenta' });
  }
});

router.post('/api/admin/cobros/pagos/registrar', adminAuth, async (req, res) => {
  try {
    const { cargoId, monto, metodo = 'efectivo', referencia = '', notas = '' } = req.body;
    const cargoObjectId = toObjectId(cargoId);
    if (!cargoObjectId || Number.isNaN(Number(monto)) || Number(monto) <= 0) {
      return res.status(400).json({ error: 'cargoId y monto válidos son requeridos' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const query = addEscuelaFilter({ _id: cargoObjectId }, escuelaId);
    const cargo = await db.collection('cargos_cobro').findOne(query);
    if (!cargo) return res.status(404).json({ error: 'Cargo no encontrado' });

    const pago = {
      _id: new ObjectId(),
      monto: Number(monto),
      metodo,
      referencia,
      notas,
      fecha: new Date(),
      registradoPor: req.rol || 'admin'
    };

    const nuevoSaldo = Math.max(0, Number(cargo.saldoPendiente || cargo.monto || 0) - pago.monto);
    const nuevoEstado = nuevoSaldo === 0 ? 'pagado' : 'parcial';

    await db.collection('cargos_cobro').updateOne(query, {
      $push: { pagos: pago },
      $set: {
        saldoPendiente: nuevoSaldo,
        estado: nuevoEstado,
        updatedAt: new Date()
      }
    });

    await db.collection('pagos_cobro').insertOne({
      cargoId: cargo._id,
      alumnoId: cargo.alumnoId,
      conceptoId: cargo.conceptoId,
      conceptoNombre: cargo.conceptoNombre,
      monto: pago.monto,
      metodo: pago.metodo,
      referencia: pago.referencia,
      notas: pago.notas,
      fecha: pago.fecha,
      timestamp: new Date(),
      ...(escuelaId ? { escuelaId } : {})
    });

    res.json({ success: true, saldoPendiente: nuevoSaldo, estado: nuevoEstado });
  } catch (error) {
    console.error('Error registrando pago:', error);
    res.status(500).json({ error: 'Error registrando pago' });
  }
});

router.post('/api/admin/cobros/recordatorios/enviar', adminAuth, async (req, res) => {
  try {
    const { cargoIds = [], alumnoId = null } = req.body;
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);

    let query = { estado: { $in: ['pendiente', 'parcial'] } };
    if (cargoIds.length > 0) {
      const ids = cargoIds.map(toObjectId).filter(Boolean);
      if (ids.length > 0) query._id = { $in: ids };
    } else if (alumnoId) {
      const alumnoObjectId = toObjectId(alumnoId);
      if (!alumnoObjectId) return res.status(400).json({ error: 'alumnoId inválido' });
      query.alumnoId = alumnoObjectId;
    }
    query = addEscuelaFilter(query, escuelaId);

    const cargos = await db.collection('cargos_cobro').find(query).toArray();
    for (const cargo of cargos) {
      await crearNotificacionCobro(db, {
        alumnoId: cargo.alumnoId,
        titulo: `Recordatorio de pago: ${cargo.conceptoNombre}`,
        mensaje: `Tienes un saldo pendiente de $${Number(cargo.saldoPendiente || 0).toFixed(2)} con vencimiento ${new Date(cargo.fechaLimite).toLocaleDateString('es-ES')}`
      }, escuelaId);
    }

    res.json({ success: true, recordatoriosEnviados: cargos.length });
  } catch (error) {
    console.error('Error enviando recordatorios:', error);
    res.status(500).json({ error: 'Error enviando recordatorios' });
  }
});

router.get('/api/admin/cobros/resumen', adminAuth, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const baseQuery = addEscuelaFilter({}, escuelaId);

    const cargos = await db.collection('cargos_cobro').find(baseQuery).toArray();
    const totalCargos = cargos.length;
    const totalFacturado = cargos.reduce((sum, c) => sum + Number(c.monto || 0), 0);
    const totalPendiente = cargos.reduce((sum, c) => sum + Number(c.saldoPendiente || 0), 0);
    const totalCobrado = totalFacturado - totalPendiente;
    const pendientes = cargos.filter(c => c.estado === 'pendiente').length;
    const parciales = cargos.filter(c => c.estado === 'parcial').length;
    const pagados = cargos.filter(c => c.estado === 'pagado').length;

    res.json({
      totalCargos,
      totalFacturado,
      totalCobrado,
      totalPendiente,
      pendientes,
      parciales,
      pagados
    });
  } catch (error) {
    console.error('Error obteniendo resumen de cobros:', error);
    res.status(500).json({ error: 'Error obteniendo resumen de cobros' });
  }
});

// Endpoint listo para Stripe (activarlo cuando tengas variables)
router.post('/api/admin/cobros/pagos/preparar-stripe', adminAuth, async (req, res) => {
  const hasStripeConfig = !!process.env.STRIPE_SECRET_KEY;
  if (!hasStripeConfig) {
    return res.status(400).json({
      error: 'Stripe no configurado aún',
      requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_PUBLIC_KEY']
    });
  }
  return res.json({
    success: true,
    message: 'Stripe configurado. Pendiente conectar checkout/session según flujo final.'
  });
});

// ----------------------------
// PADRES - Estado de cuenta y pagos
// ----------------------------
router.get('/api/padres/pagos/estado-cuenta', authPadre, async (req, res) => {
  try {
    const db = getDB();
    const escuelaId = getEscuelaId(req);
    const query = addEscuelaFilter({
      ...alumnoIdCompatFilter(req.alumnoId),
      estado: { $in: ['pendiente', 'parcial', 'pagado'] }
    }, escuelaId);

    const cargos = await db.collection('cargos_cobro')
      .find(query)
      .sort({ fechaLimite: 1 })
      .toArray();

    const resumen = {
      totalFacturado: cargos.reduce((sum, c) => sum + Number(c.monto || 0), 0),
      totalPendiente: cargos.reduce((sum, c) => sum + Number(c.saldoPendiente || 0), 0),
      totalPagado: cargos.reduce((sum, c) => sum + Number(c.monto || 0), 0) - cargos.reduce((sum, c) => sum + Number(c.saldoPendiente || 0), 0)
    };

    res.json({ resumen, cargos });
  } catch (error) {
    console.error('Error obteniendo estado de cuenta de padre:', error);
    res.status(500).json({ error: 'Error obteniendo estado de cuenta' });
  }
});

router.post('/api/padres/pagos/intencion', authPadre, async (req, res) => {
  try {
    const { cargoId, metodo = 'transferencia' } = req.body;
    const cargoObjectId = toObjectId(cargoId);
    if (!cargoObjectId) return res.status(400).json({ error: 'cargoId inválido' });

    const db = getDB();
    const escuelaId = getEscuelaId(req);
    const cargo = await db.collection('cargos_cobro').findOne(addEscuelaFilter({
      _id: cargoObjectId,
      ...alumnoIdCompatFilter(req.alumnoId)
    }, escuelaId));

    if (!cargo) return res.status(404).json({ error: 'Cargo no encontrado' });
    if (cargo.estado === 'pagado' || Number(cargo.saldoPendiente || 0) <= 0) {
      return res.status(400).json({ error: 'Este cargo ya está pagado' });
    }

    const intencion = {
      cargoId: cargo._id,
      alumnoId: cargo.alumnoId,
      monto: Number(cargo.saldoPendiente || 0),
      metodo,
      estado: 'pendiente',
      provider: process.env.STRIPE_SECRET_KEY ? 'stripe' : 'manual',
      timestamp: new Date(),
      ...(escuelaId ? { escuelaId } : {})
    };
    await db.collection('intenciones_pago').insertOne(intencion);

    res.json({
      success: true,
      provider: intencion.provider,
      message: intencion.provider === 'stripe'
        ? 'Listo para iniciar checkout de Stripe'
        : 'Pago registrado como intención. La escuela confirmará el pago manualmente.'
    });
  } catch (error) {
    console.error('Error creando intención de pago:', error);
    res.status(500).json({ error: 'Error creando intención de pago' });
  }
});

export default router;
