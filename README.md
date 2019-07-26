## Synopsis

`app_server.js`  is a very simple link-shortening server. It provides
endpoints for creating short links, as well as for, searching for links
by original url, or the short name, or  listing all of
a user's links. There is also an endpoint for deleting your own links.
There is no update ability, but you can delete and recreate.

Anyone can access a shortened link, but all the other endpoint are
shibbolized through an institutions IDM.

## Motivation

LBL needed a its own link-shortener that it could curate.
The problem seemed too trivial to justify licensing commercial solutions,
here's a stab at it.

## Installation

1. Install mysql, node.js, and nginx. Configure mysql as required by your system.

2. create the necessary mysql users and database. See `SQL_SETUP.txt` for a bit more info.

3. create a `app_creds.json` file like:

   ```json
   { "host": "localhost", "user": "us2_setter", "password": "xxxxxxxx" }
   ```

4. Edit `lib/config.js` as required (to match the hostname you will use, etc.

5. Install the necessary no libs:

   ```
   npm install
   ```

6. Configure nginx.

   You don't have to use nginx to reverse proxy access to the server, but I prefer to do it that way. Let the shortener run on http at local 8090 or so, and make sure firewall rules do not allow external access to that port, then configure nginx to terminate https and forward to the shortener.

   My nginx.conf looks like this:

   ```
   server {
       listen 80;
        return 301 https://$host$request_uri;
   }

   server {
       listen 443;
       server_name skunkworks.lbl.gov;
       ssl_certificate      /etc/letsencrypt/live/skunkworks.lbl.gov/fullchain.pem;
       ssl_certificate_key  /etc/letsencrypt/live/skunkworks.lbl.gov/privkey.pem;

       ssl on;
       ssl_session_cache builtin:1000 shared:SSL:10m;
       ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
       ssl_ciphers HIGH:!aNULL:!eNULL:!EXPORT:!CAMELLIA:!DES:!MD5:!PSK:!RC4;
       ssl_prefer_server_ciphers on;

       location /us2/ {
           proxy_set_header     Host $host;
           proxy_set_header     X-Real-IP $remote_addr;
           proxy_set_header     X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header     X-Forwarded-Proto $scheme;
           proxy_read_timeout   90;
           proxy_pass           http://localhost:8090;
           client_body_timeout  60s;
           client_max_body_size 16k;
       }
   }
   ```

   Remember to restart nginx after making changes.

7. Start the app server.

(runs the server -- probably want to make into a daemon)
`node app_server.js`

You probably want to daemonize the server. An example `us2.service` shows a simple systemd setup.

## API Reference

Probably the easiest way to understand the API is to look at the
endpoints used in `static/submitter.js`:

#### POST .../create

Takes a json payload like:

```json
{"url":"http://blahdeedah.com"}
```

or

```json
{"url":"http://blahdeedah.com","suggested_hash":"blee"}
```

#### GET .../show

Returns json array of all of the logged in user's links.

#### POST .../delete

Expects json that looks like:

```json
{"shorturl":"blee"}
```

Note that it doesn't take the whole url, just the hash part of it.
Also note that it will only work on the own shib logged in user's
URLs.

#### GET .../search

Takes to url encoded parameters:

 `by` can be `"url"` or `"hash"`, depending on what you want to look at
 `term` is the search term.

For example

```url
http://skunkworks.lbl.gov/us2/search?by=url&term="times"
```

Might return an URL for the nytimes.

#### GET .../dump/urls and GET .../dump/log

Return json version of the *entire* URL and log tables, useful
for administrators and in fact only people marked as administrators
in the config file can access these endpoints.


## Maintenance and curation.

This can be done directly on the tables in the us2 database. There
are only two, one for the links themselves and a second for a log.
It should be straightforward.

## User Interface

Hopefully is self-explanatory!

When creating links, users can supply the short name they
want, and the system will use if it is acceptable and not already
in use. Otherwise, the user can leave it blank and a short hash
will be generated.

### Using links

Any GET from /us2/<name> where 'name' is the value generated in the previous
creation step will redirect the user directly and immediately to that
original url.

If 'name' is not found in the database, an error message is shown and
the user is invited to create the shortened link.

## Contributors

Dave Jacobowitz

## License

TBD.

