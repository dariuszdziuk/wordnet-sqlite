drop table if exists words;
create table words(
  idx int primary key,
  word varchar(128),
  pos varchar(16),
  words varchar(128),
  glossary text
);