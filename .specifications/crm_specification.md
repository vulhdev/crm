# CRM Platform Specification

## 1. Overview
The goal is to build a lightweight Customer Relationship Management (CRM) platform that uses Google Sheets as its primary database. This approach allows for easy, non-technical viewing and editing of data outside the platform while providing a streamlined, purpose-built UI for day-to-day CRM tasks.

## 2. Core Features
- **Dashboard**: High-level metrics (e.g., total customers, new leads this week) and a quick view of recently added or updated customers.
- **Customer List**: A sortable, filterable, and paginated data table displaying all customer entries fetched directly from the Google Sheet.
- **Add Customer**: A user-friendly form to capture new customer information and append it as a new row in the designated Google Sheet.
- **Edit Customer**: Ability to select an existing customer, modify their details, and sync the changes back to the corresponding row in the Google Sheet.
- **Delete/Archive Customer**: Functionality to remove a customer from active views (ideally moved to an 'Archived' sheet or marked with an inactive status, rather than a hard delete).

## 3. Data Model (Google Sheet Structure)
The Google Sheet will act as the database table. The first row must be the header row defining the schema:
- `id` (Unique Identifier, e.g., UUID or Auto-incremented)
- `first_name` (String)
- `last_name` (String)
- `email` (String)
- `phone` (String)
- `company` (String)
- `status` (Enum: Lead, Active, Churned, Archived)
- `last_contact_date` (Date)
- `notes` (Long Text)
- `created_at` (Timestamp)

## 4. Technical Architecture
### 4.1. Recommended Tech Stack
- **Monorepo Tooling**: Turborepo (or Nx) to manage the frontend and backend within a single repository, sharing code/types easily.
- **Frontend**: Vite with a modern UI framework (e.g., React or Vue). Tailwind CSS for styling and a component library (e.g., shadcn/ui) for rapid development.
- **Backend**: An independent backend service built with Node.js and NestJS for a structured, scalable, and modular architecture. This service will handle all business logic, authentication, and communication with Google Sheets, exposing a REST API for the frontend.
- **Data Source**: Google Sheets API v4.
- **Authentication**: **Passport.js with Google OAuth20** (`@nestjs/passport` + `passport-google-oauth20`) is highly recommended for NestJS. The backend will integrate with Google Workspace to authenticate users. Once authenticated via Google, the backend will issue a **JSON Web Token (JWT)** to the frontend for session management. The backend will still use a Google Service Account exclusively for server-to-server communication with Google Sheets, meaning individual users don't need direct sheet access.

### 4.2. Google Sheets Integration
- **Setup**: A Google Cloud Project must be created with the Google Sheets API enabled.
- **Authentication Method**: Service Account credentials (JSON key file). The Service Account email must be granted "Editor" access to the specific Google Sheet.
- **Operations**:
  - `GET`: Fetch all rows from the specific sheet range (e.g., `Sheet1!A:J`).
  - `POST`: Append a newly formatted row to the sheet.
  - `PUT/PATCH`: Find the row number based on the `id` column and update the specific range.

## 5. Security & Privacy
- **Environment Variables**: The Service Account private key, client email, and Google Sheet ID must be stored securely as environment variables (e.g., in `.env.local`) and never committed to version control.
- **Data Validation**: Sanitize all form inputs on the server side before communicating with the Google Sheets API to avoid injection or malformed row data.
- **Access Control**: Depending on the requirements, basic authentication (e.g., NextAuth.js or Clerk) might be needed to protect the CRM platform itself from unauthorized web access.

## 6. Development Milestones
1. **Setup & Configuration**: Init Next.js project, setup Google Cloud Service Account, create the initial Google Sheet.
2. **Read Operation Implementation**: Connect API to fetch data and build the frontend Customer List table.
3. **Write Operation Implementation**: Build the Add Customer form and the API route to append rows.
4. **Update/Delete Implementation**: Build the Edit view and logic to mutate existing rows.
6. **Deployment**: Deploy the frontend (e.g., to Vercel or Netlify) and backend (e.g., to Render, Railway, or standard VPS), and configure production environment variables.

## 7. Development Phases & Tasks

### Phase 1: Setup & Configuration (Monorepo)
- Initialize the Git repository and ignore rules.
- **Root**: Setup the Monorepo (using Turborepo `npx create-turbo@latest` or Nx) with a shared `packages` structure.
- **Frontend (`apps/web`)**: Initialize a Vite project (React/Vue) with Tailwind CSS support and set up a component library.
- **Backend (`apps/api`)**: Initialize a NestJS project and configure environment variables.
- **Shared (`packages/types`)**: Create a shared package for TypeScript interfaces used by both frontend and backend.
- **Infrastructure**: Set up a Google Cloud Project, enable the Sheets API, and generate Service Account credentials.
- Create the target CRM Google Sheet with the required columns (`id`, `first_name`, `last_name`, `email`, `phone`, `company`, `status`, `last_contact_date`, `notes`, `created_at`).

### Phase 2: Authentication (OAuth 2.0)
- **Backend**: Install Passport.js (`@nestjs/passport`, `passport-google-oauth20`) and JWT (`@nestjs/jwt`).
- **Backend**: Implement the Google OAuth Strategy, create `/auth/google` and callback endpoints for handling the OAuth flow.
- **Backend**: Implement JWT issuance upon successful login and an Auth Guard for protecting subsequent API routes.
- **Frontend**: Build the login page with a "Sign in with Google" button.
- **Frontend**: Handle the OAuth redirect, store the JWT securely, and manage the global authentication state.

### Phase 3: Backend - Google Sheets Integration
- **Backend**: Install `googleapis` and configure the client using the Service Account credentials.
- **Backend**: Create a `SheetsService` and a protected `CustomersController` to handle reading from the Google Sheet (`GET /customers`).
- **Backend**: Extend the `SheetsService` and Controller to handle writing new rows (`POST /customers`).
- **Backend**: Extend the `SheetsService` and Controller to handle finding and updating an existing row (`PATCH /customers/:id`).

### Phase 4: Frontend - Core Application Pages
- **Frontend**: Create a protected route layout that requires authentication and an API service utility that automatically attaches the JWT `Bearer` token to requests.
- **Frontend - Dashboard**: Build a dashboard displaying high-level metrics (e.g. from the API).
- **Frontend - Customer List**: Build a data table fetching and displaying the customer list from `GET /customers`. Implement client-side sorting/filtering.
- **Frontend - Add Customer**: Build a "New Customer" form linking to `POST /customers` with field validation.
- **Frontend - Edit Customer**: Build the interface (modal or separate page) to edit existing details linking to `PATCH /customers/:id`.

### Phase 5: UI/UX Polish & Deployment
- Add loading skeletons or spinners for API calls in the frontend.
- Implement toast notifications for successful actions or errors.
- Ensure the UI is responsive across desktop and mobile viewing.
- Deploy the backend and frontend to your chosen providers and configure production environment variables.
