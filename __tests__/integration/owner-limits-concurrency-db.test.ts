/**
 * CONCURRENCIA REAL CONTRA POSTGRESQL.
 *
 * Estas pruebas no mockean Prisma. Se ejecutan contra la base indicada en
 * DATABASE_URL y lanzan peticiones **simultaneas** a los handlers reales. Es el
 * unico modo de demostrar que las protecciones aguantan: una prueba con Prisma
 * mockeado no puede fallar por una condicion de carrera porque no llega a haber
 * dos transacciones de verdad.
 *
 * Lo unico simulado es la identidad de quien llama (`getServerSession`), que en
 * una peticion HTTP real aporta la cookie. Se resuelve mediante
 * `AsyncLocalStorage`, asi que dos peticiones concurrentes pueden actuar como
 * usuarios DISTINTOS sin pisarse — un `mockResolvedValue` compartido no lo
 * permitiria. Todo lo demas —transacciones, advisory locks, restricciones
 * unicas, recuentos— es la base de datos.
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 *   - "dos OWNER se dan de baja a la vez": sin `pg_advisory_xact_lock`, ambas
 *     transacciones leen `ownerCount = 2` en READ COMMITTED, ambas concluyen
 *     que pueden continuar, y la organizacion se queda con CERO owners y sin
 *     nadie que pueda facturar, invitar ni recuperar el acceso.
 *   - "invitaciones simultaneas": sin lock, N invitaciones leen el mismo
 *     recuento de miembros y todas pasan el tope del plan.
 *   - "invitacion rechazada": cuando el `User` se creaba fuera de la
 *     transaccion, una invitacion rechazada por el tope dejaba la cuenta creada
 *     en la base con un magic token valido siete dias y sin ninguna membresia.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

/**
 * Identidad por peticion. `vi.hoisted` es necesario porque las factorias de
 * `vi.mock` se elevan por encima de los imports.
 */
interface Identidad {
  userId: string;
  orgId: string | null;
}

const { identidad } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  return {
    identidad: new AsyncLocalStorage() as InstanceType<
      typeof import("node:async_hooks").AsyncLocalStorage<Identidad>
    >,
  };
});

vi.mock("next-auth", () => ({
  getServerSession: async () => {
    const actual = identidad.getStore();
    if (!actual) return null;
    return { user: { id: actual.userId, email: "sesion@ejemplo.test", orgId: actual.orgId } };
  },
}));
vi.mock("../../src/lib/auth", () => ({ authOptions: {} }));
// El correo es un efecto externo: su fallo no debe enmascarar el resultado.
vi.mock("../../src/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));

import { prisma, resetDatabase } from "./helpers/db";
import { DELETE as deleteMember, PATCH as patchMember } from "../../src/app/api/users/[id]/route";
import { POST as inviteUser } from "../../src/app/api/users/route";
import { DELETE as deleteAccount } from "../../src/app/api/account/me/route";
import { userLimitFor } from "../../src/lib/plan-limits";

/** Ejecuta `fn` como si la peticion la firmase `userId` en `orgId`. */
function como<T>(userId: string, orgId: string | null, fn: () => Promise<T>): Promise<T> {
  return identidad.run({ userId, orgId }, fn);
}

const PASSWORD = "Contrasena-De-Prueba-1";
let passwordHash = "";

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 4);
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;

/** Organizacion con suscripcion activa y N owners con contrasena utilizable. */
async function orgConOwners(cuantos: number, plan: "INICIA" | "DESPACHO" | "FIRMA" = "FIRMA") {
  seq++;
  const slug = `conc-${seq}-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: `Org ${slug}`,
      slug,
      subscription: { create: { plan, status: "active" } },
    },
  });

  const owners = [];
  for (let i = 0; i < cuantos; i++) {
    const user = await prisma.user.create({
      data: { email: `owner${i}-${slug}@ejemplo.test`, name: `Owner ${i}`, passwordHash },
    });
    await prisma.membership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });
    owners.push(user);
  }

  return { org, owners };
}

function peticionInvitacion(email: string, role = "OPERATOR") {
  return new NextRequest("http://localhost/api/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

/** Cada llamada usa una IP distinta: el borrado de cuenta va rate-limitado. */
let ipSeq = 0;
function peticionBaja() {
  ipSeq++;
  return new NextRequest("http://localhost/api/account/me", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.9.${Math.floor(ipSeq / 250)}.${ipSeq % 250}`,
    },
    body: JSON.stringify({ password: PASSWORD, confirmText: "BORRAR MI CUENTA" }),
  });
}

