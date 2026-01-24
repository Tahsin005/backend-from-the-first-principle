# Search Battle: PostgreSQL vs Elasticsearch

A high-performance search comparison application built with Next.js, comparing PostgreSQL (ILIKE) and Elasticsearch on a dataset of 50,000 movie reviews.

## Overview

This project demonstrates the performance gap between traditional relational database text searching and a dedicated search engine. It features a real-time, streaming search interface that queries both systems in parallel and displays the response times side-by-side.

## Tech Stack

- Frontend: Next.js 15+ with App Router
- Styling: Tailwind CSS
- Database: PostgreSQL (Neon DB)
- Search Engine: Elasticsearch (Elastic Cloud)
- Data Source: 50,000 movie reviews (IMDb dataset)

## Performance Results

Our benchmarks on the 50,000 record dataset show:

| Search Method | Performance (ms) | Speed Improvement |
| :--- | :--- | :--- |
| PostgreSQL (ILIKE) | ~3,551 ms | Base |
| Elasticsearch | ~1,203 ms | ~3x Faster |

*Note: Results may vary based on network latency and specific query complexity.*

## Setup Instructions

### 1. Environment Configuration
Create a .env file in the root directory with the following credentials:

```env
# Database
DB_HOST=your-neon-host
DB_PORT=5432
DB_DATABASE=neondb
DB_USERNAME=neondb_owner
DB_PASSWORD=your-password

# Elasticsearch
ELASTICSEARCH_NODE=your-node-url
ELASTICSEARCH_API_KEY=your-api-key
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Seed the Data
The project includes automated scripts to populate both databases with the 50k dataset.

**Seed PostgreSQL (Batch size 100):**
```bash
node scripts/seed-pg.mjs
```

**Seed Elasticsearch (Bulk indexing):**
```bash
node scripts/seed-es.mjs
```

### 4. Run the Development Server
```bash
npm run dev
```
Open http://localhost:3000 to see the search in action.

## Search in Action

![Search Results Comparison](https://miro.medium.com/v2/resize:fit:720/format:webp/1*ESDKiFcRTQgfkTdKV9raQg.png)
