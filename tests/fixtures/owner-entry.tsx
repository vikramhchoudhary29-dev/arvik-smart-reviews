import { createRoot } from 'react-dom/client';
import OwnerDashboard from '../../components/owner-dashboard';
import SubscriptionsPage from '../../components/subscriptions';
import AdminOutlets from '../../components/outlets';
import OwnerAdmin from '../../components/owner-admin';
createRoot(document.getElementById('root')!).render(
  location.pathname.startsWith('/admin/outlets') ? (
    <AdminOutlets />
  ) : location.pathname.startsWith('/admin/subscriptions') ? (
    <SubscriptionsPage />
  ) : location.pathname.startsWith('/admin') ? (
    <OwnerAdmin />
  ) : (
    <OwnerDashboard />
  ),
);
