# E-Commerce Platform — Product Requirements

## 1. Project Overview

Build a full-stack e-commerce website where customers can browse products, manage a shopping cart, place orders, and view their order history. Administrators can manage products, inventory, and orders.

## 2. User Roles

### Customer
- Register and log in.
- Browse, search, filter, and sort products.
- View product details.
- Add products to a cart and update quantities.
- Manage delivery addresses.
- Place orders.
- View order history and order details.

### Administrator
- Access a protected admin dashboard.
- Create, view, update, and delete products.
- Manage product categories.
- Manage inventory.
- View and update order statuses.
- View customer information required for order management.

## 3. Initial Technology Stack

- Frontend: Next.js and TypeScript
- Backend: NestJS and TypeScript
- Database: PostgreSQL
- ORM: Prisma
- API: REST
- Version control: Git and GitHub
- Testing: Jest and Playwright

## 4. Initial MVP Scope

The first release will include:
1. Project foundation
2. Customer authentication
3. Product catalogue
4. Product search and filtering
5. Shopping cart
6. Address management
7. Order placement
8. Admin product management
9. Admin order management
10. Automated testing

## 5. Later Enhancements

- Payment gateway integration
- Email notifications
- Product reviews and ratings
- Wishlist
- Coupons and discounts
- AI-powered product recommendations
- AI-assisted customer support

## 6. Quality Requirements

- Protect customer information.
- Never store passwords in plain text.
- Validate user input on the server.
- Enforce authorization for administrative operations.
- Handle errors safely.
- Test important business workflows.
- Keep secrets out of Git.
- Document significant technical decisions.

## 7. AI-Assisted Development Rules

- AI-generated code must be reviewed before acceptance.
- Every feature must have acceptance criteria.
- Important business logic must have automated tests.
- AI must not change architecture or add dependencies without approval.
- Use official documentation to verify technical decisions.
- Never provide AI tools with passwords, tokens, or production secrets.

## 8. Current Status

Requirements draft created. Detailed user stories, acceptance criteria, architecture, and database design will be documented before implementing their respective features.