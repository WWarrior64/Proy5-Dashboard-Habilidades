# Infraestructura Serverless — Internal Marketplace

Este directorio contiene la definición de la infraestructura como código (IaC) utilizando **AWS SAM (Serverless Application Model)** para desplegar la plataforma dentro de la cuota gratuita de AWS (*Free Tier*).

## Componentes Provisionados

1. **API Gateway & AWS Lambda:**
   - Una API REST (`InternalMarketplaceApi`) configurada con CORS y soporte para endpoints orientados al microservicio de talento.
   - Función inicial de salud (`HealthFunction`) montada sobre Node.js 20.x en la ruta `/api/v1/health`.

2. **Base de Datos NoSQL (Amazon DynamoDB):**
   - 9 tablas aprovisionadas bajo el modelo de datos definitivo del proyecto (`Usuarios`, `Colaboradores`, `Cargos`, `Habilidades`, `ColaboradorHabilidad`, `Proyectos`, `ProyectoHabilidad`, `Postulaciones` y `Asignaciones`)[cite: 7, 8].
   - Configuración con `PAY_PER_REQUEST` e Índices Secundarios Globales (GSI) optimizados para los patrones de búsqueda del Internal Marketplace[cite: 7].

3. **Frontend Hosting (Amazon S3 + CloudFront):**
   - Bucket S3 privado para alojar el build estático de la SPA en React[cite: 3, 8].
   - Distribución de **Amazon CloudFront** con *Origin Access Control (OAC)* y políticas optimizadas de caché en el Edge[cite: 2, 3, 8].

---

## Prerrequisitos de Instalación local

Asegúrate de contar con las siguientes herramientas instaladas en tu entorno de desarrollo:
- [AWS CLI v2](https://aws.aws.amazon.com/cli/)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
- [Node.js (LTS v20+)](https://nodejs.org/)

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
*(En los parámetros de despliegue puedes aceptar los valores por defecto, especificando `prod` o `dev` como `StageName`).*

