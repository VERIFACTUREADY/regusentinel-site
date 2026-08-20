import { describe, it, expect } from "vitest";
import {
  diaCivilES,
  partesCivilesES,
  inicioDelDiaES,
  inicioDelDiaDeES,
  finDelDiaDeES,
  sumarDiasES,
  diasCivilesEntreES,
  diaSemanaES,
} from "@/lib/fecha-es";

/**
 * Estas pruebas fijan el comportamiento que faltaba en /dashboard y /today.
 *
 * Se escriben con instantes UTC explícitos porque ése es el caso real: el
 * servidor de Vercel y el de la CI corren en UTC, y el usuario está en Madrid.
 * Si alguien vuelve a meter `getDate()` o `setHours(0,0,0,0)` en esas
 * pantallas, alguna de estas afirmaciones se cae.
 */
describe("fecha-es: el día que ve el usuario español", () => {
  it("verano: las 23:30 UTC ya son el día siguiente en Madrid", () => {
    // 2026-08-20T23:30:00Z = 21 de agosto, 01:30 en Madrid (CEST, +02:00).
    const instante = new Date("2026-08-20T23:30:00.000Z");
    expect(diaCivilES(instante)).toBe("2026-08-21");
    expect(partesCivilesES(instante)).toEqual({ anio: 2026, mes: 8, dia: 21 });
    // Éste es EXACTAMENTE el fallo del calendario del panel: con la hora local
    // del servidor en UTC salía el día 20.
    expect(instante.getUTCDate()).toBe(20);
  });

  it("invierno: las 23:30 UTC también son el día siguiente en Madrid", () => {
    // 2026-01-15T23:30:00Z = 16 de enero, 00:30 en Madrid (CET, +01:00).
    const instante = new Date("2026-01-15T23:30:00.000Z");
    expect(diaCivilES(instante)).toBe("2026-01-16");
  });

  it("mediodía UTC coincide con el mismo día civil", () => {
    expect(diaCivilES(new Date("2026-08-20T12:00:00.000Z"))).toBe("2026-08-20");
    expect(diaCivilES(new Date("2026-01-15T12:00:00.000Z"))).toBe("2026-01-15");
  });

  it("cruza el fin de mes", () => {
    // 2026-08-31T22:15:00Z = 1 de septiembre, 00:15 en Madrid.
    expect(diaCivilES(new Date("2026-08-31T22:15:00.000Z"))).toBe("2026-09-01");
  });

  it("cruza el fin de año", () => {
    // 2026-12-31T23:30:00Z = 1 de enero de 2027, 00:30 en Madrid.
    expect(diaCivilES(new Date("2026-12-31T23:30:00.000Z"))).toBe("2027-01-01");
    expect(partesCivilesES(new Date("2026-12-31T23:30:00.000Z")).anio).toBe(2027);
  });
});

