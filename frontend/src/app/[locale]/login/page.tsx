import { GoogleLoginPanel } from "@/components/legal/GoogleLoginPanel";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl justify-center">
        <GoogleLoginPanel locale={locale} />
      </div>
    </main>
  );
}
