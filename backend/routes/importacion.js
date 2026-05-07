import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { getDB } from '../utils/db.js';
import { adminAuth } from '../utils/auth.js';
import { getEscuelaId, addEscuelaFilter } from '../utils/multi-escuela.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

function slugHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function pick(row, aliases) {
  for (const a of aliases) {
    const v = row[a];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/** Une nombre + apellidos si vienen en columnas separadas (plantillas RH / SEP). */
function nombreCompletoPersona(row, aliasesNombre) {
  const nombre = pick(row, aliasesNombre);
  const ap1 = pick(row, [
    'apellidopaterno',
    'apellido_paterno',
    'paterno',
    'primer_apellido',
    'ape_pat'
  ]);
  const ap2 = pick(row, [
    'apellidomaterno',
    'apellido_materno',
    'materno',
    'segundo_apellido',
    'ape_mat'
  ]);
  const partes = [nombre, ap1, ap2].map((s) => String(s || '').trim()).filter(Boolean);
  return partes.join(' ');
}

/** Fila de encabezados (docentes, o «Información Personal Alumno» con título arriba). */
function findHeaderRowIndex(raw) {
  if (!raw.length) return 0;
  const hints = [
    'nombre',
    'iddepartamento',
    'apellidopaterno',
    'apellidomaterno',
    'grado',
    'idpuesto',
    'email',
    'grupo',
    'matricula',
    'nomalumno',
    'emailhijo',
    'apaternoalumno'
  ];
  for (let i = 0; i < Math.min(raw.length, 50); i++) {
    const cells = raw[i].map((h) => slugHeader(h)).filter(Boolean);
    const set = new Set(cells);
    let score = 0;
    for (const h of hints) {
      if (set.has(h)) score++;
    }
    if (score >= 2) return i;
  }
  return 0;
}

function sheetToRows(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const raw = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!raw.length) return [];
  const headerIdx = findHeaderRowIndex(raw);
  const headerCells = raw[headerIdx].map((h) => slugHeader(h));
  const rows = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const line = raw[i];
    const obj = {};
    let empty = true;
    for (let j = 0; j < headerCells.length; j++) {
      const key = headerCells[j];
      if (!key) continue;
      const cell = line[j];
      const val = cell !== undefined && cell !== null ? String(cell).trim() : '';
      if (val) empty = false;
      obj[key] = val;
    }
    if (!empty) rows.push(obj);
  }
  const dataStartRow1Based = headerIdx + 2;
  return { rows, dataStartRow1Based };
}

