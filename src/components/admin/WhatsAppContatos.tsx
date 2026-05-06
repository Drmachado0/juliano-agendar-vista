import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, Trash2, Loader2, MessageCircle, Phone, Mail, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Contato, listarContatos, atualizarContato, apagarContato } from "@/services/contatos";
import { getLocalBadgeClasses, LOCAL_SHORT_LABELS, getLocalGrupo } from "@/lib/localAtendimento";
import { cn } from "@/lib/utils";

interface Props {
  onAbrirChat?: (telefone: string) => void;
}

const WhatsAppContatos = ({ onAbrirChat }: Props) => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [incluirSandbox, setIncluirSandbox] = useState(false);

  const [editando, setEditando] = useState<Contato | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ nome_completo: "", telefone_whatsapp: "", email: "", data_nascimento: "" });

  const [apagando, setApagando] = useState<Contato | null>(null);
  const [apagandoLoad, setApagandoLoad] = useState(false);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await listarContatos(busca, incluirSandbox);
    if (error) toast.error("Erro ao carregar contatos");
    setContatos(data);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, incluirSandbox]);

  const total = contatos.length;
  const stats = useMemo(() => {
    const com = contatos.filter((c) => c.total_agendamentos > 1).length;
    return { com };
  }, [contatos]);

  const abrirEdicao = (c: Contato) => {
    setEditando(c);
    setForm({
      nome_completo: c.nome_completo || "",
      telefone_whatsapp: c.telefone_whatsapp || "",
      email: c.email || "",
      data_nascimento: c.data_nascimento || "",
    });
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    if (!form.nome_completo.trim() || form.nome_completo.trim().length < 2) {
      toast.error("Informe um nome válido");
      return;
    }
    if (!form.telefone_whatsapp.trim()) {
      toast.error("Telefone obrigatório");
      return;
    }
    setSalvando(true);
    const { error } = await atualizarContato(editando.id, {
      nome_completo: form.nome_completo.trim(),
      telefone_whatsapp: form.telefone_whatsapp.trim(),
      email: form.email.trim() || null,
      data_nascimento: form.data_nascimento || null,
    });
    setSalvando(false);
    if (error) {
      toast.error("Erro ao salvar contato");
      return;
    }
    toast.success("Contato atualizado");
    setEditando(null);
    carregar();
  };

  const confirmarApagar = async () => {
    if (!apagando) return;
    setApagandoLoad(true);
    const { removidos, error } = await apagarContato(apagando.telefone_whatsapp);
    setApagandoLoad(false);
    if (error) {
      toast.error("Erro ao apagar contato");
      return;
    }
    toast.success(`Contato apagado (${removidos} registro${removidos !== 1 ? "s" : ""})`);
    setApagando(null);
    carregar();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={carregar} title="Recarregar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            {loading ? "Carregando..." : `${total} contato${total !== 1 ? "s" : ""}`}
            {stats.com > 0 && ` • ${stats.com} com múltiplos agendamentos`}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sb" className="text-xs text-muted-foreground">Incluir sandbox</Label>
            <Switch id="sb" checked={incluirSandbox} onCheckedChange={setIncluirSandbox} />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : contatos.length === 0 ? (
          <div className="text-center text-muted-foreground p-8 text-sm">
            Nenhum contato encontrado
          </div>
        ) : (
          <div className="divide-y divide-border">
            {contatos.map((c) => (
              <div key={c.id} className="p-4 hover:bg-accent/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground truncate">{c.nome_completo}</h3>
                      {c.is_sandbox && (
                        <Badge variant="outline" className="text-xs">sandbox</Badge>
                      )}
                      {c.total_agendamentos > 1 && (
                        <Badge variant="secondary" className="text-xs">
                          {c.total_agendamentos} agend.
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> {c.telefone_whatsapp}
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> {c.email}
                        </div>
                      )}
                      {c.local_atendimento && (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-medium px-1.5 py-0 border", getLocalBadgeClasses(c.local_atendimento))}
                            title={c.local_atendimento}
                          >
                            {LOCAL_SHORT_LABELS[getLocalGrupo(c.local_atendimento)]}
                          </Badge>
                          <span>• {c.status_crm}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onAbrirChat && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Abrir conversa"
                        onClick={() => onAbrirChat(c.telefone_whatsapp)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => abrirEdicao(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Apagar"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setApagando(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Editar */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar contato</DialogTitle>
            <DialogDescription>
              As alterações serão aplicadas ao registro principal deste contato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={form.nome_completo}
                onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tel">Telefone WhatsApp</Label>
              <Input id="tel" value={form.telefone_whatsapp}
                onChange={(e) => setForm({ ...form, telefone_whatsapp: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="dn">Data de nascimento</Label>
              <Input id="dn" type="date" value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvarEdicao} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar Apagar */}
      <AlertDialog open={!!apagando} onOpenChange={(o) => !o && setApagando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar contato?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove <strong>{apagando?.nome_completo}</strong> ({apagando?.telefone_whatsapp}),
              todos os {apagando?.total_agendamentos} agendamento(s) deste número e o histórico de mensagens
              do WhatsApp vinculado. Não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apagandoLoad}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmarApagar(); }}
              disabled={apagandoLoad}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {apagandoLoad && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WhatsAppContatos;
