# What is API Routing in Backend?

## Introduction

In our previous discussion about HTTP methods, we explored how GET, POST, PUT, PATCH, and DELETE express the **intent** of a request—the "what" you want to accomplish. But intent alone isn't enough. The server also needs to know **where** you want to perform that action. This is where routing comes into play.

If HTTP methods describe the **what** of a request, routing describes the **where**. Together, they form a complete instruction set that the server uses to map requests to the appropriate handlers and business logic.

![Routing](https://miro.medium.com/v2/resize:fit:1100/format:webp/1*QksY4G8IGG8al3sMovCCDA.png)

## What is Routing?

At its core, **routing is the process of mapping URL patterns to server-side logic**. When a client sends a request, the server examines two key components:

1. **The HTTP method** (GET, POST, PUT, DELETE, etc.)
2. **The route path** (the URL or endpoint)

The combination of these two elements acts as a unique key that the server uses to determine which handler should process the request.

### A Simple Example

Consider this request:

```
GET /api/users
```

Here's what happens:

- **Method**: GET (the client wants to fetch data)
- **Route**: `/api/users` (the resource being accessed)
- **Result**: The server maps this combination to a handler that retrieves and returns an array of users

The route tells the server which resource you're interested in, while the method indicates what action you want to perform on that resource. The server combines these two pieces of information to execute the appropriate business logic—database queries, authentication checks, data transformations—and returns the response.

## Static Routes: The Foundation

The simplest form of routing is the **static route**, where the URL path contains no variable components.

### Characteristics of Static Routes

Static routes are called "static" because:

- They contain no variable parameters
- The path string remains constant across all requests
- They always map to the same handler
- They typically return the same type of response

### Examples

```
GET /api/books
```

This static route always:
- Uses the exact path `/api/books`
- Returns a list of books
- Maps to the same handler regardless of when it's called

```
POST /api/books
```

Notice that while the path is identical to the GET request above, the different HTTP method makes this a **distinct route**. The server treats `GET /api/books` and `POST /api/books` as two separate endpoints:

- `GET /api/books` retrieves the book list
- `POST /api/books` creates a new book

This demonstrates an important principle: **the method and path together form a unique routing key**. These two routes will never clash because the HTTP method differentiates them.

## Dynamic Routes: Handling Variable Data

While static routes work well for collections and fixed endpoints, real-world applications often need to work with specific resources identified by IDs or other unique identifiers. This is where **dynamic routes** become essential.

### Path Parameters

Consider this request:

```
GET /api/users/123
```

Here, `123` represents a user ID. Rather than creating a separate route for every possible user ID (which would be impossible), we use a **path parameter** to capture this dynamic value.

### Server-Side Route Matching

In the server code, dynamic routes are defined using a special syntax. While different frameworks may vary slightly, the industry-standard convention uses a colon (`:`) to denote dynamic parameters:

```javascript
router.get('/api/users/:id', handlerFunction);
```

This pattern works across virtually all backend frameworks—Node.js, Python, Java, Go, Rust—the colon convention is universally recognized.

### How Matching Works

When the server receives `GET /api/users/123`, it:

1. Checks the HTTP method (GET)
2. Matches the pattern `/api/users/:id`
3. Extracts `123` as the value of the `id` parameter
4. Passes this value to the handler
5. The handler uses this ID to query the database and return user details

### Semantic Readability

Dynamic routes with path parameters create human-readable, semantic URLs:

```
GET /api/users/123
```

This URL reads naturally: "Get me the user with ID 123." This readability is one of the core principles of REST API design—URLs should be intuitive and self-documenting.

### Path Parameters vs. Route Parameters

These terms are often used interchangeably:

- **Path parameters**: Emphasizes that the parameter is part of the URL path
- **Route parameters**: Emphasizes that the parameter is part of the route definition

Both refer to the same concept: dynamic segments in the URL path that come after a forward slash and are extracted by the server.

## Query Parameters: Sending Additional Data

While path parameters handle resource identification, **query parameters** serve a different purpose: sending additional metadata or options with a request.

### The Syntax

Query parameters appear after a question mark (`?`) in the URL and consist of key-value pairs:

```
GET /api/search?query=some+value
```

Breaking this down:
- **Route**: `/api/search`
- **Query parameter**: `query=some+value`

Multiple query parameters are separated by ampersands (`&`):

```
GET /api/books?page=2&limit=20&sort=desc
```

### Why Query Parameters?

The primary use case for query parameters stems from a REST API principle: **GET requests should not have a request body**. When you need to send data with a GET request, query parameters provide the solution.

#### Path Parameters vs. Query Parameters

**When to use path parameters:**
- Identifying specific resources
- Creating semantic, readable URLs
- Essential parts of the resource location

Example: `/api/users/123` - The ID is fundamental to identifying which user

**When to use query parameters:**
- Filtering results
- Pagination options
- Sorting preferences
- Search terms
- Optional metadata

Example: `/api/books?page=2&sort=title&order=asc`

### Practical Example: Pagination

Consider an API that returns paginated book data:

**Initial Request:**
```
GET /api/books
```

**Response:**
```json
{
  "data": [
    {"id": 1, "title": "Book 1"},
    {"id": 2, "title": "Book 2"},
    // ... 18 more books
  ],
  "metadata": {
    "total": 100,
    "currentPage": 1,
    "totalPages": 5,
    "limit": 20
  }
}
```

The server defaults to page 1 with 20 items. To fetch the next page:

**Subsequent Request:**
```
GET /api/books?page=2
```

The client uses the metadata from the response to construct subsequent requests, passing the desired page number as a query parameter.

### Common Query Parameter Use Cases

1. **Pagination**: `?page=3&limit=50`
2. **Filtering**: `?category=fiction&author=Smith`
3. **Sorting**: `?sort=price&order=desc`
4. **Searching**: `?query=javascript&type=books`
5. **Date ranges**: `?startDate=2024-01-01&endDate=2024-12-31`

### Why Not Use Path Parameters for Everything?

While technically possible to use path parameters for options like this:

```
GET /api/search/some-value
```

This approach has significant drawbacks:

1. **Poor semantics**: `/api/search/javascript` doesn't clearly communicate that "javascript" is a search term
2. **Maintainability**: Adding more options becomes unwieldy: `/api/search/javascript/books/desc`
3. **Flexibility**: Query parameters can be optional; path parameters typically cannot
4. **REST principles**: Defeats the purpose of self-documenting, semantic URLs

Query parameters maintain clean, readable URLs while providing flexibility for optional data.

## Nested Routes: Expressing Relationships

**Nested routes** reflect the hierarchical relationships between resources, creating semantic URLs that express these connections clearly.

### Basic Nesting

Each level of nesting represents a different semantic meaning:

**Level 1: Collection**
```
GET /api/users
```
Returns: All users

**Level 2: Specific Resource**
```
GET /api/users/123
```
Returns: User with ID 123

**Level 3: Related Collection**
```
GET /api/users/123/posts
```
Returns: All posts by user 123

**Level 4: Specific Related Resource**
```
GET /api/users/123/posts/456
```
Returns: Post 456 by user 123

### How It Works

Each segment adds specificity and meaning:

1. `/api/users` - Static route, matches a handler that returns all users
2. `/api/users/123` - Dynamic route with one parameter, matches a different handler for a specific user
3. `/api/users/123/posts` - Combines static and dynamic segments, accesses a user's posts
4. `/api/users/123/posts/456` - Two dynamic parameters, accesses a specific post from a specific user

### Server-Side Matching

On the server, these are typically defined as distinct routes:

```javascript
router.get('/api/users', getAllUsers);
router.get('/api/users/:userId', getUser);
router.get('/api/users/:userId/posts', getUserPosts);
router.get('/api/users/:userId/posts/:postId', getUserPost);
```

Each route maps to a different handler, even though they share common path segments.

### Semantic Expression

Nested routes create URLs that read like natural language:

```
GET /api/users/123/posts/456
```

Reads as: "Get post 456 from user 123"

This semantic clarity is invaluable for:
- **API documentation**: URLs are self-documenting
- **Developer experience**: Intent is immediately clear
- **Debugging**: Issues are easier to trace
- **Maintenance**: Code is more intuitive

### Practical Applications

Nested routes commonly represent:

- **Ownership**: `/users/123/settings`
- **Categories**: `/categories/5/products`
- **Hierarchies**: `/departments/10/teams/3/members`
- **Relationships**: `/authors/42/books/7/reviews`

### When to Use Nesting

**Good nesting** (clear relationships):
```
/users/123/orders/456
/projects/789/tasks/101
```

**Avoid over-nesting** (becomes unwieldy):
```
/companies/1/departments/2/teams/3/members/4/projects/5
```

Generally, limit nesting to 2-3 levels for maintainability. Deeper relationships might be better served by separate endpoints with query parameters.

## Route Versioning: Managing API Evolution

APIs evolve over time. New requirements emerge, data structures change, and business logic adapts. **Route versioning** provides a structured way to manage these changes without breaking existing clients.

### The Problem

Imagine you have an API endpoint:

```
GET /api/products
```

**Original Response (Version 1):**
```json
{
  "data": [
    {"id": 1, "name": "Product A", "price": 99.99},
    {"id": 2, "name": "Product B", "price": 149.99}
  ]
}
```

Later, requirements change. Your mobile app needs a different structure:

**New Response (Version 2):**
```json
{
  "data": [
    {"id": 1, "title": "Product A", "price": 99.99},
    {"id": 2, "title": "Product B", "price": 149.99}
  ]
}
```

Notice the field changed from `name` to `title`. If you simply update the endpoint, all existing clients using `name` will break.

### The Solution: Versioning

Instead of changing the existing endpoint, you create versioned routes:

```
GET /api/v1/products  (returns data with "name")
GET /api/v2/products  (returns data with "title")
```

### Benefits of Route Versioning

1. **Backward Compatibility**: Existing clients continue working with v1
2. **Clear Intent**: Version numbers clearly communicate API iterations
3. **Graceful Migration**: Clients can upgrade when ready
4. **Deprecation Strategy**: Old versions can be phased out systematically

### The Deprecation Workflow

When releasing a new version:

1. **Announce**: Notify frontend teams that v2 is available
2. **Migration Window**: Give teams time to update their code (e.g., 3 months)
3. **Support Both**: Run v1 and v2 simultaneously during the transition
4. **Deprecate**: After the window, mark v1 as deprecated
5. **Remove**: Eventually remove v1 entirely
6. **Promote**: V2 becomes the standard (or even renamed to v1)

### Common Versioning Patterns

**URL Path Versioning** (most common):
```
/api/v1/users
/api/v2/users
```

**Header Versioning**:
```
GET /api/users
Accept: application/vnd.myapi.v2+json
```

**Subdomain Versioning**:
```
https://api-v1.example.com/users
https://api-v2.example.com/users
```

URL path versioning is the most widely used because it's:
- Visible and explicit
- Easy to test and debug
- Simple to implement
- Clear in documentation

### Best Practices

- **Semantic Versioning**: Use major versions (v1, v2) for breaking changes
- **Document Changes**: Clearly communicate what changed between versions
- **Set Timelines**: Define how long old versions will be supported
- **Monitor Usage**: Track which versions clients use to plan deprecation
- **Avoid Over-Versioning**: Don't create new versions for minor, non-breaking changes

## Catch-All Routes: Graceful Error Handling

A **catch-all route** acts as a safety net, handling requests that don't match any defined routes.

### The Problem

When a client requests a non-existent endpoint:

```
GET /api/v3/products
```

If your server only supports v1 and v2, this request won't match any route. Without a catch-all, the server might:
- Return a generic 404 with no context
- Return null or empty response
- Crash (in poorly designed systems)

### The Solution

After defining all specific routes, add a catch-all route at the end:

```javascript
// All specific routes defined above...

// Catch-all route (must be last)
router.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The endpoint ${req.path} does not exist`,
    availableEndpoints: ['/api/v1/products', '/api/v2/products']
  });
});
```

### How It Works

The catch-all route uses a wildcard (`*`) that matches any path. Because route matching typically happens in order, the catch-all is placed last. Any request that reaches this point hasn't matched a specific route, so it's treated as a 404.

### User-Friendly Error Responses

Instead of a cryptic error, provide helpful information:

```json
{
  "error": "Route not found",
  "message": "The endpoint /api/v3/products does not exist",
  "suggestion": "Did you mean /api/v2/products?",
  "documentation": "https://api.example.com/docs"
}
```

### Benefits

1. **Better Developer Experience**: Clear error messages aid debugging
2. **API Discovery**: Suggest correct endpoints or link to documentation
3. **Monitoring**: Log which non-existent routes are being requested
4. **Security**: Avoid exposing internal error details that could aid attackers

### Implementation Across Frameworks

**Express.js (Node.js)**:
```javascript
app.all('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
```

**Flask (Python)**:
```python
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Route not found'}), 404
```

**Spring Boot (Java)**:
```java
@RequestMapping("/**")
public ResponseEntity<String> handleNotFound() {
    return ResponseEntity.status(404).body("Route not found");
}
```

The concept remains the same across all frameworks: provide a fallback handler for unmatched routes.

## Putting It All Together

Understanding routing requires seeing how all these concepts work together in a real API:

### Example API Structure

```
# Static routes
GET    /api/books                    # Get all books
POST   /api/books                    # Create a book

# Dynamic routes (path parameters)
GET    /api/books/:id                # Get specific book
PUT    /api/books/:id                # Update specific book
DELETE /api/books/:id                # Delete specific book

# Query parameters
GET    /api/books?page=2&limit=20    # Paginated books
GET    /api/books?author=Smith       # Filtered books

# Nested routes
GET    /api/users/:userId/books      # Books by specific user
GET    /api/users/:userId/books/:bookId  # Specific book by specific user

# Versioned routes
GET    /api/v1/books                 # Version 1
GET    /api/v2/books                 # Version 2

# Catch-all
ALL    *                             # 404 handler
```

### The Request Flow

When a request arrives:

1. **Extract method and path**: Server identifies HTTP method and URL path
2. **Route matching**: Server tries to match against defined routes in order
3. **Parameter extraction**: Dynamic segments are captured as variables
4. **Handler execution**: Matched handler receives the request and parameters
5. **Response**: Handler executes business logic and returns response

### Best Practices Summary

1. **Use semantic URLs**: Make routes self-documenting and readable
2. **Follow REST conventions**: Use appropriate HTTP methods with routes
3. **Keep nesting shallow**: Limit to 2-3 levels for maintainability
4. **Version breaking changes**: Use v1, v2, etc. for incompatible updates
5. **Provide clear errors**: Use catch-all routes for helpful 404 messages
6. **Document thoroughly**: Document all routes, parameters, and responses
7. **Be consistent**: Follow the same patterns across your entire API

## Conclusion

Routing is the backbone of API design, connecting client requests to server logic. By understanding the different types of routes—static, dynamic, nested, and versioned—along with proper parameter usage and error handling, you can build intuitive, maintainable APIs.

**Key Takeaways:**

- **Routes define location**: While HTTP methods define intent, routes specify the target resource
- **Combination is key**: Method + Route creates a unique endpoint
- **Path parameters identify**: Use them for resource IDs and semantic URLs
- **Query parameters modify**: Use them for filtering, pagination, and options
- **Nesting expresses relationships**: Create hierarchical URLs that reflect data structure
- **Versioning enables evolution**: Manage breaking changes without disrupting clients
- **Catch-all provides safety**: Handle unknown routes gracefully

With these routing concepts mastered, you're equipped to understand, design, and implement robust REST APIs in any backend framework. Whether you're working with Node.js, Python, Java, Go, or Rust, these principles remain constant—a testament to the power of standardized API design.