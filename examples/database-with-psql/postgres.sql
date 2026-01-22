--migrate:up

-- Create custom enum types
create type project_status as enum ('active', 'completed', 'archived');
create type task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');
create type member_role as enum ('owner', 'admin', 'member');

-- Create users table
create table users (
    id UUID primary key default gen_random_uuid(),
    email text unique not null,
    full_name text not null,
    password_hash text not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

-- Create users_profiles table (one-to-one relationship with users)
create table users_profiles (
    id UUID primary key default gen_random_uuid(),
    user_id UUID not null unique references users on delete cascade,
    avatar_url text,
    bio text,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

-- Create projects table
create table projects (
    id UUID primary key default gen_random_uuid(),
    name text not null,
    description text,
    status project_status default 'active' not null,
    owner_id UUID not null references users on delete restrict,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

-- Create tasks table (one-to-many relationship with projects)
create table tasks (
    id UUID primary key default gen_random_uuid(),
    project_id UUID not null references projects on delete cascade,
    title text not null,
    description text,
    priority integer not null default 1 check (priority between 1 and 5),
    status task_status default 'pending' not null,
    assigned_to UUID references users on delete set null,
    due_date date,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

-- Create project_members table (many-to-many relationship between users and projects)
create table project_members (
    project_id UUID not null references projects on delete cascade,
    user_id UUID not null references users on delete cascade,
    role member_role default 'member' not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    primary key (project_id, user_id)
);

-- migrate:down

-- Drop tables
drop table if exists project_members;
drop table if exists tasks;
drop table if exists projects;
drop table if exists users_profiles;
drop table if exists users;

-- Drop custom enum types
drop type if exists member_role;
drop type if exists task_status;
drop type if exists project_status;