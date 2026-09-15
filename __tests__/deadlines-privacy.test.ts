/**
 * Plazos unificados y minimizacion de datos para la IA.
 *
 * Antes: `addMonths` usaba `setMonth`, que desborda a fin de mes; cada modulo
 * recalculaba el plazo por su cuenta (setMonth suelto, 180 dias fijos, 22 dias
 * naturales) dando resultados distintos; y el contexto enviado a Anthropic
 * incluia nombres, DNI, telefonos y emails, ademas de guardarse integro en
 * PromptLog.
 */
import { describe, it, expect } from "vitest";
import {
  addMonths,
  addBusinessDays,
  getCaseDeadlines,
  isdDeadlineFor,
  isdExtensionRequestDeadlineFor,
  canStillRequestIsdExtension,
} from "../src/lib/deadline-engine";
import {
  redactPii,
  pseudonymizeNames,
  minimizeContext,
  containsDirectIdentifiers,
  contextHash,
  aiEnabledFor,
} from "../src/lib/ai-privacy";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("addMonths: desbordamiento de fin de mes", () => {
  it("31 de enero + 1 mes es el 28 de febrero, no el 3 de marzo", () => {
    // `setMonth` daba 2026-03-03. En un plazo legal, tres dias de mas.
    expect(iso(addMonths(new Date("2026-01-31T00:00:00"), 1))).toBe("2026-02-28");
  });

  it("respeta los anyos bisiestos", () => {
    expect(iso(addMonths(new Date("2024-01-31T00:00:00"), 1))).toBe("2024-02-29");
  });

  it("31 de agosto + 6 meses es el 28 de febrero", () => {
    expect(iso(addMonths(new Date("2025-08-31T00:00:00"), 6))).toBe("2026-02-28");
  });

  it("31 de marzo + 1 mes es el 30 de abril", () => {
    expect(iso(addMonths(new Date("2026-03-31T00:00:00"), 1))).toBe("2026-04-30");
  });

  it("un dia que existe en el mes destino se conserva", () => {
    expect(iso(addMonths(new Date("2026-01-15T00:00:00"), 6))).toBe("2026-07-15");
  });

  it("cruza el cambio de anyo correctamente", () => {
    expect(iso(addMonths(new Date("2026-10-31T00:00:00"), 4))).toBe("2027-02-28");
  });

  it("no muta la fecha original", () => {
    const original = new Date("2026-01-31T00:00:00");
    addMonths(original, 6);
    expect(iso(original)).toBe("2026-01-31");
  });
});

describe("Fuente unica de plazos", () => {
  const muerte = new Date("2026-01-31T00:00:00");

  it("getCaseDeadlines y isdDeadlineFor dan el MISMO resultado", () => {
    expect(iso(getCaseDeadlines(muerte).isdDeadline)).toBe(iso(isdDeadlineFor(muerte)));
  });

  it("el plazo de prorroga es coherente entre helpers", () => {
    expect(iso(getCaseDeadlines(muerte).isdExtensionRequestDeadline)).toBe(
      iso(isdExtensionRequestDeadlineFor(muerte)),
    );
  });

  it("seis meses NO son 180 dias fijos", () => {
    // La aproximacion de 180 dias daba una fecha distinta segun el mes.
    const porEngine = isdDeadlineFor(muerte);
    const por180 = new Date(muerte.getTime() + 180 * 24 * 60 * 60 * 1000);
    expect(iso(porEngine)).not.toBe(iso(por180));
  });

  it("la prorroga vence antes que el plazo de presentacion", () => {
    expect(isdExtensionRequestDeadlineFor(muerte).getTime()).toBeLessThan(
      isdDeadlineFor(muerte).getTime(),
    );
  });
});

describe("Prorroga fuera de plazo", () => {
  it("es solicitable en los primeros meses", () => {
    const muerte = new Date();
    muerte.setMonth(muerte.getMonth() - 1);
    expect(canStillRequestIsdExtension(muerte)).toBe(true);
  });

  it("NO es solicitable pasados los 5 meses", () => {
    // Este es el caso que el producto recomendaba igualmente: cuando quedan
    // menos de 30 dias para el plazo de 6 meses, la ventana ya se cerro.
    const muerte = new Date();
    muerte.setMonth(muerte.getMonth() - 6);
    expect(canStillRequestIsdExtension(muerte)).toBe(false);
  });

  it("el limite es exactamente el mes 5", () => {
    const muerte = new Date("2026-01-15T00:00:00");
    const justoAntes = new Date("2026-06-14T00:00:00");
    const justoDespues = new Date("2026-06-16T00:00:00");
    expect(canStillRequestIsdExtension(muerte, justoAntes)).toBe(true);
    expect(canStillRequestIsdExtension(muerte, justoDespues)).toBe(false);
  });
});

