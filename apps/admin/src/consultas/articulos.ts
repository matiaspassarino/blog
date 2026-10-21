// Lecturas de la lista de artículos para la página del panel. El acceso a datos sigue en @blog/db (§III.2).
import { listarArticulosPanel, listarAutores, listarCategoriasPanel, type FiltrosPanel } from '@blog/db';
import { crearClienteDeSesion } from '../lib/supabase';

/**
 * La página pedida y lo que los filtros necesitan para mostrarse (categorías y autores). Una página fuera de
 * rango vuelve a la primera: quien comparte una dirección vieja ve resultados, no una lista vacía.
 */
export async function listarArticulosDelPanel(filtros: FiltrosPanel) {
  const cliente = await crearClienteDeSesion();

  let pagina = await listarArticulosPanel(cliente, filtros);
  if (pagina.items.length === 0 && pagina.total > 0 && (filtros.pagina ?? 1) > 1) {
    pagina = await listarArticulosPanel(cliente, { ...filtros, pagina: 1 });
  }

  const [categorias, autores] = await Promise.all([listarCategoriasPanel(cliente), listarAutores(cliente)]);
  return { pagina, categorias, autores };
}
