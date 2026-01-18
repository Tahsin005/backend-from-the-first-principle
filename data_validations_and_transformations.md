# Data Validation and Transformation: Essential Principles for API Design

## Introduction

Validations and transformations are critical components of API design that often go overlooked until problems arise. These mechanisms aren't just about checking data-they're about maintaining data integrity, ensuring security, and providing a robust foundation for your backend architecture.

This guide explores the essential rules and guidelines you should keep in mind while designing APIs, with a particular focus on where validations and transformations fit into your system architecture and why they're indispensable for secure, reliable applications.

![Data Validations and Transformations](https://miro.medium.com/v2/resize:fit:720/format:webp/1*T4tfV7JZBM0EhbdR8qh3vQ.png)

## Understanding Backend Architecture Layers

Before diving into validations, let's understand the typical backend architecture and where these concepts fit.

### The Three-Layer Architecture

Most backend systems organize code into three distinct layers, each with specific responsibilities:

#### 1. Repository Layer (Bottom Layer)

**Purpose**: Database interactions

**Responsibilities**:
- Database connections
- Query executions
- Insertions and deletions
- Data persistence operations

**Examples of operations**:
```javascript
// Repository methods
createBook(bookData)
findBookById(id)
updateBook(id, updates)
deleteBook(id)
```

**Storage types**:
- Traditional relational databases (PostgreSQL, MySQL)
- In-memory stores (Redis, Memcached)
- NoSQL databases (MongoDB, DynamoDB)
- Any persistent storage mechanism

#### 2. Service Layer (Middle Layer)

**Purpose**: Business logic execution

**Responsibilities**:
- Orchestrating complex operations
- Calling repository methods
- Sending notifications
- Sending emails
- Making webhook calls
- Storing data
- Coordinating multiple operations

**Example flow**:
```javascript
async function createBookService(bookData) {
  // Call repository to save book
  const book = await repository.createBook(bookData);
  
  // Send email notification
  await emailService.sendNewBookNotification(book);
  
  // Make webhook call to notify third parties
  await webhookService.notifyBookCreated(book);
  
  // Update search index
  await searchService.indexBook(book);
  
  return book;
}
```

A typical service method might call one or more repository methods and execute various side effects.

#### 3. Controller Layer (Top Layer)

**Purpose**: HTTP request/response handling

**Responsibilities**:
- Receiving HTTP requests
- Calling appropriate service methods
- Formatting responses
- Returning appropriate HTTP status codes
- Handling HTTP-specific concerns

**Example**:
```javascript
async function createBookController(req, res) {
  try {
    // Call service layer
    const book = await createBookService(req.body);
    
    // Return formatted response
    return res.status(201).json({
      success: true,
      data: book
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### Why Separate Layers?

**Separation of concerns**: Each layer has a single, well-defined responsibility.

**HTTP isolation**: HTTP-related logic (status codes, response formats) stays in the controller layer, separate from business logic.

**Reusability**: Service layer can be called from controllers, CLI commands, background jobs, or tests without duplication.

**Testability**: Each layer can be tested independently.

**Maintainability**: Changes to one layer don't cascade to others.

### The Typical API Execution Flow

```
Client Request
      ↓
Route Matching
      ↓
Controller Layer (HTTP handling)
      ↓
Service Layer (Business logic)
      ↓
Repository Layer (Database operations)
      ↓
Database
      ↓
Repository returns data
      ↓
Service processes and returns
      ↓
Controller formats and returns HTTP response
      ↓
Client receives response
```

## Where Validations and Transformations Happen

### The Critical Entry Point

Validations and transformations happen at a very specific point in the request lifecycle:

**Location**: After route matching, before business logic execution

**Specifically**:
1. Client sends request
2. Server receives request
3. **Route matching** occurs
4. Controller method is invoked
5. **★ VALIDATION AND TRANSFORMATION HAPPENS HERE ★**
6. Business logic executes (if validation passes)

**Why this point?**

Before any significant logic runs, before calling service methods, before executing business operations-we validate and transform the incoming data.

### The Data Entry Points

Validation must cover ALL data entering your system:

**1. JSON Payload (Request Body)**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**2. Query Parameters**
```
/api/books?page=2&limit=20&sort=title
```

**3. Path Parameters**
```
/api/users/123/posts/456
```

**4. Headers**
```
Authorization: Bearer eyJhbGci...
Content-Type: application/json
```

**All of these** must be validated before processing.

## Why Validation Matters: A Cautionary Tale

### The Scenario Without Validation

Imagine an API for creating books with this requirement:

**Expected data**:
```json
{
  "name": "string (5-100 characters)"
}
```

**Database schema** (PostgreSQL):
```sql
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);
```

### What Happens Without Validation

**Client sends**:
```json
{
  "name": 0
}
```

**The flow**:

1. x **No validation at controller layer**
2. Controller calls service layer
3. Service layer calls repository
4. Repository executes database query:
   ```sql
   INSERT INTO books (name) VALUES (0);
   ```
5. **Database rejects the operation** (type mismatch: expects TEXT, got number)
6. Database call fails
7. Error bubbles up through layers
8. Client receives: **500 Internal Server Error**

### The Problem

**Poor user experience**: Generic "Internal Server Error" tells the user nothing about what went wrong.

**Security issue**: Exposing internal errors could reveal database structure or implementation details.

**Wasted resources**: The entire call stack was executed before discovering a simple data type error.

**Debugging difficulty**: Error occurred deep in the system rather than at the entry point.

### The Solution: Validation at Entry Point

**With proper validation**:

1. Client sends invalid data
2. Route matches, controller invoked
3. **✓ Validation runs immediately**
4. Validation detects: "Expected string, received number"
5. **Immediately return 400 Bad Request** with clear message:
   ```json
   {
     "error": "Validation failed",
     "details": {
       "name": "Expected string, received number"
     }
   }
   ```
6. **Business logic never executes**
7. **Database never queried**
8. User receives clear, actionable feedback

### The Benefits

**1. Better user experience**: Clear error messages explaining exactly what's wrong

**2. Security**: Prevent malformed data from reaching sensitive business logic

**3. Performance**: Fail fast without expensive operations

**4. Data integrity**: Ensure database only receives valid data

**5. Simplified debugging**: Errors occur at entry point, easy to trace

**6. Proper status codes**: 400 (Bad Request) instead of 500 (Internal Server Error)

## Types of Validation

While not strictly categorized, most validations fall into three main types you'll encounter regularly:

### 1. Syntactic Validation: Structure and Format

Syntactic validation checks if data conforms to a specific structure or format.

#### Email Validation

**Structure**:
```
username@domain.tld
```

**Requirements**:
- Username part before `@`
- `@` symbol
- Domain name
- Top-level domain (.com, .org, .in, etc.)

**Valid examples**:
```
john@example.com
user.name+tag@domain.co.uk
```

**Invalid examples**:
```
notanemail
missing@domain
@nodomain.com
```

**Validation check**:
```javascript
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

