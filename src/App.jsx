import { useApp } from './context/AppContext';
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import EmployeeLayout from './pages/employee/EmployeeLayout';

export default function App() {
  const { currentUser } = useApp();

  if (!currentUser) return <Login />;
  if (currentUser.role === 'admin') return <AdminLayout />;
  return <EmployeeLayout />;
}
