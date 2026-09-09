import { describe, it, expect, beforeEach } from "vitest";
import { isSuperAdmin } from "../src/lib/admin";

describe("isSuperAdmin", () => {
  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  it("fail-closed cuando ADMIN_EMAILS no esta configurado", () => {
    expect(isSuperAdmin("adrian@heredia.app")).toBe(false);
  });

  it("rechaza email vacio o null", () => {
    process.env.ADMIN_EMAILS = "adrian@heredia.app";
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
    expect(isSuperAdmin("")).toBe(false);
  });

  it("acepta email en la whitelist (single)", () => {
    process.env.ADMIN_EMAILS = "adrian@heredia.app";
    expect(isSuperAdmin("adrian@heredia.app")).toBe(true);
  });

  it("acepta email en lista separada por comas", () => {
    process.env.ADMIN_EMAILS = "adrian@heredia.app, sandra@heredia.app, ops@heredia.app";
    expect(isSuperAdmin("sandra@heredia.app")).toBe(true);
    expect(isSuperAdmin("ops@heredia.app")).toBe(true);
  });

  it("normaliza mayusculas/minusculas (case-insensitive)", () => {
    process.env.ADMIN_EMAILS = "adrian@heredia.app";
    expect(isSuperAdmin("ADRIAN@HEREDIA.APP")).toBe(true);
    expect(isSuperAdmin("Adrian@Heredia.App")).toBe(true);
  });

  it("rechaza email NO en la lista (incluso OWNER de cualquier despacho)", () => {
    process.env.ADMIN_EMAILS = "adrian@heredia.app";
    expect(isSuperAdmin("owner@otradespacho.es")).toBe(false);
    expect(isSuperAdmin("admin@gestoria.com")).toBe(false);
  });

  it("ignora espacios y entradas vacias en la lista", () => {
    process.env.ADMIN_EMAILS = "  adrian@heredia.app ,, ,sandra@heredia.app  ";
    expect(isSuperAdmin("adrian@heredia.app")).toBe(true);
    expect(isSuperAdmin("sandra@heredia.app")).toBe(true);
    expect(isSuperAdmin("")).toBe(false);
  });
});
