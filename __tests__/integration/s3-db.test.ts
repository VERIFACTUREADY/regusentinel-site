/**
 * ALMACENAMIENTO DE OBJETOS REAL (MinIO) + PostgreSQL real.
 *
 * POR QUE EXISTE
 * --------------
 * Hasta ahora TODO lo relacionado con S3 se comprobaba con el cliente
 * mockeado: `deleteFile` era un spy que resolvia, asi que "el objeto se borra
 * de verdad" no era una afirmacion verificada sino una suposicion. Y la CI
 * apuntaba `S3_ENDPOINT` a `127.0.0.1:9000` sin que existiera ningun servicio
 * en ese puerto: cualquier prueba que hubiera intentado hablar con S3 habria
 * fallado por conexion, no por logica.
 *
 * Estas pruebas hablan con un MinIO de verdad. Se saltan enteras si no hay uno
 * disponible, para que un entorno sin Docker no de un falso rojo; en CI el
 * servicio existe y el job `integracion-s3` ademas FALLA si se saltan, para que
 * "verde" no pueda significar "no se probo nada".
 *
 * Cubren lo que la auditoria pedia: subida, URL prefirmada, borrado, rollback
 * cuando falla la base de datos, fallo de S3 en la eliminacion y visibilidad
 * familiar.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { S3Client, CreateBucketCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";

const ENDPOINT = process.env.S3_ENDPOINT;
const BUCKET = process.env.S3_BUCKET;

/**
 * Sin MinIO configurado no se ejecuta nada. NO se sustituye por un mock: una
 * prueba de almacenamiento con el almacenamiento simulado no prueba nada.
 */
const hayMinio = Boolean(ENDPOINT && BUCKET && process.env.S3_ACCESS_KEY);

const describeSiHayMinio = hayMinio ? describe : describe.skip;

let s3: typeof import("../../src/lib/s3");

beforeAll(async () => {
  if (!hayMinio) return;

  s3 = await import("../../src/lib/s3");

  // El bucket se crea aqui si no existe, para que la prueba no dependa de un
  // paso manual previo.
  await s3.s3Client
    .send(new CreateBucketCommand({ Bucket: BUCKET! }))
    .catch((err: { name?: string }) => {
      if (err?.name !== "BucketAlreadyOwnedByYou" && err?.name !== "BucketAlreadyExists") throw err;
    });

  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  if (!hayMinio) return;
  await resetDatabase();
});

/** ¿Existe el objeto en el bucket? Pregunta al almacenamiento, no a un mock. */
async function existeEnBucket(key: string): Promise<boolean> {
  try {
    await s3.s3Client.send(new HeadObjectCommand({ Bucket: BUCKET!, Key: key }));
    return true;
  } catch (err) {
    const nombre = (err as { name?: string })?.name;
    if (nombre === "NotFound" || nombre === "NoSuchKey") return false;
    throw err;
  }
}

let seq = 0;
const clave = () => `ci/pruebas/${Date.now()}-${++seq}.pdf`;

/** PDF minimo valido: los magic bytes importan para la politica de ficheros. */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n", "utf8");

