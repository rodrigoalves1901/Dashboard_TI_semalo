import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listDashboards, createWidget, type Dashboard, type ChartType } from "@/lib/data";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  connectionId: string;
  query: string;
}

export function SaveWidgetDialog({ open, onOpenChange, orgId, connectionId, query }: Props) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [dashboardId, setDashboardId] = useState("");
  const [chartType, setChartType] = useState<ChartType>("metric");

  useEffect(() => {
    if (open && orgId) {
      setLoading(true);
      listDashboards(orgId)
        .then(setDashboards)
        .catch((err) => toast.error("Erro ao carregar dashboards: " + err.message))
        .finally(() => setLoading(false));
    }
  }, [open, orgId]);

  const handleSave = async () => {
    if (!title) return toast.error("Digite um título para o widget");
    if (!dashboardId) return toast.error("Selecione um dashboard");

    setSaving(true);
    try {
      await createWidget({
        dashboardId,
        connectionId,
        title,
        chartType,
        preset: "custom_sql",
        refreshInterval: 60,
        content: query,
        position: null, // Let the grid handle it
      });
      toast.success("Widget criado com sucesso!");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao criar widget: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Salvar como Widget</DialogTitle>
          <DialogDescription>
            Escolha o dashboard e o tipo de gráfico para esta consulta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título do Widget</Label>
            <Input
              id="title"
              placeholder="Ex: Total de Chamados Abertos"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Selecionar Dashboard</Label>
            <Select value={dashboardId} onValueChange={setDashboardId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando..." : "Selecione um dashboard"} />
              </SelectTrigger>
              <SelectContent>
                {dashboards.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Tipo de Gráfico</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Métrica (Número)</SelectItem>
                <SelectItem value="bar">Gráfico de Barras</SelectItem>
                <SelectItem value="line">Gráfico de Linhas</SelectItem>
                <SelectItem value="donut">Gráfico Donut</SelectItem>
                <SelectItem value="table">Tabela de Dados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Widget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
