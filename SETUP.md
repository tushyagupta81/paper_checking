# Integration Setup Instructions

## Backend Setup

1. **Install Dependencies**
```bash
cd backend
pip install -r requirements.txt
# or if using uv
uv sync
```

2. **Configure Environment Variables**
- Copy the `.env` template
- Update database credentials
- Set a strong SECRET_KEY for JWT

3. **Run Database Migrations**
```bash
alembic upgrade head
```

4. **Start Backend Server**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

## Frontend Setup

1. **Install Dependencies**
```bash
cd frontend
npm install
```

2. **Create API Service File**
- Create `src/services/api.js` with the provided code
- This handles all API communication

3. **Update Component Imports**
```javascript
// In components that need API access
import api from '../services/api';
```

4. **Start Frontend Development Server**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Project Structure

```
project/
├── backend/
│   ├── alembic/
│   ├── api/
│   │   ├── images.py
│   │   ├── question.py
│   │   └── users.py
│   ├── main.py (updated with CORS)
│   ├── .env
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── Components/
    │   │   ├── LoginPage.jsx (updated)
    │   │   ├── EvaluationPage.jsx (updated)
    │   │   ├── App.jsx (updated)
    │   │   └── ...
    │   ├── services/
    │   │   └── api.js (new)
    │   └── main.jsx
    ├── .env
    └── package.json
```

## API Endpoints Overview

### Authentication
- `POST /users/login` - User login
- `POST /users/signup` - User registration

### Workbooks
- `POST /users/workbook/assign` - Assign workbook to student
- `GET /users/workbooks` - Get all workbooks

### Questions
- `POST /question/create` - Create new question
- `GET /question/{paper_id}` - Get questions for a paper
- `POST /question/evaluate` - Submit evaluation

### Images
- `POST /images/upload` - Upload answer sheet image
- `GET /images/{workbook_id}/{question_no}` - Get images for a question
- `GET /images/view/{image_path}` - View specific image

## Testing the Integration

1. **Start Both Servers**
   - Backend on port 8000
   - Frontend on port 5173

2. **Create Test User**
```bash
# Use populate_data.py or create via API
python populate_data.py
```

3. **Login Flow**
   - Open `http://localhost:5173`
   - Login with user ID and password
   - Check browser console for API calls

4. **Check CORS**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Look for successful API calls with status 200

## Common Issues & Solutions

### CORS Errors
- Ensure backend has CORS middleware configured
- Check that frontend URL is in `allow_origins`
- Restart backend after changes

### 401 Unauthorized
- Token might be expired
- Check localStorage for valid token
- Re-login to get fresh token

### Image Upload Issues
- Check file size limits
- Verify upload directory exists
- Check file permissions

### Database Connection
- Verify DATABASE_URL in .env
- Check database server is running
- Run migrations: `alembic upgrade head`

## Environment Variables

### Backend (.env)
```
DATABASE_URL=mysql+pymysql://user:pass@localhost/dbname
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8000
```

## Development Tips

1. **Hot Reload**: Both servers support hot reload
2. **API Testing**: Use tools like Postman or Thunder Client
3. **Browser DevTools**: Monitor network requests and responses
4. **Console Logs**: Check for errors in browser and terminal

## Production Deployment

1. **Backend**
   - Set DEBUG=False
   - Use production database
   - Configure proper CORS origins
   - Use environment-specific secrets

2. **Frontend**
   - Build: `npm run build`
   - Update API_BASE_URL to production URL
   - Serve build folder with Nginx/Apache

## Next Steps

1. Implement proper error handling
2. Add loading states for all API calls
3. Implement refresh token mechanism
4. Add request/response interceptors
5. Implement proper role-based access control
6. Add data validation on both ends