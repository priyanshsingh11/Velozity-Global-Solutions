# Velozity Global Solutions --- Full Stack Developer Assessment

## Detailed Build Specification / Implementation Checklist

> **Source:** Velozity Global Solutions Technical Hiring Assessment (4
> pages).
>
> **Important assessment constraint:** The assessment states **"AI
> Tools: Strictly Prohibited."** This document is a
> requirements/planning extraction from the supplied assessment. Make
> sure your actual work complies with the employer's rules.

------------------------------------------------------------------------

# 1. Objective

Build a **Real-Time Client Project Dashboard with Role-Based Access &
Live Activity Feed**.

The application is an internal tool for a small agency to:

-   manage clients
-   manage projects
-   manage project tasks
-   assign tasks to developers
-   track task progress
-   monitor team activity in real time
-   show role-specific dashboards
-   provide in-app notifications
-   automatically flag overdue tasks

The assessment explicitly says this is **not intended to be a basic CRUD
application**. It evaluates WebSocket implementation, role-based
permission logic, and state-management/engineering decisions.

------------------------------------------------------------------------

# 2. Mandatory Technology Stack

## Frontend

Required:

-   React
-   TypeScript

**Plain JavaScript is not accepted.**

## Backend

Required:

-   Node.js
-   Express **or** Fastify

The choice must be justified in the README.

## Database

Required:

-   PostgreSQL
-   Proper relational schema
-   Foreign keys
-   Indexes on frequently queried columns
-   Indexing decisions documented in README

## ORM

Choose one:

-   Prisma
-   Raw SQL

If using raw SQL, keep the database access architecture consistent. The
assessment explicitly lists **randomly mixing raw SQL into controllers**
as an auto-disqualification condition.

## Real-Time

Required:

-   WebSocket

Allowed:

-   Socket.io
-   Native WebSocket

Not allowed:

-   Polling as a replacement
-   SSE

The README must justify the WebSocket library choice.

## Background Jobs

Choose one:

-   `node-cron`
-   Bull queue

The README must justify the choice.

## Validation

All API input must be validated **server-side**.

Frontend validation alone is insufficient.

## Error Handling

All API endpoints must return consistent, structured error responses.

Do not expose raw stack traces to clients.

## Environment Variables

Secrets must be stored in `.env`.

Do not hardcode secrets.

------------------------------------------------------------------------

# 3. User Roles

There are exactly three required application roles.

## 3.1 Admin

Admin has full access:

-   manage clients
-   manage projects
-   manage users
-   view all activity

Admin can see activity across all projects in the global activity feed.

## 3.2 Project Manager

Project Manager can:

-   create projects
-   manage projects
-   assign tasks
-   view their team's activity

Critical restriction:

> A Project Manager can only manage projects that **they created**.

They cannot see or edit another Project Manager's projects.

## 3.3 Developer

Developer can:

-   view assigned tasks
-   update task status

Critical restriction:

> A Developer cannot see other developers' tasks.

A Developer must not be able to reach a Project Manager's data by
directly calling an API endpoint or modifying a token.

------------------------------------------------------------------------

# 4. Authentication

Implement JWT-based authentication using:

-   access token
-   refresh token

## Refresh Token Requirement

The refresh token **must be stored in an HttpOnly cookie**.

Do **not** store the refresh token in localStorage.

## Required Authentication Flow

Conceptually:

``` text
User
  |
  | Login
  v
POST /auth/login
  |
  +--> Verify credentials
  |
  +--> Generate access token
  |
  +--> Generate refresh token
  |
  +--> Store refresh token in HttpOnly cookie
  |
  v
Authenticated application
```

Protected API requests must authenticate the user.

When an access token expires, the application must be able to use the
refresh-token mechanism to obtain a new access token.

------------------------------------------------------------------------

# 5. API-Level Authorization

This is one of the most important parts of the assessment.

Authorization cannot exist only in React.

Every protected API route must enforce permissions at the backend/API
level.

## Example security expectations

A Developer must not be able to:

``` text
GET another developer's task
GET another PM's project
GET another PM's activity
modify unauthorized tasks
```

