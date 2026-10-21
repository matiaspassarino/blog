import { redirect } from 'next/navigation';

// La entrada del panel es la lista de artículos; si no hay sesión, el proxy lleva al ingreso.
export default function Inicio() {
  redirect('/articulos');
}
