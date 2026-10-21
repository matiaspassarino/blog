// T059 y T061 (spec 003, H2-E2, E3, CE-006): textos accesibles del editor, como funciones puras.
// FASE ROJA: `./anuncios` no existe. Propuesta de firmas para T059/T061 (los textos salen de tasks.md):
//   nombreDeTipo(tipo: TipoBloque): string                         'parrafo' -> 'párrafo', 'cta' -> 'llamada a la acción'
//   etiquetaDeBloque(posicion: number, tipo): string                "Bloque 2: párrafo"        (posición 1-based)
//   nombreDeBoton(accion: 'subir' | 'bajar' | 'duplicar' | 'quitar', posicion, tipo): string
//                                                                   "Subir bloque 2, párrafo"
//   anuncioDeMovimiento(tipo, posicion, total): string              "Párrafo movido a la posición 2 de 5"
//   anuncioDeQuitado(posicion, tipo, quedan): string                "Bloque 3, párrafo, eliminado. Quedan 4 bloques"
//   nombreDeCampo(campo: string): string                            'imagen.alt' -> 'Texto alternativo'
//   resumenDeErrores(errores: ErrorBloque[]): string                "Hay 3 errores. Revisa el bloque 2, campo Texto alternativo"
//     (el "primer" error es el primero por orden de pantalla: la imagen destacada, indice -1, va antes que los bloques;
//      los índices de `ErrorBloque` son 0-based y se muestran 1-based)
import { TIPOS_BLOQUE, type ErrorBloque } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import {
  anuncioDeMovimiento,
  anuncioDeQuitado,
  etiquetaDeBloque,
  nombreDeBoton,
  nombreDeCampo,
  nombreDeTipo,
  resumenDeErrores,
} from './anuncios';

const error = (indice: number, campo: string): ErrorBloque => ({ indice, campo, mensaje: 'mensaje' });

describe('textos accesibles del editor (H2)', () => {
  describe('nombreDeTipo', () => {
    it('da un nombre en español, con tildes, para cada uno de los 10 tipos', () => {
      expect(TIPOS_BLOQUE.map((tipo) => nombreDeTipo(tipo))).toEqual([
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

  describe('etiquetas de bloque y botones', () => {
    it('CE-006: el grupo del bloque se llama "Bloque 2: párrafo"', () => {
      expect(etiquetaDeBloque(2, 'parrafo')).toBe('Bloque 2: párrafo');
    });

    it('CE-006: cada botón incluye la acción, la posición y el tipo', () => {
      expect(nombreDeBoton('subir', 2, 'parrafo')).toBe('Subir bloque 2, párrafo');
      expect(nombreDeBoton('bajar', 1, 'galeria')).toBe('Bajar bloque 1, galería');
      expect(nombreDeBoton('duplicar', 4, 'cta')).toBe('Duplicar bloque 4, llamada a la acción');
      expect(nombreDeBoton('quitar', 3, 'imagen')).toBe('Quitar bloque 3, imagen');
    });
  });

  describe('anuncios de la región role="status"', () => {
    it('anuncia el movimiento con la nueva posición y el total', () => {
      expect(anuncioDeMovimiento('parrafo', 2, 5)).toBe('Párrafo movido a la posición 2 de 5');
    });

    it('anuncia el borrado con cuántos bloques quedan', () => {
      expect(anuncioDeQuitado(3, 'parrafo', 4)).toBe('Bloque 3, párrafo, eliminado. Quedan 4 bloques');
    });

    it('usa el singular y el caso vacío al quitar', () => {
      expect(anuncioDeQuitado(2, 'cita', 1)).toBe('Bloque 2, cita, eliminado. Queda 1 bloque');
      expect(anuncioDeQuitado(1, 'separador', 0)).toBe('Bloque 1, separador, eliminado. No quedan bloques');
    });
  });

  describe('errores', () => {
    it('H2-E3: nombra el campo con palabras de la persona, no con el nombre técnico', () => {
      expect(nombreDeCampo('imagen.alt')).toBe('Texto alternativo');
      expect(nombreDeCampo('texto')).toBe('Texto');
    });

    it('H2-E3: el resumen cuenta los errores y señala el primero (índice mostrado desde 1)', () => {
      const errores = [error(1, 'imagen.alt'), error(2, 'texto'), error(4, 'texto')];
      expect(resumenDeErrores(errores)).toBe('Hay 3 errores. Revisa el bloque 2, campo Texto alternativo');
    });

    it('H2-E3: con un solo error usa el singular', () => {
      expect(resumenDeErrores([error(0, 'texto')])).toBe('Hay 1 error. Revisa el bloque 1, campo Texto');
    });

    it('H2-E3: el primer error es el primero por orden de pantalla, aunque venga desordenado', () => {
      const errores = [error(3, 'texto'), error(1, 'imagen.alt')];
      expect(resumenDeErrores(errores)).toContain('Revisa el bloque 2, campo Texto alternativo');
    });

    it('H2-E3: un error de la imagen destacada (índice -1) se señala como tal y va primero', () => {
      const errores = [error(0, 'texto'), error(-1, 'imagen_destacada.alt')];
      expect(resumenDeErrores(errores)).toBe('Hay 2 errores. Revisa la imagen destacada, campo Texto alternativo');
    });
  });
});