by manually constructing an API request.

The backend must determine:

``` text
Who is this user?
What is their role?
What resource are they requesting?
Do they own/have access to this resource?
```

and reject unauthorized requests.

## Important

Frontend UI hiding is useful for user experience, but it is **not
security**.

------------------------------------------------------------------------

# 6. Client Management

The assessment requires Admin access to client management.

Projects must be assignable to clients.

At minimum, the client concept needs to support the project-to-client
relationship.

The assessment does not prescribe an exact UI or exact client fields
beyond the requirement to manage clients and assign projects to them, so
the implementation can choose appropriate fields.

------------------------------------------------------------------------

# 7. Project Management

Admin and Project Manager must be able to create projects.

Projects are assigned to clients.

A project contains tasks.

Every project must have an owner/creator relationship so that PM
authorization can enforce:

``` text
PM can manage project
    ONLY IF
project.createdById == currentUser.id
```

Admin is not restricted by PM ownership rules.

------------------------------------------------------------------------

# 8. Task Management

Every project contains tasks.

Each task must contain:

-   title
-   description
-   assigned developer
-   status
-   priority
-   due date
-   activity log

## Task Statuses

Exactly the following statuses are specified:

``` text
To Do
In Progress
In Review
Done
```

## Task Priorities

Exactly the following priorities are specified:

``` text
Low
Medium
High
Critical
```

## Assignment

Tasks can be assigned to developers.

When a task is assigned to a developer, that developer must receive an
in-app notification.

------------------------------------------------------------------------

# 9. Task Status Change History

Every task status change must be recorded.

The activity record must contain enough information to show:

-   who made the change
-   what changed
-   when it changed

Example:

``` text
Ravi moved Task #12 from In Progress → In Review · 2 mins ago
```

## Important Database Requirement

The activity log must be **stored in PostgreSQL**.

It must not be reconstructed from the current task status.

Example:

``` text
Task current status:
In Review

Activity history:
10:00 — Developer A moved To Do → In Progress
10:30 — Developer A moved In Progress → In Review
```

The historical events remain stored.

------------------------------------------------------------------------

# 10. Overdue Tasks

Tasks past their due date must automatically be flagged as **Overdue**.

## Critical Requirement

Overdue detection must happen using a **scheduled background job**.

It must **not** happen only when a dashboard/page loads.

Choose:

``` text
node-cron
```

or:

``` text
Bull queue
```

and explain the choice in README.

## Seed Requirement

The seed data must include:

-   at least 2 tasks already in an overdue state

------------------------------------------------------------------------

# 11. Real-Time Activity Feed

This is the core technical challenge.

Implement a WebSocket-based activity system.

Use:

``` text
Socket.io
```

or:

``` text
Native WebSocket
```

The README must explain why the chosen approach was selected.

------------------------------------------------------------------------

# 12. Real-Time Task Status Updates

When a user changes a task status:

``` text
Task #12
In Progress
    |
    | status update
    v
In Review
```

the backend should:

1.  authorize the operation
2.  update the task
3.  store the status-change activity in PostgreSQL
4.  emit the appropriate real-time event
5.  update relevant connected clients
6.  trigger any required notification behavior

Users currently viewing that project must see the update **without
refreshing the page**.

------------------------------------------------------------------------

# 13. Role-Filtered Activity Feed

The activity feed must respect role/resource permissions.

## Admin Feed

Admin sees:

``` text
ALL PROJECTS
    |
    v
ALL ACTIVITY
```

Admin has one global activity view across all projects.

## Project Manager Feed

PM sees:

``` text
ONLY PROJECTS CREATED BY THAT PM
        |
        v
ACTIVITY FOR THOSE PROJECTS
```

PM must not receive/view another PM's project activity.

## Developer Feed

Developer sees:

``` text
ONLY TASKS ASSIGNED TO THAT DEVELOPER
             |
             v
ACTIVITY RELATED TO THOSE TASKS
```

------------------------------------------------------------------------

# 14. WebSocket Architecture to Think Through

The assessment does not prescribe exact Socket.io room names or event
names.

