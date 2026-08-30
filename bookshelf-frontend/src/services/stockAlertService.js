import api from '../utils/api.js';

export async function subscribeStockAlert(bookId) {
  return (await api.post('/stock-alerts', { bookId })).data;
}

export async function unsubscribeStockAlert(bookId) {
  return (await api.delete(`/stock-alerts/${encodeURIComponent(bookId)}`)).data;
}

export async function checkStockAlert(bookId) {
  return (await api.get(`/stock-alerts/${encodeURIComponent(bookId)}/status`)).data;
}

export default { subscribeStockAlert, unsubscribeStockAlert, checkStockAlert };
