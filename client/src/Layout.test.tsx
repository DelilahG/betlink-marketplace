import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth';
import { Layout } from './components/Layout';

describe('Layout', () => {
  afterEach(() => vi.restoreAllMocks());

  // Newer Chrome returns a Promise from scrollTo; an effect must not hand that to React as its cleanup
  it('renders and unmounts when window.scrollTo returns a Promise', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation((() => Promise.resolve()) as never);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: null }), { status: 200 }));
    const errors = vi.spyOn(console, 'error');
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes><Route element={<Layout />}><Route index element={<p>home content</p>} /></Route></Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('home content')).toBeInTheDocument();
    expect(() => unmount()).not.toThrow();
    expect(errors).not.toHaveBeenCalledWith(expect.stringContaining('useEffect must not return anything'), expect.anything());
  });
});
