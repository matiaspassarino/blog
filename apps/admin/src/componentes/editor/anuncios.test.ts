// T059 y T061 (spec 003, H2-E2, E3, CE-006): textos accesibles del editor, como funciones puras.
// FASE ROJA: `./anuncios` no existe. Propuesta de firmas para T059/T061 (los textos salen de tasks.md):
//   nombreDeTipo(tipo: TipoVisible): string                         'parrafo' -> 'párrafo', 'cta' -> 'llamada a la acción'
//   nombreDeCampo(campo: string): string                            'imagen.alt' -> 'Texto alternativo'
//   resumenDeErrores(errores: ErrorElemento[]): string                "Hay 3 errores. Revisa el elemento 2, campo Texto alternativo"
//     (el "primer" error es el primero por orden de pantalla: la imagen destacada, indice -1, va antes que los bloques;
//      los índices de `ErrorElemento` son 0-based y se muestran 1-based)
import type { ErrorElemento } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import {
  anuncioConvertido,
  anuncioDeAvisoDeLimite,
  anuncioDeLimiteAlcanzado,
  anuncioDeshacer,
  anuncioDuplicado,
  anuncioInsertado,
  anuncioModoElementos,
  anuncioMovido,
  anuncioPegadoConSobrante,
  anuncioQuitado,
  anuncioRehacer,
  anuncioSubidaEnCurso,
  nombreDeCampo,
  nombreDeTipo,
  resumenDeErrores,
  TIPOS_VISIBLES,
} from './anuncios';

const error = (indice: number, campo: string): ErrorElemento => ({ indice, id: '', campo, mensaje: 'mensaje' });

describe('textos accesibles del editor (H2)', () => {
  describe('nombreDeTipo', () => {
    it('da un nombre en español, con tildes, para cada uno de los 10 tipos', () => {
      expect(TIPOS_VISIBLES.map((tipo) => nombreDeTipo(tipo))).toEqual([
        'párrafo',
        'título',
        'imagen',
        'cita',
        'lista',
        'galería',
        'llamada a la acción',
        'separador',
        'código',
        'video',
      ]);
    });
  });

  describe('errores', () => {
    it('H2-E3: nombra el campo con palabras de la persona, no con el nombre técnico', () => {
      expect(nombreDeCampo('imagen.alt')).toBe('Texto alternativo');
      expect(nombreDeCampo('texto')).toBe('Texto');
    });

    it('H2-E3: el resumen cuenta los errores y señala el primero (índice mostrado desde 1)', () => {
      const errores = [error(1, 'imagen.alt'), error(2, 'texto'), error(4, 'texto')];
      expect(resumenDeErrores(errores)).toBe('Hay 3 errores. Revisa el elemento 2, campo Texto alternativo');
    });

    it('H2-E3: con un solo error usa el singular', () => {
      expect(resumenDeErrores([error(0, 'texto')])).toBe('Hay 1 error. Revisa el elemento 1, campo Texto');
    });

    it('H2-E3: el primer error es el primero por orden de pantalla, aunque venga desordenado', () => {
      const errores = [error(3, 'texto'), error(1, 'imagen.alt')];
      expect(resumenDeErrores(errores)).toContain('Revisa el elemento 2, campo Texto alternativo');
    });

    it('H2-E3: un error de la imagen destacada (índice -1) se señala como tal y va primero', () => {
      const errores = [error(0, 'texto'), error(-1, 'imagen_destacada.alt')];
      expect(resumenDeErrores(errores)).toBe('Hay 2 errores. Revisa la imagen destacada, campo Texto alternativo');
    });
  });
});

