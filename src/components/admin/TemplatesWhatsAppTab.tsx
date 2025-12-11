import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, RotateCcw, Eye, MessageSquare, Loader2 } from "lucide-react";
import {
  TemplateWhatsApp,
  listarTemplates,
  atualizarTemplate,
  renderizarTemplate,
  dadosExemplo,
  templatesPadrao,
  tipoIcones,
} from "@/services/templatesWhatsApp";

export default function TemplatesWhatsAppTab() {
  const [templates, setTemplates] = useState<TemplateWhatsApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWhatsApp | null>(null);
  const [editedContent, setEditedContent] = useState("");

  useEffect(() => {
    carregarTemplates();
  }, []);

  async function carregarTemplates() {
    setLoading(true);
    const { data, error } = await listarTemplates();
    if (error) {
      toast.error("Erro ao carregar templates");
    } else if (data) {
      setTemplates(data);
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
        setEditedContent(data[0].conteudo);
      }
    }
    setLoading(false);
  }

  function handleSelectTemplate(template: TemplateWhatsApp) {
    setSelectedTemplate(template);
    setEditedContent(template.conteudo);
  }

  async function handleSave() {
    if (!selectedTemplate) return;

    setSaving(true);
    const { success, error } = await atualizarTemplate(selectedTemplate.id, {
      conteudo: editedContent,
    });

    if (success) {
      toast.success("Template salvo com sucesso");
      carregarTemplates();
    } else {
      toast.error(error || "Erro ao salvar template");
    }
    setSaving(false);
  }

  function handleReset() {
    if (!selectedTemplate) return;
    
    const padrao = templatesPadrao[selectedTemplate.tipo];
    if (padrao) {
      setEditedContent(padrao);
      toast.info("Conteúdo restaurado para o padrão");
    }
  }

  async function handleToggleAtivo(template: TemplateWhatsApp) {
    const { success, error } = await atualizarTemplate(template.id, {
      ativo: !template.ativo,
    });

    if (success) {
      toast.success(template.ativo ? "Template desativado" : "Template ativado");
      carregarTemplates();
    } else {
      toast.error(error || "Erro ao atualizar status");
    }
  }

  const previewMensagem = selectedTemplate
    ? renderizarTemplate(editedContent, dadosExemplo)
    : "";

  const hasChanges = selectedTemplate && editedContent !== selectedTemplate.conteudo;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Templates de Mensagens WhatsApp</h2>
          <p className="text-sm text-muted-foreground">
            Personalize as mensagens automáticas enviadas aos pacientes
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de Templates */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Selecione um template</Label>
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all ${
                selectedTemplate?.id === template.id
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-muted-foreground/50"
              } ${!template.ativo ? "opacity-60" : ""}`}
              onClick={() => handleSelectTemplate(template)}
            >
              <CardHeader className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{tipoIcones[template.tipo] || "📝"}</span>
                    <div>
                      <CardTitle className="text-sm font-medium">{template.nome}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {template.descricao}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={template.ativo ? "default" : "secondary"} className="text-xs">
                    {template.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Editor de Template */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTemplate ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{selectedTemplate.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ativo" className="text-sm">Ativo</Label>
                      <Switch
                        id="ativo"
                        checked={selectedTemplate.ativo}
                        onCheckedChange={() => handleToggleAtivo(selectedTemplate)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Conteúdo da Mensagem</Label>
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="mt-2 min-h-[200px] font-mono text-sm"
                      placeholder="Digite o conteúdo da mensagem..."
                    />
                  </div>

                  {/* Variáveis Disponíveis */}
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Variáveis disponíveis
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplate.variaveis_disponiveis.map((variavel) => (
                        <Badge
                          key={variavel}
                          variant="outline"
                          className="font-mono text-xs cursor-pointer hover:bg-accent"
                          onClick={() => {
                            setEditedContent((prev) => prev + variavel);
                          }}
                        >
                          {variavel}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className="gap-2"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar Alterações
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restaurar Padrão
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">Preview da Mensagem</CardTitle>
                  </div>
                  <CardDescription>
                    Visualização com dados de exemplo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-[#e7ffd8] dark:bg-[#1b3d21] rounded-lg p-4 max-w-md shadow-sm">
                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                      {previewMensagem}
                    </pre>
                    <div className="text-right mt-2">
                      <span className="text-xs text-muted-foreground">09:00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Selecione um template para editar</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
