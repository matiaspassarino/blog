// Tipos de dominio derivados del esquema generado, compartidos por las consultas.
import type { Database } from './tipos';

type Enums = Database['public']['Enums'];

export type TipoEntidad = Enums['tipo_entidad'];
export type EstadoArticulo = Enums['estado_articulo'];
export type RolMiembro = Enums['rol_miembro'];
