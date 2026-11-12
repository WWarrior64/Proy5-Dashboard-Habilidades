# Base de Datos

Este directorio contiene los esquemas de datos del proyecto Internal Marketplace.

## Archivos
- `schemas/data-model.md` → Modelo de datos general (nueve tablas y relaciones).
- `schemas/usuarios.md` → Entidad Usuarios (`internal-marketplace-usuarios-dev`).
- `schemas/colaboradores.md` → Entidad Colaboradores (`internal-marketplace-colaboradores-dev`).
- `schemas/cargos.md` → Entidad Cargos (`internal-marketplace-cargos-dev`).
- `schemas/habilidades.md` → Entidad Habilidades (`internal-marketplace-habilidades-dev`).
- `schemas/colaborador-habilidad.md` → Entidad ColaboradorHabilidad (`internal-marketplace-colaborador-habilidad-dev`).
- `schemas/proyectos.md` → Entidad Proyectos (`internal-marketplace-proyectos-dev`).
- `schemas/proyecto-habilidad.md` → Entidad ProyectoHabilidad (`internal-marketplace-proyecto-habilidad-dev`).
- `schemas/postulaciones.md` → Entidad Postulaciones (`internal-marketplace-postulaciones-dev`).
- `schemas/asignaciones.md` → Entidad Asignaciones (`internal-marketplace-asignaciones-dev`).

## Motor recomendado
Amazon DynamoDB (AWS Free Tier).

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

La lectura de asignaciones mediante GSI tiene consistencia eventual. Por eso la reconciliación solo debe efectuarse cuando hayan cesado las modificaciones, haya transcurrido el tiempo de propagación y se hayan verificado los registros. Esta utilidad no se ha ejecutado contra AWS ni DynamoDB Local desde el conector.