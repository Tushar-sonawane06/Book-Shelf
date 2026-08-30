import { useState } from 'react';
import './GuestCheckoutForm.css';

export default function GuestCheckoutForm({ onOrderComplete, onBack }) {
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    address: '',
    city: '',
    postalCode: '',
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Valid email is required.';
    }
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required.';
    if (!formData.address.trim()) newErrors.address = 'Address is required.';
    if (!formData.city.trim()) newErrors.city = 'City is required.';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Postal Code is required.';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Simulate successful order
    const mockOrderPayload = {
      customerType: 'guest',
      ...formData
    };
    
    console.log('Guest order submitted:', mockOrderPayload);
    onOrderComplete();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  return (
    <div className="guest-checkout">
      <h2 className="guest-checkout__title">Guest Checkout</h2>
      <p className="guest-checkout__subtitle">Please enter your shipping and contact information.</p>

      {/*
        A way back. The guest form was a one-way door: once the page switched
        to this view the only exits were the browser's back button — which
        leaves the route unchanged, so it goes to whatever preceded /checkout
        rather than to the address step — and the navbar.
      */}
      {onBack && (
        <button type="button" className="guest-checkout__back" onClick={onBack}>
          ← Back to checkout options
        </button>
      )}
      
      <form className="guest-checkout__form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            value={formData.email} 
            onChange={handleChange} 
            className={errors.email ? 'error' : ''}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input 
            type="text" 
            id="fullName" 
            name="fullName" 
            value={formData.fullName} 
            onChange={handleChange} 
            className={errors.fullName ? 'error' : ''}
          />
          {errors.fullName && <span className="error-text">{errors.fullName}</span>}
        </div>
        
        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input 
            type="text" 
            id="address" 
            name="address" 
            value={formData.address} 
            onChange={handleChange} 
            className={errors.address ? 'error' : ''}
          />
          {errors.address && <span className="error-text">{errors.address}</span>}
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input 
              type="text" 
              id="city" 
              name="city" 
              value={formData.city} 
              onChange={handleChange} 
              className={errors.city ? 'error' : ''}
            />
            {errors.city && <span className="error-text">{errors.city}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="postalCode">Postal Code</label>
            <input 
              type="text" 
              id="postalCode" 
              name="postalCode" 
              value={formData.postalCode} 
              onChange={handleChange} 
              className={errors.postalCode ? 'error' : ''}
            />
            {errors.postalCode && <span className="error-text">{errors.postalCode}</span>}
          </div>
        </div>
        
        <button type="submit" className="btn-submit">
          Place Order
        </button>
      </form>
    </div>
  );
}
