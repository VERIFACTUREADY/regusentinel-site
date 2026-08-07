"use client";

import { createContext, useContext } from "react";

/**
 * Rol del usuario, disponible para cualquier componente de cliente.
 *
 * POR QUE NO `useSession`
 * -----------------------
 * La aplicacion no monta `SessionProvider` en ninguna parte: usar `useSession`
 * revienta con "Cannot destructure property 'data' of useSession(...) as it is
 * undefined", y se lleva por delante la pantalla entera. Montar el proveedor
 * global solo para leer un rol anadiria una peticion de sesion en cliente a
 * cada carga, cuando el servidor ya lo sabe.
 *
 * `AppShell` recibe la sesion del servidor y lo unico que hace falta es bajar
 * ese dato. Eso es exactamente un contexto.
 *
 * PARA QUE SIRVE Y PARA QUE NO
 * -----------------------------
 * Sirve para NO OFRECER lo que el usuario no puede hacer: un VIEWER veia
 * "Nuevo expediente" e "Importar CSV", pulsaba, rellenaba el formulario y
 * recibia un 403. Un boton que solo lleva a un rechazo es peor que no tenerlo.
 *
 * NO sirve como control de acceso. Quien decide es el servidor, y sigue
 * decidiendo: esto es cortesia con el usuario, no seguridad.
 */
const RolContext = createContext<string | null>(null);

export function RolProvider({
  rol,
  children,
}: {
  rol: string | null;
  children: React.ReactNode;
}) {
  return <RolContext.Provider value={rol}>{children}</RolContext.Provider>;
}

export function useRol(): string | null {
  return useContext(RolContext);
}
