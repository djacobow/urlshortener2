/*jshint esversion:6 */
// shorthand for createElement
function cr(what,clsn = null, it = null) {
    var x = document.createElement(what);
    if (clsn) {
        x.className = clsn;
    }
    if (it) {
        x.innerText = it;
    }
    return x;
}

function gebi(en) {
    return document.getElementById(en);
}

function exTrue(x,y) { return (x.hasOwnProperty(y) && x.y); }

function removeChildren(e) {
    if (typeof e === 'string') {
        e = document.getElementById(e);
    }
    while (e.firstChild) e.removeChild(e.firstChild);
    return e;
}

function PostJS(url, pdata, cb) {
    var xhr = new XMLHttpRequest();
    var msgelem = document.getElementById('res_msg');
    xhr.onerror = function(e) {
        return cb('http_error',e);
    };
    xhr.onload = function() {
        if (xhr.status == 403) location.reload();
        console.log(xhr.responseText);
        var data = null;
        try {
            data = JSON.parse(xhr.responseText);
        } catch(e) {
            console.log('json no parsey');
            return cb('resp_no_parse',{resp:xhr.resonseText});
        }
        return cb(null, data);
    };
    xhr.open('POST',url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify(pdata));
}

function GetJS(url,cb) {
    var xhr = new XMLHttpRequest();
    xhr.onerror = function(e) { 
        return cb('fetch_err',e);
    };
    xhr.onload = function() {
        if (xhr.status == 403) location.reload();
        var data = null;
        try {
            data = JSON.parse(xhr.responseText);
            return cb(null, data);
        } catch(e) {
            console.log('json no parsey',e);
            return cb('rdata did not parse', {responseText:xhr.responseText});
        }
    };
    xhr.open('GET',url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send();
}

// take two existing elements, and let clicks on one set visibility
// attributes for the other
function hidify(hider, hidee) {
    function make_open() {
        hider.innerText = ' \u25bc ';
        hidee.style.height = hidee.scrollHeight;
        hidee.style.visibility = 'visible';
        hidee.style.opacity = 1;
        hider.setAttribute('open',1);
    }
    function make_closed() {
        hider.setAttribute('open',0);
        hider.innerText = ' \u25ba ';
        hidee.style.height = 0;
        hidee.style.opacity = 0;
        hidee.style.visibility = 'hidden';
    }

    make_closed();

    hider.addEventListener('click',(ev) => {
        var is_open = hider.getAttribute('open');
        if (is_open == 1) {
            make_closed();
        } else {
            make_open();
        }
    });
}

// copy the link in a source element to the clipboard,
// by creating an input in a targetElement and selecting it,
// then hiding that element.
var copyToClipboard = function(srcElem,tgtElem) {
    console.log('copyToClipboard');
    removeChildren(tgtElem);
    var c = cr('input');
    c.type = 'text';
    c.value = srcElem.href;
    c.style.opacity = 0;
    c.className = 'copybox';
    c.readOnly = true;
    tgtElem.appendChild(c);
    c.select(); 
    document.execCommand('Copy'); 
    window.setTimeout(() => {
        c.style.opacity = 1;
        window.setTimeout(() => {
            c.style.opacity = 0;
            window.setTimeout(() => {
                removeChildren(tgtElem);
            }, 200);
        },1000);
    },200);
};

// just a little sugar on getting a fake event that
// represents hitting enter in a text input box
function makeEnterKeyEv(source, cb) {
    source.addEventListener('keyup', (ev) => {
        if (ev.keyCode == 13) {
            cb(ev);
        }
    });
}

