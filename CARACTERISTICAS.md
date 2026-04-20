# Gestion Escolar - Estado de Caracteristicas

## Fase 0: Estabilizacion

- [x] Fix orden de rutas analisis-predictivo (riesgo antes de :alumnoId)
- [x] Fix nombre coleccion reportes (encuestas_satisfaccion -> encuestas)
- [x] Fix uso de generateResponse en recursos (string, no objeto)
- [x] Limpiar import no usado (ObjectId en knowledge.js)
- [x] Proteger datos sensibles en ruta publica de alumnos
- [x] Conectar tab Encuestas en AdminPanel (boton + vista)
- [x] Agregar boton Recursos en sidebar del AdminPanel
- [x] Conectar boton Calendario Academico en Tareas
- [x] CSS para modales del Chatbot
- [x] Helper fetchAPI centralizado en config.js
- [x] Migrar componentes a usar fetchAPI (progresivo)
- [ ] Refactorizar AdminPanel en sub-componentes
- [ ] SPA Router

## Fase 1: Sistema de Cobros

- [x] Backend: routes/cobros.js (CRUD conceptos de pago)
- [x] Backend: estados de cuenta por alumno
- [x] Backend: registrar pagos
- [x] Backend: recordatorios automaticos de pago
- [x] Frontend: tab Cobros en AdminPanel
- [x] Frontend: tab Pagos en PortalPadres
- [ ] Integracion pasarela (Stripe/Conekta)

## Fase 2: Autenticacion JWT

- [x] Reescribir auth.js con JWT (adminAuth, requireSuperAdmin, getJwtSecret)
- [x] Passwords con bcrypt (padres, alta escuela, usuarios escuela; env con hash opcional admin/super)
- [ ] Conectar hasPermission a rutas reales
- [ ] Login unificado (admin, maestro, padre)
- [x] Proteger rutas maestro (tareas, asistencia, recursos)
- [ ] Recuperacion de contrasena

## Fase 3: Portal Maestros

- [ ] PortalMaestros.svelte
- [ ] Login de maestro
- [ ] Vista: asistencia rapida de su grupo
- [ ] Vista: calificaciones de su grupo
- [ ] Vista: tareas asignadas
- [ ] Vista: mensajes con padres
- [ ] SPA Router (4 vistas principales)

## Fase 4: PWA

- [ ] manifest.json
- [ ] Service Worker
- [ ] Push Notifications
- [ ] Optimizar responsive mobile-first
- [ ] Soporte offline basico

## Fase 5: Control de Acceso

- [ ] QR por alumno
- [ ] Lector QR (camara)
- [ ] Registro entrada/salida
- [ ] Notificacion automatica a padres
- [ ] Tab en AdminPanel
- [ ] Notificacion en PortalPadres

## Fase 6: Comunicacion en Tiempo Real

- [ ] WebSockets
- [ ] Chat maestro-padre bidireccional
- [ ] Canales por grupo
- [ ] Push notifications en tiempo real

## Fase 7: Reportes Avanzados

- [ ] Graficas en frontend (Chart.js)
- [ ] Dashboard ejecutivo con KPIs
- [ ] Mejorar calidad PDFs
- [ ] Exports profesionales

## Fase 8: Inscripciones y Marketplace

- [ ] Formulario inscripcion online
- [ ] Multi-escuela avanzado
- [ ] API publica documentada
- [ ] White-label

---

## Funcionalidades ya existentes

### Backend (20 archivos de rutas)

- [x] Chat IA con Claude (texto + imagen)
- [x] Portal Admin (login, stats, CRUD general)
- [x] Portal Padres (login, calificaciones, progreso, eventos, citas, historial)
- [x] CRUD Maestros
- [x] CRUD Alumnos
- [x] CRUD Espacios
- [x] CRUD Grupos
- [x] CRUD Calificaciones (promedios, historial, alertas)
- [x] CRUD Asistencia (estadisticas por alumno/grupo/tendencias)
- [x] Mensajeria (mensajes, notificaciones, respuestas rapidas)
- [x] Progreso academico (objetivos, logros)
- [x] Encuestas (satisfaccion, sugerencias, feedback)
- [x] Multi-escuela (super-admin, escuelas)
- [x] Tareas (CRUD, entrega, calificacion, calendario)
- [x] Accesibilidad (perfiles por alumno)
- [x] Analisis predictivo (riesgo academico con IA)
- [x] Reportes (Excel, PDF, JSON)
- [x] Recursos (CRUD, Wasabi S3, recomendaciones IA)
- [x] Citas (publicas y admin)
- [x] Knowledge base para bot (datos escolares)

### Frontend (4 componentes)

- [x] AdminPanel: 19 tabs (dashboard, horarios, eventos, planes, informacion, citas, maestros, alumnos, espacios, grupos, calificaciones, asistencia, mensajeria, progreso, analisis, encuestas, reportes, tareas, recursos)
- [x] PortalPadres: 6 tabs (dashboard, calificaciones, progreso, eventos, citas, historial)
- [x] Chatbot: chat IA, imagen, citas, encuestas
- [x] Navegacion principal (3 vistas)
