import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, RotateCcw, Eye, MessageSquare, Loader2, Send, FlaskConical } from "lucide-react";
import {
  TemplateWhatsApp,
  listarTemplates,
  atualizarTemplate,
  renderizarTemplate,
  dadosExemplo,
  templatesPadrao,
  tipoIcones,
} from "@/services/templatesWhatsApp";
import { enviarMensagemWhatsApp } from "@/services/integracoes";

// --- WhatsApp markdown light renderer ---
function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderWhatsAppMarkdown(text: string): { __html: string } {
  const escaped = escapeHtml(text);
  const html = escaped
    // links primeiro (antes do *negrito* não confundir)
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener" class="underline break-all">$1</a>'
    )
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>");
  return { __html: html };
}

function normalizarTelefoneTeste(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

const STORAGE_KEY_TELEFONE = "templates_teste_telefone";

export default function TemplatesWhatsAppTab() {
  const [templates, setTemplates] = useState<TemplateWhatsApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWhatsApp | null>(null);
  const [editedContent, setEditedContent] = useState("");

  // Test send state
  const [testeTelefone, setTesteTelefone] = useState("");
  const [testeTemplateId, setTesteTemplateId] = useState<string>("");
  const [enviandoTeste, setEnviandoTeste] = useState(false);

  useEffect(() => {
    carregarTemplates();
    const saved = localStorage.getItem(STORAGE_KEY_TELEFONE);
    if (saved) setTesteTelefone(saved);
  }, []);

  // Sync test template selection com o template selecionado para edição
  useEffect(() => {
    if (selectedTemplate && !testeTemplateId) {
      setTesteTemplateId(selectedTemplate.id);
    }
  }, [selectedTemplate, testeTemplateId]);

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
    } else {
      toast.error("Não há conteúdo padrão para esse tipo");
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

  async function handleEnviarTeste() {
    const telefoneNormalizado = normalizarTelefoneTeste(testeTelefone);
    if (!telefoneNormalizado) {
      toast.error("Número inválido. Use o formato 5591999999999.");
      return;
    }

    const templateAlvo = templates.find((t) => t.id === testeTemplateId);
    if (!templateAlvo) {
      toast.error("Selecione um template para enviar.");
      return;
    }

    // Se o template selecionado pra teste é o mesmo que está aberto no editor,
    // usa o `editedContent` (mesmo se não foi salvo) — assim o usuário testa as mudanças.
    const conteudoBruto =
      selectedTemplate?.id === templateAlvo.id ? editedContent : templateAlvo.conteudo;
    const mensagem = renderizarTemplate(conteudoBruto, dadosExemplo);

    setEnviandoTeste(true);
    localStorage.setItem(STORAGE_KEY_TELEFONE, testeTelefone);

    const { success, error } = await enviarMensagemWhatsApp(telefoneNormalizado, mensagem, {
      campaign: "teste_template",
      priority: "high",
    });

    if (success) {
      toast.success(`Mensagem de teste enviada para ${telefoneNormalizado}`);
    } else {
      toast.error(error || "Falha ao enviar mensagem de teste");
    }
    setEnviandoTeste(false);
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
                    Visualização com dados de exemplo (formatação WhatsApp aplicada)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Fundo simulando WhatsApp escuro */}
                  <div className="rounded-lg p-4 bg-[#0b141a] border border-border/40">
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-br-sm px-3 py-2 max-w-md shadow-md bg-[#005c4b]">
                        <div
                          className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-[#e9edef]"
                          dangerouslySetInnerHTML={renderWhatsAppMarkdown(previewMensagem)}
                        />
                        <div className="text-right mt-1 flex items-center justify-end gap-1">
                          <span className="text-[10px] text-[#8696a0]">09:00</span>
                          <span className="text-[10px] text-[#53bdeb]">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Envio de Teste */}
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Enviar Teste</CardTitle>
                  </div>
                  <CardDescription>
                    Envie a mensagem renderizada (com dados de exemplo) para um número real e veja
                    como o paciente irá recebê-la.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="teste-template" className="text-sm">
                        Template a enviar
                      </Label>
                      <Select value={testeTemplateId} onValueChange={setTesteTemplateId}>
                        <SelectTrigger id="teste-template">
                          <SelectValue placeholder="Selecione um template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="mr-2">{tipoIcones[t.tipo] || "📝"}</span>
                              {t.nome}
                              {!t.ativo && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (inativo)
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="teste-telefone" className="text-sm">
                        Número de WhatsApp
                      </Label>
                      <Input
                        id="teste-telefone"
                        placeholder="Ex: 5591999999999"
                        value={testeTelefone}
                        onChange={(e) => setTesteTelefone(e.target.value)}
                        inputMode="tel"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    💡 Se o template escolhido para teste é o mesmo que está aberto no editor, a
                    mensagem usa o conteúdo atual (mesmo sem salvar). Caso contrário, usa o
                    conteúdo salvo no banco.
                  </p>

                  <Button
                    onClick={handleEnviarTeste}
                    disabled={enviandoTeste || !testeTelefone || !testeTemplateId}
                    className="gap-2"
                  >
                    {enviandoTeste ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Enviar Teste
                  </Button>
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
