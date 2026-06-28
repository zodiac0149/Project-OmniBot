# NexusAI (OmniBot)

NexusAI is an intelligent, multi-brand customer support bot designed to serve storefronts that manage multiple brands. It leverages advanced Retrieval-Augmented Generation (RAG) to ingest brand-specific policies, pricing, and warranty data, enabling customers to interact seamlessly with an AI agent to get accurate, context-aware information.

## 🚀 Features

- **Multi-Brand Architecture:** Safely stores and isolates knowledge bases for different brands under a single unified platform.
- **Intelligent Knowledge Retrieval:** Uses Amazon Bedrock (`amazon.titan-embed-text-v2:0`) for generating vector embeddings and Supabase (pgvector) for blazing-fast similarity search.
- **Smart Data Categorization:** Dynamically categorizes queries to fetch the right type of knowledge. It distinguishes between "volatile" data (like real-time pricing and inventory) and "stable" data (like return policies and warranties) to prevent hallucinations.
- **Automated Escalation:** Built-in escalation paths for complex customer queries that require human intervention.
- **Modern Tech Stack:** Built on the bleeding edge of web development using Next.js 14 (App Router), React 18, Tailwind CSS, Vercel AI SDK, and Supabase.

## 🧠 How It Works (The Workflow)

The application workflow is divided into two primary phases: **Knowledge Ingestion** and **Customer Interaction**.

### 1. Knowledge Ingestion (Brand Dashboard)
1. **Upload:** Store administrators or brand representatives upload their specific documentation (PDFs, text files) containing policies, warranties, or price lists.
2. **Embedding:** The application parses these documents and sends the text to Amazon Bedrock to generate high-dimensional vector embeddings.
3. **Vector Storage:** These embeddings are stored securely in a Supabase pgvector database, tagged with the specific brand ID and document type (`stable` or `latest_only`).

### 2. Customer Interaction (Storefront Bot)
1. **User Query:** A customer visits the storefront and asks the bot a question (e.g., "What is the warranty on the Sony X90L?" or "What is the current ex-showroom price?").
2. **Intent & Similarity Search:** The bot analyzes the query to determine if it is asking for volatile data (pricing/stock) or stable data. It generates an embedding for the question and queries the Supabase vector store for the top matching documents specific to that brand.
3. **AI Generation:** The Vercel AI SDK combines the user's question with the retrieved brand-specific context and streams an accurate, hallucination-free response back to the customer.

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS & Radix UI
- **Database & Auth:** Supabase (PostgreSQL + pgvector)
- **AI Integration:** Vercel AI SDK
- **Embeddings & LLMs:** Amazon Bedrock (`@ai-sdk/amazon-bedrock`), OpenAI
- **Testing:** Vitest

## 💻 Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- Supabase account and project
- AWS account with Bedrock access

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables:
   Copy `.env.example` to `.env` and fill in the required keys:
   ```bash
   cp .env.example .env
   ```
   *Required variables typically include Supabase URL/Anon Key, AWS Credentials (for Bedrock), and OpenAI API keys.*

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 🧪 Testing

The project uses Vitest for robust unit and integration testing.

To run the test suite:
```bash
npm run test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
