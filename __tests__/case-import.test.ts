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

describe("EXPECTED_HEADERS", () => {
  it("incluye las 11 cabeceras documentadas", () => {
    expect(EXPECTED_HEADERS).toHaveLength(11);
    expect(EXPECTED_HEADERS).toContain("fallecido");
    expect(EXPECTED_HEADERS).toContain("contacto");
    expect(EXPECTED_HEADERS).toContain("notas");
  });
});