#### Phone Number Validation

**Structure**:
```
[+countryCode][phoneNumber]
```

**Requirements**:
- Optional country code prefix
- Specific number of digits based on country
- May include separators (-, space, parentheses)

**Valid examples**:
```
+1-555-123-4567
+91 98765 43210
555-1234
```

**Validation considerations**:
- Country code validation
- Length based on country
- Allowed separators

#### Date Validation

**Common formats**:
```
YYYY-MM-DD (ISO 8601)
DD/MM/YYYY
MM-DD-YYYY
```

**Requirements**:
- Valid day (1-31)
- Valid month (1-12)
- Valid year
- Correct separators
- Days appropriate for month (February has 28/29 days)

**Example**:
```javascript
// Valid
"2025-01-15"
"15/01/2025"

// Invalid
"2025-13-01"  // Month 13 doesn't exist
"2025-02-30"  // February doesn't have 30 days
"15-2025-01"  // Wrong format
```

#### Why Syntactic Validation Matters

**Data consistency**: Ensures data follows expected patterns across your system

**Downstream processing**: Other parts of your system can rely on data structure

**Integration**: External services expect specific formats (payment gateways, SMS services, etc.)

**User feedback**: Catch formatting errors immediately before processing

### 2. Semantic Validation: Does It Make Sense?

