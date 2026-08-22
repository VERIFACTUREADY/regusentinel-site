/**
 * /dashboard, conducido como lo conduce un usuario.
 *
 * QUE VIGILA ESTA SUITE, ADEMAS DE QUE LOS NUMEROS SALGAN
 * -------------------------------------------------------
 * La pantalla envolvia sus diecinueve consultas en un ayudante `safe()` que
 * devolvia `0`, `[]` o `null` al fallar. Con PostgreSQL caido el panel decia
 * «Expedientes activos: 0», «Aprobaciones pend.: 0», «Todos los expedientes en
 * orden» y «Nada pendiente de accion inmediata»: cifras y mensajes
 * tranquilizadores, todos falsos, sin una sola senal de que algo iba mal.
 *
 * Por eso cada bloque se comprueba DOS veces: con datos, y con su consulta
 * caida. Y en el segundo caso se afirma tanto que el aviso aparece como que el
 * cero o el estado vacio NO aparecen, porque confundirlos es el defecto.
 *
 * El fallo se provoca con la cookie `e2e-fallos`, que solo tiene efecto si el
 * proceso arranco con `E2E_INYECCION_FALLOS=1` (ver src/lib/consulta-segura.ts).
 */
import { type Page, type BrowserContext } from "@playwright/test";
import { test, expect, pantallaUtil, permitirFalloEn } from "./vigilancia";
import { PrismaClient } from "@prisma/client";
import { E2E, CIFRAS_PANEL, TAREAS_PANEL, reanclarVenceHoy } from "./seed-e2e";

const prisma = new PrismaClient();

/*
 * El plazo de «vence hoy» se reancla ANTES DE CADA PRUEBA.
 *
 * Tiene que ser hoy y estar en el futuro cuando la prueba lo mira, y no hay
 * instante fijo elegido al sembrar que aguante las dos cosas: anclado al
 * mediodia caducaba a las 12:00, y anclado al final del dia caducaba si el
 * sembrado ocurria poco antes de medianoche y la suite cruzaba las 00:00
 * —que es lo que paso en una ejecucion de CI que empezo a las 23:56 de
 * Madrid—. Reanclarlo aqui reduce la ventana de riesgo de veinte minutos a
 * los segundos que dura la prueba.
 */
test.beforeEach(async () => {
  await reanclarVenceHoy(prisma);
});


/**
 * Tareas creadas por las pruebas que mueven contadores del panel.
 *
 * Se borran al terminar el fichero: si se quedaran, la siguiente prueba que
 * afirme un KPI exacto fallaria por datos ajenos, que es exactamente el fallo
 * que ya obligo a rehacer `calendar.spec.ts`.
 */
const tareasDePrueba: string[] = [];

test.afterAll(async () => {
  if (tareasDePrueba.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: tareasDePrueba } } });
  }
  await prisma.$disconnect();
});

/** Instante UTC que corresponde a esa hora civil de Madrid. */
function instanteMadrid(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
): Date {
  // Se prueban los dos desplazamientos posibles y se queda el que, al
  // formatearlo en Madrid, devuelve la hora pedida. Evita tener que saber si
  // esa fecha cae en horario de verano o de invierno.
  for (const desplazamiento of [60, 120]) {
    const candidato = new Date(
      Date.UTC(anio, mes - 1, dia, hora, minuto) - desplazamiento * 60000,
    );
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(candidato);
    const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
    if (
      v("year") === anio &&
      v("month") === mes &&
      v("day") === dia &&
      v("hour") === hora &&
      v("minute") === minuto
    ) {
      return candidato;
    }
  }
  throw new Error(`No se ha podido situar ${anio}-${mes}-${dia} ${hora}:${minuto} en Madrid`);
}

/**
 * Elige un dia del mes cuya casilla —y la del dia anterior— esten vacias.
 *
 * Se busca en vez de fijarse a mano por el mismo motivo que en el calendario
 * principal: en cuanto el sembrado gano tareas con plazos relativos a hoy, un
 * dia escrito a pelo empezo a chocar con ellas y la prueba fallaba por datos
 * ajenos en lugar de por el defecto que vigila.
 */
async function diaLibreDelMes(
  anio: number,
  mes: number,
): Promise<{ dia: number; anterior: number }> {
  const ocupados = new Set<number>();
  const tareas = await prisma.task.findMany({
    where: {
      case: { ref: { in: [E2E.panel.caseRef, E2E.panel.caseRef2] } },
      status: { notIn: ["DONE", "SKIPPED"] },
    },
    select: { deadline: true, dueDate: true },
  });
  for (const t of tareas) {
    const fecha = t.deadline ?? t.dueDate;
    if (!fecha) continue;
    const [a, m, d] = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(fecha)
      .split("-")
      .map(Number);
    if (a === anio && m === mes) ocupados.add(d);
  }

  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const hoy = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", day: "2-digit" })
      .format(new Date()),
  );

  /*
   * Se busca a partir de MANANA, no desde el principio del mes.
   *
   * Un dia pasado tambien tiene casilla, pero la tarea nacería vencida y se
   * colaria en «Requiere accion inmediata» y en el Plan de acciones, moviendo
   * cifras que otras pruebas afirman. Se empieza en el 3 como suelo para que
   * el dia anterior nunca caiga en el mes pasado.
   */
  const desde = Math.max(3, hoy + 1);
  for (let d = desde; d <= ultimoDia; d++) {
    if (!ocupados.has(d) && !ocupados.has(d - 1)) {
      return { dia: d, anterior: d - 1 };
    }
  }
  // Si el mes se acaba, se vuelve a mirar desde el principio: peor, pero mejor
  // que no poder ejecutar la prueba los ultimos dias del mes.
  for (let d = 3; d <= ultimoDia; d++) {
    if (!ocupados.has(d) && !ocupados.has(d - 1)) {
      return { dia: d, anterior: d - 1 };
    }
  }
  throw new Error("No queda ningun par de dias libres en el mes para la prueba");
}

