// Vercel Serverless Function para proxy de RENIEC
// Esta función actúa como proxy para evitar problemas de CORS en producción

const RENIEC_API_URL = "https://api.decolecta.com/v1/reniec/dni";
const RENIEC_API_TOKEN = process.env.RENIEC_API_TOKEN || "sk_11556.LWHDdBdpMmEvp7SlJdBcFXGRAZX5A5Rc";

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const dni = req.query.numero;

    if (!dni) {
      return res.status(400).json({
        success: false,
        error: "El parámetro 'numero' (DNI) es requerido",
      });
    }

    if (dni.length !== 8) {
      return res.status(400).json({
        success: false,
        error: "El DNI debe tener 8 dígitos",
      });
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

      return res.status(response.status).json({
        success: false,
        error: errorMessage,
        message: "Error al consultar el DNI en RENIEC",
      });
    }

    // Verificar que la respuesta sea JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Respuesta no es JSON:", text.substring(0, 200));
      return res.status(500).json({
        success: false,
        error: "La respuesta del servidor no es JSON válido",
        message: "Error al procesar la respuesta de RENIEC",
      });
    }

    const responseData = await response.json();
    
    // Devolver los datos directamente
    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error en proxy RENIEC:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error desconocido",
      message: "Error al conectar con el servicio de RENIEC",
    });
  }
}

