# Understanding Celery: Asynchronous Task Queues in Django

## What Is Celery and Why Do We Need It?

### The Problem Space

Imagine you walk into a busy restaurant and place an order. Now imagine the waiter **freezes in place** and doesn't come back to you, doesn't take anyone else's order, doesn't do *anything* — until your food is fully cooked, plated, and ready. Only then does he unfreeze, hand you the food, and move on to the next customer.

That would be a disaster, right?

That's exactly what happens in Django when you do something slow **inside a request-response cycle.**

![celery](https://miro.medium.com/v2/resize:fit:1100/format:webp/1*aTH9Reaz_urPtQKtePoh4w.png)

---

### The Blocking Request Problem

When a user hits your Django view, Django:

1. Receives the request
2. Runs your view code
3. **Waits** for everything to finish
4. Returns the response

So if your view does something like this:

```python
def signup(request):
    user = User.objects.create(...)
    send_welcome_email(user)   # Takes 3 seconds 😬
    generate_pdf_report(user)  # Takes 5 seconds 😱
    return HttpResponse("Welcome!")
```

Your user waits **8 seconds** staring at a spinner. The server is blocked. No other requests can be efficiently handled during this time. If 100 users sign up at once — your server is on its knees.

---

### Introducing Celery

**Celery is a task queue.** It lets you say:

> *"Hey, don't do this work right now. Hand it off to a background worker and let me get back to the user immediately."*

Back to the restaurant analogy:

| Restaurant | Django + Celery |
|---|---|
| Waiter | Django view |
| Kitchen | Celery worker |
| Order ticket | Celery task |
| Ticket window | Message broker (Redis) |

The waiter **doesn't cook the food**. He writes a ticket, passes it to the kitchen, and immediately goes back to serve other customers. The kitchen works independently.

---

### With Celery, your view becomes:

```python
def signup(request):
    user = User.objects.create(...)
    send_welcome_email.delay(user.id)   # 👈 handed off instantly
    generate_pdf_report.delay(user.id)  # 👈 handed off instantly
    return HttpResponse("Welcome!")     # Returns in milliseconds ✅
```

The user gets a response **immediately**. The email and PDF are processed in the background by Celery workers — completely separate processes.

---

### When do you actually need Celery?

- Sending emails or SMS
- Generating reports / PDFs
- Processing uploaded images/videos
- Making slow API calls (payment gateways, etc.)
- Sending thousands of push notifications
- Any job that takes more than ~500ms

---

## What Is A Broker and Why Redis?

### The Problem Space

So we said Celery lets you "hand off" tasks to background workers. But think about this —

Django is one process. Celery workers are **completely separate processes**, possibly on different servers entirely. How does Django *talk* to those workers?

They can't just call each other directly. They need a **middleman**.

---

### The Analogy

Think of a **post office**.

When you want to send a package:
- You don't drive to the recipient's house yourself
- You drop the package at the **post office**
- The post office **holds it**
- The delivery guy **picks it up** when he's ready and delivers it

| Post Office World | Celery World |
|---|---|
| You (sender) | Django |
| Post office | **Message Broker** |
| Package | Task message |
| Delivery guy | Celery Worker |

The broker is just a **waiting room for tasks.** Django drops tasks in. Workers pick them up.

---

### What exactly is a "broker"?

A broker is a message queue system. It:

1. **Receives** task messages from Django
2. **Stores** them reliably in a queue
3. **Delivers** them to available workers
4. Makes sure a task isn't lost if a worker crashes

---

### Why Redis specifically?

You can use several brokers with Celery — RabbitMQ, Redis, Amazon SQS. But **Redis is the most popular choice** for Django projects. Here's why:

| Reason | What it means |
|---|---|
| 🚀 Fast | Redis is in-memory, blazing fast for queuing |
| 🧰 You probably have it | Most Django projects use Redis for caching already |
| 🛠️ Simple to set up | One `pip install`, one URL |
| ✅ Reliable enough | For most production use cases, Redis is solid |

RabbitMQ is more powerful and technically a "true" message broker — but it's heavier, harder to set up, and overkill for most projects.

---

### What actually happens under the hood?

When you call `send_welcome_email.delay(user.id)`:

```
Django  →  serializes task into JSON  →  pushes to Redis queue
                                               ↓
                                         Redis holds it
                                               ↓
                              Celery Worker polls Redis → picks it up → runs it
```

Redis is just holding a **list of jobs** — like a to-do list that workers pull from.

---

### Visualizing the Redis queue

Inside Redis, Celery creates a key (default: `celery`) that acts as a queue:

```
Redis LIST "celery":
[
  {"task": "myapp.tasks.send_welcome_email", "args": [42], ...},
  {"task": "myapp.tasks.generate_pdf",       "args": [42], ...},
]
```

Workers pop from the left. Django pushes to the right. Simple as that.

---

### One line config in Django

```python
# settings.py
CELERY_BROKER_URL = 'redis://localhost:6379/0'
```

That's the entire broker setup. We'll wire everything together in the next topic.

---

## How Celery Connects to Django

### The Big Picture First

So far we know:
- Django needs to hand off slow tasks ✅
- Redis acts as the middleman (broker) ✅

Now — how do we actually **wire Celery into a Django project?**

Think of it like hiring a contractor for your restaurant. You need to:
1. Register them officially (create a Celery app)
2. Give them the address of the post office (broker URL)
3. Make sure they know your restaurant's rules (Django settings)
4. Tell them to be on duty when the restaurant opens (run the worker)

---

### Step by Step — Let's build it

Assume this is your Django project structure:

```
myproject/
├── myproject/
│   ├── __init__.py
│   ├── settings.py
│   ├── celery.py        ← 👈 we create this
│   └── urls.py
├── myapp/
│   ├── tasks.py         ← 👈 we create this later
│   └── views.py
└── manage.py
```

---

### Step 1 — Install dependencies

```bash
pip install celery redis django-celery-results
```

---

### Step 2 — Create `myproject/celery.py`

This is the **heart** of the setup. This file creates the Celery application instance.

```python
# myproject/celery.py

import os
from celery import Celery

# Tell Celery where your Django settings are
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')

# Create the Celery app instance
app = Celery('myproject')

# Pull Celery config from Django settings
# namespace='CELERY' means all celery settings in settings.py
# must start with CELERY_ prefix
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks.py in every INSTALLED_APPS
app.autodiscover_tasks()
```

#### Why each line matters:

| Line | Why it's there |
|---|---|
| `os.environ.setdefault(...)` | Celery runs as a separate process — it needs to know where Django settings are |
| `Celery('myproject')` | Creates the app instance, named after your project |
| `config_from_object(...)` | Lets you configure Celery inside `settings.py` instead of a separate file |
| `autodiscover_tasks()` | Automatically finds `tasks.py` in all your Django apps — you don't have to import them manually |

---

### Step 3 — Hook Celery into Django's `__init__.py`

This ensures Celery starts **whenever Django starts.**

```python
# myproject/__init__.py

from .celery import app as celery_app

__all__ = ('celery_app',)
```

Without this, Celery might not be initialized when Django boots up and your tasks won't be found.

---

### Step 4 — Configure Celery in `settings.py`

```python
# settings.py

# Broker — where tasks are sent
CELERY_BROKER_URL = 'redis://localhost:6379/0'

# Result backend — where task results are stored (we'll cover this deeply later)
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'

# Serialize tasks as JSON (safe and readable)
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

# Timezone — always match your Django timezone
CELERY_TIMEZONE = 'UTC'
```

---

### Step 5 — Write your first task

```python
# myapp/tasks.py

from celery import shared_task

@shared_task
def send_welcome_email(user_id):
    # We'll explain shared_task vs app.task in the next topic
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    print(f"Sending welcome email to {user.email}")
    # your email logic here
```

---

### Step 6 — Call it from a Django view

```python
# myapp/views.py

from django.http import HttpResponse
from .tasks import send_welcome_email

def signup(request):
    # ... create user ...
    send_welcome_email.delay(user.id)  # 👈 handed off to Celery
    return HttpResponse("Welcome! Email is on its way.")
```

---

### Step 7 — Run the Celery worker

Open a **second terminal** (separate from your Django server):

```bash
celery -A myproject worker --loglevel=info
```

| Part | Meaning |
|---|---|
| `-A myproject` | Use the Celery app defined in `myproject/celery.py` |
| `worker` | Start a worker process |
| `--loglevel=info` | Show info logs so you can see tasks being processed |

You'll see output like:
```
[tasks]
  . myapp.tasks.send_welcome_email

[INFO] Connected to redis://localhost:6379/0
[INFO] Ready to accept tasks
```

---

### The full flow visualized

```
User hits /signup
      ↓
Django view runs
      ↓
send_welcome_email.delay(user.id)
      ↓
Task serialized → pushed to Redis
      ↓
Celery worker (separate terminal) picks it up
      ↓
Runs send_welcome_email(user.id)
      ↓
Django already returned response long ago ✅
```

---

## Tasks — What They Are, How to Write Them, `Shared_Task` vs `App.Task`

### What IS a Task exactly?

Remember our restaurant analogy — a task is the **order ticket** passed to the kitchen.

But more precisely, a Celery task is just a **Python function with superpowers.** When you decorate a function with `@shared_task` or `@app.task`, Celery:

- Registers it in a task registry (like a menu of available jobs)
- Gives it methods like `.delay()`, `.apply_async()`, `.retry()`
- Tracks its state (pending, running, success, failed)
- Makes it callable from anywhere in your project

---

### The Two Ways to Define Tasks

There are two decorators you'll see in the wild:

```python
# Way 1
from celery import shared_task

@shared_task
def my_task():
    pass

# Way 2
from myproject.celery import app

@app.task
def my_task():
    pass
```

They look similar. But they have an **important difference.** Let's understand it properly.

---

### `app.task` — The Direct Approach

```python
# myapp/tasks.py
from myproject.celery import app   # 👈 direct import of your Celery instance

@app.task
def send_welcome_email(user_id):
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    print(f"Sending email to {user.email}")
```

This works. But notice — your `tasks.py` is now **tightly coupled** to `myproject.celery`.

This means:
- If you move this app to another project — it breaks
- If you write tests — you have to import the whole Celery app
- Reusability goes out the window

---

### `shared_task` — The Right Way for Django

```python
# myapp/tasks.py
from celery import shared_task   # 👈 no direct dependency on your project

@shared_task
def send_welcome_email(user_id):
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    print(f"Sending email to {user.email}")
```

`shared_task` is a **lazy decorator.** It says:

> *"I don't know which Celery app I belong to yet — bind me to whatever app is running at the time."*

This means your Django app becomes **fully reusable and portable.** It's the recommended approach for Django projects.

| | `app.task` | `shared_task` |
|---|---|---|
| Couples to your Celery instance | ✅ Yes | ❌ No |
| Works in reusable Django apps | ❌ No | ✅ Yes |
| Good for single project | ✅ Yes | ✅ Yes |
| Recommended for Django | ❌ | ✅ |

---

### Writing Tasks Properly

#### ❌ Bad — passing Django objects directly

```python
@shared_task
def send_welcome_email(user):   # 👈 never pass objects
    print(user.email)
```

**Why is this bad?**

Celery serializes task arguments into JSON to send through Redis. Django model instances **cannot be serialized to JSON.** This will crash or cause weird bugs.

#### ✅ Good — always pass primitive IDs

```python
@shared_task
def send_welcome_email(user_id):   # 👈 pass the ID
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    print(user.email)
```

Fetch the object **inside** the task. Always. This also ensures you get **fresh data** from the DB at the time the task runs, not stale data from when it was queued.

---

### The `bind=True` option — accessing task metadata

Sometimes your task needs to know about **itself** — its task ID, how many times it's retried, etc. Use `bind=True`:

```python
@shared_task(bind=True)
def send_welcome_email(self, user_id):  # 👈 self = the task instance
    print(f"Task ID: {self.request.id}")
    print(f"Retries so far: {self.request.retries}")
    
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    print(f"Sending email to {user.email}")
```

`self` here is not a class instance — it's the **task instance** Celery injects. We'll use this heavily when we get to retries.

---

### Task options you'll use often

```python
@shared_task(
    bind=True,
    max_retries=3,          # max retry attempts
    default_retry_delay=60, # wait 60s between retries
    name='myapp.send_welcome_email'  # explicit name (recommended)
)
def send_welcome_email(self, user_id):
    pass
```

#### Why set an explicit `name`?

By default Celery auto-generates task names from the module path. If you ever **refactor or move files**, old tasks sitting in Redis with the old name will fail. Explicit names protect you from that.

---

### Where to put the import — inside the task

Notice we import Django models **inside** the task function:

```python
@shared_task
def send_welcome_email(user_id):
    from django.contrib.auth.models import User  # 👈 import inside
    user = User.objects.get(id=user_id)
```

Why? To **avoid circular imports.** `tasks.py` is imported early by Celery. If you import models at the top level, you can hit Django's app registry not being ready yet. Importing inside the function is safe and idiomatic.

---

### Full clean example

```python
# myapp/tasks.py

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)  # proper task logging

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name='myapp.tasks.send_welcome_email'
)
def send_welcome_email(self, user_id):
    from django.contrib.auth.models import User
    
    logger.info(f"Starting task for user_id={user_id}")
    
    try:
        user = User.objects.get(id=user_id)
        # send email logic here...
        logger.info(f"Email sent to {user.email}")
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found. Aborting.")
        # don't retry if user doesn't exist
        return
    except Exception as exc:
        logger.error(f"Failed: {exc}")
        raise self.retry(exc=exc)  # we'll cover this deeply in topic 7
```

---

### Quick summary

| Concept | Rule |
|---|---|
| `shared_task` vs `app.task` | Always use `shared_task` in Django |
| Arguments | Always pass IDs, never objects |
| `bind=True` | Use when task needs self-awareness (retries, task ID) |
| Imports | Import models inside the task function |
| Naming | Always set an explicit `name` |
| Logging | Use `get_task_logger` not `print` |

---

## `Apply_Async` vs `Delay` vs `Apply` — Differences and When to Use Each

### The Analogy First

You've written your order ticket (the task). Now you need to **send it to the kitchen.** But there are different ways to send it:

- 📱 **Call the kitchen directly** — synchronous, blocks everything (`apply`)
- 📝 **Slip the ticket through the window normally** — simple, fast (`delay`)
- 📋 **Slip the ticket with special instructions** — scheduled time, priority, queue (`apply_async`)

---

### The Three Methods

#### 1. `apply()` — Synchronous, Blocking (Almost Never Use in Production)

```python
result = send_welcome_email.apply(args=[user.id])
```

This runs the task **right here, right now, in the same process.** It does NOT go through Redis. It does NOT use a worker.

It's like the waiter walking into the kitchen and cooking the food himself.

**When to use it:**
- ✅ Unit testing (no broker needed)
- ✅ Debugging a task in isolation
- ❌ Never in production views

```python
# In tests
result = send_welcome_email.apply(args=[42])
print(result.get())  # blocks until done, returns result
```

---

#### 2. `delay()` — Simple Async (Most Common)

```python
send_welcome_email.delay(user.id)
```

This is the **shortcut.** It sends the task to Redis and returns immediately. Workers pick it up asynchronously.

`delay()` is literally just a wrapper around `apply_async()` with no extra options.

```python
# These two are identical
send_welcome_email.delay(user.id)
send_welcome_email.apply_async(args=[user.id])
```

**When to use it:**
- ✅ Simple fire-and-forget tasks
- ✅ When you don't need scheduling or special options
- ✅ 80% of your day-to-day usage

---

#### 3. `apply_async()` — Full Control (Use When You Need Options)

```python
send_welcome_email.apply_async(
    args=[user.id],       # positional arguments
    kwargs={'force': True}, # keyword arguments
    countdown=60,          # wait 60 seconds before running
    eta=datetime(...),     # run at a specific time
    queue='high_priority', # send to a specific queue
    retry=True,            # retry if broker connection fails
    expires=300,           # discard task if not picked up in 5 mins
)
```

This is the **full power version.** Use it when you need control over how and when the task runs.

---

### Side by Side Comparison

| Feature | `apply` | `delay` | `apply_async` |
|---|---|---|---|
| Goes through broker | ❌ No | ✅ Yes | ✅ Yes |
| Blocks the caller | ✅ Yes | ❌ No | ❌ No |
| Supports countdown/eta | ❌ No | ❌ No | ✅ Yes |
| Supports custom queue | ❌ No | ❌ No | ✅ Yes |
| Supports expiry | ❌ No | ❌ No | ✅ Yes |
| Use in production | ❌ Never | ✅ Yes | ✅ Yes |
| Use in tests | ✅ Yes | ⚠️ Needs broker | ⚠️ Needs broker |

---

### Return Value — `AsyncResult`

Both `delay()` and `apply_async()` return an **`AsyncResult` object** immediately:

```python
# myapp/views.py

result = send_welcome_email.delay(user.id)

print(result.id)       # unique task ID, e.g. "a1b2c3d4-..."
print(result.status)   # "PENDING" right now
print(result.get())    # ⚠️ BLOCKS until task finishes — avoid in views
```

The task ID is very useful — you can **store it and check the status later:**

```python
# views.py — kick off the task, save the ID
def signup(request):
    user = User.objects.create(...)
    result = send_welcome_email.delay(user.id)
    
    # save task_id to DB or session for status polling
    request.session['email_task_id'] = result.id
    
    return HttpResponse("Welcome!")

# views.py — check status later via AJAX polling
def check_email_status(request):
    from celery.result import AsyncResult
    
    task_id = request.session.get('email_task_id')
    result = AsyncResult(task_id)
    
    return JsonResponse({
        'status': result.status,   # PENDING, SUCCESS, FAILURE...
        'ready': result.ready(),   # True if done
    })
```

---

### Passing Arguments Correctly

```python
# Task definition
@shared_task
def process_order(order_id, notify=True, priority='normal'):
    pass

# delay — positional args only, kwargs after
process_order.delay(42, notify=False, priority='high')

# apply_async — use args list and kwargs dict
process_order.apply_async(
    args=[42],
    kwargs={'notify': False, 'priority': 'high'}
)
```

---

### Real World Example — when to use which

```python
# myapp/views.py

from django.http import JsonResponse
from .tasks import (
    send_welcome_email,
    send_newsletter,
    process_payment,
)

def signup(request):
    user = User.objects.create(...)
    
    # Simple fire and forget → use delay
    send_welcome_email.delay(user.id)
    
    return JsonResponse({'status': 'ok'})

def schedule_newsletter(request):
    # Need to send at a specific time → use apply_async
    send_newsletter.apply_async(
        args=[request.user.id],
        countdown=3600,  # send 1 hour from now
        queue='newsletters',
        expires=7200,    # discard if not run within 2 hours
    )
    return JsonResponse({'status': 'scheduled'})

def checkout(request):
    # High priority payment → use apply_async with priority queue
    process_payment.apply_async(
        args=[request.user.id, request.POST['order_id']],
        queue='high_priority',
        retry=True,
    )
    return JsonResponse({'status': 'processing'})
```

---

### The Golden Rule

> Use `delay()` by default. Switch to `apply_async()` the moment you need **any** extra control. Never use `apply()` in production.

---

## ETA and Countdown — Scheduling Tasks For The Future

### The Analogy First

Imagine you're sending a letter, but you tell the post office:

- **"Deliver this in exactly 30 minutes"** — that's a `countdown`
- **"Deliver this at 9:00 AM tomorrow"** — that's an `eta`

The post office (Redis) holds the letter and the worker doesn't touch it until the right moment.

---

### The Problem Without This

Without scheduling, every task runs **as soon as possible.** But real world needs are different:

- Send a reminder email **1 hour after signup**
- Send a daily report **every morning at 8 AM**
- Retry a failed payment **24 hours later**
- Expire a discount code **after 15 minutes**

You can't do any of this with just `.delay()`. You need `countdown` or `eta`.

---

### `countdown` — Run After N Seconds

`countdown` is the **simpler one.** You just say how many seconds to wait.

```python
# Run after 60 seconds
send_reminder.apply_async(args=[user.id], countdown=60)

# Run after 1 hour
send_reminder.apply_async(args=[user.id], countdown=60 * 60)

# Run after 24 hours
send_reminder.apply_async(args=[user.id], countdown=60 * 60 * 24)
```

Clean and simple. No datetime math needed.

---

### `eta` — Run At a Specific Datetime

`eta` means **Estimated Time of Arrival.** You give it an exact `datetime` object.

```python
from datetime import datetime, timedelta
from django.utils import timezone

# Run at a specific time tomorrow
tomorrow_9am = timezone.now().replace(
    hour=9, minute=0, second=0, microsecond=0
) + timedelta(days=1)

send_daily_report.apply_async(
    args=[user.id],
    eta=tomorrow_9am
)
```

#### ⚠️ Always use timezone-aware datetimes

```python
# ❌ Bad — naive datetime, can cause bugs
from datetime import datetime
eta = datetime(2025, 6, 1, 9, 0, 0)  # no timezone info

# ✅ Good — timezone aware
from django.utils import timezone
eta = timezone.now() + timedelta(hours=1)
```

If your `CELERY_TIMEZONE` is set to `'UTC'` in settings, always make sure your `eta` is UTC-aware. Use Django's `timezone.now()` — it respects your settings.

---

### How Does This Actually Work?

This is an important detail many people miss.

When you schedule a task with `countdown` or `eta`, the task message **still goes to Redis immediately.** But the worker sees the scheduled time and says:

> *"It's not time yet. I'll check again later."*

The worker keeps the task in a special internal scheduler and **polls it periodically** until the time arrives. This means:

```
apply_async(countdown=3600)
        ↓
Task pushed to Redis immediately ✅
        ↓
Worker picks it up — sees ETA is 1hr from now
        ↓
Worker holds it internally, keeps checking time
        ↓
1 hour later — worker executes the task ✅
```

---

### Real World Django Examples

#### Example 1 — Send reminder 1 hour after signup

```python
# myapp/views.py

from django.http import JsonResponse
from .tasks import send_welcome_email, send_followup_reminder

def signup(request):
    user = User.objects.create(...)
    
    # Send welcome email immediately
    send_welcome_email.delay(user.id)
    
    # Send follow-up reminder after 1 hour
    send_followup_reminder.apply_async(
        args=[user.id],
        countdown=60 * 60  # 1 hour
    )
    
    return JsonResponse({'status': 'ok'})
```

---

#### Example 2 — Schedule a report for a specific time

```python
# myapp/tasks.py

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(name='myapp.tasks.send_daily_report')
def send_daily_report(user_id):
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    logger.info(f"Generating daily report for {user.email}")
    # report generation logic...

# myapp/views.py

from django.utils import timezone
from datetime import timedelta

def schedule_report(request):
    # Schedule for 8 AM tomorrow
    tomorrow = timezone.now() + timedelta(days=1)
    scheduled_time = tomorrow.replace(
        hour=8, minute=0, second=0, microsecond=0
    )
    
    send_daily_report.apply_async(
        args=[request.user.id],
        eta=scheduled_time
    )
    
    return JsonResponse({
        'status': 'scheduled',
        'runs_at': scheduled_time.isoformat()
    })
```

---

#### Example 3 — Expire a discount after 15 minutes

```python
# myapp/views.py

from .tasks import expire_discount_code

def generate_discount(request):
    code = DiscountCode.objects.create(user=request.user)
    
    # Auto-expire after 15 minutes
    expire_discount_code.apply_async(
        args=[code.id],
        countdown=60 * 15,
        expires=60 * 16   # discard task if not started within 16 mins
    )
    
    return JsonResponse({'code': code.value})
```

Notice `expires` here — this is different from `countdown`:

| Option | Meaning |
|---|---|
| `countdown` | Wait this many seconds **before running** |
| `eta` | Run at this **exact datetime** |
| `expires` | **Discard** the task if it hasn't started by this time |

`expires` is a safety net — if workers are overloaded and the task sits in the queue too long, it gets thrown away instead of running stale logic.

---

### `countdown` vs `eta` — Which to Use?

| Situation | Use |
|---|---|
| "Run in X seconds/minutes/hours" | `countdown` |
| "Run at a specific date and time" | `eta` |
| Simple relative delays | `countdown` |
| Scheduled jobs tied to calendar | `eta` |

---

### One Important Gotcha

```python
# ❌ This is wrong — task runs immediately, not after 1 hour
from datetime import timedelta
send_reminder.apply_async(args=[user.id], countdown=timedelta(hours=1))

# ✅ countdown must be an integer (seconds)
send_reminder.apply_async(args=[user.id], countdown=3600)
```

`countdown` only accepts **integers (seconds).** Not `timedelta` objects. A very common mistake.

---

### Summary

| Concept | Key Point |
|---|---|
| `countdown` | Integer seconds to wait before running |
| `eta` | Exact datetime to run at |
| `expires` | Discard task if not started in time |
| Timezone | Always use timezone-aware datetimes with `eta` |
| How it works | Task hits Redis immediately, worker waits internally |

---

## Task Retries — `Self.Retry()`, `Max_Retries`, Countdown Backoff

### The Analogy First

Imagine you send a courier to deliver a package. He arrives at the address but nobody's home. What should he do?

- Give up immediately? ❌ Too harsh
- Keep knocking every second forever? ❌ Too aggressive
- Try again later, wait a bit longer each time? ✅ Smart

That's exactly what Celery retries do. And the **"wait a bit longer each time"** part is called **exponential backoff** — one of the most important patterns in distributed systems.

---

### Why Do Tasks Fail in the Real World?

Before we look at code, understand WHY retries exist:

| Failure Reason | Example |
|---|---|
| External API is down | Stripe, Twilio, SendGrid temporarily unavailable |
| Database connection blip | Temporary network hiccup |
| Rate limiting | "Too many requests, try again in 30s" |
| Transient network errors | Timeout on an HTTP call |
| Third party service flaky | Email provider returns 503 |

These are **temporary** failures. The task would succeed if you just tried again. Retries handle exactly this.

---

### The Basic Retry

For retries to work, you **must** use `bind=True` — because you need `self` to call `self.retry()`:

```python
# myapp/tasks.py

from celery import shared_task
from celery.utils.log import get_task_logger
import requests

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    max_retries=3,              # try at most 3 times after first failure
    default_retry_delay=60,     # wait 60 seconds between retries
    name='myapp.tasks.send_sms'
)
def send_sms(self, user_id, message):
    from django.contrib.auth.models import User
    
    user = User.objects.get(id=user_id)
    
    try:
        response = requests.post('https://sms-api.example.com/send', json={
            'phone': user.phone,
            'message': message
        })
        response.raise_for_status()  # raises exception on 4xx/5xx
        logger.info(f"SMS sent to {user.phone}")
        
    except requests.exceptions.RequestException as exc:
        logger.warning(f"SMS failed for user {user_id}, retrying... ({exc})")
        raise self.retry(exc=exc)   # 👈 this is the key line
```

---

### Dissecting `self.retry()`

```python
raise self.retry(
    exc=exc,           # original exception — preserved in task state
    countdown=60,      # wait 60s before next attempt (overrides default)
    max_retries=5,     # override max_retries set in decorator
)
```

#### ⚠️ Critical — always `raise self.retry()`, never just call it

```python
# ❌ Wrong — task continues executing after this line
self.retry(exc=exc)

# ✅ Correct — task stops here, retry is scheduled
raise self.retry(exc=exc)
```

`self.retry()` returns a `Retry` exception. If you don't `raise` it, the task keeps running past that line — which is almost never what you want.

---

### What Happens When `max_retries` is Exceeded?

When all retries are exhausted, Celery **re-raises the original exception** and marks the task as `FAILURE`. You can customize this behavior:

```python
from celery.exceptions import MaxRetriesExceededError

@shared_task(
    bind=True,
    max_retries=3,
    name='myapp.tasks.send_sms'
)
def send_sms(self, user_id, message):
    from django.contrib.auth.models import User
    
    try:
        # ... your logic ...
        pass
        
    except requests.exceptions.RequestException as exc:
        try:
            raise self.retry(exc=exc, countdown=60)
            
        except MaxRetriesExceededError:
            # All retries exhausted — handle gracefully
            logger.error(f"SMS permanently failed for user {user_id}")
            # Maybe notify the team, update DB, trigger alert...
            SMSFailureLog.objects.create(user_id=user_id, reason=str(exc))
```

---

### Exponential Backoff — The Right Way to Retry

Fixed delays (60s, 60s, 60s) are okay. But **exponential backoff** is smarter:

> Wait longer and longer between each retry — giving the external service more time to recover

```
Attempt 1 fails → wait 2s
Attempt 2 fails → wait 4s
Attempt 3 fails → wait 8s
Attempt 4 fails → wait 16s
```

Here's how to implement it:

```python
@shared_task(
    bind=True,
    max_retries=5,
    name='myapp.tasks.send_sms'
)
def send_sms(self, user_id, message):
    from django.contrib.auth.models import User
    
    try:
        # ... your logic ...
        pass
        
    except requests.exceptions.RequestException as exc:
        # Exponential backoff: 2^retry_count seconds
        # retry 0 → 2s, retry 1 → 4s, retry 2 → 8s ...
        countdown = 2 ** self.request.retries
        
        logger.warning(
            f"Attempt {self.request.retries + 1} failed. "
            f"Retrying in {countdown}s..."
        )
        
        raise self.retry(exc=exc, countdown=countdown)
```

`self.request.retries` gives you the **current retry count** (starts at 0).

---

### Adding Jitter — Avoiding the Thundering Herd

Imagine 1000 tasks all fail at the same time and all retry after exactly 8 seconds. They all hammer your external service simultaneously — causing another failure.

**Jitter** adds a small random offset to spread retries out:

```python
import random

@shared_task(bind=True, max_retries=5)
def send_sms(self, user_id, message):
    try:
        pass  # your logic
        
    except requests.exceptions.RequestException as exc:
        # Exponential backoff + jitter
        base = 2 ** self.request.retries
        jitter = random.uniform(0, 1)  # random float between 0 and 1
        countdown = base + jitter
        
        raise self.retry(exc=exc, countdown=countdown)
```

Now retries are spread across a small window — no thundering herd. ✅

---

### Don't Retry Everything — Be Selective

Not all exceptions should trigger a retry. A user not found in the DB won't fix itself by retrying:

```python
@shared_task(
    bind=True,
    max_retries=3,
    name='myapp.tasks.process_payment'
)
def process_payment(self, user_id, order_id):
    from django.contrib.auth.models import User
    from myapp.models import Order
    
    try:
        user = User.objects.get(id=user_id)
        order = Order.objects.get(id=order_id)
        
        response = call_payment_gateway(user, order)
        
    except User.DoesNotExist:
        # ❌ Don't retry — user is gone, retrying won't help
        logger.error(f"User {user_id} not found. Aborting.")
        return
    
    except Order.DoesNotExist:
        # ❌ Don't retry — same reason
        logger.error(f"Order {order_id} not found. Aborting.")
        return
    
    except requests.exceptions.Timeout as exc:
        # ✅ Retry — temporary network issue
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
    
    except requests.exceptions.RequestException as exc:
        # ✅ Retry — transient failure
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

---

### Full Production-Grade Retry Example

```python
# myapp/tasks.py

import random
import requests
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    max_retries=5,
    name='myapp.tasks.send_welcome_email'
)
def send_welcome_email(self, user_id):
    from django.contrib.auth.models import User
    from myapp.models import EmailLog
    
    try:
        user = User.objects.get(id=user_id)
        
        response = requests.post(
            'https://api.sendgrid.com/v3/mail/send',
            json={'to': user.email, 'subject': 'Welcome!'},
            timeout=10
        )
        response.raise_for_status()
        
        logger.info(f"Welcome email sent to {user.email}")
        
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found. No retry.")
        return  # abort cleanly
    
    except requests.exceptions.RequestException as exc:
        countdown = (2 ** self.request.retries) + random.uniform(0, 1)
        logger.warning(
            f"Email failed for user {user_id}. "
            f"Retry {self.request.retries + 1}/5 in {countdown:.1f}s"
        )
        
        try:
            raise self.retry(exc=exc, countdown=countdown)
            
        except MaxRetriesExceededError:
            logger.error(f"Email permanently failed for user {user_id}")
            EmailLog.objects.create(
                user_id=user_id,
                status='failed',
                reason=str(exc)
            )
