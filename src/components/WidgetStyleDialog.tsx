import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Palette, Bold, AlignCenter, AlignLeft, Type, RotateCw } from "lucide-react";
import type { WidgetStyles } from "@/lib/data";

type Props = {
  styles: WidgetStyles;
  onChange: (styles: WidgetStyles) => void;
};

export function WidgetStyleDialog({ styles, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const update = (patch: Partial<WidgetStyles>) => {
    onChange({ ...styles, ...patch });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="grid h-6 w-6 place-items-center rounded-md bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground"
          title="Customizar estilos"
        >
          <Palette size={13} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader>
          <DialogTitle className="text-base">Estilos do Widget</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Tamanho do Título */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Type size={14} /> Tamanho do Título
              </label>
              <span className="text-[10px] font-mono bg-secondary px-1 rounded">
                {Math.round((styles.titleSize || 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={styles.titleSize || 1}
              onChange={(e) => update({ titleSize: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </div>

          {/* Negrito e Alinhamento */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => update({ titleBold: !styles.titleBold })}
              className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors ${
                styles.titleBold
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <Bold size={14} /> Negrito
            </button>
            <button
              type="button"
              onClick={() => update({ centerTitle: !styles.centerTitle })}
              className={`flex h-9 w-12 items-center justify-center rounded-md border transition-colors ${
                styles.centerTitle
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary"
              }`}
              title="Centralizar Título"
            >
              {styles.centerTitle ? <AlignCenter size={16} /> : <AlignLeft size={16} />}
            </button>
            <button
              type="button"
              onClick={() => update({ centerValue: !styles.centerValue })}
              className={`flex h-9 w-12 items-center justify-center rounded-md border transition-colors ${
                styles.centerValue
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary"
              }`}
              title="Centralizar Valor"
            >
              {styles.centerValue ? <AlignCenter size={20} /> : <AlignLeft size={20} />}
            </button>
          </div>

          {/* Inclinar Nomes Eixo X */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => update({ rotateLabels: !styles.rotateLabels })}
              className={`flex h-9 w-full items-center justify-center gap-2 rounded-md border text-xs font-medium transition-colors ${
                styles.rotateLabels
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <RotateCw size={14} /> Inclinar Nomes (Eixo X)
            </button>
          </div>

          {/* Cor do Título */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Cor do Título</label>
            <div className="flex flex-wrap gap-2">
              {[
                undefined, // Default
                "#ef4444", // Red
                "#f97316", // Orange
                "#f59e0b", // Amber
                "#10b981", // Emerald
                "#0ea5e9", // Sky
                "#6366f1", // Indigo
                "#a855f7", // Purple
                "#71717a", // Zinc
              ].map((color) => (
                <button
                  key={color || "default"}
                  type="button"
                  onClick={() => update({ titleColor: color })}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    styles.titleColor === color ? "border-primary scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color || "var(--muted-foreground)" }}
                  title={color || "Padrão"}
                />
              ))}
              <input
                type="color"
                value={styles.titleColor || "#71717a"}
                onChange={(e) => update({ titleColor: e.target.value })}
                className="h-6 w-6 cursor-pointer rounded-full border-none bg-transparent p-0"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
