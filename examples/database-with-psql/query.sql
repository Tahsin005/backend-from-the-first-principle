-- join queries to get data
select u.*, to_jsonb(up.*) as profile 
from users u
left join user_profiles up 
on u.id = up.user_id 
order by u.created_at desc;

-- parameterized query
select u.*, to_jsonb(up.*) as profile 
from users u
left join user_profiles up 
on u.id = up.user_id 
where u.email = :userId -- bind userId parameter
order by u.created_at desc;

-- dynamic filtering (with pagination)
select u.*, to_jsonb(up.*) as profile 
from users u
left join user_profiles up 
on u.id = up.user_id 
where u.full_name ilike :letter || '%' -- concat letter filter with wildcard
order by :sortBy :sortOrder -- dynamic sorting (u.email asc)
limit :limit offset :page; -- pagination

-- POST /api/users
insert into users (email, full_name, password_hash)
values (:email, :fullName, :passwordHash)
returning *;

-- PATCH /api/users/:id
update users_profiles
set avatar_url = :avatarUrl,
    bio = :bio,
    phone = :phone,
    updated_at = current_timestamp
where user_id = :userId