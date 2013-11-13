create table if not exists words(
  idx int primary key,
  word varchar(128),
  pos varchar(16),
  words varchar(128),
  glossary text
);