// T019 (spec 005, contracts/atajos.md "Anuncios"; RF-006, RF-007, RF-008, RF-015, RF-019): mensajes del editor
// estilo documento. Se usa siempre «elemento» (o el tipo: «párrafo», «imagen»), nunca «bloque». Las funciones
// viejas (`etiquetaDeBloque`, `nombreDeBoton`, `anuncioDeMovimiento`, `anuncioDeQuitado`) siguen hasta T078.
// FASE ROJA: las funciones nuevas no existen en `./anuncios`. Firmas supuestas (posiciones desde 1):
//   anuncioInsertado(tipo: TipoVisible, posicion, total)      "Se insertó una imagen en la posición 3 de 8"
//   anuncioMovido(posicion, total)                           "Elemento movido a la posición 2 de 8"
//   anuncioDuplicado(posicion, total)                        "Elemento duplicado, posición 4 de 9"
//   anuncioQuitado(cantidad)                                 "Elemento quitado. Pulsa Ctrl+Z para deshacer" / "3 elementos quitados. …"
//   anuncioConvertido(nombre: string)                        "Se convirtió en título 2"
//   anuncioModoElementos(cantidad)                           "3 elementos seleccionados"
//   anuncioPegadoConSobrante(cantidad)                       "Se crearon 2 párrafos nuevos por el límite de caracteres"
//   anuncioDeAvisoDeLimite(quedan)                           "Quedan 500 caracteres (se cuentan las marcas de formato)"
//   anuncioDeLimiteAlcanzado()                               "Se alcanzó el máximo de caracteres del párrafo"
//   anuncioDeshacer(accion) / anuncioRehacer(accion)         "Se deshizo: mover elemento" / "Se rehízo: mover elemento"
//   anuncioSubidaEnCurso()                                   "Subiendo imagen… No se puede mover ni quitar hasta que termine"
describe('anuncios del editor estilo documento (spec 005)', () => {
  describe('insertar, mover y duplicar', () => {
    it.each([
      ['imagen', 'una imagen'],
      ['parrafo', 'un párrafo'],
      ['titulo', 'un título'],
      ['cita', 'una cita'],
      ['lista', 'una lista'],
      ['galeria', 'una galería'],
      ['cta', 'una llamada a la acción'],
      ['separador', 'un separador'],
      ['codigo', 'un código'],
      ['video', 'un video'],
    ] as const)('RF-005: insertar %s dice "Se insertó %s en la posición 3 de 8"', (tipo, articuloYNombre) => {
      expect(anuncioInsertado(tipo, 3, 8)).toBe(`Se insertó ${articuloYNombre} en la posición 3 de 8`);
    });

    it('RF-006: mover dice "Elemento movido a la posición 2 de 8"', () => {
      expect(anuncioMovido(2, 8)).toBe('Elemento movido a la posición 2 de 8');
    });

    it('RF-006: duplicar dice "Elemento duplicado, posición 4 de 9"', () => {
      expect(anuncioDuplicado(4, 9)).toBe('Elemento duplicado, posición 4 de 9');
    });
  });

  describe('quitar', () => {
    it('RF-006: con uno dice "Elemento quitado. Pulsa Ctrl+Z para deshacer"', () => {
      expect(anuncioQuitado(1)).toBe('Elemento quitado. Pulsa Ctrl+Z para deshacer');
    });

    it('RF-006: con varios cuenta cuántos ("3 elementos quitados…")', () => {
      expect(anuncioQuitado(3)).toBe('3 elementos quitados. Pulsa Ctrl+Z para deshacer');
    });
  });

  describe('convertir y modo elementos', () => {
    it('RF-007: convertir dice "Se convirtió en título 2"', () => {
      expect(anuncioConvertido('título 2')).toBe('Se convirtió en título 2');
    });

    it('RF-019: el modo elementos anuncia la cantidad ("3 elementos seleccionados")', () => {
      expect(anuncioModoElementos(3)).toBe('3 elementos seleccionados');
    });

    it('RF-019: con uno usa el singular', () => {
      expect(anuncioModoElementos(1)).toBe('1 elemento seleccionado');
    });
  });

  describe('pegado y límites', () => {
    it('RF-015: el pegado con sobrante dice cuántos párrafos nuevos se crearon', () => {
      expect(anuncioPegadoConSobrante(2)).toBe('Se crearon 2 párrafos nuevos por el límite de caracteres');
    });

    it('RF-014: al cruzar el 90 % avisa cuántos caracteres quedan y que se cuentan las marcas', () => {
      expect(anuncioDeAvisoDeLimite(500)).toBe('Quedan 500 caracteres (se cuentan las marcas de formato)');
    });

    it('RF-014: al 100 % dice que se alcanzó el máximo', () => {
      expect(anuncioDeLimiteAlcanzado()).toBe('Se alcanzó el máximo de caracteres del párrafo');
    });
  });

  describe('deshacer, rehacer y subida en curso', () => {
    it('RF-008: deshacer nombra la acción', () => {
      expect(anuncioDeshacer('mover elemento')).toBe('Se deshizo: mover elemento');
    });

    it('RF-008: rehacer nombra la acción', () => {
      expect(anuncioRehacer('mover elemento')).toBe('Se rehízo: mover elemento');
    });

    it('RF-006: la subida en curso avisa que no se puede mover ni quitar', () => {
      expect(anuncioSubidaEnCurso()).toBe('Subiendo imagen… No se puede mover ni quitar hasta que termine');
    });
  });

  describe('vocabulario: nunca «bloque»', () => {
    it('ninguna cadena nueva contiene la palabra «bloque»', () => {
      const mensajes = [
        ...TIPOS_VISIBLES.map((tipo) => anuncioInsertado(tipo, 1, 2)),
        anuncioMovido(1, 2),
        anuncioDuplicado(1, 2),
        anuncioQuitado(1),
        anuncioQuitado(4),
        anuncioConvertido('párrafo'),
        anuncioModoElementos(1),
        anuncioModoElementos(5),
        anuncioPegadoConSobrante(3),
        anuncioDeAvisoDeLimite(10),
        anuncioDeLimiteAlcanzado(),
        anuncioDeshacer('quitar elemento'),
        anuncioRehacer('quitar elemento'),
        anuncioSubidaEnCurso(),
      ];

      for (const mensaje of mensajes) expect(mensaje.toLowerCase(), mensaje).not.toContain('bloque');
    });

    it('«resumenDeErrores» dice «elemento», nunca «bloque»', () => {
      const resumen = resumenDeErrores([error(0, 'texto'), error(2, 'imagen.alt')]);

      expect(resumen).toContain('elemento');
      expect(resumen.toLowerCase()).not.toContain('bloque');
    });

    it('los nombres de tipo reutilizados no contienen «bloque»', () => {
      for (const tipo of TIPOS_VISIBLES) expect(nombreDeTipo(tipo).toLowerCase()).not.toContain('bloque');
    });
  });
});
