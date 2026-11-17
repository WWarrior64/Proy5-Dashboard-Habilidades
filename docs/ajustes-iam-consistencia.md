# Permisos IAM para W04–W10 y controles de concurrencia

**Responsable de revisar y aplicar la infraestructura:** Diego Ernesto Portillo Alfaro.
**Origen:** cambios del backend para integridad transaccional de usuarios, colaboradores, proyectos, asignaciones y postulaciones.

Los permisos identificados se incorporaron a `infrastructure/template.yaml` mediante ajustes mínimos a las políticas IAM. Diego debe revisar las modificaciones antes de integrarlas a su rama y validar la plantilla con SAM antes de desplegar. No se aplicaron permisos a AWS ni se ejecutó despliegue.

| Función SAM | Tabla | Acciones adicionales | Uso |
| --- | --- | --- | --- |
| `UsuariosFunction` | `ColaboradoresTable` | `dynamodb:UpdateItem` | Inactivar un perfil junto con su cuenta dentro de una transacción. |
| `UsuariosFunction` | `AsignacionesTable` (incluido GSI1) | `dynamodb:Query` | Comprobar que no existan asignaciones activas al desactivar la cuenta. |
| `ColaboradoresFunction` | `AsignacionesTable` (incluido GSI1) | `dynamodb:Query` | Bloquear bajas de perfiles con asignaciones activas. |
| `ColaboradoresFunction` | `UsuariosTable` | `dynamodb:ConditionCheckItem` | Confirmar que la cuenta siga activa al reincorporar al colaborador. |
| `PostulacionesFunction` | `ProyectosTable` | `dynamodb:UpdateItem` | Incrementar el contador de asignaciones activas en la aceptación transaccional. |
| `PostulacionesFunction` | `ProyectoHabilidadTable` y `ColaboradorHabilidadTable` | `dynamodb:Query` | Verificar requisitos obligatorios antes de aceptar. |
| `PostulacionesFunction` | `AsignacionesTable`, `ColaboradoresTable` y `UsuariosTable` | `dynamodb:ConditionCheckItem` | Evitar nuevas postulaciones de perfiles asignados, inactivos o con cuentas desactivadas. |
| `AsignacionesFunction` | `ProyectosTable` | `dynamodb:UpdateItem` | Actualizar el contador de asignaciones activas al crear/finalizar/desvincular. |
| `AsignacionesFunction` | `ProyectoHabilidadTable` y `ColaboradorHabilidadTable` | `dynamodb:Query` | Verificar habilidades obligatorias antes de asignar. |
| `AsignacionesFunction` | `UsuariosTable` y `PostulacionesTable` | `dynamodb:ConditionCheckItem` | Impedir asignaciones con cuenta inactiva o una postulación pendiente registrada simultáneamente. |
| `BusquedaFunction` | `ProyectoHabilidadTable` | `dynamodb:Query` | Consultar requisitos reales en búsquedas por proyecto. |

Las políticas específicas usan los ARN de tablas e índices correspondientes, combinadas con los permisos ya existentes de `DynamoDBCrudPolicy` o `DynamoDBReadPolicy`. Deben comprobarse los permisos efectivos después de transformar SAM. Las comprobaciones transaccionales de `UsuariosTable` se concedieron expresamente a las funciones que las requieren.

## Reconciliación previa al despliegue

Las nuevas asignaciones y los cierres usan `asignacionesActivas` en la tabla `Proyectos`. Para proyectos históricos, ejecutar primero la **inspección sin escrituras** de `backend/scripts/reconciliar-proyectos.js`. Cualquier diferencia con el historial real debe investigarse antes de aplicar cambios.

Para los colaboradores históricos se conserva `backend/scripts/reconciliar-colaboradores.js`, también de inspección por defecto. **No** debe suponerse una dedicación reservada de cero cuando falta ese dato.

Las opciones de aplicación de ambos scripts están protegidas por `--apply --sin-escrituras-concurrentes` y requieren detener escrituras, comprobar las tablas y tener autorización IAM.

La auditoría adicional `backend/scripts/auditar-unicidad-asignaciones.js` es de solo lectura y requiere definir explícitamente `TABLE_ASIGNACIONES`. Informa asignaciones anteriores y detecta parejas proyecto–colaborador duplicadas antes de publicar. No repara automáticamente datos contradictorios. La reconciliación de dedicaciones ya utiliza lecturas fuertes de la tabla base y no necesita que GSI1 se haya propagado. Para garantizar una inspección estable, detener escrituras de la versión anterior.

## Comprobaciones antes de publicar — responsable: integrante 5 (Diego)

El backend ya utiliza `ScanCommand` consistente sobre las tablas base de Colaboradores y Asignaciones para cubrir historiales que todavía no tengan reserva de unicidad o identificador determinista. Antes de desplegar, Diego debe confirmar que los roles IAM de Usuarios, Colaboradores, Asignaciones y Postulaciones permiten `dynamodb:Scan` sobre esas tablas; la configuración actual de `DynamoDBReadPolicy` y `DynamoDBCrudPolicy` contempla estas lecturas. No se requieren tablas ni índices adicionales para esta corrección.

1. Ejecutar `npm test --workspace=backend` y `npm test --workspace=frontend` para confirmar que las suites pasan.
2. Ejecutar `sam validate --template-file infrastructure/template.yaml --lint` y `sam build --template-file infrastructure/template.yaml`.
3. Detener escrituras de la versión anterior, respaldar las tablas y ejecutar la auditoría de unicidad y las inspecciones de reconciliación; si hay divergencias, resolverlas antes de desplegar.
4. Comprobar las políticas IAM efectivas generadas por SAM.
5. Comprobar el acceso desde la Lambda de Usuarios al actualizar el perfil de Colaboradores.
6. Comprobar que las Lambdas de Asignaciones y Postulaciones leen los requisitos de habilidades.
7. Probar concurrencia entre una asignación y el cierre de su proyecto.
8. Repetir las pruebas de los tres CRUD desde la SPA publicada.
