import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getAIConfig,
  upsertAIConfig,
  listDashboards,
  listWidgets,
  type AIConfig,
  type AIProvider,
  type Dashboard,
  type Widget,
} from "@/lib/data";
import { generateServerAICompletion } from "@/lib/explorer.functions";
import { fetchWidgetValue } from "@/lib/ai-helper";
import { toast } from "sonner";
import {
  Bot,
  Key,
  Mic,
  Clock,
  CheckSquare,
  Square,
  Play,
  StopCircle,
  Zap,
  ChevronDown,
  ChevronRight,
  Volume2,
  ToggleLeft,
  ToggleRight,
  Plus,
  X,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/ia")({
  component: AIPage,
});

// ── AI Provider metadata ──────────────────────────────────────────
const PROVIDERS: Record<AIProvider, { label: string; color: string; models: string[]; placeholder: string }> = {
  gemini: {
    label: "Google Gemini",
    color: "#4285f4",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    placeholder: "AIza...",
  },
  openai: {
    label: "OpenAI GPT",
    color: "#10a37f",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    placeholder: "sk-...",
  },
  claude: {
    label: "Anthropic Claude",
    color: "#c97b4b",
    models: [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307",
      "claude-3-opus-20240229"
    ],
    placeholder: "sk-ant-...",
  },
};

// ── AI narration logic ────────────────────────────────────────────
async function generateNarration(
  provider: AIProvider,
  apiKey: string,
  model: string,
  widgetData: { title: string; value: string }[],
  customPrompt?: string,
): Promise<string> {
  const defaultPrompt = `Você é um assistente analítico de business intelligence. Com base nos dados dos widgets abaixo, gere um relatório de voz conciso e profissional em português, em no máximo 3 parágrafos. Destaque tendências importantes e alertas relevantes. Seja direto e informativo.`;
  const instruction = customPrompt && customPrompt.trim() ? customPrompt.trim() : defaultPrompt;
  const prompt = `${instruction}\n\nDados dos widgets:\n${widgetData.map((w) => `• ${w.title}: ${w.value}`).join("\n")}`;

  return await generateServerAICompletion({
    data: {
      provider,
      apiKey,
      model,
      prompt,
    },
  });
}

function speakText(text: string, voice: string, rate: number, pitch: number): SpeechSynthesisUtterance {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "pt-BR";
  utt.rate = rate;
  utt.pitch = pitch;
  const voices = window.speechSynthesis.getVoices();
  const selected = voices.find((v) => v.name === voice) ?? voices.find((v) => v.lang.startsWith("pt")) ?? undefined;
  if (selected) utt.voice = selected;
  window.speechSynthesis.speak(utt);
  return utt;
}

