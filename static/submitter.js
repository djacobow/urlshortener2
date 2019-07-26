/*jshint esversion:6 */


var current_user = null;
var last_search_by_user = null;

var url_base   = '/us2/app';

var api_endpoints = {
    make:        url_base + '/create',
    list:        url_base + '/byuser',
    del:         url_base + '/delete',
    search:      url_base + '/search',
    name:        url_base + '/myname',
    history:     url_base + '/history',
    updateurl:   url_base + '/updateurl',
    users:       url_base + '/users',
    reassign:    url_base + '/reassign',
    chperms:     url_base + '/chperms',
};


function myAbsURL() {
    var me = window.location.href.split(/\//);
    var abs_base = me[0] + '//' + me[2] + '/us2/';
    return abs_base;
}


function displayCreated(data) {
    if (typeof data !== 'undefined') {
        var outputdiv = gebi('createresultdiv');
        outputdiv.style.display = 'block';

        var msgelem = gebi('res_msg');
        var message_text = '';
        if (data.hasOwnProperty('err')) {
            console.log('have_err');
            message_text = data.err;
            msgelem.className = 'fail';
            gebi('res_orig_url').innerText = '';
            removeChildren('res_short_url');
        } else {
            msgelem.className = 'ok';
            if (data.hasOwnProperty('created') && data.created) {
                message_text += 'Created';
            }
            if (!message_text.length) message_text = 'Found (existing)';
        
            if (data.url) {
                gebi('res_orig_url').innerText = data.url;
            }

            if (data.hash) {
                var me = window.location.href.split(/\//);
                var new_url = myAbsURL() + data.hash;
                var su = removeChildren('res_short_url');
                var na = cr('a');
                na.innerText = new_url;
                na.href = new_url;
                na.id = 'shortened_url_anchor';
                na.target = '_blank';
                su.appendChild(na);

                var b = cr('input');
                b.type = 'button';
                b.value = 'Copy to Clipboard';
                su.appendChild(cr('br'));
                su.appendChild(b);
                var sp = cr('span');
                su.appendChild(sp);

                b.addEventListener('click',(ev) => {
                    copyToClipboard(gebi('shortened_url_anchor'),sp);
                });
            }
        }
        gebi('res_msg').innerText = message_text;
    }
}

function doSubmitNew(ctx) {
    PostJS(api_endpoints.make, ctx, (err,rdata) => {
        var msgelem = gebi('res_msg');
        if (err) {
            msgelem.innerText = 'Error getting response: ' + err;
            msgelem.className = 'fail';
        } else {
            displayCreated(rdata);
        }
    });
}



function showLinkList(data,targetElem) {

    function urlified(str) {
        var a = cr('a');
        a.href = str;
        a.target = '_blank';
        a.innerText = str;
        return a;
    }

    function makeSP(first,second) {
        var sp = cr('span');
        var spl = cr('span');
        var spr = cr('span');
        if (typeof first === 'string') spl.innerText = first;
        else spl.appendChild(first);
        if (typeof second === 'string') spr.innerText = second;
        else spr.appendChild(second);
        sp.appendChild(spl);
        sp.appendChild(spr);
        return sp;
    }

    function formatDate(dstr) {
        var d = new Date(dstr);
        var year = d.getFullYear().toString();
        var month = (d.getMonth() + 1).toString();
        var date = d.getDate().toString();
        var hours = d.getHours().toString();
        if (hours.length<2) hours = '0' + hours;
        var minutes = d.getMinutes().toString();
        if (minutes.length<2) minutes = '0' + minutes;
        return [ month, '/', date, '/', year,
                 ' ', hours, ':', minutes ].join('');
    }

    targetElem.style.display = 'block';
    if (!Array.isArray(data)) data = [];

    data.forEach((entry, idx) => {
        var first_one = idx === 0;
        var last_one = idx == (data.length-1);
       
        if (first_one) {
            var htable = cr('table','oneListResult');
            var htr    = cr('tr');
            var htd0   = cr('td','listResultOwner heading');
            htd0.innerText = 'Owner';
            var htd1   = cr('td','listResultURLs heading');
            htd1.innerText = 'Link Info';
            var htd2   = cr('td','listResultExtras heading');
            htd2.innerText = 'Stats';
            htable.appendChild(htr);
            htr.appendChild(htd0);
            htr.appendChild(htd1);
            htr.appendChild(htd2);
            targetElem.appendChild(htable);
        }


        var container = cr('table',
                           last_one ? 'finalListResult' : 
                                      'oneListResult'
                          );
        var row0 = cr('tr');
        var col00 = cr('td','listResultOwner');

        var lbl_email = /@lbl\.gov/;
        if (entry.user !== current_user.user) {
            var mt = cr('a');
            mt.href = 'mailto:' + entry.user;
            mt.innerText = entry.user.replace(lbl_email,'');
            col00.appendChild(mt);
        } else {
            col00.appendChild(cr('span',null,entry.user.replace(lbl_email,'')));
        }

        if (current_user.admin || (entry.user = current_user)) {
            var hiderthing = cr('span');
            hiderthing.title = 'Click to reassign.';
            var hidee = cr('div','changediv');
            hidify(hiderthing, hidee);

            var uip = cr('input');
            uip.type = 'text';
            uip.id = 'newuser__' + entry.hash;
            uip.size = 13;
            uip.value = entry.user;
            makeEnterKeyEv(uip,() => {
                reassignLink(entry, uip);
            });
            hidee.appendChild(uip);
            ubtn = cr('input');
            ubtn.type = 'button';
            ubtn.value= 'reassign';
            hidee.appendChild(ubtn);
            ubtn.addEventListener('click',() => {
                reassignLink(entry, uip);
            });
            col00.appendChild(hiderthing);
            col00.appendChild(hidee);
        }
        row0.appendChild(col00);

        var col01 = cr('td','listResultURLs');
        var a0100 = urlified(entry.url);
        a0100.id = 'longurl__' + entry.hash;
        var sp010 = makeSP('Original: ',a0100);
        col01.appendChild(sp010);
        // col01.appendChild(cr('br'));


        if ((entry.user === current_user.user) || (current_user.admin)) {
            var cdiv = cr('div','changediv');
            var openthing = cr('span');
            openthing.title = 'Click to edit.';
            hidify(openthing, cdiv);

            var ip011b = cr('input');
            ip011b.type = 'text';
            ip011b.value = entry.url;
            ip011b.size = 120;
            ip011b.id = 'adjusted_link__' + entry.hash;
            var tgtid = 'do_modify__' + entry.hash;
            makeEnterKeyEv(ip011b,() => {
                // little monkeypatch to seem like came from button
                var fakeev = {
                    target: {
                        id: tgtid,
                    },
                };
                updateLink(fakeev);
            });

            // delete button
            var bt011a = cr('input');
            bt011a.type = 'button';
            bt011a.value = 'delete';
            bt011a.id = 'remove__' + entry.hash;
            bt011a.addEventListener('click',removeLink);

            // change button
            var bt011c = cr('input');
            bt011c.type = 'button';
            bt011c.value = 'update';
            bt011c.id = tgtid;
            bt011c.addEventListener('click',updateLink);

            cdiv.appendChild(bt011a);
            cdiv.appendChild(bt011c);
            cdiv.appendChild(ip011b);
            cdiv.appendChild(cr('br'));
            col01.appendChild(openthing);
            col01.appendChild(cr('br'));
            col01.appendChild(cdiv);
        } else {
        }
        var sh_a = urlified(myAbsURL() + entry.hash);
        var sp012a = makeSP('Shortened: ',sh_a);
        var sp012b = cr('span'); 
        var cpybtn = cr('input');
        cpybtn.type = 'button';
        cpybtn.value = 'Copy';
        var x = cr('span'); x.innerText = ' ';
        sp012a.appendChild(x);
        sp012a.appendChild(cpybtn);
        cpybtn.addEventListener('click',(ev) => {
            copyToClipboard(sh_a,sp012b);
        });
        col01.appendChild(sp012a);
        col01.appendChild(sp012b);

        var psel = cr('select');
        psel.addEventListener('change', (ev) => {
            changePermissions(entry, ev.target.value);
        });
        var sp012c = makeSP('Permissions',psel);
        ['world','lbnl','private'].forEach((t) => {
            var o = cr('option');
            o.value = t;
            o.text = t;
            if (entry.permissions && (entry.permissions == t)) {
                o.selected = 'selected';
            }
            psel.add(o);
        });
        col01.appendChild(cr('br'));
        col01.appendChild(sp012c);


        row0.appendChild(col01);
       
        var col02 = cr('td','listResultExtras');
        var sp020 = makeSP('Created: ',formatDate(entry.create_date));
        col02.appendChild(sp020);
        col02.appendChild(cr('br'));
        var sp021 = makeSP('Last Use: ',formatDate(entry.last_use));
        col02.appendChild(sp021);
        col02.appendChild(cr('br'));
        if (entry.update_date != entry.create_date) {
            var sp022 = makeSP('Modified: ',formatDate(entry.update_date));
            col02.appendChild(sp022);
            col02.appendChild(cr('br'));
        }

        var sp023 = makeSP('Use Count: ',entry.use_count.toString() + ' ');
        col02.appendChild(sp023);

        if (current_user && current_user.admin) {
            var histbtn = cr('input');
            histbtn.type = 'button';
            histbtn.value = 'Use History';
            histbtn.id = 'history__' + entry.hash;
            col02.appendChild(histbtn);
            histbtn.addEventListener('click',drawHistory);
        }
        row0.appendChild(col02);
        container.appendChild(row0);
        targetElem.appendChild(container);
        
    });
}

function drawHistory(ev) {
    var hash = ev.target.id.replace(/^history__/,'');
    var table = ev.target.parentNode.parentNode.parentNode;
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }
    var ntr = cr('tr');
    var ntd = cr('td',null);
    ntd.colSpan = 3;
    var chartdiv = cr('div');
    ntd.appendChild(chartdiv);
    ntr.appendChild(ntd);
    table.appendChild(ntr);
    GetJS(api_endpoints.history + '/' + hash,(err,data) => {
        if (err) console.log(err);
        else {
            var options = { 
                title: 'Use by year and week',
                vAxis: { title: 'Uses', },
                legend: { position: 'none' },

            };
            var darry = data.map((en) => { 
                var yr = en.year_week.toString().substring(0,4);
                var wk = en.year_week.toString().substring(4,6);
                return [ yr + '_ww' + wk, en.use_count ];
            });

            darry.unshift(['Year+Week', 'Uses']);
            var cdata = google.visualization.arrayToDataTable(darry);
            var chart = new google.visualization.ColumnChart(chartdiv);
            chart.draw(cdata,options);
        }
    });
}

var createLink = function() {
    var urlelem = gebi('url');
    var url = urlelem.value;
    if (!url.length) {
        var msgelem = gebi('res_msg');
        msgelem.className = 'fail';
        msgelem.innerText = 'Enter an URL';
        return;
    }
    if (!url.match(/^https?:\/\//)) {
        url = 'http://' + url;
    }
    var ctx = {
        url: url,
    };
    var sugelem = gebi('suggested_hash');
    var sugval = sugelem.value;
    if (sugval.length) ctx.suggested_hash = sugval;
    ctx.permissions = gebi('permissions').value;
    console.log(ctx);
    doSubmitNew(ctx);
};

function changePermissions(entry, newperm) {
    console.log('changePermissions');
    console.log('oldperm',entry.permissions,'newperm',newperm);
    submitChangePermissions({hash:entry.hash,newpermissions:newperm});
}

function reassignLink(entry, uinput) {
    console.log('reassignLink');
    var newuser = uinput.value;
    console.log('reassign ' + entry.user + ' to ' + newuser);
    submitReassign({newuser:newuser, hash:entry.hash});
}

function updateLink(ev) {
    console.log('updateLink');
    var hash = ev.target.id.replace(/^do_modify__/,'');
    var new_url = gebi('adjusted_link__' + hash).value;
    console.log('change ' + hash + ' to ' + new_url);
    submitUpdate({hash:hash,url:new_url});
}

function removeLink(ev) {
    console.log('removeLink');
    var hash = ev.target.id.replace(/^remove__/,'');
    submitDelete({shorturl:hash});
}

function postGeneric(url, ctx, cb = null) {
    PostJS(url, ctx, (err, rdata) => {
        if (err) {
            console.log(err);
        } else {
            console.log(JSON.stringify(rdata,null,2));
            submitFetchByUser();
            submitSearch();
        }
        if (cb) return cb(err,rdata);
    });
}

function submitChangePermissions(ctx) {
    postGeneric(api_endpoints.chperms, ctx);
}

function submitReassign(ctx) {
    postGeneric(api_endpoints.reassign, ctx);
}

function submitUpdate(ctx) {
    postGeneric(api_endpoints.updateurl, ctx);
}

function submitDelete(ctx) {
    postGeneric(api_endpoints.del, ctx);
}

function submitFetchByUser(ev) {
    var url = api_endpoints.list;
    var user = null;
    if (ev && (typeof ev === 'string')) {
        user = ev.trim().toLowerCase();
        /* not needed if using dropdown 
        if (user.length) {
            if (!user.match(/@lbl\.gov$/)) user += '@lbl.gov';
        }
        */
    } else if (last_search_by_user) {
        user = last_search_by_user;
    }
    if (user && user.length) {
        url += '?user=' + encodeURIComponent(user);
    }
    last_search_by_user = user;

    console.log(url);
    removeChildren('searchresdiv');
    GetJS(url,(err,data) => {
        var msgelem = gebi('res_msg');
        if (err) {
        } else {
            var tgt = removeChildren('managelist');
            return showLinkList(data.entries,tgt);
        }
    });
}

var submitSearch = function() {
    removeChildren('managelist');
    var searchelem = gebi('search_for');
    var searchtext = searchelem.value;
    var use_regex  = gebi('use_regex').checked ? '1' : '0';
    if (use_regex == '0') searchtext = searchtext.trim();
    if (searchtext.length && !searchtext.match(/^\s+$/)) {
        url = api_endpoints.search + '?' +
              ['by=url',
               'regex=' + use_regex,
               'term=' + encodeURIComponent(searchtext),
              ].join('&');
        console.log(url);
        matches = { by_url: [], by_hash: []};
        GetJS(url, (uerr,ures) => {
            // console.log(uerr,ures);
            if (!uerr) matches.by_url = ures;
            url = api_endpoints.search + '?' +
                  [
                   'by=hash',
                   'regex=' + use_regex,
                   'term=' + encodeURIComponent(searchtext),
                  ].join('&');
            GetJS(url, (herr, hres) => {
                // console.log(herr,hres);
                if (!herr) matches.by_hash = hres;
                showSearchLinks(matches);
            });
        });
    } else {
        showSearchLinks({});
    }
};


function showName() {
    GetJS(api_endpoints.name,(err,data) => {
        if (!err) {
            var grelem = gebi('user_greeting');
            grelem.appendChild(
                cr('span',null,'Greetings, ' + data.user + '!')
            );
            if (data.admin) {
                var x = cr('span',null,' (admin)');
                x.style['font-weight'] = 'bold';
                x.style.color = '#ff0000';
                grelem.appendChild(x);


                GetJS(api_endpoints.users,(uerr,udata) => {
                    if (uerr) {
                    } else {
                        var usearchdiv = gebi('usearch');
                        var span = cr('span');
                        span.innerText = 'Look up by creator: ';
                        usearchdiv.appendChild(span);
                        var ussel = cr('select');
                        var opt = cr('option');
                        opt.value = '__na';
                        opt.innerText = 'Choose';
                        ussel.appendChild(opt);
                        udata.forEach((x) => {
                            var opt = cr('option');
                            opt.value = x;
                            opt.innerText = x;
                            ussel.appendChild(opt);
                        });
                        ussel.addEventListener('change',() => {
                            submitFetchByUser(ussel.value);
                        });
                        usearchdiv.appendChild(ussel);
                    }
                });
            }
            current_user = data;
        }
    });
}


var showSearchLinks = function(matches) {
    // console.log(JSON.stringify(matches,null,2));

    var h = {};
    Object.keys(matches).forEach((gk) => {
        matches[gk].forEach((m) => {
            h[m.hash] = m;
        });
    });
    var vals = Object.keys(h).map((v) => { return h[v]; });
    var tgt = removeChildren('searchresdiv');
    return showLinkList(vals,tgt);
};



function setHandlers() {
    // console.log('setHandlers()');

    var belem  = gebi('doit');
    belem.addEventListener('click',createLink);

    var enterelems = ['url','suggested_hash'];
    for (var i=0; i<enterelems.length; i++) {
        /* jshint loopfunc: true */
        var eelem = gebi(enterelems[i]);
        makeEnterKeyEv(eelem,createLink);
    }

    gebi('closecreateresult').addEventListener('click',() => {
        gebi('createresultdiv').style.display = 'none';
    });

    var searchelem = gebi('search_for');
    makeEnterKeyEv(searchelem,submitSearch);
    gebi('submit_search').addEventListener('click',submitSearch);

    var manage_button = gebi('loadmine');
    manage_button.addEventListener('click', () => {
        last_search_by_user = null;
        submitFetchByUser();
    });

    showName();
}


function init(cb) {
    google.charts.load('current',{'packages':['corechart','bar']});
    google.charts.setOnLoadCallback(() => {
        return cb();
    });
}

init(setHandlers);


