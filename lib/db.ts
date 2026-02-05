import { Pool } from "@neondatabase/serverless"

let pool: Pool | null = null

export function getPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  if (!pool) {
    pool = new Pool({ connectionString })
  }

  return pool
}
