# 💸 Split-Pay / BillSplit Backend API

A powerful, feature-rich **Node.js, Express, and MongoDB** RESTful backend API designed for group expense splitting, receipt OCR scanning with **Tesseract.js**, AI structured data extraction powered by **Google Gemini 2.5 Flash**, and intelligent multi-user debt settlement calculations.

---

## ✨ Features

- 🔐 **User Authentication & Security**
  - Secure Sign Up & Login using **JWT (JSON Web Tokens)** and **bcryptjs** password hashing.
  - User profile management, password updates, and global balance tracking (`youOwe` / `youAreOwed`).

- 👥 **Group Management & Invitation System**
  - Create expense groups with multiple members.
  - Email-based invitation system with `pending`, `accepted`, and `rejected` statuses.

- 🧾 **OCR & AI Receipt Scanner**
  - **Multer** file uploads for receipt images (`JPEG`, `PNG`) and `PDF` files.
  - **Tesseract.js** Optical Character Recognition engine extracts raw text from physical receipt images.
  - **Google Gemini 2.5 Flash AI** parses raw OCR text into structured JSON line items (`name`, `price`, `quantity`, `totalAmount`).

- ⚖️ **Expense Splitting & Debt Settlement Engine**
  - **Multiple Split Modes**: Equal splits (`assignEqually`) and per-item / custom amount assignments (`assignMoney`).
  - **Single Payer (`paidBy`) Architecture**: Supports assigned payers and calculates individual net positions ($\text{Net} = \text{Paid} - \text{Assigned}$).
  - **Bill-Level Settlement Calculator (`splitExpense`)**: Computes debt netting and generates simplified settlement instructions.
  - **Group-Level Balance Summary (`getBalance`)**: Calculates simplified cross-bill debts across an entire group (Splitwise-style).
  - **Settlement Lifecycle**: `settleAssignments`, `markAssignmentPaid`, and safe bill deletion with automatic image cleanup from disk (`deleteBill`).

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **Node.js & Express.js** | Backend server framework (`v5.1.0`) |
| **MongoDB & Mongoose** | NoSQL database & ODM (`v8.17.1`) |
| **JWT & Bcryptjs** | Authentication & password encryption |
| **Tesseract.js** | Local Optical Character Recognition (OCR) engine |
| **Google Gemini API** | AI-driven receipt itemization (`gemini-2.5-flash`) |
| **Multer** | Local multipart file upload middleware |

---

## 📁 Repository Structure

```
BillSplit-Backend/
├── config/
│   └── db.js                 # MongoDB database connection setup
├── controllers/
│   ├── authController.js     # User registration, login, & profiles
│   ├── billController.js     # OCR, bill creation, splitting, & settlements
│   ├── groupController.js    # Group CRUD & group balance calculation
│   └── inviteController.js   # Group invitation system
├── middleware/
│   ├── auth.js               # JWT bearer token verification
│   └── upload.js             # Multer receipt upload handler
├── models/
│   ├── Group.js              # Group schema definition
│   ├── expense.js            # Expense, Item, & Assignment schemas
│   ├── invite.js             # Group invite schema definition
│   └── user.js               # User account & balance schema
├── routes/
│   ├── authRoutes.js         # Auth & Group API routes
│   ├── billRoutes.js         # Expense & Settlement API routes
│   └── inviteRoutes.js       # Invite API routes
├── utils/
│   ├── llmParser.js          # Google Gemini AI receipt parser
│   └── ocr.js                # Tesseract.js OCR text extractor
├── uploads/                  # Local storage for receipt images
├── index.js                  # Main Express application entry point
├── package.json              # Project metadata & dependencies
└── .env                      # Environment variables configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed:
- **Node.js** (v16+ recommended)
- **MongoDB** (Local instance or MongoDB Atlas URI)
- **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/))

### 2. Installation

Clone the repository and install project dependencies:

```bash
git clone https://github.com/kanhaiya-18/Split-Pay.git
cd BillSplit-Backend
npm install
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
PORT=4000
MONGODB_URI=mongodb_uri
JWT_SECRET=your_super_secret_jwt_key
GEMINI_API_KEY=your_google_gemini_api_key
```

### 4. Running the Server

Start the development server with **nodemon**:

```bash
npm run dev
```

Or run in production mode:

```bash
npm start
```

The server will start at `http://localhost:4000`.

---

## 🔗 API Endpoint Reference

All endpoints (except public `/signUp` and `/login`) require a Bearer token header: `Authorization: Bearer <JWT_TOKEN>`.

### 🔑 Authentication & Users (`/api/v1`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/signUp` | Register a new user |
| `POST` | `/api/v1/login` | Authenticate user & receive JWT |
| `GET` | `/api/v1/getUserDetails` | Get current user profile & balance |
| `PATCH` | `/api/v1/updateProfile` | Update user profile details |
| `PATCH` | `/api/v1/changePassword` | Change user password |

### 👥 Groups & Invites (`/api/v1`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/group/create` | Create a new expense group |
| `GET` | `/api/v1/group/get/:id` | Get details of a specific group |
| `GET` | `/api/v1/group/getAll` | List all groups the user belongs to |
| `GET` | `/api/v1/group/balance/:groupId` | **Get simplified group balances & settlements** |
| `DELETE` | `/api/v1/group/delete/:id` | Delete a group |
| `POST` | `/api/v1/group/invite` | Send a group invitation by email |
| `POST` | `/api/v1/group/invite/accept` | Accept a pending invitation |
| `POST` | `/api/v1/group/invite/reject` | Reject a pending invitation |
| `GET` | `/api/v1/group/invite/pending` | List pending invitations for current user |

### 💵 Bills & Expenses (`/api/v1/bills`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/bills/upload` | **Upload receipt image (Multer -> OCR -> Gemini AI)** |
| `POST` | `/api/v1/bills/manual` | Create a manual expense bill |
| `GET` | `/api/v1/bills/getAllBills?group=:id` | Fetch all bills for a specific group |
| `GET` | `/api/v1/bills/getBillDetails/:expenseId` | Get single bill details |
| `PATCH` | `/api/v1/bills/assign-Equally` | Split bill equally among selected users |
| `PATCH` | `/api/v1/bills/assign-money` | Custom per-item / money split assignment |
| `POST` | `/api/v1/bills/settleAssignment` | Settle assignments into user balance tallies |
| `GET` | `/api/v1/bills/split/:expenseId` | Compute bill debt netting & settlements |
| `POST` | `/api/v1/bills/markAsPaid` | Mark an assignment payment as settled |
| `DELETE` | `/api/v1/bills/deleteBill` | Delete a bill & clean up uploaded receipt image |

---

## 📜 License

This project is licensed under the [ISC License](LICENSE).