Semantic validation checks if data makes sense in the real world, beyond just structure.

#### Date of Birth Validation

**The field**: User's date of birth

**Syntactic validation**: ✓ Is it a valid date format?

**Semantic validation**: Does this date make sense as a birth date?

**Rules**:
```javascript
function validateDateOfBirth(dob) {
  const date = new Date(dob);
  const today = new Date();
  
  // Cannot be in the future
  if (date > today) {
    return { valid: false, error: "Date of birth cannot be in the future" };
  }
  
  // Cannot be more than 120 years ago (reasonable maximum age)
  const maxAge = 120;
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - maxAge);
  
  if (date < minDate) {
    return { valid: false, error: "Date of birth cannot be more than 120 years ago" };
  }
  
  return { valid: true };
}
```

**Invalid examples**:
```
"2026-01-01"  // Future date
"1850-01-01"  // Too far in the past
```

#### Age Validation

**The field**: User's age in years

**Semantic rules**:
```javascript
function validateAge(age) {
  // Must be positive
  if (age < 0) {
    return { valid: false, error: "Age cannot be negative" };
  }
  
  // Reasonable maximum (nobody is 365 years old)
  if (age > 120) {
    return { valid: false, error: "Age must be less than or equal to 120" };
  }
  
  // Might have minimum for certain services
  if (age < 1) {
    return { valid: false, error: "Age must be at least 1" };
  }
  
  return { valid: true };
}
```

**Invalid examples**:
```
-5    // Negative age
430   // Impossibly old
0     // Questionable (newborns wouldn't use the service)
```

#### Price Validation

**The field**: Product price

**Semantic rules**:
```javascript
function validatePrice(price) {
  // Cannot be negative
  if (price < 0) {
    return { valid: false, error: "Price cannot be negative" };
  }
  
  // Reasonable maximum (context-dependent)
  if (price > 1000000) {
    return { valid: false, error: "Price exceeds maximum allowed" };
  }
  
  // Perhaps must be above minimum
  if (price < 0.01) {
    return { valid: false, error: "Price must be at least $0.01" };
  }
  
  return { valid: true };
}
```

#### Stock Quantity Validation

**The field**: Available stock

**Semantic rules**:
- Cannot order more than available stock
- Stock cannot be negative
- Reasonable maximum inventory

**Example**:
```javascript
function validateOrderQuantity(requestedQty, availableStock) {
  if (requestedQty > availableStock) {
    return { 
      valid: false, 
      error: `Only ${availableStock} items available` 
    };
  }
  
  if (requestedQty < 1) {
    return { 
      valid: false, 
      error: "Must order at least 1 item" 
    };
  }
  
  return { valid: true };
}
```

#### Why Semantic Validation Matters

**Business logic integrity**: Prevents nonsensical data from entering your system

**User experience**: Catches logical errors early with clear feedback

**Data quality**: Maintains meaningful, realistic data in your database

**Fraud prevention**: Unusual values might indicate malicious activity

### 3. Type Validation: Correct Data Types

Type validation ensures data matches expected types-the most fundamental validation.

#### Basic Type Checking

**String validation**:
```javascript
function validateString(value) {
  if (typeof value !== 'string') {
    return { valid: false, error: "Expected string, received " + typeof value };
  }
  return { valid: true };
}
```

**Number validation**:
```javascript
function validateNumber(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: "Expected number, received " + typeof value };
  }
  return { valid: true };
}
```

**Boolean validation**:
```javascript
function validateBoolean(value) {
  if (typeof value !== 'boolean') {
    return { valid: false, error: "Expected boolean, received " + typeof value };
  }
  return { valid: true };
}
```

**Array validation**:
```javascript
function validateArray(value) {
  if (!Array.isArray(value)) {
    return { valid: false, error: "Expected array, received " + typeof value };
  }
  return { valid: true };
}
```

#### Nested Type Validation

