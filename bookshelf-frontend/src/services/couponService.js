import api from '../utils/api.js';

export async function validateCoupon(code, subtotal) {
  const response = await api.post('/coupons/validate', { code, subtotal });
  return response.data;
}

export async function listCoupons() {
  return (await api.get('/coupons')).data;
}

export async function createCoupon(data) {
  return (await api.post('/coupons', data)).data;
}

export async function updateCoupon(id, data) {
  return (await api.put(`/coupons/${id}`, data)).data;
}

export async function deleteCoupon(id) {
  return (await api.delete(`/coupons/${id}`)).data;
}

export default { validateCoupon, listCoupons, createCoupon, updateCoupon, deleteCoupon };