function emailValido(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

/** Plantilla preescolar: NomAlumno completo; si no, nombre + apaterno/materno alumno. */
function nombreAlumnoDesdeFila(row, nombreAliases) {
  const unaColumna = pick(row, ['nomalumno', 'nom_alumno']);
  if (unaColumna) return unaColumna.replace(/\s+/g, ' ').trim();

  const nom = pick(row, nombreAliases);
  const ap1 = pick(row, ['apaternoalumno', 'apellidopaterno', 'apellido_paterno', 'paterno']);
  const ap2 = pick(row, ['amaternoalumno', 'apellidomaterno', 'apellido_materno', 'materno']);
  const partes = [nom, ap1, ap2].map((s) => String(s || '').trim()).filter(Boolean);
  return partes.join(' ');
}

/** Tutor, mamá y papá con email válido; sin duplicar por correo. */
function padresDesdeFila(row) {
  const candidatos = [
    {
      emailKeys: ['emailtutor', 'email_tutor'],
      nombreKeys: ['nombretutor', 'nombre_tutor']
    },
    { emailKeys: ['emailmama', 'email_mama'], nombreKeys: ['nommama', 'nom_mama', 'nombremama'] },
    { emailKeys: ['emailpapa', 'email_papa'], nombreKeys: ['nompapa', 'nom_papa', 'nombrepapa'] }
  ];
  const out = [];
  const seen = new Set();
  for (const { emailKeys, nombreKeys } of candidatos) {
    const emailRaw = pick(row, emailKeys).toLowerCase();
    if (!emailValido(emailRaw) || seen.has(emailRaw)) continue;
    seen.add(emailRaw);
    let nombre = pick(row, nombreKeys).replace(/\s+/g, ' ').trim();
    if (!nombre) nombre = emailRaw.split('@')[0] || 'Tutor';
    out.push({ nombre, email: emailRaw, password: '' });
  }
  return out;
}

router.post('/api/admin/import/maestros', adminAuth, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Archivo requerido (campo archivo)' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const { rows, dataStartRow1Based } = sheetToRows(req.file.buffer);

    let insertados = 0;
    let actualizados = 0;
    const errores = [];

    const A = {
      nombre: ['nombre', 'name', 'maestro', 'docente', 'profesor', 'teacher', 'nombre_completo', 'docente_nombre'],
      email: ['email', 'correo', 'e_mail', 'mail'],
      telefono: ['telefono', 'celular', 'phone', 'movil', 'whatsapp'],
      especialidad: ['especialidad', 'materia', 'area', 'asignatura'],
      horarios: ['horarios', 'horarios_disponibles', 'disponibilidad', 'horario'],
      grado: ['grado', 'nivel', 'grupo_docente', 'salon_docente'],
      idDepartamento: ['iddepartamento', 'departamento', 'tipo_puesto', 'rol'],
      idPuesto: ['idpuesto', 'puesto', 'nivel_escolar', 'area_escolar']
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const filaNum = dataStartRow1Based + i;
      const nombre = nombreCompletoPersona(row, A.nombre);
      if (!nombre) {
        errores.push({ fila: filaNum, mensaje: 'Fila sin nombre de maestro' });
        continue;
      }

      const email = pick(row, A.email).toLowerCase();
      const telefono = pick(row, A.telefono);
      let especialidad = pick(row, A.especialidad);
      if (!especialidad) {
        const dept = pick(row, A.idDepartamento);
        const puesto = pick(row, A.idPuesto);
        const grado = pick(row, A.grado);
        const trozos = [dept, puesto, grado].filter(Boolean);
        if (trozos.length) especialidad = trozos.join(' · ');
      }
      const horariosDisponibles = pick(row, A.horarios);

      const baseFilter = addEscuelaFilter({}, escuelaId);
      let existing = null;

      if (email) {
        existing = await db.collection('maestros').findOne({ ...baseFilter, email });
      }
      if (!existing) {
        existing = await db.collection('maestros').findOne({ ...baseFilter, nombre });
      }

      const payload = {
        nombre,
        email: email || '',
        telefono,
        especialidad,
        horariosDisponibles,
        activo: true,
        updatedAt: new Date()
      };

      if (existing) {
        await db.collection('maestros').updateOne(
          { _id: existing._id },
          {
            $set: {
              nombre: payload.nombre,
              email: email || existing.email || '',
              telefono: payload.telefono || existing.telefono,
              especialidad: payload.especialidad || existing.especialidad,
              horariosDisponibles: payload.horariosDisponibles || existing.horariosDisponibles,
              activo: true,
              updatedAt: new Date()
            }
          }
        );
        actualizados++;
      } else {
        const doc = {
          ...payload,
          timestamp: new Date()
        };
        if (escuelaId) doc.escuelaId = escuelaId;
        await db.collection('maestros').insertOne(doc);
        insertados++;
      }
    }

    res.json({
      success: true,
      totalFilas: rows.length,
      insertados,
      actualizados,
      errores
    });
  } catch (error) {
    console.error('Error importando maestros:', error);
    res.status(500).json({ error: 'Error importando maestros' });
  }
});

