import Sidebar from '@/components/sidebar';
import Topbar from '@/components/topbar';
import { getBotState, getStorageState } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [bot, storage] = await Promise.all([getBotState(), getStorageState()]);

  return (
    <div className="shell">
      <Sidebar bot={bot} storage={storage} />
      <div className="main">
        <Topbar bot={bot} />
        {children}
      </div>
    </div>
  );
}
