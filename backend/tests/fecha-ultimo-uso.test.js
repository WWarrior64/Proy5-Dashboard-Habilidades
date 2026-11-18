const {
  asociarHabilidadSchema,
  actualizarNivelHabilidadSchema,
} = require('../src/utils/validators');

describe('Último uso de una habilidad del colaborador', () => {
  it('acepta una fecha ISO opcional al asociar una habilidad', () => {
    const resultado = asociarHabilidadSchema.validate({
      colaboradorId: 'col-1', habilidadId: 'h-1', nivel: 'MID',
      fechaUltimoUso: '2026-11-12',
    });
    expect(resultado.error).toBeUndefined();
    expect(resultado.value.fechaUltimoUso).toBeDefined();
    expect(String(resultado.value.fechaUltimoUso)).toContain('2026-11-12');
  });

  it('permite registrar o borrar una fecha desde la edición de nivel', () => {
    expect(actualizarNivelHabilidadSchema.validate({
      nivel: 'SENIOR', fechaUltimoUso: '2026-11-12',
    }).error).toBeUndefined();
    expect(actualizarNivelHabilidadSchema.validate({
      fechaUltimoUso: null,
    }).error).toBeUndefined();
  });

  it('rechaza una fecha de último uso con formato inválido', () => {
    expect(actualizarNivelHabilidadSchema.validate({
      fechaUltimoUso: 'no es fecha',
    }).error).toBeDefined();
  });
});
