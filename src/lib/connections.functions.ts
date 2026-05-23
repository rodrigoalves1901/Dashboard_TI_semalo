import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  systemType: z.enum([
    "mysql",
    "mariadb",
    "sqlserver",
    "sharepoint",
    "msgraph_licenses",
    "bigquery",
    "demo",
  ]),
  host: z.string().trim().min(0).max(500),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(0).max(500),
  username: z.string().trim().min(0).max(255),
  password: z.string().max(20000),
  ssl: z.boolean().optional(),
});

type TestResult = { ok: true; info: string; latencyMs: number } | { ok: false; message: string };

export const testConnectionOnServer = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<TestResult> => {
    const start = Date.now();
    try {
      switch (data.systemType) {
        case "mysql":
        case "mariadb":
          return await testMySql(data, start);
        case "sqlserver":
          return await testSqlServer(data, start);
        case "sharepoint":
          return await testSharepoint(data, start);
        case "msgraph_licenses":
          return await testMsgraphLicenses(data, start);
        case "bigquery":
          return await testBigQuery(data, start);
        case "demo":
          return { ok: true, info: "Modo Demo · dados mockados", latencyMs: Date.now() - start };
      }
    } catch (err) {
      return { ok: false, message: (err as Error).message ?? "Falha ao conectar" };
    }
  });

async function testMySql(data: z.infer<typeof inputSchema>, start: number): Promise<TestResult> {
  const mysql = await import("mysql2/promise");
  let conn: import("mysql2/promise").Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host: data.host,
      port: data.port,
      user: data.username,
      password: data.password,
      database: data.database || undefined,
      ssl: data.ssl ? {} : undefined,
      connectTimeout: 8000,
    });
    const [rows] = await conn.query("SELECT VERSION() AS version");
    const version = (rows as Array<{ version: string }>)[0]?.version ?? "?";
    const flavor = data.systemType === "mariadb" ? "MariaDB" : "MySQL";
    return { ok: true, info: `${flavor} ${version}`, latencyMs: Date.now() - start };
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch {
        /* ignore */
      }
    }
  }
}

async function testSqlServer(
  data: z.infer<typeof inputSchema>,
  start: number,
): Promise<TestResult> {
  const sql = (await import("mssql")).default;
  let pool: import("mssql").ConnectionPool | null = null;
  try {
    pool = await sql.connect({
      server: data.host,
      port: data.port,
      user: data.username,
      password: data.password,
      database: data.database || undefined,
      connectionTimeout: 8000,
      requestTimeout: 8000,
      options: {
        encrypt: !!data.ssl,
        trustServerCertificate: true,
      },
    });
    const result = await pool.request().query("SELECT @@VERSION AS version");
    const raw = (result.recordset?.[0]?.version as string) ?? "SQL Server";
    const version = raw.split("\n")[0]?.trim() || "SQL Server";
    return { ok: true, info: version, latencyMs: Date.now() - start };
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {
        /* ignore */
      }
    }
  }
}

async function testSharepoint(
  data: z.infer<typeof inputSchema>,
  start: number,
): Promise<TestResult> {
  const tenantId = data.host.trim();
  const clientId = data.username.trim();
  const clientSecret = data.password;
  const siteUrl = data.database.trim();

  if (!tenantId || !clientId || !clientSecret || !siteUrl) {
    return {
      ok: false,
      message: "Tenant ID, Client ID, Client Secret e Site URL são obrigatórios",
    };
  }

  // 1) OAuth client credentials -> access token
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return {
      ok: false,
      message: `Falha ao autenticar (${tokenRes.status}): ${text.slice(0, 200)}`,
    };
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    return { ok: false, message: tokenJson.error_description ?? "Token não retornado" };
  }

  // 2) Validate site access via Graph API
  // Accepts site path like "contoso.sharepoint.com:/sites/Marketing"
  const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteUrl}`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!siteRes.ok) {
    const text = await siteRes.text();
    return {
      ok: false,
      message: `Falha ao acessar site (${siteRes.status}): ${text.slice(0, 200)}`,
    };
  }
  const site = (await siteRes.json()) as { displayName?: string; webUrl?: string };
  return {
    ok: true,
    info: `SharePoint · ${site.displayName ?? site.webUrl ?? "site OK"}`,
    latencyMs: Date.now() - start,
  };
}

async function testMsgraphLicenses(
  data: z.infer<typeof inputSchema>,
  start: number,
): Promise<TestResult> {
  const tenantId = data.host.trim();
  const clientId = data.username.trim();
  const clientSecret = data.password;

  if (!tenantId || !clientId || !clientSecret) {
    return {
      ok: false,
      message: "Tenant ID, Client ID e Client Secret são obrigatórios",
    };
  }

  // 1) OAuth client credentials -> access token
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return {
      ok: false,
      message: `Falha ao autenticar (${tokenRes.status}): ${text.slice(0, 200)}`,
    };
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    return { ok: false, message: tokenJson.error_description ?? "Token não retornado" };
  }

  // 2) Validate access by fetching subscribed SKUs via Graph API
  const skusRes = await fetch(`https://graph.microsoft.com/v1.0/subscribedSkus`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!skusRes.ok) {
    const text = await skusRes.text();
    return {
      ok: false,
      message: `Falha ao buscar licenças (${skusRes.status}): ${text.slice(0, 200)}`,
    };
  }
  const skus = (await skusRes.json()) as { value?: any[] };
  const count = skus.value?.length ?? 0;
  return {
    ok: true,
    info: `Microsoft Graph · ${count} plano(s) de licença ativo(s)`,
    latencyMs: Date.now() - start,
  };
}

async function testBigQuery(data: z.infer<typeof inputSchema>, start: number): Promise<TestResult> {
  const projectId = data.database.trim();
  const jsonKey = data.password.trim();
  const dataset = data.host.trim() || undefined;

  if (!projectId || !jsonKey) {
    return {
      ok: false,
      message: "Project ID e JSON Key (Service Account) são obrigatórios",
    };
  }

  let credentials: Record<string, any>;
  try {
    credentials = JSON.parse(jsonKey);
  } catch {
    return {
      ok: false,
      message: "JSON Key inválido — verifique se é um JSON de Service Account do Google",
    };
  }

  if (credentials.type !== "service_account") {
    return {
      ok: false,
      message: "O JSON precisa ser de um Service Account (type: service_account)",
    };
  }

  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    const bq = new BigQuery({ projectId, credentials });

    // Lista datasets para validar o acesso
    const [datasets] = await bq.getDatasets({ maxResults: 5 });
    const dsNames = (datasets as any[])
      .map((d) => d.id)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const extra = dataset ? ` · Dataset: ${dataset}` : dsNames ? ` · Datasets: ${dsNames}` : "";
    return {
      ok: true,
      info: `BigQuery · Projeto: ${projectId}${extra}`,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return { ok: false, message: `Falha ao conectar ao BigQuery: ${(err as Error).message}` };
  }
}
