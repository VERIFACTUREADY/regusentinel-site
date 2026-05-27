import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Privacidad — Heredia",
  description: "Politica de privacidad y proteccion de datos de Heredia. Cumplimiento RGPD y LOPDGDD.",
  alternates: { canonical: "https://heredia.app/legal/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1>Politica de Privacidad</h1>
      <p className="text-sm text-gray-500">Ultima actualizacion: abril 2026</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        HEREDIA TECHNOLOGIES S.L. (en adelante, &quot;Heredia&quot;), con domicilio social en Espana,
        es el responsable del tratamiento de los datos personales recogidos a traves de la
        plataforma Heredia (&quot;la Plataforma&quot;).
      </p>
      <p>Contacto del Delegado de Proteccion de Datos: <strong>dpo@heredia.app</strong></p>

      <h2>2. Datos que tratamos</h2>
      <h3>2.1 Datos de usuarios profesionales</h3>
      <ul>
        <li>Nombre, email, telefono, cargo</li>
        <li>Datos de la organizacion (nombre, NIF, domicilio fiscal)</li>
        <li>Datos de facturacion y metodos de pago (procesados por Stripe)</li>
        <li>Registros de actividad (audit logs) y uso de la Plataforma</li>
      </ul>

      <h3>2.2 Datos de personas fallecidas y familiares</h3>
      <p>
        Los datos de personas fallecidas no se consideran datos personales a efectos del RGPD
        (Considerando 27). No obstante, aplicamos las garantias del articulo 3 de la
        Ley Organica 3/2018 (LOPDGDD) sobre el acceso a datos de personas fallecidas.
      </p>
      <p>
        Los datos de los familiares o contactos del expediente (nombre, email, telefono,
        parentesco) se tratan bajo la base juridica del interes legitimo del responsable
        del expediente (la gestoria o funeraria cliente de Heredia).
      </p>

      <h3>2.3 Datos del portal familia</h3>
      <ul>
        <li>Documentos subidos por familiares a traves del portal seguro</li>
        <li>Registros de acceso al portal (IP, fecha/hora)</li>
      </ul>

      <h2>3. Bases juridicas del tratamiento</h2>
      <table>
        <thead>
          <tr><th>Finalidad</th><th>Base juridica</th></tr>
        </thead>
        <tbody>
          <tr><td>Prestacion del servicio SaaS</td><td>Ejecucion del contrato (art. 6.1.b RGPD)</td></tr>
          <tr><td>Facturacion y cobro</td><td>Obligacion legal (art. 6.1.c RGPD)</td></tr>
          <tr><td>Comunicaciones comerciales propias</td><td>Interes legitimo (art. 6.1.f RGPD)</td></tr>
          <tr><td>Mejora del producto y analitica de uso</td><td>Interes legitimo (art. 6.1.f RGPD)</td></tr>
          <tr><td>Cumplimiento de obligaciones fiscales</td><td>Obligacion legal (art. 6.1.c RGPD)</td></tr>
        </tbody>
      </table>

      <h2>4. Encargados del tratamiento</h2>
      <p>Heredia actua como encargado del tratamiento respecto a los datos de expedientes
        gestionados por las organizaciones cliente. El contrato de encargo de tratamiento
        (DPA) se firma con cada cliente antes del inicio del servicio.</p>
      <p>Subencargados principales:</p>
      <ul>
        <li><strong>Vercel Inc.</strong> — Alojamiento (infraestructura en la UE, region fra1)</li>
        <li><strong>Neon Inc.</strong> — Base de datos PostgreSQL (region eu-central-1)</li>
        <li><strong>Stripe Inc.</strong> — Procesamiento de pagos (certificado PCI DSS Level 1)</li>
        <li><strong>SMTP provider</strong> — Envio de correos transaccionales</li>
      </ul>

      <h2>5. Transferencias internacionales</h2>
      <p>
        Los datos se almacenan en centros de datos ubicados en la Union Europea.
        Las transferencias a encargados con sede fuera del EEE se amparan en las
        Clausulas Contractuales Tipo (SCCs) de la Comision Europea o en la Decision
        de Adecuacion correspondiente.
      </p>

      <h2>6. Plazos de conservacion</h2>
      <ul>
        <li>Datos de expedientes: configurable por organizacion (por defecto 90 dias tras cierre, ampliable)</li>
        <li>Audit logs: 5 anos (obligaciones mercantiles)</li>
        <li>Datos de facturacion: 6 anos (Ley General Tributaria)</li>
        <li>Datos de usuarios: mientras se mantenga la relacion contractual + 3 anos</li>
      </ul>

      <h2>7. Derechos de los interesados</h2>
      <p>Puedes ejercer tus derechos de acceso, rectificacion, supresion, limitacion,
        portabilidad y oposicion enviando un email a <strong>dpo@heredia.app</strong>.</p>
      <p>
        Tambien puedes presentar una reclamacion ante la Agencia Espanola de Proteccion
        de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).
      </p>

      <h2>8. Medidas de seguridad</h2>
      <ul>
        <li>Cifrado en transito (TLS 1.2+) y en reposo (AES-256)</li>
        <li>Autenticacion multifactor disponible para todos los usuarios</li>
        <li>Audit trail inmutable de todas las acciones sobre expedientes</li>
        <li>Copias de seguridad automaticas con retencion de 30 dias</li>
        <li>Control de acceso basado en roles (RBAC)</li>
        <li>Revision periodica de seguridad y pruebas de intrusion</li>
      </ul>

      <h2>9. Modificaciones</h2>
      <p>
        Heredia se reserva el derecho de modificar esta politica. Cualquier cambio
        sustancial sera notificado a los usuarios registrados con un minimo de 30 dias
        de antelacion.
      </p>
    </article>
  );
}
