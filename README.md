# 🌌 Online Quiz & Examination Portal (Express + React Three Fiber + Prisma)

Welcome to the **Online Quiz & Examination Portal**—a state-of-the-art, full-stack web application designed for academic evaluation, mock testing, and proctored examination workflows. 

This platform marries a powerful, secure backend grading engine with a gorgeous, high-fidelity glassmorphic frontend utilizing **3D WebGL interactive particle constellations** to provide a premium, modern user experience.

---

## 🚀 Distinctive Technical Highlights

### 1. 🛡️ Proctoring Anti-Cheat Engine (Multi-Strike System)
Built with academic integrity in mind, the platform implements a client-side tab visibility listener and browser blur tracker:
* If a student leaves the exam screen, opens developer tools, switches tabs, or minimizes the browser, the interface locks and fires a warning alert.
* Each transgression registers a **Cheating Strike** synced with the backend in real time.
* Upon triggering **3 strikes**, the backend proctoring mechanism immediately fires a **Force Submit**, grading all completed questions up to that point, locking the student out of the exam, and flagging the attempt in the Admin control center.

### 2. ⏱️ Resilient Stateful Exam Timer (Anti-Tampering)
Standard client-side timers are easily manipulated by modifying browser variables or pausing execution. This portal resolves this with a resilient backend-driven synchronization model:
* When an exam begins, a persistent timestamp is generated on the server (`startTime` + `duration`).
* On page refreshes, crashes, or network disconnects, the frontend instantly synchronizes with the backend.
* The backend computes the remaining seconds dynamically: `Remaining = (startTime + duration) - now`.
* If the remaining time hits `0` or goes negative, the server auto-submits and grades the attempt, preventing client-side timer manipulation.

### 3. 📊 Custom Composed Dashboard Chart & Student Audits
* **Dual-Axis Composed Analytics:** Evaluates both **Pass Rates (%)** (on the left Y-axis with a beautiful vertical purple gradient bar) and **Average Scores (Points)** (on the right Y-axis with an indigo glowing trend line).
* **Bespoke Glassmorphic Tooltip:** Renders detailed insights, including exact evaluation counts, pass percentages, and average scores formatted against the quiz's maximum marks.
* **Student Answer Audit Modal:** Admins can inspect a completed student attempt answer-by-answer. A frosted-glass overlay displays the exact option the student selected (marked in red if wrong, green if right), the correct key, points earned/lost, and proctoring strikes.

### 4. 📜 Dynamic PDF Certificate Generator
* Compiles customized **A4 Landscape certificates** on the fly using vector geometry and the `pdfkit` library.
* Automatically unlocks and generates downloadable PDFs for students who achieve a passing grade of **$\ge 60\%$** on any assessment.
* Employs authenticated download tokens mapped inside the auth middleware to allow direct browser opening securely.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | **React 19 (Vite)** | Reactive single-page client interface |
| **3D Rendering** | **React Three Fiber (R3F) & Drei** | 3D WebGL particle constellation background with mouse parallax |
| **Styling** | **Vanilla CSS & Lucide Icons** | Custom glassmorphism, Outfit/Jakarta typography, and crisp iconography |
| **Backend** | **Node.js (Express)** | RESTful API, business logic, proctoring, and grading loops |
| **Database** | **SQLite via Prisma ORM** | Relational data persistence, migration control, and client-builder |
| **Security** | **JSON Web Tokens (JWT) & Bcrypt** | Secure password hashing and role-based access control (RBAC) |
| **PDF Processing** | **Pdfkit** | On-the-fly vector compilation of PDF achievements |

---

## 💾 Database Relational Schema

Below is the structured representation of the SQLite schema managed via **Prisma ORM**. The platform supports full cascading deletes—deleting a quiz automatically purges its question bank and student attempts clean.

```mermaid
erDiagram
    User ||--o{ Attempt : "attempts"
    Quiz ||--o{ Question : "questions"
    Quiz ||--o{ Attempt : "attempts"
    Question ||--o{ AttemptAnswer : "answersGiven"
    Attempt ||--o{ AttemptAnswer : "answers"

    User {
        Int id PK
        String name
        String email UK
        String password
        String role "STUDENT | ADMIN"
        DateTime createdAt
    }

    Quiz {
        Int id PK
        String title
        String description
        Int duration "in minutes"
        Int totalMarks
        Float negativeMarks
        Boolean isPublished
        DateTime createdAt
    }

    Question {
        Int id PK
        Int quizId FK
        String questionText
        String optionA
        String optionB
        String optionC
        String optionD
        String correctOption "A | B | C | D"
        Int marks
    }

    Attempt {
        Int id PK
        Int userId FK
        Int quizId FK
        Float score
        Int cheatingStrikes
        String status "IN_PROGRESS | COMPLETED | FORCE_SUBMITTED"
        DateTime startTime
        DateTime endTime
    }

    AttemptAnswer {
        Int id PK
        Int attemptId FK
        Int questionId FK
        String selectedOption "A | B | C | D | null"
        Boolean isCorrect
    }
```

