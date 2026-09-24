/**
 * Autenticacion: lo que la aplicacion le promete al gestor de contraseñas.
 *
 * QUE SE PUEDE AUTOMATIZAR Y QUE NO
 * ---------------------------------
 * Lo que depende de NUESTRO codigo —los atributos `autocomplete`, `type` y
 * `name`, y que cada campo tenga etiqueta asociada— se comprueba aqui entero.
 *
 * Lo que NO se puede automatizar es el comportamiento VISUAL del gestor de
 * contraseñas (que Safari o Chrome ofrezcan guardar o rellenar): eso vive en el
 * navegador del usuario, con su llavero y sus ajustes, y Playwright no lo
 * expone. Queda documentado como prueba manual en QA_MATRIX en vez de fingir
 * que se cubre.
 *
 * SOBRE `username` EN EL LOGIN
 * ----------------------------
 * El campo de correo del login lleva `autocomplete="username"`, no `"email"`.
 * Es lo correcto para el objetivo de esta fila: los gestores de contraseñas
 * emparejan `username` + `current-password` para guardar y rellenar la
 * credencial. `email` marca el campo como "un correo cualquiera" y rompe ese
 * emparejamiento. `type="email"` si se mantiene, que es lo que da el teclado
 * adecuado en movil y la validacion del navegador.
 */
import { type Page } from "@playwright/test";
import { test, expect } from "./vigilancia";
import { E2E } from "./seed-e2e";

/** Atributos reales de un campo, leidos del DOM. */
async function atributos(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const i = el as HTMLInputElement;
    const id = i.getAttribute("id");
    const etiqueta = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    return {
      type: i.getAttribute("type"),
      name: i.getAttribute("name"),
      autocomplete: i.getAttribute("autocomplete"),
      id,
      textoEtiqueta: etiqueta?.textContent?.trim() ?? null,
    };
  });
}

test.describe("Autenticacion: atributos para el gestor de contraseñas", () => {
  test("login: username + current-password, con etiquetas asociadas", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20_000 });

    const correo = await atributos(page, 'input[type="email"]');
    expect(correo.type).toBe("email");
    expect(correo.name).toBe("email");
    // `username`, no `email`: es lo que empareja el gestor con la contraseña.
    expect(correo.autocomplete).toBe("username");
    expect(correo.textoEtiqueta, "el campo debe tener etiqueta asociada").toBeTruthy();

    const clave = await atributos(page, 'input[type="password"]');
    expect(clave.type).toBe("password");
    expect(clave.name).toBe("password");
    expect(clave.autocomplete).toBe("current-password");
    expect(clave.textoEtiqueta).toBeTruthy();

    // Y las etiquetas funcionan de verdad: se puede escribir por su nombre.
    await page.getByLabel("Email", { exact: true }).fill("prueba@ejemplo.test");
    await page.getByLabel("Contraseña", { exact: true }).fill("loquesea");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue("prueba@ejemplo.test");
  });

  test("recuperar contraseña: el correo se anuncia como identificador", async ({ page }) => {
    await page.goto("/forgot-password");
    const correo = await atributos(page, 'input[type="email"]');
    expect(correo.type).toBe("email");
    expect(correo.autocomplete).toBe("username");
    expect(correo.textoEtiqueta).toBeTruthy();
    await expect(page.getByLabel("Email", { exact: true })).toBeEditable();
  });

  test("alta de cuenta: la contraseña se anuncia como nueva", async ({ page }) => {
    await page.goto("/onboarding");

    // El alta va por pasos: el correo y la contraseña viven en el segundo, y se
    // llega pulsando, no saltandoselo.
    await page.getByLabel("Nombre de la gestoría / funeraria", { exact: true }).fill(
      "Gestoría de prueba",
    );
    await page.getByRole("button", { name: /Siguiente/ }).click();
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20_000 });

    const correo = await atributos(page, 'input[type="email"]');
    expect(correo.type).toBe("email");
    expect(correo.autocomplete).toBe("username");
    expect(correo.textoEtiqueta).toBeTruthy();

    const clave = await atributos(page, 'input[type="password"]');
    expect(clave.autocomplete, "una contraseña nueva no es la actual").toBe("new-password");
    expect(clave.textoEtiqueta).toBeTruthy();

    // Todos los campos del alta tienen nombre accesible.
    for (const etiqueta of ["Nombre completo", "Email profesional", "Contraseña"]) {
      await expect(page.getByLabel(etiqueta, { exact: true }), etiqueta).toBeEditable();
    }
  });

  test("crear contraseña desde el enlace: las dos casillas son new-password", async ({ page }) => {
    // La pantalla se pinta aunque el token no valga: lo que se audita aqui es
    // el formulario, no el token.
    await page.goto("/reset-password?token=token-de-prueba-para-atributos");

    const campos = page.locator('input[type="password"]');
    await expect(campos.first()).toBeVisible({ timeout: 20_000 });
    expect(await campos.count(), "contraseña y confirmacion").toBe(2);

    for (let i = 0; i < 2; i++) {
      const datos = await campos.nth(i).evaluate((el) => {
        const input = el as HTMLInputElement;
        const id = input.getAttribute("id");
        const etiqueta = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        return {
          autocomplete: input.getAttribute("autocomplete"),
          name: input.getAttribute("name"),
          etiqueta: etiqueta?.textContent?.trim() ?? null,
        };
      });
      expect(datos.autocomplete, `campo ${i + 1}`).toBe("new-password");
      expect(datos.name, `campo ${i + 1}`).toBeTruthy();
      expect(datos.etiqueta, `campo ${i + 1} sin etiqueta asociada`).toBeTruthy();
    }

    await expect(page.getByLabel("Nueva contraseña", { exact: true })).toBeEditable();
    await expect(page.getByLabel("Confirmar contraseña", { exact: true })).toBeEditable();
  });

  test("cambio de contraseña en el perfil: actual + nueva + confirmacion", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', E2E.owner);
    await page.fill('input[type="password"]', E2E.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    await page.goto("/profile");
    await expect(page.getByLabel("Contraseña actual", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    const esperado: Record<string, string> = {
      "Contraseña actual": "current-password",
      "Nueva contraseña": "new-password",
      "Confirmar nueva contraseña": "new-password",
    };
    for (const [etiqueta, valor] of Object.entries(esperado)) {
      const campo = page.getByLabel(etiqueta, { exact: true });
      await expect(campo, etiqueta).toBeEditable();
      await expect(campo, etiqueta).toHaveAttribute("autocomplete", valor);
      await expect(campo, etiqueta).toHaveAttribute("type", "password");
    }
  });
});

