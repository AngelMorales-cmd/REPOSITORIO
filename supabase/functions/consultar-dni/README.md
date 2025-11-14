# Edge Function: consultar-dni

Esta función actúa como proxy para consultar datos de DNI en la API de RENIEC, evitando problemas de CORS.

## Configuración

1. Configura la variable de entorno `RENIEC_API_TOKEN` en el dashboard de Supabase:
   - Ve a Project Settings > Edge Functions > Secrets
   - Agrega: `RENIEC_API_TOKEN` = `sk_11556.LWHDdBdpMmEvp7SlJdBcFXGRAZX5A5Rc`

2. Despliega la función:
```bash
supabase functions deploy consultar-dni
```

## Uso

La función acepta el DNI como parámetro:
- Query parameter: `?numero=12345678`
- O en el body (POST): `{ "numero": "12345678" }`

## Respuesta

```json
{
  "success": true,
  "data": {
    "numero": "12345678",
    "nombres": "Juan",
    "apellidoPaterno": "Pérez",
    "apellidoMaterno": "García",
    ...
  }
}
```