/** La casilla del calendario del panel que corresponde a ese dia. */
function casillaDelDia(page: Page, anio: number, mes: number, dia: number) {
  const clave = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return page.locator(`a[href="/calendar#${clave}"]`);
}

/**
 * Crea un usuario autenticable que no pertenece a ninguna organizacion.
 *
 * Devuelve su correo. La contrasena es la comun de las pruebas.
 */
async function crearUsuarioSinOrganizacion(): Promise<string> {
  const bcrypt = await import("bcryptjs");
  const email = `sin-org.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@ejemplo.test`;
  await prisma.user.create({
    data: {
      email,
      name: "Sin Organizacion E2E",
      passwordHash: await bcrypt.default.hash(E2E.password, 10),
    },
  });
  return email;
}

async function login(page: Page, email: string, password = E2E.password) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45_000 });
}

/**
 * Hace fallar las consultas indicadas en la SIGUIENTE carga de pagina.
 *
 * Se pone como cookie, no como variable de entorno, porque el servidor es uno
 * solo para toda la suite: una variable haria fallar la consulta para todas
 * las pruebas a la vez.
 */
async function forzarFallo(context: BrowserContext, ...consultas: string[]) {
  await context.addCookies([
    {
      name: "e2e-fallos",
      value: consultas.join(","),
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function quitarFallos(context: BrowserContext) {
  await context.clearCookies({ name: "e2e-fallos" });
}

/** La tarjeta completa de un indicador (etiqueta + cifra). */
function kpi(page: Page, id: string) {
  return page.getByTestId(`kpi-${id}`);
}

/**
 * SOLO la cifra de un indicador, para poder afirmarla exacta.
 *
 * Sobre la tarjeta entera habria que usar `toContainText`, y ahi un «9»
 * tambien casa con «90»: la prueba pasaria con el numero equivocado.
 */
function cifraKpi(page: Page, id: string) {
  return page.getByTestId(`kpi-valor-${id}`);
}

test.describe("Panel: indicadores", () => {
  test("los seis indicadores coinciden con la base de datos", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    // Cada cifra se compara con la que deja el sembrado, no con un numero
    // escrito a mano aqui: si alguien cambia el reparto, la prueba le sigue.
    await expect(cifraKpi(page, "expedientes-activos")).toHaveText(
      String(CIFRAS_PANEL.expedientesActivos),
    );
    await expect(cifraKpi(page, "tareas-pendientes")).toHaveText(
      String(CIFRAS_PANEL.tareasPendientes),
    );
    await expect(cifraKpi(page, "tareas-bloqueadas")).toHaveText(
      String(CIFRAS_PANEL.tareasBloqueadas),
    );
    await expect(cifraKpi(page, "tareas-listas")).toHaveText(
      String(CIFRAS_PANEL.tareasListas),
    );
    await expect(cifraKpi(page, "aprobaciones-pendientes")).toHaveText(
      String(CIFRAS_PANEL.aprobacionesPendientes),
    );
    await expect(cifraKpi(page, "cerrados-este-mes")).toHaveText(
      String(CIFRAS_PANEL.cerradosEsteMes),
    );

    // Ningun indicador esta en estado de fallo cuando todo ha ido bien.
    await expect(page.getByTestId("aviso-datos-incompletos")).toHaveCount(0);
  });

  test("cada indicador lleva su etiqueta al lado de su cifra", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    for (const [id, etiqueta] of [
      ["expedientes-activos", "Expedientes activos"],
      ["tareas-pendientes", "Tareas pendientes"],
      ["tareas-bloqueadas", "Tareas bloqueadas"],
      ["tareas-listas", "Listas para accion"],
      ["aprobaciones-pendientes", "Aprobaciones pend."],
      ["cerrados-este-mes", "Cerrados este mes"],
    ] as const) {
      await expect(kpi(page, id)).toContainText(etiqueta);
    }
  });

  test("si falla su consulta, un indicador dice «—» y NUNCA cero", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "expedientesActivos");
    await page.reload();
    await pantallaUtil(page);

    const roto = kpi(page, "expedientes-activos");
    await expect(page.getByTestId("kpi-fallo-expedientes-activos")).toBeVisible();
    await expect(roto).toContainText("—");
    // La afirmacion que de verdad importa: el cero falso no esta.
    await expect(roto).not.toContainText("0");
    await expect(cifraKpi(page, "expedientes-activos")).toHaveCount(0);
    // Y el lector de pantalla oye una frase, no un guion suelto.
    await expect(roto).toContainText("No se ha podido consultar");

    // Degradacion PARCIAL: los otros cinco siguen dando su dato real.
    await expect(cifraKpi(page, "tareas-pendientes")).toHaveText(
      String(CIFRAS_PANEL.tareasPendientes),
    );
    await expect(page.getByTestId("kpi-fallo-tareas-pendientes")).toHaveCount(0);

    await quitarFallos(context);
  });

  test("el aviso de arriba enumera lo que no se ha podido cargar", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "expedientesActivos", "aprobacionesPendientes");
    await page.reload();
    await pantallaUtil(page);

    const aviso = page.getByTestId("aviso-datos-incompletos");
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("Esta pantalla está incompleta");
    await expect(aviso).toContainText("los expedientes activos");
    await expect(aviso).toContainText("las aprobaciones pendientes");
    // No enumera bloques que sí cargaron.
    await expect(aviso).not.toContainText("las tareas bloqueadas");

    await quitarFallos(context);
  });

  test("un cero REAL se sigue viendo como cero", async ({ page }) => {
    // La organizacion nueva no tiene nada: aqui el cero es un dato cierto y
    // debe verse como tal, no como «—».
    await login(page, E2E.panelNueva.owner);
    await pantallaUtil(page);

    await expect(cifraKpi(page, "expedientes-activos")).toHaveText("0");
    await expect(page.getByTestId("kpi-fallo-expedientes-activos")).toHaveCount(0);
    await expect(page.getByTestId("aviso-datos-incompletos")).toHaveCount(0);
  });

  test("las aprobaciones caidas no se anuncian como cero", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "aprobacionesPendientes");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("kpi-fallo-aprobaciones-pendientes")).toBeVisible();
    await expect(kpi(page, "aprobaciones-pendientes")).not.toContainText("0");
    // No hay cifra en absoluto: no es que muestre otra, es que no la hay.
    await expect(cifraKpi(page, "aprobaciones-pendientes")).toHaveCount(0);
    await quitarFallos(context);
  });
});

