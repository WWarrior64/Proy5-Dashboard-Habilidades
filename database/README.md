# Base de Datos

Este directorio contiene los esquemas de datos del proyecto Internal Marketplace.

## Archivos
- `schemas/data-model.md` → Modelo de datos general (once tablas y relaciones).
- `schemas/usuarios.md` → Entidad Usuarios (`internal-marketplace-usuarios-dev`).
- `schemas/colaboradores.md` → Entidad Colaboradores (`internal-marketplace-colaboradores-dev`).
- `schemas/cargos.md` → Entidad Cargos (`internal-marketplace-cargos-dev`).
- `schemas/habilidades.md` → Entidad Habilidades (`internal-marketplace-habilidades-dev`).
- `schemas/colaborador-habilidad.md` → Entidad ColaboradorHabilidad (`internal-marketplace-colaborador-habilidad-dev`).
- `schemas/proyectos.md` → Entidad Proyectos (`internal-marketplace-proyectos-dev`).
- `schemas/proyecto-habilidad.md` → Entidad ProyectoHabilidad (`internal-marketplace-proyecto-habilidad-dev`).
- `schemas/postulaciones.md` → Entidad Postulaciones (`internal-marketplace-postulaciones-dev`).
- `schemas/asignaciones.md` → Entidad Asignaciones (`internal-marketplace-asignaciones-dev`).
- `schemas/auditoria.md` → Tabla de eventos de auditoría (`internal-marketplace-auditoria-dev`, GSI1 por fecha).
- Tabla `internal-marketplace-administracion-dev` → Configuración administrativa (`configuracionId` como clave primaria), documentada en `docs/database/database-design.md`.

## Motor recomendado
Amazon DynamoDB con facturación bajo demanda (`PAY_PER_REQUEST`); el costo depende del uso y de las condiciones del Free Tier/créditos disponibles.

## Convención de nombres
Los nombres físicos definidos por SAM siguen el patrón `internal-marketplace-<entidad>-<StageName>`, por ejemplo `internal-marketplace-proyectos-dev` en desarrollo o `internal-marketplace-proyectos-prod` en producción. Los nombres con sufijo `-dev` presentes en los esquemas son ejemplos del entorno de desarrollo; el despliegue validado el 10 de noviembre de 2026 utilizó `prod`.

Colaboradores incluye ítems internos de reserva `USUARIO#<usuarioId>` para impedir mediante transacciones que dos solicitudes simultáneas creen perfiles nuevos para la misma cuenta. Estos ítems no son perfiles y deben excluirse de las consultas funcionales. Los perfiles antiguos sin reserva requieren reconciliación antes de depender de esta garantía para todo el histórico.

## Reconciliación de datos históricos (solo backend)

`backend/scripts/reconciliar-colaboradores.js` inspecciona los perfiles y sus asignaciones activas, detecta usuarios con perfiles duplicados y compara los porcentajes reservados con la suma de asignaciones. **Por defecto no escribe en DynamoDB.**

Desde la raíz del proyecto, una vez configurados `AWS_PROFILE`, `AWS_REGION`, `TABLE_COLABORADORES` y `TABLE_ASIGNACIONES` para el entorno correcto:

```powershell
node backend/scripts/reconciliar-colaboradores.js
```

Para aplicar la reconciliación hay que detener primero las escrituras de la aplicación, realizar respaldo de las tablas y verificar el resultado de la inspección. Solamente entonces se puede ejecutar:

```powershell
node backend/scripts/reconciliar-colaboradores.js --apply --sin-escrituras-concurrentes
```

El modo de aplicación exige las variables de nombres físicos de las dos tablas. Crea las reservas faltantes y completa `dedicacionReservada` únicamente cuando todavía no existe; **no sobrescribe valores divergentes** ni intenta resolver automáticamente usuarios duplicados. Ante conflictos, detiene la operación y requiere revisión manual. Es necesario volver a ejecutar la inspección después de aplicar.

La reconciliación de colaboradores ahora lee las asignaciones activas desde la tabla base con consistencia fuerte, sin depender de la propagación de GSI1. Las escrituras deben detenerse igualmente durante una reconciliación para obtener una visión estable. Esta utilidad no se ha ejecutado contra AWS ni DynamoDB Local desde el conector.

La utilidad `backend/scripts/reconciliar-proyectos.js` inspecciona con lecturas fuertes de las tablas base el contador `asignacionesActivas` de cada proyecto y lo compara con sus asignaciones activas. Por defecto solo informa y detiene la operación ante inconsistencias. Para inicializar contadores ausentes, primero se requiere detener escrituras, revisar el informe y confirmar expresamente su aplicación; no se ha ejecutado sobre AWS.

Antes del despliegue, `backend/scripts/auditar-unicidad-asignaciones.js` permite examinar las parejas históricas proyecto–colaborador sin modificar datos. Requiere `TABLE_ASIGNACIONES` explícita. Si encuentra una pareja repetida, finaliza con error y exige revisión manual antes de publicar. Los nuevos CRUD consultan primero el identificador determinista y, de no existir, comprueban las asignaciones históricas con un escaneo paginado y consistente de la tabla base. Esto evita depender de un GSI eventual, aunque aumenta el costo de lectura; cualquier optimización posterior debe conservar la garantía de unicidad.

## Cambios funcionales reflejados en el modelo

- **Colaboradores:** `dedicacionReservada` representa el porcentaje ocupado; la disponibilidad mostrada se calcula como `100 - dedicacionReservada`. Los registros dados de baja permanecen históricos y pueden reactivarse si la cuenta de Usuario está activa; se conservan `ultimaFechaBaja` y `fechaReincorporacion` cuando corresponde.
- **Proyectos:** se registran como `BORRADOR`; exigen al menos una relación ProyectoHabilidad antes de pasar a `ACTIVO`. `fechaPublicacion` refleja la primera publicación. `asignacionesActivas` mantiene el número de asignaciones vigentes mediante transacciones y evita cierres concurrentes; los proyectos anteriores deben reconciliarse antes de utilizar esa garantía. La fecha final estimada es un cálculo de la interfaz, no una fecha de cierre persistida automáticamente.
- **Asignaciones:** se conserva el historial y se impide duplicar una asignación para el mismo proyecto y colaborador. Se rechaza la autoasignación del líder, pero se permite que un líder participe en proyectos de otros responsables. Los estados incluyen `ACTIVA`, `FINALIZADA` y `DESVINCULADA`.
- **Usuarios y Auditoría:** `ultimoAcceso` se actualiza al registrar un inicio de sesión correcto. La auditoría crea eventos a partir de operaciones exitosas, disponibles solo para administradores y únicamente desde su habilitación efectiva en AWS.