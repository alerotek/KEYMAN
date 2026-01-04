import { redirect } from 'next/navigation';
import { requireRole } from '../../../lib/requireRole';
import ReceptionDashboardClient from '../../reception/ReceptionDashboardClient';

export default async function ReceptionDashboard() {
  try {
    await requireRole(['admin', 'staff']);
    return <ReceptionDashboardClient />;
  } catch (error) {
    if ((error as Error).message === 'login') {
      redirect('/login');
    }
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Forbidden</h1>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }
}
