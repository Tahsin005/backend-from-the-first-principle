# OAuth 2.0 and OpenID Connect: A Complete Guide to Modern Authentication Standards

## Introduction

Have you ever tried to learn about OAuth and OpenID Connect, only to be overwhelmed by strange terminology and conflicting information? You're not alone. These critical security standards are often explained in ways that obscure rather than clarify their purpose and function.

This guide aims to cut through the jargon and explain how OAuth 2.0 and OpenID Connect work using clear, accessible language and practical examples. By the end, you'll understand not just what these standards do, but why they exist and how they protect your data every day.

![OAuth & OIDC](https://miro.medium.com/v2/resize:fit:1100/format:webp/1*LEDO5mtRXbf8-IbFuRhxxA.png)

## The Stone Age Problem: Password Sharing

### How Things Used to Work (And Why That Was Terrible)

In the early days of the internet, sharing information between services was "simple"-but dangerously so. If you wanted one application to access your data from another service, you simply gave it your username and password.

**Example scenario:**
- You want a photo printing service to access your Facebook photos
- Solution: Give the printing service your Facebook username and password
- They log in as you and download your photos

**Why this was catastrophic:**

1. **No security guarantee**: The third-party service might not keep your credentials safe. One data breach exposes your password.

2. **Unlimited access**: Once they have your password, they have access to EVERYTHING in your account-not just photos, but messages, personal information, financial data, everything.

3. **No accountability**: You have no way of knowing what they accessed or what they did with your account.

4. **Difficult revocation**: To revoke access, you must change your password. But if you've given it to multiple services, you have to update it everywhere and inform all those services.

5. **Password reuse amplification**: If you use the same password elsewhere (which people do), one compromised service means all your accounts are vulnerable.

**The shocking truth**: Some applications still try to get away with this approach today.

Clearly, the internet needed a better solution. Enter OAuth 2.0.

## OAuth 2.0: The Authorization Standard

### What is OAuth 2.0?

**OAuth 2.0** is a security standard that allows you to give one application permission to access your data in another application-**without giving them your username and password**.

Instead of handing over your keys to the castle, you're giving a specific key that:
- Opens only certain doors (limited permissions)
- Can be revoked at any time
- Doesn't give access to everything you own

**The key concept**: OAuth 2.0 enables **delegated authorization**. You authorize one application to access your data or use features in another application on your behalf.

### A Real-World Example: Terrible Pun of the Day

Let's walk through a practical scenario that demonstrates how OAuth 2.0 works.

#### The Setup

You've discovered a website called "Terrible Pun of the Day" that sends you an awful pun joke via text message every day. You love it so much that you want to share it with everyone you know.

**The problem**: Writing individual emails to everyone in your contacts list sounds like a lot of work.

**The solution**: Terrible Pun of the Day offers a feature to invite your friends automatically by accessing your email contacts.

#### The OAuth 2.0 Flow: User Perspective

Here's what you experience:

**Step 1: Choose Your Email Provider**

You click a button to "Invite Friends" and select your email provider (Gmail, Outlook, etc.).

**Step 2: Redirect to Email Service**

You're redirected to your email service's website (not staying on Terrible Pun of the Day).

**Step 3: Login Check**

Your email service checks if you're currently logged in:
- If yes: proceed to next step
- If no: you're prompted to log in

**Step 4: Consent Screen**

You see a question like:
```
Do you want to give Terrible Pun of the Day access to:
- View your contacts

[Deny] [Allow]
```

**Step 5: Grant Permission**

Assuming you haven't changed your mind, you click "Allow."

**Step 6: Redirect Back**

You're redirected back to Terrible Pun of the Day.

**Result**: The application can now read your contacts-and **only** your contacts. It cannot:
- Read your emails
- Send emails as you
- Delete contacts
- Access any other data

**OAuth 2.0 for the win!** You've just completed what's called an **OAuth flow**.

### OAuth 2.0 Terminology: The Essential Vocabulary

Before diving deeper, let's define the key terms you'll encounter:

#### 1. Resource Owner

**Who**: You, the user

**Role**: The owner of your identity, data, and any actions that can be performed with your accounts.

**Example**: You own your email contacts, photos, and account data.

#### 2. Client

**Who**: The application requesting access

**Role**: Wants to access data or perform actions on behalf of the resource owner.

**Example**: Terrible Pun of the Day is the client.

#### 3. Authorization Server

**Who**: The application that knows the resource owner

**Role**: The server where you already have an account. It handles the authentication and consent process.

**Example**: Gmail, Facebook, GitHub authentication servers.

#### 4. Resource Server

**Who**: The API or service the client wants to use

**Role**: Stores and provides the actual data or functionality.

**Example**: Google's Contacts API, Facebook's Graph API.

**Important note**: Sometimes the authorization server and resource server are the same entity, but they can also be separate. For example, a third-party authorization service might be trusted by multiple resource servers.

#### 5. Redirect URI (Callback URL)

**What**: A URL where the authorization server sends the user after granting permission

**Purpose**: Returns the user to the client application with authorization information.

**Example**: `https://terriblepun.com/auth/callback`

**Security**: Must be pre-registered with the authorization server to prevent redirection attacks.

#### 6. Response Type

**What**: The type of information the client expects to receive

**Most common**: `code` (authorization code)

**Purpose**: Tells the authorization server what kind of OAuth flow is being used.

#### 7. Scope

**What**: Granular permissions the client is requesting

**Purpose**: Defines exactly what the client can access or do.

**Examples**:
- `read:contacts` - Read contacts only
- `write:posts` - Create posts
- `delete:photos` - Delete photos

**Why important**: Scopes enable **principle of least privilege**-clients only get the permissions they need.

#### 8. Consent

**What**: The authorization server verifies the requested scopes with you

**Purpose**: You explicitly approve or deny the permissions the client is requesting.

**Result**: You're in control of what the client can access.

#### 9. Client ID

**What**: An identifier for the client application

**Purpose**: The authorization server uses this to identify which application is making the request.

**Visibility**: Public (not secret)

#### 10. Client Secret

**What**: A secret password only the client and authorization server know

**Purpose**: Allows secure, private communication between client and authorization server.

**Visibility**: Must be kept secret (never exposed in browser/mobile apps)

#### 11. Authorization Code

**What**: A short-lived temporary code

**Flow**:
1. Authorization server sends it to the client (via browser)
2. Client sends it back to authorization server (directly, server-to-server)
3. In exchange, receives an access token

**Lifespan**: Very short (typically seconds to minutes)

**Purpose**: Intermediary step that enables secure token exchange

#### 12. Access Token

**What**: The "key" the client uses to access the resource server

**Purpose**: Proves the client has been authorized to access specific resources.

**Usage**: Included in requests to the resource server

**Format**: Opaque string or JWT (client typically doesn't need to understand it)

## The Authorization Code Flow: Step by Step

Now that we understand the vocabulary, let's examine the most common OAuth 2.0 flow: the **Authorization Code Flow**.

### Phase 1: Pre-Registration (Happens Before Any User Interaction)

Before any user can grant access, the client and authorization server must establish a relationship.

**One-time setup**:
1. Developer registers their application with the authorization server
2. Provides information:
   - Application name: "Terrible Pun of the Day"
   - Redirect URI: `https://terriblepun.com/auth/callback`
   - Description and logo
3. Authorization server generates and provides:
   - **Client ID**: `abc123` (public identifier)
   - **Client Secret**: `super-secret-xyz` (must be kept secret)

**Result**: The authorization server now recognizes and trusts the client application.

### Phase 2: User-Initiated Flow

Now a user (you) wants to grant the client access to your contacts.

#### Step 1: User Clicks "Invite Friends"

You're on Terrible Pun of the Day and click the button to invite friends.

#### Step 2: Client Redirects to Authorization Server

The client constructs a URL and redirects your browser:

```
https://accounts.google.com/authorize?
  client_id=abc123&
  redirect_uri=https://terriblepun.com/auth/callback&
  response_type=code&
  scope=read:contacts
```

**Parameters explained**:
- `client_id`: Identifies Terrible Pun of the Day
- `redirect_uri`: Where to send you back after consent
- `response_type=code`: Requesting authorization code flow
- `scope`: Requesting permission to read contacts

#### Step 3: Authorization Server Verifies Identity

You're now on Google's authorization server:

1. **Check login status**: Are you logged in?
   - Yes: Skip to consent
   - No: Show login page

2. **Login if necessary**: Enter username and password (on Google, not on Terrible Pun of the Day)

#### Step 4: Consent Screen

Google shows you what Terrible Pun of the Day is requesting:

```
Terrible Pun of the Day wants to:
• View your contacts

This will allow them to see names and email addresses.

[Deny]  [Allow]
```

#### Step 5: User Grants or Denies Permission

You click **[Allow]**.

#### Step 6: Redirect with Authorization Code

Google redirects your browser back to the client:

```
https://terriblepun.com/auth/callback?code=xyz789
```

The `code` parameter contains the authorization code.

**Important**: This happens in your browser, so the authorization code is briefly visible. That's why it's temporary and can only be used once.

#### Step 7: Client Exchanges Code for Access Token

Now the client makes a **direct server-to-server** request (not using your browser):

```http
POST https://accounts.google.com/token
Content-Type: application/x-www-form-urlencoded

client_id=abc123&
client_secret=super-secret-xyz&
code=xyz789&
redirect_uri=https://terriblepun.com/auth/callback&
grant_type=authorization_code
```

**Key security feature**: This request includes the **client secret**, which only the client and authorization server know. Your browser never sees this.

#### Step 8: Authorization Server Responds with Access Token

Google validates:
- Client ID is valid
- Client secret is correct
- Authorization code is valid and unused
- Redirect URI matches

If everything checks out, responds with:

```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### Step 9: Client Uses Access Token to Access Resources

The client can now request your contacts:

```http
GET https://www.googleapis.com/contacts/v1/people
Authorization: Bearer ya29.a0AfH6SMBx...
```

#### Step 10: Resource Server Validates and Responds

Google's Contacts API:
1. Validates the access token
2. Checks the associated scopes
3. If valid and authorized, responds with contacts:

```json
{
  "contacts": [
    {"name": "Alice", "email": "alice@example.com"},
    {"name": "Bob", "email": "bob@example.com"}
  ]
}
```

**Result**: Terrible Pun of the Day can now send invitations to your contacts!

### The Complete Flow Diagram

```
┌─────────────┐                                           ┌──────────────────┐
│             │  1. User clicks "Invite Friends"          │                  │
│     You     │───────────────────────────────────────────>│  Terrible Pun   │
│  (Resource  │                                           │   of the Day     │
│   Owner)    │                                           │    (Client)      │
│             │<───────────────────────────────────────────│                  │
└─────────────┘  2. Redirect to Google (with client_id,  └──────────────────┘
      │             scope, redirect_uri, response_type)
      │
      v
┌─────────────────────────────────────────────────────────┐
│         3. Login (if necessary)                         │
│         4. Consent screen                               │
│            "Allow Terrible Pun to read contacts?"       │
│                   [Deny] [Allow]                        │
│                                                         │
│              Google Authorization Server                │
└─────────────────────────────────────────────────────────┘
      │
      │  5. User clicks Allow
      │  6. Redirect back with authorization code
      v
┌─────────────┐                                           ┌──────────────────┐
│             │  7. Exchange code + client_secret         │                  │
│     You     │     for access token (server-to-server)   │  Terrible Pun    │
│             │                                           │    of the Day    │
│             │  8. Receive access token      <───────────│                  │
└─────────────┘                                           └──────────────────┘
                                                                   │
                                                                   │ 9. Request contacts
                                                                   │    with access token
                                                                   v
                                                          ┌──────────────────┐
                                                          │     Google       │
                                                          │  Contacts API    │
                                                          │ (Resource Server)│
                                                          │                  │
                                                          │ 10. Return       │
                                                          │     contacts     │
                                                          └──────────────────┘
```

### Key Security Features

**1. Password never shared**: You only entered your password on Google, never on Terrible Pun of the Day.

**2. Limited permissions**: The client only gets access to contacts, nothing else.

**3. Revocable**: You can revoke access at any time in your Google account settings.

**4. Temporary authorization code**: The code in the URL is short-lived and single-use.

**5. Client secret**: Server-to-server communication uses a secret your browser never sees.

**6. Token expiration**: Access tokens expire, limiting the window of vulnerability if compromised.

## OpenID Connect: Adding Identity to OAuth

### The OAuth 2.0 Limitation

OAuth 2.0 is brilliant for **authorization**-granting access to data and features. But it has a limitation: **it doesn't provide authentication or identity information**.

**What OAuth 2.0 gives you**: A key to access specific resources

**What OAuth 2.0 doesn't give you**: Information about who the user is

### The Problem OAuth Doesn't Solve

Imagine you're building an application and want to offer "Sign in with Google." With only OAuth 2.0:

1. You can get an access token to access Google resources
2. But you don't know **who** the user is
3. No standard way to get their name, email, or profile picture
4. Cannot establish a login session

**The gap**: OAuth 2.0 enables authorization but not authentication.

### Enter OpenID Connect (OIDC)

**OpenID Connect** (sometimes abbreviated as OIDC) is a thin layer that sits on top of OAuth 2.0, adding:

1. **Authentication**: Ability to establish a login session
2. **Identity**: Information about who the user is

**The analogy**:
- **OAuth 2.0**: Like giving an application a key (access to resources)
- **OpenID Connect**: Like giving an application a badge (access to resources + identity information)

### Another Analogy: The ATM Card

Think of OpenID Connect like using an ATM card:

**The ATM (Client)**: Needs to:
- Access your bank balance (data)
- Perform transactions like withdrawals (actions)

**Your Bank Card (Token)**: Provides:
- Access to your account (**authorization**)
- Information about who you are: name, card issuer, expiration date (**identity**)
- Proof of authentication: PIN, chip verification

**The Bank Infrastructure (OAuth 2.0)**: The underlying system that makes it all work.

Just as an ATM can't work without the underlying bank infrastructure, **OIDC sits on top of OAuth** and cannot work without it.

### What's Different in OpenID Connect?

OpenID Connect uses the same OAuth 2.0 flow with two key additions:

#### Addition 1: The `openid` Scope

In the initial authorization request, a specific scope is added:

```
https://accounts.google.com/authorize?
  client_id=abc123&
  redirect_uri=https://terriblepun.com/auth/callback&
  response_type=code&
  scope=openid email profile
```

**The `openid` scope** signals to the authorization server: "This is an OpenID Connect exchange, not just OAuth."

**Additional scopes**:
- `profile`: Access to profile information (name, picture)
- `email`: Access to email address

#### Addition 2: The ID Token

When the client exchanges the authorization code for tokens, it receives TWO tokens:

```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Access Token** (same as before):
- Opaque string (client doesn't need to understand it)
- Used to access resource server
- Proves authorization

**ID Token** (NEW):
- **JSON Web Token (JWT)** - pronounced "jot"
- Contains identity information
- Client CAN and SHOULD decode it
- Proves authentication

### Understanding the ID Token (JWT)

A JWT looks like gibberish but has a specific structure:

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZW1haWwiOiJqb2huQGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Three parts separated by dots**:

```
header.payload.signature
```

#### Decoded Header:
```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

#### Decoded Payload (Claims):
```json
{
  "sub": "1234567890",           // Subject (user ID)
  "name": "John Doe",             // User's name
  "email": "john@example.com",    // User's email
  "iat": 1516239022,              // Issued at (timestamp)
  "exp": 1516242622,              // Expiration (timestamp)
  "iss": "https://accounts.google.com",  // Issuer
  "aud": "abc123"                 // Audience (client ID)
}
```

#### Signature:
Cryptographic signature ensuring:
- Token was issued by the trusted authorization server
- Token hasn't been tampered with

### Claims: Identity Information

The data inside the ID token are called **claims**-assertions about the user.

**Standard claims**:
- `sub` (subject): Unique user identifier
- `name`: Full name
- `email`: Email address
- `picture`: Profile picture URL
- `iat` (issued at): When token was created
- `exp` (expires): When token expires
- `iss` (issuer): Who created the token
- `aud` (audience): Who the token is for

**Additional claims** can be requested through scopes or custom claims.

### The OpenID Connect Flow

Let's revisit Terrible Pun of the Day with OpenID Connect:

**Step 1-6**: Same as OAuth 2.0 (but with `openid` scope)

**Step 7**: Client exchanges authorization code:

```http
POST https://accounts.google.com/token
Content-Type: application/x-www-form-urlencoded

client_id=abc123&
client_secret=super-secret-xyz&
code=xyz789&
grant_type=authorization_code
```

**Step 8**: Authorization server responds with BOTH tokens:

```json
{
  "access_token": "ya29.a0AfH6SMBx...",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Step 9**: Client decodes ID token to get user information:

```javascript
const decoded = jwt.decode(id_token);
console.log(decoded);
// {
//   sub: "1234567890",
//   name: "John Doe",
//   email: "john@example.com",
//   picture: "https://..."
// }
```

**Step 10**: Client can now:
- Create a user account using this information
- Log the user in
- Personalize the experience with name/picture

**Step 11** (if needed): Use access token for additional requests:

```http
GET https://www.googleapis.com/userinfo
Authorization: Bearer ya29.a0AfH6SMBx...
```

Response with extended user information.

### Key Differences: OAuth 2.0 vs OpenID Connect

| Feature | OAuth 2.0 | OpenID Connect |
|---------|-----------|----------------|
| **Purpose** | Authorization | Authentication + Authorization |
| **Provides** | Access to resources | Identity + Access to resources |
| **Tokens** | Access Token only | Access Token + ID Token |
| **Scope** | Resource-specific (read:contacts) | `openid` + optional profile, email |
| **Use Case** | "App A can access my photos in App B" | "Log in with Google" |
| **Information** | No user info | User identity in ID Token |

### Single Sign-On (SSO)

OpenID Connect enables **Single Sign-On**-using one login across multiple applications.

**Example**:
1. You log in to Application A with Google
2. Later, you visit Application B
3. Application B also uses "Sign in with Google"
4. Since you're already logged in to Google, you're instantly signed in to Application B
5. No need to enter credentials again

**Benefits**:
- One set of credentials to remember
- Consistent login experience
- Reduced password fatigue
- Centralized security (managed by identity provider)

**Common SSO providers**:
- Google
- Facebook
- Microsoft
- GitHub
- Apple
- Corporate identity providers (Okta, Auth0, Azure AD)

## Real-World Applications

### OAuth 2.0 Use Cases

**1. Social Media Integration**
- "Post to Facebook" from third-party apps
- "Tweet this" buttons
- Instagram photo sharing to other platforms

**2. Cloud Service Integration**
- Backup service accessing Google Drive
- Email client accessing Gmail
- Calendar sync between services

**3. IoT and Smart Devices**
- Smart home apps controlling devices
- Fitness trackers syncing to health apps
- Smart speakers accessing music services

**4. Developer APIs**
- Applications using Twitter API
- Bots accessing Discord/Slack
- Payment processing with Stripe/PayPal

### OpenID Connect Use Cases

**1. "Sign in with..." Buttons**
- Sign in with Google
- Sign in with Facebook
- Sign in with GitHub

**2. Enterprise SSO**
- Employees logging in to company apps
- Partners accessing B2B portals
- Customer portals with unified login

**3. Mobile App Authentication**
- Native apps using social login
- Cross-platform identity
- Simplified registration flows

**4. Multi-Tenant SaaS**
- Users from different organizations
- Each organization has own identity provider
- Centralized identity management

## Security Considerations

### Best Practices for OAuth 2.0 and OIDC

**1. Always Use HTTPS**
- Never transmit tokens over HTTP
- Prevents man-in-the-middle attacks

**2. Validate Redirect URIs**
- Pre-register all redirect URIs
- Prevents redirection attacks
- Exact match, not pattern match

**3. Use State Parameter**
- Prevents CSRF attacks
- Random value generated for each request
- Verified on callback

**4. Implement PKCE (Proof Key for Code Exchange)**
- Essential for mobile and single-page apps
- Protects against authorization code interception
- Creates cryptographic challenge

**5. Short-Lived Tokens**
- Access tokens should expire quickly (minutes to hours)
- Use refresh tokens for long-term access
- Reduces impact of token theft

**6. Secure Token Storage**
- Never store tokens in localStorage (vulnerable to XSS)
- Use httpOnly cookies when possible
- Encrypt sensitive tokens

**7. Validate ID Tokens**
- Verify signature
- Check issuer (iss) is expected
- Check audience (aud) matches client ID
- Check expiration (exp)

**8. Scope Minimization**
- Request only necessary permissions
- Follow principle of least privilege
- Users more likely to grant minimal scopes

## Common Misconceptions

### Misconception 1: "OAuth is a login protocol"

**Reality**: OAuth 2.0 is for **authorization**, not authentication. OpenID Connect adds authentication.

### Misconception 2: "Access tokens contain user information"

**Reality**: Access tokens are opaque to the client. **ID tokens** contain user information (in OIDC).

### Misconception 3: "It's safe to use authorization code without client secret"

**Reality**: For confidential clients (server-side apps), client secret is essential. For public clients (SPAs, mobile), use PKCE.

### Misconception 4: "Tokens are passwords"

**Reality**: Tokens are time-limited, scope-limited credentials. They expire and can be revoked without changing passwords.

### Misconception 5: "OAuth and OIDC are competing standards"

**Reality**: OIDC builds on OAuth. They work together, not in competition.

## Conclusion

OAuth 2.0 and OpenID Connect are the foundational standards powering modern web security. Understanding them is essential for any developer building applications that integrate with other services or require secure authentication.

### Key Takeaways

**OAuth 2.0**:
- Enables delegated authorization
- Grants limited, revocable access without sharing passwords
- Uses access tokens to access resources
- Perfect for "App A accessing data from App B"

**OpenID Connect**:
- Adds authentication to OAuth 2.0
- Provides identity information via ID tokens (JWTs)
- Enables Single Sign-On
- Powers "Sign in with..." features

**Together**, they provide:
- Secure, password-less authentication
- Granular permission control
- User control over data sharing
- Standardized, interoperable security

**The bottom line**: These standards protect billions of users daily. They've transformed the internet from a password-sharing chaos into a secure, interconnected ecosystem where users maintain control over their data and identity.

Whether you're building a simple web app with "Sign in with Google" or a complex microservices architecture, understanding OAuth 2.0 and OpenID Connect empowers you to implement security correctly, protecting your users and their data.