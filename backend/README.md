# Car Rental System — Backend API  
## Group 11 | APT4080A

### Quick Setup
```bash
cd backend
npm install
npm start      # http://localhost:5000
npm test       # 53 tests
```

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@carrental.com | admin123 |
| Customer | john@example.com | customer123 |

### Structure
```
backend/
├── server.js          # Express entry point
├── database.js        # SQLite + seed data
├── .env               # Config
├── middleware/auth.js # JWT + RBAC
├── routes/auth.js     # Register/Login
├── routes/cars.js     # Fleet CRUD
├── routes/bookings.js # Booking lifecycle
├── routes/payments.js # M-Pesa + receipts
└── tests/api.test.js  # 53 Jest tests
```
