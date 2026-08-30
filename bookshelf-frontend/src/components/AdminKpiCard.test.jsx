import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminKpiCard from './AdminKpiCard.jsx';

/**
 * Unit tests for the AdminKpiCard component.
 */

describe('AdminKpiCard', () => {
  it('renders the label and value', () => {
    render(<AdminKpiCard icon="💰" label="Revenue" value="₹12,450" />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('₹12,450')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<AdminKpiCard icon="📦" label="Orders" value="391" />);
    expect(screen.getByText('📦')).toBeInTheDocument();
  });

  it('shows an upward trend indicator', () => {
    render(<AdminKpiCard icon="💰" label="Revenue" value="₹1,000" trend={12} />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });

  it('shows a downward trend indicator', () => {
    render(<AdminKpiCard icon="📦" label="Orders" value="50" trend={-5} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
    expect(screen.getByText(/5%/)).toBeInTheDocument();
  });

  it('hides trend when trend is 0', () => {
    const { container } = render(
      <AdminKpiCard icon="📚" label="Books" value="862" trend={0} />
    );
    expect(container.querySelector('.admin-kpi__trend')).not.toBeInTheDocument();
  });

  it('hides trend when trend is null', () => {
    const { container } = render(
      <AdminKpiCard icon="📚" label="Books" value="862" trend={null} />
    );
    expect(container.querySelector('.admin-kpi__trend')).not.toBeInTheDocument();
  });

  it('shows skeleton when loading', () => {
    const { container } = render(
      <AdminKpiCard icon="💰" label="Revenue" loading={true} />
    );
    expect(container.querySelector('.admin-kpi--loading')).toBeInTheDocument();
    expect(container.querySelector('.admin-kpi__skeleton')).toBeInTheDocument();
  });
});