test.describe("Autenticacion: las credenciales no se guardan en el navegador", () => {
  /**
   * Guardar una contraseña en `localStorage`, `sessionStorage` o IndexedDB la
   * deja legible para cualquier script de la pagina y sobrevive al cierre de
   * sesion. Esta prueba conduce un login REAL y despues registra lo que ha
   * quedado escrito.
   */
  test("tras iniciar sesion no queda la contraseña en ningun almacen", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', E2E.owner);
    await page.fill('input[type="password"]', E2E.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 45_000 });

    const volcado = await page.evaluate(async () => {
      const trozos: string[] = [];
      for (const almacen of [window.localStorage, window.sessionStorage]) {
        for (let i = 0; i < almacen.length; i++) {
          const clave = almacen.key(i)!;
          trozos.push(clave, almacen.getItem(clave) ?? "");
        }
      }
      // IndexedDB: se leen los nombres de las bases y el contenido de cada
      // almacen de objetos que se pueda abrir.
      if (typeof indexedDB?.databases === "function") {
        const bases = await indexedDB.databases().catch(() => []);
        for (const b of bases) {
          if (!b.name) continue;
          trozos.push(b.name);
          await new Promise<void>((resolve) => {
            const req = indexedDB.open(b.name!);
            req.onerror = () => resolve();
            req.onsuccess = () => {
              const db = req.result;
              const nombres = Array.from(db.objectStoreNames);
              if (!nombres.length) {
                db.close();
                return resolve();
              }
              try {
                const tx = db.transaction(nombres, "readonly");
                let pendientes = nombres.length;
                for (const n of nombres) {
                  const todo = tx.objectStore(n).getAll();
                  todo.onsuccess = () => {
                    trozos.push(JSON.stringify(todo.result ?? ""));
                    if (--pendientes === 0) {
                      db.close();
                      resolve();
                    }
                  };
                  todo.onerror = () => {
                    if (--pendientes === 0) {
                      db.close();
                      resolve();
                    }
                  };
                }
              } catch {
                db.close();
                resolve();
              }
            };
          });
        }
      }
      return trozos.join("\n");
    });

    expect(volcado, "la contraseña no puede quedar escrita en el navegador").not.toContain(
      E2E.password,
    );
    // Ni bajo una clave que la delate.
    expect(volcado.toLowerCase()).not.toMatch(/"?(password|contrasena|contraseña|passwd)"?\s*[:=]/);
  });
});