```

---

### Summary

| Concept | Key Point |
|---|---|
| `bind=True` | Required to access `self.retry()` |
| `raise self.retry()` | Always `raise` it, never just call it |
| `max_retries` | Max attempts after initial failure |
| `self.request.retries` | Current retry count, starts at 0 |
| Exponential backoff | `2 ** self.request.retries` |
| Jitter | Add `random.uniform(0,1)` to avoid thundering herd |
| Selective retry | Only retry transient errors, not logic errors |
| `MaxRetriesExceededError` | Catch it to handle permanent failures gracefully |

---

## Task States — Pending, Started, Success, Failure, Retry

### The Analogy First

Think of tracking a food delivery order. After you place it, you can check its status at any time:

- 🕐 **Order received** — waiting for restaurant to confirm
- 👨‍🍳 **Being prepared** — kitchen is working on it
- ✅ **Out for delivery** — done, on its way
- ❌ **Cancelled** — something went wrong
- 🔄 **Re-attempting** — courier tried, will retry

Celery tasks have exactly the same kind of lifecycle. Every task moves through a series of **states** you can track in real time.

---

### The Built-in States

```
PENDING → STARTED → SUCCESS
                  ↘ FAILURE
                  ↘ RETRY → STARTED → SUCCESS
                                    ↘ FAILURE
