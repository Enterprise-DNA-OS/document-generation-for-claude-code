create function stamp_updated() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function keep_snapshot() returns trigger language plpgsql as $$ begin raise exception 'Snapshots are append-only'; end $$;
create table templates (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 owner text not null, active boolean not null default true, current_version integer not null default 1 check(current_version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index template_name on templates(lower(name));
create table template_versions (
 id uuid primary key default gen_random_uuid(), template_id uuid not null references templates,
 version integer not null, body text not null, editor text not null, note text not null,
 source_format text not null default 'text', source_hash text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(template_id,version)
);
create table template_reviews (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references template_versions,
 reviewer text not null, decision text not null check(decision in ('approved','changes')),
 evidence text not null check(length(trim(evidence))>0), review_due date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table jobs (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 template_id uuid not null references templates, owner text not null, due_date date not null,
 status text not null default 'open' check(status in ('open','complete','archived')),
 data jsonb not null check(jsonb_typeof(data)='object'), data_version integer not null default 1,
 privacy text not null default 'unknown' check(privacy in ('unknown','personal','business')),
 purpose text, accuracy_evidence text, accuracy_version integer, retention_review date,
 external_key text unique, source_fields jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table outputs (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references jobs,
 version_id uuid not null references template_versions, data_version integer not null,
 data_snapshot jsonb not null, body text not null, html text not null, sha256 text not null,
 actor text not null, privacy_snapshot jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table output_reviews (
 id uuid primary key default gen_random_uuid(), output_id uuid not null references outputs,
 reviewer text not null, decision text not null check(decision in ('approved','changes')),
 evidence text not null check(length(trim(evidence))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), entity_id uuid not null, action text not null,
 actor text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table import_runs (
 id uuid primary key default gen_random_uuid(), external_key text not null, digest text not null,
 job_id uuid not null references jobs, source_name text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(external_key,digest)
);
do $$ declare t text; begin
 foreach t in array array['templates','template_versions','template_reviews','jobs','outputs','output_reviews','activity','import_runs'] loop
  execute format('alter table %I enable row level security',t);
  execute format('revoke all on %I from public',t);
  execute format('create trigger updated before update on %I for each row execute function stamp_updated()',t);
 end loop;
 foreach t in array array['template_versions','template_reviews','outputs','output_reviews','activity','import_runs'] loop
  execute format('create trigger immutable before update or delete on %I for each row execute function keep_snapshot()',t);
 end loop;
end $$;
create view template_register as
 select t.id,t.name,t.owner,t.active,t.current_version,v.id as version_id,v.editor,
 r.decision,r.reviewer,r.review_due,
 case when not t.active then 'archived' when r.decision is distinct from 'approved' then 'needs approval'
 when r.review_due<current_date then 'review overdue' else 'ready' end as readiness
 from templates t join template_versions v on v.template_id=t.id and v.version=t.current_version
 left join lateral (select * from template_reviews where version_id=v.id order by created_at desc,id desc limit 1) r on true;
create view job_register as
 select j.id,j.name,t.name as template,j.owner,j.due_date,j.status,j.data_version,j.privacy,
 t.readiness,j.retention_review,
 (select count(*)::int from outputs o where o.job_id=j.id) as output_count
 from jobs j join template_register t on t.id=j.template_id;
create view attention as
 select j.id,j.name,j.owner,'overdue document' as issue from jobs j where status='open' and due_date<current_date
 union all select j.id,j.name,j.owner,'template not ready' from jobs j join template_register t on t.id=j.template_id where j.status='open' and t.readiness<>'ready'
 union all select id,name,owner,'classify information' from jobs where status<>'archived' and privacy='unknown'
 union all select id,name,owner,'accuracy evidence missing or stale' from jobs where status='open' and privacy='personal' and (nullif(trim(accuracy_evidence),'') is null or accuracy_version is distinct from data_version)
 union all select id,name,owner,'retention decision due' from jobs where privacy='personal' and (retention_review is null or retention_review<current_date)
 union all select id,name,owner,'record lawful purpose' from jobs where privacy='personal' and nullif(trim(purpose),'') is null;
create view output_register as
 select o.id,j.name,o.job_id,t.name as template,v.version,o.data_version,o.actor,o.sha256,o.created_at,
 r.decision,r.reviewer,
 (o.data_version<>j.data_version or v.version<>t.current_version) as superseded
 from outputs o join jobs j on j.id=o.job_id join template_versions v on v.id=o.version_id join templates t on t.id=v.template_id
 left join lateral (select * from output_reviews where output_id=o.id order by created_at desc,id desc limit 1) r on true;
create view owner_workload as
 select owner,count(*)::int as open_jobs,count(*) filter(where due_date<current_date)::int as overdue,
 count(*) filter(where due_date between current_date and current_date+7)::int as due_week
 from jobs where status='open' group by owner;
