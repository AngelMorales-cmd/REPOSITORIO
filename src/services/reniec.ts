// Detectar si estamos en desarrollo o producción
const IS_DEV = import.meta.env.DEV;
const USE_PROXY = true; // Usar proxy para evitar CORS
// En desarrollo usa el proxy de Vite, en producción usa la función serverless de Vercel
const PROXY_URL = IS_DEV ? "/api/reniec" : "/api/reniec";

export interface ReniecData {
  numero: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  codVerifica?: string;
  fechaNacimiento?: string;
  sexo?: string;
  estadoCivil?: string;
  direccion?: string;
  ubigeo?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  foto?: string;
}

export interface ReniecResponse {
  success: boolean;
  data?: ReniecData;
  message?: string;
  error?: string;
}

/**
 * Consulta los datos de un DNI en la API de RENIEC
 * @param dni - Número de DNI (8 dígitos)
 * @returns Datos del DNI o error
 */
export async function consultarDNI(dni: string): Promise<ReniecResponse> {
  try {
    if (dni.length !== 8) {
      return {
        success: false,
        error: "El DNI debe tener 8 dígitos",
      };
    }

    let responseData: any;

    if (USE_PROXY) {
      // Usar proxy local (Vite en desarrollo o servidor proxy en producción)
      try {
        const proxyUrl = `${PROXY_URL}?numero=${dni}`;
        
        const response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          let errorMessage = `Error ${response.status}: ${response.statusText}`;
          try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
            } else {
              // Si la respuesta no es JSON, puede ser HTML (página de error)
              const text = await response.text();
              console.error("Respuesta de error no es JSON:", text.substring(0, 200));
              errorMessage = `Error ${response.status}: La respuesta no es válida`;
            }
          } catch (parseError) {
            console.error("Error parseando respuesta de error:", parseError);
            // Si no se puede parsear el error, usar el mensaje por defecto
          }
          
          return {
            success: false,
            error: errorMessage,
            message: "Error al consultar el DNI en RENIEC",
          };
        }

        // Verificar que la respuesta sea JSON antes de parsear
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.error("Respuesta no es JSON:", text.substring(0, 200));
          return {
            success: false,
            error: "La respuesta del servidor no es JSON válido",
            message: "Error al procesar la respuesta de RENIEC. Verifica que el proxy esté funcionando correctamente.",
          };
        }

        // El proxy devuelve los datos directamente de la API
        responseData = await response.json();
        
        // Procesar la respuesta del proxy
        const data: ReniecData = responseData.data || responseData;

        // Validar que tenemos los datos mínimos
        // La API de Decolecta devuelve: first_name, first_last_name, second_last_name, full_name, document_number
        const tieneNombres = data?.first_name || data?.full_name || data?.nombres || data?.nombre;
        const tieneApellidoPaterno = data?.first_last_name || data?.apellidoPaterno || data?.apellido_paterno;
        
        if (!data || !tieneNombres || !tieneApellidoPaterno) {
          console.error("=== DIAGNÓSTICO ===");
          console.error("Datos recibidos:", data);
          console.error("Tiene nombres:", tieneNombres);
          console.error("Tiene apellido paterno:", tieneApellidoPaterno);
          return {
            success: false,
            error: "Datos incompletos del DNI",
            message: "No se pudieron obtener todos los datos necesarios de RENIEC. Por favor, verifica que el DNI sea válido.",
          };
        }

        // Normalizar los nombres de campos según el formato de la API de Decolecta
        // La API devuelve: first_name, first_last_name, second_last_name, full_name, document_number
        // Nota: La API básica puede no devolver todos los campos (dirección, distrito, etc.)
        const normalizedData: ReniecData = {
          numero: data.document_number || data.numero || data.dni || dni,
          nombres: data.first_name || data.nombres || data.nombre || "",
          apellidoPaterno: data.first_last_name || data.apellidoPaterno || data.apellido_paterno || "",
          apellidoMaterno: data.second_last_name || data.apellidoMaterno || data.apellido_materno || "",
          codVerifica: data.codVerifica || data.cod_verifica || data.codigo_verificacion,
          fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || data.birth_date || data.fecha_nac || data.nacimiento || data.birthdate,
          sexo: data.sexo || data.genero || data.gender || data.sex,
          estadoCivil: data.estadoCivil || data.estado_civil || data.marital_status || data.estado || data.maritalStatus,
          direccion: data.direccion || data.direccion_completa || data.address || data.domicilio || data.direccion_actual || data.direccion_completa || data.residence_address || null,
          ubigeo: data.ubigeo || data.codigo_ubigeo || data.ubigeo_code || data.ubigeoCode || null,
          distrito: data.distrito || data.distrito_nombre || data.district || data.district_name || data.districtName || null,
          provincia: data.provincia || data.provincia_nombre || data.province || data.province_name || data.provinceName || null,
          departamento: data.departamento || data.departamento_nombre || data.department || data.department_name || data.departmentName || data.region || null,
          foto: data.foto || data.photo_url || data.foto_url || data.photo || data.imagen || data.foto_dni || data.image_url || data.photoUrl || null,
        };

        return {
          success: true,
          data: normalizedData,
        };
      } catch (fetchError) {
        console.error("Error usando proxy:", fetchError);
        return {
          success: false,
          error: fetchError instanceof Error ? fetchError.message : "Error desconocido",
          message: "Error al conectar con el servicio de RENIEC",
        };
      }
    } else {
      // Fallback: Llamada directa a la API (tendrá problemas de CORS en el navegador)
      const RENIEC_API_URL = "https://api.decolecta.com/v1/reniec/dni";
      const RENIEC_API_TOKEN = "sk_11556.LWHDdBdpMmEvp7SlJdBcFXGRAZX5A5Rc";

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
        
        return {
          success: false,
          error: errorMessage,
          message: "Error al consultar el DNI en RENIEC",
        };
      }

      responseData = await response.json();
    }

      // Procesar la respuesta (solo si no se procesó antes)
      if (responseData && !USE_PROXY) {
        // La API puede devolver los datos directamente o dentro de un objeto 'data'
        const data: ReniecData = responseData.data || responseData;

        // Log para debug
        console.log("Respuesta de la API (directa):", data);

        // Validar que tenemos los datos mínimos (más flexible)
        const tieneNombres = data?.nombres || data?.nombre || data?.nombres_completos;
        const tieneApellidoPaterno = data?.apellidoPaterno || data?.apellido_paterno || data?.apellido_p;
        
        if (!data || !tieneNombres || !tieneApellidoPaterno) {
          console.error("Datos recibidos:", data);
          return {
            success: false,
            error: "Datos incompletos del DNI",
            message: "No se pudieron obtener todos los datos necesarios de RENIEC. Por favor, verifica que el DNI sea válido.",
          };
        }

        // Normalizar los nombres de campos (más variantes posibles)
        const normalizedData: ReniecData = {
          numero: data.numero || data.dni || dni,
          nombres: data.nombres || data.nombre || data.nombres_completos || data.primer_nombre || "",
          apellidoPaterno: data.apellidoPaterno || data.apellido_paterno || data.apellido_p || data.paterno || "",
          apellidoMaterno: data.apellidoMaterno || data.apellido_materno || data.apellido_m || data.materno || "",
          codVerifica: data.codVerifica || data.cod_verifica || data.codigo_verificacion,
          fechaNacimiento: data.fechaNacimiento || data.fecha_nacimiento || data.fechaNac || data.fecha_nac || data.nacimiento,
          sexo: data.sexo || data.genero || data.gender,
          estadoCivil: data.estadoCivil || data.estado_civil || data.estado,
          direccion: data.direccion || data.direccion_completa || data.domicilio || data.direccion_actual,
          ubigeo: data.ubigeo || data.codigo_ubigeo,
          distrito: data.distrito || data.distrito_nombre,
          provincia: data.provincia || data.provincia_nombre,
          departamento: data.departamento || data.departamento_nombre || data.region,
          foto: data.foto || data.photo_url || data.foto_url || data.imagen || data.foto_dni,
        };

      return {
        success: true,
        data: normalizedData,
      };
    }

    // Si llegamos aquí, algo salió mal
    return {
      success: false,
      error: "Error desconocido al procesar la respuesta",
      message: "No se pudo procesar la respuesta del servidor",
    };
  } catch (error) {
    console.error("Error consultando DNI:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      message: "Error al conectar con el servicio de RENIEC",
    };
  }
}

