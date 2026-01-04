# Keyman Hotel Management System

Modern hotel management solution built with Next.js 14 App Router and Supabase.

## 🚀 **Architecture**

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## 📋 **Features**

### **Admin Dashboard**
- Vehicle usage reports
- Revenue analytics
- Staff performance metrics
- Room performance tracking
- Repeat customer analysis
- Daily/monthly summaries

### **Core Operations**
- Booking management
- Payment processing
- Customer management
- Role-based access control

### **Security**
- JWT-based authentication
- Role hierarchy (Customer → Staff → Manager → Admin)
- Server-side validation
- Environment-based secrets

## 🛠️ **Installation**

1. **Clone the repository**
```bash
git clone <repository-url>
cd keyman-hotel
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

4. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🗄️ **Database Setup**

1. **Create Supabase project**
2. **Run the provided schema** (`supabase_schema.sql`)
3. **Set up authentication** with email/password
4. **Configure environment variables**

## 🏗️ **Project Structure**

```
keyman-hotel/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (backend)
│   │   ├── bookings/
│   │   ├── payments/
│   │   └── reports/
│   ├── auth/              # Authentication pages
│   ├── admin/             # Admin dashboard
│   └── page.tsx           # Home page
├── lib/                   # Utilities
│   ├── supabase/          # Supabase clients
│   └── auth.ts            # Authentication helpers
├── components/            # Reusable components
└── public/                # Static assets
```

## 🔐 **Roles & Permissions**

- **CUSTOMER**: View own bookings
- **STAFF**: Manage bookings + payments
- **MANAGER**: Full operational access
- **ADMIN**: System administration

## 📊 **API Routes**

### **Authentication**
- `POST /api/auth/login` - User authentication

### **Bookings**
- `GET /api/bookings` - List bookings (with optional filters)
- `POST /api/bookings` - Create new booking

### **Payments**
- `GET /api/payments` - List payments (with optional filters)
- `POST /api/payments` - Record new payment

### **Reports**
- `GET /api/reports/daily` - Daily revenue summary
- `GET /api/reports/vehicle-usage` - Vehicle usage statistics
- `GET /api/reports/room-performance` - Room performance metrics
- `GET /api/reports/staff-performance` - Staff performance metrics
- `GET /api/reports/repeat-customers` - Repeat customers analysis

### **Audit Log**
- `GET /api/audit` - Retrieve audit trail (Admin only)
- `POST /api/audit` - Create audit entry (System use)

## 🚀 **Deployment**

### **Vercel (Recommended)**
1. Connect repository to Vercel
2. Add environment variables
3. Deploy automatically

### **Environment Variables Required**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 🧪 **Development**

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm run start

# Lint
npm run lint
```

## 📝 **Migration Notes**

This project was successfully migrated from Django + Next.js to pure Next.js + Supabase:

- ✅ All business logic preserved
- ✅ Reports calculations identical
- ✅ Role-based security maintained
- ✅ No schema changes required
- ✅ Production-ready on Vercel

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📄 **License**

This project is proprietary software for Keyman Hotel operations.
