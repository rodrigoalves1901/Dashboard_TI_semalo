import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(1).max(120),
  username: z.string().trim().min(1).max(120),
  password: z.string().max(500),
  ssl: z.boolean().optional(),
});

export const testConnectionOnServer = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const mysql = await import("mysql2/promise");
    const start = Date.now();
    let conn: import("mysql2/promise").Connection | null = null;
    try {
      conn = await mysql.createConnection({
        host: data.host,
        port: data.port,
        user: data.username,
        password: data.password,
        database: data.database,
        ssl: data.ssl ? {} : undefined,
        connectTimeout: 8000,
      });
      const [rows] = await conn.query("SELECT VERSION() AS version");
      const version = (rows as Array<{ version: string }>)[0]?.version ?? "?";
      return {
        ok: true as const,
        version,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        ok: false as const,
        message: (err as Error).message ?? "Falha ao conectar",
      };
    } finally {
      if (conn) {
        try {
          await conn.end();
        } catch {
          // ignore
        }
      }
    }
  });
