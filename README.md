# Ecommerse Platform

A full-stack e-commerce application built with **Next.js, NestJS, TypeScript, PostgreSQL and Prisma**. The platform provides a customer shopping experience with secure authentication, product browsing, cart management, address management and order processing.

[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-316192?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)

## Project Overview

Ecommerse is a full-stack shopping platform designed using a modular backend architecture and a modern frontend application.

The project demonstrates practical implementation of REST APIs, database integration, authentication, authorization, session management, transactional order processing and frontend-backend integration.

## Features

### Customer Application
- Browse published products.
- View individual product details and images.
- Register and log in securely.
- Manage shopping cart.
- Add and manage delivery addresses.
- Complete checkout.
- View order history and order details.
- Maintain authenticated sessions using secure cookies.

### Backend and Administration
- RESTful API built with NestJS.
- Modular architecture for authentication, catalogue, cart, addresses and orders.
- Role-based access control.
- Admin APIs for category and product management.
- Product publication and image management.
- Database-backed session management.
- Transactional order creation and cart processing.

## Screenshots

Add actual application screenshots in this section.

| Homepage | Product Catalogue |
|---|---|
| `docs/screenshots/homepage.png` | `docs/screenshots/products.png` |

| Shopping Cart | Checkout |
|---|---|
| `docs/screenshots/cart.png` | `docs/screenshots/checkout.png` |

| Login | Orders |
|---|---|
| `docs/screenshots/login.png` | `docs/screenshots/orders.png` |

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.4.6 |
| Frontend language | TypeScript |
| Backend | NestJS 11 |
| Backend language | TypeScript |
| API | REST |
| Database | PostgreSQL 18 |
| ORM | Prisma 7 |
| Authentication | Database-backed sessions |
| Password hashing | scrypt |
| Validation | class-validator |
| Testing | Jest, Supertest |
| Package management | npm workspaces |
| Image hosting | Cloudinary |

## Architecture

```text
                  Customer Browser
                         |
                         v
                 Next.js Frontend
                    Port 3000
                         |
                    REST API
                         |
                         v
                   NestJS Backend
                    Port 3001
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
       Auth           Catalogue        Cart
          |              |              |
          +--------------+--------------+
                         |
              Addresses and Orders
                         |
                         v
                  Prisma ORM
                         |
                         v
                   PostgreSQL
```

## Project Structure

```text
Ecommerse-platform/
│
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── app/
│   │   │   ├── addresses/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   ├── login/
│   │   │   ├── orders/
│   │   │   ├── products/
│   │   │   └── register/
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   │
│   └── api/                  # NestJS backend
│       └── src/
│
├── packages/
│   ├── types/
│   ├── ui/
│   └── config/
│
├── infrastructure/
├── docs/
├── package.json
└── package-lock.json
```

## Getting Started

### Prerequisites

Install the following:

- Node.js 24 LTS
- npm
- PostgreSQL 18
- Git

### 1. Clone the repository

```bash
git clone https://github.com/DevikaChilakanti/Ecommerse-platform.git

cd Ecommerse-platform
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `apps/api/.env` using `apps/api/.env.example` as a reference.

Configure:

```env
DATABASE_URL=your_postgresql_connection_string
FRONTEND_ORIGIN=http://localhost:3000
```

Create `apps/web/.env.local` using `apps/web/.env.example` as a reference.

Configure:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

Use your own local database credentials. Never commit real passwords, tokens or API secrets.

### 4. Configure the database

Create the development database in PostgreSQL and apply the project's Prisma migrations using the migration workflow configured in the API workspace.

Generate the Prisma client:

```bash
npm run prisma:generate --workspace=apps/api
```

### 5. Start the backend

```bash
npm run dev:api
```

Backend:

`http://localhost:3001`

API base URL:

`http://localhost:3001/api/v1`

### 6. Start the frontend

Open another terminal:

```bash
npm run dev --workspace=apps/web
```

Frontend:

`http://localhost:3000`

## Testing

The project includes unit tests and PostgreSQL-backed integration tests.

Run backend unit tests:

```bash
npm test --workspace=apps/api -- --runInBand
```

Run backend integration tests:

```bash
npm run test:api
```

Build the frontend:

```bash
npm run build --workspace=apps/web
```

Build the backend:

```bash
npm run build:api
```

### Validation Results

The following checks passed during the development and release-readiness process:

| Validation | Result |
|---|---|
| Backend unit tests | 45 passed |
| PostgreSQL integration tests | 18 passed |
| Frontend lint | Passed |
| Frontend production build | Passed |
| Backend production build | Passed |
| Production dependency audit | 0 vulnerabilities |
| Git history secret scan | No leaks found in 37 commits |

## Security

Security measures implemented include:

- Password hashing using scrypt.
- Database-backed session management.
- Hashed session-token storage.
- HttpOnly authentication cookies.
- Role-based authorization.
- Request validation.
- Environment-based configuration.
- Separate development and integration-test database configuration.

## Current Scope and Limitations

This project is an evolving e-commerce MVP.

The current implementation does not include:
- Payment gateway integration.
- Refund processing.
- Email notifications.
- Product reviews and ratings.
- Advanced inventory reservation.
- A complete visual admin dashboard.

## Future Enhancements

- Integrate a payment gateway.
- Build a dedicated admin dashboard.
- Add product search, filtering and sorting.
- Implement inventory management.
- Add automated frontend end-to-end testing.
- Set up CI/CD pipelines.
- Deploy the application to cloud infrastructure.

## Author

**Devika Chilakanti**

Full-Stack Development | TypeScript | Next.js | NestJS | PostgreSQL

## Repository

[GitHub – Ecommerse Platform](https://github.com/DevikaChilakanti/Ecommerse-platform)

---

*Built as a practical full-stack software engineering project to demonstrate modern web application development, API design, database management, authentication and testing.*