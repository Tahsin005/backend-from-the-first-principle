# gRPC: The Complete Guide for Backend Engineers

When I started working on microservices at an AI SaaS startup, every service talked to every other service over REST. JSON payloads, HTTP/1.1, manually maintained API contracts that drifted apart the moment two developers stopped communicating. It worked — until it didn't. The turning point was migrating our inter-service communication to gRPC. The difference was immediate and measurable: smaller payloads, faster calls, and — most importantly — a shared contract that the compiler enforced for us.

This post is everything I wish I had read before that migration. We'll go from first principles to production-grade code, in the order it actually makes sense to learn.

![gRPC](https://miro.medium.com/v2/resize:fit:1100/format:webp/1*4xVhhj5OMkVYXGZVYX-BGQ.png)

---

## 01. What is gRPC and Why Does It Exist?

gRPC is a high-performance, open-source Remote Procedure Call framework originally built by Google and open-sourced in 2015. The problem it solves is simple: when you have many services that need to talk to each other constantly, REST starts showing its cracks.

REST was designed for humans to read. gRPC was designed for machines to be fast.

Here are the four concrete problems gRPC was built to solve:

### No enforced contract in REST

With REST, you _hope_ the client sends the right shape. There's nothing stopping a client from sending `age` as a string when the server expects an integer. With gRPC, the `.proto` file is a strict contract that both sides compile against. If the shape is wrong, it won't compile.

### JSON is heavy

JSON was designed for humans to read. Every field name is transmitted as a full string on every request. gRPC uses **Protocol Buffers** — a binary format that sends field numbers instead of names. A typical message shrinks by 3–10x. At millions of requests per day, this translates directly to infrastructure costs.

### HTTP/1.1 does one thing at a time

REST typically rides HTTP/1.1. Each request blocks the connection until the response arrives. gRPC runs on **HTTP/2**, which multiplexes many requests simultaneously over a single connection — like many phone calls on one fiber cable.

### REST has no native streaming

Want to push 100,000 records to a client over REST? You either return them all at once (huge payload), paginate (many round trips), or bolt on WebSockets (a completely different paradigm). gRPC has first-class streaming built directly into the protocol.

### Mental Model

**REST = HTTP/1.1 + JSON + loose contracts + request-response only.**  
**gRPC = HTTP/2 + Protobuf + strict contracts + 4 communication patterns.**

---

## 02. How gRPC Actually Works Under the Hood

gRPC sits on three pillars. Understanding each one gives you a complete mental model.

### Pillar 1 — Protocol Buffers

Protobuf is a packing machine for data. Instead of transmitting field names like `"userId"`, it transmits field numbers like `1`. The receiver already knows from the compiled proto that "field 1 = userId". This is why Protobuf messages are typically 3–10x smaller than equivalent JSON.

### Pillar 2 — HTTP/2 Multiplexing

HTTP/2 solves head-of-line blocking. Multiple requests and responses fly simultaneously over one connection as independent streams. It also gives gRPC header compression (auth tokens compressed and cached, not resent in full every time) and built-in flow control so a fast sender can't overwhelm a slow receiver.

### Pillar 3 — The .proto file as shared contract

The proto file is the blueprint both sides compile from. A Python server and a Node.js client can communicate seamlessly because they both compiled against the same `.proto`. This language-agnostic contract is one of gRPC's biggest practical wins.

    // One proto file. Node.js client + Python server both compile from this.
    service UserService {
      rpc GetUser (GetUserRequest) returns (UserResponse);
    }
    
    message GetUserRequest {
      string user_id = 1;
    }
    
    message UserResponse {
      string user_id = 1;
      string name    = 2;
      int32  age     = 3;
    }

### Key Insight

The entire gRPC stack — serialization, HTTP/2 framing, deserialization — is handled by the framework. You write the business logic. The framework handles every byte in between.

---

## 03. Proto Files: The Language of gRPC

The `.proto` file is where everything starts. Once you write it confidently, everything else flows from it. Let's cover the concepts that trip up most engineers.

### Field numbers — the most critical concept

The `= 1`, `= 2` after field names are not default values. They are permanent binary identifiers. Protobuf uses them — not field names — in the encoded binary. This has a crucial implication:

#### ⚠ Never Do This

Never delete a field and reuse its number for something new. Old clients still sending field `2` as `age` will have it silently decoded as `email` on an updated server. No error is thrown. Data corrupts silently.

    // RIGHT — retire field numbers permanently
    message User {
      string user_id = 1;
      reserved 2;          // field 2 is retired forever
      reserved "name";      // the name is retired too
      string email   = 3;  // keeps original number
      string phone   = 4;  // new field gets new number
    }

### Key data types

| Proto type | TypeScript equivalent | Notes |
| --- | --- | --- |
| `string` | `string` | UTF-8 encoded |
| `int32` | `number` | integers up to ~2.1B |
| `int64` | `string \| Long` | JS can't safely hold 64-bit ints |
| `double` | `number` | 64-bit decimal |
| `bool` | `boolean` | true/false |
| `bytes` | `Buffer \| Uint8Array` | raw binary |
| `repeated T` | `T[]` | array of any type |

### Naming conventions

    // Services → PascalCase
    service UserService {}
    
    // RPC methods → PascalCase
    rpc GetUser(...) returns (...);
    
    // Fields → snake_case (auto-converted to camelCase in TypeScript)
    string user_id    = 1;  // → userId in TypeScript
    string first_name = 2;  // → firstName in TypeScript
    
    // Enum values → SCREAMING_SNAKE_CASE, prefixed with enum name
    enum OrderStatus {
      ORDER_STATUS_UNSPECIFIED = 0;  // first value MUST be 0
      ORDER_STATUS_PENDING     = 1;
      ORDER_STATUS_SHIPPED     = 2;
    }

---

## 04. The 4 Communication Patterns

This is where gRPC genuinely pulls ahead of REST. REST has one communication pattern. gRPC has four, and each solves a different problem.

### Unary RPC

1 request → 1 response

Like a REST API call. One question, one answer. Right for most CRUD operations — fetching a user, creating an order, authenticating a token.

### Server Streaming

1 request → stream of responses

Client asks once, server pushes many responses. Ideal for large dataset exports, live price feeds, log streaming, progress updates.

### Client Streaming

stream of requests → 1 response

Client sends many messages, server responds once when done. Perfect for file uploads in chunks, bulk analytics events, IoT sensor batches.

### Bidirectional Streaming

stream ↔ stream

Both sides send messages freely and independently. Built for live chat, multiplayer game state, collaborative editing, real-time trading.

Reading the `stream` keyword in a proto file tells you the pattern instantly:

    rpc GetUser   (GetUserRequest)         returns (UserResponse);           // Unary
    rpc ListOrders(ListOrdersRequest)       returns (stream Order);          // Server stream
    rpc Upload    (stream Chunk)            returns (UploadResult);          // Client stream
    rpc Chat      (stream ChatMessage)      returns (stream ChatMessage);   // Bidi stream

---

## 05. Code Generation: Proto → TypeScript

You write the `.proto` file once, run a command, and get fully typed TypeScript code for both your server and client. For modern TypeScript projects, **ts-proto** is the tool of choice — it generates clean, idiomatic `.ts` files with proper types.

    # Install the tools
    npm install @grpc/grpc-js
    npm install --save-dev grpc-tools ts-proto

    // package.json scripts
    {
      "generate": "grpc_tools_node_protoc \
        --plugin=protoc-gen-ts_proto=./node_modules/.bin/protoc-gen-ts_proto \
        --ts_proto_out=./generated \
        --ts_proto_opt=outputServices=grpc-js \
        --ts_proto_opt=esModuleInterop=true \
        --proto_path=./proto \
        ./proto/*.proto"
    }

Running `npm run generate` produces `generated/user.ts` with message interfaces, the service definition for the server, and the typed client stub. The key rule:

### Golden Rule

**Never manually edit generated files.** The next `npm run generate` will silently overwrite your changes. All edits go in the `.proto` file. Generated code is an artifact, not source code.

The day-to-day workflow on a real team looks like this:

*   Someone updates the `.proto` file
*   Run `npm run generate`
*   Commit both the `.proto` and the generated `.ts` file
*   Other devs pull — TypeScript immediately shows compile errors if their code no longer matches the contract
*   Fix the type errors — everything is in sync before deployment

---

## 06–07. Building the Server and Client

The separation of concerns in a well-structured gRPC service is straightforward: handlers contain business logic, the proto defines the contract, and the server bootstrap wires them together. Here's the folder structure that scales well:

    grpc-user-service/
    ├── proto/
    │   └── user.proto              # you own this
    ├── generated/
    │   └── user.ts                 # never touch, auto-generated
    ├── src/
    │   ├── handlers/
    │   │   └── user.handler.ts     # business logic lives here
    │   ├── db.ts                   # data layer
    │   └── server.ts               # bootstrap and startup

### Server — what matters

    import * as grpc from '@grpc/grpc-js';
    import { UserServiceService } from '../generated/user';
    import { userServiceHandlers } from './handlers/user.handler';
    
    const server = new grpc.Server();
    
    // Wire the generated definition to your implementation
    server.addService(UserServiceService, userServiceHandlers);
    
    server.bindAsync(`0.0.0.0:50051`, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) { console.error(err); process.exit(1); }
      console.log(`gRPC server running on port ${port}`);
    });

