# Proy5-Dashboard-Habilidades

Dashboard de Gestión de Talento y Habilidades Internas (Internal Marketplace) — Universidad Católica de El Salvador, Cómputo en la Nube – Grupo B | Ing. Herberth Contreras.

## Estructura del proyecto

```
Proy5-Dashboard-Habilidades/
├── frontend/          # SPA en React + Vite
├── backend/           # API en Node.js + Express (Serverless-ready)
├── database/          # Esquemas de datos (DynamoDB / RDS)
├── infrastructure/    # AWS SAM / CloudFormation template
├── postman/           # Colección de pruebas API
├── docs/              # Documentación técnica
├── .github/           # CI/CD (GitHub Actions)
└── README.md
```

## Requisitos

- Node.js >= 18
- npm >= 9
- Cuenta AWS Free Tier

## Instalación rápida

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
npm install
npm start
```

## Variables de entorno

Copia `.env.example` a `.env` tanto en `frontend/` como en `backend/` y completa los valores antes de ejecutar.

## Evaluación

Este proyecto cubre los criterios del Laboratorio 2 y la entrega final (Parcial) del 21 de noviembre de 2026: repositorio, estructura de capas, backend/API, base de datos, infraestructura AWS y seguridad.