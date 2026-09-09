"use client";

import { createContext, useContext } from "react";
import { Role } from "@prisma/client";

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

/**
 * El rol, comprobado contra el enum de la base.
 *
 * En el contexto viaja una cadena. Pasarla a `hasPermission`, que espera un
 * `Role`, obligaba a escribir `rol as never` en cada pantalla. Ese `as never`
 * no comprueba nada: solo calla al compilador, y un rol que no existiera
 * pasaria igual y decidiria que se ensena.
 *
 * Aqui se comprueba de verdad, y lo que no es un rol conocido es `null` — que
 * es exactamente lo que significa: no sabemos que puede hacer, asi que no se le
 * ofrece nada.
 */
export function useRolConocido(): Role | null {
  const rol = useContext(RolContext);
  return rol !== null && rol in Role ? (rol as Role) : null;
}
