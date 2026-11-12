const Joi = require('joi');
const { validar, validarDatos } = require('../src/middleware/validation');
const { crearUsuarioSchema, actualizarUsuarioSchema, crearColaboradorSchema } = require('../src/utils/validators');

const esquema = Joi.object({
  nombre: Joi.string().trim().min(1).required(),
  estado: Joi.string().valid('ACTIVO', 'INACTIVO').default('ACTIVO'),
});

describe('Middleware de validación Joi', () => {
  test('registro de usuario no exige ni acepta cognitoSub desde el cliente', () => {
    expect(crearUsuarioSchema.validate({ nombre: 'Ana', email: 'ana@example.com' }).error).toBeUndefined();
    expect(crearUsuarioSchema.validate({ nombre: 'Ana', email: 'ana@example.com', cognitoSub: 'inyectado' }).error).toBeDefined();
  });

  test('actualización parcial de usuario no requiere correo', () => {
    expect(actualizarUsuarioSchema.validate({ nombre: 'Ana Actualizada' }).error).toBeUndefined();
  });

  test('creación de colaborador admite ID generado por backend', () => {
    expect(crearColaboradorSchema.validate({ usuarioId: 'u1', cargoId: 'c1', rolProfesional: 'Desarrollador' }).error).toBeUndefined();
  });

  test('valida datos directamente y mantiene los campos opcionales sin defaults', () => {
    expect(validarDatos(esquema, { nombre: ' Ejemplo ' })).toEqual({ nombre: 'Ejemplo' });
  });

  test('validarDatos rechaza estados desconocidos con error aplicativo 400', () => {
    try {
      validarDatos(esquema, { nombre: 'Ejemplo', estado: 'DESCONOCIDO' });
      throw new Error('Se esperaba un error de validación');
    } catch (fallo) {
      expect(fallo).toMatchObject({ codigo: 400, codigoError: 'VALIDATION_ERROR' });
    }
  });

  test('entrega value validado y valores por defecto al handler', async () => {
    const siguiente = jest.fn(async (event) => ({ statusCode: 200, body: JSON.stringify(event.bodyValidado) }));
    const respuesta = await validar(esquema)({ body: JSON.stringify({ nombre: ' Ejemplo ' }) }, siguiente);
    expect(respuesta.statusCode).toBe(200);
    expect(siguiente).toHaveBeenCalledTimes(1);
    expect(JSON.parse(respuesta.body)).toEqual({ nombre: 'Ejemplo', estado: 'ACTIVO' });
  });

  test('devuelve 400 si el cuerpo no es JSON válido', async () => {
    const siguiente = jest.fn();
    const respuesta = await validar(esquema)({ body: '{invalido' }, siguiente);
    expect(respuesta.statusCode).toBe(400);
    expect(siguiente).not.toHaveBeenCalled();
  });

  test('devuelve 400 si el esquema no se cumple', async () => {
    const siguiente = jest.fn();
    const respuesta = await validar(esquema)({ body: JSON.stringify({ nombre: '' }) }, siguiente);
    expect(respuesta.statusCode).toBe(400);
    expect(siguiente).not.toHaveBeenCalled();
  });
});
