import { useEffect, useRef } from "react";
import { getAIConfig, listDashboards, listWidgets, type Widget } from "@/lib/data";
import { fetchWidgetValue } from "@/lib/ai-helper";
import { generateServerAICompletion } from "@/lib/explorer.functions";
import { toast } from "sonner";

/**
 * Custom hook to run AI Narration schedule checks in the background.
 * Triggers voice narration using real-world data programmatically without DOM dependency.
 */
export function useAIScheduler(orgId: string | undefined) {
  const scheduleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const checkAndTrigger = async () => {
      try {
        const config = await getAIConfig(orgId);
        if (
          !config ||
          !config.enabled ||
          !config.apiKey ||
          config.scheduleTimes.length === 0 ||
          config.selectedWidgetIds.length === 0
        ) {
          return;
        }

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        // Ensure we match the time and haven't triggered in this exact minute yet
        if (
          config.scheduleTimes.includes(currentTime) &&
          lastTriggeredRef.current !== currentTime
        ) {
          lastTriggeredRef.current = currentTime;
          console.log(
            `[AI Scheduler] Time match found: ${currentTime}. Activating background voice report...`,
          );

          toast.info("🤖 IA: Iniciando narração de voz agendada...", {
            description: "Carregando dados consolidados dos widgets selecionados.",
            duration: 5000,
          });

          // 1. Fetch real dashboard widgets programmatically in background
          const dashboards = await listDashboards(orgId);
          let allWidgets: Widget[] = [];
          for (const d of dashboards) {
            const wList = await listWidgets(d.id);
            allWidgets = [...allWidgets, ...wList];
          }

          const selectedWidgets = allWidgets.filter((w) => config.selectedWidgetIds.includes(w.id));
          const widgetData: { title: string; value: string }[] = [];

          for (const widget of selectedWidgets) {
            if (
              config.onlyCharts &&
              !["bar", "line", "donut", "table", "composed"].includes(widget.chartType)
            ) {
              continue;
            }
            const val = await fetchWidgetValue(widget);
            widgetData.push({
              title: widget.title || "Widget sem título",
              value: val,
            });
          }

          if (widgetData.length === 0) {
            console.warn(
              "[AI Scheduler] No widget data could be gathered for selected widgets after filtering.",
            );
            return;
          }

          // 2. Request completion via secure Server Function
          const defaultPrompt = `Você é um assistente analítico de business intelligence. Com base nos dados dos widgets abaixo, gere um relatório de voz conciso e profissional em português, em no máximo 3 parágrafos. Destaque tendências importantes e alertas relevantes. Seja direto e informativo.`;
          const instruction =
            config.customPrompt && config.customPrompt.trim()
              ? config.customPrompt.trim()
              : defaultPrompt;
          const prompt = `${instruction}\n\nDados dos widgets:\n${widgetData.map((w) => `• ${w.title}: ${w.value}`).join("\n")}`;

          let currentModel = config.model || "";
          if (config.provider === "claude") {
            if (currentModel === "claude-haiku-3-5" || currentModel === "claude-3-5-haiku-latest") {
              currentModel = "claude-3-5-haiku-20241022";
            }
            if (
              currentModel === "claude-sonnet-4-5" ||
              currentModel === "claude-3-5-sonnet-latest"
            ) {
              currentModel = "claude-3-5-sonnet-20241022";
            }
            if (currentModel === "claude-opus-4-5" || currentModel === "claude-3-opus-latest") {
              currentModel = "claude-3-opus-20240229";
            }
          }

          const text = await generateServerAICompletion({
            data: {
              provider: config.provider,
              apiKey: config.apiKey,
              model: currentModel,
              prompt,
            },
          });

          // 3. Play voice narration in the browser
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(text);
          utt.lang = "pt-BR";
          utt.rate = config.ttsRate || 1.0;
          utt.pitch = config.ttsPitch || 1.0;

          const voices = window.speechSynthesis.getVoices();
          const selected =
            voices.find((v) => v.name === config.ttsVoice) ??
            voices.find((v) => v.lang.startsWith("pt")) ??
            undefined;

          if (selected) utt.voice = selected;

          window.speechSynthesis.speak(utt);

          toast.success("🤖 IA: Relatório de voz iniciado!", {
            description: "Ouça o resumo do seu dashboard gerado por inteligência artificial.",
            duration: 8000,
          });
        }
      } catch (err) {
        console.error("[AI Scheduler] Error during background check and trigger:", err);
      }
    };

    // Check once per minute
    scheduleIntervalRef.current = setInterval(checkAndTrigger, 60000);

    // Run once immediately on mount to catch the minute if we loaded exactly on schedule
    void checkAndTrigger();

    return () => {
      if (scheduleIntervalRef.current) {
        clearInterval(scheduleIntervalRef.current);
      }
    };
  }, [orgId]);
}