describe("Ultimo OWNER bajo concurrencia real", () => {
  /**
   * El escenario que la auditoria describe: dos titulares ejerciendo su derecho
   * de supresion a la vez. Es el unico camino por el que el recuento puede
   * llegar a CERO, porque `DELETE /api/users/[id]` nunca permite auto-borrarse
   * y el actor siempre sobrevive.
   */
  it("dos OWNER dandose de baja simultaneamente: uno pasa, el otro recibe 409", async () => {
    const { org, owners } = await orgConOwners(2);
    const [a, b] = owners;

    const [r1, r2] = await Promise.all([
      como(a.id, org.id, () => deleteAccount(peticionBaja())),
      como(b.id, org.id, () => deleteAccount(peticionBaja())),
    ]);

    const restantes = await prisma.membership.count({ where: { orgId: org.id, role: "OWNER" } });
    expect(restantes).toBe(1);

    const estados = [r1.status, r2.status].sort();
    expect(estados).toEqual([200, 409]);
  });

  it("cinco OWNER dandose de baja simultaneamente dejan exactamente uno", async () => {
    const { org, owners } = await orgConOwners(5);

    const respuestas = await Promise.all(
      owners.map((o) => como(o.id, org.id, () => deleteAccount(peticionBaja()))),
    );

    const restantes = await prisma.membership.count({ where: { orgId: org.id, role: "OWNER" } });
    expect(restantes).toBe(1);
    expect(respuestas.filter((r) => r.status === 200).length).toBe(4);
    expect(respuestas.filter((r) => r.status === 409).length).toBe(1);
  });

  /**
   * Mezcla de los dos caminos: un OWNER se da de baja mientras otro OWNER es
   * degradado desde la gestion de miembros. Sin un lock COMPARTIDO por
   * organizacion entre ambos endpoints, las dos operaciones se creen seguras
   * por separado y el resultado combinado deja cero owners.
   */
  it("baja de un OWNER y degradacion de otro a la vez dejan al menos un OWNER", async () => {
    const { org, owners } = await orgConOwners(3);
    const [a, b, c] = owners;

    await Promise.all([
      como(a.id, org.id, () => deleteAccount(peticionBaja())),
      como(c.id, org.id, () =>
        patchMember(
          new NextRequest("http://localhost/api/users/p", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ role: "OPERATOR" }),
          }),
          { params: Promise.resolve({ id: b.id }) },
        ),
      ),
    ]);

    const restantes = await prisma.membership.count({ where: { orgId: org.id, role: "OWNER" } });
    expect(restantes).toBeGreaterThanOrEqual(1);
  });

  it("dos expulsiones simultaneas de OWNER no vacian la titularidad", async () => {
    const { org, owners } = await orgConOwners(3);
    const [a, b, actor] = owners;

    const expulsar = (id: string) =>
      como(actor.id, org.id, () =>
        deleteMember(new NextRequest("http://localhost/api/users/x", { method: "DELETE" }), {
          params: Promise.resolve({ id }),
        }),
      );

    await Promise.all([expulsar(a.id), expulsar(b.id)]);

    const restantes = await prisma.membership.count({ where: { orgId: org.id, role: "OWNER" } });
    expect(restantes).toBe(1);
  });
});

describe("Tope de usuarios del plan bajo concurrencia real", () => {
  it("N invitaciones simultaneas no superan nunca el tope del plan", async () => {
    const plan = "INICIA" as const;
    const tope = userLimitFor(plan);
    const { org, owners } = await orgConOwners(1, plan);

    const huecos = tope - 1;
    const intentos = huecos * 2 + 2;

    const respuestas = await Promise.all(
      Array.from({ length: intentos }, (_, i) =>
        como(owners[0].id, org.id, () =>
          inviteUser(peticionInvitacion(`invitado-${i}-${org.slug}@ejemplo.test`)),
        ),
      ),
    );

    const miembros = await prisma.membership.count({ where: { orgId: org.id } });
    expect(miembros).toBe(tope);

    expect(respuestas.filter((r) => r.status === 201).length).toBe(huecos);
    expect(respuestas.filter((r) => r.status === 403).length).toBe(intentos - huecos);
  });

  it("una invitacion rechazada por el tope NO deja un usuario huerfano con magic token", async () => {
    const plan = "INICIA" as const;
    const { org, owners } = await orgConOwners(1, plan);

    for (let i = 0; i < userLimitFor(plan) - 1; i++) {
      const r = await como(owners[0].id, org.id, () =>
        inviteUser(peticionInvitacion(`lleno-${i}-${org.slug}@ejemplo.test`)),
      );
      expect(r.status).toBe(201);
    }

    const rechazado = `rechazado-${org.slug}@ejemplo.test`;
    const res = await como(owners[0].id, org.id, () => inviteUser(peticionInvitacion(rechazado)));
    expect(res.status).toBe(403);

    // ESTE es el fallo original: el `User` se creaba antes de la transaccion,
    // asi que la cuenta quedaba en la base con un magic token valido 7 dias
    // pese a que la invitacion habia sido rechazada. Reintentar generaba tokens
    // nuevos indefinidamente para alguien que nunca fue admitido.
    const huerfano = await prisma.user.findUnique({ where: { email: rechazado } });
    expect(huerfano).toBeNull();
  });

  it("dos invitaciones simultaneas al MISMO email crean un solo miembro", async () => {
    const { org, owners } = await orgConOwners(1, "FIRMA");
    const email = `duplicado-${org.slug}@ejemplo.test`;

    const respuestas = await Promise.all([
      como(owners[0].id, org.id, () => inviteUser(peticionInvitacion(email))),
      como(owners[0].id, org.id, () => inviteUser(peticionInvitacion(email))),
    ]);

    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(await prisma.membership.count({ where: { orgId: org.id, user: { email } } })).toBe(1);
    expect(respuestas.filter((r) => r.status === 201).length).toBe(1);
  });

  it("el plan se lee dentro de la transaccion: subir de plan amplia el tope de inmediato", async () => {
    const { org, owners } = await orgConOwners(1, "INICIA");

    // Se llena INICIA.
    for (let i = 0; i < userLimitFor("INICIA") - 1; i++) {
      const r = await como(owners[0].id, org.id, () =>
        inviteUser(peticionInvitacion(`i-${i}-${org.slug}@ejemplo.test`)),
      );
      expect(r.status).toBe(201);
    }
    const bloqueada = await como(owners[0].id, org.id, () =>
      inviteUser(peticionInvitacion(`extra-${org.slug}@ejemplo.test`)),
    );
    expect(bloqueada.status).toBe(403);

    await prisma.subscription.update({ where: { orgId: org.id }, data: { plan: "DESPACHO" } });

    const permitida = await como(owners[0].id, org.id, () =>
      inviteUser(peticionInvitacion(`tras-upgrade-${org.slug}@ejemplo.test`)),
    );
    expect(permitida.status).toBe(201);
  });
});