```

| State | Meaning |
|---|---|
| `PENDING` | Task is queued, not yet picked up by a worker |
| `STARTED` | Worker has picked it up and is executing it |
| `SUCCESS` | Task completed successfully |
| `FAILURE` | Task raised an unhandled exception |
| `RETRY` | Task failed, scheduled for retry |
| `REVOKED` | Task was cancelled before execution |

---

### PENDING — The Default State

This is the most **misunderstood** state. Here's the key insight:

> **Every task ID is PENDING by default — even ones that don't exist**

```python
from celery.result import AsyncResult

# This task ID doesn't exist anywhere
result = AsyncResult('fake-id-that-never-existed')
print(result.status)  # PENDING 😱
```

Why? Because Celery doesn't store "task was queued" in the result backend by default. PENDING just means **"I don't know about this task yet."**

This has a practical consequence:

```python
# You cannot tell the difference between:
# 1. A task sitting in the queue waiting to run
# 2. A task ID you completely made up
# Both return PENDING ⚠️
```

We'll address this with custom states shortly.

---

### STARTED — Task is Running

By default, Celery does **not** record the STARTED state. You have to enable it:

```python
# settings.py
CELERY_TASK_TRACK_STARTED = True  # 👈 add this
```

Without this, tasks jump straight from PENDING to SUCCESS/FAILURE. With it, you get the full lifecycle which is critical for long-running tasks where you want to show a progress indicator.

---

### Checking State in Django

```python
# myapp/views.py

