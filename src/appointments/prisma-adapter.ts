import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Builds a PrismaPg driver adapter for the configured DATABASE_URL.
 *
 * Aiven (and most managed Postgres providers) terminate TLS with a
 * self-signed CA, which the `pg` driver rejects under the default
 * `verify-full` behaviour. We keep the connection encrypted but skip
 * CA chain verification via `rejectUnauthorized: false`.
 */
export function createPrismaAdapter(): PrismaPg {
  const connectionString = (process.env.DATABASE_URL ?? '').replace(
    /[?&]sslmode=[^&]*/,
    '',
  );
  return new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}