**Array of specific types**:
```javascript
function validateStringArray(value) {
  if (!Array.isArray(value)) {
    return { valid: false, error: "Expected array" };
  }
  
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      return { 
        valid: false, 
        error: `Element at index ${i}: expected string, received ${typeof value[i]}` 
      };
    }
  }
  
  return { valid: true };
}
```

**Object with specific properties**:
```javascript
function validateUserObject(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { valid: false, error: "Expected object" };
  }
  
  const { name, age, email } = value;
  
  if (typeof name !== 'string') {
    return { valid: false, error: "name must be string" };
  }
  
  if (typeof age !== 'number') {
    return { valid: false, error: "age must be number" };
  }
  
  if (typeof email !== 'string') {
    return { valid: false, error: "email must be string" };
  }
  
  return { valid: true };
}
```

#### Why Type Validation Matters

**Foundation for other validations**: Can't check email format if it's not a string

**Runtime safety**: Prevents type errors during execution

**Database compatibility**: Ensures data types match schema

**API contract enforcement**: Guarantees expected data structure

## Complex Validations: Conditional Logic

Real-world APIs often have interdependent validation rules.

### Example: Password Confirmation

**Requirement**: Password and password confirmation must match.

**Validation**:
```javascript
function validatePasswordFields(data) {
  const { password, passwordConfirmation } = data;
  
  // Type check
  if (typeof password !== 'string' || typeof passwordConfirmation !== 'string') {
    return { valid: false, error: "Passwords must be strings" };
  }
  
  // Length requirement
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  
  // Match requirement
  if (password !== passwordConfirmation) {
    return { valid: false, error: "Passwords don't match" };
  }
  
  return { valid: true };
}
```

### Example: Conditional Required Fields

**Requirement**: If user is married, partner name is required.

**Validation**:
```javascript
function validateMaritalStatus(data) {
  const { married, partnerName } = data;
  
  // Type check for married field
  if (typeof married !== 'boolean') {
    return { valid: false, error: "married must be boolean" };
  }
  
  // Conditional requirement
  if (married === true) {
    if (!partnerName || typeof partnerName !== 'string') {
      return { 
        valid: false, 
        error: "Partner name is required when married is true" 
      };
    }
    
    if (partnerName.trim().length === 0) {
      return { 
        valid: false, 
        error: "Partner name cannot be empty" 
      };
    }
  }
  
  return { valid: true };
}
```

### Example: Range Dependencies

**Requirement**: End date must be after start date.

**Validation**:
```javascript
function validateDateRange(data) {
  const { startDate, endDate } = data;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: "Invalid date format" };
  }
  
  if (end <= start) {
    return { valid: false, error: "End date must be after start date" };
  }
  
  return { valid: true };
}
```

## Data Transformation: Adapting Input to Server Needs

Transformation is the process of converting data into the format your server expects or requires.

### The Need for Transformation

**Problem**: Query parameters arrive as strings by default.

**Example URL**:
```
/api/bookmarks?page=2&limit=20
```

**What the server receives**:
```javascript
{
  page: "2",      // String, not number
  limit: "20"     // String, not number
}
```

**What the server needs**:
```javascript
{
  page: 2,        // Number
  limit: 20       // Number
}
```

**Why this matters**: Your validation expects numbers with specific ranges.

### Transformation Solution

**Type casting (coercion)**:
```javascript
function transformPaginationParams(params) {
  return {
    page: parseInt(params.page, 10),
    limit: parseInt(params.limit, 10)
  };
}
```

**With validation**:
```javascript
function validateAndTransformPagination(params) {
  // Transform first
  const transformed = {
    page: parseInt(params.page, 10),
    limit: parseInt(params.limit, 10)
  };
  
  // Then validate
  if (isNaN(transformed.page) || transformed.page < 1 || transformed.page > 500) {
    return { 
      valid: false, 
      error: "page must be a number between 1 and 500" 
    };
  }
  
  if (isNaN(transformed.limit) || transformed.limit < 1 || transformed.limit > 10000) {
    return { 
      valid: false, 
      error: "limit must be a number between 1 and 10000" 
    };
  }
  
  return { valid: true, data: transformed };
}
```

