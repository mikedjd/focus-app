import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 px-8 py-8 lg:px-16 lg:py-11">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
