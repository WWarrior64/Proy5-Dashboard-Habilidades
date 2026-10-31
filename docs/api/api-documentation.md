# Documentación de la API

**Base URL:** `http://localhost:3000/api` (desarrollo)  
**Producción:** `https://{api-id}.execute-api.{region}.amazonaws.com/prod`

## Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /colaboradores | Listar colaboradores |
| POST | /colaboradores | Crear colaborador |
| GET | /colaboradores/:id | Obtener colaborador |
| PUT | /colaboradores/:id | Actualizar colaborador |
| DELETE | /colaboradores/:id | Eliminar colaborador |
| GET | /proyectos | Listar proyectos |
| POST | /proyectos | Crear proyecto |
| GET | /asignaciones | Listar asignaciones |
| POST | /asignaciones | Crear asignación |
| POST | /auth/login | Iniciar sesión |

## Autenticación
Las peticiones protegidas requieren header `Authorization: Bearer <token>`.

## Pruebas
Se incluye una colección de Postman en `postman/internal-marketplace.postman_collection.json` con al menos 2 operaciones CRUD probadas.