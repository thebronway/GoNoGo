import axios from 'axios';

// 1. Get or Create Client ID
const getClientId = () => {
  let id = localStorage.getItem("gonogo_client_id");
  if (!id) {
    id = crypto.randomUUID(); 
    localStorage.setItem("gonogo_client_id", id);
  }
  return id;
};

// 2. Get Admin Key (if logged in)
const getAdminKey = () => localStorage.getItem("gonogo_admin_key") || "";

// 3. Create Axios Instance
const apiClient = axios.create({
  baseURL: '/', // Relative path (proxied by Nginx/Vite)
  timeout: 60000,
});

// 4. Request Interceptor (Inject Headers)
apiClient.interceptors.request.use((config) => {
  config.headers['X-Client-ID'] = getClientId();
  
  const adminKey = getAdminKey();
  if (adminKey) {
    config.headers['X-Admin-Key'] = adminKey;
  }
  
  return config;
}, (error) => Promise.reject(error));

// 5. Response Interceptor (Optional: Global Error Handling)
apiClient.interceptors.response.use(
  (response) => response.data, // Return data directly
  (error) => {
    // Standardize error message
    const msg = error.response?.data?.detail || error.message || "Network Error";
    return Promise.reject(new Error(msg));
  }
);

export default apiClient;