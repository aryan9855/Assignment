# Transaction Reconciliation Engine

A production-grade, highly configurable crypto and fiat Transaction Reconciliation Engine built with **Node.js**, **Express.js**, and **MongoDB/Mongoose**.

---

## 🏛️ System Architecture

```
                       +---------------------------+
                       |       REST API Client     |
                       +---------------------------+
                                     |
                                     | (File Uploads & Custom Config)
                                     v
                       +---------------------------+
                       |    Express.js Gateway     |
                       +---------------------------+
                                     |
                +--------------------+--------------------+
                |                    |                    |
                v                    v                    v
      [ReconcileController]  [ReportController]   [Middlewares]
                |                    |
                +----------+---------+
                           |
                           v
              +--------------------------+
              |   ReconciliationService  |
              +--------------------------+
                /          |           \
               /           v            \
              v     [MatchingEngine]     v
      [CSVParserService]                 [Repositories]
                                                |
                                                v
                                         [Mongoose Models]
                                                |
                                                v
                                         [MongoDB Database]
```

### Ingestion Flow
1. **API Trigger**: `POST /api/reconcile` accepts `userFile` and `exchangeFile` via multipart-form uploads.
2. **Stream Parsing**: `CSVParserService` reads CSV file buffers concurrently using chunked stream parsing to avoid loading full files in memory.
3. **Data Quality Filter**: Invalid row schemas (missing IDs, malformed dates, non-positive quantities) are filtered out, enriched with error reasons, and stored in the `DataQualityIssue` collection. Valid transactions are batched and saved to database collections.
4. **Idempotency Check**: Run statuses are validated against existing executions to prevent concurrent processing or duplicate requests.

### Scoring-Based Matching Logic
Instead of a naive exact match, matching is performed using a scoring system:
* **Asset Match (+40 pts)**: Normalizes aliases (e.g. `bitcoin` / `BTC` -> `BTC`) case-insensitively.
* **Type Match (+20 pts)**: Maps transaction perspectives (e.g. User `TRANSFER_OUT` matches Exchange `TRANSFER_IN`).
* **Quantity within Tolerance (+20 pts)**: Checks if difference is within configured percent (default `0.01%`).
* **Timestamp within Tolerance (+20 pts)**: Checks if time difference is within configured window (default `5 minutes`).

