-- migrate:up

-- create indexes
create index idx_users_email on users(email);
create index idx_users_created_at on users(created_at desc);
create index idx_tasks_project_id on tasks(project_id);
create index idx_tasks_assigned_to on tasks(assigned_to);
create index idx_tasks_created_at on tasks(created_at desc);
create index idx_tasks_status on tasks(status);
create index idx_project_members_project_id on project_members(project_id);
create index idx_project_members_user_id on project_members(user_id);
create index idx_projects_owner_id on projects(owner_id);
create index idx_projects_created_at on projects(created_at desc);

-- create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$ 
begin 
    new.updated_at = current_timestamp;
    return new;
end;
$$ language 'plpgsql';

-- create triggers for updating updated_at
create trigger update_users_updated_at
    before update on users
    for each row
    execute function update_updated_at_column();

create trigger update_users_profiles_updated_at
    before update on users_profiles
    for each row
    execute function update_updated_at_column();

create trigger update_projects_updated_at
    before update on projects
    for each row
    execute function update_updated_at_column();

create trigger update_tasks_updated_at
    before update on tasks
    for each row
    execute function update_updated_at_column();

create trigger update_project_members_updated_at
    before update on project_members
    for each row
    execute function update_updated_at_column();

-- migrate:down

-- drop triggers
drop trigger if exists update_project_members_updated_at on project_members;
drop trigger if exists update_tasks_updated_at on tasks;
drop trigger if exists update_projects_updated_at on projects;
drop trigger if exists update_users_profiles_updated_at on users_profiles;
drop trigger if exists update_users_updated_at on users;

-- drop function
drop function if exists update_updated_at_column();

-- drop indexes
drop index if exists idx_projects_owner_id;
drop index if exists idx_project_members_user_id;
drop index if exists idx_project_members_project_id;
drop index if exists idx_tasks_status;
drop index if exists idx_tasks_assigned_to;
drop index if exists idx_tasks_project_id;
drop index if exists idx_users_email;
drop index if exists idx_users_created_at;
drop index if exists idx_tasks_created_at;
drop index if exists idx_projects_created_at;
