import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  csvToRows,
  xlsxToRows,
  parseSpreadsheet,
  EXPECTED_HEADERS,
} from "../src/lib/case-import";

function buildXlsxBase64(aoa: (string | number | null)[][]): string {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buffer.toString("base64");
}

const HEADER_ROW = [
  "fallecido",
  "contacto",
  "email_contacto",
  "telefono_contacto",
  "provincia",
  "categorias",
  "fecha_fallecimiento",
  "dni_fallecido",
  "parentesco",
  "urgente",
  "notas",
];

describe("csvToRows", () => {
  it("ignora filas vacías y trim cada celda", () => {
    const csv = `a,b\n  1 , 2 \n\n3,4`;
    expect(csvToRows(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("respeta comas dentro de comillas", () => {
    const csv = `nombre\n"García, María"`;
    expect(csvToRows(csv)).toEqual([["nombre"], ["García, María"]]);
  });

  it("acepta punto y coma como separador", () => {
    const csv = `a;b\n1;2`;
    expect(csvToRows(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("xlsxToRows", () => {
  it("lee la primera hoja con los datos correctos", () => {
    const base64 = buildXlsxBase64([
      ["fallecido", "contacto"],
      ["García López, María", "Pérez García, Antonio"],
    ]);
    const rows = xlsxToRows(base64);
    expect(rows).toEqual([
      ["fallecido", "contacto"],
      ["García López, María", "Pérez García, Antonio"],
    ]);
  });

  it("convierte celdas numéricas a string", () => {
    const base64 = buildXlsxBase64([
      ["dni"],
      [12345678],
    ]);
    const rows = xlsxToRows(base64);
    expect(rows[1][0]).toBe("12345678");
  });

  it("descarta filas completamente vacías", () => {
    const base64 = buildXlsxBase64([
      ["fallecido"],
      ["María"],
      ["", "", ""],
      ["José"],
    ]);
    const rows = xlsxToRows(base64);
    expect(rows.length).toBe(3);
    expect(rows[2][0]).toBe("José");
  });
});

describe("parseSpreadsheet", () => {
  it("acepta una fila válida y rellena defaults", () => {
    const rows = [
      HEADER_ROW,
      [
        "García López, María",
        "Pérez García, Antonio",
        "antonio@example.com",
        "+34612345678",
        "Madrid",
        "BANCOS,SEGUROS",
        "2026-04-01",
        "12345678A",
        "Hijo",
        "false",
        "Caso estándar",
      ],
    ];
    const result = parseSpreadsheet(rows);
    expect(result.headerIssue).toBeUndefined();
    expect(result.errors).toEqual([]);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].deceasedName).toBe("García López, María");
    expect(result.parsed[0].categories).toContain("BANCOS");
    expect(result.parsed[0].categories).toContain("SEGUROS");
    expect(result.parsed[0].isUrgent).toBe(false);
    expect(result.parsed[0].row).toBe(2);
  });

  it("interpreta 'urgente' en distintos formatos válidos", () => {
    const variants = ["true", "Sí", "sí", "SI", "1"];
    for (const value of variants) {
      const result = parseSpreadsheet([
        HEADER_ROW,
        ["María", "Antonio", "a@b.com", "", "", "", "", "", "", value, ""],
      ]);
      expect(result.errors).toEqual([]);
      expect(result.parsed[0].isUrgent).toBe(true);
    }
  });

  it("añade OTROS como categoría por defecto si no se indica ninguna", () => {
    const result = parseSpreadsheet([
      HEADER_ROW,
      ["María", "Antonio", "a@b.com", "", "", "", "", "", "", "", ""],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.parsed[0].categories).toEqual(["OTROS"]);
  });

  it("informa cuando faltan cabeceras obligatorias", () => {
    const result = parseSpreadsheet([
      ["fallecido", "email_contacto"],
      ["María", "a@b.com"],
    ]);
    expect(result.headerIssue).toMatch(/Cabeceras obligatorias/);
    expect(result.parsed).toEqual([]);
  });

  it("informa cuando no hay filas de datos", () => {
    const result = parseSpreadsheet([HEADER_ROW]);
    expect(result.headerIssue).toMatch(/al menos una cabecera/);
  });

  it("rechaza una fila sin contacto", () => {
    const result = parseSpreadsheet([
      HEADER_ROW,
      ["María", "", "a@b.com", "", "", "", "", "", "", "", ""],
    ]);
    expect(result.errors.some((e) => e.field === "contacto")).toBe(true);
    expect(result.parsed).toEqual([]);
  });

  it("rechaza una fila sin email ni teléfono", () => {
    const result = parseSpreadsheet([
      HEADER_ROW,
      ["María", "Antonio", "", "", "", "", "", "", "", "", ""],
    ]);
    expect(result.errors.some((e) => e.field === "email_contacto")).toBe(true);
  });

  it("rechaza una categoría inválida", () => {
    const result = parseSpreadsheet([
      HEADER_ROW,
      ["María", "Antonio", "a@b.com", "", "", "BASURA", "", "", "", "", ""],
    ]);
    expect(result.errors.some((e) => e.field === "categorias")).toBe(true);
  });

  it("rechaza una fecha mal formada", () => {
    const result = parseSpreadsheet([
      HEADER_ROW,
      ["María", "Antonio", "a@b.com", "", "", "", "no-es-fecha", "", "", "", ""],
    ]);
    expect(result.errors.some((e) => e.field === "fecha_fallecimiento")).toBe(true);
  });

  it("acepta cabeceras con tildes y mayúsculas", () => {
    const headerVariant = ["Fallecido", "Contacto", "Email_contacto", "Teléfono_contacto"];
    const result = parseSpreadsheet([
      headerVariant,
      ["María", "Antonio", "a@b.com", ""],
    ]);
    expect(result.headerIssue).toBeUndefined();
    expect(result.parsed).toHaveLength(1);
  });

  it("integra correctamente con xlsxToRows", () => {
    const base64 = buildXlsxBase64([
      HEADER_ROW,
      [
        "García López, María",
        "Pérez García, Antonio",
        "antonio@example.com",
        "",
        "Madrid",
        "BANCOS",
        "",
        "",
        "",
        "1",
        "",
      ],
    ]);
    const rows = xlsxToRows(base64);
    const result = parseSpreadsheet(rows);
    expect(result.errors).toEqual([]);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].isUrgent).toBe(true);
    expect(result.parsed[0].categories).toEqual(["BANCOS"]);
  });
});

/**
 * LINEA BASE DEL PARSEADOR DE HOJAS DE CALCULO, ANTES DE CAMBIARLO.
 *
 * POR QUE ESTAN ESTAS PRUEBAS
 * ---------------------------
 * `xlsx` (SheetJS) 0.18.5 arrastra dos vulnerabilidades ALTAS —GHSA-4r6h-8v6p-xvw6
 * y GHSA-5pgg-2g8v-p4x9— y la version corregida NO esta en el registro de npm:
 * hay que traerla de la distribucion oficial. Ese cambio esta pendiente.
 *
 * Cuando se haga, hara falta saber QUE comportamiento habia que conservar. La
 * pantalla de importacion anuncia `.xlsx,.xls,.csv,.txt`, pero de esos formatos
 * el `.xls` antiguo (BIFF8) no estaba cubierto por ninguna prueba, ni tampoco
 * las fechas. Se fija aqui, con el parseador REAL, para que una sustitucion que
 * lo rompa se vea al momento en vez de descubrirse con la hoja de un cliente.
 *
 * No comprueban seguridad: comprueban compatibilidad.
 */
describe("Compatibilidad del parseador (linea base para sustituir SheetJS)", () => {
  /** Igual que `buildXlsxBase64`, pero en el formato `.xls` antiguo. */
  function buildXlsLegacyBase64(aoa: (string | number | null)[][]): string {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "Expedientes");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "biff8" }) as Buffer;
    return buffer.toString("base64");
  }

  it("lee un .xls antiguo (BIFF8), que es un formato anunciado en la pantalla", () => {
    const base64 = buildXlsLegacyBase64([
      HEADER_ROW,
      [
        "Muñoz Ñáñez, José",
        "Íñigo Aróstegui",
        "inigo@example.com",
        "",
        "A Coruña",
        "BANCOS",
        "2026-03-14",
        "",
        "",
        "",
        "",
      ],
    ]);
    const result = parseSpreadsheet(xlsxToRows(base64));
    expect(result.errors).toEqual([]);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].deceasedName).toBe("Muñoz Ñáñez, José");
    expect(result.parsed[0].province).toBe("A Coruña");
  });

  it("conserva tildes, eñes y comas en los nombres", () => {
    const rows = xlsxToRows(
      buildXlsxBase64([
        ["fallecido", "contacto"],
        ["Peláez Muñoz, Ángel", "Núñez Ibáñez, Begoña"],
      ]),
    );
    expect(rows[1]).toEqual(["Peláez Muñoz, Ángel", "Núñez Ibáñez, Begoña"]);
  });

  it("una fecha se lee como texto interpretable, no como numero de serie", () => {
    /*
     * `xlsxToRows` lee con `cellDates: false` y `raw: false`: la celda debe
     * llegar formateada. Si volviera el numero de serie de Excel (45730 y
     * similares), `Date.parse` lo rechazaria y la fila se perderia con un
     * "Formato de fecha inválido" que el usuario no puede entender.
     */
    const rows = xlsxToRows(
      buildXlsxBase64([
        ["fallecido", "contacto", "email_contacto", "fecha_fallecimiento"],
        ["María", "Antonio", "antonio@example.com", "2026-03-14"],
      ]),
    );
    expect(rows[1][3]).toBe("2026-03-14");
    const result = parseSpreadsheet(rows);
    expect(result.errors).toEqual([]);
    expect(result.parsed[0].deathDate).toBe("2026-03-14");
  });

  it("una celda vacia en medio no desplaza las columnas siguientes", () => {
    // `defval: ""` es lo que lo sostiene: sin el, la fila llega corta y el
    // telefono acabaria leyendose como provincia.
    const rows = xlsxToRows(
      buildXlsxBase64([
        HEADER_ROW,
        ["María", "Antonio", "", "600111222", "Madrid", "", "", "", "", "", ""],
      ]),
    );
    const result = parseSpreadsheet(rows);
    expect(result.errors).toEqual([]);
    expect(result.parsed[0].contactEmail).toBe("");
    expect(result.parsed[0].contactPhone).toBe("600111222");
    expect(result.parsed[0].province).toBe("Madrid");
  });
});

describe("EXPECTED_HEADERS", () => {
  it("incluye las 11 cabeceras documentadas", () => {
    expect(EXPECTED_HEADERS).toHaveLength(11);
    expect(EXPECTED_HEADERS).toContain("fallecido");
    expect(EXPECTED_HEADERS).toContain("contacto");
    expect(EXPECTED_HEADERS).toContain("notas");
  });
});