router.post('/api/admin/import/alumnos', adminAuth, upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Archivo requerido (campo archivo)' });
    }

    const db = getDB();
    const escuelaId = req.escuelaId || getEscuelaId(req);
    const { rows, dataStartRow1Based } = sheetToRows(req.file.buffer);

    let insertados = 0;
    let actualizados = 0;
    const errores = [];

    const gruposQuery = addEscuelaFilter({}, escuelaId);
    const gruposLista = await db.collection('grupos').find(gruposQuery).toArray();
    const grupoPorNombre = new Map(
      gruposLista.map((g) => [String(g.nombre || '').trim().toLowerCase(), g])
    );

    const A = {
      nombre: [
        'nomalumno',
        'nom_alumno',
        'nombre',
        'alumno',
        'estudiante',
        'nombre_completo',
        'name',
        'nombre_del_alumno'
      ],
      email: ['emailhijo', 'email_alumno', 'email', 'correo', 'mail'],
      telefono: ['telefono', 'celular', 'phone', 'movil', 'telefonoemergencia'],
      grupo: ['grupo', 'salon', 'aula', 'clase', 'curso', 'grupo_nombre', 'seccion', 'seccion_grupo'],
      matricula: ['matricula', 'matricula_escolar', 'numero_control'],
      curp: ['curp'],
      padreNombre: ['padre_nombre', 'tutor_nombre', 'nombre_padre', 'nombre_tutor', 'padre', 'tutor', 'madre'],
      padreEmail: ['padre_email', 'email_padre', 'correo_padre', 'tutor_email', 'correo_tutor'],
      padrePassword: ['padre_password', 'password_padre', 'contraseña_padre', 'clave_padre']
    };

    function resolverGrupo(nombreGrupo) {
      const key = String(nombreGrupo || '').trim().toLowerCase();
      if (!key) return null;
      return grupoPorNombre.get(key) || null;
    }

    function mergePadres(existingPadres, nuevo) {
      const arr = Array.isArray(existingPadres) ? [...existingPadres] : [];
      const emails = new Set(arr.map((p) => String(p.email || '').toLowerCase()).filter(Boolean));
      if (nuevo.email && emails.has(nuevo.email.toLowerCase())) return arr;
      if (nuevo.email && nuevo.nombre) {
        arr.push({
          nombre: nuevo.nombre,
          email: nuevo.email.toLowerCase(),
          ...(nuevo.password ? { password: nuevo.password } : {})
        });
      }
      return arr;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const filaNum = dataStartRow1Based + i;
      const nombre = nombreAlumnoDesdeFila(row, A.nombre);
      if (!nombre) {
        errores.push({ fila: filaNum, mensaje: 'Fila sin nombre de alumno' });
        continue;
      }

      const emailAlumnoRaw = pick(row, A.email).toLowerCase();
      const emailAlumno = emailValido(emailAlumnoRaw) ? emailAlumnoRaw : '';
      const telefono = pick(row, A.telefono);
      const matriculaVal = pick(row, A.matricula);
      const curpVal = pick(row, A.curp);
      const grupoNombre = pick(row, A.grupo);
      const grupoDoc = resolverGrupo(grupoNombre);
      const grupoIdObj = grupoDoc?._id || null;

      if (grupoNombre && !grupoDoc) {
        errores.push({
          fila: filaNum,
          mensaje: `Grupo no encontrado en el sistema: "${grupoNombre}"`
        });
      }

      const padreNombre = pick(row, A.padreNombre);
      const padreEmailRaw = pick(row, A.padreEmail).toLowerCase();
      const padrePassword = pick(row, A.padrePassword);

      const padresExplicito =
        padreEmailRaw && emailValido(padreEmailRaw)
          ? [
              {
                nombre: padreNombre || padreEmailRaw.split('@')[0] || 'Tutor',
                email: padreEmailRaw,
                password: padrePassword || ''
              }
            ]
          : [];

      const padresPlantilla = padresDesdeFila(row);
      const padresNuevosLista =
        padresExplicito.length > 0 ? padresExplicito : padresPlantilla;

      function fusionarPadres(base, lista) {
        let acc = Array.isArray(base) ? [...base] : [];
        for (const p of lista) {
          acc = mergePadres(acc, {
            nombre: p.nombre,
            email: p.email,
            password: p.password || undefined
          });
        }
        return acc;
      }

      const baseFilter = addEscuelaFilter({}, escuelaId);
      let existing = null;
      if (emailAlumno) {
        existing = await db.collection('alumnos').findOne({ ...baseFilter, email: emailAlumno });
      }
      if (!existing && matriculaVal) {
        existing = await db.collection('alumnos').findOne({
          ...baseFilter,
          matricula: matriculaVal
        });
      }
      if (!existing) {
        const q = { ...baseFilter, nombre };
        if (grupoIdObj) q.grupoId = grupoIdObj;
        existing = await db.collection('alumnos').findOne(q);
      }

      if (existing) {
        const mergedPadres = fusionarPadres(existing.padres, padresNuevosLista);
        await db.collection('alumnos').updateOne(
          { _id: existing._id },
          {
            $set: {
              nombre,
              email: emailAlumno || existing.email || '',
              telefono: telefono || existing.telefono,
              grupoId: grupoIdObj !== null ? grupoIdObj : existing.grupoId,
              ...(matriculaVal ? { matricula: matriculaVal } : {}),
              ...(curpVal ? { curp: curpVal } : {}),
              padres: Array.isArray(mergedPadres) ? mergedPadres : [],
              activo: true,
              updatedAt: new Date()
            }
          }
        );
        actualizados++;
      } else {
        const doc = {
          nombre,
          email: emailAlumno || '',
          telefono,
          grupoId: grupoIdObj,
          ...(matriculaVal ? { matricula: matriculaVal } : {}),
          ...(curpVal ? { curp: curpVal } : {}),
          padres: fusionarPadres([], padresNuevosLista),
          activo: true,
          perfilAccesibilidad: {
            modoAccesible: false,
            textoSimplificado: false,
            lecturaPantalla: false,
            respuestasCortas: false,
            necesidadesEspeciales: []
          },
          timestamp: new Date()
        };
        if (escuelaId) doc.escuelaId = escuelaId;
        await db.collection('alumnos').insertOne(doc);
        insertados++;
      }
    }

    res.json({
      success: true,
      totalFilas: rows.length,
      insertados,
      actualizados,
      errores
    });
  } catch (error) {
    console.error('Error importando alumnos:', error);
    res.status(500).json({ error: 'Error importando alumnos' });
  }
});

export default router;