#### Classification:
* **Score = 100**: `MATCHED`
* **60 <= Score < 100**: `CONFLICTING` (e.g., asset and type matched, but quantity or timestamp was outside tolerances).
* **Score < 60**: Discarded as candidates. Unpaired rows are categorized as `UNMATCHED` (User only or Exchange only).

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/reconciliation_engine
TIMESTAMP_TOLERANCE_SECONDS=300
QUANTITY_TOLERANCE_PCT=0.01
```

---

## 🚀 Setup & Installation

### Prerequisites
* **Node.js** (v18+)
* **MongoDB** (running locally or a connection string)

### Steps
1. Clone the repository and navigate to the directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the test suites:
   ```bash
   npm run test
   ```
4. Start the application:
   ```bash
   # Production
   npm start
   
   # Development (requires nodemon)
   npm run dev
   ```

---

## 📖 API Documentation

### 1. Trigger Reconciliation Run
* **Endpoint**: `POST /api/reconcile`
* **Content-Type**: `multipart/form-data`
* **Parameters**:
  * `userFile` (File): User transaction export CSV
  * `exchangeFile` (File): Exchange transaction export CSV
  * `runId` (String, Optional): Custom ID to enforce idempotency.
  * `timestampToleranceSeconds` (Number, Optional): Custom timestamp window overrides.
  * `quantityTolerancePct` (Number, Optional): Custom quantity percent tolerance overrides.

* **Response Example (201 Created)**:
```json
{
  "success": true,
  "message": "Reconciliation run completed successfully.",
  "data": {
    "runId": "RUN_1718100000000",
    "status": "COMPLETED",
    "config": {
      "timestampToleranceSeconds": 300,
      "quantityTolerancePct": 0.01
    },
    "summary": {
      "matched": 15,
      "conflicting": 2,
      "unmatchedUser": 4,
      "unmatchedExchange": 3,
      "totalUserTransactions": 21,
      "totalExchangeTransactions": 20,
      "totalDataQualityIssues": 4
    },
    "auditTrail": [
      { "action": "RUN_INITIATED", "details": "Reconciliation started..." },
      { "action": "DATA_INGESTION_COMPLETED", "details": "Parsed valid user/exchange rows..." },
      { "action": "RUN_COMPLETED", "details": "Matched: 15, Conflicting: 2..." }
    ],
    "startedAt": "2026-06-11T06:00:00.000Z",
    "completedAt": "2026-06-11T06:00:02.000Z"
  }
}
```

### 2. Fetch Full Reconciliation Report
* **Endpoint**: `GET /api/report/:runId`
* **Query Parameters**:
  * `status` (String): Filter by `MATCHED`, `CONFLICTING`, or `UNMATCHED`.
  * `page` (Number): Defaults to `1`.
  * `limit` (Number): Defaults to `50`.
  * `sortBy` (String): Defaults to `createdAt`.
  * `sortOrder` (String): `asc` or `desc`.
  * `format` (String): If set to `csv`, triggers a CSV file download instead of JSON.

* **Response Example (200 OK)**:
```json
{
  "success": true,
  "runDetails": { "runId": "RUN_1718100000000", "status": "COMPLETED" },
  "data": [
    {
      "status": "MATCHED",
      "reason": "Exact match across asset, type, quantity, and timestamp.",
      "score": 100,
      "userTransaction": {
        "transactionId": "USR-001",
        "timestamp": "2024-03-01T09:00:00.000Z",
        "type": "BUY",
        "asset": "BTC",
        "quantity": 0.5
      },
      "exchangeTransaction": {
        "transactionId": "EXC-1001",
        "timestamp": "2024-03-01T09:00:32.000Z",
        "type": "BUY",
        "asset": "BTC",
        "quantity": 0.5
      }
    }
  ],
  "pagination": { "total": 24, "page": 1, "limit": 50, "pages": 1 }
}
```

### 3. Fetch Report Summary
* **Endpoint**: `GET /api/report/:runId/summary`
* **Response Example (200 OK)**:
```json
{
  "success": true,
  "runId": "RUN_1718100000000",
  "status": "COMPLETED",
  "summary": {
    "totalUserTransactions": 21,
    "totalExchangeTransactions": 20,
    "totalDataQualityIssues": 4,
    "counts": {
      "MATCHED": 15,
      "CONFLICTING": 2,
      "UNMATCHED_USER": 4,
      "UNMATCHED_EXCHANGE": 3
    }
  },
  "auditTrail": [ ... ]
}
```

### 4. Fetch Unmatched Transactions only
* **Endpoint**: `GET /api/report/:runId/unmatched`
* **Query Parameters**: `page`, `limit`, `sortBy`, `sortOrder`
* **Response Example (200 OK)**:
```json
{
  "success": true,
  "runId": "RUN_1718100000000",
  "data": [
    {
      "status": "UNMATCHED",
      "reason": "No matching exchange transaction found within parameters.",
      "score": 0,
      "userTransaction": { "transactionId": "USR-016", "asset": "SOL", "quantity": 3.0 },
      "exchangeTransaction": null
    }
  ],
  "pagination": { "total": 7, "page": 1, "limit": 50, "pages": 1 }
}
```

---

## 🛠️ Design Decisions & Trade-Offs

### 1. In-Memory Bucket Matching vs O(N*M) Loop
* **Decision**: We index exchange transactions in-memory bucketed by normalized asset and type mapping during reconciliation execution. 
* **Trade-off**: Increases memory utilization slightly but optimizes the matching phase from a naive quadratic $O(N \times M)$ search to $O(N)$ average time complexity. For very large datasets (millions of rows), we can replace in-memory matching with a map-reduce style database query batching or a distributed message worker process (like BullMQ).

### 2. Custom Mongoose Schema Wrapper for Type Conflict
* **Decision**: Configured explicit schemas with `type: { type: String }` instead of direct key assignments inside nested objects to bypass the Mongoose reserved keyword conflict.

### 3. Idempotency Response Design
* **Decision**: If a completed run is requested again, rather than throwing a `409 Conflict` error (which indicates a transient failure), we return the existing cached run data with `200 OK`. Active runs still throw `409` to prevent race conditions.
#   A s s i g n m e n t  
 