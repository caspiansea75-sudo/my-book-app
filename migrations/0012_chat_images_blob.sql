-- Chat pictures / avatars can live in Vercel Blob; Neon then keeps only the link.
alter table chat_images alter column data drop not null;
alter table chat_images add column if not exists url text;
