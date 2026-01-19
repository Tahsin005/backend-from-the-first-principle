# What is Handlers, Services, Repositories, Middleware, and Request Context?

## Introduction

Building a production-grade backend application is fundamentally about managing complexity. As your application grows from handling a few endpoints to orchestrating hundreds of APIs serving thousands of concurrent users, the difference between success and chaos lies in your architectural decisions. This comprehensive guide explores the foundational patterns that power modern backend systems-patterns that remain consistent whether you're building with Node.js, Go, Python, Rust, or any other backend technology.

![Handlers, Services, Repositories, Middleware, and Request Context](https://miro.medium.com/v2/resize:fit:720/format:webp/1*pvJhMMEUPorrPk58HGaXrQ.png)

## The Request Lifecycle: From Client to Server

Before diving into architectural patterns, it's essential to understand the journey of an HTTP request through your server. When a client sends a request to your server, that request travels over HTTP and enters what we call the **request lifecycle**-the complete journey from the moment the request arrives until a response is sent back.

### Entry Point and Routing

The lifecycle begins when your operating system forwards an HTTP request to the specific port your server is listening on (commonly port 3000, 4000, or any configured port). This marks the **entry point** of your request into the server.

Once inside, the request encounters your **routing mechanism**. Modern servers implement sophisticated routing algorithms that map incoming requests to specific handlers based on patterns like `/users`, `/users/123`, or other dynamic routes. This routing layer acts as a traffic controller, directing each request to its designated destination.

## The Three-Layer Architecture

After routing determines where a request should go, it hands control to one of three distinct layers that work together to process the request: Handlers (or Controllers), Services, and Repositories. Understanding why we separate these concerns-rather than handling everything in a single function-is crucial for building professional-grade applications.

### Why Three Layers?

The separation into three components isn't a hard requirement imposed by any framework or language. Rather, it's a **design pattern** that emerged from years of collective experience building large-scale applications. This pattern provides several critical benefits:

- **Scalability**: Adding new features becomes easier when responsibilities are clearly defined
- **Maintainability**: Debugging and updating code is straightforward when each layer has a single purpose
- **Readability**: New developers can quickly understand the codebase structure
- **Testability**: Each layer can be tested independently

## Layer 1: Handlers (Controllers)

The Handler or Controller layer serves as the gateway between the HTTP world and your application logic. Every handler function receives at least two objects from the runtime environment:

1. **Request object**: Contains all information about the incoming HTTP request
2. **Response object**: Provides methods to construct and send responses back to the client

These objects are provided automatically by your framework or language runtime-whether you're using Go, Node.js with Express, Python with Flask or FastAPI, or any other backend framework.

### Handler Responsibilities

The Handler layer has four primary responsibilities, executed in a specific order:

#### 1. Data Extraction and Deserialization

The first task is extracting data from the request object. Depending on the HTTP method:
- **GET requests**: Extract query parameters
- **POST/PUT/PATCH requests**: Extract the request body
- **All requests**: Potentially extract path parameters, headers, or cookies

Because HTTP transmits data in serialized formats (typically JSON), the handler must **deserialize** this data into the native format of your programming language. 

The implementation varies by language:
- **Node.js/JavaScript**: Often handled by middleware like `express.json()` that runs before your handler
- **Go**: Explicitly deserialize JSON into structs
- **Python**: Deserialize into dictionaries or class instances
- **Rust**: Deserialize into structs

This process is sometimes called **binding**-binding the request body to your native data structures. If deserialization fails (malformed JSON, for example), the handler should immediately return a **400 Bad Request** response and terminate processing.

#### 2. Validation and Transformation

Once data is in a native format your programming language understands, the next critical step is **validation**. In production-grade backends, you should validate everything coming from external clients:

- Path parameters
- Query parameters  
- Request bodies
- Even headers when relevant

Be as specific as possible with validation. Don't just check if a field exists-verify its type, format, length, range, and any business rules that apply.

After validation comes **transformation**-modifying the data to make it more convenient for downstream processing. A common transformation is setting default values for optional parameters.

For example, consider a `GET /books` endpoint with an optional `sort` query parameter that accepts either "name" or "date":

```
If no sort parameter provided → Set default to "date"
If sort="name" provided → Keep as "name"
If sort="date" provided → Keep as "date"
```

This transformation means your service layer can always assume the `sort` field exists, eliminating conditional branching and making the code more predictable.

#### 3. Calling the Service Layer

With validated and transformed data ready, the handler calls the appropriate service method, passing along:
- The processed request data
- Authentication information (user ID, permissions)
- Any other context the service needs

The handler then waits for the service to complete its processing.

#### 4. Sending the Response

When the service returns, the handler's final responsibility is constructing an appropriate HTTP response. This includes:

- **Selecting the correct status code**:
  - 200 (OK) for successful GET/PUT/PATCH
  - 201 (Created) for successful POST
  - 204 (No Content) for successful DELETE
  - 400 (Bad Request) for client errors
  - 500 (Internal Server Error) for server errors

- **Formatting the response body**: Serializing your native data structures back into JSON

- **Setting appropriate headers**: Content-Type, caching headers, etc.

The controller layer truly "controls" the data flow-it manages the complete journey from receiving client data to sending back a response.

### A Critical Design Principle

Here's an important pattern to remember: **All HTTP-related concerns should stay in the Handler layer**. Your handlers should be the only place in your codebase that directly deals with request and response objects, status codes, and HTTP-specific logic. This isolation becomes crucial when we examine the service layer.

## Layer 2: Services

The Service layer is where the actual business logic lives. This is the brain of your application-where decisions are made, calculations performed, and workflows orchestrated.

### Service Layer Philosophy

A well-designed service method should be **agnostic to how it's being called**. If you look at a service method, you shouldn't be able to tell whether it's being used in a REST API, a GraphQL endpoint, a command-line tool, or a background job. It's just a function that:

1. Takes input parameters
2. Performs operations
3. Returns output

This isolation provides enormous flexibility. The same service method can be reused in different contexts without modification.

### Service Responsibilities

The service layer handles diverse responsibilities:

- **Orchestrating repository calls**: A single service method might call multiple repository methods, combining their results
- **Implementing business logic**: Calculations, decision trees, workflow state management
- **External integrations**: Calling third-party APIs
- **Sending communications**: Emails, push notifications, SMS
- **Data transformation**: Merging data from multiple sources into a unified response

Not all service methods interact with the database. A service method might only send an email, in which case it would:

1. Receive the email address and content
2. Execute the email-sending logic
3. Return a simple success response like `{success: true}`

### Services and Repositories

When a service needs to interact with the database, it delegates that responsibility to the Repository layer. The service constructs the requirements (what data to fetch, what filters to apply) and passes them to the appropriate repository method.

## Layer 3: Repositories (Database Layer)

The Repository layer has the most focused responsibility: it serves as the interface between your application and the database.

### Repository Responsibilities

A repository method:

1. **Receives data requirements** from the service layer (what to insert, what filters to apply for queries)
2. **Constructs database queries** using the provided parameters
3. **Executes the query** against the database
4. **Returns the raw results** back to the service layer

### The Single Responsibility Principle

Repository methods should follow a strict single-responsibility principle: **one method, one type of operation, one return type**.

Consider these examples:

**Good design**:
```
getBookById(id) → Returns a single book object
getAllBooks(filters) → Returns an array of book objects
```

**Poor design**:
```
getBooks(id?) → Returns either a single book OR array of books depending on whether id is provided
```

The poor design creates ambiguity and forces the service layer to handle conditional logic based on what might be returned. Keep repository methods predictable and single-purpose.

### Repository Method Composition

While each repository method should do one thing, a service method can call multiple repository methods and combine their results. This is part of the orchestration responsibility of the service layer.

For example, a service method for getting a user profile might:

1. Call `getUserById()` to get basic user data
2. Call `getUserPosts()` to get their recent posts  
3. Call `getUserFollowerCount()` to get follower statistics
4. Merge all three results into a comprehensive profile object
5. Return the merged data to the handler

## The Complete Request Flow

Let's trace a complete request through all three layers using a practical example: `GET /books?sort=name`

### Step 1: Handler (Controller) Entry
- Request arrives with query parameter `sort=name`
- Handler extracts query parameters
- If this were a POST, it would deserialize the JSON body into native structures

### Step 2: Validation
- Handler validates that `sort` parameter, if present, is either "name" or "date"
- Validation passes

### Step 3: Transformation
- No transformation needed since sort was provided
- If sort was missing, handler would set default: `sort="date"`

### Step 4: Service Call
- Handler calls: `bookService.getAllBooks({sort: "name"})`
- Passes along any authentication context

### Step 5: Service Processing
- Service receives the sort parameter
- Calls repository: `bookRepository.findAll({sortBy: "name"})`

### Step 6: Repository Execution
- Repository constructs SQL query: `SELECT * FROM books ORDER BY name ASC`
- Executes query
- Returns array of book objects to service

### Step 7: Service Return
- Service receives book array from repository
- Potentially performs additional transformations or calculations
- Returns book array to handler

### Step 8: Response Construction
- Handler receives book array from service
- Determines appropriate status code: 200 OK
- Serializes book array back to JSON
- Sends response to client

If any error occurred at any step, the handler would catch it, determine the appropriate error code (400 for client errors, 500 for server errors), and send an error response.

## Benefits of This Architecture

### Separation of Concerns

Each layer has a clear, focused responsibility:
- **Handlers**: HTTP protocol and data format concerns
- **Services**: Business logic and orchestration
- **Repositories**: Database operations

This separation means changes to one layer rarely require changes to others.

### Reusability

Service methods can be called from multiple handlers-REST endpoints, GraphQL resolvers, background jobs, CLI commands. You write the business logic once.

### Testability

Each layer can be tested in isolation:
- Test handlers with mock services
- Test services with mock repositories  
- Test repositories with a test database

### Maintainability

When a bug appears, the architecture guides you to the right layer:
- Data format issues → Check the handler
- Business logic bugs → Check the service
- Query problems → Check the repository

### Scalability

Adding new features follows established patterns. New endpoints need a handler, which calls a service, which might need repository methods. The pattern is consistent and predictable.

## Language and Framework Agnostic

While implementation details vary, this three-layer pattern appears across the backend ecosystem:

- **Go**: Handlers unmarshal JSON into structs, services contain business logic, repositories use database/sql or an ORM
- **Node.js**: Express handlers use middleware for parsing, services are plain functions, repositories use Sequelize, TypeORM, or Prisma
- **Python**: FastAPI/Flask handlers use Pydantic for validation, services contain business logic, repositories use SQLAlchemy or Django ORM
- **Rust**: Handlers deserialize with Serde, services are regular functions, repositories use Diesel or SQLx

The pattern transcends specific technologies because it addresses universal concerns in backend development.

## Best Practices and Guidelines

### Handler Layer
- Keep handlers thin-they should primarily coordinate, not contain business logic
- Always validate input before passing to services
- Be consistent with status codes across your API
- Handle errors gracefully and return meaningful error messages

### Service Layer
- Keep services independent of HTTP concerns
- Make services testable without running a web server
- Document complex business logic clearly
- Consider service methods as reusable building blocks

### Repository Layer  
- One method, one operation type, one return type
- Keep queries optimized and use indexes appropriately
- Consider using query builders or ORMs for complex queries
- Never put business logic in repository methods

### General Architecture
- Make query parameters optional when possible-it's a better API design pattern
- Set sensible defaults in the transformation layer
- Use consistent naming conventions across all layers
- Document the flow for complex operations

## Common Pitfalls to Avoid

**Mixing responsibilities**: Putting business logic in handlers or HTTP concerns in services breaks the separation and reduces reusability.

**Overly complex repository methods**: If a repository method is doing calculations or complex transformations, that logic belongs in the service layer.

**Skipping validation**: Always validate external input, even if you trust your client application.

**Inconsistent error handling**: Establish patterns for how errors flow up from repositories through services to handlers.

**Not considering the pattern optional**: While this is best practice for most applications, very simple applications might not need this separation. Use judgment based on your project's scale and complexity.


## Middleware and Request Context: The Complete Request Lifecycle

Having established the Handler-Service-Repository pattern, we now turn to two critical components that complete the picture of backend architecture: **middleware** and **request context**. These concepts transform our understanding of the request lifecycle from a linear flow through three layers into a more sophisticated pipeline with multiple checkpoints and shared state.

## Visualizing the Complete Request Lifecycle

Let's revisit the request lifecycle, this time incorporating middleware into our mental model. When a client sends a request to your server:

1. The operating system forwards the request to your server's listening port (the **entry point**)
2. The request passes through **multiple middleware functions** before routing
3. The **routing algorithm** matches the request to a handler
4. More **middleware functions** can execute after routing
5. The **Handler-Service-Repository** layers process the request
6. Additional **middleware** can execute before sending the response
7. Finally, the **response** returns to the client

Each boundary between these steps represents a potential middleware execution point. Think of middleware as checkpoints along a highway-the request must pass through each one in sequence before reaching its final destination.

## What Are Middleware Functions?

Middleware functions are exactly what their name suggests: functions that execute in the **middle** of your request lifecycle. They sit between:

- The entry point and routing
- Routing and your handlers
- Your handlers and the response

But middleware are more than just functions placed strategically in your pipeline-they have special capabilities that distinguish them from regular handlers.

### The Three Parameters of Middleware

While regular handlers receive two parameters (request and response), middleware functions receive **three parameters** from the runtime environment:

1. **Request object**: Contains all information about the incoming HTTP request
2. **Response object**: Provides methods to construct and send responses
3. **Next function**: A special function that passes execution to the next middleware or handler

This `next()` function is the key to understanding middleware. It creates a chain of execution, allowing the request to flow through multiple processing stages.

### How Next() Works

The `next()` function passes control from one execution context to another. When a middleware calls `next()`:

- If another middleware exists in the chain, execution moves to that middleware
- If no more middleware exists, execution moves to the routing layer
- After routing, execution can move to handler-specific middleware
- Eventually, execution reaches your handler

Importantly, we don't always call it "next middleware" because `next()` might pass control to:
- Another middleware function
- The routing algorithm
- A handler function
- An error handler

The `next()` function simply moves to whatever comes next in the processing pipeline.

## The Power and Responsibility of Middleware

Because middleware receives both request and response objects, it has significant capabilities:

### What Middleware Can Do

1. **Read data from the request**: Extract headers, query parameters, body data, cookies, etc.
2. **Modify the request object**: Add new properties, transform data, inject context
3. **Modify the response object**: Set headers, modify the response body
4. **Send a response immediately**: Return data to the client without calling `next()`
5. **Terminate the request**: End processing and prevent the request from reaching handlers
6. **Pass execution forward**: Call `next()` to continue the pipeline

The ability to send a response and terminate the request is particularly powerful. A middleware can intercept a request early in the lifecycle and return an error response before any expensive operations occur. This protects your server resources and improves performance.

## Why Use Middleware?

The answer parallels why we use functions in programming: **to eliminate code duplication**.

### The Problem Without Middleware

Consider a backend application receiving thousands, millions, or even billions of requests daily. You might have hundreds or thousands of API endpoints, each with its own handler. Without middleware, you would need to:

- Duplicate authentication logic in every handler
- Duplicate logging logic in every handler
- Duplicate security checks in every handler
- Duplicate data parsing in every handler

Even if you extracted this logic into reusable functions, you would still need to call those functions explicitly in every handler. This creates maintenance burdens and opportunities for inconsistency.

### The Solution: Middleware

Middleware allows you to define common operations once and apply them automatically to all (or specific) routes. Instead of remembering to call an authentication function in every handler, you configure authentication middleware once, and it executes for every relevant request.

This approach:
- **Reduces code duplication**: Write the logic once
- **Ensures consistency**: Every request goes through the same checks
- **Simplifies maintenance**: Update logic in one place
- **Improves reliability**: No risk of forgetting to add checks to new endpoints
- **Preserves server resources**: Reject invalid requests early in the pipeline

## The Critical Importance of Middleware Order

Middleware execute in a specific sequence, and **order matters immensely**. The request flows through middleware in the order they're defined, like water flowing through a series of filters.

Consider this order:

1. CORS middleware
2. Logging middleware
3. Authentication middleware
4. Rate limiting middleware
5. Handler execution
6. Global error handling middleware

This ordering is intentional. Each middleware builds on or depends on the previous ones.

### Why CORS Comes First

CORS (Cross-Origin Resource Sharing) middleware typically executes first because you want to identify unauthorized origins as early as possible. If a request comes from a domain you don't allow, there's no point in:

- Logging detailed information
- Performing authentication
- Checking rate limits
- Executing handlers

Terminate the request immediately and save server resources.

### Why Error Handling Comes Last

Global error handling middleware should be the **last** middleware in your chain. Here's why:

Errors can occur at any point in your request lifecycle:
- In CORS middleware
- In authentication middleware
- In your handler
- In your service layer
- In your repository

If error handling middleware is positioned in the middle of the chain, it won't catch errors that occur after it has already executed. The request flows one way-you can't go backward to catch errors that happened later.

By placing error handling last, you create a safety net that catches all errors, regardless of where they originated.

## Common Middleware Types and Use Cases

Let's explore the most common middleware types found in production backend applications.

### Security Middleware

#### CORS Middleware

CORS is a browser security mechanism that restricts web applications from accessing resources outside their origin. For example, a frontend running on `example.com` cannot access resources from `api.other-domain.com` unless the API explicitly allows it.

**How CORS middleware works:**

1. Receives the request
2. Extracts the `Origin` header (automatically provided by the browser)
3. Checks if the origin is in your allowed list
4. If allowed: Adds appropriate response headers (`Access-Control-Allow-Origin`, etc.)
5. If not allowed: Either sends no special headers (letting the browser block) or sends an explicit rejection
6. Calls `next()` to continue processing

**Why it's middleware:**
- Needs to execute for every request
- Operates on request and response objects
- Same logic applies across all endpoints

#### Security Headers Middleware

This middleware adds security-related HTTP headers to every response:

- `Content-Security-Policy`: Controls what resources the browser can load
- `X-Content-Type-Options`: Prevents MIME type sniffing
- `X-Frame-Options`: Prevents clickjacking attacks
- `Strict-Transport-Security`: Enforces HTTPS

These headers should be present on every response, making this perfect middleware material.

#### Authentication Middleware

Authentication middleware verifies the identity of the requester. A typical flow:

1. Extract the authentication token (JWT, session ID, API key) from the request
2. Verify the token's validity
3. **On failure**: Immediately return `401 Unauthorized` without calling `next()`
4. **On success**: Extract user information (ID, role, permissions)
5. Store this information in the **request context** (more on this shortly)
6. Call `next()` to continue processing

**Why it's middleware:**
- Most endpoints require authentication
- Avoids duplicating token verification logic
- Can terminate requests early if authentication fails
- Enriches the request with user context for downstream use

#### Rate Limiting Middleware

Rate limiting prevents abuse by restricting how many requests a client can make in a given timeframe.

**Implementation approach:**

1. Identify the client (typically by IP address)
2. Check how many requests this client made recently (e.g., in the last minute)
3. Compare against your threshold (e.g., 30 requests per minute)
4. **If exceeded**: Return `429 Too Many Requests` without calling `next()`
5. **If within limits**: Increment the counter and call `next()`

**Why it's middleware:**
- Protects all endpoints uniformly
- Prevents resource exhaustion
- Catches abuse attempts before they reach expensive operations

### Operational Middleware

#### Logging and Monitoring Middleware

Every HTTP request should be logged for debugging, auditing, and analytics. Logging middleware captures:

- Request method (GET, POST, etc.)
- Request path and query parameters
- Request body (sanitized to remove sensitive data)
- Client IP address
- Timestamp
- Response status code
- Response time

This middleware executes for every request and logs to your terminal, log files, or external logging services.

**Why it's middleware:**
- Universal requirement across all endpoints
- Should not be the handler's concern
- Needs consistent formatting

#### Compression Middleware

For large JSON responses with thousands of fields, compression middleware applies algorithms like gzip to reduce the response size before transmission.

Modern browsers automatically decompress gzip responses, so:

1. Your server sends compressed data (smaller, faster transfer)
2. The browser receives and decompresses it
3. The client application receives the full JSON

**Why it's middleware:**
- Benefits all endpoints that return large payloads
- Transparent to handlers
- Configured once, applied everywhere

#### Global Error Handling Middleware

This is one of the most critical middleware components in any production application. Its purpose: catch all errors that occur anywhere in your application and return properly structured error responses.

**How it works:**

1. Positioned as the **last middleware** in the chain
2. Catches any errors thrown during the request lifecycle
3. Examines the error to determine if it's a client error (400-series) or server error (500-series)
4. Formats a consistent error response with:
   - Status code
   - Error message
   - Error code or ID (for frontend handling)
5. Sends the structured error response to the client

**Why order matters:**

If you place error handling middleware in the middle of your chain, it can only catch errors that occurred before it. Errors in handlers or later middleware would crash the application instead of being caught and handled gracefully.

**Error structure example:**

```
{
  "status": 400,
  "message": "Invalid email format",
  "code": "INVALID_EMAIL",
  "requestId": "abc-123-def-456"
}
```

This consistency makes frontend error handling much easier-every error follows the same structure.

### Data Processing Middleware

#### Serialization and Deserialization Middleware

Some frameworks and languages implement serialization/deserialization as middleware. For example, in Node.js with Express, `express.json()` is middleware that:

1. Reads the request body
2. Parses JSON into JavaScript objects
3. Attaches the parsed object to `req.body`
4. Calls `next()`

This means handlers don't need to parse JSON manually-it's already done.

#### Validation and Transformation Middleware

Depending on your architecture, you might implement validation and transformation as middleware instead of in handlers. This middleware would:

1. Validate incoming request data against schemas
2. Transform data (set defaults, normalize formats)
3. **On validation failure**: Return `400 Bad Request` without calling `next()`
4. **On success**: Attach validated/transformed data to the request and call `next()`

This approach further thins your handler layer, but whether to use this pattern depends on your team's preferences and application requirements.

## Request Context: Shared State Across the Pipeline

Now we come to a crucial concept that ties middleware and handlers together: **request context**.

### What Is Request Context?

Request context is a storage mechanism or state container that:

1. Is **scoped to a single request**: Each incoming request gets its own isolated context
2. Is **accessible throughout the request lifecycle**: All middleware and handlers can read and write to it
3. Is **automatically cleaned up**: After the response is sent, the context is garbage collected

Think of it as a shared notebook that travels with the request through the entire pipeline. Any middleware or handler can write notes in it, and any subsequent middleware or handler can read those notes.

### Why Request Context Exists

Without request context, how would you pass data from one middleware to a downstream handler?

**Poor solutions:**
- Store data globally (causes race conditions with concurrent requests)
- Modify the request object directly (pollutes the standard interface)
- Pass data as function parameters (tightly couples components)

**The request context solution:**

A request context provides a clean, isolated storage mechanism where components can share data without direct coupling.

### Common Use Cases for Request Context

#### Storing Authentication Information

This is the most common use case. Let's trace it through the pipeline:

1. **Authentication middleware** executes:
   - Verifies the JWT token
   - Extracts user ID: `12345`
   - Extracts user role: `admin`
   - Extracts permissions: `["read", "write", "delete"]`
   - **Stores this in request context**: `context.set("userId", 12345)`, `context.set("role", "admin")`
   - Calls `next()`

2. **Handler** executes later:
   - Needs to know who made the request
   - **Reads from context**: `userId = context.get("userId")`
   - Uses this userId to create a database record: `INSERT INTO books (title, author, user_id) VALUES (?, ?, ?)`

**Why this matters:**

You should **never** trust user-provided data for authentication information. If a client sends `{userId: 12345, bookTitle: "..."}` in the request body, a malicious user could change the userId to someone else's ID and create records under their name.

Instead:
- The authentication middleware determines the user ID from the verified token
- This verified ID is stored in the context
- Handlers use the context value, not the client-provided value

This prevents impersonation attacks.

#### Storing Request IDs for Tracing

Early in the middleware chain, you can generate a unique identifier for each request:

1. **Request ID middleware** executes:
   - Generates a UUID: `abc-123-def-456`
   - Stores in context: `context.set("requestId", "abc-123-def-456")`
   - Calls `next()`

2. **All subsequent middleware and handlers**:
   - Read the request ID from context
   - Include it in all log messages
   - Include it in calls to external services
   - Include it in error responses

**Benefits:**

When debugging issues, you can search your logs for this request ID and see the complete journey of a single request across:
- Multiple log entries
- Multiple services (in microservice architectures)
- Error tracking systems
- Performance monitoring tools

This makes debugging dramatically easier.

#### Storing Cancellation Signals and Deadlines

Request context can also carry cancellation signals and timeout deadlines. If a client disconnects or a request times out, you can:

1. Signal cancellation through the context
2. All downstream operations check the context
3. Operations abort early if cancellation is signaled

This prevents your server from continuing expensive operations for requests that no one is waiting for anymore.

### How Request Context Is Implemented

The implementation varies by language and framework:

**Node.js/Express:**
- Often manually attached to the `req` object: `req.context = {}`
- Libraries like `cls-hooked` provide true async context

**Go:**
- First-class `context.Context` type built into the standard library
- Passed explicitly as the first parameter to functions
- Supports cancellation, deadlines, and key-value storage

**Python:**
- Context variables in `contextvars` module
- Framework-specific implementations (FastAPI, Flask)

**Rust:**
- Various crates provide context-like functionality
- Often implemented as request extensions

Despite implementation differences, the concept remains the same: isolated, request-scoped storage accessible throughout the request lifecycle.

## The Decoupling Advantage

Request context keeps your system loosely coupled. Consider the alternative:

**Without context:**
```
authenticateMiddleware → handler(userId, userRole, permissions)
```
The handler's signature must include all these parameters, creating tight coupling.

**With context:**
```
authenticateMiddleware → context.set("user", {...}) → handler()
```
The handler accesses what it needs from context without changing its signature.

This means:
- Middleware can add new context values without changing handler signatures
- Handlers can access context values without depending on specific middleware
- Testing is easier-you can populate context with mock data

## Best Practices for Middleware and Context

### Middleware Best Practices

1. **Keep middleware focused**: Each middleware should have a single, clear responsibility
2. **Order matters**: Think carefully about execution sequence
3. **Document dependencies**: If one middleware depends on another, document it
4. **Handle errors gracefully**: Don't let middleware crash; catch errors and pass them to error handling
5. **Be selective**: Not every route needs every middleware-apply middleware strategically
6. **Call next() or respond**: Always either call `next()` or send a response; never do both

### Request Context Best Practices

1. **Use consistent keys**: Standardize context key names across your application
2. **Document context values**: Make it clear what each middleware adds to context
3. **Don't overuse**: Only store data that multiple components genuinely need
4. **Clean, typed access**: Use helper functions or types to access context safely
5. **Security-sensitive data**: Be especially careful with authentication information

## A Complete Request Lifecycle Example

Let's trace a single request through the complete lifecycle:

**Request:** `POST /books` with JSON body and JWT token

1. **Entry point**: OS forwards request to server port 3000

2. **CORS middleware**:
   - Checks origin header
   - Origin is allowed
   - Adds `Access-Control-Allow-Origin` header
   - Calls `next()`

3. **Logging middleware**:
   - Generates request ID: `req-789`
   - Stores in context: `context.set("requestId", "req-789")`
   - Logs: "POST /books - req-789 - Started"
   - Calls `next()`

4. **Authentication middleware**:
   - Extracts JWT from Authorization header
   - Verifies JWT signature
   - Extracts userId: `42`, role: `user`
   - Stores in context: `context.set("userId", 42)`, `context.set("role", "user")`
   - Calls `next()`

5. **Rate limiting middleware**:
   - Checks requests from IP 192.168.1.100
   - Count: 15 requests in last minute (under limit of 30)
   - Increments counter
   - Calls `next()`

6. **Routing**:
   - Matches `POST /books` to `createBookHandler`
   - Forwards to handler

7. **Handler (createBookHandler)**:
   - Deserializes JSON body into book object
   - Validates book data
   - Reads userId from context: `userId = context.get("userId")`
   - Calls service: `bookService.createBook(bookData, userId)`

8. **Service layer**:
   - Implements business logic
   - Calls repository: `bookRepository.insert(book)`

9. **Repository layer**:
   - Constructs SQL: `INSERT INTO books (title, author, user_id) VALUES (?, ?, ?)`
   - Executes query
   - Returns created book object

10. **Back to service**:
    - Returns book object to handler

11. **Back to handler**:
    - Receives book object
    - Sets status code: 201 Created
    - Serializes book to JSON
    - Sends response

12. **Logging middleware** (on response):
    - Logs: "POST /books - req-789 - Completed - 201 - 45ms"

13. **Response sent** to client

14. **Context cleanup**: Request context is garbage collected

If any error had occurred at any point, the error handling middleware would have caught it, formatted an appropriate error response, and sent it to the client.

## Conclusion

Middleware and request context are essential patterns that complete our understanding of backend architecture. Together with the Handler-Service-Repository pattern, they provide:

**Middleware provides:**
- Code reuse across all endpoints
- Early request termination for invalid requests
- Consistent security, logging, and operational concerns
- A pipeline architecture that's easy to reason about

**Request context provides:**
- Shared state without tight coupling
- Secure propagation of authentication information
- Request tracing across distributed systems
- Cancellation and deadline management

These patterns have become universal in backend development because they solve real problems that emerge at scale. When your application handles thousands of requests across hundreds of endpoints, you need these abstractions to maintain sanity, security, and performance.

Understanding these concepts transforms you from someone who can write individual API handlers into someone who can architect complete, production-grade backend systems. The patterns discussed here-handlers, services, repositories, middleware, and request context-form the foundation of modern backend development, regardless of whether you're working with Node.js, Go, Python, Rust, or any other backend technology.

Master these patterns, and you'll find yourself equipped to build scalable, maintainable backend applications that can grow from handling dozens of requests to handling millions, all while remaining comprehensible and reliable.