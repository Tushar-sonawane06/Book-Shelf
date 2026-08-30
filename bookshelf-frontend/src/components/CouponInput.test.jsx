import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CouponInput from './CouponInput.jsx';

vi.mock('../services/couponService.js', () => ({
  validateCoupon: vi.fn(),
}));

import { validateCoupon } from '../services/couponService.js';

describe('CouponInput', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the input and apply button', () => {
    render(<CouponInput subtotal={100} />);
    expect(screen.getByPlaceholderText(/coupon/i)).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
  });

  it('calls onApply when a valid coupon is submitted', async () => {
    const onApply = vi.fn();
    validateCoupon.mockResolvedValue({ valid: true, code: 'SAVE10', discount: 10, discountType: 'fixed', discountValue: 10 });
    render(<CouponInput subtotal={100} onApply={onApply} />);

    fireEvent.change(screen.getByPlaceholderText(/coupon/i), { target: { value: 'SAVE10' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(await screen.findByText(/SAVE10/)).toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ code: 'SAVE10' }));
  });

  it('shows error for invalid coupon', async () => {
    validateCoupon.mockRejectedValue({ message: 'Invalid coupon code', status: 404 });
    render(<CouponInput subtotal={100} />);

    fireEvent.change(screen.getByPlaceholderText(/coupon/i), { target: { value: 'BAD' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(await screen.findByText('Invalid coupon code')).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked after apply', async () => {
    const onRemove = vi.fn();
    validateCoupon.mockResolvedValue({ valid: true, code: 'X', discount: 5, discountType: 'fixed', discountValue: 5 });
    render(<CouponInput subtotal={100} onRemove={onRemove} />);

    fireEvent.change(screen.getByPlaceholderText(/coupon/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(await screen.findByText('✕'));

    expect(onRemove).toHaveBeenCalled();
  });

  it('disables input when disabled prop is true', () => {
    render(<CouponInput subtotal={100} disabled />);
    expect(screen.getByPlaceholderText(/coupon/i)).toBeDisabled();
  });
});
