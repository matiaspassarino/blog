// Límites de caracteres y elementos en el editor (spec 005, Fase 14, Historia 4; contracts/atajos.md "Límite de caracteres" y CE-006).
// Controla el conteo de caracteres sin marcas, los avisos al cruzar 90% y 100%, y el máximo de 200 elementos.

export const MAXIMO_ELEMENTOS_DOCUMENTO = 200;

export const LIMITES_ELEMENTO: Record<string, number> = {
  paragraph: 5000,
  heading: 150,
  blockquote: 1000,
  listItem: 500,
  codeBlock: 20000,
  tableCell: 1000,
  tableHeader: 1000,
};

const NOMBRES_TIPO_LIMITE: Record<string, string> = {
  paragraph: 'párrafo',
  heading: 'título',
  blockquote: 'cita',
  listItem: 'ítem',
  codeBlock: 'bloque de código',
  tableCell: 'celda',
  tableHeader: 'celda',
};

/**
 * Cuenta la cantidad de caracteres de texto visible sin contar marcas de formato.
 */
export function contarCaracteresTexto(entrada: unknown): number {
  if (typeof entrada === 'string') {
    return entrada.length;
  }

  if (Array.isArray(entrada)) {
    return entrada.reduce((total, item) => total + contarCaracteresTexto(item), 0);
  }

  if (entrada && typeof entrada === 'object') {
    const nodo = entrada as { text?: string; content?: unknown[] };
    if (typeof nodo.text === 'string') {
      return nodo.text.length;
    }
    if (Array.isArray(nodo.content)) {
      return contarCaracteresTexto(nodo.content);
    }
  }

  return 0;
}

/**
 * Determina el aviso correspondiente si el conteo cruza el 90 % o el 100 % del límite.
 */
export function calcularAvisoLimite(tipo: string, caracteres: number): string | null {
  const limite = LIMITES_ELEMENTO[tipo];
  if (!limite) return null;

  if (caracteres >= limite) {
    const nombre = NOMBRES_TIPO_LIMITE[tipo] ?? 'elemento';
    const articulo = ['cita', 'celda'].includes(nombre) ? 'de la' : 'del';
    return `Se alcanzó el máximo de caracteres ${articulo} ${nombre}`;
  }

  const umbral90 = Math.floor(limite * 0.9);
  if (caracteres >= umbral90) {
    const restantes = limite - caracteres;
    return `Quedan ${restantes} ${restantes === 1 ? 'carácter' : 'caracteres'}`;
  }

  return null;
}

type EstadoElemento = {
  aviso90Emitido: boolean;
  aviso100Emitido: boolean;
};

/**
 * Rastrea los avisos emitidos por elemento para no repetir anuncios en cada pulsación de tecla.
 */
export class RastreadorDeAvisosLimite {
  private estados = new Map<string, EstadoElemento>();

  verificar(id: string, tipo: string, caracteres: number): string | null {
    const limite = LIMITES_ELEMENTO[tipo];
    if (!limite) return null;

    let estado = this.estados.get(id);
    if (!estado) {
      estado = { aviso90Emitido: false, aviso100Emitido: false };
      this.estados.set(id, estado);
    }

    const umbral90 = Math.floor(limite * 0.9);

    if (caracteres < umbral90) {
      // Si baja del 90%, se reinician los avisos para volver a alertar si vuelve a subir
      estado.aviso90Emitido = false;
      estado.aviso100Emitido = false;
      return null;
    }

    if (caracteres >= limite) {
      if (!estado.aviso100Emitido) {
        estado.aviso100Emitido = true;
        const nombre = NOMBRES_TIPO_LIMITE[tipo] ?? 'elemento';
        const articulo = ['cita', 'celda'].includes(nombre) ? 'de la' : 'del';
        return `Se alcanzó el máximo de caracteres ${articulo} ${nombre}`;
      }
      return null;
    }

    // Entre 90% y 100%
    if (!estado.aviso90Emitido) {
      estado.aviso90Emitido = true;
      const restantes = limite - caracteres;
      return `Quedan ${restantes} ${restantes === 1 ? 'carácter' : 'caracteres'}`;
    }

    return null;
  }

  limpiar(id: string): void {
    this.estados.delete(id);
  }
}

/**
 * Verifica si se pueden agregar más elementos sin superar el tope de 200.
 */
export function puedeAgregarElemento(
  totalActual: number,
  opciones?: {
    agregar?: number;
    alRechazar?: (mensaje: string) => void;
  },
): boolean {
  const cantidad = opciones?.agregar ?? 1;
  if (totalActual + cantidad > MAXIMO_ELEMENTOS_DOCUMENTO) {
    opciones?.alRechazar?.(`Se alcanzó el máximo de ${MAXIMO_ELEMENTOS_DOCUMENTO} elementos`);
    return false;
  }
  return true;
}
