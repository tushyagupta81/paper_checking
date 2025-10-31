// src/services/api.js
const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token') || null;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      ...options.headers,
    };

    if (this.token && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Don't set Content-Type for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async login(id, password, mac_addr = "12:12:12:12:12:12") {
    const data = await this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ id, password, mac_addr }),
      skipAuth: true,
    });
    
  if (data.token && data.token.access_token) { 
    this.setToken(data.token.access_token);
  }
    
    return data;
  }

  async signup(password, type = "student", mac_addr = "12:12:12:12:12:12") {
    return this.request('/users/signup', {
      method: 'POST',
      body: JSON.stringify({ password, mac_addr, type }),
      skipAuth: true,
    });
  }

  // Workbook endpoints
  async assignWorkbook(student_id, workbook_id, paper_id, mac_addr = "12:12:12:12:12:12") {
    return this.request('/users/workbook/assign', {
      method: 'POST',
      body: JSON.stringify({ student_id, mac_addr, workbook_id, paper_id }),
    });
  }

  async getWorkbooks() {
    return this.request('/users/workbooks', {
      method: 'GET',
    });
  }

  // Question endpoints
  async createQuestion(paper_id, question_no, max_marks, file, mac_addr = "12:12:12:12:12:12") {
    const formData = new FormData();
    formData.append('paper_id', paper_id);
    formData.append('question_no', question_no);
    formData.append('max_marks', max_marks);
    formData.append('mac_addr', mac_addr);
    formData.append('file', file);

    return this.request('/question/create', {
      method: 'POST',
      body: formData,
    });
  }

  async getQuestions(paper_id) {
    return this.request(`/question/${paper_id}`, {
      method: 'GET',
    });
  }

  async evaluateQuestion(workbook_id, question_no, marks, comment = "", mac_addr = "12:12:12:12:12:12") {
    return this.request('/question/evaluate', {
      method: 'POST',
      body: JSON.stringify({ workbook_id, question_no, marks, comment, mac_addr }),
    });
  }

  // Image endpoints
  async uploadImage(workbook_id, question_no, page_no, file, mac_addr = "12:12:12:12:12:12") {
    const formData = new FormData();
    formData.append('workbook_id', workbook_id);
    formData.append('question_no', question_no);
    formData.append('page_no', page_no);
    formData.append('mac_addr', mac_addr);
    formData.append('file', file);

    return this.request('/images/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getImages(workbook_id, question_no) {
    return this.request(`/images/${workbook_id}/${question_no}`, {
      method: 'POST',
    });
  }

  getImageUrl(image_path) {
    return `${this.baseURL}/images/view/${encodeURIComponent(image_path)}`;
  }
}

export default new ApiService();