You need to design them.

A possible conceptual model to brainstorm:

``` text
                    WebSocket Server
                           |
          +----------------+----------------+
          |                |                |
        Admin              PM           Developer
          |                |                |
    Global activity    Own projects     Own tasks
```

For project-level live updates, think about a project-specific
channel/room:

``` text
project:<projectId>
```

Then only authorized users viewing that project should receive its live
updates.

For notifications, think about a user-specific channel:

``` text
user:<userId>
```

The exact implementation is an engineering decision; the assessment only
requires correct, role-filtered real-time behavior.

------------------------------------------------------------------------

# 15. Offline / Missed Activity Catch-Up

This is mandatory.

If a user disconnects and misses activity events, when they return they
must see:

> The last 20 activity events they missed.

These events must be fetched from the **database**.

They cannot simply come from:

``` text
in-memory array
server memory
temporary cache
```

The database is the source of truth.

## Conceptual Flow

``` text
User online
    |
    v
Receives live WebSocket events
    |
    X disconnects
    |
    | events occur while offline
    |
    v
PostgreSQL stores activity
    |
    X
    |
    v
User reconnects
    |
    v
Fetch last 20 relevant activity events from DB
    |
    v
Show missed events
```

------------------------------------------------------------------------

# 16. Presence / Online Users

The Admin dashboard must show:

``` text
Active users online right now
```

This must be a **live count using WebSocket presence**.

It must not be implemented as a periodic polling count.

Think through:

``` text
connect
  ↓
identify authenticated user
  ↓
mark user/session online
  ↓
broadcast updated presence count

disconnect
  ↓
remove session / update presence
  ↓
broadcast updated count
```

The exact presence implementation is an engineering decision.

------------------------------------------------------------------------

# 17. Dashboards

There must be role-specific dashboards.

------------------------------------------------------------------------

## 17.1 Admin Dashboard

Required information:

### Total projects

``` text
Total Projects: 12
```

### Total tasks by status

``` text
To Do: 10
In Progress: 8
In Review: 4
Done: 20
```

### Overdue task count

``` text
Overdue: 3
```

### Active users online

``` text
Online Now: 5
```

The online count must update live through WebSocket presence.

------------------------------------------------------------------------

## 17.2 Project Manager Dashboard

Show:

### Their project summary

Only projects created by the logged-in PM.

### Tasks by priority

For example:

``` text
Critical
High
Medium
Low
```

### Upcoming due dates this week

Show relevant upcoming tasks/dates within the current week.

Do not expose another PM's projects.

------------------------------------------------------------------------

## 17.3 Developer Dashboard

Show:

``` text
Tasks assigned to current developer
```

Sort them by:

``` text
Priority
    then
Due Date
```

Only tasks assigned to that developer should be accessible.

------------------------------------------------------------------------

# 18. Task Filtering

All task lists must support:

-   status
-   priority
-   due date range

## Filters must use query parameters

Examples of the concept:

``` text
/tasks?status=IN_PROGRESS
```

``` text
/tasks?priority=HIGH
```

``` text
/tasks?dueFrom=2026-09-01&dueTo=2026-09-15
```

Multiple filters should be composable.

Example:

``` text
/tasks?status=IN_PROGRESS&priority=HIGH&dueFrom=2026-09-01&dueTo=2026-09-30
```

The important requirement is that filters work through URL query
parameters so that filtered views are shareable.

------------------------------------------------------------------------

# 19. Notifications

Notifications are stored in the database and shown in the UI.

There are two explicitly required notification scenarios.

## Scenario A --- Task Assignment

``` text
PM assigns task
      |
      v
Developer receives notification
```

Notification must:

-   be stored in DB
-   appear in UI

## Scenario B --- Task Moved to In Review

``` text
Developer moves task
In Progress → In Review
      |
      v
PM receives notification
```

The PM should receive an in-app notification.

------------------------------------------------------------------------

# 20. Notification UI

Required behavior:

## Badge

Display unread count:

``` text
🔔 3
```

## Dropdown

Clicking the notification icon expands a notification list.

## Mark Individual

A notification can be marked as read individually.