### Common Transformations

#### 1. Case Normalization

**Email to lowercase**:
```javascript
function transformEmail(email) {
  return email.trim().toLowerCase();
}

// Input: "John.Doe@EXAMPLE.COM"
// Output: "john.doe@example.com"
```

**Why**: Email addresses are case-insensitive, but storing consistently prevents duplicates.

#### 2. Whitespace Trimming

```javascript
function transformString(value) {
  return value.trim();
}

// Input: "  John Doe  "
// Output: "John Doe"
```

#### 3. Phone Number Formatting

```javascript
function transformPhoneNumber(phone) {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add country code if missing
  if (!cleaned.startsWith('1') && cleaned.length === 10) {
    return '+1' + cleaned;
  }
  
  return '+' + cleaned;
}

// Input: "(555) 123-4567"
// Output: "+15551234567"
```

#### 4. Date Standardization

```javascript
function transformDate(dateString) {
  const date = new Date(dateString);
  // Convert to ISO 8601 format
  return date.toISOString();
}

// Input: "01/15/2025"
// Output: "2025-01-15T00:00:00.000Z"
```

#### 5. Boolean Coercion

```javascript
function transformBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
}

// Input: "true", "false", 1, 0
// Output: true, false, true, false
```

### The Validation-Transformation Pipeline

Typically, transformations and validations happen together in one pipeline:

```javascript
function validateAndTransform(data, schema) {
  const result = {
    valid: true,
    errors: {},
    transformed: {}
  };
  
  for (const [field, rules] of Object.entries(schema)) {
    let value = data[field];
    
    // Apply transformations first
    if (rules.transform) {
      value = rules.transform(value);
    }
    
    // Then validate
    if (rules.validate) {
      const validation = rules.validate(value);
      if (!validation.valid) {
        result.valid = false;
        result.errors[field] = validation.error;
        continue;
      }
    }
    
    result.transformed[field] = value;
  }
  
  return result;
}
```

**Usage**:
```javascript
const schema = {
  email: {
    transform: (v) => v.trim().toLowerCase(),
    validate: (v) => isValidEmail(v) ? 
      { valid: true } : 
      { valid: false, error: "Invalid email format" }
  },
  page: {
    transform: (v) => parseInt(v, 10),
    validate: (v) => (v >= 1 && v <= 500) ?
      { valid: true } :
      { valid: false, error: "Page must be between 1 and 500" }
  }
};

const result = validateAndTransform(requestData, schema);
if (!result.valid) {
  return res.status(400).json({ errors: result.errors });
}

// Use transformed data
processData(result.transformed);
```

### Benefits of Transformation

**1. Consistency**: Data stored in consistent format regardless of input variation

**2. Compatibility**: Converts to types expected by business logic and database

**3. User-friendly**: Accept various formats, normalize internally

**4. Security**: Sanitize input before processing

## Frontend vs Backend Validation

A critical concept that often causes confusion: the relationship between client-side and server-side validation.

### The Common Mistake

Some developers assume:
> "If I validate on the frontend, I don't need backend validation."

**This is dangerously wrong.**

### Why Both Are Necessary

#### Frontend Validation: User Experience

**Purpose**: Provide immediate feedback to users

**Example**: Form validation before submission

```javascript
// Frontend validation
function validateForm() {
  const email = document.getElementById('email').value;
  
  if (!isValidEmail(email)) {
    // Show error immediately
    document.getElementById('email-error').textContent = 
      'Please enter a valid email address';
    return false;
  }
  
  return true;
}

// Submit only if validation passes
form.addEventListener('submit', (e) => {
  if (!validateForm()) {
    e.preventDefault();  // Don't submit
  }
});
```

**Benefits**:
- Instant feedback (no network round-trip)
- Better user experience
- Reduces unnecessary API calls
- Guides users to correct format

**What it's NOT for**:
- x Security
- x Data integrity
- x Protection against malicious users

#### Backend Validation: Security and Integrity