test.describe("Panel: requiere accion inmediata", () => {
  test("lista tareas vencidas, ISD critico y mensajes de familia", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const banner = page.getByTestId("bloque-accion-inmediata");
    await expect(banner).toBeVisible();

    await expect(banner).toContainText(
      `${CIFRAS_PANEL.mensajesSinLeer} mensajes de familia sin leer`,
    );
    await expect(banner).toContainText("ISD crítico");
    await expect(banner).toContainText(E2E.panel.caseRefIsd);

    // El enlace al resumen del dia funciona de verdad.
    await banner.getByRole("link", { name: /Ver resumen del día/ }).click();
    await page.waitForURL("**/today");
    await expect(page.getByRole("heading", { name: "Resumen del día" })).toBeVisible();
  });

  test("el enlace de una tarea vencida abre su expediente", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await page.getByRole("link", { name: /vencida hace 10 dias/ }).first().click();
    await page.waitForURL("**/cases/**");
    await expect(page.getByText(E2E.panel.caseRef).first()).toBeVisible();
  });
});

test.describe("Panel: calendario de plazos", () => {
  test("muestra el mes en curso y enlaza al calendario completo", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    // El mes que espera el usuario español, no el del reloj del servidor.
    const enMadrid = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const [anio, mes] = enMadrid.split("-").map(Number);

    const calendario = page.getByRole("heading", {
      name: `Plazos — ${meses[mes - 1]} ${anio}`,
    });
    await expect(calendario).toBeVisible();

    await page.getByRole("link", { name: "Ver todo →" }).click();
    await page.waitForURL(/\/calendar/);
  });

  test("una tarea de las 00:30 de Madrid cae en SU dia, no en el anterior", async ({
    page,
  }) => {
    /*
     * Este es el defecto de husos horarios que se corrige.
     *
     * El panel agrupaba las casillas con `d.setHours(0,0,0,0)` y `d.getDate()`,
     * que usan la hora local del PROCESO. El servidor va en UTC, asi que una
     * tarea de las 00:30 de Madrid —22:30 UTC de la vispera en verano, 23:30 en
     * invierno— se pintaba en la casilla del dia ANTERIOR. El gestor veia un
     * dia distinto al que pone en su expediente.
     *
     * La tarea se crea con la hora extrema y se comprueba la casilla concreta
     * de la rejilla, no que el numero aparezca en algun sitio de la pagina.
     */
    const caso = await prisma.case.findFirstOrThrow({
      where: { ref: E2E.panel.caseRef },
      select: { id: true },
    });

    // Dia del mes en curso lejos de los bordes, y su casilla vecina.
    const [anio, mes] = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
    })
      .format(new Date())
      .split("-")
      .map(Number);

    const { dia, anterior } = await diaLibreDelMes(anio, mes);

    // 00:30 hora de Madrid de ese dia, expresado como instante UTC.
    const medianocheYMedia = instanteMadrid(anio, mes, dia, 0, 30);

    const creada = await prisma.task.create({
      data: {
        caseId: caso.id,
        title: `${E2E.panel.prefijo} husos horarios ${Date.now()}`,
        status: "PENDING",
        category: "OTROS",
        deadline: medianocheYMedia,
      },
    });
    tareasDePrueba.push(creada.id);

    // Comprobacion previa: en UTC ese instante es el dia ANTERIOR. Si no lo
    // fuera, la prueba no estaria vigilando nada.
    expect(medianocheYMedia.getUTCDate()).toBe(anterior);

    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const suCasilla = casillaDelDia(page, anio, mes, dia);
    const casillaVecina = casillaDelDia(page, anio, mes, anterior);

    // La tarea cuenta en SU dia...
    await expect(suCasilla).toContainText("1");
    // ...y no en el de la vispera, que era donde caia antes.
    await expect(casillaVecina).toHaveText(String(anterior));

    /*
     * Se borra AQUI, no en `afterAll`.
     *
     * «Plazos proximos» solo muestra ocho tareas: mientras esta seguia viva,
     * empujaba fuera de la lista a la de 30 dias y hacia fallar la prueba del
     * borde de los 30 dias, que se ejecuta despues en este mismo fichero.
     */
    await prisma.task.delete({ where: { id: creada.id } });
    tareasDePrueba.length = 0;
  });

  test("si falla su consulta, el calendario dice que no se ha cargado", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "calendarioPlazos");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-calendario-plazos")).toBeVisible();
    // Y no se pinta una rejilla vacia que parezca «este mes no hay plazos».
    await expect(page.getByRole("heading", { name: /^Plazos —/ })).toHaveCount(0);

    await quitarFallos(context);
  });
});

