// Ayudas de los tests del renderer del documento (T095, spec 005). Solo para tests. Separadas de `ayudas-prueba.tsx`
// mientras exista `<Bloques>` (T104 elimina el renderer anterior y puede unirlas).
//
// Firma propuesta (T104), exportada desde './Documento' y desde './index':
//   Documento({ contenido, componentes }: { contenido: Documento; componentes: ComponentesDocumento }): ReactNode
//   type ComponentesDocumento = { Imagen: (props: PropsImagen) => ReactNode }   (reemplaza a ComponentesBloques)
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Documento as TipoDocumento } from '../esquema';
import { nodo, type NodoPrueba } from '../pruebas/corpus-documento';
import { ImagenPrueba } from './ayudas-prueba';
import { Documento } from './Documento';
import type { PropsImagen } from './tipos';

/**
 * Arma un documento a mano, sin pasar por el esquema: así se prueban también datos que una validación anterior
 * podría haber dejado pasar (RF-003).
 */
export const documentoDe = (...elementos: NodoPrueba[]) => nodo.doc(...elementos) as unknown as TipoDocumento;

/** HTML estático de `<Documento>` con la imagen de prueba (o la que se pase). */
export function renderizarDocumento(
  contenido: TipoDocumento,
  Imagen: (props: PropsImagen) => ReactNode = ImagenPrueba,
) {
  return renderToStaticMarkup(<Documento contenido={contenido} componentes={{ Imagen }} />);
}

/** Atajo: el HTML de un documento con estos elementos. */
export const renderizarElementos = (...elementos: NodoPrueba[]) => renderizarDocumento(documentoDe(...elementos));
