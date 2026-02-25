# Social Media Microservices

A scalable social media backend built with a microservices architecture using Node.js, MongoDB, Redis, RabbitMQ, and Docker.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [API Usage Examples](#api-usage-examples)
- [Event Flow](#event-flow)
- [Project Structure](#project-structure)
- [Event-Driven Communication](#event-driven-communication)
- [Security](#security)
---

## Architecture Overview

```
                    Client
                      │
                      ▼
              ┌─────────────────┐
              │   API Gateway   │  ← Single entry point, rate limiting, auth proxy
              │   (Port 3000)   │
              └────────┬────────┘
                       │
    ┌───────────┬──────┴───┬───────────┐
    │           │          │           │
    ▼           ▼          ▼           ▼
  ┌────────┐ ┌───────┐ ┌────────┐ ┌────────┐
  │Identity│ │ Post  │ │ Media  │ │ Search │
  │Service │ │Service│ │Service │ │Service │
  └────────┘ └───────┘ └────────┘ └────────┘
      │           │        │           │
      └───────────┴────────┴───────────┘
                        │
              ┌─────────┴──────────┐
              │                    │
        ┌────▼────┐       ┌───────▼──────┐
        │  Redis  │       │   RabbitMQ   │
        │  Cache  │       │  Event Bus   │
        └─────────┘       └──────────────┘
```

Each service has its own **MongoDB** database, ensuring loose coupling and independent scalability.

---

## Services

### Identity Service
Handles all user authentication and authorization.

  POST   `/v1/auth/register`          | Register a new user 
  
  POST   `/v1/auth/login`             | Login and receive tokens 
  
  POST   `/v1/auth/refreshToken`      | Refresh access token 
  
  POST   `/v1/auth/logout`            | Logout and invalidate refresh token 

**Features:**
- JWT-based access tokens + refresh token rotation
- Passwords hashed with bcrypt
- Refresh tokens persisted in MongoDB with expiry

---

### Post Service
Manages creation, retrieval, and deletion of posts.


  POST     `/v1/posts/create-post`       | Create a new post 
  GET      `/v1/posts/posts`             | Get all posts (paginated) 
  GET      `/v1/posts/:id`               | Get a single post by ID 
  DELETE   `/v1/posts/:id`               | Delete a post (owner only) 

**Features:**
- Redis caching for fast post retrieval (5 min TTL for lists, 1 hr for single posts)
- Cache invalidation on create/delete
- Publishes `post.created` and `post.deleted` events to RabbitMQ
- Supports attaching media IDs to posts

---

### Media Service
Handles file uploads and media management via Cloudinary.


  POST   `/v1/media/upload`             | Upload a file (max 5MB) 
  GET    `/v1/media/getMedias`          | Get all uploaded media 

**Features:**
- File uploads via `multipart/form-data`
- Cloudinary integration for cloud storage
- Listens for `post.deleted` events to clean up associated media
- 5MB file size limit enforced via Multer

---

### Search Service
Provides full-text search over posts.

  GET  `/v1/search/posts?q=...`   | Search posts by content 

**Features:**
- Listens for `post.created` events to index new posts
- Maintains its own search-optimized data store (MongoDB)

---

### API Gateway
The single entry point for all client requests.

**Features:**
- Request proxying to internal services
- JWT validation on protected routes
- Rate limiting: **100 requests / 15 minutes** per IP (backed by Redis)
- Helmet for HTTP security headers
- CORS enabled
- Request body size limit: 10MB
- Centralized logging

---

## Tech Stack

  **Node.js + Express**       | Service runtime & HTTP framework 
  **MongoDB + Mongoose**      | Per-service databases 
  **Redis (ioredis)**         | Caching & rate limit store 
  **RabbitMQ**                | Async event bus between services 
  **Cloudinary**              | Media/image cloud storage 
  **JWT**                     | Stateless authentication 
  **Docker + Docker Compose** | Containerization & orchestration 
  **Winston**                 | Structured logging 
  **Joi**                     | Request validation 
  **Multer**                  | Multipart file upload handling 

---

## API Usage Examples

### Register a User
```http
POST /v1/auth/register
Content-Type: application/json

{
  "name": "john_doe",
  "email": "john@example.com",
  "password": "StrongPass123!"
}
```

### Login
```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "StrongPass123!"
}
```

### Create a Post
```http
POST /v1/posts/create-post
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "content": "Hello, world!",
  "mediaIds": ["optional-media-id"]
}
```

### Upload Media
```http
POST /v1/media/upload
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file: <your-file>
```

### Search Posts
```http
GET /v1/search/posts?q=hello
Authorization: Bearer <accessToken>
```

---

## Project Structure

```
microservices-main/
├── api-gateway/
│   └── src/
│       ├── middlewares/       # Auth & error handling
│       ├── utils/             # Logger
│       └── server.js          # Gateway + proxy setup
├── identity-service/
│   └── src/
│       ├── controllers/       # Register, login, refresh, logout
│       ├── models/            # User, RefreshToken
│       ├── routes/
│       └── utils/             # Token generation, validation
├── post-service/
│   └── src/
│       ├── controllers/       # CRUD operations
│       ├── models/            # Post schema
│       ├── routes/
│       └── utils/             # RabbitMQ publisher, validation
├── media-service/
│   └── src/
│       ├── controllers/       # Upload, fetch media
│       ├── eventHandlers/     # Handles post.deleted events
│       ├── models/
│       └── utils/             # Cloudinary, RabbitMQ
├── search-service/
│   └── src/
│       ├── controllers/       # Search posts
│       ├── eventHandler/      # Indexes post.created events
│       ├── models/
│       └── utils/             # RabbitMQ consumer
└── docker-compose.yml
```

---

## Event-Driven Communication

Services communicate asynchronously via **RabbitMQ** for decoupled workflows:

  `post.created`      | Post Service | Search Service | Index post for search |
  `post.deleted`      | Post Service | Media Service | Delete associated media from Cloudinary |

---

## Security

- **JWT authentication** on all protected routes (validated at the API Gateway)
- **Rate limiting** (100 req/15min per IP) stored in Redis to prevent brute-force attacks
- **Helmet** sets secure HTTP headers
- **bcrypt** password hashing in Identity Service
- **Refresh token rotation** — old tokens are deleted on refresh
- **Input validation** via Joi schemas on all write endpoints

---
