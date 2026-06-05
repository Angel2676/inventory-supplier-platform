require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../src/db");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());

  return values.map((value) => value.replace(/^"|"$/g, "").trim());
}

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    throw new Error(
      "Usage: node scripts/import-gigsberg-public-urls.js gigsberg_public_urls.csv",
    );
  }

  const absolutePath = path.resolve(csvPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`CSV file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV vuoto o senza righe dati");
  }

  const headers = parseCsvLine(lines[0]);

  const remoteEventIdIndex = headers.indexOf("remote_event_id");
  const publicUrlIndex = headers.indexOf("public_url");

  if (remoteEventIdIndex === -1 || publicUrlIndex === -1) {
    throw new Error(
      "CSV non valido. Le colonne obbligatorie sono: remote_event_id, public_url",
    );
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line);
    const remoteEventId = columns[remoteEventIdIndex];
    const publicUrl = columns[publicUrlIndex];

    if (!remoteEventId || !publicUrl) {
      skipped += 1;
      console.log("SKIPPED missing remote_event_id/public_url:", line);
      continue;
    }

    if (!publicUrl.startsWith("https://www.gigsberg.com/")) {
      skipped += 1;
      console.log("SKIPPED invalid Gigsberg URL:", {
        remoteEventId,
        publicUrl,
      });
      continue;
    }

    try {
      const result = await pool.query(
        `
        UPDATE marketplace_mappings
        SET public_url = $1,
            updated_at = NOW()
        WHERE marketplace = 'gigsberg'
          AND mapping_type = 'event'
          AND remote_event_id = $2
        RETURNING id, internal_event_id, remote_event_id, remote_event_name, public_url
        `,
        [publicUrl, remoteEventId],
      );

      if (result.rowCount === 0) {
        skipped += 1;
        console.log("SKIPPED no mapping found:", { remoteEventId, publicUrl });
        continue;
      }

      updated += result.rowCount;
      for (const row of result.rows) {
        console.log("UPDATED:", row);
      }
    } catch (error) {
      failed += 1;
      console.error("FAILED:", {
        remoteEventId,
        publicUrl,
        error: error.message,
      });
    }
  }

  console.log("Import completed:", {
    updated,
    skipped,
    failed,
  });
}

main()
  .catch((error) => {
    console.error("Import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
