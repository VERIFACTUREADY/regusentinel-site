import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  identificacionResponsable,
  contactoPrivacidadTexto,
  faltanDatosLegales,
  CAMPOS_LEGALES_OBLIGATORIOS,
} from "@/lib/legal-entity";

/**
 * Datos de la entidad responsable.
 *
 * Los textos legales citaban "HEREDIA TECHNOLOGIES S.L." como titular de la
 * marca y responsable del tratamiento. Esa sociedad no existe: ninguna se ha
 * constituido todavia. Un aviso legal que nombra a una sociedad inexistente no
 * es un texto pendiente de pulir, es informacion falsa presentada como
 * vinculante ante clientes y ante la autoridad de proteccion de datos.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  for (const c of CAMPOS_LEGALES_OBLIGATORIOS) delete process.env[c];
  delete process.env.LEGAL_DPO_CONTACT;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("datos de la entidad legal", () => {
  it("sin configurar, dice que esta pendiente en vez de inventar", () => {
    const texto = identificacionResponsable();
    expect(texto).toContain("pendiente");
    // Ni sociedades inventadas ni marcadores cripticos a la vista del publico.
    expect(texto).not.toMatch(/S\.L\.|S\.A\./);
    expect(texto).not.toContain("DENOMINACION SOCIAL");
  });

  it("configurado, compone la identificacion completa", () => {
    process.env.LEGAL_ENTITY_NAME = "Ejemplo Sociedad Limitada";
    process.env.LEGAL_ENTITY_NIF = "B00000000";
    process.env.LEGAL_ENTITY_ADDRESS = "Calle Ejemplo 1, Madrid";

    expect(identificacionResponsable()).toBe(
      "Ejemplo Sociedad Limitada, con NIF B00000000 y domicilio en Calle Ejemplo 1, Madrid",
    );
  });

  it("con los datos a medias no publica una identificacion parcial", () => {
    // Media identificacion es peor que ninguna: parece completa.
    process.env.LEGAL_ENTITY_NAME = "Ejemplo Sociedad Limitada";
    expect(identificacionResponsable()).toContain("pendiente");
  });

  it("una variable en blanco cuenta como no definida", () => {
    process.env.LEGAL_ENTITY_NAME = "   ";
    process.env.LEGAL_ENTITY_NIF = "B00000000";
    process.env.LEGAL_ENTITY_ADDRESS = "Calle Ejemplo 1";
    expect(identificacionResponsable()).toContain("pendiente");
    expect(faltanDatosLegales()).toContain("LEGAL_ENTITY_NAME");
  });

  it("el contacto de privacidad tampoco se inventa", () => {
    expect(contactoPrivacidadTexto()).toContain("pendiente");
    process.env.LEGAL_PRIVACY_EMAIL = "privacidad@ejemplo.test";
    expect(contactoPrivacidadTexto()).toBe("privacidad@ejemplo.test");
  });

  it("enumera exactamente lo que falta", () => {
    expect(faltanDatosLegales()).toEqual([...CAMPOS_LEGALES_OBLIGATORIOS]);
    process.env.LEGAL_ENTITY_NAME = "Ejemplo SL";
    expect(faltanDatosLegales()).not.toContain("LEGAL_ENTITY_NAME");
  });

  it("el DPO no es obligatorio", () => {
    // Designarlo solo lo exige el articulo 37 del RGPD en ciertos supuestos, y
    // afirmar que hay uno cuando no lo hay seria otra invencion.
    expect(CAMPOS_LEGALES_OBLIGATORIOS).not.toContain("LEGAL_DPO_CONTACT");
  });
});

describe("la puerta de despliegue", () => {
  it("solo bloquea con una senal explicita de despliegue a produccion", () => {
    // NODE_ENV=production no basta: la suite E2E compila asi para probar el
    // artefacto real, y bloquear ahi impedia ejecutar las pruebas sin proteger
    // a nadie, porque ese build no lo ve ningun cliente.
    const script = readFileSync(
      join(process.cwd(), "scripts/check-legal-config.mjs"),
      "utf8",
    );
    expect(script).toContain('VERCEL_ENV === "production"');
    expect(script).toContain('DEPLOY_TARGET === "production"');
    expect(script).not.toMatch(/NODE_ENV\s*===\s*"production"/);
  });
});

describe("los textos publicados no contienen datos inventados", () => {
  const paginas = [
    "src/app/legal/privacidad/page.tsx",
    "src/app/legal/terminos/page.tsx",
    "src/app/legal/cookies/page.tsx",
    "src/app/contacto/page.tsx",
  ];

  it("ninguna nombra una sociedad escrita a mano", () => {
    const culpables: string[] = [];
    for (const ruta of paginas) {
      const contenido = readFileSync(join(process.cwd(), ruta), "utf8");
      // Una sociedad literal en el JSX: lo que habia antes.
      if (/[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,}(S\.L\.|S\.A\.|SOCIEDAD LIMITADA)/.test(contenido)) {
        culpables.push(ruta);
      }
    }
    expect(
      culpables,
      "Los datos societarios se leen de configuracion (src/lib/legal-entity.ts), " +
        "nunca se escriben en el texto.",
    ).toEqual([]);
  });

  it("ninguna deja marcadores a la vista del publico", () => {
    const culpables: string[] = [];
    for (const ruta of paginas) {
      const contenido = readFileSync(join(process.cwd(), ruta), "utf8");
      if (/\[DENOMINACION|\[NIF\]|\[DOMICILIO|\[RAZON/.test(contenido)) {
        culpables.push(ruta);
      }
    }
    expect(culpables).toEqual([]);
  });
});
