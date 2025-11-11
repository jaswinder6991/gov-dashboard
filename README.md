# NEAR Governance Dashboard

Built on NEAR AI Cloud, this application supports evaluating proposals based on established criteria.

## Screening Criteria

1. **Complete** - Contains all required info
2. **Legible** - Clear and well-written
3. **Consistent** - Structurally coherent
4. **Genuine** - Authentic and intentional
5. **Compliant** - Follows governance rules
6. **Justified** - Provides logical reasoning

Plus **Alignment Score** (high/medium/low) considering NEAR ecosystem growth strategy.

## Tech Stack

- **Framework:** Next.js 15
- **Database:** PostgreSQL with Drizzle ORM
- **LLM Provider:** NEAR AI Cloud (GPT-OSS-120B)
- **Authentication:** NEP-413 (`near-sign-verify`)

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- NEAR wallet

### Installation

```bash
# Clone repository
git clone https://github.com/jlwaugh/neargov.git && cd neargov

# Install dependencies
bun install

# Copy example configuration
cp .env.example .env
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/neargov
NEAR_AI_CLOUD_API_KEY=your_api_key_here
DISCOURSE_URL=https://gov.near.org
DISCOURSE_API_KEY=your_discourse_api_key
DISCOURSE_API_USERNAME=your_discourse_username
```

### Database Setup

```bash
# Run migration
psql neargov < migration.sql

# Test connection
bun test-db.ts
```

### Local Development

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Database Schema

### screening_results

| Column             | Type         | Description                  |
| ------------------ | ------------ | ---------------------------- |
| topic_id           | VARCHAR(255) | Discourse topic ID           |
| revision_number    | INTEGER      | Version number               |
| evaluation         | JSONB        | AI screening results         |
| title              | TEXT         | Proposal title               |
| near_account       | VARCHAR(255) | Evaluator's NEAR account     |
| timestamp          | TIMESTAMP    | When screening was performed |
| revision_timestamp | TIMESTAMP    | When revision was created    |

**Primary Key:** `(topic_id, revision_number)`

## License

MIT
