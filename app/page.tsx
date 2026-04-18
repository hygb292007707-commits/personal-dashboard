import DashboardClient from '../components/DashboardClient';
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <main className="flex-1 w-full min-h-screen bg-zinc-50 dark:bg-black">
      {/* max-w kısıtlamasını sildik, w-full ile tam ekran yayılmasını sağladık */}
      <div className="w-full space-y-8">
        <DashboardClient />
      </div>
    </main>
  );
}