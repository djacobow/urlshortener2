
# How to set up mysql for the LBL link shortener.

## Install mysql

```
sudo apt install mysql
```

There's more rigamarole, including setting up a password for root, to
be done here:

```
/usr/bin/mysql_secure_installation
```

## Create a database for the shortener.

Start mysql:

```
mysql -u root -p
```

And then run the command:

```mysql
create database us2;
```

## Create users.

We will create three users with different privileges. This is 
probably more fuss than necessary, but here you go

```mysql
create user us2_getter@localhost;
create user us2_setter@localhost;
create user us2_dumper@localhost;
```

The getter is a read-only account good for lookups of the main
table and updates to the log. It is intended to be used with a 
separate lookup server (which you don't have to run)
```mysql
grant select on us2.*        to us2_getter@localhost;
grant insert on us2.log      to us2_getter@localhost;
```

The setter is the account used by the server, with privs
to create links in the url table and delete them, too.

```mysql
grant insert on us2.*        to us2_setter@localhost;
grant create on us2.*        to us2_setter@localhost;
grant select on us2.*        to us2_setter@localhost;
grant update on us2.*        to us2_setter@localhost;
grant delete on us2.urls     to us2_setter@localhost;
grant update on us2.urls     to us2_setter@localhost;
```

(Note that you will have to come back and run the privs command
on the urls table since it doesn't get created until after you've
run the server.)

Finally, the dumper is for backups. Select and lock only:

```mysql
grant select on us2.*        to us2_dumper@localhost;
grant lock tables  on us2.*  to us2_dumper@localhost;
```

All three accounts will need passwords.

```mysql
set password for us2_getter@localhost = password('lalalalalala');
set password for us2_setter@localhost = password('lalalalalala');
set password for us2_dumper@localhost = password('lalalalalala');
```

Don't forget to flush!

```mysql
flush privileges;
```

After making these changes, you'll have to change `lib/app_creds.json`
and `lib/lu_creds.json` as appropriate.

# Backups

Something like

```
mysqldump -u us2_dumper -p --result-file=us2_dump.sql us2
```
