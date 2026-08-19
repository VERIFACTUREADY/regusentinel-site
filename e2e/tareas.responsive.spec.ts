/**
 * El modulo de tareas en las tres pantallas.
 *
 * POR QUE UN FICHERO APARTE
 * -------------------------
 * `playwright.config.ts` solo ejecuta en tablet y movil los ficheros
 * `*.responsive.spec.ts`. Repetir la suite entera en tres tamanos triplicaria
 * el tiempo de CI sin encontrar nada nuevo; lo que de verdad se rompe al
 * estrechar la pantalla son los controles —que se salgan, que queden debajo de
 * otra cosa, que no se puedan pulsar—, y eso es lo que se conduce aqui.
 *
 * Ningun clic roto se sustituye por `page.goto`: si un boton no se puede pulsar
 * en movil, esta prueba tiene que fallar, no rodearlo.
 */
import { type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { test, expect, pantallaUtil } from "./vigilancia";
import { E2E } from "./seed-e2e";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/**
 * Nada puede desbordar a lo ancho.
 *
 * Es el sintoma numero uno de una pantalla rota en movil: el contenido se sale
 * y los controles de la derecha quedan fuera del alcance del pulgar.
 */
async function sinDesbordeHorizontal(page: Page) {
  const desborde = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  expect(desborde, "la pagina no debe desplazarse en horizontal").toBeLessThanOrEqual(1);
}

/**
 * Crea una tarea de apoyo colgada del expediente de tareas.
 *
 * Con un plazo muy pasado a proposito: la bandeja ordena por plazo ascendente
 * y pagina de 50 en 50, asi que una tarea sin plazo se va al final. Cuando la
 * suite entera corre sobre la misma base, las tareas que siembran otras
 * pruebas llenaban la primera pagina y esta caia fuera; el fallo se leia como
 * "el boton no existe" cuando lo que pasaba es que estaba en la pagina 2.
 */
async function tareaDeApoyo(sufijo: string) {
  const caso = await prisma.case.findFirst({
    where: { ref: E2E.tareas.caseRef },
    select: { id: true },
  });
  if (!caso) throw new Error("El expediente de tareas no existe: revisa el sembrado");
  const titulo = `${E2E.tareas.prefijo} movil ${sufijo} ${Date.now().toString().slice(-6)}`;
  const tarea = await prisma.task.create({
    data: {
      caseId: caso.id,
      title: titulo,
      category: "OTROS",
      status: "PENDING",
      sortOrder: 950,
      deadline: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    },
    select: { id: true, title: true },
  });
  return { ...tarea, caseId: caso.id };
}

test.describe("Tareas en las tres pantallas", () => {
  test("la bandeja se abre, se lee y no desborda", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: "Tareas" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
    await sinDesbordeHorizontal(page);
  });

  test("los filtros se pueden usar con el dedo", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    // El filtro se toca donde esta, sin trucos: si quedara fuera de pantalla o
    // tapado, `selectOption` fallaria por actionability.
    const [peticion] = await Promise.all([
      page.waitForRequest((r) => r.url().includes("/api/tasks?"), { timeout: 25_000 }),
      page.getByLabel("Estado", { exact: true }).selectOption("DONE"),
    ]);
    expect(peticion.url()).toContain("status=DONE");
    await sinDesbordeHorizontal(page);
  });

  test("se completa una tarea desde la bandeja", async ({ page }) => {
    const tarea = await tareaDeApoyo("COMPLETAR");

    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    await Promise.all([
      page.waitForRequest((r) => r.url().includes("assignee=unassigned"), { timeout: 25_000 }),
      page.getByLabel("Responsable", { exact: true }).selectOption("unassigned"),
    ]);

    const boton = page.getByRole("button", { name: `Marcar completada: ${tarea.title}` });
    await expect(boton).toBeVisible({ timeout: 20_000 });
    await boton.click();

    await expect(page.getByTestId("aviso-accion")).toContainText(/Tarea completada/i, {
      timeout: 20_000,
    });
    await expect(async () => {
      const enBase = await prisma.task.findUnique({ where: { id: tarea.id } });
      expect(enBase?.status).toBe("DONE");
    }).toPass({ timeout: 20_000 });
    await sinDesbordeHorizontal(page);
  });

  test("se abre una tarea en su expediente desde la bandeja", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks");
    await pantallaUtil(page);

    // La referencia del expediente es el unico enlace de la tarjeta: no hay
    // pagina de detalle de tarea, y desde aqui se va a su expediente.
    await page.getByRole("link", { name: E2E.tareas.caseRef }).first().click();
    await page.waitForURL(/\/cases\/[^/]+$/, { timeout: 30_000 });

    // La ficha carga sus datos en cliente: se espera a que el expediente este
    // pintado de verdad —su pestana de tareas— antes de juzgar la pantalla. Sin
    // esto se auditaba el "Cargando..." y en movil, que es mas lento, fallaba.
    await expect(page.getByRole("button", { name: /^Tareas \(/ })).toBeVisible({
      timeout: 30_000,
    });
    await pantallaUtil(page);
    await sinDesbordeHorizontal(page);
  });

  test("se crea una tarea desde la ficha del expediente", async ({ page }) => {
    const caso = await prisma.case.findFirst({
      where: { ref: E2E.tareas.caseRef },
      select: { id: true },
    });
    const titulo = `${E2E.tareas.prefijo} creada en movil ${Date.now().toString().slice(-6)}`;

    await login(page, E2E.owner);
    await page.goto(`/cases/${caso!.id}`);
    // Igual que arriba: primero que la ficha exista, luego se audita.
    const pestanaTareas = page.getByRole("button", { name: /^Tareas \(/ });
    await expect(pestanaTareas).toBeVisible({ timeout: 30_000 });
    await pantallaUtil(page);

    await pestanaTareas.click();
    await page.getByRole("button", { name: "Añadir tarea" }).click();
    await page.getByLabel("Titulo de la tarea *").fill(titulo);
    await page.getByRole("button", { name: "Crear tarea" }).click();

    await expect(page.getByTestId("toast-exito")).toContainText(/Tarea creada/i, {
      timeout: 20_000,
    });
    expect(await prisma.task.count({ where: { title: titulo } })).toBe(1);
    await sinDesbordeHorizontal(page);
  });

  test("el cronograma se abre, agrupa y no desborda", async ({ page }) => {
    await login(page, E2E.owner);
    await page.goto("/tasks/timeline");
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: /Cronograma/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("carga-error")).toHaveCount(0);
    await expect(page.getByText(`${E2E.tareas.prefijo} vencida del owner`)).toBeVisible({
      timeout: 20_000,
    });
    await sinDesbordeHorizontal(page);
  });
});
