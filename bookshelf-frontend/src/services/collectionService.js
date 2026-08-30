import api from '../utils/api.js';

export async function getCollections({ signal } = {}) {
  return (await api.get('/collections', { signal })).data;
}

export async function getCollection(id, { signal } = {}) {
  return (await api.get(`/collections/${id}`, { signal })).data;
}

export async function createCollection({ name, description, isPublic }) {
  return (await api.post('/collections', { name, description, isPublic })).data;
}

export async function updateCollection(id, updates) {
  return (await api.put(`/collections/${id}`, updates)).data;
}

export async function deleteCollection(id) {
  return (await api.delete(`/collections/${id}`)).data;
}

export async function addBookToCollection(collectionId, bookId) {
  return (await api.post(`/collections/${collectionId}/books`, { bookId })).data;
}

export async function removeBookFromCollection(collectionId, bookId) {
  return (await api.delete(`/collections/${collectionId}/books/${encodeURIComponent(bookId)}`)).data;
}

export default {
  getCollections, getCollection, createCollection, updateCollection,
  deleteCollection, addBookToCollection, removeBookFromCollection,
};
