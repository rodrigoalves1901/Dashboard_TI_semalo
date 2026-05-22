import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getDatabaseSchema = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ connectionId: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { data: conn, error } = await supabaseAdmin
      .from("connections")
      .select("*")
      .eq("id", data.connectionId)
      .single();

    if (error || !conn) throw new Error("Conexão não encontrada");

    if (conn.system_type === "msgraph_licenses") {
      return [
        {
          name: "licenses",
          description: "Licenças de produtos do Microsoft 365 / Office 365",
          columns: [
            { name: "name", type: "text", nullable: false, pk: true },
            { name: "assigned", type: "integer", nullable: false, pk: false },
            { name: "total", type: "integer", nullable: false, pk: false },
            { name: "free", type: "integer", nullable: false, pk: false },
            { name: "skuId", type: "text", nullable: false, pk: false },
            { name: "skuPartNumber", type: "text", nullable: false, pk: false },
          ],
        },
      ];
    }

    if (conn.system_type === "demo") {
      const { GLPI_TABLES } = await import("@/lib/glpi-schema-mock");
      return GLPI_TABLES;
    }

    if (conn.system_type === "mysql" || conn.system_type === "mariadb") {
      const mysql = await import("mysql2/promise");
      let db: import("mysql2/promise").Connection | null = null;
      try {
        db = await mysql.createConnection({
          host: conn.host,
          port: conn.port,
          user: conn.username,
          password: conn.password,
          database: conn.database,
          ssl: conn.ssl ? {} : undefined,
          connectTimeout: 8000,
        });

        const [tables] = await db.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        const result = [];

        for (const row of tables as any[]) {
          const tableName = Object.values(row)[0] as string;
          const [columns] = await db.query(`SHOW COLUMNS FROM ??`, [tableName]);

          const cols = (columns as any[]).map((c) => ({
            name: c.Field,
            type: c.Type,
            nullable: c.Null === "YES",
            pk: c.Key === "PRI",
          }));

          result.push({
            name: tableName,
            description: "",
            columns: cols,
          });
        }
        return result;
      } finally {
        if (db) await db.end();
      }
    }

    if (conn.system_type === "sqlserver") {
      const sql = (await import("mssql")).default;
      let pool: import("mssql").ConnectionPool | null = null;
      try {
        pool = await sql.connect({
          server: conn.host,
          port: conn.port,
          user: conn.username,
          password: conn.password,
          database: conn.database,
          connectionTimeout: 8000,
          options: { encrypt: !!conn.ssl, trustServerCertificate: true },
        });

        const result = await pool.request().query(`
          SELECT 
            t.name AS TableName,
            c.name AS ColumnName,
            ty.name AS DataType,
            c.is_nullable AS IsNullable,
            ISNULL(i.is_primary_key, 0) AS IsPrimaryKey
          FROM sys.tables t
          INNER JOIN sys.columns c ON t.object_id = c.object_id
          INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
          LEFT JOIN sys.index_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
          LEFT JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        `);

        const map = new Map<string, any>();
        for (const row of result.recordset) {
          if (!map.has(row.TableName)) {
            map.set(row.TableName, { name: row.TableName, description: "", columns: [] });
          }
          const t = map.get(row.TableName);
          t.columns.push({
            name: row.ColumnName,
            type: row.DataType,
            nullable: row.IsNullable === 1 || row.IsNullable === true,
            pk: row.IsPrimaryKey === 1 || row.IsPrimaryKey === true,
          });
        }
        return Array.from(map.values());
      } finally {
        if (pool) await pool.close();
      }
    }

    if (conn.system_type === "bigquery") {
      const projectId = conn.database.trim();
      const credentials = JSON.parse(conn.password);
      const { BigQuery } = await import("@google-cloud/bigquery");
      const bq = new BigQuery({ projectId, credentials });

      const [datasets] = await bq.getDatasets();
      const result = [];

      for (const ds of datasets as any[]) {
        const [tables] = await ds.getTables();
        for (const table of tables as any[]) {
          const [meta] = await table.getMetadata();
          const schema = meta.schema?.fields ?? [];
          result.push({
            name: `${ds.id}.${table.id}`,
            description: `Dataset: ${ds.id}`,
            columns: schema.map((f: any) => ({
              name: f.name,
              type: f.type,
              nullable: f.mode !== "REQUIRED",
              pk: false,
            })),
          });
        }
      }
      return result;
    }

    return [];
  });