## Mark All

There must be a way to mark all notifications as read.

## Real-Time Count

Unread notification count must update via **WebSocket**.

Do not poll the server for unread counts.

------------------------------------------------------------------------

# 21. Suggested Core Database Model

The assessment specifies relationships and fields, but does not
prescribe an exact schema.

A reasonable planning model to brainstorm is:

``` text
User
 ├── id
 ├── name
 ├── email
 ├── passwordHash
 ├── role
 ├── createdAt
 └── updatedAt

Client
 ├── id
 ├── name
 ├── ...
 └── createdAt

Project
 ├── id
 ├── name
 ├── description
 ├── clientId
 ├── createdById
 ├── createdAt
 └── updatedAt

Task
 ├── id
 ├── projectId
 ├── title
 ├── description
 ├── assignedDeveloperId
 ├── status
 ├── priority
 ├── dueDate
 ├── createdAt
 └── updatedAt

ActivityLog
 ├── id
 ├── taskId
 ├── userId
 ├── oldStatus
 ├── newStatus
 ├── action
 └── createdAt

Notification
 ├── id
 ├── userId
 ├── taskId
 ├── type
 ├── message
 ├── isRead
 └── createdAt
```

A refresh-token/session model may also be required depending on your
authentication design.

**This schema is a planning suggestion, not an exact schema mandated by
the assessment.**

------------------------------------------------------------------------

# 22. Important Relationships

The relational structure should preserve relationships such as:

``` text
User
 |
 +---- creates ----> Project
 |
 +---- assigned ----> Task
 |
 +---- performs ----> ActivityLog
 |
 +---- receives ----> Notification


Client
 |
 +---- owns/has ----> Project


Project
 |
 +---- contains ----> Task


Task
 |
 +---- has ----> ActivityLog
 |
 +---- causes ----> Notification
```

Critical authorization relationships:

``` text
Project.createdById
        |
        v
PM ownership check
```

and:

``` text
Task.assignedDeveloperId
        |
        v
Developer access check
```

------------------------------------------------------------------------

# 23. Database Indexing

The assessment explicitly requires indexes on frequently queried columns
and an explanation of indexing decisions in README.

When designing the schema, think about queries such as:

``` text
Find projects created by PM
Find tasks for a project
Find tasks assigned to developer
Filter tasks by status
Filter tasks by priority
Find tasks by due date
Find activity for a task
Find recent activity
Find notifications for a user
Find unread notifications
```

The final indexes should be based on the actual queries implemented.

Do not simply add random indexes.

Document:

``` text
Index
  ↓
Query it improves
  ↓
Why it is useful
```

------------------------------------------------------------------------

# 24. API Layer --- Suggested Organization

The assessment requires code architecture and separation of concerns.

A clean conceptual backend structure could be:

``` text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── middleware/
│   ├── validators/
│   ├── websocket/
│   ├── jobs/
│   ├── utils/
│   ├── types/
│   └── app.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── ...
```

The exact structure is not prescribed by the assessment.

The important goal is clear separation between:

``` text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository / ORM
  ↓
Database
```

and separate handling for:

``` text
Authentication
Authorization
Validation
WebSocket
Background jobs
Errors
```

------------------------------------------------------------------------

# 25. Suggested Frontend Organization

A possible structure:

``` text
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── hooks/
│   ├── services/
│   ├── api/
│   ├── websocket/
│   ├── store/
│   ├── types/
│   ├── routes/
│   └── utils/
└── ...
```

Again, this is a planning suggestion.

The important requirement is a maintainable TypeScript architecture.

------------------------------------------------------------------------

# 26. Important API Groups to Plan

The assessment does not prescribe exact endpoint names. Before coding,
design the API surface.

At minimum, you will need API functionality for:

## Authentication

``` text
Login
Refresh access token
Logout
Current authenticated user
```

## Users

``` text
Admin:
  list/manage users
```

## Clients

``` text
Admin:
  create
  list
  update
  manage
```

## Projects

``` text
Admin:
  manage all

PM:
  create/manage own projects
```

## Tasks