from celery.result import AsyncResult
from django.http import JsonResponse

def check_task_status(request, task_id):
    result = AsyncResult(task_id)
    
    response = {
        'task_id': task_id,
        'status': result.status,
        'ready': result.ready(),      # True if SUCCESS or FAILURE
        'successful': result.successful(),  # True only if SUCCESS
        'failed': result.failed(),    # True only if FAILURE
    }
    
    # Only add result if task succeeded
    if result.successful():
        response['result'] = result.get()  # actual return value
    
    # Only add error info if task failed
    if result.failed():
        response['error'] = str(result.result)  # the exception
    
    return JsonResponse(response)
```

---

### Custom States — Tracking Progress

Built-in states are coarse. For long tasks (like processing 10,000 rows), you want **granular progress updates.** Celery lets you define custom states:

```python
# myapp/tasks.py

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(
    bind=True,
    name='myapp.tasks.process_csv'
)
def process_csv(self, file_path):
    import csv
    
    # Read all rows first
    with open(file_path) as f:
        rows = list(csv.reader(f))
    
    total = len(rows)
    
    for index, row in enumerate(rows):
        # Process each row...
        process_single_row(row)
        
        # Update task state with progress
        self.update_state(
            state='PROGRESS',          # 👈 custom state name
            meta={
                'current': index + 1,
                'total': total,
                'percent': round((index + 1) / total * 100, 2)
            }
        )
    
    # Return final result
    return {
        'status': 'complete',
        'total_processed': total
    }
