# Infraestructura Serverless — Internal Marketplace

Este directorio define la infraestructura como código mediante **AWS SAM (Serverless Application Model)**. Los recursos usan servicios administrados, pero deben supervisarse los cargos reales de AWS, incluso en cuentas con créditos o acceso al Free Tier.

## Componentes definidos en la plantilla (provisión sujeta al despliegue)

1. **API Gateway & AWS Lambda:**
   - Una API REST (`InternalMarketplaceApi`) configurada con CORS y soporte para endpoints orientados al microservicio de talento.
   - Once funciones Lambda organizadas por dominio, con runtime `nodejs24.x`, incluida `AdministracionFunction`; `HealthFunction` expone `/api/v1/health`.

2. **Base de Datos NoSQL (Amazon DynamoDB):**
   - Once tablas: `Usuarios`, `Colaboradores`, `Cargos`, `Habilidades`, `ColaboradorHabilidad`, `Proyectos`, `ProyectoHabilidad`, `Postulaciones`, `Asignaciones`, `Administracion` y `Auditoria`.
   - Modo `PAY_PER_REQUEST` e índices secundarios globales (GSI) definidos en `template.yaml`.

3. **Frontend Hosting (Amazon S3 + CloudFront):**
   - Bucket S3 privado para alojar el build estático de la SPA en React.
   - Distribución de **Amazon CloudFront** con *Origin Access Control (OAC)*, HTTPS para los visitantes y caché de archivos estáticos.

---

## Prerrequisitos de Instalación local

Asegúrate de contar con las siguientes herramientas instaladas en tu entorno de desarrollo:
- [AWS CLI v2](https://aws.amazon.com/cli/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- [Node.js 24](https://nodejs.org/) (compatible con el runtime definido en SAM)

---

## Comandos de Despliegue y Validación

### 1. Validar la plantilla SAM
Comprueba que la sintaxis de la infraestructura sea correcta sin necesidad de conectarte a AWS:
\`\`\`bash
sam validate --template-file infrastructure/template.yaml
\`\`\`

### 2. Compilar la aplicación y las funciones Lambda
Genera los artefactos empaquetados listos para pruebas locales o despliegue:
\`\`\`bash
sam build --template-file infrastructure/template.yaml
\`\`\`

### 3. Desplegar de forma guiada a AWS (Manual)
Para realizar el despliegue inicial interactivo en tu cuenta de AWS:
\`\`\`bash
sam deploy --guided
\`\`\`
La ejecución de `sam deploy` puede crear o modificar recursos y costos. Verifica la región, el perfil IAM y el nombre de la pila antes de confirmarla. Para probar localmente las rutas Lambda se utiliza `sam local start-api --template-file .aws-sam/build/template.yaml`; requiere Docker y variables de entorno válidas. En cambio, `node backend/src/index.js` solo levanta un servicio Express de salud (`/health`) y **no** todas las rutas Lambda.

### Evidencia del despliegue del 10 de noviembre de 2026
- Se ejecutaron 155 pruebas Jest satisfactoriamente; una prueba de integración local quedó omitida.
- ESLint finalizó con 0 errores y 64 advertencias de variables o argumentos sin uso.
- `sam validate --lint`, `sam build` y `sam deploy` se completaron correctamente para la pila `internal-marketplace-stack` (`us-east-2`, etapa `prod`). CloudFormation indicó `UPDATE_COMPLETE`.
- La solicitud pública de salud respondió con `success: true`, `status: ok` y `entorno: prod`. Las demás solicitudes de Postman fueron reportadas como satisfactorias por el equipo, sin registro detallado por ruta en este documento.
- Tras los cambios posteriores de validación, paginación y caché, **esas evidencias no sustituyen una nueva ejecución de Jest, compilación y despliegue**.

### Pruebas y comprobaciones para la nueva versión
- Ejecutar `npm test --prefix backend` y `npm run lint --prefix backend` desde la raíz del repositorio. Las pruebas Jest requieren las dependencias instaladas.
- Ejecutar `sam validate --template-file infrastructure/template.yaml --lint` y `sam build --template-file infrastructure/template.yaml` desde la raíz del repositorio.
- Arrancar `sam local start-api --template-file .aws-sam/build/template.yaml` después de compilar y comprobar las solicitudes reales con Docker disponible.
- Verificar los casos de error HTTP 400 (JSON inválido), 404 (inexistente), 409 (duplicidad/concurrencia) y 500 (fallo interno).
- Probar dos solicitudes de asignación o aceptación simultáneas que juntas excedan el 100 % de dedicación; solo debe confirmarse la operación compatible con el límite.
- Confirmar que la detección de `AWS_LAMBDA_FUNCTION_NAME` desactive la caché de proceso en Lambda; por diseño, ello aumenta las lecturas en DynamoDB y no elimina la consistencia eventual de los GSIs.
- Verificar rutas nuevas o modificadas: `/api/v1/colaboradores/yo`, `/api/v1/habilidades/categorias`, `/api/v1/usuarios/yo/acceso`, `/api/v1/asignaciones/mias`, `/api/v1/administracion/auditoria` y el PATCH de estado de asignaciones.
- Comprobar las políticas IAM, los **once** nombres de tablas y sus índices, la autenticación Cognito, `TABLE_AUDITORIA` y `AUDIT_ENABLED=true`. La tabla de Auditoría utiliza GSI1 (`tipoRegistro`, `fechaId`) y lectura restringida al Administrador.
- Probar acceso HTTPS y recarga de rutas React en CloudFront; las respuestas 403 y 404 se redirigen a `index.html` según la plantilla.
- Mantener separados los perfiles de desarrollo y producción y no registrar credenciales ni tokens en el repositorio.

### Reglas funcionales que deben verificarse después del despliegue

- Crear un proyecto como `BORRADOR`, registrar al menos una habilidad requerida y activarlo; verificar la persistencia de `fechaPublicacion` y que no pueda publicarse sin requisitos.
- Impedir asignaciones duplicadas (incluido el historial) y comprobar el límite transaccional del 100 % de dedicación; el líder no puede ser asignado ni postularse a su propio proyecto, pero sí a uno dirigido por otra persona.
- Validar `GET /api/v1/asignaciones/mias` con un líder que también posea perfil de colaborador: debe devolver sus participaciones, sin otorgar permisos de escritura sobre proyectos ajenos. Un 403/`Unauthorized` en una API antigua no demuestra un fallo de la implementación local: revisar la ruta y el autorizador Cognito después de desplegar.
- Verificar que el inicio de sesión registre `ultimoAcceso` sin modificarlo en cada refresco; consultar la auditoría únicamente desde una cuenta de Administrador. Los eventos previos a habilitar la bitácora no pueden recuperarse con autor verificado.
- Publicar la nueva compilación React en S3/CloudFront cuando cambie el frontend y comprobar que el navegador no siga utilizando archivos estáticos anteriores.

Las evidencias históricas de despliegue del 10 de noviembre corresponden a la versión de aquella fecha. **No constituyen evidencia de que las nuevas rutas, la tabla Auditoría ni los cambios posteriores estén desplegados.**

