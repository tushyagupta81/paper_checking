
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
        const headers = { ...options.headers };

        if (this.token && !options.skipAuth) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, { ...options, headers });
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

    // ─── Auth ────────────────────────────────────────────────
    async login(id, password, mac_addr = "12:12:12:12:12:12") {
        const data = await this.request('/users/login', {
            method: 'POST',
            body: JSON.stringify({ id, password, mac_addr }),
            skipAuth: true,
        });
        if (data.token?.access_token) this.setToken(data.token.access_token);
        return data;
    }

    async signup(password, type = "student", mac_addr = "12:12:12:12:12:12") {
        return this.request('/users/signup', {
            method: 'POST',
            body: JSON.stringify({ password, mac_addr, type }),
            skipAuth: true,
        });
    }

    // ─── Phase 1: Create Question ────────────────────────────
    async createQuestion(paper_id, question_no, max_marks, pages, file, mac_addr = "12:12:12:12:12:12") {
        const formData = new FormData();
        formData.append('paper_id', paper_id);
        formData.append('question_no', question_no);
        formData.append('max_marks', max_marks);
        formData.append('pages', pages);
        formData.append('mac_addr', mac_addr);
        formData.append('file', file);
        return this.request('/question/create', { method: 'POST', body: formData });
    }

    // Returns { paper_ids: [...] } — every Paper ID that has at least one
    // question created. Powers Paper ID dropdowns so admins pick from
    // existing papers instead of retyping the same ID by hand each time.
    async getPapers() {
        return this.request('/question/papers', { method: 'GET' });
    }

    // Returns { paper_id, questions: [{ question_no, max_marks, pages }] }
    // Powers the Question Number dropdown for a chosen paper — once a
    // question is picked, its page count can auto-fill instead of being
    // re-typed from memory.
    async getQuestionsForPaper(paper_id) {
        return this.request(`/question/papers/${encodeURIComponent(paper_id)}/questions`, {
            method: 'GET',
        });
    }

    // ─── Phase 2: Assign Workbook to Student ────────────────
    async assignWorkbook(student_id, workbook_id, paper_id, mac_addr = "12:12:12:12:12:12") {
        return this.request('/users/student/assign', {
            method: 'POST',
            body: JSON.stringify({ student_id, workbook_id, paper_id, mac_addr }),
        });
    }

    // ─── Phase 3: Upload Scanned Images ─────────────────────
    async uploadQuestionImages(workbook_id, question_no, files, mac_addr = "12:12:12:12:12:12") {
        const formData = new FormData();
        formData.append('workbook_id', workbook_id);
        formData.append('question_no', question_no);
        formData.append('checked', 'false');
        formData.append('mac_addr', mac_addr);
        // CRITICAL: filename must be the page number — backend uses it as page_no
        files.forEach((file, index) => {
            formData.append('files', file, String(index + 1));
        });
        return this.request('/images/upload/question', { method: 'POST', body: formData });
    }

    // ─── Phase 4: Assign Examiner ────────────────────────────
    // Returns { examiners: [id, ...], examiner_load: { id: count } } — every
    // examiner account, plus how many questions each currently has. An
    // examiner can be assigned to multiple questions, so this deliberately
    // does NOT exclude anyone who already has an assignment.
    async getUnassignedExaminers(mac_addr = "12:12:12:12:12:12") {
        return this.request('/users/examiner/unassigned', {
            method: 'POST',
            body: JSON.stringify({ mac_addr }),
        });
    }

    async assignExaminer(examiner_id, paper_id, question_no, mac_addr = "12:12:12:12:12:12") {
        return this.request('/users/examiner/assign', {
            method: 'POST',
            body: JSON.stringify({ id: examiner_id, paper_id, question_no, mac_addr }),
        });
    }

    // Returns { data: {...legacy nested shape...}, assignments: [{paper_id, question_no, examiner_id}, ...] }
    // `assignments` is flat and pre-sorted newest-question-first — use this
    // one for display so the most recently created (and possibly still
    // unassigned) questions show up at the top of the list.
    async getAssignedQuestions(mac_addr = "12:12:12:12:12:12") {
        return this.request('/question/assigned', {
            method: 'POST',
            body: JSON.stringify({ mac_addr }),
        });
    }

    // ─── Phase 5: Dashboard Stats ────────────────────────────
    async getAllExaminerWorkbooks(mac_addr = "12:12:12:12:12:12") {
        return this.request('/question/examiners/all_workbooks', {
            method: 'POST',
            body: JSON.stringify({ mac_addr }),
        });
    }

    // ─── Examiner ────────────────────────────────────────────
    async getExaminerWorkbooks(mac_addr = "12:12:12:12:12:12") {
        return this.request('/question/examiner/get_workbooks', {
            method: 'POST',
            body: JSON.stringify({ mac_addr }),
        });
    }

    async getImages(workbook_id, question_no, mac_addr = "12:12:12:12:12:12") {
        return this.request('/images/get', {
            method: 'POST',
            body: JSON.stringify({ workbook_id, question_no, mac_addr }),
        });
    }

    async evaluateQuestion(workbook_id, question_no, marks, comment = "", mac_addr = "12:12:12:12:12:12") {
        return this.request('/question/evaluate', {
            method: 'POST',
            body: JSON.stringify({ workbook_id, question_no, marks, comment, mac_addr }),
        });
    }

    // Returns { url } — a presigned URL to the question's own scanned image,
    // so the examiner can see the question text above the student's answer.
    async getQuestionImage(paper_id, question_no) {
        const params = new URLSearchParams({ paper_id, question_no });
        return this.request(`/question/image?${params.toString()}`, {
            method: 'GET',
        });
    }

    // Uploads the flattened (annotations baked in) version of each answer
    // page. blobs and pageNumbers must be the same length and in matching
    // order — blobs[i] is the checked image for pageNumbers[i].
    async uploadCheckedImages(workbook_id, question_no, blobs, pageNumbers, mac_addr = "12:12:12:12:12:12") {
        const formData = new FormData();
        formData.append('workbook_id', workbook_id);
        formData.append('question_no', question_no);
        formData.append('page_numbers', pageNumbers.join(','));
        formData.append('mac_addr', mac_addr);
        blobs.forEach((blob, index) => {
            formData.append('files', blob, `checked_page_${pageNumbers[index]}.png`);
        });
        return this.request('/images/upload/checked', { method: 'POST', body: formData });
    }

    // ─── Student: read-only results ──────────────────────────
    async getStudentResults() {
        return this.request('/users/student/results', {
            method: 'GET',
        });
    }
    // ─── Admin: all students' results (for Reports page) ────
    async getAllStudentResults() {
        return this.request('/users/admin/results', {
            method: 'GET',
        });
    }

    
}



export default new ApiService();