``` text
PM/Admin:
  create/manage appropriate tasks
  assign developers

Developer:
  view assigned tasks
  update task status
```

## Activity

``` text
Fetch relevant activity
Fetch missed/recent activity
```

## Notifications

``` text
List notifications
Mark one read
Mark all read
Unread count
```

The exact route design is part of the implementation.

------------------------------------------------------------------------

# 27. Critical Authorization Matrix

Before implementation, explicitly define and test permissions.

  -----------------------------------------------------------------------
  Operation                   Admin                 PM          Developer
  -------------- ------------------ ------------------ ------------------
  Manage clients                Yes     No requirement                 No
                                             specified 

  Manage users                  Yes     No requirement                 No
                                             specified 

  Create                        Yes                Yes                 No
  projects                                             

  Manage all                    Yes                 No                 No
  projects                                             

  Manage own                    Yes                Yes                 No
  projects                                             

  Access another                Yes                 No                 No
  PM's project                                         

  Assign tasks    Yes / appropriate Yes / own projects                 No
                     project access                    

  View assigned                 Yes        Appropriate                Yes
  tasks                                 project access 

  View another                  Yes        Appropriate                 No
  developer's                           project access 
  tasks                                                

  Update task     Yes / appropriate Appropriate access  Yes, for assigned
  status                     access                                 tasks

  Global                        Yes                 No                 No
  activity                                             

  Own project                   Yes                Yes    Only where task
  activity                                             assignment permits

  Activity for                  Yes        Appropriate                 No
  another                               project access 
  developer's                                          
  tasks                                                
  -----------------------------------------------------------------------

**Note:** Where the assessment does not explicitly state a PM/Admin
operation, treat the table as a design aid and align the final
implementation with the exact wording of the assessment rather than
assuming extra permissions.

------------------------------------------------------------------------

# 28. Important End-to-End Flows

These flows should work correctly.

## Flow A --- Login

``` text
User enters credentials
        ↓
Backend validates
        ↓
JWT access token generated
        ↓
Refresh token generated
        ↓
Refresh token → HttpOnly cookie
        ↓
User enters dashboard
```

------------------------------------------------------------------------

## Flow B --- PM Creates Project

``` text
PM
 ↓
Create Project
 ↓
POST API
 ↓
Authenticate
 ↓
Authorize PM
 ↓
Create project with createdById = current user
 ↓
Return project
```

------------------------------------------------------------------------

## Flow C --- PM Attempts Another PM's Project

``` text
PM A
 ↓
Requests Project owned by PM B
 ↓
Backend checks project.createdById
 ↓
Does not match current user
 ↓
403 Forbidden
```

------------------------------------------------------------------------

## Flow D --- Developer Updates Task

``` text
Developer
 ↓
Update task status
 ↓
Backend authentication
 ↓
Backend authorization
 ↓
Verify task.assignedDeveloperId
 ↓
Update task
 ↓
Create ActivityLog row
 ↓
Emit WebSocket event
 ↓
Relevant project viewers receive event
 ↓
If new status = In Review
       ↓
Notify relevant PM
```

------------------------------------------------------------------------

## Flow E --- Offline Developer Returns

``` text
Developer disconnects
       ↓
Activity continues happening
       ↓
Activity rows stored in PostgreSQL
       ↓
Developer reconnects
       ↓
Fetch last 20 relevant missed events from DB
       ↓
Display them
       ↓
Continue receiving live WebSocket events
```

------------------------------------------------------------------------

## Flow F --- Assignment Notification

``` text
Task assigned
       ↓
Create Notification DB record
       ↓
Find assigned developer's WebSocket connection
       ↓
Emit notification event
       ↓
Developer sees notification
       ↓
Unread badge updates
```

------------------------------------------------------------------------

## Flow G --- Overdue Scheduler

``` text
Scheduled job runs
       ↓
Find tasks past due date
       ↓
Flag them Overdue
       ↓
Persist result
```

This must be a background job and not page-load logic.

------------------------------------------------------------------------

# 29. Error Response Design

Every endpoint should return a predictable structure.

For example:

``` json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this resource"
  }
}
```

