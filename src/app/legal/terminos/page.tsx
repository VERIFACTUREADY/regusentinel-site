import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminos de Servicio — Heredia",
  description: "Condiciones generales de uso de la plataforma Heredia para gestorias y funerarias.",
  alternates: { canonical: "https://heredia.app/legal/terminos" },
};

export default function TerminosPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1>Terminos y Condiciones de Servicio</h1>
      <p className="text-sm text-gray-500">Ultima actualizacion: abril 2026</p>

      <h2>1. Objeto</h2>
      <p>
        Estos terminos regulan el acceso y uso de la plataforma Heredia
        (&quot;el Servicio&quot;), una herramienta SaaS de gestion administrativa
        post-mortem dirigida a gestorías, asesorías y funerarias profesionales
        (&quot;el Cliente&quot;).
      </p>

      <h2>2. Naturaleza del servicio</h2>
      <p>
        Heredia es una herramienta de orquestacion y documentacion.
        <strong> Heredia no presta asesoramiento juridico, fiscal ni contable.</strong>{" "}
        Las decisiones profesionales derivadas del uso de la Plataforma son
        responsabilidad exclusiva del Cliente.
      </p>

      <h2>3. Alta y acceso</h2>
      <ul>
        <li>El registro esta limitado a profesionales y empresas con actividad en Espana.</li>
        <li>El Cliente designa un usuario OWNER responsable de la cuenta.</li>
        <li>El OWNER puede invitar a otros usuarios con roles MANAGER, OPERATOR o VIEWER.</li>
        <li>Las credenciales son personales e intransferibles.</li>
      </ul>

      <h2>4. Planes y precios</h2>
      <p>
        Los planes vigentes y sus precios estan publicados en{" "}
        <a href="/precios">heredia.app/precios</a>. Todos los precios son en EUR sin IVA.
      </p>
      <ul>
        <li><strong>Inicia:</strong> 149 EUR/mes. Sin cuota de setup.</li>
        <li><strong>Despacho:</strong> 349 EUR/mes + 299 EUR setup unico.</li>
        <li><strong>Firma:</strong> 749 EUR/mes + 990 EUR setup unico.</li>
        <li><strong>Prepago anual:</strong> descuento del 17% (equivalente a 2 meses gratis).</li>
      </ul>

      <h2>5. Periodo de prueba</h2>
      <p>
        Heredia puede ofrecer un periodo de prueba gratuito (&quot;trial&quot;) a su discrecion.
        Durante el trial el Cliente tiene acceso completo a las funcionalidades del plan asignado.
        Al finalizar el periodo de prueba, el acceso se suspende hasta que el Cliente active
        una suscripcion de pago.
      </p>

      <h2>6. Facturacion y pago</h2>
      <ul>
        <li>La facturacion se realiza por anticipado (mensual o anual segun el plan elegido).</li>
        <li>Los pagos se procesan a traves de Stripe. Heredia no almacena datos de tarjeta.</li>
        <li>En caso de impago, el acceso se suspende tras 7 dias naturales.</li>
        <li>Los expedientes adicionales sobre el limite del plan se facturan al final del mes.</li>
        <li>El prepago anual no es reembolsable.</li>
      </ul>

      <h2>7. Cancelacion</h2>
      <ul>
        <li>Los planes mensuales se pueden cancelar en cualquier momento desde el panel de facturacion.</li>
        <li>La cancelacion surte efecto al final del periodo facturado.</li>
        <li>Tras la cancelacion, el Cliente puede exportar sus datos durante 30 dias.</li>
        <li>Transcurridos los 30 dias, los datos se eliminan de forma irreversible.</li>
      </ul>

      <h2>8. Propiedad de los datos</h2>
      <p>
        Los datos introducidos por el Cliente en la Plataforma son propiedad del Cliente.
        Heredia actua como encargado del tratamiento y no reclama ningun derecho sobre dichos datos.
        El Cliente puede solicitar una exportacion completa en formato PDF/ZIP en cualquier momento.
      </p>

      <h2>9. Nivel de servicio (SLA)</h2>
      <ul>
        <li>Disponibilidad objetivo: 99,5% mensual (excluyendo mantenimiento programado).</li>
        <li>Mantenimiento programado: notificado con 48h de antelacion.</li>
        <li>Soporte: segun plan (48h Inicia, 24h Despacho, prioritario Firma).</li>
      </ul>

      <h2>10. Limitacion de responsabilidad</h2>
      <p>
        Heredia no sera responsable de danos indirectos, lucro cesante ni sanciones derivadas
        del uso o imposibilidad de uso de la Plataforma. La responsabilidad total de Heredia
        se limita al importe abonado por el Cliente en los 12 meses anteriores al evento.
      </p>

      <h2>11. Proteccion de datos</h2>
      <p>
        El tratamiento de datos personales se rige por nuestra{" "}
        <a href="/legal/privacidad">Politica de Privacidad</a> y por el Acuerdo de Encargo
        de Tratamiento (DPA) firmado con cada Cliente.
      </p>

      <h2>12. Propiedad intelectual</h2>
      <p>
        Todos los derechos de propiedad intelectual sobre la Plataforma (codigo, diseno,
        marca, documentacion) pertenecen a HEREDIA TECHNOLOGIES S.L. El Cliente obtiene
        una licencia de uso no exclusiva, no transferible, limitada al periodo de suscripcion.
      </p>

      <h2>13. Modificaciones</h2>
      <p>
        Heredia puede modificar estos terminos con un preaviso de 30 dias. Si el Cliente
        no acepta los nuevos terminos, puede cancelar su suscripcion antes de la fecha
        de entrada en vigor.
      </p>

      <h2>14. Ley aplicable y jurisdiccion</h2>
      <p>
        Estos terminos se rigen por la legislacion espanola. Para cualquier controversia
        derivada del presente contrato, las partes se someten a los juzgados y tribunales
        de Madrid (Espana).
      </p>
    </article>
  );
}
