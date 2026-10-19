// Solo para tests: firma un aviso igual que la base (privado.notificar_cambio_publico).
import { createHmac } from 'node:crypto';

export function firmarAviso(cuerpo: string, marca: string | number, secreto: string) {
  return 'sha256=' + createHmac('sha256', secreto).update(`${marca}.${cuerpo}`).digest('hex');
}
