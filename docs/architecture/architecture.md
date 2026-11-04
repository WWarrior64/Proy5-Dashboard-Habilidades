# Documentación de Arquitectura — Internal Marketplace

Este documento describe la arquitectura técnica seleccionada (**Opción A: Serverless**) para la plataforma web administrativa orientada al mapeo de habilidades y gestión de talento interno[cite: 3, 8].

---

## 1. Diagrama de Flujo de la Solución (Serverless en AWS Free Tier)

El flujo de solicitudes de los usuarios opera de manera desacoplada y altamente escalable:

1. **Capa Estática (Frontend SPA):**
   - El cliente accede a la aplicación web a través de **Amazon CloudFront** (CDN)[cite: 3, 8].
   - CloudFront sirve los archivos estáticos compilados desde un bucket privado de **Amazon S3**, utilizando control de acceso seguro mediante *Origin Access Control (OAC)*[cite: 2, 3, 8].

2. **Capa de API y Lógica (Backend):**
   - Las peticiones dinámicas del frontend apuntan a **Amazon API Gateway**[cite: 3, 8].
   - El enrutamiento distribuye las llamadas hacia funciones **AWS Lambda** (ejecutadas con Node.js 20.x)[cite: 3, 8].

3. **Capa de Datos (Persistencia NoSQL):**
   - Las funciones Lambda interactúan con las **9 tablas de Amazon DynamoDB**, aplicando el diseño de claves primarias y GSI definidos en el contrato de datos para soportar búsquedas avanzadas de talento por habilidades y disponibilidad[cite: 7, 8].

---

## 2. Estrategia de Rendimiento, Caché y Seguridad

- **Caché en el Edge (CloudFront):** Se encarga de acelerar la entrega de assets estáticos globales para evitar latencias en las consultas recurrentes del frontend.
- **Seguridad y Permisos IAM:** Las funciones Lambda operan bajo el principio de mínimo privilegio, limitando sus políticas de acceso exclusivamente a las tablas de DynamoDB que cada módulo requiere[cite: 8].
- **Gestión de Costos:** Se ha configurado el uso de DynamoDB bajo demanda u optimizado para mantenerse estrictamente dentro de los límites de la cuota gratuita de AWS (*Free Tier*), respaldado por alertas de presupuesto en AWS Budgets[cite: 3, 6].

