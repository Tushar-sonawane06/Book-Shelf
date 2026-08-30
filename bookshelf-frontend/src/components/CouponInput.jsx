import { useState } from 'react';
import { validateCoupon } from '../services/couponService.js';
import { formatMoney } from '../utils/currency.js';
import './CouponInput.css';

/**
 * CouponInput — a compact input that validates a coupon code against
 * the backend and reports the discount back to the parent.
 *
 * Props:
 *   subtotal   the current cart subtotal (for min-order checks)
 *   currency   the currency the shop is pricing in, once known
 *   onApply    callback({ code, discount, discountType }) when valid
 *   onRemove   callback() when the user clears an applied coupon
 *   disabled   disable the input (e.g. while payment is processing)
 *
 * What this component reports is a *preview*. The saving in the badge is what
 * the server says the code is worth against the cart the browser knows about;
 * the amount actually taken off is recomputed server-side when the payment
 * intent is created, and rendered by the checkout summary from that response.
 * The two agree, but only one of them is binding, and it is not this one.
 * See #418.
 */
export default function CouponInput({
  subtotal = 0,
  currency,
  onApply,
  onRemove,
  disabled = false,
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const result = await validateCoupon(trimmed, subtotal);
      setApplied(result);
      setError('');
      onApply?.(result);
    } catch (err) {
      setApplied(null);
      setError(err.message || 'Invalid coupon');
      onRemove?.();
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    setApplied(null);
    setError('');
    onRemove?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (applied) return;
      handleApply();
    }
  };

  if (applied) {
    return (
      <div className="coupon-input coupon-input--applied">
        <span className="coupon-input__badge">
          🏷️ {applied.code} — {applied.discountType === 'percentage'
            ? `${applied.discountValue}% off`
            : `${formatMoney(applied.discountValue, { currency: applied.currency ?? currency })} off`}
          {applied.discount > 0 && (
            <span className="coupon-input__savings">
              {' '}(−{formatMoney(applied.discount, { currency: applied.currency ?? currency })})
            </span>
          )}
        </span>
        <button
          type="button"
          className="coupon-input__remove"
          onClick={handleRemove}
          disabled={disabled}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="coupon-input">
      <input
        className={`coupon-input__field ${error ? 'coupon-input__field--error' : ''}`}
        placeholder="Have a coupon code?"
        value={code}
        onChange={(e) => { setCode(e.target.value); setError(''); }}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        maxLength={30}
      />
      <button
        type="button"
        className="coupon-input__apply"
        onClick={handleApply}
        disabled={disabled || loading || !code.trim()}
      >
        {loading ? 'Checking…' : 'Apply'}
      </button>
      {error && <p className="coupon-input__error">{error}</p>}
    </div>
  );
}
