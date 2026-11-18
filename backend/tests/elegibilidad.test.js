const {
  evaluarElegibilidad,
  verificarDisponibilidad,
  normalizarRequisitos,
  validarRequisito,
  cumpleNivelRequisito,
  NIVELES_VALIDOS,
} = require('../src/services/elegibilidad.service.js');

describe('Servicio de Elegibilidad', () => {
  describe('cumpleNivelRequisito', () => {
    test('SENIOR cumple JUNIOR', () => {
      expect(cumpleNivelRequisito('SENIOR', 'JUNIOR')).toBe(true);
    });

    test('MID cumple MID', () => {
      expect(cumpleNivelRequisito('MID', 'MID')).toBe(true);
    });

    test('JUNIOR no cumple SENIOR', () => {
      expect(cumpleNivelRequisito('JUNIOR', 'SENIOR')).toBe(false);
    });

    test('Nivel nulo no cumple nada', () => {
      expect(cumpleNivelRequisito(null, 'JUNIOR')).toBe(false);
    });
  });

  describe('normalizarRequisitos', () => {
    test('aplica valores por defecto', () => {
      const requisitos = normalizarRequisitos([{ habilidadId: 'hab_1' }]);
      expect(requisitos).toHaveLength(1);
      expect(requisitos[0].nivelMinimo).toBe('JUNIOR');
      expect(requisitos[0].esObligatoria).toBe(false);
      expect(requisitos[0].peso).toBe(1);
    });

    test('respeta valores proporcionados', () => {
      const requisitos = normalizarRequisitos([
        { habilidadId: 'hab_1', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 3 },
      ]);
      expect(requisitos[0].nivelMinimo).toBe('SENIOR');
      expect(requisitos[0].esObligatoria).toBe(true);
      expect(requisitos[0].peso).toBe(3);
    });

    test('lanza error si requisitos no es un arreglo', () => {
      expect(() => normalizarRequisitos(null)).toThrow();
    });

    test('lanza error si falta habilidadId', () => {
      expect(() => normalizarRequisitos([{ nivelMinimo: 'JUNIOR' }])).toThrow();
    });

    test('lanza error si nivelMinimo inválido', () => {
      expect(() => normalizarRequisitos([{ habilidadId: 'h1', nivelMinimo: 'LEAD' }])).toThrow();
    });
  });

  describe('evaluarElegibilidad', () => {
    const colaboradorBase = {
      colaboradorId: 'col_1',
      usuarioId: 'usr_1',
      estado: 'ACTIVO',
      habilidades: [
        { habilidadId: 'hab_react', nivel: 'SENIOR', anosExperiencia: 5 },
        { habilidadId: 'hab_sql', nivel: 'MID', anosExperiencia: 3 },
      ],
    };

    test('colaborador cumple todos los requisitos obligatorios', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'MID', esObligatoria: true, peso: 2 },
        { habilidadId: 'hab_sql', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(true);
      expect(resultado.puntuacion).toBe(100);
      expect(resultado.obligatoriosIncumplidos).toHaveLength(0);
    });

    test('colaborador no cumple obligatoria: no es elegible', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 2 },
        { habilidadId: 'hab_sql', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(false);
      expect(resultado.puntuacion).toBe(0);
      expect(resultado.obligatoriosIncumplidos).toHaveLength(1);
      expect(resultado.obligatoriosIncumplidos[0].habilidadId).toBe('hab_sql');
    });

    test('habilidad opcional incumplida no bloquea pero reduce puntuación', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'MID', esObligatoria: true, peso: 1 },
        { habilidadId: 'hab_java', nivelMinimo: 'MID', esObligatoria: false, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(true);
      expect(resultado.puntuacion).toBe(50);
      expect(resultado.faltantes).toHaveLength(1);
      expect(resultado.faltantes[0].habilidadId).toBe('hab_java');
    });

    test('habilidad no poseída se registra como faltante', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'JUNIOR', esObligatoria: false, peso: 1 },
        { habilidadId: 'hab_python', nivelMinimo: 'JUNIOR', esObligatoria: false, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.cumplidos).toHaveLength(1);
      expect(resultado.faltantes).toHaveLength(1);
      expect(resultado.faltantes[0].nivelPoseido).toBeNull();
    });

    test('puntuación ponderada respeta pesos', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 3 },
        { habilidadId: 'hab_sql', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(true);
      expect(resultado.puntuacion).toBe(100);
    });

    test('puntuación 0 cuando hay obligatorias incumplidas', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 1 },
        { habilidadId: 'hab_java', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 5 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(false);
      expect(resultado.puntuacion).toBe(0);
    });

    test('requisitos vacíos: elegible con puntuación 0', () => {
      const resultado = evaluarElegibilidad(colaboradorBase, []);
      expect(resultado.elegible).toBe(true);
      expect(resultado.puntuacion).toBe(0);
    });

    test('nivel individual por habilidad', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 1 },
        { habilidadId: 'hab_sql', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(true);
      const reactDetalle = resultado.cumplidos.find((c) => c.habilidadId === 'hab_react');
      const sqlDetalle = resultado.cumplidos.find((c) => c.habilidadId === 'hab_sql');
      expect(reactDetalle.nivelPoseido).toBe('SENIOR');
      expect(sqlDetalle.nivelPoseido).toBe('MID');
    });

    test('datos incompletos: colaborador sin habilidades no cumple nada', () => {
      const colaboradorSinHabilidades = { colaboradorId: 'col_2', estado: 'ACTIVO' };
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorSinHabilidades, requisitos);
      expect(resultado.elegible).toBe(false);
      expect(resultado.puntuacion).toBe(0);
      expect(resultado.faltantes).toHaveLength(1);
      expect(resultado.faltantes[0].nivelPoseido).toBeNull();
    });

    test('datos incompletos: habilidad sin nivel no cumple requisito', () => {
      const colaboradorSinNivel = {
        colaboradorId: 'col_3',
        estado: 'ACTIVO',
        habilidades: [{ habilidadId: 'hab_react', anosExperiencia: 2 }],
      };
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'MID', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorSinNivel, requisitos);
      expect(resultado.elegible).toBe(false);
      expect(resultado.faltantes[0].cumple).toBe(false);
      expect(resultado.faltantes[0].nivelPoseido).toBeUndefined();
    });

    test('resultados consistentes al evaluar dos veces (sin duplicados)', () => {
      const requisitos = [
        { habilidadId: 'hab_react', nivelMinimo: 'MID', esObligatoria: true, peso: 1 },
        { habilidadId: 'hab_sql', nivelMinimo: 'JUNIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado1 = evaluarElegibilidad(colaboradorBase, requisitos);
      const resultado2 = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado1).toEqual(resultado2);
    });

    test('búsqueda sin coincidencias: ningún requisito se cumple', () => {
      const requisitos = [
        { habilidadId: 'hab_go', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 1 },
        { habilidadId: 'hab_aws', nivelMinimo: 'SENIOR', esObligatoria: true, peso: 1 },
      ];
      const resultado = evaluarElegibilidad(colaboradorBase, requisitos);
      expect(resultado.elegible).toBe(false);
      expect(resultado.puntuacion).toBe(0);
      expect(resultado.cumplidos).toHaveLength(0);
      expect(resultado.faltantes).toHaveLength(2);
      expect(resultado.obligatoriosIncumplidos).toHaveLength(2);
    });
  });

  describe('verificarDisponibilidad', () => {
    test('colaborador ACTIVO sin restricciones está disponible', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'ACTIVO', dedicacionReservada: 0 },
        null,
        true
      );
      expect(resultado.disponible).toBe(true);
      expect(resultado.motivo).toBeNull();
    });

    test('colaborador INACTIVO no está disponible', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'INACTIVO', dedicacionReservada: 0 },
        null,
        true
      );
      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toBe('Colaborador inactivo');
    });

    test('usuario vinculado INACTIVO bloquea disponibilidad', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'ACTIVO', dedicacionReservada: 0 },
        { estado: 'INACTIVO' },
        true
      );
      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toBe('Cuenta de usuario inactiva');
    });

    test('sin dedicación definida no está disponible', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'ACTIVO', dedicacionReservada: null },
        null,
        true
      );
      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toBe('Dedicación no definida');
    });

    test('dedicación al 100% reservada no está disponible', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'ACTIVO', dedicacionReservada: 100 },
        null,
        true
      );
      expect(resultado.disponible).toBe(false);
      expect(resultado.motivo).toBe('Sin dedicación disponible');
    });

    test('dedicación 50% reservada está disponible con 50% libre', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'ACTIVO', dedicacionReservada: 50 },
        null,
        true
      );
      expect(resultado.disponible).toBe(true);
    });

    test('considerarDisponibilidad=false ignora dedicación', () => {
      const resultado = verificarDisponibilidad(
        { estado: 'ACTIVO', dedicacionReservada: 100 },
        null,
        false
      );
      expect(resultado.disponible).toBe(true);
    });

    test('colaborador nulo no está disponible', () => {
      const resultado = verificarDisponibilidad(null, null, true);
      expect(resultado.disponible).toBe(false);
    });
  });

  describe('NIVELES_VALIDOS', () => {
    test('contiene JUNIOR, MID, SENIOR', () => {
      expect(NIVELES_VALIDOS).toContain('JUNIOR');
      expect(NIVELES_VALIDOS).toContain('MID');
      expect(NIVELES_VALIDOS).toContain('SENIOR');
      expect(NIVELES_VALIDOS).toHaveLength(3);
    });
  });
});