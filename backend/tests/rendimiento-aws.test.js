const { medirRuta, construirRutas, ejecutarMediciones, resumirTiempos } =
  require('../scripts/medirRendimientoAWS.js');

describe('medición HTTP real (sin contactos de red durante Jest)', () => {
  test('resume las latencias con percentiles y preserva la cantidad de solicitudes', () => {
    expect(resumirTiempos([10, 20, 30, 40])).toMatchObject({
      solicitudes: 4, promedioMs: 25, p50Ms: 20, p95Ms: 40,
    });
  });

  test('solo agrega el buscador si se proporcionaron habilidades', () => {
    const base = 'https://api.example.com/prod/api/v1';
    expect(construirRutas(base, [])).toHaveLength(4);
    const rutas = construirRutas(base, ['h1', 'h2']);
    expect(rutas).toHaveLength(5);
    expect(decodeURIComponent(rutas[4].url)).toContain('habilidades=h1,h2');
  });

  test('envía únicamente solicitudes GET autenticadas y cuenta los metadatos de caché', async () => {
    let llamadas = 0;
    const simulado = jest.fn(async () => {
      llamadas += 1;
      return {
        ok: true, status: 200,
        json: async () => ({
          success: true,
          datos: { metadatos: { cache: { desdeCache: llamadas > 1 } } },
        }),
      };
    });

    const resultado = await medirRuta({
      nombre: 'Dashboard',
      url: 'https://api.example.com/prod/api/v1/dashboard/resumen',
      token: 'token-de-prueba',
      repeticiones: 3,
      fetchImpl: simulado,
    });
    expect(simulado).toHaveBeenCalledTimes(3);
    expect(simulado).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer token-de-prueba' }),
    }));
    expect(resultado.cache).toEqual({
      aciertosConfirmados: 2, lecturasConfirmadas: 1, respuestasSinMetadatos: 0,
    });
    expect(resultado.total.solicitudes).toBe(3);
  });

  test('rechaza endpoints remotos inseguros o tokens ausentes antes de hacer consultas', async () => {
    const simulado = jest.fn();
    await expect(ejecutarMediciones({
      baseUrl: 'http://example.com/prod/api/v1',
      token: 'falso',
      fetchImpl: simulado,
    })).rejects.toThrow('HTTPS');
    await expect(ejecutarMediciones({
      baseUrl: 'https://example.com/prod/api/v1',
      token: '',
      fetchImpl: simulado,
    })).rejects.toThrow('Configure');
    expect(simulado).not.toHaveBeenCalled();
  });

  test('un fallo HTTP detiene la medición sin exponer el token', async () => {
    const simulado = jest.fn(async () => ({ ok: false, status: 403 }));
    await expect(medirRuta({
      nombre: 'Cargos',
      url: 'https://api.example.com/prod/api/v1/cargos',
      token: 'secreto-en-memoria',
      repeticiones: 2,
      fetchImpl: simulado,
    })).rejects.toThrow('HTTP 403');
  });
});
