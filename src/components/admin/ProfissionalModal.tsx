import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Clinica } from "@/services/clinicas";
import { Profissional } from "@/services/profissionais";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfissionalComClinicas extends Profissional {
  clinicas?: Clinica[];
}

interface ProfissionalModalProps {
  open: boolean;
  onClose: () => void;
  profissional?: ProfissionalComClinicas | null;
  clinicas: Clinica[];
}

export function ProfissionalModal({ open, onClose, profissional, clinicas }: ProfissionalModalProps) {
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [clinicasSelecionadas, setClinicasSelecionadas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profissional) {
      setNome(profissional.nome);
      setCargo(profissional.cargo || '');
      setTelefone(profissional.telefone || '');
      setEmail(profissional.email || '');
      setClinicasSelecionadas(profissional.clinicas?.map(c => c.id) || []);
    } else {
      resetForm();
    }
  }, [profissional]);

  function resetForm() {
    setNome('');
    setCargo('');
    setTelefone('');
    setEmail('');
    setClinicasSelecionadas([]);
  }

  function handleClinicaToggle(clinicaId: string) {
    setClinicasSelecionadas(prev => 
      prev.includes(clinicaId)
        ? prev.filter(id => id !== clinicaId)
        : [...prev, clinicaId]
    );
  }

  async function handleSubmit() {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);

    try {
      let profissionalId = profissional?.id;

      if (profissional) {
        // Atualizar profissional existente
        const { error } = await supabase
          .from('profissionais')
          .update({
            nome: nome.trim(),
            cargo: cargo.trim() || null,
            telefone: telefone.trim() || null,
            email: email.trim() || null,
          })
          .eq('id', profissional.id);

        if (error) throw error;
      } else {
        // Criar novo profissional
        const { data, error } = await supabase
          .from('profissionais')
          .insert({
            nome: nome.trim(),
            cargo: cargo.trim() || null,
            telefone: telefone.trim() || null,
            email: email.trim() || null,
          })
          .select()
          .single();

        if (error) throw error;
        profissionalId = data.id;
      }

      // Atualizar vínculos com clínicas
      if (profissionalId) {
        // Remover vínculos antigos
        await supabase
          .from('profissional_clinica')
          .delete()
          .eq('profissional_id', profissionalId);

        // Criar novos vínculos
        if (clinicasSelecionadas.length > 0) {
          const vinculos = clinicasSelecionadas.map(clinicaId => ({
            profissional_id: profissionalId,
            clinica_id: clinicaId,
          }));

          const { error: vinculoError } = await supabase
            .from('profissional_clinica')
            .insert(vinculos);

          if (vinculoError) throw vinculoError;
        }
      }

      toast.success(profissional ? 'Profissional atualizado' : 'Profissional cadastrado');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar profissional');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{profissional ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label>Cargo / Especialidade</Label>
            <Input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Oftalmologista, Técnico em Optometria"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(91) 99999-9999"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Clínicas onde atua</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
              {clinicas.map((clinica) => (
                <div key={clinica.id} className="flex items-center gap-2">
                  <Checkbox
                    id={clinica.id}
                    checked={clinicasSelecionadas.includes(clinica.id)}
                    onCheckedChange={() => handleClinicaToggle(clinica.id)}
                  />
                  <label
                    htmlFor={clinica.id}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {clinica.nome}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : profissional ? 'Atualizar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
