import { Agendamento } from "@/services/agendamentos";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, MessageCircle, Phone, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AgendamentosTableProps {
  agendamentos: Agendamento[];
  onViewDetails: (agendamento: Agendamento) => void;
  onSendWhatsApp: (agendamento: Agendamento) => void;
  onEdit: (agendamento: Agendamento) => void;
  onDelete: (agendamento: Agendamento) => void;
  loading?: boolean;
}

const statusColors: Record<string, string> = {
  "NOVO LEAD": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "CLINICOR": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "HGP": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const AgendamentosTable = ({ agendamentos, onViewDetails, onSendWhatsApp, onEdit, onDelete, loading }: AgendamentosTableProps) => {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  if (agendamentos.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum agendamento encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Paciente</TableHead>
              <TableHead className="font-semibold">Telefone</TableHead>
              <TableHead className="font-semibold">Data/Hora</TableHead>
              <TableHead className="font-semibold">Tipo</TableHead>
              <TableHead className="font-semibold">Local</TableHead>
              <TableHead className="font-semibold">Convênio</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agendamentos.map((agendamento) => (
              <TableRow key={agendamento.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{agendamento.nome_completo}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{agendamento.telefone_whatsapp}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {agendamento.data_agendamento && agendamento.hora_agendamento ? (
                    <div className="text-sm">
                      <div className="font-medium">
                        {format(new Date(agendamento.data_agendamento), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <div className="text-muted-foreground">
                        {agendamento.hora_agendamento.slice(0, 5)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-amber-600 dark:text-amber-400 italic">
                      Aguardando
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{agendamento.tipo_atendimento}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm truncate max-w-[150px] block">
                    {agendamento.local_atendimento}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {agendamento.convenio === "Outro" ? agendamento.convenio_outro : agendamento.convenio}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={cn("font-medium", statusColors[agendamento.status_crm] || statusColors["NOVO LEAD"])}>
                    {agendamento.status_crm}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onSendWhatsApp(agendamento)}
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      title="WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewDetails(agendamento)}
                      className="h-8 w-8"
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(agendamento)}
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(agendamento)}
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AgendamentosTable;
