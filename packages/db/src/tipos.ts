
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "articulos": {
                  Row: {
                    "actualizado_en": string,"autor_id": string,"categoria_id": string | null,"contenido": NonNullable<Json>,"creado_en": string,"descripcion_seo": string | null,"estado": Database["public"]['Enums']["estado_articulo"],"extracto": string | null,"id": string,"imagen_destacada": Json | null,"programado_para": string | null,"publicado_en": string | null,"slug": string,"titulo": string,"titulo_seo": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"autor_id"?: string,"categoria_id"?: string | null,"contenido"?: NonNullable<Json>,"creado_en"?: string,"descripcion_seo"?: string | null,"estado"?: Database["public"]['Enums']["estado_articulo"],"extracto"?: string | null,"id"?: string,"imagen_destacada"?: Json | null,"programado_para"?: string | null,"publicado_en"?: string | null,"slug"?: string,"titulo": string,"titulo_seo"?: string | null,"version"?: number
                  }
                  Update: {
                    "actualizado_en"?: string,"autor_id"?: string,"categoria_id"?: string | null,"contenido"?: NonNullable<Json>,"creado_en"?: string,"descripcion_seo"?: string | null,"estado"?: Database["public"]['Enums']["estado_articulo"],"extracto"?: string | null,"id"?: string,"imagen_destacada"?: Json | null,"programado_para"?: string | null,"publicado_en"?: string | null,"slug"?: string,"titulo"?: string,"titulo_seo"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "articulos_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "autores_publicos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "articulos_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "articulos_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["id"]
    }
                  ]
                },"articulos_etiquetas": {
                  Row: {
                    "articulo_id": string,"etiqueta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "articulo_id": string,"etiqueta_id": string
                  }
                  Update: {
                    "articulo_id"?: string,"etiqueta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "articulos_etiquetas_articulo_id_fkey"
      columns: ["articulo_id"]
isOneToOne: false
      referencedRelation: "articulos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "articulos_etiquetas_etiqueta_id_fkey"
      columns: ["etiqueta_id"]
isOneToOne: false
      referencedRelation: "etiquetas"
      referencedColumns: ["id"]
    }
                  ]
                },"categorias": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"descripcion": string | null,"id": string,"nombre": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"nombre": string,"slug"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"nombre"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"etiquetas": {
                  Row: {
                    "actualizado_en": string,"creado_en": string,"descripcion": string | null,"id": string,"nombre": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado_en"?: string,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"nombre": string,"slug"?: string
                  }
                  Update: {
                    "actualizado_en"?: string,"creado_en"?: string,"descripcion"?: string | null,"id"?: string,"nombre"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"perfiles": {
                  Row: {
                    "activo": boolean,"actualizado_en": string,"avatar": Json | null,"biografia": string | null,"creado_en": string,"id": string,"nombre": string,"rol": Database["public"]['Enums']["rol_miembro"],"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"actualizado_en"?: string,"avatar"?: Json | null,"biografia"?: string | null,"creado_en"?: string,"id": string,"nombre": string,"rol"?: Database["public"]['Enums']["rol_miembro"],"slug"?: string
                  }
                  Update: {
                    "activo"?: boolean,"actualizado_en"?: string,"avatar"?: Json | null,"biografia"?: string | null,"creado_en"?: string,"id"?: string,"nombre"?: string,"rol"?: Database["public"]['Enums']["rol_miembro"],"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"redirecciones": {
                  Row: {
                    "creado_en": string,"entidad_id": string,"id": string,"slug_anterior": string,"tipo_entidad": Database["public"]['Enums']["tipo_entidad"]
                  }
                  ComputedFields: never
                  Insert: {
                    "creado_en"?: string,"entidad_id": string,"id"?: string,"slug_anterior": string,"tipo_entidad": Database["public"]['Enums']["tipo_entidad"]
                  }
                  Update: {
                    "creado_en"?: string,"entidad_id"?: string,"id"?: string,"slug_anterior"?: string,"tipo_entidad"?: Database["public"]['Enums']["tipo_entidad"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "autores_publicos": {
                  Row: {
                    "actualizado_en": string | null,"avatar": Json | null,"biografia": string | null,"id": string | null,"nombre": string | null,"slug": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "actualizado_en"?: string | null,"avatar"?: Json | null,"biografia"?: string | null,"id"?: string | null,"nombre"?: string | null,"slug"?: string | null
                         }
                        Update: {
                           "actualizado_en"?: string | null,"avatar"?: Json | null,"biografia"?: string | null,"id"?: string | null,"nombre"?: string | null,"slug"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "asignar_etiquetas":
{ Args: { "articulo_id": string,"etiqueta_ids": (string)[],"version": number }; Returns: number
                           },
"entradas_sitemap":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"previsualizar_slug":
{ Args: { "texto": string,"tipo": Database["public"]['Enums']["tipo_entidad"] }; Returns: string
                           },
"resolver_redireccion":
{ Args: { "slug": string,"tipo": Database["public"]['Enums']["tipo_entidad"] }; Returns: string
                           }
          }
          Enums: {
            "estado_articulo": "borrador"|"programado"|"publicado"|"archivado","rol_miembro": "admin"|"editor","tipo_entidad": "articulo"|"categoria"|"etiqueta"|"autor"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "estado_articulo": ["borrador", "programado", "publicado", "archivado"],"rol_miembro": ["admin", "editor"],"tipo_entidad": ["articulo", "categoria", "etiqueta", "autor"]
          }
        }
} as const
