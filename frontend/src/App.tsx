import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { SystemPage } from './pages/SystemPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/system" element={<SystemPage />} />
      </Routes>
    </Layout>
  );
}
