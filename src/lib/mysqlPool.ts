import mysql from "mysql2/promise";

// One pool per process, reused across requests (this is how mysql2 is meant
// to be used in a long-running Node server — do NOT open a new connection
// per request).
//
// decimalNumbers: true    -> DECIMAL columns come back as JS numbers, not
//                            strings (mysql2's default, a common gotcha).
// dateStrings: true        -> in case any DATETIME column is ever added later,
//                            return it as the raw string instead of a JS
//                            Date in server-local time. All timestamps in
//                            this schema are already VARCHAR ISO strings, so
//                            this mostly future-proofs against a mistake.
let pool: mysql.Pool | undefined;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      decimalNumbers: true,
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }
  return pool;
}
