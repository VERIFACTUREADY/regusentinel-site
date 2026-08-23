import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

interface AuditLogInput {
  orgId: string;
  userId?: string;
  caseId?: string;
  action: string;
  details?: string;
  ip?: string;
}

/**
 * Quien escribe: el cliente global, o el de una transacción en curso.
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * Un cambio de estado y su entrada en la auditoría son **un solo hecho de
 * negocio**. Si se escriben con el cliente global son dos operaciones
 * confirmadas por separado, y entre una y otra el proceso puede morir: queda
 * el estado nuevo persistido y ninguna fila que diga quién lo cambió, cuándo
 * ni desde qué estado. En un expediente de herencia el histórico ES la prueba
 * de lo que se hizo, así que un estado sin su registro no es un registro
 * incompleto: es un estado que no se puede justificar.
 *
 * Pasando aquí el cliente de la transacción, la fila de auditoría entra en el
 * mismo COMMIT que la transición. Si la auditoría falla, la transición se
 * deshace: no hay forma de tener una sin la otra.
 */
type ClienteAuditoria = Prisma.TransactionClient | typeof prisma;

/**
 * Create an audit log entry.
 *
 * `cliente` permite escribir dentro de una transacción abierta. Sin él, se usa
 * el cliente global y la fila se confirma por su cuenta —correcto para los
 * registros que no acompañan a una escritura, como una lectura sensible—.
 */
export async function logAudit(
  { orgId, userId, caseId, action, details, ip }: AuditLogInput,
  cliente: ClienteAuditoria = prisma,
) {
  return cliente.auditLog.create({
    data: {
      orgId,
      userId,
      caseId,
      action,
      details,
      ip,
    },
  });
}
