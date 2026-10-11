import type { FastifyRequest } from "fastify";

/** A `.nexbackup` upload: the file (field "file") plus its text fields (password, confirm, …). */
export async function readBackupUpload(
  request: FastifyRequest
): Promise<{ fileBuffer: Buffer | null; fields: Record<string, string> }> {
  let fileBuffer: Buffer | null = null;
  const fields: Record<string, string> = {};
  for await (const part of request.parts()) {
    if (part.type === "file") {
      const data = await part.toBuffer();
      if (part.fieldname === "file") fileBuffer = data;
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }
  return { fileBuffer, fields };
}
