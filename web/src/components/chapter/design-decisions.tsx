import type { DesignDecision } from "@/lib/types";
import { Card } from "@/components/ui/card";

/**
 * The Deep-Dive tab's content: a chapter's design decisions as a stack of
 * cards, each distilling one choice from the corresponding deepseek-harness
 * Agent Note — the decision made, the reasoning, and (critically) the
 * alternatives considered and rejected. This is analytical meta-content the
 * chapter's prose deliberately doesn't carry inline.
 */
export function DesignDecisions({ decisions, locale }: { decisions: DesignDecision[]; locale: "zh" | "en" }) {
  if (decisions.length === 0) return null;

  return (
    <div className="space-y-4">
      {decisions.map((decision) => (
        <Card key={decision.id}>
          <h3 className="mb-2 font-semibold">{decision.title[locale]}</h3>
          <p className="text-sm leading-relaxed text-[--color-text-muted]">{decision.description[locale]}</p>
          {decision.alternatives[locale] ? (
            <p className="mt-3 border-l-2 border-[--color-border] pl-3 text-xs leading-relaxed text-[--color-text-faint]">
              <span className="font-medium text-[--color-text-muted]">
                {locale === "zh" ? "考虑过的备选方案：" : "Alternatives considered: "}
              </span>
              {decision.alternatives[locale]}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