describe("Dias habiles", () => {
  it("salta sabado y domingo", () => {
    // Viernes 2026-01-02 + 1 dia habil = lunes 2026-01-05.
    expect(iso(addBusinessDays(new Date("2026-01-02T00:00:00"), 1))).toBe("2026-01-05");
  });

  it("NO aplica calendario de festivos (documentado como tal)", () => {
    // 6 de enero es festivo nacional; el motor lo cuenta como habil. Es una
    // limitacion conocida y el copy debe reflejarla.
    const desde = new Date("2026-01-05T00:00:00"); // lunes
    expect(iso(addBusinessDays(desde, 1))).toBe("2026-01-06");
  });
});

describe("Minimizacion de datos hacia la IA", () => {
  it("elimina emails", () => {
    expect(redactPii("Contacto: ana.perez@gestoria.es")).not.toContain("ana.perez@");
  });

  it("elimina DNI y NIE", () => {
    expect(redactPii("DNI 12345678Z")).not.toContain("12345678Z");
    expect(redactPii("NIE X1234567L")).not.toContain("X1234567L");
  });

  it("elimina telefonos espanyoles con y sin prefijo", () => {
    expect(redactPii("Tel 612345678")).not.toContain("612345678");
    expect(redactPii("Tel +34 612 34 56 78")).not.toContain("612 34 56 78");
  });

  it("elimina IBAN", () => {
    expect(redactPii("Cuenta ES9121000418450200051332")).not.toContain("ES9121000418450200051332");
  });

  it("pseudonimiza el nombre del causante y del solicitante", () => {
    const texto = "Maria Garcia Lopez fallecio; contacto Juan Garcia";
    const out = pseudonymizeNames(texto, { deceased: "Maria Garcia Lopez", contact: "Juan Garcia" });
    expect(out).not.toContain("Maria Garcia Lopez");
    expect(out).toContain("[CAUSANTE]");
  });

  it("pseudonimiza apellidos sueltos en notas libres", () => {
    const out = pseudonymizeNames("Hablar con la Sra. Fernandez el lunes", {
      deceased: "Carmen Fernandez Ruiz",
    });
    expect(out).not.toContain("Fernandez");
  });

  it("minimizeContext deja el texto sin identificadores directos", () => {
    const contexto = `# Expediente EXP-2026-0001
Fallecido: Maria Garcia Lopez, DNI 12345678Z
Contacto: juan@familia.es, telefono 612345678
Notas: transferir de ES9121000418450200051332`;

    const out = minimizeContext(contexto, { deceased: "Maria Garcia Lopez", contact: "Juan Garcia" });

    expect(containsDirectIdentifiers(out)).toBe(false);
    expect(out).not.toContain("Maria Garcia Lopez");
    expect(out).not.toContain("juan@familia.es");
    expect(out).not.toContain("12345678Z");
    // La informacion util para el analisis SI se conserva.
    expect(out).toContain("EXP-2026-0001");
  });

  it("detecta identificadores en un texto sin minimizar", () => {
    expect(containsDirectIdentifiers("escribe a x@y.es")).toBe(true);
    expect(containsDirectIdentifiers("expediente sin datos personales")).toBe(false);
  });
});

describe("Huella del contexto en lugar del prompt", () => {
  it("es estable para la misma entrada", () => {
    expect(contextHash("contexto")).toBe(contextHash("contexto"));
  });

  it("cambia si cambia la entrada", () => {
    expect(contextHash("a")).not.toBe(contextHash("b"));
  });

  it("no permite recuperar el contenido (es un hash de 64 hex)", () => {
    const h = contextHash("Maria Garcia Lopez, DNI 12345678Z");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("Maria");
  });
});

describe("IA desactivada por defecto", () => {
  it("una organizacion sin configurar NO tiene IA activa", () => {
    expect(aiEnabledFor({ aiEnabled: false })).toBe(false);
    expect(aiEnabledFor({})).toBe(false);
    expect(aiEnabledFor(null)).toBe(false);
  });

  it("solo se activa con decision explicita", () => {
    expect(aiEnabledFor({ aiEnabled: true })).toBe(true);
  });
});