```

Now on the Django side, you can **poll this progress:**

```python
# myapp/views.py

def check_csv_progress(request, task_id):
    result = AsyncResult(task_id)
    
    if result.state == 'PENDING':
        response = {
            'status': 'pending',
            'progress': 0
        }
    
    elif result.state == 'PROGRESS':
        # result.info contains the meta dict we passed
        response = {
            'status': 'running',
            'current': result.info.get('current', 0),
            'total': result.info.get('total', 0),
            'percent': result.info.get('percent', 0),
        }
    
    elif result.state == 'SUCCESS':
        response = {
            'status': 'complete',
            'result': result.get()
        }
    
    elif result.state == 'FAILURE':
        response = {
            'status': 'failed',
            'error': str(result.info)  # result.info is the exception here
        }
    
    else:
        response = {'status': result.state}
    
    return JsonResponse(response)
```

---

### The RETRY State

When `self.retry()` is called, the task briefly enters `RETRY` state before being re-queued:

```python
@shared_task(
    bind=True,
    max_retries=3,
    name='myapp.tasks.send_sms'
)
def send_sms(self, user_id):
    try:
        # ... your logic ...
        pass
        
    except Exception as exc:
        # Task enters RETRY state here
        # Visible if you check result.status between attempts
        raise self.retry(exc=exc, countdown=5)
```

You can inspect RETRY state the same way:

```python
result = AsyncResult(task_id)

if result.state == 'RETRY':
    print(f"Task is retrying. Reason: {result.info}")
```

---

### REVOKED — Cancelling a Task

You can cancel a queued task before it runs:

```python
from celery.result import AsyncResult

# Cancel a task
result = AsyncResult(task_id)
result.revoke()

# Cancel and kill if already running
result.revoke(terminate=True, signal='SIGKILL')
```

#### ⚠️ Important caveat

`revoke()` only works if the task **hasn't started yet.** Once a worker is executing it, `terminate=True` is needed to kill the process — but use this carefully in production.

---

### Full State Flow — Real World Pattern

Here's the complete pattern you'd use in a real Django app:

```python
# myapp/views.py

from django.http import JsonResponse
from celery.result import AsyncResult
from .tasks import process_csv

# 1. Kick off the task
def upload_csv(request):
    file_path = save_uploaded_file(request.FILES['csv'])
    
    result = process_csv.apply_async(args=[file_path])
    
    # Store task_id — you'll need it to check status
    return JsonResponse({
        'task_id': result.id,
        'status': 'queued'
    })

# 2. Poll status from frontend (via AJAX every 2 seconds)
def task_status(request, task_id):
    result = AsyncResult(task_id)
    
    state_map = {
        'PENDING': {'status': 'queued',   'progress': 0},
        'STARTED': {'status': 'started',  'progress': 0},
        'RETRY':   {'status': 'retrying', 'progress': 0},
        'FAILURE': {
            'status': 'failed',
            'error': str(result.info)
        },
        'SUCCESS': {
            'status': 'complete',
            'result': result.get()
        },
    }
    
    if result.state == 'PROGRESS':
        return JsonResponse({
            'status': 'running',
            'percent': result.info.get('percent', 0)
        })
    
    return JsonResponse(
        state_map.get(result.state, {'status': result.state})
    )
