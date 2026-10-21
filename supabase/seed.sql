insert into templates(id,name,owner) values
 ('10000000-0000-4000-8000-000000000001','Service confirmation','Aroha Chen'),
 ('10000000-0000-4000-8000-000000000002','Renewal letter','Mia Wilson'),
 ('10000000-0000-4000-8000-000000000003','Account summary','Aroha Chen') on conflict do nothing;
insert into template_versions(id,template_id,version,body,editor,note) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,E'Service confirmation for {{ACCOUNT_NAME}}\nReference: {{REFERENCE}}\n{{TableStart:SERVICES}}{{DESCRIPTION}}: {{HOURS}} hours\n{{TableEnd:SERVICES}}Contact: {{CONTACT_NAME}}','Aroha Chen','Fictional demo template'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',1,E'Dear {{CONTACT_NAME}},\nPlease review the renewal for {{ACCOUNT_NAME}} on {{RENEWAL_DATE}}.','Mia Wilson','Review deliberately overdue'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003',1,E'Account summary: {{ACCOUNT_NAME}}\n{{TableStart:ITEMS}}{{DESCRIPTION}}: {{STATUS}}\n{{TableEnd:ITEMS}}','Aroha Chen','Awaiting first approval') on conflict do nothing;
insert into template_reviews(id,version_id,reviewer,decision,evidence,review_due) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Noah Patel','approved','Demo wording and field names checked',current_date+60),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Noah Patel','approved','Prior version checked',current_date-7) on conflict do nothing;
insert into jobs(id,name,template_id,owner,due_date,data,privacy,purpose,accuracy_evidence,accuracy_version,retention_review) values
 ('40000000-0000-4000-8000-000000000001','Harbour service confirmation','10000000-0000-4000-8000-000000000001','Aroha Chen',current_date-2,'{"ACCOUNT_NAME":"Harbour Sample Ltd","REFERENCE":"DEMO-101","CONTACT_NAME":"Taylor Example","SERVICES":[{"DESCRIPTION":"Records migration","HOURS":"8"},{"DESCRIPTION":"Review meeting","HOURS":"2"}]}','personal','Confirm agreed work','Fictional contact checked against demo brief',1,current_date+90),
 ('40000000-0000-4000-8000-000000000002','Summit renewal','10000000-0000-4000-8000-000000000002','Mia Wilson',current_date+3,'{"ACCOUNT_NAME":"Summit Example Ltd","CONTACT_NAME":"Jordan Sample","RENEWAL_DATE":"Next month"}','personal','Prepare renewal',null,null,current_date-1),
 ('40000000-0000-4000-8000-000000000003','Harbour account summary','10000000-0000-4000-8000-000000000003','Aroha Chen',current_date-4,'{"ACCOUNT_NAME":"Harbour Sample Ltd","ITEMS":[{"DESCRIPTION":"Records project","STATUS":"Review"}]}','unknown',null,null,null,null),
 ('40000000-0000-4000-8000-000000000004','Westhaven service confirmation','10000000-0000-4000-8000-000000000001','Aroha Chen',current_date+2,'{"ACCOUNT_NAME":"Westhaven Demo Ltd","REFERENCE":"DEMO-102","SERVICES":[]}','business',null,null,null,null) on conflict do nothing;
