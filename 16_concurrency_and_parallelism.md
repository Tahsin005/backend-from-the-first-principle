# Concurrency & Parallelism: The Mental Model Every Backend Engineer Needs

## Introduction

Every backend system you will ever build shares one non-negotiable requirement: it must handle multiple things at once.

Imagine you have a web server that can only process one HTTP request at a time. While it's busy serving User A, the thousand other users who want to connect get either an error or a never-ending wait. In any real production system with thousands of concurrent users, this is simply not acceptable.

![Concurrency and Parallelism](https://miro.medium.com/v2/resize:fit:1100/format:webp/1*kqe7QclpM-_LJVznKQIfOA.png)

This is not a tutorial about specific APIs or code patterns you can copy-paste into your project. This is about building a **mental model** — the kind of deep, mechanical understanding that helps you debug nasty production bugs, make better architectural decisions, and reason about your system's behavior under load.

Most of us learn `async/await` from documentation and we know, vaguely, that it "makes things concurrent." We know `goroutines` are fast. We know threads "parallelize" things. But we don't truly understand *why*, and *how* these mechanisms work at the level of your operating system and hardware.

By the end of this blog, you will.

---

## The Core Problem: Your Server is Doing Nothing 95% of the Time

Let's start with a concrete problem.

Your backend receives a request. It does some light validation, some JSON parsing, and then makes a database query. Let's track the time of a typical API call:

| Operation | Time |
| :--- | :--- |
| JSON parsing & validation (CPU) | ~10 ms |
| Database query #1 (wait for response) | ~50 ms |
| Database query #2 (wait for response) | ~50 ms |
| External API call (e.g., Redis cache) | ~50 ms |
| External API call (e.g., email service) | ~50 ms |
| Serialize response and send it back | ~50 ms |
| **Total** | **~260 ms** |

Think about this carefully. Your server spent only **10 milliseconds** actually using the CPU. For the remaining **250 milliseconds**, it was stuck waiting — waiting for the database to respond, waiting for Redis, waiting for the email service.

That means **your server's CPU was idle 95% of the time**.

Now let's quantify the waste. A modern CPU can execute roughly **3 billion instructions per second** — that's 3 million instructions per millisecond. While your server sat idle for 250 milliseconds waiting for network responses, it *could* have executed **750 million instructions**. Instead, it executed zero.

This is the fundamental problem that concurrency is designed to solve: **don't waste CPU cycles while you're waiting for I/O**.

> [!NOTE]
> All the "waiting" we're describing — for databases, external APIs, file reads, network packets — falls under a category called **I/O (Input/Output)**. Any operation that involves your network card, your disk, your keyboard/display, or any external device is I/O. It is the opposite of CPU work.

---

## IO-Bound vs. CPU-Bound: The Most Important Distinction

Before we go further, you need to internalize this distinction. It will guide every architectural decision you make.

### IO-Bound Work

Your program **waits for something external** to respond. The CPU has nothing to do — it just sits idle. Examples:
- Making a database query
- Making an HTTP request to an external service
- Reading or writing a file
- Logging to standard output
- Sending an email

### CPU-Bound Work

Your program is **actually computing**. The CPU is working hard and is the bottleneck. Examples:
- Parsing and validating JSON
- Image processing (lots of matrix multiplication)
- Video encoding/decoding
- Encrypting/decrypting data (e.g., verifying a JWT)
- Sorting large datasets, complex recursive algorithms

> [!IMPORTANT]
> In a typical SaaS backend, **70-90% of the time is spent on IO-bound work**. This is the foundational insight that drives everything else. Your backend is not a scientific calculator; it is a professional waiter — mostly waiting, occasionally running.

---

## Concurrency vs. Parallelism: The Famous Distinction

These two words are used interchangeably but they mean very different things.

### Parallelism: Doing Multiple Things *AT THE SAME TIME*

Parallelism requires **hardware-level support**. To do two things in parallel, you need two CPU cores, because a single CPU core can only execute one instruction at any given moment.

Think of it as two chefs cooking two different dishes simultaneously in two separate kitchens.

### Concurrency: *Dealing* With Multiple Things At Once

Concurrency is about **structure**. A concurrent program can start, pause, and resume multiple tasks — potentially on a single CPU core — so that from the outside, it looks like everything is running at the same time. In reality, the CPU is rapidly switching between tasks.

Think of it as one chef who juggles multiple dishes by switching between them whenever one needs to simmer on its own. At any given moment, only one dish is being actively worked on, but progress is being made on all of them.

**The clearest way to express this:**
- **Parallelism** = Doing multiple things at once
- **Concurrency** = Dealing with multiple things at once (even if you're only doing one at a time)

### Visualizing the Difference

Let's say we have two requests — Request A and Request B — both arriving at the same time and needing CPU work + a database response.

**Concurrent (single-core):**
```
Timeline (ms): 0    5    10   15   20   25   30   35   40   45   50
Request A:     [CPU] [---waiting for DB---]             [CPU] [DONE]
Request B:          [CPU------] [---waiting for DB---]        [CPU] [DONE]
```
Both requests make forward progress. At any one moment, only one is using the CPU. Neither wastes CPU time waiting — when one is blocked on I/O, the other uses the CPU. Together, they finish faster than if they were processed strictly one after the other.

**Parallel (multi-core):**
```
Timeline (ms): 0    5    10   15   20   25   30   35   40   45   50
Core 1 (A):   [CPU] [---waiting for DB---]             [CPU] [DONE]
Core 2 (B):   [CPU---] [---waiting for DB---]                [DONE]
```
Both requests are literally using the hardware simultaneously.

---

## Mechanism #1: Threads (OS-Level)

The first, and most foundational, tool for doing multiple things at once is the **thread**.

A **thread** is an independent unit of execution that your **operating system** manages. When you create a thread, the OS does several things on your behalf:

1. **Allocates a stack**: A block of memory to track function calls and local variables. On Linux, this is typically around **8 MB** per thread.
2. **Creates an instruction pointer**: A marker tracking exactly which instruction the thread is currently executing.
3. **Registers it with the scheduler**: The OS scheduler is the piece of software that decides which thread gets to use the CPU, and for how long.

### The OS Scheduler: The Traffic Cop

The OS scheduler uses **preemptive scheduling** — it gives each thread a time slice (typically a few milliseconds), then forcefully pauses it and switches to the next thread. The thread has no say in this. This is "preemptive" because the thread is preempted before it finishes.

Here's exactly what happens when a thread encounters an I/O operation (like reading from a database socket):

```
Thread 1 (handling Request A):
─────────────────────────────────
1. Parse incoming HTTP request                    [RUNNING]
2. Call db.query("SELECT * FROM users")
   └─> Sends bytes over TCP to database
   └─> Calls read() on socket, which BLOCKS      [BLOCKED]

OS Scheduler sees Thread 1 blocked, switches to Thread 2

Thread 2 (handling Request B):
──────────────────────────────────────────────
1. Parse incoming HTTP request                    [RUNNING]
2. Call db.query("SELECT * FROM orders")
   └─> Sends bytes over TCP to database
   └─> Calls read() on socket, which BLOCKS      [BLOCKED]

OS Scheduler switches to Thread 3, or if none ready, idles

... time passes, network packets arrive ...

OS wakes Thread 1: data arrived on its socket    [RUNNABLE]
Thread 1 scheduled, continues:
3. Process query results                          [RUNNING]
4. Serialize HTTP response
5. Send response, thread returns to pool
```

### The Cost of OS Threads: Three Overheads

Threads sound great, but they are **expensive**. Here's why:

#### 1. Memory Overhead

Each thread gets its own stack — up to ~8 MB on Linux. Even if we're generous and say each stack is 500 KB in practice, let's do the math:

- A traffic spike of 10,000 concurrent requests
- With a thread-per-request model: **10,000 × 500 KB ≈ 5 GB** of RAM
- Just for the stacks. Your server needs that memory for everything else too.

At 20,000 concurrent requests, your server likely crashes.

#### 2. Creation Overhead

Creating a thread requires a **system call** to the OS kernel. The kernel has to:
- Set up the stack
- Create the internal data structures (instruction pointer, scheduling info)
- Register with the scheduler

This can take **microseconds to milliseconds** — a serious overhead when you're spawning threads for every incoming request.

#### 3. Context Switch Overhead

Every time the scheduler switches from one thread to another, it must:
- Save the current thread's CPU registers
- Update all bookkeeping data structures
- Select the next thread to run
- Restore *that* thread's CPU registers and state

This process takes **1 to 10 microseconds** per switch on modern hardware. With thousands of threads, the scheduler is thrashing continuously — spending precious CPU time on *maintenance* instead of *actual work*.

> [!CAUTION]
> The "thread-per-request" model is a classic scaling trap. It works beautifully for a few hundred users and then collapses spectacularly at thousands of concurrent users due to memory exhaustion and context switch overhead. If you see this pattern in a codebase, treat it as a red flag.

#### Shared Memory: The Power and the Danger

One critical property of threads within the same process: **they share memory**. If Thread 1 creates an object on the heap, Thread 2 can access it via a pointer. This makes inter-thread communication extremely fast (no serialization, no copying).

But it is also the source of one of programming's most dreaded bugs: **race conditions** (more on this later).

---

## Mechanism #2: The Event Loop

The event loop takes a completely different approach. Instead of managing many threads, it uses **a single thread** and leans on a simple but powerful idea: **never block; use callbacks instead**.

### The Core Principle: Register a Callback, Give Up Control

When a task needs to wait for I/O (e.g., a database query), instead of blocking and waiting, it:
1. Sends the query to the database
2. **Registers a callback function** — a piece of code to run when the result arrives
3. **Immediately returns control** to the event loop
4. The event loop picks up the next task

The loop keeps running, checking on all registered I/O operations each iteration. When a result arrives, the associated callback is invoked.

```
Single Thread running Event Loop:
────────────────────────────────────
1. Request A arrives
   └─> Parse HTTP request
   └─> Start async DB query (sends TCP, registers callback)
   └─> Returns immediately (NOT blocking!)

2. Request B arrives (microseconds later)
   └─> Parse HTTP request
   └─> Start async DB query (sends TCP, registers callback)
   └─> Returns immediately

3. Event loop checks: any I/O ready? No.
   Loop waits on epoll (efficient OS-level wait)

4. DB response for Request B arrives first
   └─> epoll returns, indicates socket B readable
   └─> Loop invokes Request B's callback
   └─> Callback processes results, sends HTTP response

5. DB response for Request A arrives
   └─> Loop invokes Request A's callback
   └─> Callback processes results, sends HTTP response

One thread, but both requests handled efficiently.
No blocking—yielding control between I/O operations.
```

This works because the OS provides system calls specifically designed for monitoring many file descriptors (network sockets, file handles) at once:
- **Linux**: `epoll`
- **macOS**: `kqueue`
- **Windows**: `IOCP`

These let a single thread efficiently wait on thousands of I/O operations simultaneously without spinning in a busy loop.

### How `async/await` Fits In

Before ES6, JavaScript developers had to write callbacks manually:

```javascript
// Pre-ES6: callback hell
app.get('/user/:id', (req, res) => {
    db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, user) => {
        if (err) return res.status(500).json({ error: err });
        res.json(user);
    });
});
```

When you have five nested I/O operations, this becomes deeply nested "callback hell." The modern `async/await` syntax was invented to fix the readability problem. Under the hood, it compiles down to the same callback-based mechanism.

```javascript
// Modern: async/await (same mechanics, readable syntax)
app.get('/user/:id', async (req, res) => {
    const user = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    res.json(user);
});
```

Every `await` keyword is a signal: *"I'm about to wait for I/O. Event loop, go run someone else. Come back to me when this resolves."*

> [!TIP]
> Think of `async/await` as syntactic sugar that transforms your function into a **state machine**. Each `await` is a state transition point. State 0 → runs until the first `await`, hands control back. State 1 → runs when the first promise resolves, until the next `await`, and so on. This is exactly how your JavaScript (or Python asyncio, or Rust tokio) runtime implements it internally.

### The Critical Rule: Never Block the Event Loop

Since there's only one thread, if you do anything CPU-intensive that takes more than a few milliseconds, the *entire event loop freezes*. No requests can be processed. No callbacks fire. Everything grinds to a halt.

```javascript
// ❌ TERRIBLE — This blocks the event loop for ~100ms
app.get('/heavy', async (req, res) => {
    const result = heavyCpuComputation(); // 100ms of pure CPU work
    res.json(result);
});
```

During those 100ms, every other user on your server is completely frozen. This is the fundamental trade-off of the event loop model: **it is dominant for I/O-bound work and catastrophic for CPU-bound work**.

### Event Loop: Advantages and Trade-offs

| Aspect | Event Loop | OS Threads |
| :--- | :--- | :--- |
| Memory per task | Tiny (function closure) | ~500KB–8MB stack |
| Context switching | None (single thread) | 1–10 μs per switch |
| CPU-bound work | Blocks everything | Can use multiple cores |
| I/O-bound work | Extremely efficient | Good, but overhead |
| Complexity | Callbacks/async patterns | Shared state, locks |
| Best for | Web servers, API gateways | Image processing, video encoding |

---

## Mechanism #3: Lightweight / Virtual Threads (Go Goroutines)

Go takes a fascinating middle path. It doesn't use the pure event loop model (no `async/await`), and it doesn't give you raw OS threads. Instead, Go's runtime implements its own **scheduler on top of OS threads**, managing units called **goroutines**.

### What is a Goroutine?

A goroutine is a lightweight, cooperative thread managed by the **Go runtime**, not the OS. You can think of it as a "virtual thread."

```go
// Go: the standard library creates a new goroutine for EVERY request
func (srv *Server) Serve(l net.Listener) error {
    for {
        rw, err := l.Accept()
        // ...
        go c.serve(connCtx) // ← A new goroutine for each connection
    }
}
```

You might think: "But this is the exact thread-per-request model that we said was dangerous!" The difference is the *cost* of a goroutine vs. an OS thread:

| Property | OS Thread | Go Goroutine |
| :--- | :--- | :--- |
| Stack size | ~8 MB (fixed) | ~2–4 KB (grows dynamically) |
| Creation time | Microseconds–milliseconds | Nanoseconds (no system call) |
| Context switch | ~1–10 μs (OS scheduler) | ~100 ns (Go scheduler, just a pointer swap) |
| Managed by | Operating System | Go runtime |

Because goroutines start with only ~2-4KB of stack (growing dynamically only as needed), you can have **hundreds of thousands** of goroutines where you could only have thousands of OS threads.

### The Go Runtime Scheduler (M:N Threading)

This is the magic. Go uses what's called an **M:N threading model**:

- **M** = OS-level threads (typically one per CPU core, set by `GOMAXPROCS`)
- **N** = goroutines (potentially millions)

```
Lightweight Threads: What Actually Happens
─────────────────────────────────────────────────────────────────────
Goroutine 1 (Request A):     Goroutine 2 (Request B):
──────────────────────────   ──────────────────────────
1. Parse request             1. Parse request
2. db.Query(...)             2. db.Query(...)
   └─> Runtime detects          └─> Runtime detects
       network I/O                  network I/O
   └─> Parks goroutine,        └─> Parks goroutine,
       continues others            continues others

─────────────────────────────────────────────────────────────────────
               Go Runtime Scheduler (not OS!)

  M (OS threads): [ M1 ]     [ M2 ]     [ M3 ]     [ M4 ]
                    |           |           |           |
  G (goroutines): [G1]        [G3]        [G5]        [G7]
                  [G2]        [G4]        [G6]        [G8]
                   :           :           :           :
                (queue)     (queue)     (queue)     (queue)

  When G1 blocks on I/O, M1 picks up G2 from queue.
  No OS context switch. Just swapping pointers.
─────────────────────────────────────────────────────────────────────
```

When goroutine G1 blocks on a database call, the Go runtime scheduler parks G1 and makes M1 (the OS thread) pick up G2 from its queue. This is just a **pointer swap in the Go runtime** — no system call to the OS, no saving of CPU registers. This is orders of magnitude cheaper than an OS context switch.

The Go runtime also integrates with `epoll`/`kqueue` under the hood, so when G1's database response arrives, the runtime knows to wake G1 up and put it back in a queue to be picked up by an available OS thread.

```go
// Go: the code looks sequential, but goroutines pause/resume transparently
func handleGetUser(w http.ResponseWriter, r *http.Request) {
    userID := r.URL.Query().Get("id")
    
    // This line blocks this goroutine (not the OS thread!)
    // The Go runtime transparently parks this goroutine at this point
    // and the underlying OS thread picks up another goroutine
    user, err := db.QueryRow("SELECT * FROM users WHERE id = $1", userID).Scan(...)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    
    json.NewEncoder(w).Encode(user)
}
```

The code looks simple and synchronous. No callbacks, no async/await. But under the hood, it's just as concurrent and efficient as Node.js for I/O-bound workloads — and it can also use all CPU cores for CPU-bound workloads. This is Go's killer feature.

---

## The Dark Side of Concurrency: Race Conditions

We've talked about the power of concurrency. Now let's talk about its most dangerous side effect.

When multiple threads (or goroutines, or async tasks) can access and modify the same piece of data, you enter the world of **race conditions**.

### The Lost Update Problem

Consider two threads, both trying to increment a counter:

```
Race Condition: Lost Update
───────────────────────────────────────────────────────────────────
Memory: counter = 0

Time    Thread A                Thread B
────    ─────────────────       ─────────────────
t1      READ counter (gets 0)
t2                              READ counter (gets 0)
t3      ADD 1 (register = 1)
t4                              ADD 1 (register = 1)
t5      WRITE counter ← 1
t6                              WRITE counter ← 1

Memory: counter = 1  (should be 2!)

Both threads read 0, both compute 1, both write 1.
One increment was completely lost.
───────────────────────────────────────────────────────────────────
```

To increment a variable, a thread must perform three separate operations: read the value, add 1 to a register, write the new value back. If two threads interleave these three operations, you get a **lost update**. The final value is 1, but you expected 2.

This is a **race condition**: the program's behavior depends on the unpredictable timing and scheduling of threads.

### "I Use async/await — I'm Safe, Right?"

Wrong. Race conditions can exist in single-threaded async code too. Here's a classic example:

```
Race Condition in Async Code
───────────────────────────────────────────────────────────────────
balance = 100

withdraw(100) #1               withdraw(100) #2
──────────────────             ──────────────────
if (100 >= 100) ✓
await process...
|
| (yielded)
|                              if (100 >= 100) ✓
|                              await process...
|                              |
balance = 100 - 100            | (yielded)
balance is now 0               |
                               balance = 100 - 100
                               (but 100 was the OLD value!)
                               balance is now -100
───────────────────────────────────────────────────────────────────
```

Here's what happened:
1. `withdraw(100)` starts. It checks: is 100 >= 100? Yes.
2. It `await`s the processing and **yields control** to the event loop.
3. `withdraw(100)` #2 starts. It checks: is 100 >= 100? Yes (the balance hasn't changed yet!).
4. It also yields.
5. #1 resumes, does `100 - 100 = 0`. Balance is now 0.
6. #2 resumes, does `100 - 100 = -100` using the *value it read at step 3* — which is now stale.

The account is now **overdrawn by -100**. This is a race condition in single-threaded async code, caused by the `await` point between the check and the actual state mutation.

### The Solutions: Locks, Mutexes, and Channels

#### Locks / Mutexes (Mutual Exclusion)

A mutex is a special lock that only one thread can hold at a time. Any other thread trying to acquire the lock must wait.

```python
import threading

counter = 0
lock = threading.Lock()

def increment():
    global counter
    with lock:  # Only one thread can be inside this block at a time
        temp = counter
        counter = temp + 1
```

The `with lock:` block is called a **critical section**. No two threads can be inside it simultaneously. This prevents the interleaved read-modify-write that caused the lost update.

> [!WARNING]
> Locks fix race conditions but introduce new hazards: **deadlocks** (two threads each waiting for a lock the other holds) and **contention** (many threads waiting for one lock, destroying your concurrency gains). Use them carefully and in the smallest possible scope.

#### Channels (Go's Philosophy)

Go's favored solution is inspired by Tony Hoare's **Communicating Sequential Processes (CSP)**. Instead of sharing memory and synchronizing access with locks, goroutines communicate by passing messages through **channels**.

```go
// Instead of multiple goroutines writing to the same variable...
// have ONE goroutine own the state, and others send messages to it.

func counterManager(ch <-chan int) {
    counter := 0
    for delta := range ch {
        counter += delta
        fmt.Println("Counter:", counter)
    }
}

func main() {
    ch := make(chan int)
    go counterManager(ch) // Only this goroutine touches `counter`
    
    // Other goroutines send updates via the channel
    go func() { ch <- 1 }()
    go func() { ch <- 1 }()
}
```

Go's concurrent design motto:
> *"Do not communicate by sharing memory; instead, share memory by communicating."*

With channels, you eliminate the shared mutable state entirely. The counter is owned by exactly one goroutine, and all updates go through a channel. No locks needed.

---

## Putting It All Together: Which Model for What Problem?

Now you have the full picture. Let's crystallize when to use what.

### For IO-Bound Workloads (web servers, API gateways, microservices)

These workloads spend most of their time waiting for network responses. The bottleneck is not the CPU — it's I/O latency. For these, you want **high concurrency with low overhead**.

| Model | Language Examples | Why It Works Here |
| :--- | :--- | :--- |
| Event Loop | JavaScript/Node.js, Python asyncio | No context switching, tiny memory footprint |
| Virtual Threads | Go goroutines, Java Virtual Threads | Lightweight blocking = massive concurrency |
| Thread Pool | Java (traditional), Python with threads | Decent, but heavier than above two |

All three of these can handle thousands of concurrent connections efficiently. The event loop and virtual thread models win on memory and switching overhead.

### For CPU-Bound Workloads (image processing, encryption, ML inference)

These workloads actually use the CPU. The bottleneck is computation. For these, you need **true parallelism** — multiple CPU cores working simultaneously.

| Model | Language Examples | Why It Works Here |
| :--- | :--- | :--- |
| OS Threads / Processes | Python multiprocessing, C++, Java | True parallel execution on multiple cores |
| Worker Pools | Go goroutines + GOMAXPROCS | Go uses all cores automatically |
| Avoid | Node.js / Python asyncio alone | Single-threaded; CPU work blocks everything |

> [!IMPORTANT]
> In Python, there's a famous limitation called the **Global Interpreter Lock (GIL)** — even with multiple threads, only one thread can execute Python bytecode at a time. This means Python threads cannot achieve true parallelism for CPU-bound work (though `multiprocessing` can). It has no effect on I/O-bound concurrency since threads release the GIL during I/O waits.

### The Real World: You Usually Need Both

A mature backend system typically needs both concurrency and parallelism:

- **Concurrency** to handle thousands of simultaneous HTTP requests, database connections, and background jobs efficiently without wasting CPU cycles during I/O waits.
- **Parallelism** (optional, only if needed) to run CPU-intensive tasks like image resizing, report generation, or ML inference without blocking your request handlers.

This is exactly why Go is such a powerful backend language: goroutines give you massive I/O concurrency with virtually zero overhead, and `GOMAXPROCS` automatically enables parallelism across all CPU cores for CPU-bound work — all with the clean, readable, sequential-looking code you saw above.

---

## Common Gotchas & Pitfalls

### 1. Doing CPU-Intensive Work on the Event Loop Thread

```javascript
// ❌ BAD: Blocks Node.js event loop for all users
app.get('/process', (req, res) => {
    const result = hugeJsonTransformation(req.body); // 500ms of CPU work
    res.json(result);
});

// ✓ GOOD: Offload to a Worker Thread
const { Worker } = require('worker_threads');
app.get('/process', (req, res) => {
    const worker = new Worker('./heavy_task.js', { workerData: req.body });
    worker.on('message', result => res.json(result));
});
```

### 2. Not Awaiting Async Operations (Forgetting `await`)

```javascript
// ❌ BAD: The function doesn't wait for the DB. Race condition waiting to happen.
async function updateUserBalance(userId, amount) {
    const user = db.getUser(userId); // Missing await! user is a Promise, not data.
    user.balance += amount;    // Operating on a Promise object — this is wrong.
    await db.save(user);
}

// ✓ GOOD: Always await async operations
async function updateUserBalance(userId, amount) {
    const user = await db.getUser(userId);
    user.balance += amount;
    await db.save(user);
}
```

### 3. Creating OS Threads for IO-Bound Work in Python

```python
# ❌ Not great for 10,000 concurrent connections
import threading
threads = [threading.Thread(target=handle_request, args=(req,)) for req in requests]

# ✓ Better: Use asyncio for IO-bound concurrency
import asyncio
async def handle_request(req):
    result = await db.query("SELECT * FROM users")
    return result
asyncio.gather(*[handle_request(r) for r in requests])
```

---

## Summary: The Mental Model You Need

Let's summarize everything into a clean mental framework:

```
                    Your Backend Workload
                           │
           ┌───────────────┴───────────────┐
           │                               │
      IO-Bound                        CPU-Bound
  (waiting for network,           (actual computation:
   database, files...)             encryption, images...)
           │                               │
           ▼                               ▼
    High Concurrency               True Parallelism
  (async/await, goroutines,     (multiple OS threads,
   virtual threads, epoll)       multiple processes,
                                  GOMAXPROCS > 1)
```

### The Three Concurrency Models Summarized

| Model | How It Works | Best For | Trade-off |
| :--- | :--- | :--- | :--- |
| **OS Threads** | OS manages each thread; heavy stack, context switch | CPU-bound work; solid baseline | Memory-heavy; context switch overhead |
| **Event Loop** | Single thread; callbacks/async; no context switch | High-concurrency IO-bound workloads | Blocks on any CPU-intensive work |
| **Virtual Threads (Goroutines)** | Runtime scheduler atop OS threads; tiny stack | Both IO and CPU-bound; go-to for Go | Requires runtime support (not universal) |

### The Three Rules to Code By

1. **For IO-bound → Use concurrency**. `async/await`, goroutines, event loop. Never block while waiting.
2. **For CPU-bound → Use parallelism**. Multiple threads or processes. Don't mix CPU-heavy work into your event loop.
3. **For shared state → Protect it**. Use mutexes for simple shared variables. Prefer message-passing (channels) over shared memory when possible.

---

## Recommended Reading

This video and blog cover the mental model. To go deeper into the internals:

1. **"Operating Systems: Three Easy Pieces"** (Remzi & Andrea Arpaci-Dusseau) — Free online. The definitive resource on OS schedulers, threads, locks, and concurrency primitives at the operating system level.
2. **Go's Concurrency Patterns** — The official Go blog has excellent articles on goroutines, channels, and the `sync` package.
3. **Node.js Event Loop documentation** — The official Node.js docs explain `libuv`, the event loop phases, and the worker thread API.

---

## Conclusion

Understanding concurrency and parallelism is not about memorizing keywords. It is about having the right mental model of **what your CPU is doing at every moment**.

The core insight:

- **95% of the time** in a typical backend, your program is **waiting for I/O** — not computing. Concurrency lets you fill that idle time by working on other tasks.
- **Parallelism** is for the cases where the CPU *is* the bottleneck, and you want multiple cores attacking the problem simultaneously.
- The **event loop** and **goroutines** are two brilliant engineering solutions to maximize efficiency for I/O-bound backends.
- **Race conditions** are the enemy of shared state. Protect shared data with locks, or better yet, design systems where state is owned by one place and updated via message-passing.

The next time you write `await`, picture your function pausing at that line, handing control to the event loop, and having the event loop juggle a hundred other tasks while your I/O completes in the background. That image — of efficient, non-wasteful, collaborative execution — is what concurrency is all about.
