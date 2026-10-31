# Infraestructura AWS

Este directorio contiene la plantilla de aprovisionamiento inicial en AWS Free Tier.

## Recursos
- `template.yaml` → Tabla DynamoDB y Bucket S3 para el frontend.

## Despliegue
```bash
aws cloudformation create-stack --stack-name internal-marketplace --template-body file://template.yaml
```