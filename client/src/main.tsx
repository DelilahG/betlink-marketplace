import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth';
import { Layout } from './components/Layout';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';
import { Login, Register } from './pages/Auth';
import { Browse } from './pages/Browse';
import { Dashboard } from './pages/Dashboard';
import { Home } from './pages/Home';
import { ListingEditor } from './pages/ListingEditor';
import { NotFound } from './pages/NotFound';
import { PropertyDetail } from './pages/PropertyDetail';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="rent" element={<Browse listingType="rent" />} />
            <Route path="buy" element={<Browse listingType="sale" />} />
            <Route path="properties/:id" element={<PropertyDetail />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="dashboard" element={<RequireAuth roles={['owner', 'agent', 'admin']}><Dashboard /></RequireAuth>} />
            <Route path="dashboard/new" element={<RequireAuth roles={['owner', 'agent', 'admin']}><ListingEditor /></RequireAuth>} />
            <Route path="dashboard/:id/edit" element={<RequireAuth roles={['owner', 'agent', 'admin']}><ListingEditor /></RequireAuth>} />
            <Route path="admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
