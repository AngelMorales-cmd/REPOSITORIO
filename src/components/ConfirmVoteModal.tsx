import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface VoteSelection {
  candidateId: string;
  candidateName: string;
  category: "presidencial" | "distrital" | "regional";
}

interface ConfirmVoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selections: VoteSelection[];
  voterDni: string;
  onVoteComplete: () => void;
}

export const ConfirmVoteModal = ({
  open,
  onOpenChange,
  selections,
  voterDni,
  onVoteComplete,
}: ConfirmVoteModalProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [voterInfo, setVoterInfo] = useState<any>(null);

  useEffect(() => {
    if (open && voterDni) {
      loadVoterInfo();
    }
  }, [open, voterDni]);

  const loadVoterInfo = async () => {
    if (!voterDni) return;
    
    try {
      const storedData = sessionStorage.getItem("voter_data");
      if (storedData) {
        setVoterInfo(JSON.parse(storedData));
      } else {
        const { data, error } = await supabase
          .from("voters")
          .select("dni, full_name, district, province, department")
          .eq("dni", voterDni)
          .single();

        if (!error && data) {
          setVoterInfo(data);
          sessionStorage.setItem("voter_data", JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error("Error cargando información del votante:", error);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      presidencial: "Presidencial",
      distrital: "Distrital",
      regional: "Regional",
    };
    return labels[category] || category;
  };

  const validateSelections = async (): Promise<boolean> => {
    setValidating(true);
    setValidationErrors([]);
    const errors: string[] = [];

    try {
      // Validar DNI
      if (!voterDni || voterDni.length !== 8) {
        errors.push("DNI inválido");
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      // Verificar que el votante existe
      const { data: voterData, error: voterError } = await supabase
        .from("voters")
        .select("dni, full_name")
        .eq("dni", voterDni)
        .single();

      if (voterError || !voterData) {
        errors.push("DNI no encontrado en el padrón electoral");
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      // Verificar que no haya votado previamente en alguna categoría
      const categoriesToCheck = selections.map((s) => s.category);
      const { data: existingVotes, error: checkError } = await supabase
        .from("votes")
        .select("category")
        .eq("voter_dni", voterDni)
        .in("category", categoriesToCheck);

      if (checkError) {
        errors.push("Error al verificar votos previos");
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      if (existingVotes && existingVotes.length > 0) {
        const votedCategories = existingVotes.map((v) => getCategoryLabel(v.category));
        errors.push(`Ya has votado en: ${votedCategories.join(", ")}`);
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      // Verificar que los candidatos existen y son válidos
      const candidateIds = selections.map((s) => s.candidateId);
      const { data: candidatesData, error: candidatesError } = await supabase
        .from("candidates")
        .select("id, name, category")
        .in("id", candidateIds);

      if (candidatesError) {
        errors.push("Error al verificar candidatos");
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      if (!candidatesData || candidatesData.length !== selections.length) {
        errors.push("Uno o más candidatos no son válidos");
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      // Validar que las categorías coincidan
      for (const selection of selections) {
        const candidate = candidatesData.find((c) => c.id === selection.candidateId);
        if (!candidate) {
          errors.push(`Candidato ${selection.candidateName} no encontrado`);
        } else if (candidate.category !== selection.category) {
          errors.push(
            `El candidato ${selection.candidateName} no pertenece a la categoría ${getCategoryLabel(selection.category)}`
          );
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        setValidating(false);
        return false;
      }

      setValidating(false);
      return true;
    } catch (error: any) {
      errors.push(`Error de validación: ${error?.message || "Error desconocido"}`);
      setValidationErrors(errors);
      setValidating(false);
      return false;
    }
  };

  const handleConfirmVote = async () => {
    if (selections.length === 0) {
      toast.error("No hay votos para confirmar");
      return;
    }

    // Validar antes de proceder
    const isValid = await validateSelections();
    if (!isValid) {
      if (validationErrors.length > 0) {
        validationErrors.forEach((error) => toast.error(error));
      }
      return;
    }

    setSubmitting(true);
    try {
      // Preparar los votos para insertar
      const votesToInsert = selections.map((selection) => ({
        voter_dni: voterDni,
        candidate_id: selection.candidateId,
        category: selection.category as "presidencial" | "distrital" | "regional",
      }));

      // Insertar todos los votos
      const { data: insertedVotes, error: insertError } = await supabase
        .from("votes")
        .insert(votesToInsert)
        .select("id, category, candidate_id");

      if (insertError) {
        console.error("Error al registrar votos en Supabase:", insertError);
        console.error("Detalles del error:", JSON.stringify(insertError, null, 2));
        console.error("Datos que se intentaron insertar:", votesToInsert);
        
        // Manejar errores específicos de PostgreSQL
        if (insertError.code === "23505") {
          // Violación de constraint UNIQUE
          toast.error("Ya has votado en una o más de estas categorías. Por favor, verifica tus votos previos.");
        } else if (insertError.code === "23503") {
          // Violación de foreign key
          toast.error("Error: Datos inválidos. Por favor, verifica la información.");
        } else if (insertError.code === "42501") {
          // Error de permisos - RLS bloqueando la inserción
          console.error("ERROR DE PERMISOS: Las políticas RLS están bloqueando la inserción.");
          console.error("Por favor, ejecuta la migración: 20251114000000_fix_votes_rls_permissions.sql");
          toast.error("Error de permisos. Verifica las políticas RLS en Supabase. Revisa la consola para más detalles.");
        } else {
          toast.error(`Error al registrar los votos: ${insertError.message}`);
        }
        setSubmitting(false);
        return;
      }

      if (!insertedVotes || insertedVotes.length !== selections.length) {
        toast.error("No se pudieron registrar todos los votos. Por favor, intente nuevamente.");
        setSubmitting(false);
        return;
      }

      // Verificar que los votos se registraron correctamente
      const categoriesVoted = selections.map((s) => s.category);
      const { data: verifyVotes, error: verifyError } = await supabase
        .from("votes")
        .select("id, category, candidate_id")
        .eq("voter_dni", voterDni)
        .in("category", categoriesVoted);

      if (verifyError) {
        console.error("Error verificando votos insertados:", verifyError);
        toast.warning("Los votos se insertaron pero no se pudieron verificar. Contacte al administrador.");
      } else if (!verifyVotes || verifyVotes.length !== selections.length) {
        toast.warning("Algunos votos no se pudieron verificar. Contacte al administrador.");
      }

      // Éxito - mostrar mensaje con detalles
      const categoriesLabels = selections.map((s) => getCategoryLabel(s.category)).join(", ");
      toast.success(
        `¡Votos registrados exitosamente en las categorías: ${categoriesLabels}!`,
        { duration: 4000 }
      );

      // Cerrar modal y ejecutar callback
      onOpenChange(false);
      onVoteComplete();
    } catch (error: any) {
      console.error("Error inesperado al procesar votos:", error);
      toast.error(
        `Error inesperado: ${error?.message || "Por favor, intente nuevamente más tarde."}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setValidationErrors([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">
            Confirmar tu voto
          </DialogTitle>
          <DialogDescription>
            Revise sus selecciones antes de confirmar. Una vez confirmado, no podrá modificar sus votos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Información del votante */}
          {voterInfo && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Votante</p>
              <p className="font-semibold text-foreground">{voterInfo.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {voterInfo.district}, {voterInfo.province}
              </p>
            </div>
          )}

          {/* Errores de validación */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de selecciones */}
          {selections.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No ha seleccionado ningún candidato</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {selections.map((selection, index) => (
                <div
                  key={`${selection.candidateId}-${selection.category}`}
                  className="p-4 bg-muted rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold text-muted-foreground">
                          {getCategoryLabel(selection.category)}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-foreground">
                        {selection.candidateName}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{index + 1}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resumen */}
          {selections.length > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm font-semibold text-foreground">
                Total de votos a confirmar: <span className="text-primary">{selections.length}</span>
              </p>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={submitting || validating}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmVote}
              disabled={submitting || validating || selections.length === 0 || validationErrors.length > 0}
              className="flex-1 bg-gradient-peru hover:opacity-90"
            >
              {(submitting || validating) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {validating ? "Validando..." : submitting ? "Registrando..." : "Confirmar envío"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