```

---

### Summary

| State | Meaning | Gotcha |
|---|---|---|
| `PENDING` | Unknown / queued | Also returned for fake task IDs |
| `STARTED` | Running | Must enable `CELERY_TASK_TRACK_STARTED` |
| `SUCCESS` | Completed | `result.get()` returns the value |
| `FAILURE` | Crashed | `result.info` holds the exception |
| `RETRY` | Will try again | Briefly visible between attempts |
| `REVOKED` | Cancelled | Only works before task starts (without terminate) |
| Custom | Your own states | Use `self.update_state()` |

---

## Result Backend — What it Is and Why We Need It

### The Analogy First

Remember our restaurant. The waiter hands the order ticket to the kitchen and walks away. Now imagine you want to know:

- Was my order completed?
- What exactly did they make?
- Did something go wrong?

The kitchen needs a **whiteboard** where it writes down the result of every order. Anyone can walk up to that whiteboard, look up their order number, and see what happened.

That whiteboard is the **result backend.**

---

### What is the Result Backend?

The broker (Redis) is responsible for **delivering tasks to workers.**

But once a worker finishes a task — where does the result go? Who remembers it?

That's the result backend's job. It **stores:**

- The final state of every task (SUCCESS, FAILURE, etc.)
- The return value of successful tasks
- The exception details of failed tasks
- Custom state updates (like our PROGRESS state from topic 8)

---

### Without a Result Backend

```python
# settings.py — no result backend configured

result = send_welcome_email.delay(user.id)

print(result.status)   # 💥 raises an exception
print(result.get())    # 💥 raises an exception
```

Without a result backend, you **cannot track task state at all.** You're flying blind. Tasks run and results disappear into the void.

---

### Configuring the Result Backend

The most common options are Redis and Django's database:

#### Option 1 — Redis as Result Backend (Fast, Simple)

```python
# settings.py

CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
```

You can use the same Redis instance for both broker and result backend. Simple and fast. Results are stored in Redis as key-value pairs.

---

#### Option 2 — Django Database as Result Backend (Queryable, Persistent)

This stores results in your actual PostgreSQL/MySQL database. Very useful when you need to **query task history**, build admin dashboards, or audit task execution.

```bash
pip install django-celery-results
```

```python
# settings.py

INSTALLED_APPS = [
    ...
    'django_celery_results',   # 👈 add this
]

CELERY_RESULT_BACKEND = 'django-db'  # 👈 use Django DB
CELERY_CACHE_BACKEND = 'django-cache'
```

```bash
# Run migrations to create the results table
python manage.py migrate django_celery_results
```

This creates a `django_celery_results_taskresult` table in your DB:

```
| task_id | task_name | status | result | date_created | date_done |
|---------|-----------|--------|--------|--------------|-----------|
| a1b2... | send_email| SUCCESS| null   | 2025-01-01   | 2025-01-01|
| c3d4... | gen_report| FAILURE| {...}  | 2025-01-01   | 2025-01-01|
```

Now you can query task results like any Django model:

```python
from django_celery_results.models import TaskResult

# Get all failed tasks
failed = TaskResult.objects.filter(status='FAILURE')

# Get result for a specific task
task = TaskResult.objects.get(task_id='a1b2c3...')
print(task.status)
print(task.result)
print(task.date_done)
```

---

### Redis vs Django DB — Which to Use?

| | Redis Backend | Django DB Backend |
|---|---|---|
| Speed | ⚡ Very fast | 🐢 Slower (DB writes) |
| Persistence | ⚠️ Lost on Redis restart (unless AOF) | ✅ Permanent |
| Queryable | ❌ No | ✅ Yes (ORM) |
| Admin dashboard | ❌ No | ✅ Yes |
| Audit trail | ❌ No | ✅ Yes |
| Setup complexity | Simple | Slightly more |
| Best for | High throughput, ephemeral results | Audit, history, dashboards |

**Rule of thumb:**
- Need speed and don't care about history → **Redis**
- Need to query/audit task history → **Django DB**
- Large scale production → **Both** (Redis for live state, DB for history)

---

### Result Expiry — Don't Let Results Pile Up

Results don't clean themselves up. If you run thousands of tasks a day, your result backend fills up fast.

Always set an expiry:

```python
# settings.py

# Results expire after 24 hours (in seconds)
CELERY_RESULT_EXPIRES = 60 * 60 * 24
```

For Redis, expired results are automatically evicted. For Django DB, Celery runs a periodic cleanup task automatically when using `django-celery-results`.

---

### `result.get()` — Fetching the Return Value

```python
@shared_task(name='myapp.tasks.add_numbers')
def add_numbers(a, b):
    return a + b  # 👈 return value is stored in result backend
```

```python
# In your view or anywhere else
result = add_numbers.delay(10, 20)

# This BLOCKS until the task completes
value = result.get()
print(value)  # 30
```

#### ⚠️ Never call `result.get()` inside a Django view

```python
# ❌ This defeats the entire purpose of Celery
def my_view(request):
    result = slow_task.delay()
    value = result.get()   # blocks the view — you're back to square one
    return HttpResponse(value)
```

`result.get()` is **synchronous and blocking.** Use it in:
- Management commands
- Tests
- Background scripts

In views, always **poll asynchronously** (as we showed in topic 8).

---

### `result.get()` with Timeout

If you must call `result.get()` somewhere, always add a timeout:

```python
from celery.exceptions import TimeoutError

try:
    value = result.get(timeout=10)  # wait max 10 seconds
except TimeoutError:
    print("Task took too long")
except Exception as exc:
    print(f"Task failed: {exc}")
```

Without a timeout, `result.get()` can block forever if a worker crashes.

---

### Ignoring Results — When You Don't Need Them

If you never need the result of a task, tell Celery to not store it at all. This saves memory and DB writes:

```python
# Option 1 — per task
@shared_task(ignore_result=True, name='myapp.tasks.send_email')
def send_email(user_id):
    pass  # result never stored

# Option 2 — when calling
send_email.apply_async(args=[user.id], ignore_result=True)

# Option 3 — globally in settings (for all tasks)
# settings.py
CELERY_IGNORE_RESULT = True
```

Most fire-and-forget tasks (sending emails, notifications) don't need their results stored. Always ask yourself: **"Will I ever need to check this result?"** If not, ignore it.

---

### Full Production Setup Example

```python
# settings.py

# Broker
CELERY_BROKER_URL = 'redis://localhost:6379/0'

# Result backend — use DB for auditability
CELERY_RESULT_BACKEND = 'django-db'

# Result expiry — clean up after 7 days
CELERY_RESULT_EXPIRES = 60 * 60 * 24 * 7

# Track started state
CELERY_TASK_TRACK_STARTED = True

# Serialization
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'

CELERY_TIMEZONE = 'UTC'
```

---

### The Full Picture So Far

Let's zoom out and see how everything connects:

```
Django View
    ↓
task.delay() / apply_async()
    ↓
Redis (Broker) ← stores task messages
    ↓
Celery Worker picks up task
    ↓
Executes task
    ↓
Stores result in Result Backend (Redis or DB)
    ↓
