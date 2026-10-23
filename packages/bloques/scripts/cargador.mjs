// Node 24 ejecuta TypeScript, pero exige la extensión en los `import` y el paquete no la usa: este cargador resuelve
// un import relativo sin extensión al archivo `.ts` (research D31, C8 y C9). Solo lo usa `convertir-contenido`.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(especificador, contexto, siguiente) {
    try {
      return siguiente(especificador, contexto);
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !/^\.\.?\//.test(especificador)) throw error;
      return siguiente(`${especificador}.ts`, contexto);
    }
  },
});