Potential categories to design:

``` text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INTERNAL_ERROR
```

Do not return raw stack traces.

------------------------------------------------------------------------

# 30. Validation Checklist

Validate every API input on the server.

Examples:

## Login

``` text
email
password
```

## Project

``` text
name
description
clientId
```

## Task

``` text
title
description
assignedDeveloperId
status
priority
dueDate
```

## Filters

``` text
status
priority
dueFrom
dueTo
```

The exact validation library is not prescribed by the assessment.

------------------------------------------------------------------------

# 31. Seed Data

The repository must contain a seed script.

It must create:

``` text
1 Admin
2 Project Managers
4 Developers
```

Total:

``` text
7 users
```

It must also create:

``` text
At least 3 projects
```

Each project must contain:

``` text
At least 5 tasks
```

Tasks must have different statuses.

There must be:

``` text
At least 2 overdue tasks
```

There must also be:

``` text
Pre-existing activity log entries
```

so the activity feed has data immediately after startup.

------------------------------------------------------------------------

# 32. Seed Data Planning Example

A planning setup could look like:

``` text
Admin
└── admin account

PM 1
└── Project Alpha
    ├── Task 1
    ├── Task 2
    ├── Task 3
    ├── Task 4
    └── Task 5

PM 2
└── Project Beta
    ├── Task 6
    ├── Task 7
    ├── Task 8
    ├── Task 9
    └── Task 10

Admin / PM-created
└── Project Gamma
    ├── Task 11
    ├── Task 12
    ├── Task 13
    ├── Task 14
    └── Task 15
```

Make sure the final ownership and assignments allow the evaluator to
test all role restrictions.

------------------------------------------------------------------------

# 33. Testing Scenarios You Should Be Able to Demonstrate

Before submission, manually or through automated tests verify:

## Authentication

-   Login succeeds with valid credentials.
-   Invalid credentials are rejected.
-   Access token expires/refresh flow works.
-   Refresh token is in HttpOnly cookie.
-   Refresh token is not stored in localStorage.

## RBAC

-   Admin can access all required resources.
-   PM can access their own projects.
-   PM cannot access another PM's projects.
-   Developer can access assigned tasks.
-   Developer cannot access another developer's tasks.
-   Direct API requests cannot bypass permissions.
-   Modified/forged role claims cannot grant unauthorized access.

## Tasks

-   Task creation works.
-   Task assignment works.
-   Status update works.
-   Priority works.
-   Due dates work.
-   Status history is persisted.

## WebSocket

-   Two clients viewing the same project receive a status update.
-   No refresh is required.
-   Unauthorized users do not receive activity they should not see.
-   Admin gets global activity.
-   PM gets own-project activity.
-   Developer gets activity for assigned tasks.
-   Reconnection provides the last 20 relevant missed events.

## Presence

-   Online user count increases when a user connects.
-   Online count decreases when a user disconnects.
-   Admin dashboard updates live.

## Notifications

-   Assignment creates developer notification.
-   In Review creates PM notification.
-   Notification persists in DB.
-   Unread count updates through WebSocket.
-   Individual read works.
-   Mark all read works.

## Scheduler

-   Overdue tasks are flagged by the background job.
-   It is not dependent on page load.

## Filters

-   Status filter works.
-   Priority filter works.
-   Due-date range works.
-   Filters are represented in query parameters.

------------------------------------------------------------------------

# 34. README Requirements

The README must include:

## Local Setup

Explain:

``` text
Prerequisites
Environment variables
Install dependencies
Start PostgreSQL
Run migrations
Run seed
Start backend
Start frontend
```

The assessment prefers Docker for local setup.

## Database

Include:

-   schema diagram OR detailed schema description
-   relationships
-   indexes
-   explanation of indexing decisions

## Architecture Decisions

Explain:

### WebSocket choice

Why:

``` text
Socket.io
```

or:

``` text
Native WebSocket
```

was selected.

### Background job choice

Why:

``` text
node-cron
```

or:

``` text
Bull
```

was selected.

### Token storage

Explain:

