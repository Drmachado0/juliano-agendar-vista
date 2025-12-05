import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Building2, User } from "lucide-react";
import { listarProfissionais, Profissional } from "@/services/profissionais";
import { listarClinicas, Clinica } from "@/services/clinicas";
import { supabase } from "@/integrations/supabase/client";
import { ProfissionalModal } from "@/components/admin/ProfissionalModal";
import { toast } from "sonner";

interface ProfissionalComClinicas extends Profissional {
  clinicas?: Clinica[];
}

export default function Profissionais() {
  const [profissionais, setProfissionais] = useState<ProfissionalComClinicas[]>([]);
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProfissional, setSelectedProfissional] = useState<ProfissionalComClinicas | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    const [profRes, clinicasRes] = await Promise.all([
      listarProfissionais(),
      listarClinicas()
    ]);

    // Buscar vínculos de clínicas para cada profissional
    const profissionaisComClinicas = await Promise.all(
      profRes.data.map(async (prof) => {
        const { data: vinculos } = await supabase
          .from('profissional_clinica')
          .select('clinica_id')
          .eq('profissional_id', prof.id);

        const clinicasIds = vinculos?.map(v => v.clinica_id) || [];
        const clinicasVinculadas = clinicasRes.data.filter(c => clinicasIds.includes(c.id));

        return { ...prof, clinicas: clinicasVinculadas };
      })
    );

    setProfissionais(profissionaisComClinicas);
    setClinicas(clinicasRes.data);
    setLoading(false);
  }

  async function handleRemover(id: string) {
    if (!confirm('Tem certeza que deseja remover este profissional?')) return;

    const { error } = await supabase
      .from('profissionais')
      .update({ ativo: false })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao remover profissional');
    } else {
      toast.success('Profissional removido');
      carregarDados();
    }
  }

  function handleEditar(profissional: ProfissionalComClinicas) {
    setSelectedProfissional(profissional);
    setModalOpen(true);
  }

  function handleNovo() {
    setSelectedProfissional(null);
    setModalOpen(true);
  }

  function handleModalClose() {
    setModalOpen(false);
    setSelectedProfissional(null);
    carregarDados();
  }

  const profissionaisFiltrados = profissionais.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.cargo?.toLowerCase().includes(busca.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
            <p className="text-muted-foreground">Gerencie os profissionais e suas clínicas</p>
          </div>
          <Button onClick={handleNovo} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Profissional
          </Button>
        </div>

        {/* Busca */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou cargo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profissionaisFiltrados.length === 0 ? (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum profissional encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {busca ? 'Tente ajustar sua busca' : 'Cadastre o primeiro profissional'}
                </p>
              </CardContent>
            </Card>
          ) : (
            profissionaisFiltrados.map((profissional) => (
              <Card key={profissional.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{profissional.nome}</CardTitle>
                        {profissional.cargo && (
                          <p className="text-sm text-muted-foreground">{profissional.cargo}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditar(profissional)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemover(profissional.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {profissional.telefone && (
                    <p className="text-sm text-muted-foreground mb-2">
                      📞 {profissional.telefone}
                    </p>
                  )}
                  {profissional.email && (
                    <p className="text-sm text-muted-foreground mb-3">
                      ✉️ {profissional.email}
                    </p>
                  )}
                  
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      Clínicas vinculadas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {profissional.clinicas && profissional.clinicas.length > 0 ? (
                        profissional.clinicas.map((clinica) => (
                          <Badge key={clinica.id} variant="secondary" className="text-xs">
                            {clinica.nome.split(' – ')[0]}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Nenhuma clínica vinculada</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <ProfissionalModal
        open={modalOpen}
        onClose={handleModalClose}
        profissional={selectedProfissional}
        clinicas={clinicas}
      />
    </AdminLayout>
  );
}
