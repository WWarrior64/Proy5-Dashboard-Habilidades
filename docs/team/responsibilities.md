# Responsabilidades del Equipo

**Universidad Católica de El Salvador – Cómputo en la Nube – Grupo B | Ing. Herberth Contreras**

| Integrante | Rol | Responsabilidades |
|------------|-----|-------------------|
| Desarrollador 1 | Frontend SPA | Buscador interactivo de perfiles por habilidades, filtros y asignación gráfica. |
| Desarrollador 2 | Backend Filtering Core | Algoritmo de filtrado y búsqueda de candidatos por coincidencia de habilidades. |
| Desarrollador 3 | Cloud Performance | Estrategia de caché para acelerar consultas recurrentes. |
| Desarrollador 4 | Database Modeling | Matriz de habilidades (relaciones N:M Desarrolladores, Habilidades, Proyectos). |
| Desarrollador 5 | CI/CD & Repository Manager | GitHub Actions, control de versiones y convenciones de código. |

## Normas
- Cada integrante defiende su parte individualmente el 21 de noviembre.
- Historial de commits activo desde el 31 de octubre.
- Rama `main`, `develop` y ramas por feature.

## Alcance funcional de la versión integrada

La tabla anterior conserva las responsabilidades originales de los cinco roles de trabajo del proyecto, que no deben confundirse con los **roles de acceso** dentro de la aplicación (`EMPLEADO`, `RRHH`, `LIDER_PROYECTO`, `ADMINISTRADOR`). La implementación actual contempla once funciones Lambda y once tablas DynamoDB, incluyendo Administración y Auditoría.

Antes de integrar cambios y presentar la entrega, corresponde ejecutar pruebas de backend y frontend, validar la plantilla SAM y comprobar el despliegue en AWS. Debe probarse con cuentas de cada rol el ciclo de publicación de proyectos con habilidades requeridas, los porcentajes de dedicación, los filtros históricos, la reincorporación de colaboradores y las asignaciones personales de líderes en proyectos ajenos. La documentación no sustituye la evidencia de ejecución real.