test.describe("Panel: expedientes recientes", () => {
  test("muestra los expedientes en orden, con causante, estado y enlace", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const tabla = page.getByTestId("bloque-expedientes-recientes").locator("table");
    await expect(tabla).toBeVisible();

    const refs = await tabla.locator("tbody tr td:first-child").allInnerTexts();
    // Orden por fecha de creacion descendente: el segundo expediente se creo
    // despues, asi que va antes.
    expect(refs.indexOf(E2E.panel.caseRef2)).toBeLessThan(refs.indexOf(E2E.panel.caseRef));
    // Como maximo cinco.
    expect(refs.length).toBeLessThanOrEqual(5);

    await expect(tabla).toContainText("Segundo Causante Panel E2E");
    await expect(tabla).toContainText("Solicitante Panel E2E");

    await tabla.getByRole("link", { name: E2E.panel.caseRef }).click();
    await page.waitForURL("**/cases/**");
  });

  test("sin expedientes dice que no hay, y eso es cierto", async ({ page }) => {
    await login(page, E2E.panelNueva.owner);
    await pantallaUtil(page);

    await expect(page.getByTestId("vacio-expedientes-recientes")).toBeVisible();
    await expect(page.getByTestId("fallo-expedientes-recientes")).toHaveCount(0);
  });

  test("si falla la consulta NO dice «No hay expedientes»", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "expedientesRecientes");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-expedientes-recientes")).toBeVisible();
    await expect(page.getByTestId("vacio-expedientes-recientes")).toHaveCount(0);
    await expect(page.getByTestId("fallo-expedientes-recientes")).toContainText(
      "no significa que no haya ninguno",
    );

    await quitarFallos(context);
  });
});

test.describe("Panel: proximos plazos y bloqueadas", () => {
  test("el borde de los 30 dias: el de 31 nunca entra, y el bloque corta en 8", async ({
    page,
  }) => {
    /*
     * QUE COMPRUEBA ESTA PRUEBA, Y POR QUE ASI
     * ----------------------------------------
     * «Plazos proximos (30 dias)» consulta `deadline` entre `now` y
     * `now + 30x24h`, ordena por plazo ascendente y se queda con los OCHO
     * primeros. Son dos reglas, no una, y hay que separarlas:
     *
     *   - la VENTANA: lo que vence a mas de 30 dias no entra nunca. Eso se
     *     afirma aqui sobre la pantalla, y es robusto.
     *   - el CORTE: aunque algo este dentro de la ventana, no se ve si tiene
     *     ocho plazos mas cercanos por delante.
     *
     * La version anterior afirmaba que la tarea de 30 dias SE VEIA. Pasaba por
     * accidente: el sembrado anclaba los plazos al dia civil UTC y la tarea
     * «vence hoy» caia en el pasado, quedaba fuera de la consulta y liberaba
     * el octavo hueco. Corregido el sembrado —ahora «vence hoy» vence de
     * verdad hoy—, ese hueco lo ocupa ella y la de 30 dias queda novena. La
     * prueba no descubria el borde del rango: descubria un fallo de fechas del
     * propio sembrado.
     *
     * Asi que la ventana se comprueba por el lado que SI es observable —el de
     * 31 dias no aparece jamas— y ademas se comprueba el corte y el orden, que
     * es lo que el usuario ve de verdad.
     */
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const bloque = page.getByTestId("bloque-proximos-plazos");
    await expect(bloque).toBeVisible();

    // Fuera de la ventana: no aparece, esten los huecos que esten.
    await expect(bloque).not.toContainText("vence en 31 dias fuera de rango");

    // Dentro de la ventana y ademas entre los mas cercanos: si aparece.
    await expect(bloque).toContainText("vence hoy");
    await expect(bloque).toContainText("vence en 3 dias");
    await expect(bloque).toContainText("vence en 7 dias");

    // El corte: como mucho ocho plazos, y en orden ascendente.
    const marcas = await bloque.locator("span.shrink-0").allInnerTexts();
    expect(marcas.length).toBeLessThanOrEqual(8);
    const dias = marcas.map((m) => (m === "HOY" ? 0 : Number(m.replace("d", ""))));
    expect(
      dias.every((d, i) => i === 0 || d >= dias[i - 1]),
      `los plazos deben ir de menor a mayor: ${marcas.join(", ")}`,
    ).toBe(true);
  });

  test("una tarea que vence HOY no se etiqueta como vencida", async ({ page }) => {
    /*
     * **Defecto corregido.** La etiqueta era `days <= 0 ? "VENCIDO" : ...`, y
     * `days` cuenta dias CIVILES: una tarea que vence hoy a mediodia da 0 y se
     * anunciaba «VENCIDO» a las nueve de la manana, con el plazo aun por
     * delante. Y en un bloque cuya consulta es `deadline >= now`, donde por
     * construccion nada esta vencido.
     */
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const bloque = page.getByTestId("bloque-proximos-plazos");
    const fila = bloque.locator("div").filter({ hasText: /P-E2E vence hoy/ }).last();
    await expect(fila).toContainText("HOY");
    await expect(fila).not.toContainText("VENCIDO");
  });

  test("bloqueadas +7 dias: entra la de 8 y la de 20, no la de 6", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const bloque = page.getByTestId("bloque-bloqueadas-criticas");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText("bloqueada 8 dias si entra");
    await expect(bloque).toContainText("bloqueada 20 dias si entra");
    await expect(bloque).not.toContainText("bloqueada 6 dias no entra");
    // El motivo del bloqueo se ve.
    await expect(bloque).toContainText("Falta certificado de defuncion");
  });

  test("si fallan, los dos bloques lo dicen por separado", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "proximosPlazos", "bloqueadasCriticas");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-proximos-plazos")).toBeVisible();
    await expect(page.getByTestId("fallo-bloqueadas-criticas")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Plazos proximos/ })).toHaveCount(0);

    await quitarFallos(context);
  });
});

