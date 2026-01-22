-- migrate:up

-- seed users first and store their ids in variables
with inserted_users as (
    insert into users (email, full_name, password_hash)
    values
        ('john@example.com', 'john doe', 'hashed_password_1'),
        ('jane@example.com', 'jane smith', 'hashed_password_2'),
        ('bob@example.com', 'bob johnson', 'hashed_password_3'),
        ('alice@example.com', 'alice brown', 'hashed_password_4')
    returning id, email
),

-- seed users_profiles
inserted_profiles as (
    insert into users_profiles (user_id, avatar_url, bio)
    select
        id,
        'https://example.com/avatar' || row_number() over () || '.jpg',
        case
            when email like 'john%' then 'project manager with 5 years of experience'
            when email like 'jane%' then 'senior developer'
            when email like 'bob%' then 'ux designer'
            else 'bio not available'
        end
    from inserted_users
),

-- seed projects
inserted_projects as (
    insert into projects (name, description, status, owner_id)
    select
        p.name,
        p.description,
        'active'::project_status,
        u.id
    from (
        values
            ('website redesign', 'complete overhaul of the company website'),
            ('mobile app development', 'new mobile app for customers'),
            ('database migration', 'migrate legacy database to new system')
    ) as p(name, description)
    cross join (
        select id from inserted_users where email = 'john@example.com'
    ) u
    returning id, name
),

-- seed tasks
inserted_tasks as (
    insert into tasks (
        project_id,
        title,
        description,
        priority,
        status,
        due_date,
        assigned_to
    )
    select
        p.id,
        t.title,
        t.description,
        t.priority,
        t.status,
        t.due_date,
        u.id
    from (
        select
            'website redesign' as project_name,
            'design homepage' as title,
            'create new homepage design' as description,
            1 as priority,
            'pending'::task_status as status,
            '2024-04-01'::date as due_date,
            'bob@example.com' as assignee
        union all
        select
            'website redesign',
            'implement frontend',
            'develop frontend based on design',
            2,
            'pending'::task_status,
            '2024-04-15'::date,
            'alice@example.com'
    ) t
    join inserted_projects p on p.name = t.project_name
    join inserted_users u on u.email = t.assignee
)

-- seed project_members
insert into project_members (project_id, user_id, role)
select
    p.id,
    u.id,
    m.role::member_role
from (
    select 'website redesign' as project_name, 'john@example.com' as user_email, 'owner' as role
    union all
    select 'website redesign', 'jane@example.com', 'member'
    union all
    select 'website redesign', 'bob@example.com', 'member'
    union all
    select 'website redesign', 'alice@example.com', 'member'
    union all
    select 'mobile app development', 'john@example.com', 'owner'
    union all
    select 'mobile app development', 'jane@example.com', 'member'
    union all
    select 'mobile app development', 'bob@example.com', 'member'
    union all
    select 'database migration', 'john@example.com', 'owner'
    union all
    select 'database migration', 'jane@example.com', 'member'
) m
join inserted_projects p on p.name = m.project_name
join inserted_users u on u.email = m.user_email;

-- migrate:down

-- Clear all data
truncate table project_members cascade;
truncate table tasks cascade;
truncate table projects cascade;
truncate table user_profiles cascade;
truncate table users cascade;