# 📚 BookShelf — Open Source Book E-Commerce Platform

## 1. Overview

**BookShelf** is an open-source book-selling e-commerce web application built to give contributors of all skill levels a real-world, full-stack project to learn and contribute to. It combines a **React frontend** with a **Node.js backend**, using JSON-based data storage (no database) to keep setup simple and contribution-friendly.

The goal is to mirror the proven "many small, isolated contributions" model — every genre page, component, or API feature can be built independently, making it easy to onboard first-time open-source contributors while still supporting complex feature work for experienced ones.

---

## 2. Problem Statement

Most beginner-friendly open-source projects are either:
- Too simple (to-do apps, calculators) — low learning value, or
- Too complex (require DB setup, auth systems, cloud config) — high entry barrier

BookShelf sits in between: a realistic e-commerce app with real features (cart, search, filters, checkout flow) but **no database setup required**, so any contributor can clone, run, and contribute within minutes.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, CSS/Tailwind |
| Backend | Node.js, Express.js |
| Data Storage | JSON files (`/data` folder) — no DB |
| State Management | React Context / useState (cart, wishlist) |
| Optional Integration | Open Library API / Google Books API (for real book data & covers) |
| Version Control | Git + GitHub |

---

## 4. Core Features

### Frontend (React)
- Home page with featured/trending books
- Genre/category pages (Fiction, Sci-Fi, Self-Help, Manga, etc.)
- Book detail page (description, author, price, rating, reviews)
- Search bar with live filtering
- Sort/filter by price, rating, genre, publish year
- Cart drawer (add/remove/update quantity)
- Wishlist feature
- Mock checkout flow (order summary, no real payment)
- Responsive design + dark mode toggle
- Loading skeletons / empty states

### Backend (Node + Express)
- REST API to serve book catalog from JSON files
- Search API (`/api/books/search?q=`)
- Filter/sort API (`/api/books?genre=&sort=`)
- Cart total calculation endpoint
- Book recommendation endpoint (simple: "same genre" suggestions)
- Review/rating submission endpoint (appended to JSON, no DB)
- Optional: proxy endpoint to fetch live data from Open Library/Google Books API

---

## 5. Folder Structure

### Frontend
```
bookshelf-frontend/
├── src/
│   ├── components/
│   │   ├── BookCard/
│   │   ├── CartDrawer/
│   │   ├── Navbar/
│   │   ├── Filters/
│   │   └── Footer/
│   ├── pages/
│   │   ├── Home/
│   │   ├── GenrePage/
│   │   ├── BookDetail/
│   │   ├── Cart/
│   │   └── Checkout/
│   ├── context/
│   │   └── CartContext.jsx
│   ├── services/
│   │   └── api.js
│   ├── App.jsx
│   └── main.jsx
├── public/
└── package.json
```

### Backend
```
bookshelf-backend/
├── data/
│   ├── books.json
│   └── reviews.json
├── routes/
│   ├── books.js
│   ├── cart.js
│   └── reviews.js
├── controllers/
│   ├── booksController.js
│   └── reviewsController.js
├── utils/
│   └── fileHandler.js
├── server.js
└── package.json
```

---

## 6. Contribution Model

Following the UIverse-style "one PR = one isolated addition" pattern:

| Contribution Type | Example | Difficulty |
|---|---|---|
| Add a new genre page | "Add Horror genre page" | Beginner |
| Add a UI component | "Add star rating component" | Beginner |
| Add book entries | "Add 10 books to sci-fi JSON" | Beginner |
| Build a filter/sort feature | "Add price range filter" | Intermediate |
| Build a backend API endpoint | "Add recommendation endpoint" | Intermediate |
| Integrate external API | "Connect Open Library API for covers" | Advanced |
| Add dark mode / animations | "Add scroll animations to book cards" | Intermediate |

This structure keeps merge conflicts low (contributors mostly touch separate files/components) and allows onboarding contributors at any skill level.

---

## 7. Roadmap / Milestones

- **Phase 1 — Foundation**: Base React app + Express server + JSON data structure + core pages (Home, Genre, Book Detail)
- **Phase 2 — Core Features**: Cart, wishlist, search, filters, sort
- **Phase 3 — Enhancements**: Reviews/ratings, recommendations, dark mode, animations
- **Phase 4 — Polish**: Responsive design pass, accessibility, external API integration, documentation
- **Phase 5 — Community Growth**: Good-first-issue labeling, contribution guide, onboarding docs

---

## 8. Why This Works for ECOS

- **No DB setup** → contributors can start in under 5 minutes
- **Clear isolation of tasks** → scales to large contributor counts without merge conflicts
- **Real-world stack** (React + Node + REST APIs) → genuine learning value
- **Beginner-to-advanced task ladder** → keeps both first-time and experienced contributors engaged
