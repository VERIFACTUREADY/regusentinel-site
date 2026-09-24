import { NextRequest, NextResponse } from "next/server";
import { handleWebhookEvent } from "@/lib/stripe";

/**
 * Webhook de Stripe.
 *
 * Distingue dos clases de fallo, que antes se devolvían ambas como 400 con el
 * mensaje de error crudo:
 *
 *   - **Firma inválida o cuerpo mal formado** → 400. Es permanente: reintentar
 *     no lo arregla, y además puede ser un intento de suplantación.
 *   - **Fallo al procesar el evento** → 500. Es transitorio (base de datos
 *     caída, timeout de la API de Stripe) y **queremos** que Stripe reintente;
 *     el evento queda en FAILED y el reintento vuelve a ejecutarlo.
 *
 * Esta distinción sólo sirve de algo porque `handleWebhookEvent` ya no marca
 * el evento como procesado antes de ejecutar su lógica.
 */
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Falta la firma de Stripe" }, { status: 400 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Cuerpo ilegible" }, { status: 400 });
  }

  try {
    const result = await handleWebhookEvent(body, sig);

    // El evento NO se ha aplicado: otra entrega lo tiene reclamado, o ha
    // agotado los reintentos automáticos. Responder 200 aquí haría que Stripe
    // lo diera por entregado y no volviera a enviarlo nunca; si el proceso que
    // lo tenía reclamado murió a mitad, su efecto se perdería. 409 mantiene
    // vivo el reintento de Stripe, que es la red de seguridad más barata.
    if (!result.received) {
      return NextResponse.json(
        { error: "Evento no aplicado todavia; reintentar", reason: result.reason },
        { status: 409 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // `constructEvent` lanza con estos textos cuando la firma no valida.
    const isSignatureFailure =
      /signature/i.test(message) || /no signatures found/i.test(message);

    if (isSignatureFailure) {
      console.error("Webhook de Stripe con firma invalida:", message);
      return NextResponse.json({ error: "Firma no valida" }, { status: 400 });
    }

    // 500 → Stripe reintenta (hasta 3 dias). El evento queda FAILED y el
    // siguiente intento vuelve a procesarlo desde cero.
    console.error("Fallo procesando webhook de Stripe:", message);
    return NextResponse.json(
      { error: "Error temporal procesando el evento; se reintentara" },
      { status: 500 },
    );
  }
}
