const fs = require('fs');
const path = require('path');

describe('Contrato de Rutas - Handlers vs SAM Template', () => {
  const templatePath = path.resolve(__dirname, '../../infrastructure/template.yaml');
  let samRoutes = [];

  beforeAll(() => {
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      // Extraer eventos Api con su Path y Method
      const lines = templateContent.split('\n');
      let currentPath = null;
      let currentMethod = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Path:')) {
          currentPath = trimmed.split('Path:')[1].trim();
        } else if (trimmed.startsWith('Method:')) {
          currentMethod = trimmed.split('Method:')[1].trim().toUpperCase();
          if (currentPath && currentMethod && currentMethod !== 'OPTIONS') {
            samRoutes.push(`${currentMethod} ${currentPath}`);
            currentPath = null;
            currentMethod = null;
          }
        }
      }
    }
  });

  it('debe encontrar el archivo infrastructure/template.yaml', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
    expect(samRoutes.length).toBeGreaterThan(0);
  });

  it('los handlers principales deben tener rutas válidas y consistentes', () => {
    const handlersList = [
      'usuarios',
      'colaboradores',
      'cargos',
      'habilidades',
      'proyectos',
      'postulaciones',
      'asignaciones',
      'busqueda',
      'dashboard',
      'health',
    ];

    handlersList.forEach((modulo) => {
      const handlerFile = path.resolve(__dirname, `../src/functions/${modulo}/handler.js`);
      expect(fs.existsSync(handlerFile)).toBe(true);
      const content = fs.readFileSync(handlerFile, 'utf8');
      expect(content).toContain('crearDespachador');
    });
  });

  it('debe registrar y documentar rutas conocidas entre SAM y Handlers', () => {
    // Verifica que rutas críticas estén presentes en la declaración de SAM
    const rutasCriticas = [
      'GET /api/v1/health',
      'GET /api/v1/usuarios/yo',
      'POST /api/v1/usuarios',
      'GET /api/v1/colaboradores',
      'GET /api/v1/dashboard/resumen',
      'GET /api/v1/busqueda/colaboradores',
    ];

    rutasCriticas.forEach((ruta) => {
      expect(samRoutes).toContain(ruta);
    });
  });
});