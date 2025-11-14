import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { consultarDNI, convertirDatosReniec } from "@/services/reniec";

const Home = () => {
  const navigate = useNavigate();
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDniSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (dni.length !== 8) {
      toast.error("El DNI debe tener 8 dígitos");
      return;
    }

    setLoading(true);
    try {
      // Consultar DNI en la API de RENIEC
      toast.info("Consultando datos en RENIEC...");
      const reniecResponse = await consultarDNI(dni);

      if (!reniecResponse.success || !reniecResponse.data) {
        toast.error(reniecResponse.error || "DNI no encontrado en RENIEC");
        return;
      }

      // Convertir datos de RENIEC al formato de la base de datos
      const voterData = convertirDatosReniec(dni, reniecResponse.data);
      
      // Log para debug
      console.log("Datos del votante a insertar:", voterData);

      // Verificar si el votante ya existe en la base de datos
      const { data: existingVoter, error: selectError } = await supabase
        .from("voters")
        .select("*")
        .eq("dni", dni)
        .maybeSingle();
      
      if (selectError && selectError.code !== 'PGRST116') {
        console.error("Error consultando votante:", selectError);
      }

      let finalVoterData;

      if (existingVoter) {
        // Actualizar datos del votante existente (por si cambió algo)
        const { data: updatedData, error: updateError } = await supabase
          .from("voters")
          .update({
            full_name: voterData.full_name,
            address: voterData.address,
            district: voterData.district,
            province: voterData.province,
            department: voterData.department,
            birth_date: voterData.birth_date,
            photo_url: voterData.photo_url,
          })
          .eq("dni", dni)
          .select()
          .single();

        if (updateError) {
          console.error("Error actualizando votante:", updateError);
          // Continuar con los datos existentes si falla la actualización
          finalVoterData = existingVoter;
        } else {
          finalVoterData = updatedData;
        }
      } else {
        // Crear nuevo votante en la base de datos
        // Asegurarse de que todos los campos requeridos estén presentes
        const dataToInsert = {
          dni: voterData.dni,
          full_name: voterData.full_name || "Nombre no disponible",
          address: voterData.address || "No especificada",
          district: voterData.district || "No especificado",
          province: voterData.province || "No especificado",
          department: voterData.department || "No especificado",
          birth_date: voterData.birth_date || "1990-01-01",
          ...(voterData.photo_url && { photo_url: voterData.photo_url }),
        };
        
        console.log("Datos a insertar (final):", dataToInsert);
        
        const { data: newVoter, error: insertError } = await supabase
          .from("voters")
          .insert(dataToInsert)
          .select()
          .single();

        if (insertError) {
          console.error("Error insertando votante:", insertError);
          console.error("Detalles del error:", JSON.stringify(insertError, null, 2));
          toast.error(`Error al registrar el votante: ${insertError.message || "Error desconocido"}`);
          return;
        }

        finalVoterData = newVoter;
      }

      // Guardar DNI y datos en sessionStorage para usar en la votación
      sessionStorage.setItem("voter_dni", dni);
      sessionStorage.setItem("voter_data", JSON.stringify(finalVoterData));
      
      toast.success("Verificación exitosa. Redirigiendo...");
      
      // Redirigir a la página de votación
      setTimeout(() => {
        navigate("/votar");
      }, 1000);
    } catch (error) {
      console.error("Error verificando DNI:", error);
      toast.error("Error al verificar el DNI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div>
              <h1 className="text-4xl font-bold text-primary mb-2">Elecciones Perú 2025</h1>
              <p className="text-muted-foreground">Sistema de Votación Electoral</p>
            </div>
            <CardTitle className="text-2xl">Verificación de identidad</CardTitle>
            <CardDescription>
              Ingrese su DNI para acceder al sistema de votación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDniSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dni">DNI (8 dígitos)</Label>
                <Input
                  id="dni"
                  type="text"
                  placeholder="Ingresa tu DNI (8 dígitos)"
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  maxLength={8}
                  required
                  className="text-lg"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-peru hover:opacity-90 text-lg py-6"
                disabled={loading || dni.length !== 8}
              >
                {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                Iniciar Votación
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;

