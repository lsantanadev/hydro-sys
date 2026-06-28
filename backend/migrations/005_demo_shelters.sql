begin;

alter table public.shelters
  add column if not exists address varchar(255);

insert into public.shelters (name, address, latitude, longitude, capacity, occupancy, active)
select 'Abrigo Comunitario Centro', 'Rua Frei Schubert, 140 - Centro, Palhoca - SC', -27.64461, -48.66771, 80, 12, true
where not exists (
  select 1 from public.shelters where lower(name) = lower('Abrigo Comunitario Centro')
);

insert into public.shelters (name, address, latitude, longitude, capacity, occupancy, active)
select 'Escola Municipal Ponte do Imaruim', 'Rua Jose Cosme Pamplona, 620 - Ponte do Imaruim, Palhoca - SC', -27.61272, -48.63892, 120, 35, true
where not exists (
  select 1 from public.shelters where lower(name) = lower('Escola Municipal Ponte do Imaruim')
);

insert into public.shelters (name, address, latitude, longitude, capacity, occupancy, active)
select 'Ginasio Comunitario Aririu', 'Rua Aniceto Zacchi, 350 - Aririu, Palhoca - SC', -27.63672, -48.66035, 100, 18, true
where not exists (
  select 1 from public.shelters where lower(name) = lower('Ginasio Comunitario Aririu')
);

update public.shelters
set address = 'Rua Frei Schubert, 140 - Centro, Palhoca - SC'
where lower(name) = lower('Abrigo Comunitario Centro');

update public.shelters
set address = 'Rua Jose Cosme Pamplona, 620 - Ponte do Imaruim, Palhoca - SC'
where lower(name) = lower('Escola Municipal Ponte do Imaruim');

update public.shelters
set address = 'Rua Aniceto Zacchi, 350 - Aririu, Palhoca - SC'
where lower(name) = lower('Ginasio Comunitario Aririu');

commit;