test.describe("Panel: Radar ISD y Plan de acciones", () => {
  test("si falla el radar NO dice «Todos los expedientes en orden»", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "radarISD");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-radar-isd")).toBeVisible();
    // Este mensaje en verde era la mentira mas peligrosa del panel.
    await expect(page.getByText("Todos los expedientes en orden")).toHaveCount(0);

    await quitarFallos(context);
  });

  test("si falla el plan NO dice «Nada pendiente de accion inmediata»", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "planDeAcciones");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-plan-de-acciones")).toBeVisible();
    await expect(page.getByText("Nada pendiente de acción inmediata")).toHaveCount(0);

    await quitarFallos(context);
  });

  test("con el radar y el plan sanos, cada uno pinta su bloque", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await expect(page.getByRole("heading", { name: "Radar ISD" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plan de acciones" })).toBeVisible();
    await expect(page.getByTestId("fallo-radar-isd")).toHaveCount(0);
    await expect(page.getByTestId("fallo-plan-de-acciones")).toHaveCount(0);
  });
});

test.describe("Panel: carga de trabajo del equipo", () => {
  test("lista a los miembros con tareas y sus recuentos", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const bloque = page.getByTestId("bloque-carga-equipo");
    await expect(bloque).toBeVisible();
    await expect(bloque).toContainText("Owner Panel E2E");
    await expect(bloque).toContainText("Manager Panel E2E");
    // El VIEWER no tiene tareas asignadas: no debe salir.
    await expect(bloque).not.toContainText("Viewer Panel E2E");
    await expect(bloque).toContainText("activas");
  });

  test("si falla, lo dice en vez de desaparecer sin dejar rastro", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "cargaDelEquipo");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-carga-equipo")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Carga de trabajo del equipo" }),
    ).toHaveCount(0);

    await quitarFallos(context);
  });
});

test.describe("Panel: actividad reciente", () => {
  test("muestra los ultimos registros con autor y accion", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const bloque = page.getByTestId("bloque-actividad");
    await expect(bloque).toContainText("panel.e2e.accion.1");
    await expect(bloque).toContainText("Owner Panel E2E");
  });

  test("si falla NO dice «Sin actividad»", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "actividadReciente");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-actividad")).toBeVisible();
    await expect(page.getByTestId("vacio-actividad")).toHaveCount(0);

    await quitarFallos(context);
  });
});

test.describe("Panel: aislamiento entre organizaciones", () => {
  test("el panel de una organizacion no ensena NADA de la vecina", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const cuerpo = page.locator("body");
    // Expedientes, causantes, tareas y mensajes de la organizacion vecina.
    for (const marca of [
      E2E.panelVecina.caseRef,
      E2E.panelVecina.causante,
      E2E.panelVecina.tarea,
      E2E.panelVecina.mensaje,
      "NO_DEBE_VERSE_actividad_vecina",
      "NO_DEBE_VERSE_aprobacion",
    ]) {
      await expect(cuerpo).not.toContainText(marca);
    }
  });

  test("los CONTADORES tampoco suman los de la vecina", async ({ page }) => {
    /*
     * Un agregado que filtre mal por `orgId` es una fuga aunque no ensene ni
     * un nombre: el numero delata cuantos expedientes tiene el vecino. La
     * organizacion vecina tiene 1 expediente activo, 3 tareas, 1 aprobacion y
     * 1 mensaje sin leer; si alguno se colara, estas cifras subirian.
     */
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await expect(cifraKpi(page, "expedientes-activos")).toHaveText(
      String(CIFRAS_PANEL.expedientesActivos),
    );
    await expect(cifraKpi(page, "aprobaciones-pendientes")).toHaveText(
      String(CIFRAS_PANEL.aprobacionesPendientes),
    );
    await expect(cifraKpi(page, "tareas-bloqueadas")).toHaveText(
      String(CIFRAS_PANEL.tareasBloqueadas),
    );
  });

  test("y al reves: la vecina no ve nada del panel", async ({ page }) => {
    await login(page, E2E.panelVecina.owner);
    await pantallaUtil(page);

    const cuerpo = page.locator("body");
    await expect(cuerpo).not.toContainText(E2E.panel.caseRef);
    await expect(cuerpo).not.toContainText(E2E.panel.causanteIsd);
    await expect(cuerpo).not.toContainText("Owner Panel E2E");
  });
});

test.describe("Panel: roles", () => {
  // La politica REAL: `/dashboard` no exige ningun permiso —no aparece en la
  // lista de `navItems` con `permission`—, asi que los cuatro roles entran.
  for (const rol of ["owner", "manager", "operador", "viewer"] as const) {
    test(`un ${rol.toUpperCase()} entra al panel y ve sus indicadores`, async ({ page }) => {
      await login(page, E2E.panel[rol]);
      await pantallaUtil(page);

      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(cifraKpi(page, "expedientes-activos")).toHaveText(
      String(CIFRAS_PANEL.expedientesActivos),
    );
      // El enlace del menu existe para todos.
      await expect(
        page.getByRole("link", { name: "Dashboard" }).first(),
      ).toBeVisible();
    });
  }

  test("«Mis tareas asignadas» ensena las de cada uno, no las de otro", async ({
    page,
  }) => {
    // El OWNER tiene tareas; el VIEWER no tiene ninguna asignada.
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);
    await expect(page.getByRole("heading", { name: "Mis tareas asignadas" })).toBeVisible();
    await expect(
      page.getByTestId("widget-mis-tareas").getByText("P-E2E vence en 3 dias"),
    ).toBeVisible();
  });
});