describe("fecha-es: comienzo y fin del día", () => {
  it("en verano la medianoche de Madrid son las 22:00 UTC del día anterior", () => {
    expect(inicioDelDiaES(2026, 8, 21).toISOString()).toBe("2026-08-20T22:00:00.000Z");
  });

  it("en invierno la medianoche de Madrid son las 23:00 UTC del día anterior", () => {
    expect(inicioDelDiaES(2026, 1, 16).toISOString()).toBe("2026-01-15T23:00:00.000Z");
  });

  it("el día del cambio a horario de verano empieza igual a medianoche", () => {
    // En 2026 el cambio es el domingo 29 de marzo: a las 02:00 se salta a las
    // 03:00. La medianoche sigue siendo la medianoche (aún +01:00).
    expect(inicioDelDiaES(2026, 3, 29).toISOString()).toBe("2026-03-28T23:00:00.000Z");
    // Y el día siguiente ya va en +02:00.
    expect(inicioDelDiaES(2026, 3, 30).toISOString()).toBe("2026-03-29T22:00:00.000Z");
  });

  it("el día del cambio a horario de invierno empieza igual a medianoche", () => {
    // Domingo 25 de octubre de 2026: a las 03:00 se vuelve a las 02:00.
    expect(inicioDelDiaES(2026, 10, 25).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(inicioDelDiaES(2026, 10, 26).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("el día del cambio de hora dura 23 o 25 horas, y el fin del día lo respeta", () => {
    const enMarzo = new Date("2026-03-29T10:00:00.000Z");
    const duracionMarzo =
      finDelDiaDeES(enMarzo).getTime() + 1 - inicioDelDiaDeES(enMarzo).getTime();
    expect(duracionMarzo).toBe(23 * 3600000);

    const enOctubre = new Date("2026-10-25T10:00:00.000Z");
    const duracionOctubre =
      finDelDiaDeES(enOctubre).getTime() + 1 - inicioDelDiaDeES(enOctubre).getTime();
    expect(duracionOctubre).toBe(25 * 3600000);
  });

  it("el fin del día es el último milisegundo, no el primero del siguiente", () => {
    const instante = new Date("2026-08-20T12:00:00.000Z");
    expect(finDelDiaDeES(instante).toISOString()).toBe("2026-08-20T21:59:59.999Z");
  });

  it("una tarea de las 00:30 de Madrid cae DENTRO de su propio día", () => {
    // Es el caso que hacía que «Para hoy» mostrara las tareas de ayer.
    const tarea = new Date("2026-08-20T22:30:00.000Z"); // 21 de agosto, 00:30
    const momentoDelDia21 = new Date("2026-08-21T09:00:00.000Z");
    expect(tarea >= inicioDelDiaDeES(momentoDelDia21)).toBe(true);
    expect(tarea <= finDelDiaDeES(momentoDelDia21)).toBe(true);
  });
});

describe("fecha-es: aritmética de calendario", () => {
  it("sumar 7 días cruzando el cambio de hora no se desvía una hora", () => {
    const partida = new Date("2026-10-22T12:00:00.000Z"); // jueves 22 de octubre
    const siete = sumarDiasES(partida, 7);
    // 29 de octubre a las 00:00 de Madrid, ya en horario de invierno.
    expect(siete.toISOString()).toBe("2026-10-28T23:00:00.000Z");
    expect(diaCivilES(siete)).toBe("2026-10-29");
    // Con la aritmética antigua (`+ 7 * 86400000`) habría dado las 23:00 del 28.
    const ingenuo = new Date(partida.getTime() + 7 * 86400000);
    expect(diaCivilES(ingenuo)).toBe("2026-10-29");
    expect(ingenuo.getTime()).not.toBe(siete.getTime());
  });

  it("sumar días desborda de mes y de año", () => {
    expect(diaCivilES(sumarDiasES(new Date("2026-08-30T12:00:00Z"), 3))).toBe("2026-09-02");
    expect(diaCivilES(sumarDiasES(new Date("2026-12-30T12:00:00Z"), 3))).toBe("2027-01-02");
    expect(diaCivilES(sumarDiasES(new Date("2026-03-02T12:00:00Z"), -3))).toBe("2026-02-27");
  });

  it("cuenta días de calendario, no bloques de 24 horas", () => {
    // Faltan minutos para medianoche pero, en el calendario, ya es un día.
    const hoy = new Date("2026-08-20T21:00:00.000Z"); // 23:00 de Madrid
    const manana = new Date("2026-08-20T22:30:00.000Z"); // 00:30 del día 21
    expect(diasCivilesEntreES(hoy, manana)).toBe(1);
    // La diferencia real es de hora y media: dividir por 86400000 daría 0.
    expect(Math.floor((manana.getTime() - hoy.getTime()) / 86400000)).toBe(0);
  });

  it("el mismo día civil son cero días", () => {
    expect(
      diasCivilesEntreES(
        new Date("2026-08-20T06:00:00Z"),
        new Date("2026-08-20T20:00:00Z"),
      ),
    ).toBe(0);
  });

  it("hacia atrás da negativo", () => {
    expect(
      diasCivilesEntreES(
        new Date("2026-08-25T12:00:00Z"),
        new Date("2026-08-20T12:00:00Z"),
      ),
    ).toBe(-5);
  });

  it("cuenta bien cruzando el cambio de hora", () => {
    expect(
      diasCivilesEntreES(
        new Date("2026-10-24T12:00:00Z"),
        new Date("2026-10-26T12:00:00Z"),
      ),
    ).toBe(2);
    expect(
      diasCivilesEntreES(
        new Date("2026-03-28T12:00:00Z"),
        new Date("2026-03-30T12:00:00Z"),
      ),
    ).toBe(2);
  });
});

describe("fecha-es: día de la semana", () => {
  it("devuelve el día español, no el del servidor", () => {
    // 2026-08-20 es jueves. A las 23:30 UTC en Madrid ya es viernes 21.
    expect(diaSemanaES(new Date("2026-08-20T12:00:00.000Z"))).toBe(4); // jueves
    expect(diaSemanaES(new Date("2026-08-20T23:30:00.000Z"))).toBe(5); // viernes
  });

  it("domingo es 0 y sábado es 6", () => {
    expect(diaSemanaES(new Date("2026-08-23T12:00:00.000Z"))).toBe(0); // domingo
    expect(diaSemanaES(new Date("2026-08-22T12:00:00.000Z"))).toBe(6); // sábado
  });
});
