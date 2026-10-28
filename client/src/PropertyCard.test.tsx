import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyCard as Card } from './api';
import { PropertyCard } from './components/PropertyCard';

const card: Card = {
  id: 'p1', title: 'Bright apartment near Bole Atlas', listing_type: 'rent', property_type: 'apartment', price_etb: 65000,
  rent_period: 'month', region: 'Addis Ababa', city: 'Addis Ababa', subcity: 'Bole', neighborhood: 'Atlas', bedrooms: 2,
  bathrooms: 2, area_sqm: 110, furnishing: 'furnished', status: 'published', verification_status: 'unverified', is_demo: true,
  available_from: null, created_at: '2026-10-01', published_at: '2026-10-01', cover_url: '/x.jpg', owner_name: 'Dawit',
  owner_role: 'agent', owner_verification: 'unverified', is_favorite: false,
};

describe('PropertyCard', () => {
  it('shows price per month, location, facts and an honest demo label without a verified badge', () => {
    render(<MemoryRouter><PropertyCard p={card} /></MemoryRouter>);
    expect(screen.getByText('ETB 65,000')).toBeInTheDocument();
    expect(screen.getByText('/ month')).toBeInTheDocument();
    expect(screen.getByText(/Atlas, Bole, Addis Ababa/)).toBeInTheDocument();
    expect(screen.getByText('110 m²')).toBeInTheDocument();
    expect(screen.getByText('Demo listing')).toBeInTheDocument();
    expect(screen.queryByText('Verified listing')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: card.title })).toHaveAttribute('href', '/properties/p1');
  });

  it('shows the verified badge only when verified, and toggles favourites', () => {
    const onToggle = vi.fn();
    render(<MemoryRouter><PropertyCard p={{ ...card, verification_status: 'verified' }} onToggleFavorite={onToggle} /></MemoryRouter>);
    expect(screen.getByText('Verified listing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Bright apartment/ }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });
});
