import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CandidateCard } from "@/components/CandidateCard";
import { CandidateModal } from "@/components/CandidateModal";
import { ConfirmVoteModal } from "@/components/ConfirmVoteModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, User, MapPin, CreditCard, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Candidate {
  id: string;
  name: string;
  photo_url: string;
  description: string;
  party_name: string;
  party_logo_url: string | null;
  party_description: string | null;
  academic_formation: string | null;
  professional_experience: string | null;
  campaign_proposal: string | null;
  category: string;
  vote_count: number;
}

interface VoterData {
  dni: string;
  full_name: string;
  address: string;
  district: string;
  province: string;
  department: string;
  birth_date: string;
  has_voted: boolean;
  photo_url?: string | null;
}

const Index = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVotes, setTotalVotes] = useState(0);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [voterDni, setVoterDni] = useState<string>("");
  const [voterData, setVoterData] = useState<VoterData | null>(null);
  const [votedCategories, setVotedCategories] = useState<string[]>([]);
  const [voteSelections, setVoteSelections] = useState<Array<{candidateId: string; candidateName: string; category: "presidencial" | "distrital" | "regional"}>>([]);
  const [completedVotes, setCompletedVotes] = useState<Array<{category: string; candidateName: string}>>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);

  // Verificar si hay DNI en sessionStorage y cargar datos del votante
  useEffect(() => {
    const dni = sessionStorage.getItem("voter_dni");
    if (!dni) {
      // Si no hay DNI, redirigir a la página de inicio
      navigate("/");
      return;
    }
    setVoterDni(dni);
    
    // Cargar datos del votante desde sessionStorage
    const storedVoterData = sessionStorage.getItem("voter_data");
    if (storedVoterData) {
      try {
        const parsedData = JSON.parse(storedVoterData);
        setVoterData(parsedData);
      } catch (error) {
        console.error("Error parsing voter data:", error);
      }
    }
    
    checkVotedCategories(dni);
  }, [navigate]);

  // Verificar qué categorías ya votó
  const checkVotedCategories = async (dni: string) => {
    try {
      const { data, error } = await supabase
        .from("votes")
        .select("category")
        .eq("voter_dni", dni);

      if (!error && data) {
        const categories = data.map((v) => v.category);
        setVotedCategories(categories);
      }
    } catch (error) {
      console.error("Error verificando categorías votadas:", error);
    }
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("vote_count", { ascending: false });

      if (error) {
        console.error("Error fetching candidates:", error);
        toast.error("Error al cargar candidatos");
        return;
      }

      // Solo usar datos de Supabase, sin transformaciones
      setCandidates(data || []);
      const total = (data || []).reduce((sum, c) => sum + c.vote_count, 0);
      setTotalVotes(total);
    } catch (error) {
      console.error("Error al cargar candidatos:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleRefresh = () => {
    toast.info("Actualizando resultados...");
    fetchCandidates();
  };

  const handleVote = (candidate: Candidate) => {
    // Verificar si ya votó en esta categoría
    if (votedCategories.includes(candidate.category)) {
      toast.error(`Ya has votado en la categoría ${candidate.category}`);
      return;
    }

    // Verificar si este candidato ya está seleccionado
    const isCurrentlySelected = voteSelections.some(
      (sel) => sel.candidateId === candidate.id && sel.category === candidate.category
    );

    if (isCurrentlySelected) {
      // Deseleccionar el candidato
      setVoteSelections((prev) =>
        prev.filter(
          (sel) => !(sel.candidateId === candidate.id && sel.category === candidate.category)
        )
      );
      toast.info(`Candidato ${candidate.name} deseleccionado`);
    } else {
      // Verificar si ya hay otro candidato seleccionado en esta categoría
      const existingSelection = voteSelections.find(
        (sel) => sel.category === candidate.category
      );

      if (existingSelection) {
        // Reemplazar la selección existente
        setVoteSelections((prev) =>
          prev.map((sel) =>
            sel.category === candidate.category
              ? {
                  candidateId: candidate.id,
                  candidateName: candidate.name,
                  category: candidate.category as "presidencial" | "distrital" | "regional",
                }
              : sel
          )
        );
        toast.success(`Candidato ${candidate.name} seleccionado para ${candidate.category}`);
      } else {
        // Agregar nueva selección
        setVoteSelections((prev) => [
          ...prev,
          {
            candidateId: candidate.id,
            candidateName: candidate.name,
            category: candidate.category as "presidencial" | "distrital" | "regional",
          },
        ]);
        toast.success(`Candidato ${candidate.name} seleccionado`);
      }
    }
  };

  const handleConfirmVotes = () => {
    if (voteSelections.length === 0) {
      toast.error("Debe seleccionar al menos un candidato");
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleVoteComplete = async () => {
    // Limpiar selecciones
    setVoteSelections([]);
    
    // Recargar candidatos para actualizar conteos
    await fetchCandidates();
    
    // Verificar qué categorías ya votó
    await checkVotedCategories(voterDni);
    
    // Verificar si completó las 3 categorías
    const allCategories = ["presidencial", "distrital", "regional"];
    
    // Esperar un momento para que se actualice votedCategories
    setTimeout(async () => {
      const { data } = await supabase
        .from("votes")
        .select("category")
        .eq("voter_dni", voterDni);

      if (data) {
        const categories = data.map((v) => v.category);
        const completed = allCategories.every((cat) => categories.includes(cat as "presidencial" | "distrital" | "regional"));
        
        if (completed) {
          // Cargar información de los votos realizados
          await loadCompletedVotes();
          // Mostrar modal de completación
          setCompletionModalOpen(true);
        }
      }
    }, 500);
  };

  const loadCompletedVotes = async () => {
    if (!voterDni) return;
    
    setLoadingVotes(true);
    try {
      // Primero obtener los votos
      const { data: votesData, error: votesError } = await supabase
        .from("votes")
        .select("category, candidate_id")
        .eq("voter_dni", voterDni)
        .order("category");

      if (votesError) {
        console.error("Error cargando votos completados:", votesError);
        return;
      }

      if (votesData && votesData.length > 0) {
        // Obtener los IDs de los candidatos
        const candidateIds = votesData.map((v) => v.candidate_id);
        
        // Obtener información de los candidatos
        const { data: candidatesData, error: candidatesError } = await supabase
          .from("candidates")
          .select("id, name")
          .in("id", candidateIds);

        if (candidatesError) {
          console.error("Error cargando candidatos:", candidatesError);
          return;
        }

        // Combinar datos
        const votes = votesData.map((vote) => {
          const candidate = candidatesData?.find((c) => c.id === vote.candidate_id);
          return {
            category: vote.category,
            candidateName: candidate ? candidate.name : "Candidato desconocido",
          };
        });

        setCompletedVotes(votes);
      }
    } catch (error) {
      console.error("Error al cargar votos:", error);
    } finally {
      setLoadingVotes(false);
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

  const handleCompletionConfirm = () => {
    setCompletionModalOpen(false);
    // Limpiar sessionStorage y redirigir al inicio
    sessionStorage.removeItem("voter_dni");
    sessionStorage.removeItem("voter_data");
    toast.success("¡Gracias por ejercer tu derecho al voto!");
    setTimeout(() => {
      navigate("/");
    }, 1000);
  };

  const handleViewCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setCandidateModalOpen(true);
  };

  const getCandidatesByCategory = (category: string) => {
    return candidates.filter((c) => c.category === category);
  };

  const getCategoryTotal = (category: string) => {
    return getCandidatesByCategory(category).reduce((sum, c) => sum + c.vote_count, 0);
  };

  const getPercentage = (voteCount: number, category: string) => {
    const total = getCategoryTotal(category);
    return total > 0 ? (voteCount / total) * 100 : 0;
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-peru text-primary-foreground py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Elecciones Perú 2025</h1>
              <p className="text-primary-foreground/90 text-lg">Sistema de Votación Electoral</p>
            </div>
            <div className="flex items-center gap-3">
              {votedCategories.length > 0 && (
                <span className="text-sm text-primary-foreground/80">
                  Categorías votadas: {votedCategories.length}/3
                </span>
              )}
              {voteSelections.length > 0 && (
                <Button
                  onClick={handleConfirmVotes}
                  className="flex items-center gap-2 bg-white text-primary hover:bg-white/90"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Votos ({voteSelections.length})
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mensaje de Bienvenida */}
      {voterData && (
        <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-primary-foreground shadow-lg border-b-4 border-primary/20">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Foto del votante */}
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-xl"></div>
                  <Avatar className="relative w-20 h-20 border-4 border-white/30 shadow-xl ring-4 ring-white/10">
                    <AvatarImage 
                      src={voterData.photo_url || undefined} 
                      alt={voterData.full_name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-white/20 text-white text-2xl font-bold backdrop-blur-sm">
                      {voterData.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              
              {/* Contenido principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
                  <h2 className="text-3xl font-bold tracking-tight">
                    ¡Bienvenido, {voterData.full_name}!
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-primary-foreground/90">
                  {/* DNI */}
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">DNI: {voterData.dni}</span>
                  </div>
                  
                  {/* Ubicación */}
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {voterData.district}, {voterData.province}, {voterData.department}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Badge de estado */}
              <div className="flex-shrink-0">
                <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/30">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold">Verificado</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className="bg-card border-b border-border py-4 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Total de Votos</p>
                <p className="text-3xl font-bold text-primary">{totalVotes.toLocaleString()}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-sm text-muted-foreground">Candidatos</p>
                <p className="text-2xl font-bold text-foreground">{candidates.length}</p>
              </div>
            </div>
            <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="presidencial" className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="presidencial" className="text-base">
              Presidencial
            </TabsTrigger>
            <TabsTrigger value="distrital" className="text-base">
              Distrital
            </TabsTrigger>
            <TabsTrigger value="regional" className="text-base">
              Regional
            </TabsTrigger>
          </TabsList>

          {["presidencial", "distrital", "regional"].map((category) => (
            <TabsContent key={category} value={category}>
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-muted-foreground">Cargando candidatos...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {getCandidatesByCategory(category).map((candidate) => {
                    const hasVoted = votedCategories.includes(category);
                    const isSelected = voteSelections.some(
                      (sel) => sel.candidateId === candidate.id && sel.category === category
                    );
                    
                    return (
                      <CandidateCard
                        key={candidate.id}
                        id={candidate.id}
                        name={candidate.name}
                        photo={candidate.photo_url}
                        description={candidate.description}
                        voteCount={candidate.vote_count}
                        percentage={getPercentage(candidate.vote_count, category)}
                        onViewCandidate={() => handleViewCandidate(candidate)}
                        onVote={() => handleVote(candidate)}
                        isSelected={isSelected}
                        disabled={hasVoted}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* Modals */}
      {selectedCandidate && (
        <CandidateModal
          open={candidateModalOpen}
          onOpenChange={setCandidateModalOpen}
          candidateName={selectedCandidate.name}
          academicFormation={selectedCandidate.academic_formation || undefined}
          professionalExperience={selectedCandidate.professional_experience || undefined}
          campaignProposal={selectedCandidate.campaign_proposal || undefined}
          partyName={selectedCandidate.party_name || undefined}
          partyLogo={selectedCandidate.party_logo_url || undefined}
          partyDescription={selectedCandidate.party_description || undefined}
          voteCount={selectedCandidate.vote_count}
          percentage={getPercentage(selectedCandidate.vote_count, selectedCandidate.category)}
          candidatePhoto={selectedCandidate.photo_url || undefined}
          category={selectedCandidate.category}
        />
      )}

      <ConfirmVoteModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        selections={voteSelections}
        voterDni={voterDni}
        onVoteComplete={handleVoteComplete}
      />

      {/* Modal de confirmación final */}
      <Dialog open={completionModalOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground text-center">
              Confirmar tu voto
            </DialogTitle>
            <DialogDescription className="text-center">
              Revisa tus selecciones antes de confirmar
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {loadingVotes ? (
              <div className="text-center py-8">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-muted-foreground">Cargando tus votaciones...</p>
              </div>
            ) : completedVotes.length === 3 ? (
              <>
                <div className="space-y-3">
                  {completedVotes.map((vote, index) => (
                    <div
                      key={index}
                      className="p-4 bg-muted rounded-lg border border-border"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">
                            {getCategoryLabel(vote.category)}
                          </p>
                          <p className="text-lg font-bold text-foreground">
                            {vote.candidateName}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleCompletionConfirm}
                    disabled={loadingVotes || completedVotes.length !== 3}
                    className="w-full bg-gradient-peru hover:opacity-90"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirmar y Volver al Inicio
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {completedVotes.length === 0 
                    ? "No se pudieron cargar tus votaciones" 
                    : `Faltan ${3 - completedVotes.length} categoría(s) por votar`}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
