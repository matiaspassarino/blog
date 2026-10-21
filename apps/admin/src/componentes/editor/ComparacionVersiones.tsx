// Tu versión y la vigente, lado a lado (D13): dos columnas desde 1024 px, apiladas en pantallas angostas.
// Las diferencias se marcan con texto ("distinto"), no solo con color. Lo propio queda siempre a la vista
// y se puede copiar.
import { textoPlano } from '@blog/bloques';
import type { DatosArticulo } from './reductor';

function Columna({ rotulo, datos, otra }: { rotulo: string; datos: DatosArticulo; otra: DatosArticulo }) {
  const campos = [
    { nombre: 'Título', valor: datos.titulo, distinto: datos.titulo !== otra.titulo },
    { nombre: 'Extracto', valor: datos.extracto ?? '', distinto: (datos.extracto ?? '') !== (otra.extracto ?? '') },
    {
      nombre: 'Texto del contenido',
      valor: textoPlano(datos.contenido),
      distinto: textoPlano(datos.contenido) !== textoPlano(otra.contenido),
    },
  ];
  return (
    <div className="min-w-0 flex-1 rounded-md border border-borde p-4">
      <h3 className="font-titulos text-lg font-semibold">{rotulo}</h3>
      <dl className="mt-3 flex flex-col gap-3">
        {campos.map(({ nombre, valor, distinto }) => (
          <div key={nombre}>
            <dt className="text-sm font-semibold text-texto-suave">
              {nombre}
              {distinto && ' (distinto)'}
            </dt>
            <dd className="mt-1 break-words whitespace-pre-wrap select-text">{valor || 'Vacío'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ComparacionVersiones({ propia, vigente }: { propia: DatosArticulo; vigente: DatosArticulo }) {
  return (
    <section aria-labelledby="titulo-comparacion" className="flex flex-col gap-3">
      <h2 id="titulo-comparacion" className="font-titulos text-xl font-semibold">
        Comparar versiones
      </h2>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Columna rotulo="Tu versión" datos={propia} otra={vigente} />
        <Columna rotulo="Versión vigente" datos={vigente} otra={propia} />
      </div>
    </section>
  );
}