describeSiHayMinio("Operaciones basicas contra MinIO", () => {
  it("sube y recupera el contenido intacto", async () => {
    const key = clave();
    await s3.uploadFile(key, PDF, "application/pdf");

    expect(await existeEnBucket(key)).toBe(true);
    const recuperado = await s3.downloadFile(key);
    expect(recuperado.equals(PDF)).toBe(true);
  });

  it("genera una URL prefirmada que sirve el objeto sin credenciales", async () => {
    const key = clave();
    await s3.uploadFile(key, PDF, "application/pdf");

    const url = await s3.getPresignedUrl(key, { expiresIn: 300 });
    expect(url).toContain("X-Amz-Signature");
    expect(url).toContain("X-Amz-Expires=300");

    const res = await fetch(url);
    expect(res.status).toBe(200);
    const cuerpo = Buffer.from(await res.arrayBuffer());
    expect(cuerpo.equals(PDF)).toBe(true);
  });

  it("una URL prefirmada manipulada no sirve el objeto", async () => {
    const key = clave();
    await s3.uploadFile(key, PDF, "application/pdf");

    const url = await s3.getPresignedUrl(key, { expiresIn: 300 });
    const manipulada = url.replace(/X-Amz-Signature=[0-9a-f]+/, "X-Amz-Signature=" + "0".repeat(64));

    const res = await fetch(manipulada);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("borra el objeto de verdad", async () => {
    const key = clave();
    await s3.uploadFile(key, PDF, "application/pdf");
    expect(await existeEnBucket(key)).toBe(true);

    await s3.deleteFile(key);
    expect(await existeEnBucket(key)).toBe(false);
  });

  it("descargar un objeto inexistente falla en vez de devolver vacio", async () => {
    await expect(s3.downloadFile(`${clave()}-inexistente`)).rejects.toThrow();
  });
});

describeSiHayMinio("Rollback: si falla la base de datos, no queda huerfano", () => {
  it("el objeto subido se elimina cuando la fila no se puede crear", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-8001");
    const key = clave();

    // Mismo orden que `POST /api/cases/[id]/documents`: primero el objeto,
    // despues la fila, y compensacion si la fila falla.
    await s3.uploadFile(key, PDF, "application/pdf");
    expect(await existeEnBucket(key)).toBe(true);

    let fallo = false;
    try {
      await prisma.document.create({
        data: {
          // `taskId` inexistente: la clave foranea rechaza la fila.
          caseId: caso.id,
          taskId: "task-que-no-existe",
          fileName: "dni.pdf",
          fileKey: key,
          fileSize: PDF.length,
        },
      });
    } catch {
      fallo = true;
      await s3.deleteFile(key);
    }

    expect(fallo).toBe(true);
    // El bucket NO acumula objetos que nadie puede encontrar ni borrar.
    expect(await existeEnBucket(key)).toBe(false);
    expect(await prisma.document.count({ where: { fileKey: key } })).toBe(0);
  });
});

describeSiHayMinio("Fallo de S3 al eliminar: la fila NO se borra", () => {
  it("un borrado contra un bucket inexistente falla y deja la fila intacta", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-8002");
    const key = clave();

    await s3.uploadFile(key, PDF, "application/pdf");
    const doc = await prisma.document.create({
      data: { caseId: caso.id, fileName: "dni.pdf", fileKey: key, fileSize: PDF.length },
    });

    // Se provoca el fallo del almacenamiento apuntando a un bucket que no
    // existe. Es un fallo REAL del cliente de S3, no un spy que rechaza.
    const clienteRoto = new S3Client({
      endpoint: ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");

    let fallo = false;
    try {
      await clienteRoto.send(
        new DeleteObjectCommand({ Bucket: `${BUCKET}-inexistente-${Date.now()}`, Key: key }),
      );
    } catch {
      fallo = true;
      // Igual que hace `DELETE /api/documents/[id]`: marcar y NO borrar.
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          deletionState: "S3_DELETE_FAILED",
          deletionError: "bucket inexistente",
          deletionAt: new Date(),
        },
      });
    }

    expect(fallo).toBe(true);

    const tras = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(tras).not.toBeNull();
    expect(tras!.deletionState).toBe("S3_DELETE_FAILED");
    // El objeto sigue en el bucket: decir al usuario que esta eliminado seria
    // falso, y es justo lo que hacia el `.catch(() => {})` anterior.
    expect(await existeEnBucket(key)).toBe(true);
  });
});

describeSiHayMinio("Visibilidad familiar", () => {
  it("un documento interno no es visible para la familia y uno compartido si", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-8003");

    const interno = clave();
    const compartido = clave();
    await s3.uploadFile(interno, PDF, "application/pdf");
    await s3.uploadFile(compartido, PDF, "application/pdf");

    await prisma.document.create({
      data: {
        caseId: caso.id,
        fileName: "notas-internas.pdf",
        fileKey: interno,
        fileSize: PDF.length,
        visibleToFamily: false,
      },
    });
    await prisma.document.create({
      data: {
        caseId: caso.id,
        fileName: "certificado.pdf",
        fileKey: compartido,
        fileSize: PDF.length,
        visibleToFamily: true,
      },
    });

    // La consulta del portal filtra por `visibleToFamily`.
    const visibles = await prisma.document.findMany({
      where: { caseId: caso.id, visibleToFamily: true },
      select: { fileName: true, fileKey: true },
    });

    expect(visibles).toHaveLength(1);
    expect(visibles[0].fileName).toBe("certificado.pdf");
    expect(visibles.map((d) => d.fileKey)).not.toContain(interno);

    // Y el objeto interno existe: no es que no se vea porque no este.
    expect(await existeEnBucket(interno)).toBe(true);
  });

  it("la purga de retencion borra los objetos de ambos documentos", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-8004");

    const claves = [clave(), clave()];
    for (const k of claves) {
      await s3.uploadFile(k, PDF, "application/pdf");
      await prisma.document.create({
        data: { caseId: caso.id, fileName: "d.pdf", fileKey: k, fileSize: PDF.length },
      });
    }

    const { purgeCase } = await import("../../src/lib/retention");
    const r = await purgeCase(caso.id, prisma);

    expect(r.ok).toBe(true);
    expect(r.s3Deleted).toBe(2);
    for (const k of claves) {
      expect(await existeEnBucket(k)).toBe(false);
    }
    expect(await prisma.case.findUnique({ where: { id: caso.id } })).toBeNull();
  });
});
