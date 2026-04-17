import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politica de Cookies — BARITUR PRO",
  description: "Informacion sobre las cookies utilizadas por BARITUR PRO.",
  alternates: { canonical: "https://baritur.pro/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1>Politica de Cookies</h1>
      <p className="text-sm text-gray-500">Ultima actualizacion: abril 2026</p>

      <h2>1. Que son las cookies</h2>
      <p>
        Las cookies son pequenos archivos de texto que se almacenan en tu navegador cuando
        visitas un sitio web. Permiten recordar preferencias, mantener sesiones activas
        y recopilar informacion anonima sobre el uso del sitio.
      </p>

      <h2>2. Cookies que utilizamos</h2>
      <table>
        <thead>
          <tr><th>Cookie</th><th>Tipo</th><th>Finalidad</th><th>Duracion</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>next-auth.session-token</code></td>
            <td>Tecnica (estrictamente necesaria)</td>
            <td>Mantener la sesion del usuario autenticado</td>
            <td>Sesion / 30 dias</td>
          </tr>
          <tr>
            <td><code>next-auth.csrf-token</code></td>
            <td>Tecnica (seguridad)</td>
            <td>Proteccion contra ataques CSRF</td>
            <td>Sesion</td>
          </tr>
          <tr>
            <td><code>next-auth.callback-url</code></td>
            <td>Tecnica (funcional)</td>
            <td>Redireccion tras el inicio de sesion</td>
            <td>Sesion</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Cookies de terceros</h2>
      <p>
        Actualmente BARITUR PRO <strong>no utiliza cookies de terceros</strong> (analitica,
        publicidad ni redes sociales). Si en el futuro incorporasemos servicios de terceros
        que instalen cookies, actualizaremos esta politica y solicitaremos tu consentimiento
        previo conforme al RGPD y la LSSI-CE.
      </p>

      <h2>4. Base juridica</h2>
      <p>
        Las cookies tecnicas estrictamente necesarias para la prestacion del servicio
        estan exentas del requisito de consentimiento (art. 22.2 LSSI-CE). Para cualquier
        cookie no esencial, solicitaremos tu consentimiento expreso.
      </p>

      <h2>5. Como gestionar las cookies</h2>
      <p>
        Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que
        desactivar las cookies tecnicas puede impedir el correcto funcionamiento de la Plataforma.
      </p>
      <ul>
        <li><strong>Chrome:</strong> Configuracion → Privacidad y seguridad → Cookies</li>
        <li><strong>Firefox:</strong> Preferencias → Privacidad → Cookies</li>
        <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies y datos de sitios web</li>
        <li><strong>Edge:</strong> Configuracion → Cookies y permisos del sitio</li>
      </ul>

      <h2>6. Contacto</h2>
      <p>
        Para cualquier consulta sobre el uso de cookies, contacta con nuestro DPO en{" "}
        <strong>dpo@baritur.pro</strong>.
      </p>
    </article>
  );
}
