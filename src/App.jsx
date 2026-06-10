import { useApp } from './context/AppContext';
import { SuperAdminProvider } from './context/SuperAdminContext';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import EmployeeLayout from './pages/employee/EmployeeLayout';
import ExpressClock from './pages/ExpressClock';
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout';
import ResetPassword from './pages/ResetPassword';

// Detectar rutas sin react-router
const path = window.location.pathname;
const expressMatch = path.match(/^\/fichar\/([0-9a-f-]{36})$/i);
const isSetPassword = path === '/set-password';

export default function App() {
  const { currentUser, needsPasswordReset } = useApp();

  if (expressMatch) return <ExpressClock token={expressMatch[1]} />;
  // /set-password: el empleado llega desde el email de invitación para crear su contraseña
  if (isSetPassword || needsPasswordReset) return <ResetPassword invite={isSetPassword} />;
  if (!currentUser) return <Login />;

  // Super admin viendo una producción concreta → panel normal de admin
  if (currentUser.role === 'super_admin' && currentUser.productionId) return <AdminLayout />;

  // Super admin sin producción seleccionada → su panel propio
  if (currentUser.role === 'super_admin') {
    return (
      <SuperAdminProvider>
        <SuperAdminLayout />
      </SuperAdminProvider>
    );
  }

  if (currentUser.role === 'admin') return <AdminLayout />;
  return <EmployeeLayout />;
}