Django can query result anytime via AsyncResult(task_id)
```

---

### Summary

| Concept | Key Point |
|---|---|
| Result backend | Stores task state and return values |
| Redis backend | Fast, simple, not persistent |
| Django DB backend | Persistent, queryable, auditable |
| `result.get()` | Blocking — never use in views |
| `CELERY_RESULT_EXPIRES` | Always set to prevent storage bloat |
| `ignore_result=True` | Use for fire-and-forget tasks |

---

## Celery Beat — What it Is, When to Use It, Periodic Tasks

### The Analogy First

Think of Celery Beat as an **alarm clock** for your tasks.

Regular Celery workers are reactive — they wait for someone to hand them a task. But some jobs need to happen **automatically on a schedule**, without anyone triggering them:

- Send a daily digest email every morning at 8 AM
- Clean up expired sessions every hour
- Generate weekly reports every Monday
- Check payment statuses every 5 minutes

You wouldn't want to manually call these every time. You need something that **wakes up periodically and says "hey worker, time to do this job."**

That's Celery Beat. It's a **scheduler process** — completely separate from workers — that sits there watching the clock and dispatching tasks on schedule.

---

### How Beat Works

```
Celery Beat (scheduler)
    ↓  "it's 8:00 AM, time for daily_report"
Redis (Broker)
    ↓  task message dropped in queue
Celery Worker
    ↓  picks it up and runs it
```

Beat does **not** execute tasks itself. It just dispatches them to the broker on schedule. Workers do the actual work.

#### ⚠️ Critical — Beat is a separate process

You must run Beat AND workers separately:

```bash
# Terminal 1 — workers execute tasks
celery -A myproject worker --loglevel=info

# Terminal 2 — beat dispatches scheduled tasks
celery -A myproject beat --loglevel=info
```

If you only run workers without beat — scheduled tasks never get dispatched. If you only run beat without workers — tasks pile up in Redis with nobody to execute them.

---

### Two Ways to Configure Periodic Tasks

#### Option 1 — Hardcoded in `settings.py` (Simple, Static)

Good for schedules that never change.

```python
# settings.py

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    
    # Run every 5 minutes
    'check-payment-statuses': {
        'task': 'myapp.tasks.check_payment_statuses',
        'schedule': 300,   # seconds
    },
    
    # Run every day at 8:00 AM
    'send-daily-digest': {
        'task': 'myapp.tasks.send_daily_digest',
        'schedule': crontab(hour=8, minute=0),
    },
    
    # Run every Monday at 9:00 AM
    'weekly-report': {
        'task': 'myapp.tasks.generate_weekly_report',
        'schedule': crontab(hour=9, minute=0, day_of_week='monday'),
        'args': ['full'],        # positional args to pass
        'kwargs': {'format': 'pdf'},  # keyword args to pass
    },
    
    # Run every hour
    'cleanup-expired-sessions': {
        'task': 'myapp.tasks.cleanup_sessions',
        'schedule': crontab(minute=0),  # top of every hour
    },
}

CELERY_TIMEZONE = 'UTC'  # always set this with Beat
```

---

### `crontab` — The Scheduling Powerhouse

`crontab` follows the same logic as Unix cron. Here are the most useful patterns:

```python
from celery.schedules import crontab

# Every minute
crontab()

# Every 15 minutes
crontab(minute='*/15')

# Every day at midnight
crontab(hour=0, minute=0)

# Every day at 8:30 AM
crontab(hour=8, minute=30)

# Every weekday (Mon-Fri) at 9 AM
crontab(hour=9, minute=0, day_of_week='monday-friday')

# Every weekend at noon
crontab(hour=12, minute=0, day_of_week='saturday,sunday')

# First day of every month at 6 AM
crontab(hour=6, minute=0, day_of_month=1)

# Every 6 hours
crontab(minute=0, hour='*/6')
```

---

#### Option 2 — `django-celery-beat` (Dynamic, Database-Driven)

This is the **production-grade approach.** Schedules are stored in your database, meaning you can:

- Add/edit/delete schedules **without redeploying**
- Manage schedules from Django admin
- Let users create their own schedules dynamically

```bash
pip install django-celery-beat
```

```python
# settings.py

INSTALLED_APPS = [
    ...
    'django_celery_beat',   # 👈 add this
]

CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
```

```bash
python manage.py migrate django_celery_beat
```

Now you get a full Django admin interface for managing schedules:

```
Django Admin → Periodic Tasks
    ├── Add periodic task
    │   ├── Name: "Daily Digest"
    │   ├── Task: myapp.tasks.send_daily_digest
    │   ├── Schedule: Every day at 8:00 AM
    │   └── Enabled: ✅
    └── ...
```

---

### Creating Schedules Programmatically with `django-celery-beat`

You can also create schedules in code — useful for user-defined schedules:

```python
# myapp/views.py

from django_celery_beat.models import PeriodicTask, CrontabSchedule
import json

def create_user_schedule(request):
    # Create a crontab schedule
    schedule, created = CrontabSchedule.objects.get_or_create(
        hour=8,
        minute=0,
        day_of_week='monday-friday',
        day_of_month='*',
        month_of_year='*',
    )
    
    # Create the periodic task
    PeriodicTask.objects.create(
        crontab=schedule,
        name=f'daily-digest-user-{request.user.id}',
        task='myapp.tasks.send_daily_digest',
        args=json.dumps([request.user.id]),
        kwargs=json.dumps({'format': 'html'}),
        enabled=True,
    )
    
    return JsonResponse({'status': 'schedule created'})

def disable_user_schedule(request):
    task = PeriodicTask.objects.get(
        name=f'daily-digest-user-{request.user.id}'
    )
    task.enabled = False
    task.save()
    
    return JsonResponse({'status': 'schedule disabled'})
```

---

### The Tasks Themselves

Periodic tasks are just regular Celery tasks — nothing special about them:

```python
# myapp/tasks.py

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@shared_task(name='myapp.tasks.send_daily_digest')
def send_daily_digest():
    from django.contrib.auth.models import User
    
    users = User.objects.filter(
        is_active=True,
        profile__digest_enabled=True
    )
    
    logger.info(f"Sending daily digest to {users.count()} users")
    
    for user in users:
        # Send individual email per user
        send_user_digest.delay(user.id)   # 👈 spawn sub-tasks

@shared_task(name='myapp.tasks.send_user_digest')
def send_user_digest(user_id):
    from django.contrib.auth.models import User
    user = User.objects.get(id=user_id)
    # actual email sending logic...
    logger.info(f"Digest sent to {user.email}")

@shared_task(name='myapp.tasks.cleanup_sessions')
def cleanup_sessions():
    from django.contrib.sessions.models import Session
    from django.utils import timezone
    
    expired = Session.objects.filter(expire_date__lt=timezone.now())
    count = expired.count()
    expired.delete()
    
    logger.info(f"Cleaned up {count} expired sessions")
```

---

### Running Beat in Production

In development you run Beat and Worker separately. In production you have options:

#### Option 1 — Separate processes (recommended)

```bash
# Supervisor or systemd manages these
celery -A myproject worker --loglevel=info
celery -A myproject beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

#### Option 2 — Combined (only for development/simple setups)

```bash
# Runs worker + beat in one process — NOT for production
celery -A myproject worker --beat --loglevel=info
```

#### ⚠️ Never run multiple Beat instances

Beat is a **single process.** If you run two Beat instances, every scheduled task gets dispatched **twice** — causing duplicate emails, duplicate reports, duplicate everything.

In production with multiple servers, make sure only **one Beat process** is running across your entire infrastructure.

---

### Beat vs Manual Scheduling — When to Use What

| Scenario | Use |
|---|---|
| Send email 1hr after signup | `countdown` in `apply_async` |
| Send daily digest at 8 AM | Celery Beat |
| Retry a failed payment tomorrow | `self.retry(countdown=...)` |
| Generate weekly reports | Celery Beat |
| User-defined custom schedules | `django-celery-beat` with DB |
| One-time future task | `eta` in `apply_async` |

---

### Summary

| Concept | Key Point |
|---|---|
| Celery Beat | Scheduler process — dispatches tasks on schedule |
| Separate process | Always run Beat and Worker separately |
| `crontab` | Unix-style scheduling — powerful and flexible |
| `CELERY_BEAT_SCHEDULE` | Static schedules hardcoded in settings |
| `django-celery-beat` | Dynamic DB-driven schedules, admin manageable |
| Single instance | Never run more than one Beat process |
| Beat doesn't execute | It only dispatches — workers do the work |

---

## Worker Concurrency — Prefork vs Eventlet vs Gevent

### The Analogy First

