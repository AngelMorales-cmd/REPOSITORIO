import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RENIEC_API_URL = "https://api.decolecta.com/v1/reniec/dni";
const RENIEC_API_TOKEN = Deno.env.get("RENIEC_API_TOKEN") || "sk_11556.LWHDdBdpMmEvp7SlJdBcFXGRAZX5A5Rc";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // Manejar CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    let dni: string | null = null;

    // Intentar obtener el DNI del body primero (si se llama desde supabase.functions.invoke)
    if (req.method === "POST") {
      try {
        const body = await req.json();
        dni = body.numero || body.dni;
      } catch {
        // Si no hay body JSON, continuar con query params
      }
    }

    // Si no se obtuvo del body, obtener de los query parameters
    if (!dni) {
      const url = new URL(req.url);
      dni = url.searchParams.get("numero") || url.searchParams.get("dni");
    }

    if (!dni) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "El parámetro 'numero' (DNI) es requerido" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (dni.length !== 8) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "El DNI debe tener 8 dígitos" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Hacer la petición a la API de RENIEC
    const response = await fetch(`${RENIEC_API_URL}?numero=${dni}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RENIEC_API_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // Si no se puede parsear el error, usar el mensaje por defecto
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          message: "Error al consultar el DNI en RENIEC",
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let responseData: any;
    try {
      responseData = await response.json();
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error al procesar la respuesta de RENIEC",
          message: "La respuesta no es un JSON válido",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // La API puede devolver los datos directamente o dentro de un objeto 'data'
    const data = responseData.data || responseData;

    // Validar que tenemos los datos mínimos
    if (!data || (!data.nombres && !data.nombre) || (!data.apellidoPaterno && !data.apellido_paterno)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Datos incompletos del DNI",
          message: "No se pudieron obtener todos los datos necesarios de RENIEC",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalizar los nombres de campos
    const normalizedData = {
      numero: data.numero || dni,
      nombres: data.nombres || data.nombre || "",
      apellidoPaterno: data.apellidoPaterno || data.apellido_paterno || "",
      apellidoMaterno: data.apellidoMaterno || data.apellido_materno || "",
      codVerifica: data.codVerifica || data.cod_verifica,
      fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || data.fechaNac,
      sexo: data.sexo || data.genero,
      estadoCivil: data.estadoCivil || data.estado_civil,
      direccion: data.direccion || data.direccion_completa,
      ubigeo: data.ubigeo,
      distrito: data.distrito,
      provincia: data.provincia,
      departamento: data.departamento,
      foto: data.foto || data.photo_url || data.foto_url,
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: normalizedData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en consultar-dni:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        message: "Error al conectar con el servicio de RENIEC",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