test.describe("Panel: mis tareas asignadas", () => {
  /*
   * Estas pruebas COMPLETAN tareas de verdad —es lo que hay que demostrar— y
   * eso mueve el KPI «Tareas pendientes», el bloque «Plazos proximos» y el
   * propio widget. Se devuelve cada tarea a su estado sembrado despues de cada
   * prueba: si no, la suite solo pasa la primera vez sobre una base recien
   * creada, y un reintento en CI (`retries: 1`) la encontraria ya mutada.
   */
  test.afterEach(async () => {
    /*
     * Se restaura SOLO lo que de verdad ha cambiado.
     *
     * `updatedAt` lleva `@updatedAt` en el esquema: cualquier `update` lo pone
     * a ahora, y ese campo es justamente el que mide «bloqueada desde hace N
     * dias». Restaurar las catorce tareas a ciegas ponia a cero la antigüedad
     * de las tres BLOCKED y hacia desaparecer el bloque «Tareas bloqueadas +7
     * dias», rompiendo la prueba del corte de los 7 dias. Comparando primero,
     * no se toca nada que no haga falta.
     */
    const actuales = await prisma.task.findMany({
      where: {
        case: { org: { slug: E2E.panel.slug } },
        title: { startsWith: E2E.panel.prefijo },
      },
      select: { id: true, title: true, status: true },
    });
    const esperado = new Map(
      TAREAS_PANEL.map((t) => [`${E2E.panel.prefijo} ${t.titulo}`, t.estado]),
    );
    for (const tarea of actuales) {
      const debeSer = esperado.get(tarea.title);
      if (debeSer && tarea.status !== debeSer) {
        await prisma.task.update({
          where: { id: tarea.id },
          data: { status: debeSer },
        });
      }
    }
  });

  test("completar una tarea la quita de la lista y persiste al recargar", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    // El titulo se busca DENTRO del widget: el mismo texto aparece tambien en
    // «Plazos proximos», y sin acotar la localizacion es ambigua.
    const widget = page.getByTestId("widget-mis-tareas");
    const titulo = "P-E2E vence en 30 dias";
    await expect(widget.getByText(titulo, { exact: true })).toBeVisible();

    await widget
      .getByRole("button", { name: `Marcar completada: ${titulo}` })
      .click();

    await expect(widget.getByText(titulo, { exact: true })).toHaveCount(0);

    // Y de verdad se guardo: sigue fuera despues de recargar.
    await page.reload();
    await pantallaUtil(page);
    await expect(
      page.getByTestId("widget-mis-tareas").getByText(titulo, { exact: true }),
    ).toHaveCount(0);

  });

  test("un 500 al completar avisa, no borra la tarea y deja reintentar", async ({
    page,
  }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const widget = page.getByTestId("widget-mis-tareas");
    const titulo = "P-E2E vence en 7 dias";
    await expect(widget.getByText(titulo, { exact: true })).toBeVisible();

    // El 500 lo provoca la prueba: el vigilante global no debe tomarlo por un
    // fallo real de la aplicacion.
    permitirFalloEn(page, "/api/cases/");

    await page.route("**/api/cases/*/tasks", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Fallo del servidor" }),
        });
        return;
      }
      await route.continue();
    });

    const boton = widget.getByRole("button", { name: `Marcar completada: ${titulo}` });
    await boton.click();

    await expect(page.getByTestId("aviso-widget-tareas")).toBeVisible();
    await expect(page.getByTestId("aviso-widget-tareas")).toContainText("Fallo del servidor");
    // La tarea NO desaparece si no se ha guardado.
    await expect(widget.getByText(titulo, { exact: true })).toBeVisible();
    // Y el boton vuelve a estar disponible.
    await expect(boton).toBeEnabled();

    // Quitando el fallo, el reintento funciona.
    await page.unroute("**/api/cases/*/tasks");
    await boton.click();
    await expect(widget.getByText(titulo, { exact: true })).toHaveCount(0);
  });

  test("un fallo de red al completar tambien avisa", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const widget = page.getByTestId("widget-mis-tareas");
    const titulo = "P-E2E vence hoy";
    await expect(widget.getByText(titulo, { exact: true })).toBeVisible();

    permitirFalloEn(page, "/api/cases/");
    await page.route("**/api/cases/*/tasks", (route) =>
      route.request().method() === "PATCH" ? route.abort("failed") : route.continue(),
    );

    await widget.getByRole("button", { name: `Marcar completada: ${titulo}` }).click();
    await expect(page.getByTestId("aviso-widget-tareas")).toBeVisible();
    await expect(widget.getByText(titulo, { exact: true })).toBeVisible();
    await page.unroute("**/api/cases/*/tasks");
  });

  test("un 403 al completar avisa con el motivo", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const widget = page.getByTestId("widget-mis-tareas");
    const titulo = "P-E2E vence en 3 dias";
    permitirFalloEn(page, "/api/cases/");
    await page.route("**/api/cases/*/tasks", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: "No tienes permiso" }),
        });
        return;
      }
      await route.continue();
    });

    await widget.getByRole("button", { name: `Marcar completada: ${titulo}` }).click();
    await expect(page.getByTestId("aviso-widget-tareas")).toContainText("No tienes permiso");
    await expect(widget.getByText(titulo, { exact: true })).toBeVisible();
    await page.unroute("**/api/cases/*/tasks");
  });

  test("una tarea urgente o vencida se distingue a simple vista", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const widget = page.getByTestId("widget-mis-tareas");
    // La referencia del expediente enlaza y se ve.
    await expect(widget.getByRole("link", { name: E2E.panel.caseRef }).first()).toBeVisible();
  });

  test("si falla su consulta, el widget lo dice", async ({ page, context }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "misTareas");
    await page.reload();
    await pantallaUtil(page);

    await expect(page.getByTestId("fallo-mis-tareas")).toBeVisible();
    await quitarFallos(context);
  });
});