``` text
Access token approach
Refresh token approach
HttpOnly cookie
```

### Backend framework

Explain:

``` text
Express
```

or:

``` text
Fastify
```

choice.

## Known Limitations

List genuine limitations if any.

------------------------------------------------------------------------

# 35. Submission Requirements

The final submission requires:

## Public Repository

A public:

``` text
GitHub
```

or:

``` text
GitLab
```

repository.

## Hosted Application

Host the application on:

``` text
Vercel
```

and provide the live application link.

## Explanation Field

Write **150--250 words** covering:

1.  The hardest problem you solved.
2.  How you handled the real-time role-filtered feed.
3.  One thing you would do differently.

## Submission Form

The assessment provides a submission form link on the final page.

------------------------------------------------------------------------

# 36. Evaluation Weight

The assessment evaluates:

  Area                                                            Weight
  ----------------------------------------------------------- ----------
  Role-based access --- API-level enforcement                    **25%**
  Real-time feed --- role filtering + missed event catch-up      **25%**
  Database design --- schema, relationships, indexes             **20%**
  Code architecture --- separation of concerns + TypeScript      **20%**
  Seed data + README + setup experience                          **10%**
  **Total**                                                     **100%**

Therefore, the two highest-value areas are:

``` text
RBAC        → 25%
WebSockets  → 25%
```

Together they account for **50%** of the evaluation.

------------------------------------------------------------------------

# 37. Auto-Disqualification Checklist

Do not submit with any of these:

``` text
[ ] Role access enforced only on frontend
[ ] WebSocket replaced with polling
[ ] No seed script
[ ] No TypeScript
[ ] Raw SQL randomly mixed into controllers
[ ] Hardcoded secrets
[ ] Missing refresh token implementation
```

Any of these can result in auto-disqualification according to the
assessment.

------------------------------------------------------------------------

# 38. Final Definition of Done

Before submission, the application should satisfy every item below.

## Authentication

-   [ ] React + TypeScript
-   [ ] JWT authentication
-   [ ] Access token
-   [ ] Refresh token
-   [ ] Refresh token in HttpOnly cookie
-   [ ] No refresh token in localStorage
-   [ ] Protected routes

## Authorization

-   [ ] Admin role
-   [ ] PM role
-   [ ] Developer role
-   [ ] API-level authorization
-   [ ] PM ownership checks
-   [ ] Developer task-assignment checks
-   [ ] Direct API access cannot bypass permissions

## Projects

-   [ ] Client relationship
-   [ ] Project creation
-   [ ] Project ownership
-   [ ] PM can manage only own projects

## Tasks

-   [ ] Title
-   [ ] Description
-   [ ] Assigned developer
-   [ ] Status
-   [ ] Priority
-   [ ] Due date
-   [ ] Status history

## Overdue

-   [ ] Background scheduler
-   [ ] Overdue flagging
-   [ ] At least 2 overdue seeded tasks

## Activity

-   [ ] WebSocket
-   [ ] Real-time task updates
-   [ ] Stored activity log
-   [ ] Admin global feed
-   [ ] PM own-project feed
-   [ ] Developer assigned-task feed
-   [ ] Last 20 missed events from DB

## Presence

-   [ ] WebSocket presence
-   [ ] Live online-user count

## Notifications

-   [ ] Assignment notification
-   [ ] In Review notification
-   [ ] DB persistence
-   [ ] Unread badge
-   [ ] Dropdown
-   [ ] Mark one read
-   [ ] Mark all read
-   [ ] Real-time unread count

## Dashboard

-   [ ] Admin dashboard
-   [ ] PM dashboard
-   [ ] Developer dashboard

## Filters

-   [ ] Status
-   [ ] Priority
-   [ ] Due date range
-   [ ] Query parameters

## Backend Quality

-   [ ] Server-side validation
-   [ ] Structured errors
-   [ ] No raw stack traces
-   [ ] `.env` secrets
-   [ ] Clean architecture
-   [ ] TypeScript throughout

## Database

-   [ ] PostgreSQL
-   [ ] Foreign keys
-   [ ] Appropriate indexes
-   [ ] Indexing decisions documented

