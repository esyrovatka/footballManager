import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { users } from '../src/db/schema/auth';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: pnpm grant-admin <email>');
    process.exit(1);
  }

  const result = await db
    .update(users)
    .set({ isAdmin: true })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email, isAdmin: users.isAdmin });

  if (result.length === 0) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Granted admin to ${result[0].email} (${result[0].id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('grant-admin failed:', err);
  process.exit(1);
});
