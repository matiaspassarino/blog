// Verificación del aviso firmado de la base (specs/002-sitio-publico/research.md D4; contrato de
// la 001, contracts/revalidacion.md). Se firma el texto crudo: el cuerpo se verifica antes de
// parsearlo. Nunca lanza.
import { createHmac, timingSafeEqual } from 'node:crypto';

const VENTANA_SEGUNDOS = 300;
const PREFIJO = 'sha256=';

type Aviso = {
  /** Cuerpo crudo de la petición. */
  cuerpo: string;
  /** Header X-Blog-Marca-Tiempo (segundos epoch). */
  marca: string | null;
  /** Header X-Blog-Firma completo: `sha256=<hex>`. */
  firma: string | null;
  secreto: string;
  /** Milisegundos epoch (Date.now()). */
  ahora: number;
};

export function verificarAviso({ cuerpo, marca, firma, secreto, ahora }: Aviso): boolean {
  if (!marca || !/^\d+$/.test(marca) || !firma?.startsWith(PREFIJO)) return false;
  if (Math.abs(ahora / 1000 - Number(marca)) > VENTANA_SEGUNDOS) return false;

  const recibida = firma.slice(PREFIJO.length);
  // Exactamente 64 hex: Buffer.from(hex) ignora un dígito impar final y aceptaría la firma
  // correcta con un carácter de más.
  if (!/^[0-9a-f]{64}$/i.test(recibida)) return false;
  const esperada = createHmac('sha256', secreto).update(`${marca}.${cuerpo}`).digest();
  const bytesRecibidos = Buffer.from(recibida, 'hex');
  // timingSafeEqual exige el mismo largo: se compara antes para no lanzar.
  return bytesRecibidos.length === esperada.length && timingSafeEqual(bytesRecibidos, esperada);
}
