import { describe, it, expect } from "vitest";
import { buildReportHtml, escapeHtml } from "@/lib/report";

describe("escapeHtml", () => {
  it("neutralises markup", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("handles null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("buildReportHtml", () => {
  const base = {
    title: "MXRF11",
    subtitle: "Análise de 24/07/2026",
    highlight: { label: "Health Score", value: "78" },
    sections: [],
  };

  it("includes the title, highlight and disclaimer", () => {
    const html = buildReportHtml(base);
    expect(html).toContain("MXRF11");
    expect(html).toContain("Health Score");
    expect(html).toContain("78");
    expect(html).toContain("não constitui recomendação de investimento");
  });

  it("escapes model-provided content instead of injecting markup", () => {
    const html = buildReportHtml({
      ...base,
      sections: [
        {
          type: "list",
          title: "Pontos de atenção",
          items: ['<script>alert("xss")</script>'],
          tone: "danger",
        },
      ],
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders each section type", () => {
    const html = buildReportHtml({
      ...base,
      sections: [
        { type: "metrics", title: "Subcategorias", rows: [{ label: "Margem", value: "74/100" }] },
        { type: "timeline", title: "Linha do tempo", items: [{ date: "2026-05", event: "Resultado" }] },
        { type: "text", title: "Resumo", body: "Texto do resumo." },
      ],
    });
    expect(html).toContain("Margem");
    expect(html).toContain("74/100");
    expect(html).toContain("Resultado");
    expect(html).toContain("Texto do resumo.");
  });

  it("shows a fallback when a list is empty", () => {
    const html = buildReportHtml({
      ...base,
      sections: [{ type: "list", title: "Pontos de atenção", items: [], empty: "Nada consta." }],
    });
    expect(html).toContain("Nada consta.");
  });
});
