# REST API Design: Building Intuitive and Consistent Interfaces

## Introduction

API design is something that, as a backend engineer, you will spend a significant amount of time working on and thinking about. It is one of the most critical skills in your toolkit. While the backend landscape offers various technologies for building APIs: RPC, GraphQL, and others. **REST (Representational State Transfer)** remains one of the most widely used API standards in the industry.

The challenge with API design isn't the lack of standards. We have comprehensive specifications and decades of collective developer experience. The problem is that even now, developers in the early stages of their backend engineering journey still get confused by common questions:

- Should the URI path segment be plural or singular?
- When updating a resource, should I use PATCH or PUT?
- For non-CRUD (custom actions that don't fit neatly into create, read, update, or delete), which HTTP method should I use?
- What HTTP status code is appropriate for different scenarios?

These questions persist because when these standards were being developed, the state of the internet, web applications, clients, and servers were vastly different from today. We've evolved from Multi-Page Applications (MPAs) to Single-Page Applications (SPAs), where the browser downloads JavaScript in the first API call and performs all routing on the client side.

![REST API Design](https://miro.medium.com/v2/resize:fit:720/format:webp/1*Dn-E0HeJVWPg7yvWyk3dDw.png)

## What Does REST Even Mean?

**REST** stands for **Representational State Transfer Application Programming Interface**. The name describes its core function: the transfer of a representation of a resource's state from a server to a client.

Let's break down each component:

### Representational

When a client (such as a web browser or mobile app) requests a resource (like a user's data or a list of products), the server sends a **representation** of that resource's current state. This representation is typically formatted as JSON or XML. Crucially, the server does not send the actual internal database object; it sends a representation of it.

### State

This refers to the current data or values of the resource. For a user resource, the state might include the user's name, email, and number of followers. The state is a snapshot of the resource at the moment of the request.

### Transfer

The entire process involves **transferring** this representation of the state over the network, using standard HTTP methods like GET, POST, PUT, and DELETE.

The term was coined by computer scientist Roy Fielding in his 2000 doctoral dissertation, where he outlined the architectural principles for designing the World Wide Web itself. By adhering to these principles, interactions between different systems become organized, efficient, scalable, and predictable.

## The Anatomy of an API URL

Understanding the structure of a URL is fundamental to API design. Let's examine the high-level components of a typical website URL and then translate that into an API context.

### URL Components

A typical URL has the following structure:

```
https://api.example.com/v1/books?sort=name&limit=10#section
  │       │              │    │         │            │
Scheme  Authority/      Path  Query Parameters    Fragment
        Domain
```

**Scheme**: Whether it's `http` or `https` (the secure, encrypted version). For production APIs, always use `https`.

**Authority/Domain**: The domain of the server. This can include subdomains, for example, `api.example.com`.

**Path**: The resource you're trying to access. The forward slash (`/`) represents a hierarchical relationship between different resources.

**Query Parameters**: Used in GET requests to pass key-value pairs providing additional information to the server about filters, pagination, sorting, etc.

**Fragment**: This section navigates you to a particular section of a web page. When you first navigate to a page with a fragment, the browser scrolls you to that part. Fragments are generally not used in API design.

### Constructing an API URL

For REST APIs, a typical URL follows this pattern:

```
https://api.example.com/v1/books/harry-potter
  │         │          │    │        │
Scheme  Subdomain   Version Resource  Identifier
```

#### The Subdomain

Industry standard dictates that APIs are hosted on a dedicated subdomain. Most companies use `api.` as the subdomain prefix:

- `api.example.com`
- `api.github.com`
- `api.stripe.com`

#### Versioning

APIs evolve. To ensure backward compatibility and give clients time to migrate to new versions, versioning is essential. This is typically included in the URL path:

- `/v1/books`
- `/v2/books`

When you introduce breaking changes, you release a new version while maintaining the old one for a deprecation period.

#### Resource Names: The Plural Rule

This is one of the most debated topics in API design: **Should resource names be singular or plural?**

**The rule: Always use plural nouns for resource names in the path segment.**

This applies even when fetching a single resource. The rationale is that the resource represents a *collection* in your system. Whether you're accessing all items in the collection or a single item from it, the collection itself is plural.

**Correct:**
- `GET /books`: Fetch all books
- `GET /books/123`: Fetch a single book with ID 123
- `POST /books`: Create a new book
- `PATCH /books/123`: Update book with ID 123
- `DELETE /books/123`: Delete book with ID 123

**Incorrect:**
- `GET /book`: Don't use singular
- `GET /book/123`: Even for single resources, use plural

The second part of the path in `GET /books/123` (the `123`) is the **dynamic parameter** or **identifier** that specifies which resource within the collection you're accessing.

### URL Readability and Formatting

URLs travel through different environments: various server environments, client environments, and operating systems. To avoid issues with case sensitivity and encoding, follow these rules:

#### Use Lowercase

Never use capital letters in your path segments. Different systems handle case differently, which can lead to routing mismatches.

**Correct:** `/api/v1/books`
**Incorrect:** `/api/v1/Books`

#### Use Hyphens, Not Underscores or Spaces

When you have multi-word identifiers or slugs, use hyphens to separate words.

**Correct:** `/books/harry-potter`
**Incorrect:** `/books/harry_potter`, `/books/Harry%20Potter`

#### Creating Slugs

A **slug** is a URL-friendly, human-readable representation of a resource identifier. To convert a title or name into a slug:

1. Convert to lowercase: "Harry Potter" → "harry potter"
2. Replace spaces with hyphens: "harry potter" → "harry-potter"

The resulting URL is clean and readable: `/books/harry-potter`

### Hierarchical Relationships

The forward slash (`/`) in a URL represents a hierarchical relationship between resources. Consider this path:

```
/organizations/123/projects/456/tasks/789
```

This URL structure tells us:
- There's a collection of **organizations**
- Within that, we're accessing organization **123**
- That organization has a collection of **projects**
- We're accessing project **456** within that organization
- That project has a collection of **tasks**
- We're accessing task **789** within that project

This hierarchical structure makes your API intuitive and self-documenting.

## Idempotency: A Foundational Concept

Before diving into HTTP methods, you must understand **idempotency**: a property of certain operations where performing the same action multiple times has the same effect as performing it once.

### What Idempotency Means

An operation is idempotent if, no matter how many times a client performs a particular request, the outcome or result in the server environment remains the same. The side effect of calling an API once should be identical to calling it a thousand times.

This is crucial for building robust systems. Network failures happen. Clients might retry requests. Without idempotent operations, you could end up with duplicate data, inconsistent state, or unexpected behavior.

### Idempotency and HTTP Methods

Let's examine each major HTTP method through the lens of idempotency:

#### GET: Idempotent

The GET method retrieves data from the server. It is idempotent because it does not matter how many times you perform a GET request, you will always get the same outcome.

You might think: "What if someone else creates a new book while I'm making GET requests, and my results change?"

That's true, but that's not what idempotency measures. Idempotency is about **what side effect your API call causes on the server**. A GET request causes **no side effect**. It's purely a fetch operation. Whether you call it once or a million times, you don't change anything on the server with that specific request.

#### PUT: Idempotent

The PUT method is used to **completely replace** a resource with the payload provided by the client. It is idempotent.

Consider updating a user's name from "A" to "B":

- **First call**: The name changes from "A" to "B"
- **Second call**: The name is already "B", and you're setting it to "B" again, resulting in no change
- **Thousandth call**: Same result: name is still "B"

After each operation, the state of the resource remains identical. You're not causing different side effects with each API call.

#### PATCH: Idempotent

The PATCH method is used to **partially update** a resource, modifying only specific fields rather than replacing the entire resource. Like PUT, it is idempotent.

If you're updating only the `status` field from "active" to "inactive":

- **First call**: Status changes to "inactive"
- **Subsequent calls**: Status is already "inactive", resulting in no effective change

The outcome remains the same regardless of how many times you call the API.

#### DELETE: Idempotent

The DELETE method removes a resource from the server. It is idempotent, which might seem counterintuitive at first.

Consider deleting a user with ID 1:

- **First call**: The user is deleted. This is the side effect
- **Second call**: The user doesn't exist anymore. The server returns a 404 error
- **Subsequent calls**: Same 404 error. The user is still gone

Did the second call cause any side effect? **No.** The server checked if the user existed, found it didn't, and returned an error. The state of the server didn't change. The side effect of the delete operation (removing the user) only happened once, regardless of how many times you call the API.

This is why DELETE is idempotent: the *single* side effect you care about only occurs once.

#### POST: NOT Idempotent

The POST method is typically used to **create new resources**. It is the only major method that is **not idempotent**.

Consider creating a new book with a payload containing `name: "Harry Potter"`:

- **First call**: A new book is created with ID 1
- **Second call**: Another new book is created with ID 2 (same namebut a different entity)
- **Thousandth call**: You now have 1000 books

With each API call, you're creating a new resource. The side effects are **different** each time: a new database entry, a new ID, potentially new side effects like sending emails or triggering webhooks.

IDs are typically generated at the database level (UUIDs, auto-incremented integers), so it's entirely possible to have multiple resources with identical properties but different IDs. This is why POST is not idempotent.

### POST for Custom Actions

Beyond creating resources, POST has another critical role in REST API design: handling **custom actions** that don't fit into the standard CRUD operations.

Think about operations like:
- Sending an email
- Archiving a project
- Cloning a resource
- Running a report

These aren't create, read, update, or delete operations in the traditional sense. They're **actions** you want the server to perform.

Because POST is defined as an open-ended method in the REST specification, it's the appropriate choice for custom actions. We'll explore this in detail later.

## Designing Your API: Starting from Requirements

Now that we understand the theoretical foundation, let's talk about the practical workflow of designing APIs.

### Step 1: Start with Your UI Design

Before writing any code, start with your wireframes or Figma designs. This might seem counterintuitive for a backend engineer, but there's a good reason:

When you look at the wireframes (how end users will interact with data on the platform), you gain a clear understanding of:
- What data needs to be displayed
- What operations users need to perform
- How different pieces of data relate to each other

This gives you insight into how the first level of consumption (end users) relates to the lowest level (your database). Understanding this connection is the foundation of good API design.

### Step 2: Identify Your Resources

From your requirements and wireframes, extract the **nouns**. These nouns are your resources.

For a project management platform like Jira or Linear, your nouns might include:
- **Organizations**: Companies or teams using the platform
- **Users**: People in those organizations
- **Projects**: Collections of work within organizations
- **Tasks**: Individual work items within projects
- **Tags**: Labels for organizing tasks

Each of these nouns represents a resource that your API will expose.

### Step 3: Design Your Database Schema

Once you've identified your resources, design your database schema. This step maps directly to your resources:
- `organizations` table
- `users` table
- `projects` table
- `tasks` table
- `tags` table

Each table corresponds to a resource your API will serve.

### Step 4: Define Actions for Each Resource

For each resource, determine what actions clients need to perform. Start with the standard CRUD operations:

For the `organizations` resource:
1. **Create** an organization: `POST /organizations`
2. **List all** organizations: `GET /organizations`
3. **Get a single** organization: `GET /organizations/:id`
4. **Update** an organization: `PATCH /organizations/:id`
5. **Delete** an organization: `DELETE /organizations/:id`

Then consider custom actions:
6. **Archive** an organization: `POST /organizations/:id/archive`

### Step 5: Design the Interface Before Coding

Before writing a single line of business logic, design the complete interface of your API. Use tools like **Insomnia**, **Postman**, or **Swagger** to define:
- The routes
- The payloads
- The expected responses

This "design-first" approach forces you to think about the consumer experience before getting lost in implementation details.

## CRUD Operations: The Complete Reference

Let's walk through the implementation of standard CRUD operations for a resource, using the `organizations` example.

### Create: POST Request

**Route:** `POST /organizations`

**Request Body:**
```json
{
  "name": "Acme Corporation",
  "status": "active",
  "description": "A global manufacturing company"
}
```

**Response:**
- **Status Code:** `201 Created`
- **Body:** The newly created resource, including server-generated fields

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corporation",
  "status": "active",
  "description": "A global manufacturing company",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Key Points:**
- Return `201 Created`, not just `200 OK`. This communicates that a new resource was created
- Return the created entity in the response so the client knows the ID and any server-generated values (timestamps, default values)
- Only accept fields that the client should control. Fields like `id`, `createdAt`, and `updatedAt` should be server-generated

### List: GET Request

**Route:** `GET /organizations`

**Response:**
- **Status Code:** `200 OK`
- **Body:** A paginated list of resources

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Acme Corporation",
      "status": "active",
      "description": "A global manufacturing company",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Globex Inc",
      "status": "active",
      "description": "Technology solutions provider",
      "createdAt": "2024-01-14T08:15:00Z",
      "updatedAt": "2024-01-14T08:15:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 5
}
```

**Key Points:**
- Always implement pagination for list endpoints (more on this below)
- Return `200 OK` even for empty results. An empty list is a valid successful response
- **Never return 404 for empty lists**. 404 is for single resource requests where the specific resource doesn't exist

### Get Single: GET Request with ID

**Route:** `GET /organizations/:id`

**Response (Found):**
- **Status Code:** `200 OK`
- **Body:** The requested resource

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corporation",
  "status": "active",
  "description": "A global manufacturing company",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Response (Not Found):**
- **Status Code:** `404 Not Found`
- **Body:** Error message

```json
{
  "error": "Organization not found",
  "statusCode": 404
}
```

**Key Points:**
- Use `404 Not Found` when the client requests a specific resource that doesn't exist
- The distinction from list endpoints is crucial: lists return empty arrays, single-resource endpoints return 404

### Update: PATCH Request

**Route:** `PATCH /organizations/:id`

**Request Body:** Only the fields being updated
```json
{
  "status": "archived"
}
```

**Response:**
- **Status Code:** `200 OK`
- **Body:** The updated resource

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Acme Corporation",
  "status": "archived",
  "description": "A global manufacturing company",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T14:22:00Z"
}
```

**Key Points:**
- Use PATCH for partial updates (most common use case)
- Use PUT only when completely replacing a resource
- Return `200 OK` with the updated entity
- Return `404` if the resource doesn't exist

### PUT vs PATCH: When to Use Each

**PUT** replaces the entire resource. If you use PUT and only send `{status: "archived"}`, depending on your implementation, you might wipe out all other fields.

**PATCH** updates only the specified fields. If you send `{status: "archived"}`, only the status changes. Everything else remains intact.

In practice, PATCH is almost always what you want. PUT was more common in Multi-Page Application architectures. In modern Single-Page Applications with JSON-heavy data transfers, we typically update partial fields, making PATCH the appropriate choice.

### Delete: DELETE Request

**Route:** `DELETE /organizations/:id`

**Response:**
- **Status Code:** `204 No Content`
- **Body:** Empty

**Key Points:**
- Return `204 No Content` for successful deletion. There's nothing to return since the resource no longer exists
- If you try to delete a resource that doesn't exist, you can return `404`, but remember, DELETE is still idempotent because no side effect occurred

## Pagination: Handling Large Data Sets

Pagination is a technique used when returning lists of resources. Instead of returning every record in your database (which could be thousands or millions), you return a manageable portion at a time.

### Why Pagination Matters

Without pagination, problems compound quickly:

1. **Serialization overhead**: Converting thousands of records to JSON is CPU-intensive
2. **Network bandwidth**: Transferring massive payloads slows everything down
3. **Client performance**: The frontend struggles to render and manage huge data sets
4. **Perceived latency**: Users experience delays waiting for giant responses

With pagination, you return 10, 20, or 50 records at a time. Users see the first page instantly. If they need more, they navigate to the next page or scroll (triggering additional API calls).

### Implementing Pagination

**Request Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `page` | Which portion of data to return | `1` |
| `limit` | How many items per page | `10` or `20` |

**Example:**
```
GET /organizations?page=2&limit=20
```

This requests the second page with 20 items per page (organizations 21-40).

**Response Structure:**

```json
{
  "data": [...],
  "total": 100,
  "page": 2,
  "totalPages": 5
}
```

| Field | Description |
|-------|-------------|
| `data` | The array of resources for this page |
| `total` | Total count of all resources in the database |
| `page` | Current page number |
| `totalPages` | Total number of available pages |

### Sane Defaults for Pagination

If the client doesn't send `page` or `limit`, you should still return paginated results with sensible defaults:

- **Default page:** `1`
- **Default limit:** `10` or `20`

This means a simple `GET /organizations` request still returns a clean, paginated response rather than dumping your entire database.

## Sorting: Ordering Results

List endpoints should support sorting. Users might want organizations sorted by name alphabetically, or by creation date with the newest first.

### Implementing Sorting

**Request Parameters:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `sortBy` | Field to sort on | `createdAt` |
| `sortOrder` | Direction (`asc` or `desc`) | `desc` |

**Example:**
```
GET /organizations?sortBy=name&sortOrder=asc
```

This returns organizations sorted alphabetically by name in ascending order (A to Z).

### Default Sorting

If no sort parameters are provided, always apply a default sort. Without sorting, database results can come back in unpredictable order. The same query might return results in different orders on different calls.

**Recommended default:**
- **sortBy:** `createdAt`
- **sortOrder:** `desc`

This shows the newest resources first, which is the natural expectation for most list views.

## Filtering: Narrowing Results

Filtering allows clients to retrieve only resources matching specific criteria.

### Implementing Filtering

Use query parameters to filter by field values:

```
GET /organizations?status=active
```

This returns only organizations where `status` equals "active".

Multiple filters can be combined:

```
GET /organizations?status=active&name=Acme
```

### Filtering vs 404

A critical distinction:

**Filtering with no matches:**
- `GET /organizations?status=nonexistent`
- **Response:** `200 OK` with an empty array
```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

This is correct behavior. The filter didn't match anything, but the request was valid and successful.

**Requesting a specific resource that doesn't exist:**
- `GET /organizations/999`
- **Response:** `404 Not Found`

The difference: lists return empty results; requests for specific identified resources return 404 when that resource doesn't exist.

## Complete List Endpoint Example

Combining pagination, sorting, and filtering:

```
GET /organizations?status=active&sortBy=name&sortOrder=asc&page=2&limit=10
```

This request:
1. Filters organizations where `status` is "active"
2. Sorts results by `name` in ascending order
3. Returns page 2 with 10 items per page

**Response:**
```json
{
  "data": [
    {
      "id": "...",
      "name": "Echo Corp",
      "status": "active",
      ...
    },
    ...
  ],
  "total": 45,
  "page": 2,
  "totalPages": 5
}
```

## Custom Actions: Beyond CRUD

Not every operation fits into Create, Read, Update, or Delete. Some operations are **actions**, commands you want the server to perform that have more complex side effects.

### When to Use Custom Actions

Consider archiving an organization. You might think: "I'll just update the status field to 'archived' using PATCH."

But what if archiving an organization means:
- Deleting all projects under that organization
- Removing all tasks under those projects
- Sending notification emails to all users in the organization
- Revoking API keys associated with the organization
- Logging an audit trail

This isn't a simple update. It's a **business workflow** with multiple side effects. This is when you need a custom action.

Other examples:
- **Cloning a project:** Creates a new project with copies of all tasks
- **Sending an email:** Triggers an external action
- **Running a report:** Generates and possibly schedules data processing
- **Approving a request:** Updates status and triggers notifications

### Custom Action URL Pattern

```
POST /resources/:id/action
```

**Examples:**
- `POST /organizations/123/archive`
- `POST /projects/456/clone`
- `POST /tasks/789/complete`
- `POST /users/101/invite`

**Why POST?**
1. Custom actions are not idempotent. Archiving twice might have different effects (first succeeds, second might fail or be a no-op)
2. REST specification designates POST as open-ended for operations that don't fit other methods
3. Custom actions typically have side effects beyond simple data manipulation

### Custom Action Response Codes

The response code depends on what the action does:

**If it creates something:**
- `POST /projects/456/clone`
- **Response:** `201 Created` with the cloned project

**If it's just an action:**
- `POST /organizations/123/archive`
- **Response:** `200 OK` with the updated organization (or a success message)

Don't assume all POST requests return `201`. POST for custom actions often returns `200`.

## Status Codes: A Practical Reference

Choosing the right status code communicates clearly with API consumers without requiring them to parse the response body.

### Success Codes (2xx)

| Code | Name | When to Use |
|------|------|-------------|
| `200` | OK | General success. GET, PATCH, PUT operations that complete successfully |
| `201` | Created | POST that creates a new resource |
| `204` | No Content | DELETE or actions that succeed but have no response body |

### Client Error Codes (4xx)

| Code | Name | When to Use |
|------|------|-------------|
| `400` | Bad Request | Invalid request body, malformed JSON, validation errors |
| `401` | Unauthorized | No authentication credentials provided, or credentials are invalid |
| `403` | Forbidden | Authenticated, but lacks permission for this action |
| `404` | Not Found | Requested a specific resource that doesn't exist |
| `409` | Conflict | Request conflicts with current state (e.g., duplicate unique field) |
| `422` | Unprocessable Entity | Request was valid JSON but contained semantic errors |
| `429` | Too Many Requests | Rate limit exceeded |

### Server Error Codes (5xx)

| Code | Name | When to Use |
|------|------|-------------|
| `500` | Internal Server Error | Something unexpected went wrong on the server |
| `502` | Bad Gateway | Server received invalid response from upstream |
| `503` | Service Unavailable | Server is temporarily unable to handle requests |
| `504` | Gateway Timeout | Upstream server didn't respond in time |

### Key Distinctions

**401 vs 403:**
- **401 Unauthorized:** "I don't know who you are". Authentication failed or missing
- **403 Forbidden:** "I know who you are, but you can't do this". Authenticated but not authorized

**400 vs 422:**
- **400 Bad Request:** The request is malformed (invalid JSON, missing required fields)
- **422 Unprocessable Entity:** The request is syntactically correct but semantically invalid (email format wrong, date in the past)

## Consistency: The Hallmark of Professional APIs

Consistency isn't just about making your API "look nice". It dramatically reduces integration time, bugs, and confusion.

### Why Consistency Matters

Consider this scenario: A frontend engineer integrates your Create Organization API successfully. The payload is:

```json
{
  "name": "Acme",
  "description": "Manufacturing company"
}
```

Later, they need to create a Project. Based on their experience with Organizations, they assume:

```json
{
  "name": "Q1 Launch",
  "description": "Launch campaign for Q1"
}
```

If your Project API unexpectedly expects `desc` instead of `description`, they'll get a validation error they didn't expect. They have to check the documentation, adjust their code, and wonder where else things might be different.

This situation:
- Wastes the integrator's time
- Creates room for bugs
- Forces reliance on documentation for things that should be intuitive
- Signals that your API isn't trustworthy or professional

### Consistency Principles

#### Naming Conventions
- If you use `description` in one endpoint, use `description` everywhere, never `desc`
- Use consistent casing across all JSON payloads. **CamelCase** is the JSON standard: `createdAt`, not `created_at`
- URL paths should be **lowercase with hyphens**: `/user-profiles`, not `/UserProfiles` or `/user_profiles`

#### Response Structure
- All list endpoints should return the same structure: `{ data: [...], total, page, totalPages }`
- All single-resource endpoints should return just the object (or wrap it consistently)
- Error responses should follow a consistent format

```json
{
  "error": "Validation failed",
  "statusCode": 400,
  "details": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

#### Parameter Names
- Pagination: Always `page` and `limit`
- Sorting: Always `sortBy` and `sortOrder`
- Filtering: Use field names directly (`status`, `name`)

Once you establish a pattern, **never deviate from it** without a compelling reason.

## Sane Defaults: Reducing Client Burden

A well-designed API doesn't force clients to send obvious values. Every piece of data the client must provide is a potential source of error.

### Where Sane Defaults Apply

**Request Defaults:**
- `page: 1` if not provided
- `limit: 10` if not provided
- `sortBy: createdAt` if not provided
- `sortOrder: desc` if not provided

**Data Defaults:**
- When creating a resource, if `status` isn't provided, default to `active`
- Timestamps (`createdAt`, `updatedAt`) are always server-generated

**Why This Matters:**

To create an organization, the client could send just:
```json
{
  "name": "Acme Corporation"
}
```

The server fills in sane defaults:
- `status: "active"`
- `description: null` or `""`
- `createdAt: <current timestamp>`
- `updatedAt: <current timestamp>`

The simpler the request the client needs to make, the better the developer experience.

## Avoid Abbreviations: Clarity Over Brevity

Bandwidth is cheap. Developer confusion is expensive.

**Bad:**
```json
{
  "desc": "A description",
  "org_id": "123",
  "qty": 5
}
```

**Good:**
```json
{
  "description": "A description",
  "organizationId": "123",
  "quantity": 5
}
```

When designing your API, you have all the context. You know what `desc` means because you just wrote the database schema. But the engineer consuming your API six months from now, or a developer at a partner company who's never seen your codebase, doesn't have that context.

Make your API self-documenting. Spell things out.

## Documentation: The Swagger/OpenAPI Standard

Always provide interactive documentation for your APIs. Tools like **Swagger** (OpenAPI) generate interactive playgrounds where developers can:

- See all available endpoints
- Understand request/response schemas
- Try out API calls directly from the browser
- Generate client SDKs automatically

Interactive documentation serves three purposes:

1. **For integrators:** They can understand and test your API without reading source code
2. **For yourself:** You can test your APIs during development
3. **For future you:** Six months later, you remember how your API works

Make **Swagger/OpenAPI documentation** a non-negotiable part of your API delivery.

## Design First, Code Second

This principle bears repeating because it's easy to skip in the rush to "get things done."

Before writing any business logic:
1. Design the interface using Swagger, Insomnia, or Postman
2. Define routes, methods, payloads, and expected responses
3. Think about edge cases (empty results, not found, validation errors)
4. Consider the consumer experience

This "design-first" approach:
- Forces you to think through the API from the consumer's perspective
- Catches inconsistencies before they become bugs
- Produces better documentation naturally
- Enables parallel frontend/backend development (frontend can mock the API)

Once the interface is designed and agreed upon, implementation becomes straightforward. You're just filling in the logic behind an already-defined contract.

## Complete API Design Walkthrough

Let's design a complete API for a Project resource in our project management platform.

### Resource Schema

```
projects
├── id (UUID, server-generated)
├── name (string, required)
├── organizationId (UUID, required)
├── status (enum: 'planned' | 'active' | 'completed')
├── description (string, optional)
├── createdAt (timestamp, server-generated)
└── updatedAt (timestamp, server-generated)
```

### Endpoints

#### Create Project
```
POST /projects

Request Body:
{
  "name": "Q1 Launch Campaign",
  "organizationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "planned",
  "description": "Marketing campaign for Q1 product launch"
}

Response: 201 Created
{
  "id": "7b2f4c1a-...",
  "name": "Q1 Launch Campaign",
  "organizationId": "550e8400-...",
  "status": "planned",
  "description": "Marketing campaign for Q1 product launch",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### List Projects
```
GET /projects?organizationId=550e8400...&status=active&sortBy=name&sortOrder=asc&page=1&limit=20

Response: 200 OK
{
  "data": [...],
  "total": 45,
  "page": 1,
  "totalPages": 3
}
```

#### Get Single Project
```
GET /projects/7b2f4c1a-...

Response (Found): 200 OK
{ ... project object ... }

Response (Not Found): 404 Not Found
{
  "error": "Project not found",
  "statusCode": 404
}
```

#### Update Project
```
PATCH /projects/7b2f4c1a-...

Request Body:
{
  "status": "active"
}

Response: 200 OK
{ ... updated project object ... }
```

#### Delete Project
```
DELETE /projects/7b2f4c1a-...

Response: 204 No Content
(empty body)
```

#### Clone Project (Custom Action)
```
POST /projects/7b2f4c1a-.../clone

Request Body: (optional, for customization)
{
  "name": "Q1 Launch Campaign (Copy)"
}

Response: 201 Created
{ ... newly cloned project object ... }
```

## Summary

API design is about creating an interface that is intuitive, consistent, and delightful to use. It's not about writing code. It's about designing an experience for other developers (and often, for your future self).

The principles covered in this guide form the foundation of professional REST API design:

1. **Use plural nouns** for resource names
2. **Understand idempotency** to choose the right HTTP methods
3. **Implement pagination, sorting, and filtering** for list endpoints
4. **Use custom actions** for operations that don't fit CRUD
5. **Return appropriate status codes** that communicate clearly
6. **Be consistent**: in naming, structure, and patterns
7. **Provide sane defaults** to reduce client burden
8. **Avoid abbreviations**: explicit beats clever
9. **Document everything** with Swagger/OpenAPI
10. **Design first, code second**

When you follow these principles, you'll spend less time debugging integration issues and answering questions about how your API works. Consumers of your API will know what to expect, and your code will be easier to maintain and extend.