---

## 🚀 Getting Started (Local Run Guide)

### Prerequisites
* Ensure you have [Node.js (v18 or higher)](https://nodejs.org) installed on your system.

---

### Step 1: Clone the Repository & Configure Workspace
Navigate to your target directory and clone the project:
```bash
git clone https://github.com/Ojaswi-Gupta/task_managrer_cog.git
cd task_managrer_cog
```

*(If you are running the project directly from your local folder, simply open terminal windows pointing to the `/backend` and `/frontend` directories).*

---

### Step 2: Initialize the Backend
1. Open a terminal, navigate to the `/backend` folder, and install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. The database file `dev.db` is already initialized. However, if you ever want to reset it or run migrations from scratch:
   ```bash
   npx prisma db push
   ```
3. Run the database seed script to populate mock users, assessments, questions, and a pre-loaded student attempt:
   ```bash
   npm run seed
   ```
4. Boot up the backend API server (runs on Port `5001` via `nodemon` hot reloading):
   ```bash
   npm run dev
   ```
   *Console output: `🚀 Server running on http://localhost:5001`*

---

### Step 3: Initialize the Frontend
1. Open a **new terminal tab/window**, navigate to the `/frontend` folder, and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite bundler development server:
   ```bash
   npm run dev
   ```
3. Open the printed URL (typically `http://localhost:5173`) in your browser to experience the application!

---

## 💡 Quick Demo Credentials

For seamless evaluation, use the following pre-loaded accounts in the Quick Login box:

* **Administrator Profile** (View stats, manage question banks, review student answer sheets):
  * **Email:** `admin@quizportal.com`
  * **Password:** `admin123`
* **Student Profile** (Attempt quizzes, trigger proctoring strikes, download certificates):
  * **Email:** `student@quizportal.com`
  * **Password:** `student123`

---

## 📂 Project Architecture

```text
java-full-stack/ (Workspace Root)
 ├── backend/
 │    ├── prisma/
 │    │    ├── schema.prisma   # SQLite Database Schema
 │    │    └── seed.js         # Db Seed Script (Quizzes, Questions, Attempts)
 │    ├── src/
 │    │    ├── controllers/
 │    │    │    ├── authController.js        # User auth, registration & JWT signing
 │    │    │    ├── quizController.js        # MCQ Question Bank & Quiz CRUD
 │    │    │    ├── attemptController.js     # Server timer validation & grading loops
 │    │    │    ├── analyticsController.js   # Leaderboards & composite dashboard queries
 │    │    │    └── certificateController.js # pdfkit landscape A4 rendering
 │    │    ├── middleware/
 │    │    │    └── authMiddleware.js        # JWT header & direct query fallback verification
 │    │    ├── routes/
 │    │    │    ├── authRoutes.js
 │    │    │    ├── quizRoutes.js
 │    │    │    ├── attemptRoutes.js
 │    │    │    ├── analyticsRoutes.js
 │    │    │    └── certificateRoutes.js
 │    │    ├── prisma.js                      # Shared client pool connector
 │    │    └── index.js                       # Sub-route registry
 │    ├── index.js                           # Express gateway entrypoint
 │    ├── .env                               # Port & secrets configurations
 │    └── package.json
 └── frontend/
      ├── src/
      │    ├── components/
      │    │    └── ThreeCanvas.jsx   # mouse-parallax 3D canvas system
      │    ├── context/
      │    │    └── AuthContext.jsx   # JWT sessions & Axios request interceptors
      │    ├── pages/
      │    │    ├── Login.jsx         # Access portal
      │    │    ├── StudentDashboard.jsx # Available boards, rankings & achievements
      │    │    ├── ExamPage.jsx      # Proctored full-screen console
      │    │    └── AdminDashboard.jsx # Statistics composed chart & audits modal
      │    ├── App.jsx                # Router config & WebGL layer overlay
      │    ├── App.css
      │    └── index.css              # Custom font tokens, glassmorphism UI rules
      └── package.json
```