**Purpose**: Enforce data requirements and protect the system

**Example**: Server-side validation (always runs)

```javascript
// Backend validation (Node.js/Express)
app.post('/api/users', (req, res) => {
  const { email, name, age } = req.body;
  
  // ALWAYS validate on the server
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: 'Invalid email format'
    });
  }
  
  if (typeof name !== 'string' || name.length < 2) {
    return res.status(400).json({
      error: 'Name must be at least 2 characters'
    });
  }
  
  if (typeof age !== 'number' || age < 1 || age > 120) {
    return res.status(400).json({
      error: 'Age must be between 1 and 120'
    });
  }
  
  // Only proceed if validation passes
  createUser({ email, name, age });
});
```

**Why backend validation is mandatory**:

**1. Frontend can be bypassed**: Users can:
- Disable JavaScript
- Use browser dev tools to modify code
- Use API clients (Postman, curl) directly
- Intercept and modify network requests

**2. Multiple clients**: Your API might be used by:
- Web application (has validation)
- Mobile app (might have different validation)
- Third-party integrations (no validation)
- API clients for testing (no validation)

**3. Security**: Malicious users intentionally send invalid data to:
- Exploit vulnerabilities
- Inject malicious code
- Cause system errors
- Access unauthorized data

**4. Data integrity**: Database depends on valid data:
- Prevents corruption
- Maintains referential integrity
- Ensures business rules are followed

### The Complete Picture

```
┌─────────────────────────────────────────────┐
│           Frontend (Web/Mobile)             │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Frontend Validation                 │  │
│  │  Purpose: User Experience            │  │
│  │  - Immediate feedback                │  │
│  │  - Guide user input                  │  │
│  │  - Prevent obvious errors            │  │
│  └──────────────────────────────────────┘  │
│                    │                        │
│                    ↓                        │
│            Submit if valid                  │
└─────────────────────────────────────────────┘
                     │
                     ↓ HTTP Request
┌─────────────────────────────────────────────┐
│              Backend Server                  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Backend Validation (MANDATORY)      │  │
│  │  Purpose: Security & Data Integrity  │  │
│  │  - Cannot be bypassed                │  │
│  │  - Protects against malicious input  │  │
│  │  - Enforces business rules           │  │
│  │  - Validates ALL clients             │  │
│  └──────────────────────────────────────┘  │
│                    │                        │
│                    ↓                        │
│           Business Logic                    │
│           Database Operations               │
└─────────────────────────────────────────────┘
```

### Real-World Example

**Scenario**: User registration form

**Frontend**:
```javascript
// Validates and provides feedback BEFORE submission
function validateRegistrationForm() {
  const errors = {};
  
  const email = document.getElementById('email').value;
  if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email';
    showError('email', errors.email);  // Show error immediately
  }
  
  const password = document.getElementById('password').value;
  if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
    showError('password', errors.password);
  }
  
  return Object.keys(errors).length === 0;
}

// Only submit if frontend validation passes
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!validateRegistrationForm()) {
    return;  // Don't submit if validation fails
  }
  
  // Frontend validation passed, submit to server
  const response = await fetch('/api/register', {
    method: 'POST',
    body: JSON.stringify(formData)
  });
  
  // Server might still reject (and should validate again)
  if (!response.ok) {
    const error = await response.json();
    showServerError(error);
  }
});
```

**Backend**:
```javascript
// ALWAYS validates, regardless of frontend
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  // Server validation (CANNOT be skipped)
  const errors = {};
  
  if (!isValidEmail(email)) {
    errors.email = 'Invalid email format';
  }
  
  if (typeof password !== 'string' || password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.name = 'Name is required';
  }
  
  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    errors.email = 'Email already registered';
  }
  
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }
  
  // Validation passed, create user
  const user = await User.create({
    email: email.toLowerCase(),  // Transform
    password: await hashPassword(password),
    name: name.trim()
  });
  
  res.status(201).json({ user });
});
```

### The Golden Rule

**Always implement backend validation, regardless of frontend validation.**

Frontend validation is a courtesy to users. Backend validation is a requirement for security and data integrity.