## Seed

-   [ ] 1 Admin
-   [ ] 2 PMs
-   [ ] 4 Developers
-   [ ] 3+ projects
-   [ ] 5+ tasks per project
-   [ ] Different task statuses
-   [ ] 2+ overdue tasks
-   [ ] Existing activity logs

## Delivery

-   [ ] Public GitHub/GitLab repository
-   [ ] Vercel deployment
-   [ ] README
-   [ ] Local setup instructions
-   [ ] Docker-preferred setup documented
-   [ ] Schema documentation
-   [ ] Architecture decisions
-   [ ] Known limitations
-   [ ] 150--250 word explanation
-   [ ] Submission form completed

------------------------------------------------------------------------

# 39. Brainstorming Questions Before Coding

Use these questions to design the system before writing code.

## Authentication

``` text
How will access and refresh tokens be generated?
Where will the access token live?
How will refresh happen?
How will logout invalidate/revoke refresh sessions?
```

## Authorization

``` text
Where is authorization enforced?
How does a PM prove they own a project?
How does a Developer prove a task belongs to them?
What happens if someone requests an unauthorized resource ID directly?
```

## Database

``` text
What are the entities?
What are the foreign keys?
Which relationships are one-to-many?
Which fields require indexes?
How will activity history be stored?
How will refresh sessions be stored?
```

## WebSocket

``` text
How does a socket authenticate?
How are users assigned to rooms?
How are project viewers identified?
How does the server prevent unauthorized activity delivery?
How is presence tracked?
How does reconnect catch up the last 20 events?
```

## Notifications

``` text
Which events create notifications?
How are notifications persisted?
How is unread count calculated?
How is unread count pushed in real time?
```

## Scheduler

``` text
How often should the overdue job run?
What database query identifies overdue tasks?
How do you avoid repeatedly processing the same task unnecessarily?
```

## Frontend State

``` text
Which state is server state?
Which state is UI state?
How will WebSocket events update cached task/activity data?
How will URL query parameters control filters?
What happens during reconnect?
```

## Deployment

``` text
Where does PostgreSQL run?
Where does the API run?
How will WebSocket connections work in production?
How will environment variables be configured?
How will frontend/backend URLs be configured?
```

------------------------------------------------------------------------

# 40. Recommended Build Priority

Prioritize according to the assessment's scoring:

``` text
1. Database schema
2. Authentication + refresh tokens
3. API-level RBAC
4. Projects + tasks
5. Persistent activity logging
6. WebSocket real-time activity
7. Role-filtered WebSocket delivery
8. Offline last-20 catch-up
9. Notifications
10. Presence
11. Background overdue job
12. Dashboards
13. Filters
14. Seed script
15. Validation + error handling
16. README
17. Deployment
18. UI polish
```

The assessment's scoring makes **RBAC and real-time activity the
highest-priority technical areas**.

------------------------------------------------------------------------

# 41. Key Principle

The application should have this fundamental architecture:

``` text
                 ┌──────────────────────┐
                 │ React + TypeScript   │
                 │                      │
                 │ Role-specific UI     │
                 │ Dashboards            │
                 │ Tasks                 │
                 │ Activity              │
                 │ Notifications        │
                 └──────────┬───────────┘
                            │
                  REST API  │  WebSocket
                            │
                 ┌──────────▼───────────┐
                 │ Node.js Backend      │
                 │                      │
                 │ Auth                 │
                 │ RBAC                 │
                 │ Validation           │
                 │ Services             │
                 │ WebSocket            │
                 │ Notifications        │
                 │ Background Jobs      │
                 └──────────┬───────────┘
                            │
                 ┌──────────▼───────────┐
                 │ PostgreSQL           │
                 │                      │
                 │ Users                │
                 │ Clients              │
                 │ Projects             │
                 │ Tasks                │
                 │ Activity Logs        │
                 │ Notifications        │
                 │ Auth/Refresh data    │
                 └──────────────────────┘
```

The **backend/database must be the source of truth** for authorization,
task state, activity history, and notifications. The frontend should
never be responsible for enforcing security.