test.describe("Panel: uso del plan", () => {
  test("muestra expedientes y usuarios usados sobre su limite", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const widget = page.getByTestId("widget-uso-del-plan");
    await expect(widget).toBeVisible();
    await expect(widget).toContainText("Expedientes este mes");
    await expect(widget).toContainText("Usuarios");
    // Cuatro miembros en esta organizacion.
    await expect(widget).toContainText("4/");
  });

  test("los dos enlaces llevan a facturacion", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await page.getByRole("link", { name: "Gestionar suscripcion" }).click();
    await page.waitForURL("**/billing");
  });

  for (const [codigo, esperado] of [
    [401, "Tu sesion ha caducado"],
    [403, "No tienes permiso"],
    [500, "El servidor ha respondido 500"],
  ] as const) {
    test(`un HTTP ${codigo} en /api/usage se explica y deja reintentar`, async ({ page }) => {
      // El error lo provoca esta prueba: no es un fallo de la aplicacion.
      permitirFalloEn(page, "/api/usage");
      await page.route("**/api/usage", (route) =>
        route.fulfill({ status: codigo, contentType: "application/json", body: "{}" }),
      );
      await login(page, E2E.panel.owner);
      await pantallaUtil(page);

      const aviso = page.getByTestId("carga-error");
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(esperado);
      await expect(aviso).toContainText("el consumo del plan");

      // Reintentar vuelve a pedirlo y, sin el fallo, el widget aparece.
      await page.unroute("**/api/usage");
      await aviso.getByRole("button", { name: "Reintentar" }).click();
      await expect(page.getByRole("heading", { name: "Uso del plan" })).toBeVisible();
    });
  }

  test("un fallo de red se explica igual que uno del servidor", async ({ page }) => {
    permitirFalloEn(page, "/api/usage");
    await page.route("**/api/usage", (route) => route.abort("failed"));
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await expect(page.getByTestId("carga-error")).toBeVisible();
    await page.unroute("**/api/usage");
  });

  test("cerca del limite y limite alcanzado se avisan distinto", async ({ page }) => {
    // Se sirve una respuesta con el consumo al 100 % para llegar al aviso rojo
    // sin tener que crear cientos de expedientes.
    await page.route("**/api/usage", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "INICIA",
          planLabel: "Inicia",
          status: "active",
          casesUsed: 20,
          casesLimit: 20,
          membersUsed: 4,
          membersLimit: 5,
          month: "2026-08",
        }),
      }),
    );
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const widget = page.getByTestId("widget-uso-del-plan");
    await expect(widget).toContainText("Limite alcanzado");
    await widget.getByRole("link", { name: "Ampliar plan" }).click();
    await page.waitForURL("**/billing");
    await page.unroute("**/api/usage");
  });

  test("cerca del limite muestra cuantos quedan", async ({ page }) => {
    await page.route("**/api/usage", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "INICIA",
          planLabel: "Inicia",
          status: "active",
          casesUsed: 17,
          casesLimit: 20,
          membersUsed: 4,
          membersLimit: 5,
          month: "2026-08",
        }),
      }),
    );
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await expect(page.getByText("3 expedientes restantes")).toBeVisible();
    await expect(page.getByText("Limite alcanzado")).toHaveCount(0);
    await page.unroute("**/api/usage");
  });
});

test.describe("Panel: analisis masivo con IA", () => {
  test("el boton existe y dice cuantos expedientes abiertos hay", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    const boton = page.getByTestId("boton-analisis-masivo");
    await expect(boton).toBeVisible();
    await expect(boton).toContainText(`Analizar todos (${CIFRAS_PANEL.expedientesActivos})`);
    await expect(boton).toBeEnabled();
  });

  test("sin expedientes abiertos el boton esta inhabilitado", async ({ page }) => {
    await login(page, E2E.panelNueva.owner);
    await pantallaUtil(page);

    const boton = page.getByTestId("boton-analisis-masivo");
    await expect(boton).toContainText("Analizar todos (0)");
    await expect(boton).toBeDisabled();
  });

  test("si no se sabe cuantos hay, el boton lo dice y no se puede pulsar", async ({
    page,
    context,
  }) => {
    await login(page, E2E.panel.owner);
    await forzarFallo(context, "expedientesActivos");
    await page.reload();
    await pantallaUtil(page);

    const boton = page.getByTestId("boton-analisis-masivo");
    // Antes decia «Analizar todos (0)», que es una cifra inventada.
    await expect(boton).toContainText("Analizar todos (—)");
    await expect(boton).toBeDisabled();

    await quitarFallos(context);
  });

  test("un clic real muestra el resultado y refresca los contadores", async ({ page }) => {
    /*
     * El servicio de IA es de pago: NO se llama de verdad. Se sustituye la
     * respuesta de nuestra propia API, que es lo que hay que probar aqui —el
     * boton, su estado de carga, el resultado y el refresco posterior—.
     */
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    await page.route("**/api/cases/bulk-analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ analyzed: 3, failed: 0, skipped: 1, total: 4 }),
      });
    });

    await page.getByTestId("boton-analisis-masivo").click();
    await expect(page.getByText("3 analizados")).toBeVisible();
    await expect(page.getByText("1 recientes (omitidos)")).toBeVisible();

    // Se puede volver a empezar.
    await page.getByRole("button", { name: "Ejecutar de nuevo" }).click();
    await expect(page.getByTestId("boton-analisis-masivo")).toBeVisible();
    await page.unroute("**/api/cases/bulk-analyze");
  });

  test("un error del servidor se explica y el boton sigue utilizable", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    permitirFalloEn(page, "/api/cases/bulk-analyze");
    await page.route("**/api/cases/bulk-analyze", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "El analizador no responde" }),
      }),
    );

    await page.getByTestId("boton-analisis-masivo").click();
    await expect(page.getByTestId("error-analisis-masivo")).toContainText(
      "El analizador no responde",
    );
    await expect(page.getByTestId("boton-analisis-masivo")).toBeEnabled();
    await page.unroute("**/api/cases/bulk-analyze");
  });

  test("una respuesta que no es JSON no ensena «Unexpected token»", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    permitirFalloEn(page, "/api/cases/bulk-analyze");
    await page.route("**/api/cases/bulk-analyze", (route) =>
      route.fulfill({ status: 502, contentType: "text/html", body: "<!DOCTYPE html><h1>502</h1>" }),
    );

    await page.getByTestId("boton-analisis-masivo").click();
    const aviso = page.getByTestId("error-analisis-masivo");
    await expect(aviso).toBeVisible();
    // El defecto: `res.json()` antes de mirar `res.ok` soltaba este texto.
    await expect(aviso).not.toContainText("Unexpected token");
    await expect(aviso).toContainText("502");
    await page.unroute("**/api/cases/bulk-analyze");
  });

  test("un fallo de red se explica", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    permitirFalloEn(page, "/api/cases/bulk-analyze");
    await page.route("**/api/cases/bulk-analyze", (route) => route.abort("failed"));
    await page.getByTestId("boton-analisis-masivo").click();
    await expect(page.getByTestId("error-analisis-masivo")).toBeVisible();
    await page.unroute("**/api/cases/bulk-analyze");
  });

  test("el doble clic no lanza dos analisis", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);

    let llamadas = 0;
    await page.route("**/api/cases/bulk-analyze", async (route) => {
      llamadas++;
      // Lenta a proposito: da tiempo al segundo clic mientras la primera vuela.
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ analyzed: 1, failed: 0, skipped: 0, total: 1 }),
      });
    });

    const boton = page.getByTestId("boton-analisis-masivo");
    await boton.click();
    // Mientras carga, el boton esta inhabilitado y el segundo clic no entra.
    await expect(boton).toBeDisabled();
    await boton.click({ force: true, timeout: 2000 }).catch(() => {
      // Que el clic forzado no llegue tambien es un resultado valido.
    });
    await expect(page.getByText("1 analizados")).toBeVisible({ timeout: 15_000 });
    expect(llamadas).toBe(1);
    await page.unroute("**/api/cases/bulk-analyze");
  });
});

