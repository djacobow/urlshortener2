var argv               = require('minimist')(process.argv.slice(2));
var path               = require('path');
var db_creds = require(path.resolve(__dirname, "../app_creds.json"));

var daves_laptop = false;

var raw_config = {
    sp: {
        idp: {
            certfiles: [ './certs/idcert1.crt', './certs/idcert2.crt', ],
            sso_login: 'https://login.lbl.gov/idp/profile/SAML2/Redirect/SSO',
            entity_id: 'https://login.lbl.gov/idp/shibboleth',
        },
        sp: {
            certfile: './certs/saml.crt',
            pemfile:  './certs/saml.pem',
            url_base: 'https://skunkworks.lbl.gov/us2',
        },
        eppn_key: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
        endpoints: {
            assert: '/sso/assert',
            metadata: '/sso/metadata.xml',
            login: '/sso/login',
        },
        session: {
            cookie_prefix: 'lblus2_',
        }
    },
    app: {
        real_files: { 
            'form.html': 1, 
            'submitter.js': 1, 
            'helpers.js': 1,
            'favicon.ico': 1, 
            'styles.css': 1,
            'berkeleylab.png': 1,
        },
        admins: {
            'dgj@lbl.gov': 1,
        },
        db: {
            conn_params: {
                host: 'localhost',
                user: 'us2_setter',
            },
            name: 'us2',
            restrictions: {
                max_url_length: 1024,
                max_hash_length: 80,
                max_err_length: 512,
            },
        },
        cache: {
            use: false,
            max_age: 15 * 60 * 1000,
            check_period: 3 * 60 * 1000,
        },
    },
    us_server: {
        server: {
            max_allowed_req: 1048576,
            port: 8090,
        },
    },
};

var getConfig = function() {
    var cooked = JSON.parse(JSON.stringify(raw_config));
    cooked.app.db.conn_params = db_creds;
    cooked.argv = argv;
    if (argv.p !== undefined) {
        cooked.user_server.server.port = argv.p;
    }
    return cooked;
};

module.exports.get = getConfig;