## Best Practices

### 1. Fail Fast

Validate at the entry point, before any expensive operations:

```javascript
app.post('/api/orders', async (req, res) => {
  // ✓ Validate FIRST
  const validation = validateOrderData(req.body);
  if (!validation.valid) {
    return res.status(400).json({ errors: validation.errors });
  }
  
  // Then proceed with expensive operations
  await checkInventory();
  await processPayment();
  await createOrder();
});
```

### 2. Be Specific with Error Messages

**Bad**:
```json
{
  "error": "Invalid input"
}
```

**Good**:
```json
{
  "errors": {
    "email": "Invalid email format",
    "age": "Age must be between 1 and 120",
    "password": "Password must be at least 8 characters"
  }
}
```

### 3. Use Validation Libraries

Don't reinvent the wheel. Use battle-tested libraries:

- **Joi** (Node.js): Schema validation
- **Zod** (TypeScript-first): Type-safe validation
- **Yup**: JavaScript schema builder
- **Validator.js**: String validation functions
- **Pydantic** (Python): Data validation using type hints
- **FluentValidation** (.NET): Fluent interface for validation

**Example with Zod**:
```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  age: z.number().min(1).max(120),
  name: z.string().min(2).max(100)
});

// Validate and transform
try {
  const validated = userSchema.parse(req.body);
  // validated is now type-safe and validated
} catch (error) {
  res.status(400).json({ errors: error.errors });
}
```

### 4. Document Your Validation Rules

Validation errors serve as implicit documentation:

```javascript
// When client sends empty request
{
  "errors": {
    "email": "Required field",
    "phone": "Required field",
    "dateOfBirth": "Required field"
  }
}
```

Users can discover required fields through error messages.

### 5. Keep Validation Logic Centralized

```javascript
// ✓ Good: Centralized schemas
const schemas = {
  createUser: {
    email: { type: 'string', format: 'email', required: true },
    name: { type: 'string', minLength: 2, maxLength: 100, required: true },
    age: { type: 'number', min: 1, max: 120, required: true }
  },
  updateUser: {
    email: { type: 'string', format: 'email' },
    name: { type: 'string', minLength: 2, maxLength: 100 }
  }
};

// Reuse in multiple places
app.post('/api/users', validate(schemas.createUser), createUserHandler);
app.put('/api/users/:id', validate(schemas.updateUser), updateUserHandler);
```

### 6. Sanitize Input

Beyond validation, sanitize to prevent injection attacks:

```javascript
import validator from 'validator';

function sanitizeUserInput(data) {
  return {
    email: validator.normalizeEmail(data.email),
    name: validator.escape(data.name),  // Prevent XSS
    bio: validator.stripLow(data.bio)   // Remove control characters
  };
}
```

## Conclusion

Validations and transformations are not mere checkboxes in your development process-they're fundamental pillars of API design that ensure security, data integrity, and excellent user experience.

### Key Takeaways

**1. Validate at the Entry Point**
- Before business logic
- Before database operations
- After route matching, in the controller layer

**2. Cover All Data Sources**
- JSON payloads
- Query parameters
- Path parameters
- Headers

**3. Three Types of Validation**
- **Syntactic**: Structure and format (emails, phones, dates)
- **Semantic**: Logical sense (future dates, reasonable values)
- **Type**: Correct data types (string, number, boolean, array)

**4. Transform When Necessary**
- Type coercion (string to number)
- Normalization (lowercase emails)
- Formatting (phone numbers, dates)
- Sanitization (remove dangerous characters)

**5. Frontend vs Backend**
- **Frontend**: User experience (optional but recommended)
- **Backend**: Security and integrity (mandatory, non-negotiable)
- Never trust the client-always validate on the server

**6. Best Practices**
- Fail fast with clear error messages
- Use validation libraries
- Centralize validation logic
- Document through errors
- Sanitize to prevent attacks

**The Bottom Line**: Validation and transformation are your first line of defense against bad data, malicious attacks, and system failures. Implement them rigorously, consistently, and comprehensively. Your future self-and your users-will thank you.

