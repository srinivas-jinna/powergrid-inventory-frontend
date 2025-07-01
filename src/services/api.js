import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const productAPI = {
  getAll: () => api.get('/products'),
  create: (product) => api.post('/products', product),
  delete: (id) => api.delete(`/products/${id}`),
  updateQuantity: (id, quantity) => api.patch(`/products/${id}/quantity`, { quantity })
};

export const gatePassAPI = {
  getAll: () => api.get('/gatepasses'),
  create: (gatePass) => api.post('/gatepasses', gatePass)
};

export default api;