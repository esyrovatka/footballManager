import { RegisterForm } from '@/components/auth-form';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return <RegisterForm returnTo={returnTo} />;
}