### Client — the factory pattern

The best client pattern hides gRPC internals behind a clean async API. Code that calls your client shouldn't know or care about gRPC underneath:

    export const createUserClient = (config: ClientConfig) => {
      const stub = new UserServiceClient(
        `${config.host}:${config.port}`,
        grpc.credentials.createInsecure()
      );
    
      return {
        // Clean async/await API — no callbacks leak out
        getUser: (userId: string): Promise<User> =>
          unaryPromise(stub.getUser.bind(stub), { userId }),
    
        // Streams as async generators — use for...of, no raw events
        listUsers: (role?: UserRole): AsyncGenerator<User> =>
          streamToAsyncGenerator(stub.listUsers({ role })),
    
        close: () => stub.close(),
      };
    };

Usage then becomes completely clean:

    const client = createUserClient({ host: 'localhost', port: 50051 });
    
    // Unary call
    const user = await client.getUser('abc123');
    
    // Streaming — feels like a normal loop
    for await (const user of client.listUsers()) {
      console.log(user.name);
    }

---

## 08. Error Handling: Status Codes

gRPC has its own status code system, completely independent of HTTP. You never think in terms of 404 or 500 when writing gRPC — you think in terms of `NOT_FOUND` and `INTERNAL`.

| HTTP | gRPC | When to use |
| --- | --- | --- |
| 400 | `INVALID_ARGUMENT` | Missing or wrong fields in request |
| 401 | `UNAUTHENTICATED` | No token, expired token |
| 403 | `PERMISSION_DENIED` | Valid token, wrong permissions |
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 409 | `ALREADY_EXISTS` | Duplicate create (same email, etc.) |
| 429 | `RESOURCE_EXHAUSTED` | Rate limit exceeded |
| 500 | `INTERNAL` | Unexpected server error |
| 503 | `UNAVAILABLE` | Downstream service is down |
| 504 | `DEADLINE_EXCEEDED` | Request took too long |

