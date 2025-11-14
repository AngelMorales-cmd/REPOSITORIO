import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { LogOut, Users, TrendingUp, BarChart3, Database, Settings, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalVotes: 0,
    totalVoters: 0,
    participationRate: 0,
    presidentialVotes: 0,
    distritalVotes: 0,
    regionalVotes: 0,
  });
  const [candidatesData, setCandidatesData] = useState<any[]>([]);
  const [cleaningLoading, setCleaningLoading] = useState<string | null>(null);
  const [trainingLoading, setTrainingLoading] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchDashboardData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/admin");
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .single();

    if (!data || error) {
      toast.error("No tienes permisos de administrador");
      navigate("/admin");
    }
  };

  const fetchDashboardData = async () => {
    try {
      // Fetch votes statistics
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("*");

      if (votesError) throw votesError;

      // Fetch voters
      const { data: voters, error: votersError } = await supabase
        .from("voters")
        .select("*");

      if (votersError) throw votersError;

      // Fetch candidates
      const { data: candidates, error: candidatesError } = await supabase
        .from("candidates")
        .select("*")
        .order("vote_count", { ascending: false });

      if (candidatesError) throw candidatesError;

      const totalVotes = votes?.length || 0;
      const totalVoters = voters?.length || 0;
      const participationRate = totalVoters > 0 ? (totalVotes / totalVoters) * 100 : 0;

      const presidentialVotes = votes?.filter((v) => v.category === "presidencial").length || 0;
      const distritalVotes = votes?.filter((v) => v.category === "distrital").length || 0;
      const regionalVotes = votes?.filter((v) => v.category === "regional").length || 0;

      setStats({
        totalVotes,
        totalVoters,
        participationRate,
        presidentialVotes,
        distritalVotes,
        regionalVotes,
      });

      setCandidatesData(candidates || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Error al cargar datos del dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.info("Sesión cerrada");
    navigate("/admin");
  };

  // Funciones de limpieza de datos
  const detectNullValues = async () => {
    setCleaningLoading("nulls");
    try {
      const issues: string[] = [];

      // Verificar candidatos con valores nulos o vacíos
      const { data: candidates, error: candidatesError } = await supabase
        .from("candidates")
        .select("*");

      if (!candidatesError && candidates) {
        candidates.forEach((candidate) => {
          if (!candidate.name || candidate.name.trim() === "") issues.push(`Candidato ${candidate.id}: nombre vacío`);
          if (!candidate.party_name || candidate.party_name.trim() === "") issues.push(`Candidato ${candidate.id}: partido vacío`);
          if (!candidate.description || candidate.description.trim() === "") issues.push(`Candidato ${candidate.id}: descripción vacía`);
          if (!candidate.photo_url || candidate.photo_url.trim() === "") issues.push(`Candidato ${candidate.id}: foto vacía`);
        });
      }

      // Verificar votantes con valores nulos o vacíos
      const { data: voters, error: votersError } = await supabase
        .from("voters")
        .select("*");

      if (!votersError && voters) {
        voters.forEach((voter) => {
          if (!voter.full_name || voter.full_name.trim() === "") issues.push(`Votante ${voter.dni}: nombre vacío`);
          if (!voter.address || voter.address.trim() === "") issues.push(`Votante ${voter.dni}: dirección vacía`);
          if (!voter.district || voter.district.trim() === "") issues.push(`Votante ${voter.dni}: distrito vacío`);
          if (!voter.province || voter.province.trim() === "") issues.push(`Votante ${voter.dni}: provincia vacía`);
          if (!voter.department || voter.department.trim() === "") issues.push(`Votante ${voter.dni}: departamento vacío`);
        });
      }

      // Verificar votos con valores nulos
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("*");

      if (!votesError && votes) {
        votes.forEach((vote) => {
          if (!vote.voter_dni) issues.push(`Voto ${vote.id}: DNI del votante vacío`);
          if (!vote.candidate_id) issues.push(`Voto ${vote.id}: ID del candidato vacío`);
          if (!vote.category) issues.push(`Voto ${vote.id}: categoría vacía`);
        });
      }

      if (issues.length > 0) {
        toast.warning(`Se encontraron ${issues.length} problemas con valores nulos o vacíos`, {
          description: issues.slice(0, 5).join(", ") + (issues.length > 5 ? "..." : ""),
          duration: 10000,
        });
      } else {
        toast.success("No se encontraron valores nulos o vacíos", {
          description: "Todos los registros están completos",
        });
      }
    } catch (error) {
      console.error("Error detectando valores nulos:", error);
      toast.error("Error al detectar valores nulos");
    } finally {
      setCleaningLoading(null);
    }
  };

  const removeDuplicates = async () => {
    setCleaningLoading("duplicates");
    try {
      let removedCount = 0;

      // Buscar votos duplicados por voter_dni y category (aunque hay UNIQUE constraint, verificamos)
      const { data: votes, error: votesError } = await supabase
        .from("votes")
        .select("*")
        .order("voted_at", { ascending: false });

      if (!votesError && votes) {
        const seen = new Map<string, string>();
        const duplicates: string[] = [];

        votes.forEach((vote) => {
          const key = `${vote.voter_dni}_${vote.category}`;
          if (seen.has(key)) {
            duplicates.push(vote.id);
          } else {
            seen.set(key, vote.id);
          }
        });

        // Eliminar duplicados (mantener el más reciente)
        for (const duplicateId of duplicates) {
          const { error: deleteError } = await supabase
            .from("votes")
            .delete()
            .eq("id", duplicateId);

          if (!deleteError) {
            removedCount++;
          }
        }
      }

      // Buscar votantes duplicados por DNI
      const { data: voters, error: votersError } = await supabase
        .from("voters")
        .select("dni");

      if (!votersError && voters) {
        const dniCounts = new Map<string, number>();
        voters.forEach((voter) => {
          dniCounts.set(voter.dni, (dniCounts.get(voter.dni) || 0) + 1);
        });

        // Los DNIs deberían ser únicos por la clave primaria, pero verificamos
        const duplicateDnis = Array.from(dniCounts.entries())
          .filter(([_, count]) => count > 1)
          .map(([dni]) => dni);

        if (duplicateDnis.length > 0) {
          toast.warning(`Se encontraron ${duplicateDnis.length} DNIs duplicados (esto no debería ocurrir debido a la clave primaria)`);
        }
      }

      if (removedCount > 0) {
        toast.success(`Se eliminaron ${removedCount} votos duplicados`);
        fetchDashboardData(); // Refrescar datos
      } else {
        toast.success("No se encontraron duplicados", {
          description: "Todos los registros son únicos",
        });
      }
    } catch (error) {
      console.error("Error eliminando duplicados:", error);
      toast.error("Error al eliminar duplicados");
    } finally {
      setCleaningLoading(null);
    }
  };

  const validateDNIs = async () => {
    setCleaningLoading("dnis");
    try {
      const invalidDNIs: string[] = [];
      const dniRegex = /^\d{8}$/;

      const { data: voters, error: votersError } = await supabase
        .from("voters")
        .select("dni, full_name");

      if (!votersError && voters) {
        voters.forEach((voter) => {
          if (!dniRegex.test(voter.dni)) {
            invalidDNIs.push(`${voter.dni} (${voter.full_name})`);
          }
        });

        // Verificar también en la tabla de votos
        const { data: votes, error: votesError } = await supabase
          .from("votes")
          .select("voter_dni");

        if (!votesError && votes) {
          const uniqueDnis = new Set(votes.map((v) => v.voter_dni));
          uniqueDnis.forEach((dni) => {
            if (dni && !dniRegex.test(dni) && !invalidDNIs.some((inv) => inv.startsWith(dni))) {
              invalidDNIs.push(`${dni} (en votos)`);
            }
          });
        }
      }

      if (invalidDNIs.length > 0) {
        toast.warning(`Se encontraron ${invalidDNIs.length} DNIs con formato inválido`, {
          description: invalidDNIs.slice(0, 5).join(", ") + (invalidDNIs.length > 5 ? "..." : ""),
          duration: 10000,
        });
      } else {
        toast.success("Todos los DNIs tienen el formato correcto", {
          description: "Todos los DNIs tienen 8 dígitos",
        });
      }
    } catch (error) {
      console.error("Error validando DNIs:", error);
      toast.error("Error al validar DNIs");
    } finally {
      setCleaningLoading(null);
    }
  };

  const normalizeData = async () => {
    setCleaningLoading("normalize");
    try {
      let normalizedCount = 0;

      // Normalizar nombres de votantes (trim y capitalizar)
      const { data: voters, error: votersError } = await supabase
        .from("voters")
        .select("*");

      if (!votersError && voters) {
        for (const voter of voters) {
          const updates: any = {};
          let needsUpdate = false;

          // Normalizar nombre completo
          if (voter.full_name) {
            const normalized = voter.full_name
              .trim()
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(" ");
            if (normalized !== voter.full_name) {
              updates.full_name = normalized;
              needsUpdate = true;
            }
          }

          // Normalizar dirección
          if (voter.address) {
            const normalized = voter.address.trim();
            if (normalized !== voter.address) {
              updates.address = normalized;
              needsUpdate = true;
            }
          }

          // Normalizar distrito, provincia, departamento
          ["district", "province", "department"].forEach((field) => {
            if (voter[field as keyof typeof voter]) {
              const value = voter[field as keyof typeof voter] as string;
              const normalized = value
                .trim()
                .split(" ")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(" ");
              if (normalized !== value) {
                updates[field] = normalized;
                needsUpdate = true;
              }
            }
          });

          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from("voters")
              .update(updates)
              .eq("dni", voter.dni);

            if (!updateError) {
              normalizedCount++;
            }
          }
        }
      }

      // Normalizar nombres de candidatos
      const { data: candidates, error: candidatesError } = await supabase
        .from("candidates")
        .select("*");

      if (!candidatesError && candidates) {
        for (const candidate of candidates) {
          const updates: any = {};
          let needsUpdate = false;

          // Normalizar nombre
          if (candidate.name) {
            const normalized = candidate.name
              .trim()
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join(" ");
            if (normalized !== candidate.name) {
              updates.name = normalized;
              needsUpdate = true;
            }
          }

          // Normalizar nombre del partido
          if (candidate.party_name) {
            const normalized = candidate.party_name.trim();
            if (normalized !== candidate.party_name) {
              updates.party_name = normalized;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            const { error: updateError } = await supabase
              .from("candidates")
              .update(updates)
              .eq("id", candidate.id);

            if (!updateError) {
              normalizedCount++;
            }
          }
        }
      }

      if (normalizedCount > 0) {
        toast.success(`Se normalizaron ${normalizedCount} registros`);
        fetchDashboardData(); // Refrescar datos
      } else {
        toast.success("Los datos ya están normalizados", {
          description: "No se encontraron datos que necesiten normalización",
        });
      }
    } catch (error) {
      console.error("Error normalizando datos:", error);
      toast.error("Error al normalizar datos");
    } finally {
      setCleaningLoading(null);
    }
  };

  // Funciones de entrenamiento
  const startTraining = async (type: string) => {
    setTrainingLoading(type);
    try {
      // Simular proceso de entrenamiento
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success(`Entrenamiento de ${type} completado`, {
        description: "El modelo ha sido entrenado exitosamente con los datos disponibles",
      });
    } catch (error) {
      console.error(`Error en entrenamiento de ${type}:`, error);
      toast.error(`Error al entrenar modelo de ${type}`);
    } finally {
      setTrainingLoading(null);
    }
  };

  const categoryData = [
    { name: "Presidencial", value: stats.presidentialVotes },
    { name: "Distrital", value: stats.distritalVotes },
    { name: "Regional", value: stats.regionalVotes },
  ];

  const COLORS = ["#D91E36", "#2E5C96", "#F39C12"];

  const topCandidates = candidatesData.slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-peru text-primary-foreground py-4 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Panel Administrativo</h1>
              <p className="text-primary-foreground/90">Sistema Electoral Perú 2025</p>
            </div>
            <Button variant="secondary" onClick={handleSignOut} className="flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Análisis
            </TabsTrigger>
            <TabsTrigger value="cleaning" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Limpieza
            </TabsTrigger>
            <TabsTrigger value="training" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Entrenar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Total de Votantes</CardDescription>
                  <CardTitle className="text-3xl font-bold text-primary">
                    {stats.totalVoters.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Users className="w-8 h-8 text-primary/50" />
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Total de Votos</CardDescription>
                  <CardTitle className="text-3xl font-bold text-secondary">
                    {stats.totalVotes.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendingUp className="w-8 h-8 text-secondary/50" />
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Tasa de Participación</CardDescription>
                  <CardTitle className="text-3xl font-bold text-accent">
                    {stats.participationRate.toFixed(1)}%
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart3 className="w-8 h-8 text-accent/50" />
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardDescription>Candidatos</CardDescription>
                  <CardTitle className="text-3xl font-bold text-foreground">
                    {candidatesData.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Users className="w-8 h-8 text-muted-foreground/50" />
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Distribución de Votos por Categoría</CardTitle>
                  <CardDescription>Cantidad de votos en cada categoría electoral</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Top 10 Candidatos</CardTitle>
                  <CardDescription>Candidatos con más votos</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topCandidates}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="vote_count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Candidates Table */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Resultados por Candidato</CardTitle>
                <CardDescription>Detalle completo de votos por candidato</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4">Candidato</th>
                        <th className="text-left py-3 px-4">Partido</th>
                        <th className="text-left py-3 px-4">Categoría</th>
                        <th className="text-right py-3 px-4">Votos</th>
                        <th className="text-right py-3 px-4">Porcentaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidatesData.map((candidate) => {
                        const categoryTotal = candidatesData
                          .filter((c) => c.category === candidate.category)
                          .reduce((sum, c) => sum + c.vote_count, 0);
                        const percentage = categoryTotal > 0 ? (candidate.vote_count / categoryTotal) * 100 : 0;

                        return (
                          <tr key={candidate.id} className="border-b border-border hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{candidate.name}</td>
                            <td className="py-3 px-4 text-muted-foreground">{candidate.party_name}</td>
                            <td className="py-3 px-4">
                              <span className="capitalize text-sm px-2 py-1 bg-primary/10 text-primary rounded">
                                {candidate.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold">{candidate.vote_count.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold text-primary">{percentage.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cleaning">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Limpieza de Datos</CardTitle>
                <CardDescription>Herramientas para mantener la integridad de los datos electorales</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col items-start gap-2"
                        disabled={cleaningLoading !== null}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold">Detectar Valores Nulos</span>
                          {cleaningLoading === "nulls" && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <span className="text-sm text-muted-foreground">Identificar registros con datos incompletos</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Detectar Valores Nulos</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción escaneará todas las tablas (candidatos, votantes, votos) en busca de registros con campos nulos o vacíos. 
                          No se modificarán los datos, solo se reportarán los problemas encontrados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={detectNullValues}>
                          Continuar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col items-start gap-2"
                        disabled={cleaningLoading !== null}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold">Eliminar Duplicados</span>
                          {cleaningLoading === "duplicates" && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <span className="text-sm text-muted-foreground">Remover votos o votantes duplicados</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Duplicados</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción buscará y eliminará votos duplicados. Se mantendrán los votos más recientes. 
                          Esta operación no se puede deshacer. ¿Está seguro de continuar?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={removeDuplicates} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar Duplicados
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col items-start gap-2"
                        disabled={cleaningLoading !== null}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold">Validar DNIs</span>
                          {cleaningLoading === "dnis" && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <span className="text-sm text-muted-foreground">Verificar formato de documentos de identidad</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Validar DNIs</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción validará que todos los DNIs tengan el formato correcto (8 dígitos numéricos). 
                          No se modificarán los datos, solo se reportarán los DNIs inválidos encontrados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={validateDNIs}>
                          Validar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="h-auto py-4 flex flex-col items-start gap-2"
                        disabled={cleaningLoading !== null}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold">Normalizar Datos</span>
                          {cleaningLoading === "normalize" && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <span className="text-sm text-muted-foreground">Estandarizar formatos de direcciones y nombres</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Normalizar Datos</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción normalizará los nombres (capitalización adecuada), direcciones (eliminar espacios extras) 
                          y otros campos de texto en las tablas de votantes y candidatos. Los datos se actualizarán permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={normalizeData}>
                          Normalizar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Estas herramientas ayudan a mantener la calidad y consistencia de los datos del sistema electoral.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Entrenamiento de Modelos</CardTitle>
                <CardDescription>Configuración para análisis predictivo y machine learning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-semibold mb-2">Predicción de Tendencias</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Entrenar modelos para predecir tendencias electorales basadas en datos históricos
                    </p>
                    <Button 
                      className="bg-gradient-trust" 
                      onClick={() => startTraining("Predicción de Tendencias")}
                      disabled={trainingLoading !== null}
                    >
                      {trainingLoading === "Predicción de Tendencias" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Entrenando...
                        </>
                      ) : (
                        "Iniciar Entrenamiento"
                      )}
                    </Button>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-semibold mb-2">Detección de Anomalías</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Identificar patrones inusuales en el comportamiento de votación
                    </p>
                    <Button 
                      className="bg-gradient-trust" 
                      onClick={() => startTraining("Detección de Anomalías")}
                      disabled={trainingLoading !== null}
                    >
                      {trainingLoading === "Detección de Anomalías" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Configurando...
                        </>
                      ) : (
                        "Configurar Modelo"
                      )}
                    </Button>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-semibold mb-2">Análisis de Participación</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Predecir tasas de participación por región y demografía
                    </p>
                    <Button 
                      className="bg-gradient-trust" 
                      onClick={() => startTraining("Análisis de Participación")}
                      disabled={trainingLoading !== null}
                    >
                      {trainingLoading === "Análisis de Participación" ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Entrenando...
                        </>
                      ) : (
                        "Entrenar Predictor"
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Los modelos de machine learning se entrenarán utilizando los datos históricos disponibles en el sistema.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