Imagine your restaurant kitchen has **one head chef.** Every order comes in and he handles it one at a time. That's slow.

So you hire more chefs. But now the question is — **what kind of chefs and how do they work?**

- **Prefork** — Hire multiple independent chefs. Each has their own station, their own tools. They work completely separately. If one chef burns something, it doesn't affect others.

- **Eventlet/Gevent** — Hire one very fast chef who juggles many orders simultaneously. While waiting for the oven timer on one dish, he preps another. Super efficient for waiting — but if one dish needs heavy knife work, everything else waits.

This maps directly to how Celery handles concurrent task execution.

---

### What is Concurrency?

Concurrency is how many tasks a worker can handle **at the same time.**

```bash
# Run worker with 4 concurrent slots
celery -A myproject worker --concurrency=4 --loglevel=info
```

By default Celery uses `prefork` with concurrency equal to your **CPU core count.**

```bash
# Check your CPU cores
python -c "import multiprocessing; print(multiprocessing.cpu_count())"
```

---

### The Three Execution Pools

#### 1. Prefork (Default) — Multiple Processes

```bash
celery -A myproject worker \
    --pool=prefork \
    --concurrency=4 \
    --loglevel=info
```

**How it works:**

Celery spawns N completely independent child processes. Each process handles one task at a time. They share nothing — separate memory, separate DB connections, separate everything.

```
Main Worker Process
    ├── Child Process 1 → running task A
    ├── Child Process 2 → running task B
    ├── Child Process 3 → idle
    └── Child Process 4 → running task C
```

**Best for:**
- CPU-intensive tasks (image processing, PDF generation, data crunching)
- Tasks that use heavy computation
- Tasks where isolation matters

**Downsides:**
- Each process uses significant RAM
- Spawning processes is slow
- Bad at handling many I/O-bound tasks efficiently

---

#### 2. Eventlet — Cooperative Green Threads

```bash
pip install eventlet

celery -A myproject worker \
    --pool=eventlet \
    --concurrency=100 \
    --loglevel=info
```

**How it works:**

Eventlet uses **green threads** — lightweight fake threads that run in a single OS process. When one green thread hits an I/O wait (HTTP call, DB query, sleep), it **yields control** to another green thread.

```
Single Process
    ├── Green Thread 1 → waiting for HTTP response (yielded)
    ├── Green Thread 2 → waiting for DB query (yielded)
    ├── Green Thread 3 → actively processing
    ├── Green Thread 4 → waiting for Redis (yielded)
    └── ... 96 more green threads ...
```

The key word is **cooperative** — threads must voluntarily yield. If a task does pure CPU work and never yields, it blocks everything.

**Best for:**
- I/O-bound tasks (API calls, sending emails, waiting on external services)
- High concurrency with low memory
- Tasks that spend most time waiting

**Downsides:**
- Terrible for CPU-bound tasks
- Requires monkey patching (explained below)
- Some libraries don't play well with it

---

#### 3. Gevent — Similar to Eventlet

```bash
pip install gevent

celery -A myproject worker \
    --pool=gevent \
    --concurrency=100 \
    --loglevel=info
```

Gevent works almost identically to Eventlet — green threads, cooperative yielding, great for I/O. The main differences are internal implementation details.

In practice:
- Gevent has slightly better performance
- Better library compatibility
- More actively maintained

**For most projects — prefer Gevent over Eventlet** if you need async I/O concurrency.

---

### Monkey Patching — The Gotcha with Eventlet/Gevent

Both Eventlet and Gevent need to **monkey patch** Python's standard library — replacing blocking I/O calls with non-blocking versions.

```python
# myproject/celery.py

import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')

# 👇 Must be done BEFORE anything else imports
import gevent.monkey
gevent.monkey.patch_all()

# OR for eventlet:
# import eventlet
# eventlet.monkey_patch()

app = Celery('myproject')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

#### ⚠️ Monkey patching must happen first

If any library imports before monkey patching, it gets the original blocking version. This causes subtle, hard-to-debug issues. Always patch at the very top.

---

### Side By Side Comparison

| Feature | Prefork | Eventlet | Gevent |
|---|---|---|---|
| Mechanism | OS Processes | Green threads | Green threads |
| Memory usage | High (per process) | Low | Low |
| CPU-bound tasks | ✅ Excellent | ❌ Terrible | ❌ Terrible |
| I/O-bound tasks | ⚠️ Okay | ✅ Excellent | ✅ Excellent |
| Max concurrency | ~CPU cores (8-32) | Thousands | Thousands |
| Isolation | ✅ Full isolation | ❌ Shared process | ❌ Shared process |
| Crash isolation | ✅ One crash = one process | ❌ One crash = all threads | ❌ One crash = all threads |
| Django ORM safe | ✅ Yes | ⚠️ Needs care | ⚠️ Needs care |
| Setup complexity | Simple | Medium | Medium |

---

### Choosing the Right Pool

```
What kind of tasks do you have?
        ↓
CPU-intensive? (image processing, ML, PDF, encryption)
→ Use PREFORK

I/O-intensive? (API calls, emails, webhooks, notifications)
→ Use GEVENT

Mixed?
→ Run TWO separate workers:
    Worker 1: prefork for CPU tasks (queue: cpu_tasks)
    Worker 2: gevent for I/O tasks (queue: io_tasks)
```

---

### Running Multiple Specialized Workers

This is a powerful production pattern — different workers for different task types:

```bash
# Worker 1 — CPU tasks, prefork, low concurrency
celery -A myproject worker \
    --pool=prefork \
    --concurrency=4 \
    --queues=cpu_tasks \
    --hostname=cpu-worker@%h \
    --loglevel=info

# Worker 2 — I/O tasks, gevent, high concurrency
celery -A myproject worker \
    --pool=gevent \
    --concurrency=200 \
    --queues=io_tasks \
    --hostname=io-worker@%h \
    --loglevel=info
```

```python
# myapp/tasks.py

# CPU-heavy task → route to cpu_tasks queue
@shared_task(name='myapp.tasks.generate_pdf', queue='cpu_tasks')
def generate_pdf(report_id):
    # heavy PDF generation...
    pass

# I/O-heavy task → route to io_tasks queue
@shared_task(name='myapp.tasks.send_email', queue='io_tasks')
def send_email(user_id):
    # HTTP call to SendGrid...
    pass
```

```python
# settings.py — task routing
CELERY_TASK_ROUTES = {
    'myapp.tasks.generate_pdf': {'queue': 'cpu_tasks'},
    'myapp.tasks.send_email':   {'queue': 'io_tasks'},
    'myapp.tasks.send_sms':     {'queue': 'io_tasks'},
}
```

---

### How Many Workers to Run?

```python
# Rule of thumb:

# For prefork (CPU-bound):
# concurrency = number of CPU cores
# (going higher doesn't help — CPU is the bottleneck)
concurrency = os.cpu_count()  # e.g. 8

# For gevent/eventlet (I/O-bound):
# concurrency = much higher — limited by memory and open connections
# Start at 100-200, tune based on monitoring
concurrency = 100
```

---

### Autoscaling — Dynamic Concurrency

Celery can automatically scale workers up and down based on load:

```bash
celery -A myproject worker \
    --autoscale=10,2 \
    --loglevel=info
# Format: --autoscale=max,min
# Scales between 2 and 10 concurrent workers based on queue depth
```

When queue is empty → scales down to 2.
When queue is full → scales up to 10.

Great for variable workloads — saves resources during quiet periods.

---

### Summary

| Concept | Key Point |
|---|---|
| Prefork | Multiple OS processes — best for CPU tasks |
| Gevent | Green threads — best for I/O tasks |
| Eventlet | Similar to Gevent — slightly less preferred |
| Concurrency | How many tasks run simultaneously |
| Monkey patching | Must happen before any imports |
| Multiple workers | Run separate workers per task type |
| Autoscale | Dynamic concurrency based on load |
| CPU-bound rule | Concurrency ≈ CPU core count |
| I/O-bound rule | Concurrency can be 100-1000+ |