### Deadlines — the most important error concept in distributed systems

Without deadlines, one slow service can cascade into a full outage. If Service A calls B which calls C which calls D — and D hangs — without deadlines the hang propagates all the way back and your entire system stalls. Always set a deadline on every outbound call:

    const deadline = new Date(Date.now() + 5000); // 5 second max
    
    stub.getUser(
      { userId },
      { deadline },   // ← always pass this
      (error, response) => { ... }
    );
    
    // If server doesn't respond in 5s:
    // error.code === grpc.status.DEADLINE_EXCEEDED

### Production Rule

Every outbound gRPC call gets a deadline. No exceptions. A hanging downstream service should never be able to freeze your entire system. Make it a team standard, enforced in code review.

---

## 09. gRPC vs REST: When to Use Which

The engineer who says "always use gRPC" or "REST is always enough" is wrong. The right answer depends on the communication boundary. Here's the framework I actually use:

### Choose REST when

*   It's a public or browser-facing API
*   Simple CRUD with few services
*   Third-party integrations
*   Team is unfamiliar with Protobuf
*   You need human-readable wire format
*   Quick prototype or MVP

### Choose gRPC when

*   Internal service-to-service communication
*   Performance matters at scale
*   Streaming is a requirement
*   Multiple teams, strict contracts needed
*   Multi-language service ecosystem
*   Many services with complex interdependencies