export const runExplorerQuery = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ connectionId: z.string(), query: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { data: conn, error } = await supabaseAdmin
      .from("connections")
      .select("*")
      .eq("id", data.connectionId)
      .single();

    if (error || !conn) throw new Error("Conexão não encontrada");

    if (conn.system_type === "msgraph_licenses") {
      // 1) Fetch OAuth access token using credentials
      const tenantId = conn.host.trim();
      const clientId = conn.username.trim();
      const clientSecret = conn.password;

      if (!tenantId || !clientId || !clientSecret) {
        throw new Error("Tenant ID, Client ID e Client Secret são obrigatórios na conexão");
      }

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
        throw new Error(
          `Falha ao autenticar no Azure AD (${tokenRes.status}): ${text.slice(0, 200)}`,
        );
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      if (!tokenJson.access_token) {
        throw new Error("Token de acesso não retornado pelo Azure AD");
      }

      // 2) Fetch licenses from Graph API
      const skusRes = await fetch(`https://graph.microsoft.com/v1.0/subscribedSkus`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!skusRes.ok) {
        const text = await skusRes.text();
        throw new Error(
          `Falha ao obter licenças do Microsoft Graph (${skusRes.status}): ${text.slice(0, 200)}`,
        );
      }
      const skusJson = (await skusRes.json()) as { value?: any[] };
      const rawSkus = skusJson.value ?? [];

      const FRIENDLY_NAMES: Record<string, string> = {
        SPE_E5: "Microsoft 365 E5",
        M365_E5: "Microsoft 365 E5",
        SPE_E3: "Microsoft 365 E3",
        M365_E3: "Microsoft 365 E3",
        SPE_F3: "Microsoft 365 F3",
        M365_F3: "Microsoft 365 F3",
        DEVELOPER_PACK_E5: "Microsoft 365 E5 Developer",
        O365_BUSINESS_PREMIUM: "Microsoft 365 Business Premium",
        O365_BUSINESS_STANDARD: "Microsoft 365 Business Standard",
        O365_BUSINESS_BASIC: "Microsoft 365 Business Basic",
        O365_BUSINESS_ESSENTIALS: "Office 365 Business Essentials",
        ENTERPRISEPREMIUM: "Office 365 E3",
        ENTERPRISEPACK: "Office 365 E3",
        ENTERPRISEWITHOUTOUTLOOK: "Office 365 E3 sem Outlook",
        ENTERPRISEPREMIUM_NOPSTN: "Office 365 E5 sem PSTN",
        FLOW_FREE: "Microsoft Flow Free",
        POWER_BI_PRO: "Power BI Pro",
        POWER_BI_STANDARD: "Power BI Pro",
        POWER_BI_INDIVIDUAL: "Power BI Free",
        TEAMS_FREE: "Microsoft Teams Free",
        TEAMS_PREMIUM: "Microsoft Teams Premium",
        Microsoft_Teams_Premium: "Microsoft Teams Premium",
        WINDOWS_10_ENTERPRISE: "Windows 10/11 Enterprise",
      };

      const mapped = rawSkus.map((sku: any) => {
        const partNumber = sku.skuPartNumber ?? "";
        const friendlyName = FRIENDLY_NAMES[partNumber] || partNumber.replace(/_/g, " ");
        const total = sku.prepaidUnits?.enabled ?? 0;
        const assigned = sku.consumedUnits ?? 0;
        const free = Math.max(0, total - assigned);

        return {
          name: friendlyName,
          assigned: assigned,
          total: total,
          free: free,
          skuId: sku.skuId ?? "",
          skuPartNumber: partNumber,
        };
      });

      // 4) Simular SQL Select sobre o array 'mapped'
      let result: any[] = [...mapped];

      // 4.1) Processar cláusula WHERE básica (Ex: WHERE free > 0 AND name LIKE '%Power%')
      const whereMatch = data.query.match(/where\s+([\s\S]+?)(?:\s+order\s+by|\s+limit|$)/i);
      if (whereMatch && whereMatch[1]) {
        const whereClause = whereMatch[1].trim();
        const conditions = whereClause.split(/\s+and\s+/i);

        for (const cond of conditions) {
          const inMatch = cond.match(/([a-zA-Z0-9_]+)\s+in\s*\(([\s\S]+?)\)/i);
          if (inMatch) {
            const col = inMatch[1].trim() as keyof (typeof mapped)[0];
            const vals = inMatch[2]
              .split(",")
              .map((v) => v.trim().replace(/['"`]/g, "").toLowerCase());
            result = result.filter((item) => vals.includes(String(item[col] ?? "").toLowerCase()));
            continue;
          }

          const cleanCond = cond.replace(/[()]/g, "").trim();
          const likeMatch = cleanCond.match(/([a-zA-Z0-9_]+)\s+like\s+['"]%?([^%]+?)%?['"]/i);
          const opMatch = cleanCond.match(
            /([a-zA-Z0-9_]+)\s*(>=|<=|!=|<>|=|>|<)\s*['"]?([^'"]+?)['"]?$/i,
          );

          if (likeMatch) {
            const col = likeMatch[1].trim() as keyof (typeof mapped)[0];
            const val = likeMatch[2].toLowerCase();
            result = result.filter((item) =>
              String(item[col] ?? "")
                .toLowerCase()
                .includes(val),
            );
          } else if (opMatch) {
            const col = opMatch[1].trim() as keyof (typeof mapped)[0];
            const op = opMatch[2].trim();
            const rawVal = opMatch[3].trim();

            result = result.filter((item) => {
              const itemVal = item[col];
              if (typeof itemVal === "number") {
                const valNum = Number(rawVal);
                if (op === "=") return itemVal === valNum;
                if (op === "!=" || op === "<>") return itemVal !== valNum;
                if (op === ">") return itemVal > valNum;
                if (op === "<") return itemVal < valNum;
                if (op === ">=") return itemVal >= valNum;
                if (op === "<=") return itemVal <= valNum;
              } else {
                const valStr = rawVal.toLowerCase();
                const itemStr = String(itemVal ?? "").toLowerCase();
                if (op === "=") return itemStr === valStr;
                if (op === "!=" || op === "<>") return itemStr !== valStr;
              }
              return true;
            });
          }
        }
      }

      // 4.2) Processar ORDER BY (Ex: ORDER BY total DESC)
      const orderMatch = data.query.match(/order\s+by\s+([a-zA-Z0-9_]+)(?:\s+(asc|desc))?/i);
      if (orderMatch && orderMatch[1]) {
        const col = orderMatch[1].trim() as keyof (typeof mapped)[0];
        const dir = (orderMatch[2] || "asc").toLowerCase().trim();

        result.sort((a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (typeof valA === "number" && typeof valB === "number") {
            return dir === "desc" ? valB - valA : valA - valB;
          }
          const strA = String(valA ?? "").toLowerCase();
          const strB = String(valB ?? "").toLowerCase();
          return dir === "desc" ? strB.localeCompare(strA) : strA.localeCompare(strB);
        });
      }

      // 4.3) Processar LIMIT
      const limitMatch = data.query.match(/limit\s+([0-9]+)/i);
      if (limitMatch && limitMatch[1]) {
        const limitVal = parseInt(limitMatch[1], 10);
        result = result.slice(0, limitVal);
      }

      // 4.4) Processar projeção de colunas com suporte a aliases (SELECT col1 AS alias1, col2 AS alias2 FROM ...)
      const selectMatch = data.query.match(/^\s*select\s+([\s\S]+?)\s+from/i);
      if (selectMatch && selectMatch[1]) {
        const colsStr = selectMatch[1].trim();

        // 4.4.1) Processar CASE WHEN para renomear categorias dinamicamente (Ex: CASE WHEN skuPartNumber = 'X' THEN 'Y' END as name)
        const caseWhenMatch = colsStr.match(/case\s+([\s\S]+?)\s+end\s+as\s+name/i);
        if (caseWhenMatch) {
          const caseBody = caseWhenMatch[1];
          const whenMatches = [
            ...caseBody.matchAll(
              /when\s+([a-zA-Z0-9_]+)\s*=\s*['"]([^'"]+)['"]\s+then\s+['"]([^'"]+)['"]/gi,
            ),
          ];

          result = result.map((item) => {
            let currentName = item.name;
            for (const m of whenMatches) {
              const col = m[1].trim() as keyof typeof item;
              const target = m[2].trim().toLowerCase();
              const replacement = m[3].trim();

              if (col in item) {
                const itemValStr = String(item[col] ?? "")
                  .trim()
                  .toLowerCase();
                if (itemValStr === target) {
                  currentName = replacement;
                  break;
                }
              }
            }
            return { ...item, name: currentName };
          });
        }

        if (colsStr !== "*") {
          const selectedCols = colsStr.split(",").map((c) => c.trim());
          result = result.map((item) => {
            const projected: Record<string, any> = {};
            selectedCols.forEach((rawCol) => {
              // Se for a cláusula CASE WHEN ... END as name, projeta o campo "name" modificado
              if (
                rawCol.match(/end\s+as\s+name/i) ||
                rawCol.match(/as\s+name$/i) ||
                rawCol === "name"
              ) {
                projected["name"] = item["name"];
                return;
              }

              // Verifica se tem 'as' (ex: "total as Disponível" ou "total Disponível")
              const aliasMatch =
                rawCol.match(/^([a-zA-Z0-9_]+)\s+as\s+([a-zA-Z0-9_À-ÿ]+)/i) ||
                rawCol.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_À-ÿ]+)/i);

              if (aliasMatch) {
                const actualCol = aliasMatch[1].trim();
                const aliasName = aliasMatch[2].trim().replace(/['"`]/g, "");
                if (actualCol in item) {
                  projected[aliasName] = item[actualCol as keyof typeof item];
                }
              } else {
                const colClean = rawCol.replace(/['"`]/g, "");
                if (colClean in item) {
                  projected[colClean] = item[colClean as keyof typeof item];
                }
              }
            });
            return projected;
          });
        }
      }

      return result;
    }

    const sql = data.query.trim();

    // Validação de segurança:
    // 1. Deve começar com SELECT ou WITH (para CTEs)
    const isSelect = /^\s*(select|with)\b/i.test(sql);

    // 2. Não deve conter palavras-chave de modificação/destrutivas
    // Usamos \b para garantir que casamos a palavra inteira
    const destructiveKeywords =
      /\b(update|delete|insert|drop|alter|truncate|create|grant|revoke|exec|execute)\b/i;
    const hasDestructive = destructiveKeywords.test(sql);

    // 3. Bloquear múltiplos comandos (ponto e vírgula no meio)
    // Permitimos um ponto e vírgula apenas se for o último caractere não-espaço
    const hasMultipleCommands = /;./s.test(sql.replace(/\s*;?\s*$/, ""));

    if (!isSelect || hasDestructive || hasMultipleCommands) {
      throw new Error(
        "Comando SQL rejeitado por motivos de segurança. Apenas consultas de leitura (SELECT) simples são permitidas.",
      );
    }

    if (conn.system_type === "demo") {
      const { GLPI_TABLES } = await import("@/lib/glpi-schema-mock");
      // Find the table name from the simple select query using regex
      const match = data.query.match(/from\s+([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        const t = GLPI_TABLES.find((t) => t.name.toLowerCase() === match[1].toLowerCase());
        return t ? t.rows.slice(0, 50) : [];
      }
      return [];
    }

    if (conn.system_type === "mysql" || conn.system_type === "mariadb") {
      const mysql = await import("mysql2/promise");
      let db: import("mysql2/promise").Connection | null = null;
      try {
        db = await mysql.createConnection({
          host: conn.host,
          port: conn.port,
          user: conn.username,
          password: conn.password,
          database: conn.database,
          ssl: conn.ssl ? {} : undefined,
          connectTimeout: 8000,
        });

        const [rows] = await db.query(data.query);
        return rows as any[];
      } finally {
        if (db) await db.end();
      }
    }

    if (conn.system_type === "sqlserver") {
      const sql = (await import("mssql")).default;
      let pool: import("mssql").ConnectionPool | null = null;
      try {
        pool = await sql.connect({
          server: conn.host,
          port: conn.port,
          user: conn.username,
          password: conn.password,
          database: conn.database,
          connectionTimeout: 8000,
          options: { encrypt: !!conn.ssl, trustServerCertificate: true },
        });

        const result = await pool.request().query(data.query);
        return result.recordset;
      } finally {
        if (pool) await pool.close();
      }
    }

    if (conn.system_type === "bigquery") {
      const projectId = conn.database.trim();
      const credentials = JSON.parse(conn.password);
      const { BigQuery } = await import("@google-cloud/bigquery");
      const bq = new BigQuery({ projectId, credentials });

      const [job] = await bq.createQueryJob({
        query: data.query,
        useLegacySql: false,
        maximumBytesBilled: "1000000000", // 1 GB limite de segurança
      });
      const [rows] = await job.getQueryResults({ maxResults: 500 });
      // Converte BigQuery types (ex: { value: "..." }) para primitivos
      return (rows as any[]).map((row) => {
        const clean: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          clean[k] =
            v !== null && typeof v === "object" && "value" in (v as any) ? (v as any).value : v;
        }
        return clean;
      });
    }

    return [];
  });

export const generateServerAICompletion = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        provider: z.enum(["gemini", "openai", "claude"]),
        apiKey: z.string(),
        model: z.string(),
        prompt: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { provider, apiKey, model, prompt } = data;

    if (provider === "gemini") {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Gemini API error (status ${resp.status}): ${text}`);
      }
      const json = await resp.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sem resposta.";
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenAI API error (status ${resp.status}): ${text}`);
      }
      const json = await resp.json();
      return json.choices?.[0]?.message?.content ?? "Sem resposta.";
    }

    if (provider === "claude") {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Claude API error (status ${resp.status}): ${text}`);
      }
      const json = await resp.json();
      return json.content?.[0]?.text ?? "Sem resposta.";
    }

    return "Provedor não suportado.";
  });