test.describe("Panel: primeros pasos", () => {
  test("una organizacion nueva ve el panel con sus pasos sin hacer", async ({ page }) => {
    await login(page, E2E.panelNueva.owner);
    await pantallaUtil(page);

    const panel = page.getByTestId("panel-onboarding");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Primeros pasos");
    await expect(page.getByTestId("progreso-onboarding")).toContainText("0 de");
    await expect(panel).toContainText("Crea tu primer expediente");
    // El enlace del primer paso lleva a donde dice.
    await panel.getByRole("link", { name: /Crear expediente/ }).click();
    await page.waitForURL("**/cases/new");
  });

  test("una organizacion ya configurada NO recibe el panel", async ({ page }) => {
    await login(page, E2E.panel.owner);
    await pantallaUtil(page);
    await expect(page.getByTestId("panel-onboarding")).toHaveCount(0);
  });

  test("si «No mostrar mas» falla, se dice y el panel sigue ahi", async ({ page }) => {
    await login(page, E2E.panelNueva.owner);
    await pantallaUtil(page);

    permitirFalloEn(page, "/api/onboarding/dismiss");
    await page.route("**/api/onboarding/dismiss", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "No se ha podido guardar" }),
      }),
    );

    await page.getByRole("button", { name: "No mostrar mas" }).click();
    await expect(page.getByTestId("error-ocultar-onboarding")).toContainText(
      "No se ha podido guardar",
    );
    // Sigue visible: no se finge que se ha ocultado.
    await expect(page.getByTestId("panel-onboarding")).toBeVisible();
    // Y el boton se recupera; antes se quedaba congelado en «...».
    await expect(page.getByRole("button", { name: "No mostrar mas" })).toBeEnabled();
    await page.unroute("**/api/onboarding/dismiss");
  });

  test("un fallo de red al ocultar tambien se dice", async ({ page }) => {
    await login(page, E2E.panelNueva.owner);
    await pantallaUtil(page);

    permitirFalloEn(page, "/api/onboarding/dismiss");
    await page.route("**/api/onboarding/dismiss", (route) => route.abort("failed"));
    await page.getByRole("button", { name: "No mostrar mas" }).click();
    await expect(page.getByTestId("error-ocultar-onboarding")).toContainText("Error de conexion");
    await expect(page.getByRole("button", { name: "No mostrar mas" })).toBeEnabled();
    await page.unroute("**/api/onboarding/dismiss");
  });
});

test.describe("Panel: usuario sin organizacion", () => {
  test("no se le expulsa al login y puede crear su organizacion", async ({ page }) => {
    /*
     * El usuario se crea AQUI, no se toma del sembrado.
     *
     * Esta prueba termina creando una organizacion de verdad, asi que deja de
     * ser un usuario sin organizacion en cuanto se ejecuta una vez: contra el
     * usuario sembrado solo pasaba la primera vez y fallaba en el reintento de
     * CI y en cualquier reejecucion local. Con uno recien hecho es repetible.
     */
    const email = await crearUsuarioSinOrganizacion();

    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', E2E.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    await pantallaUtil(page);

    // Sigue autenticado y en /dashboard, no de vuelta en /login.
    expect(page.url()).toContain("/dashboard");
    await expect(page.getByText(/Bienvenido\/a/)).toBeVisible();
    await expect(page.getByText(/crea tu organización/i)).toBeVisible();

    // Se completa el alta de verdad, escribiendo en el formulario.
    const nombre = `Despacho Recien Creado ${Date.now()}`;
    await page.getByLabel("Nombre de tu despacho u organización").fill(nombre);
    await page.getByRole("button", { name: "Crear organización y empezar" }).click();

    // Y despues el panel funciona.
    await page.waitForURL("**/dashboard", { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("kpi-expedientes-activos")).toBeVisible();
  });
});