// ── Component ─────────────────────────────────────────────────────
function AIPage() {
  const { currentOrg } = useAuth();
  const { isSuperAdmin } = usePermissions();

  // Config state
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields (local draft)
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState("08:00");
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>([]);
  const [ttsVoice, setTtsVoice] = useState("");
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [onlyCharts, setOnlyCharts] = useState(false);

  // Dashboard/widget browser
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [widgetsByDash, setWidgetsByDash] = useState<Record<string, Widget[]>>({});
  const [expandedDash, setExpandedDash] = useState<string | null>(null);
  const [loadingWidgets, setLoadingWidgets] = useState<string | null>(null);

  // TTS state
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [narrationText, setNarrationText] = useState("");

  // Scheduler ref
  const scheduleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Load voices ──────────────────────────────────────────────────
  useEffect(() => {
    const load = () => {
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("pt") || v.lang.startsWith("en"));
      setAvailableVoices(voices);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // ── Load config ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    getAIConfig(currentOrg.id)
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          setProvider(cfg.provider);
          setApiKey(cfg.apiKey);
          let loadedModel = cfg.model || PROVIDERS[cfg.provider].models[0];
          if (cfg.provider === "claude") {
            if (loadedModel === "claude-haiku-3-5" || loadedModel === "claude-3-5-haiku-latest") {
              loadedModel = "claude-3-5-haiku-20241022";
            }
            if (loadedModel === "claude-sonnet-4-5" || loadedModel === "claude-3-5-sonnet-latest") {
              loadedModel = "claude-3-5-sonnet-20241022";
            }
            if (loadedModel === "claude-opus-4-5" || loadedModel === "claude-3-opus-latest") {
              loadedModel = "claude-3-opus-20240229";
            }
          }
          setModel(loadedModel);
          setEnabled(cfg.enabled);
          setScheduleTimes(cfg.scheduleTimes);
          setSelectedWidgetIds(cfg.selectedWidgetIds);
          setTtsVoice(cfg.ttsVoice);
          setTtsRate(cfg.ttsRate);
          setTtsPitch(cfg.ttsPitch);
          setCustomPrompt(cfg.customPrompt || "");
          setOnlyCharts(cfg.onlyCharts || false);
        } else {
          setModel(PROVIDERS.gemini.models[0]);
          setCustomPrompt("");
          setOnlyCharts(false);
        }
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [currentOrg?.id]);

  // ── Load dashboards ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentOrg) return;
    listDashboards(currentOrg.id).then(setDashboards).catch(console.error);
  }, [currentOrg?.id]);

  // ── Load widgets for expanded dashboard ──────────────────────────
  const toggleDash = async (dashId: string) => {
    if (expandedDash === dashId) {
      setExpandedDash(null);
      return;
    }
    setExpandedDash(dashId);
    if (widgetsByDash[dashId]) return;
    setLoadingWidgets(dashId);
    try {
      const widgets = await listWidgets(dashId);
      setWidgetsByDash((prev) => ({ ...prev, [dashId]: widgets }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingWidgets(null);
    }
  };

  const toggleWidget = (widgetId: string) => {
    setSelectedWidgetIds((prev) =>
      prev.includes(widgetId) ? prev.filter((id) => id !== widgetId) : [...prev, widgetId],
    );
  };

  // ── Save ─────────────────────────────────────────────────────────
  const onSave = async () => {
    if (!currentOrg) return;
    setSaving(true);
    try {
      await upsertAIConfig(currentOrg.id, {
        provider, apiKey, model, enabled,
        scheduleTimes, selectedWidgetIds,
        ttsVoice, ttsRate, ttsPitch,
        customPrompt, onlyCharts,
      });
      toast.success("Configuração de IA salva!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Manual & Scheduled Narration Trigger ──────────────────────────
  const triggerNarration = useCallback(
    async (bypassEnabledCheck = false) => {
      if ((!enabled && !bypassEnabledCheck) || !apiKey || selectedWidgetIds.length === 0) return;
      setNarrating(true);
      try {
        // Collect widget data programmatically
        const allWidgets = Object.values(widgetsByDash).flat();
        const widgetData: { title: string; value: string }[] = [];

        for (const id of selectedWidgetIds) {
          let w = allWidgets.find((x) => x.id === id);
          if (!w) {
            // Fallback: search across all dashboards in DB if not loaded in UI state yet
            const orgId = currentOrg?.id;
            if (orgId) {
              for (const d of dashboards) {
                const wList = await listWidgets(d.id);
                const found = wList.find((x) => x.id === id);
                if (found) {
                  w = found;
                  break;
                }
              }
            }
          }

          if (w) {
            if (onlyCharts && !["bar", "line", "donut", "table", "composed"].includes(w.chartType)) {
              continue;
            }
            const val = await fetchWidgetValue(w);
            widgetData.push({
              title: w.title || "Widget sem título",
              value: val,
            });
          }
        }

        if (widgetData.length === 0) {
          throw new Error("Não foi possível carregar os dados de nenhum dos widgets selecionados após a filtragem.");
        }

        const text = await generateNarration(provider, apiKey, model, widgetData, customPrompt);
        setNarrationText(text);
        setSpeaking(true);
        const utt = speakText(text, ttsVoice, ttsRate, ttsPitch);
        utt.onend = () => setSpeaking(false);
        utt.onerror = () => setSpeaking(false);
      } catch (e) {
        toast.error(`Erro na narração IA: ${(e as Error).message}`);
      } finally {
        setNarrating(false);
      }
    },
    [
      enabled,
      apiKey,
      provider,
      model,
      selectedWidgetIds,
      widgetsByDash,
      dashboards,
      currentOrg?.id,
      ttsVoice,
      ttsRate,
      ttsPitch,
      customPrompt,
      onlyCharts,
    ],
  );


  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const addTime = () => {
    if (!scheduleTimes.includes(newTime)) {
      setScheduleTimes((prev) => [...prev, newTime].sort());
    }
  };

  const removeTime = (t: string) => setScheduleTimes((prev) => prev.filter((x) => x !== t));

  const onProviderChange = (p: AIProvider) => {
    setProvider(p);
    setModel(PROVIDERS[p].models[0]);
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Carregando configuração de IA...
      </div>
    );
  }

  const providerInfo = PROVIDERS[provider];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot size={26} className="text-primary" /> IA — Narração Inteligente
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure uma IA para ler e interpretar seus dashboards em voz alta em horários programados.
          </p>
        </div>
        <button
          onClick={() => setEnabled((e) => !e)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
            enabled
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground"
          }`}
        >
          {enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {enabled ? "Ativado" : "Desativado"}
        </button>
      </header>

      {/* Section 1 — AI Provider */}
      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Zap size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Provedor de IA</h2>
            <p className="text-xs text-muted-foreground">Escolha qual IA irá gerar os insights narrados.</p>
          </div>
        </div>

        {/* Provider pills */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROVIDERS) as AIProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => onProviderChange(p)}
              style={provider === p ? { borderColor: PROVIDERS[p].color, color: PROVIDERS[p].color } : {}}
              className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${
                provider === p
                  ? "bg-primary/5"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: PROVIDERS[p].color }}
              />
              {PROVIDERS[p].label}
            </button>
          ))}
        </div>

        {/* API Key + Model */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Key size={12} /> Chave de API
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={providerInfo.placeholder}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles size={12} /> Modelo
            </span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              {providerInfo.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Section 2 — Schedule */}
      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Clock size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Horários de Narração</h2>
            <p className="text-xs text-muted-foreground">
              A IA irá ler os widgets selecionados automaticamente nestes horários (enquanto o browser estiver aberto).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {scheduleTimes.map((t) => (
            <div
              key={t}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-sm font-semibold"
            >
              <Clock size={12} className="text-muted-foreground" />
              {t}
              <button onClick={() => removeTime(t)} className="ml-1 text-muted-foreground hover:text-destructive">
                <X size={12} />
              </button>
            </div>
          ))}
          {scheduleTimes.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum horário configurado.</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
          />
          <button
            onClick={addTime}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus size={14} /> Adicionar horário
          </button>
        </div>
      </section>

      {/* Section 3 — Widget Selection */}
      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <CheckSquare size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Widgets para Narração</h2>
            <p className="text-xs text-muted-foreground">
              Selecione quais widgets a IA deve ler. Clique em um dashboard para ver seus widgets.
            </p>
          </div>
          {selectedWidgetIds.length > 0 && (
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {selectedWidgetIds.length} selecionados
            </span>
          )}
        </div>

        <div className="space-y-2">
          {dashboards.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum dashboard encontrado.</p>
          )}
          {dashboards.map((dash) => (
            <div key={dash.id} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggleDash(dash.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
              >
                {expandedDash === dash.id ? (
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-semibold flex-1">{dash.name}</span>
                {widgetsByDash[dash.id] && (
                  <span className="text-xs text-muted-foreground">
                    {widgetsByDash[dash.id].filter((w) => selectedWidgetIds.includes(w.id)).length}/
                    {widgetsByDash[dash.id].length} selecionados
                  </span>
                )}
              </button>

              {expandedDash === dash.id && (
                <div className="border-t border-border divide-y divide-border/50">
                  {loadingWidgets === dash.id ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">Carregando widgets...</p>
                  ) : (widgetsByDash[dash.id] ?? []).length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground italic">
                      Nenhum widget neste dashboard.
                    </p>
                  ) : (
                    (widgetsByDash[dash.id] ?? []).map((widget) => {
                      const selected = selectedWidgetIds.includes(widget.id);
                      return (
                        <button
                          key={widget.id}
                          onClick={() => toggleWidget(widget.id)}
                          className="flex w-full items-center gap-3 px-6 py-2.5 text-left hover:bg-secondary/30 transition-colors"
                        >
                          {selected ? (
                            <CheckSquare size={16} className="shrink-0 text-primary" />
                          ) : (
                            <Square size={16} className="shrink-0 text-muted-foreground" />
                          )}
                          <span className={`text-sm flex-1 ${selected ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {widget.title || "(sem título)"}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 bg-secondary px-2 py-0.5 rounded-full">
                            {widget.chartType}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Section — Custom Prompt & Focus Behavior */}
      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Instruções Customizadas e Foco</h2>
            <p className="text-xs text-muted-foreground">
              Personalize o tom e as diretrizes da IA ou limite a leitura exclusivamente a gráficos complexos.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Diretrizes de Prompt Personalizado
            </span>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ex: Você é um diretor de operações focado em produtividade. Aponte desvios de forma enérgica e analise tendências..."
              rows={4}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 leading-relaxed placeholder:text-muted-foreground/45"
            />
            <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">
              Se deixado em branco, a IA usará as instruções padrão para gerar uma análise geral e profissional de business intelligence.
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 bg-secondary/15">
            <div className="space-y-0.5 max-w-lg">
              <span className="block text-sm font-semibold">Análise Focada em Gráficos</span>
              <span className="block text-xs text-muted-foreground leading-relaxed">
                Quando ativado, a IA analisará exclusivamente os widgets de tipo gráfico (barra, linha, donut, pizza, composto e tabelas), ignorando cartões de métrica simples, divisórias e blocos de texto livre.
              </span>
            </div>
            <button
              onClick={() => setOnlyCharts((c) => !c)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                onlyCharts
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {onlyCharts ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {onlyCharts ? "Focado em Gráficos" : "Todos os Widgets"}
            </button>
          </div>
        </div>
      </section>

      {/* Section 4 — Voice / TTS */}
      <section className="rounded-[14px] border border-border bg-card p-6 shadow-card space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Mic size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Configurações de Voz</h2>
            <p className="text-xs text-muted-foreground">
              Ajuste a voz, velocidade e tom da narração (Web Speech API — voz do sistema).
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Volume2 size={12} /> Voz
            </span>
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">Padrão do sistema</option>
              {availableVoices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Velocidade: {ttsRate.toFixed(1)}x
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={ttsRate}
              onChange={(e) => setTtsRate(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Tom: {ttsPitch.toFixed(1)}
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={ttsPitch}
              onChange={(e) => setTtsPitch(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>
        </div>

        {/* Test buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSpeaking(true);
              const utt = speakText("Olá! Estou configurado como seu assistente de dashboard. Os dados estão sendo analisados.", ttsVoice, ttsRate, ttsPitch);
              utt.onend = () => setSpeaking(false);
            }}
            disabled={speaking}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Play size={14} /> Testar voz
          </button>
          {speaking && (
            <button
              onClick={stopSpeaking}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-destructive/10 text-destructive px-4 text-sm font-semibold hover:bg-destructive/20"
            >
              <StopCircle size={14} /> Parar
            </button>
          )}
        </div>
      </section>

      {/* Section 5 — Manual Trigger & Preview */}
      {narrationText && (
        <section className="rounded-[14px] border border-primary/20 bg-primary/5 p-6 space-y-3">
          <h2 className="text-[13px] font-bold text-primary flex items-center gap-2">
            <Bot size={14} /> Última narração gerada
          </h2>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{narrationText}</p>
        </section>
      )}

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-6 py-4 shadow-card">
        <button
          onClick={() => triggerNarration(true)}
          disabled={narrating || speaking || !apiKey || selectedWidgetIds.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary text-primary px-4 text-sm font-semibold hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {narrating ? (
            <>
              <Bot size={16} className="animate-pulse" /> Gerando narração...
            </>
          ) : (
            <>
              <Play size={16} /> Narrar agora
            </>
          )}
        </button>

        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </div>
  );
}
