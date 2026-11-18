# Administración operativa: roles, permisos y configuración

## Criterio de aplicación

El sistema conserva los cuatro roles existentes: **Empleado**, **RRHH**, **Líder de proyecto** y **Administrador**. El rol de cada cuenta se asigna en **Usuarios**. Un rol determina las operaciones posibles y el acceso a recursos propios; la pantalla **Roles y permisos** permite **restringir o restablecer** las operaciones de escritura de un rol, pero no conceder facultades que ese rol no tuviera originalmente.

Los permisos guardados en DynamoDB se comprueban en el backend con `ENFORCE_PERMISSION_POLICY=true`, actualmente definido en `infrastructure/template.yaml`. Las comprobaciones de propiedad de perfiles, proyectos y asignaciones continúan siendo obligatorias. El backend es la fuente de autorización: ocultar o deshabilitar botones en el navegador es únicamente una ayuda visual.

La política oficial contiene estas ocho operaciones:

| Permiso | Función | Roles originales |
| --- | --- | --- |
| `gestionar_usuarios` | Crear usuarios, modificar datos de otros usuarios, cambiar roles o estados | Administrador |
| `gestionar_colaboradores` | Registrar, editar, dar de baja y reincorporar colaboradores | RRHH, Administrador |
| `gestionar_cargos` | Registrar, modificar, activar o desactivar cargos | RRHH, Administrador |
| `gestionar_habilidades` | Administrar el catálogo de habilidades de RRHH | RRHH, Administrador |
| `gestionar_habilidades_propias` | Vincular, actualizar o retirar habilidades de perfiles autorizados | Empleado, RRHH, Líder, Administrador |
| `gestionar_proyectos` | Crear, editar y cambiar estados de proyectos autorizados | RRHH, Líder, Administrador |
| `gestionar_asignaciones` | Crear, editar, finalizar o desvincular asignaciones autorizadas | RRHH, Líder, Administrador |
| `gestionar_postulaciones` | Postular, retirar y decidir sobre postulaciones según rol y propiedad | Empleado, RRHH, Líder, Administrador |

La aceptación de una postulación crea una asignación: exige tanto `gestionar_postulaciones` como `gestionar_asignaciones`. La modificación del **nombre del perfil propio** no depende del permiso administrativo de gestión de usuarios. La consulta de datos sigue las reglas de lectura y propiedad del rol, independientemente de que se deshabilite la escritura.

El Administrador conserva los permisos esenciales para evitar un bloqueo irreversible de la administración; los nombres y las identidades de los cuatro roles son fijos.

## Cómo administrar roles y permisos

1. Ingresar como Administrador y abrir **Roles y permisos**.
2. Editar un permiso para habilitar o retirar los roles disponibles, o editar un rol para revisar su conjunto de capacidades.
3. Guardar los cambios. El backend valida que se envíe el catálogo oficial completo, sin nuevos roles, permisos inventados ni escaladas de privilegios.
4. Las pantallas consultan `GET /api/v1/usuarios/yo/permisos` para mostrar operaciones disponibles. La consulta se renueva al enfocar la ventana o al recibir el evento de actualización de permisos. Las operaciones guardadas se vuelven a comprobar desde el servidor en cada petición de escritura.

No se crean nuevos permisos genéricos: un permiso solo tendría efecto tras implementarse y verificarse su correspondencia con rutas y casos de uso reales.

## Configuración disponible

| Ajuste | Valores | Aplicación |
| --- | --- | --- |
| **Nombre de la organización** | Texto de 1 a 70 caracteres | Nombre de la marca en inicio de sesión y navegación |
| **Días de actividad del dashboard** | Entero entre 1 y 90 | Período de actividad consultado por el dashboard del Administrador |
| **Registros por página del dashboard** | Entero entre 3 y 15 | Paginación de usuarios recientes y actividades en el dashboard del Administrador |

Estos tres parámetros son los únicos editables desde **Configuración** porque tienen consumidores implementados.

Las siguientes reglas se muestran como referencia y **no son editables** desde Configuración: **límite de dedicación del 100 %**, **niveles de habilidad Junior/Mid/Senior** y **estados de proyecto Borrador/Activo/Pausado/Completado/Cancelado**. Cambiarlos exigiría modificar las validaciones de negocio, transacciones y vistas correspondientes.

El catálogo de habilidades y los cargos profesionales se administran mediante sus funciones de **RRHH**, no mediante catálogos añadidos arbitrariamente a la Configuración del Administrador.

## Compatibilidad y despliegue

Si todavía no existe una configuración guardada, la API devuelve los parámetros oficiales con valores predeterminados. Las entradas antiguas sin una función implementada no se devuelven como opciones activas. Las nuevas escrituras rechazan entradas desconocidas y cambios de tipos o reglas fijas.

Para aplicar estos cambios fuera del entorno local, hay que **guardar los archivos, ejecutar las suites de backend y frontend, compilar, validar SAM y desplegar el backend y el frontend**. La modificación de código local no modifica automáticamente la API ya desplegada.
