import { useApp } from './context/AppContext';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import EmployeeLayout from './pages/employee/EmployeeLayout';
import ExpressClock from './pages/ExpressClock';

// Detectar ruta /fichar/:token sin react-router
const path = window.location.pathname;
const expressMatch = path.match(/^\/fichar\/([0-9a-f-]{36})$/i);

export default function App() {
  const { currentUser } = useApp();

  if (expressMatch) return <ExpressClock token={expressMatch[1]} />;
  if (!currentUser) return <Login />;
  if (currentUser.role === 'admin') return <AdminLayout />;
  return <EmployeeLayout />;
}
