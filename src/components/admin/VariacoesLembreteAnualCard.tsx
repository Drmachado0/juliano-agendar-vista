import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  VariacaoTemplate,
  listarVariacoes,
  criarVariacao,
  atualizarVariacao,
  removerVariacao,
} from "@/services/variacoesTemplates";

const TIPO = "lembrete_anual";

function previewMensagem(conteudo: string): string {
  return conteudo.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k === "nome" || k === "primeiro_nome" ? "Maria" : ""));
}

export default function VariacoesLembreteAnualCard() {
  const [items, setItems] = useState<VariacaoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<VariacaoTemplate | null>(null);
  const [novo, setNovo] = useState(false);
  const [previewItem, setPreviewItem] = useState<VariacaoTemplate | null>(null);
  const [form, setForm] = useState({ nome: "", conteudo: "", peso: 1, ativo: true });
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setLoading(true);
    const { data } = await listarVariacoes(TIPO);
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirNovo() {
    setNovo(true);
    setEditando(null);
    setForm({ nome: "", conteudo: "Olá, {{nome}}! ...", peso: 1, ativo: true });
  }

  function abrirEdicao(v: VariacaoTemplate) {
    setEditando(v);
    setNovo(false);
    setForm({ nome: v.nome, conteudo: v.conteudo, peso: v.peso, ativo: v.ativo });
  }

  async function salvar() {
    if (!form.nome.trim() || !form.conteudo.trim()) {
      toast.error("Nome e conteúdo são obrigatórios");
      return;
    }
    setSalvando(true);
    const result = editando
      ? await atualizarVariacao(editando.id, form)
      : await criarVariacao({ template_tipo: TIPO, ...form });
    setSalvando(false);
    if (result.success) {
      toast.success("Variação salva");
      setEditando(null);
      setNovo(false);
      recarregar();
    } else {
      toast.error(result.error || "Erro ao salvar");
    }
  }

  async function excluir(v: VariacaoTemplate) {
    if (!confirm(`Excluir variação "${v.nome}"?`)) return;
    const r = await removerVariacao(v.id);
    if (r.success) {
      toast.success("Variação excluída");
      recarregar();
    } else {
      toast.error(r.error || "Erro");
    }
  }

  async function toggleAtivo(v: VariacaoTemplate) {
    const r = await atualizarVariacao(v.id, { ativo: !v.ativo });
    if (r.success) recarregar();
    else toast.error(r.error || "Erro");
  }

  const ativasCount = items.filter((i) => i.ativo).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>Variações – Lembrete Anual</CardTitle>
            <CardDescription>
              O runner sorteia uma variação ativa para cada paciente, evitando repetir a
              última. Variável suportada: <code>{"{{nome}}"}</code>.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ativasCount} ativa(s)</Badge>
            <Button size="sm" onClick={abrirNovo} className="gap-2">
              <Plus className="h-4 w-4" /> Nova variação
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma variação cadastrada.</p>
        )}
        {items.map((v) => (
          <div
            key={v.id}
            className="border rounded-md p-3 flex items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{v.nome}</span>
                <Badge variant="outline">peso {v.peso}</Badge>
                <Badge variant={v.ativo ? "default" : "secondary"}>
                  {v.ativo ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                {v.conteudo}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Switch checked={v.ativo} onCheckedChange={() => toggleAtivo(v)} />
              <Button size="icon" variant="ghost" onClick={() => setPreviewItem(v)} title="Preview">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => abrirEdicao(v)} title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => excluir(v)}
                title="Excluir"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={novo || !!editando} onOpenChange={(o) => { if (!o) { setNovo(false); setEditando(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar variação" : "Nova variação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Conteúdo (use {"{{nome}}"} para personalização)</Label>
              <Textarea
                rows={10}
                value={form.conteudo}
                onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Peso (probabilidade relativa)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.peso}
                  onChange={(e) => setForm({ ...form, peso: Math.max(1, parseInt(e.target.value || "1", 10)) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Ativa</Label>
              </div>
            </div>
            <div className="border rounded p-2 bg-muted/40">
              <p className="text-xs font-medium mb-1">Preview</p>
              <pre className="text-xs whitespace-pre-wrap">{previewMensagem(form.conteudo)}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNovo(false); setEditando(null); }}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview – {previewItem?.nome}</DialogTitle>
          </DialogHeader>
          <pre className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-3">
            {previewItem ? previewMensagem(previewItem.conteudo) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