/**
 * Convierte los datos de RENIEC al formato de la base de datos
 */
export function convertirDatosReniec(dni: string, reniecData: ReniecData) {
  // Si tenemos full_name de la API, usarlo directamente, sino construir el nombre
  // La API de Decolecta puede devolver full_name en formato "SAAVEDRA PEREZ ADRIAN"
  // Necesitamos convertirlo a "ADRIAN SAAVEDRA PEREZ" (nombres apellidos)
  let fullName: string;
  
  if (reniecData.nombres && reniecData.apellidoPaterno) {
    // Construir nombre completo desde los campos individuales
    fullName = `${reniecData.nombres} ${reniecData.apellidoPaterno} ${reniecData.apellidoMaterno || ""}`.trim();
  } else {
    // Si no tenemos los campos individuales, usar un valor por defecto
    fullName = reniecData.nombres || "Nombre no disponible";
  }
  
  // Convertir fecha de nacimiento si existe
  let birthDate = "1990-01-01"; // Fecha por defecto
  if (reniecData.fechaNacimiento) {
    // La fecha puede venir en formato DD/MM/YYYY o YYYY-MM-DD
    const dateStr = reniecData.fechaNacimiento;
    if (dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/");
      birthDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    } else {
      birthDate = dateStr;
    }
  }

  // Asegurarse de que todos los campos requeridos tengan valores válidos
  return {
    dni: dni || "",
    full_name: fullName || "Nombre no disponible",
    address: reniecData.direccion || "No especificada",
    district: reniecData.distrito || "No especificado",
    province: reniecData.provincia || "No especificado",
    department: reniecData.departamento || "No especificado",
    birth_date: birthDate || "1990-01-01",
    photo_url: reniecData.foto || null,
  };
}

