const {
  crearColaboradorSchema, actualizarColaboradorSchema,
  asociarHabilidadSchema, actualizarNivelHabilidadSchema,
} = require('../src/utils/validators.js');

describe('Observaciones opcionales', () => {
  const colaborador = { usuarioId: 'u1', cargoId: 'cargo-1', rolProfesional: 'Desarrollador' };
  const habilidad = { colaboradorId: 'c1', habilidadId: 'h1', nivel: 'MID' };

  test.each([undefined, '', null])('permite observaciones %p al crear un colaborador', (observaciones) => {
    const datos = observaciones === undefined ? colaborador : { ...colaborador, observaciones };
    expect(crearColaboradorSchema.validate(datos).error).toBeUndefined();
  });

  test.each(['', null])('permite borrar observaciones usando %p', (observaciones) => {
    expect(actualizarColaboradorSchema.validate({ observaciones }).error).toBeUndefined();
    expect(actualizarNivelHabilidadSchema.validate({ observaciones }).error).toBeUndefined();
  });

  test.each([undefined, '', null])('permite observaciones %p al asociar una habilidad', (observaciones) => {
    const datos = observaciones === undefined ? habilidad : { ...habilidad, observaciones };
    expect(asociarHabilidadSchema.validate(datos).error).toBeUndefined();
  });
});