The best production systems often use both. The **API Gateway pattern** is the canonical example: accept REST at the edge (browsers need it), translate to gRPC internally (speed and contracts). You get the best of both.

    // API Gateway — REST outside, gRPC inside
    app.get('/users/:id', async (req, res) => {
      // Translates REST → gRPC internally
      const user = await userGrpcClient.getUser(req.params.id);
      res.json(user); // Translates gRPC response → JSON for browser
    });

---

## 10. Pitfalls Every Junior Should Know

These are the things that bite teams in production — the lessons that come from debugging live systems at 2am. Consider this the list a senior engineer would walk you through before your first gRPC service goes to prod.

### 1\. Reusing field numbers

Already covered — but it's worth repeating because the consequences are silent and severe. Protobuf will not throw an error. Your data will corrupt. Always `reserve` retired field numbers.

### 2\. No deadlines on client calls

The cascading failure pattern is real. One hanging DB query in a downstream service can freeze your entire platform without deadlines. Make it a team policy: every `stub.methodName()` call gets a `deadline` option.

### 3\. Creating a new channel per request

A gRPC channel is an HTTP/2 connection. Creating one per request is as bad as opening a new DB connection per query. Create the channel once at startup, reuse it everywhere, close it on shutdown.

### 4\. Ignoring `call.cancelled` in streams

When a client disconnects mid-stream, your server keeps iterating and writing to a dead connection. Always check `call.cancelled` inside streaming loops:

    for (const user of allUsers) {
      if (call.cancelled) return; // ← stop immediately, free resources
      call.write(user);
    }

### 5\. Breaking changes in proto files

These changes break existing clients — never make them to a shipped proto:

*   Renaming a field (`user_id → id`)
*   Changing a field type (`int32 age → string age`)
*   Removing a field without reserving the number
*   Renaming a service or RPC method
*   Changing a pattern (unary → streaming)

These are safe and backwards-compatible:

*   Adding a new field (old clients ignore it)
*   Adding a new RPC method (old clients don't call it)
*   Adding a new enum value (old clients get the default)

When you must make a breaking change, version the proto package: `user.v1` → `user.v2`. Run both in parallel and migrate clients gradually.

### 6\. Exposing raw gRPC errors to end users

gRPC status codes are for service-to-service communication. At every REST/gRPC boundary (your API gateway), translate them to HTTP status codes and user-friendly messages. Never let `grpc.status.INTERNAL` surface directly to a browser.

### 7\. Skipping interceptors for cross-cutting concerns

Auth checks, logging, and metrics copy-pasted into every handler is a maintenance nightmare. gRPC has interceptors — the equivalent of Express middleware. Auth validation, request logging, and metrics collection belong in interceptors, applied once, covering all methods.

### The Senior Engineer's Checklist

Before any gRPC service ships: reserved field numbers on all removed fields ✓   deadlines on all outbound calls ✓   channel created once at startup ✓   `call.cancelled` checked in all stream loops ✓   proto package versioned ✓   graceful shutdown implemented ✓

---

## Closing Thoughts

gRPC is not a silver bullet, and it's not a replacement for REST everywhere. But for service-to-service communication in a microservices architecture, it solves real problems that REST either can't solve or solves poorly — contract enforcement, performance at scale, and first-class streaming.

The best way to internalize this is to build something. Take the server and client patterns from this post, run them locally, intentionally break the proto contract and see what the compiler tells you, trigger a `DEADLINE_EXCEEDED` and observe the cascade. That's where it clicks.

The compiler catching your contract violations before deployment is worth more than any amount of integration test coverage.

If you're building microservices in TypeScript today, the stack of `@grpc/grpc-js` + `ts-proto` gives you everything you need to ship fast, reliable, type-safe inter-service communication. Start with one service, get comfortable with the tooling, then expand.