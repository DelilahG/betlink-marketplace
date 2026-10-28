import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth';
import { Login, Register } from './pages/Auth';

const user = (role: string) => ({ id: 'u1', email: 'x@example.com', full_name: 'Test User', phone: null, role, verification_status: 'unverified', created_at: '2026-01-01' });

/** /auth/me says "logged out"; the login/register call returns `loggedIn`. */
function mockApi(loggedIn: object) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    new Response(JSON.stringify({ user: String(input).endsWith('/auth/me') ? null : loggedIn }), { status: 200 }),
  );
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<p>HOME PAGE</p>} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<p>ADMIN PAGE</p>} />
          <Route path="/dashboard" element={<p>DASHBOARD PAGE</p>} />
          <Route path="/dashboard/new" element={<p>NEW LISTING PAGE</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function submitLogin() {
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'x@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'whatever-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

// Regression: with React Router 7, navigate() runs as a transition and the "already logged in" guard
// used to win the race, sending every role to the home page after logging in.
describe('post-login redirects', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['admin', 'ADMIN PAGE'],
    ['owner', 'DASHBOARD PAGE'],
    ['agent', 'DASHBOARD PAGE'],
    ['user', 'HOME PAGE'],
  ])('sends a %s to the right page', async (role, page) => {
    mockApi(user(role));
    renderAt('/login');
    await submitLogin();
    expect(await screen.findByText(page)).toBeInTheDocument();
  });

  it('honours a safe ?next= path', async () => {
    mockApi(user('admin'));
    renderAt('/login?next=%2Fdashboard');
    await submitLogin();
    expect(await screen.findByText('DASHBOARD PAGE')).toBeInTheDocument();
  });

  it('sends a newly registered owner to create a listing', async () => {
    mockApi(user('owner'));
    renderAt('/register?role=owner');
    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Selam T' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: 'long-enough-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('NEW LISTING PAGE')).toBeInTheDocument();
  });
});
