/*
peercom-example.js is distributed under the permissive MIT License:

Copyright (c) 2015, Quark Li, quarkli@gmail.com
All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

Author: quarkli@gmail.com
*/

'use strict'

// declared variable in public space for the convenience of debugging
var mpc, mca, msa;
var reqpool = [];

(function() {
    var peer;           // local peer name
    var hub = 'lobby';  // default hub
    var servers = ['wss://www.gatherhub.com:55688'];
    var iceservers = [
        {'urls': 'stun:stun01.sipphone.com'},
        {'urls': 'stun:stun.fwdnet.net'},
        {'urls': 'stun:stun.voxgratia.org'},
        {'urls': 'stun:stun.xten.com'},
        {'urls': 'stun:chi2-tftp2.starnetusa.net'},
        {'urls': 'stun:stun.l.google.com:19302'}
    ];
    var _peers = {};        // a shadow copy of peers for comparison for changes
    var cstate = 'idle';    // log call state
    var cparty, cid, creq;  // calling party element, peer id, request
    var rvideo = 0, raudio = 0, lmediaadded = false;
    var videoresol = {minWidth: 160, minWidth: 100, maxWidth: 160, maxHeight:100};

    // get the width and height (w, h) of video to better fit the device screen
    // video source is set to 320:200 (16:10) ratio, so the w:h should be 16:10 too
    var w = $(window).width() > 360 ? 320 : (0 | ($(window).width() * 0.8) / 10) * 10;
    var h = 0 | (w / 8 * 5);

    // create PeerCom Object and configure event handlers
    var pc = mpc = new Gatherhub.PeerCom({peer: peer, hub: hub, servers: servers, iceservers: iceservers});
    var ca = mca = new Gatherhub.ConfAgent(pc);
    var sa = msa = new Gatherhub.CastAgent(pc);

    // Check browser, currently only support Google Chrome
    var isChrome = !!window.chrome;

    if (!isChrome) { alert('Sorry! Your browser does not support HTML5. This application is now running in Google Chrome browser (PC/Mobile).'); }

    sa.oncaststart = setPeerCasting;
    sa.oncaststop = function(p) {
        if (cstate == 'recvcast') { resetDefault(); }
        else { resetPeerPanel(p); }
    };
    sa.onlocalstream = function(s) {
        cid = getHostPanelId();
        addLocalMedia(s);
    };
    sa.onremotestream = function(medchan) {
        if (medchan.rstream) { addRemoteMedia(medchan.rstream); }
        else { medchan.onrstreamready = addRemoteMedia; }
    };
    sa.onpeerjoin = function(p) {
        showPeerPanel(p);
        hidePeerButtons(p);
    };
    sa.onpeerleft = function(p) {
        hidePeerPanel(p);
    };

    ca.onconfrequest = function(req) {
        if (cstate == 'idle' || cstate == 'confprep' || cstate == 'castprep') {
            var ctype = req.mdesc.video ? 'video' : 'audio';

            resetDefault();

            // change buttons to 'accept' and 'reject'
            hidePeerButtons(getHostPanelId());
            addPeerButton(getHostPanelId(), sbtn.accept, acceptConf);
            addPeerButton(getHostPanelId(), sbtn.reject, rejectConf);

            // hide other peers
            hidePeerPanel();
            req.peers.forEach(function(p) {
                // filter self from conference peer list
                if (p != pc.id) {
                    showPeerPanel(p);
                    hidePeerButtons(p);
                    setPeerTitle(p, getPeerTitle(p) + ' (' + ca.pstate[p] + ')');
                }
            });

            // show call type
            setPeerTitle(getHostPanelId(), getPeerTitle(getHostPanelId()) + '<br>(' + ctype + ' conference call)');

            // play ring tone
            ring.play();
            // change state
            cstate = 'ringing';
        }
    };
    ca.onconfresponse = function(res) {
        if (ca.pstate[res.from]) {
            resetPeerTitle(res.from);
            setPeerTitle(res.from, getPeerTitle(res.from) + ' (' + ca.pstate[res.from] + ')');
        }

        if (res.data.pstate[res.from] == 'left' || ca.pstate[res.from] == 'left') {
            removeRemoteMedia(res.from);
            ca.removePeer(res.from);

            if (Object.keys(ca.pmedchans).length) {
                var k = Object.keys(ca.pmedchans)[0];
                lmediaadded = false;
                if (ca.pmedchans[k] && ca.pmedchans[k].lstream) { addLocalMedia(ca.pmedchans[k].lstream); }
            }
        }
    };
    ca.onmedchancreated = function(medchan) {
        ring.pause();
        ringback.pause();

        recycleElement(sbtn.cancel);
        addPeerButton(getHostPanelId(), sbtn.mute, function() {
            ca.mute();
            if (ca.muted) { sbtn.mute.removeClass('btn-warning').addClass('btn-success').html('unmute'); }
            else { sbtn.mute.removeClass('btn-success').addClass('btn-warning').html('mute'); }
        });
        addPeerButton(getHostPanelId(), sbtn.end, endConf);

        cid = pc.id;

        var mc = medchan;
        var tConfMedia = setInterval(function() {
            var rmediaadded = false;
            if (mc.type == 'video') {
                for (var i = 0; i < 3; i++) {
                    if (mc.rstream && mc.rstream.id == $(vid[i]).attr('id')) { rmediaadded = true; }
                }
            }
            else {
                au.forEach(function(e) {
                    if (mc.rstream && mc.rstream.id == $(e).attr('id')) { rmediaadded = true; }
                });
            }

            if (lmediaadded && rmediaadded) {
                clearInterval(tConfMedia);
            }
            else {
                if (!lmediaadded && mc.lstream) { addLocalMedia(mc.lstream); }
                if (!rmediaadded && mc.rstream) { addRemoteMedia(mc.rstream); }
            }
        }, 20);
        cstate = 'conferencing';
    };
    ca.onstatechange = function(s) {
        if (s == 'idle') { resetDefault(); }
    };

    pc.onerror = function (e) {
        // just log error message in the console
        console.log(e);
        // critical errors, such as browser not support webrtc, prompt in alert window
        if (e.code < 0) { alert(e.reason); }
    };
    pc.onstatechange = function (s) {
        // Update PeerCom state in Peer List Title
        $('#title').html('You are in Hub#[' + hub + '] (' + s + ')');

        // clear peer list when PeerCom service starting or stopped
        if (s == 'starting') {
            $('#pgroup').children().remove();
        }
        else if (s == 'stopped') {
            $('#pgroup').children().remove();
            pc.start();
        }
        // add myself as on top of peer list as the host
        else if (s == 'started') {
            addPeer(pc, 1);
            resetHostPanel();
            ca.start();
            sa.start();
        }
    };
    pc.onpeerchange = function (peers) {
        // Check for new joined peers and add them to peer list
        var keys = Object.keys(peers).filter(function(e){return !(e in _peers);});
        keys.forEach(function(i) {        
            addPeer({id: i, peer: peers[i].peer}, false);
            _peers[i] = peers[i];
        });

        // Check for left peers and remove them from peer list
        keys = Object.keys(_peers).filter(function(e){return !(e in peers);});
        keys.forEach(function(i) {
            // if the left peer is currently on a call, end the call
            if (cid == i) { endCall('end'); }      // if the left peer is current call party, end the call
            $('#' + i).remove();
            delete _peers[i];
        });

        // sorting peers
        $('.peer-panel').sort(function(a, b){
            return ($(a).find('.title').html() > $(b).find('.title').html()) ? 1 : -1;
        }).appendTo('#pgroup');
    };
    pc.onpeerstatechange = function(s) {
        if (s.state == 'open') { 
            if (pc.support.video && pc.peers[s.peer].support.video) {
                $('#' + s.peer).find('.btn-warning').attr('disabled', false);
            }
            if (pc.support.audio && pc.peers[s.peer].support.audio) {
                $('#' + s.peer).find('.btn-primary').attr('disabled', false);
            }
        }
    };
    pc.onmessage = function (msg) {
        // Let ConfAgent to consume the message first and process messaages not consumed by ConfAgent
        msg = ca.consumemsg(msg);
        if (msg) { msg = sa.consumemsg(msg); }
        if (msg && msg.type != 'pong' && msg.type != 'bye') {
            // log message in console, may add text messaging feature later
            console.log('from:', msg.from);
            console.log('type:', msg.type);
            console.log('data:', msg.data);
            console.log('ts:', msg.ts);
            console.log('via:', msg.via);
            console.log('');
        }
    };
    pc.onmediarequest = function (req) {
        // Let ConfAgent to consume the media request first and process request not consumed by ConfAgent
        req = ca.consumereq(req);
        if (req) { req = sa.consumereq(req); }
        if (req) {
            // Notify UI to respond to remote requests / answers
            switch (req.type) {
                case 'offer':
                    if (cstate == 'idle' || cstate == 'confprep' || cstate == 'castprep') {
                        if (pc.medchans[req.id]) {
                            resetDefault();
                            var ctype = req.mdesc.video ? 'video' : 'audio';
                            // when received remote offer, rstream is ready
                            // add onlstreamready handler which will be fired upon acceptCall()
                            // and rstream should be added at acceptCall()
                            pc.medchans[req.id].onlstreamready = addLocalMedia;

                            // queue request
                            reqpool.push(req);
                            cid = req.from;
                            cparty = $('#' + cid);

                            // change buttons to 'accept' and 'reject'
                            hidePeerButtons(cid);
                            addPeerButton(cid, sbtn.accept, acceptCall);
                            addPeerButton(cid, sbtn.reject, function() { endCall('reject'); })

                            // hide other peers
                            hidePeerPanel();
                            showPeerPanel(cid);

                            // show call type
                            setPeerTitle(cid, getPeerTitle(cid) + ' (' + ctype + ' call)');

                            // disable conference button
                            enablePeerButton(getHostPanelId(), '.btn-cast', false);
                            enablePeerButton(getHostPanelId(), '.btn-conf', false);

                            // play ring tone
                            ring.play();
                            // change state
                            cstate = 'ringing';
                        }
                    }
                    break;
                case 'answer':
                    // stop ringback tone
                    ringback.pause();
                    // change buttons
                    recycleElement(sbtn.cancel);
                    addPeerButton(cid, sbtn.mute, muteCall);
                    addPeerButton(cid, sbtn.end, function(){ endCall('end'); });

                    // change state
                    cstate = 'busy';
                    break;
                case 'cancel':
                case 'reject':
                case 'end':
                    if (cstate == 'busy') {
                        // end call only if the request comes from current calling party
                        if (req.from == cid) { resetDefault(); }
                    }
                    else {
                        // for other state, stop ring tone first
                        resetDefault();
                    }
                    break;
            }
        }
    };

    // initialize screens and load login screen
    initCommScreen();
    initLoginScreen();

    // create reusable html elements
    // elements recycle container
    var recycle = $('<div>');

    // shared buttons that will only have single appearance in the page
    var sbtn = {
        accept: $('<button>').addClass('btn btn-sm btn-success').html('accept'),
        reject: $('<button>').addClass('btn btn-sm btn-danger').html('reject'),
        cancel: $('<button>').addClass('btn btn-sm btn-danger').html('cancel'),
        video: $('<button>').addClass('btn btn-sm btn-warning btn-video').html('video'),
        audio: $('<button>').addClass('btn btn-sm btn-primary btn-audio').html('audio'),
        end: $('<button>').addClass('btn btn-sm btn-danger').html('end'),
        mute: $('<button>').addClass('btn btn-sm btn-warning').html('mute')
    };

    // video element siziing css configs
    var szfull = {width: w, height: h};
    var szhalf = {width: (0 | w / 2), height: (0 | h / 2)};
    var szthird = {width: (0 | w / 3), height: (0 | h / 3)};
    // video element positioning css configs
    var tlalign = {position: 'absolute', top: 0, left: 0, buttom: '', right: ''};
    var tralign = {position: 'absolute', top: 0, right: 0, bottom: '', left: ''};
    var blalign = {position: 'absolute', bottom: 0, left: 0, top: '', right: ''};
    var bralign = {position: 'absolute', bottom: 0, right: 0, top: '', left: ''};
    var bcalign = {position: 'absolute', bottom: 0, left: '25%', top: '', right: ''};
    var vborder = {'border-style': 'solid', 'border-width': 1, 'border-color': 'grey'};

    // ringtone element
    var ding = new Audio('http://gatherhub.com/ding.mp3');
    var ring = new Audio('http://gatherhub.com/ring.mp3');
    var ringback = new Audio('http://gatherhub.com/ringback.mp3');
    ring.load();
    ringback.load();
    ring.loop = true;
    ringback.loop = true;

    // Audio elements
    var au = [];
    for (var i = 0; i < 16; i++) {
        var a = new Audio();
        au.push(a);
    }

    //  create video element container
    var vpad = $('<div>').css(szfull).css({position: 'relative'});
    // create video elements    
    for (var i = 0; i < 4; i++) { $('<video autoplay>').hide().appendTo(vpad); }
    var vid = vpad.children();
    var vidLocal = vid[3];
    var sidcache = {};        // variable to cache stream id
    // set border effect to local video element
    $(vidLocal).css(vborder);

    // css styles for peer panels
    var peerpanel = {display: 'table', width: '100%'}
    var peerheading = {position: 'relative'};
    var tbcellleft = {display: 'table-cell', 'text-align': 'left', width: '100%'};
    var tbcellright = {display: 'table-cell inline-block', 'text-align': 'right', 'margin-top': -20};

    // Dynamically creates peer elements in peer list panel group
    // A peer panel structure looks like this:
    // [.host-panel (panel-primary) | .peer-panel (panel-success)][#peer.id]: 
    //     {phead: {
    //         title, 
    //         bgroup: {btn-video, btn-audio}, [btn-conf, peersel, btn-canel, btn-accept, btn-reject, btn-mute, btn-end]
    //      }, 
    //      pbody: [vpad]
    //     }
    function addPeer(peer, isHost) {
        if (!peer || $('#' + peer.id).length) { return; }

        var phead = $('<div class="panel-heading phead">').css(peerheading);
        var pbody = $('<div class="panel-body pbody" align="center">').hide();
        var titlebox = $('<div>').css(tbcellleft).appendTo(phead);
        var title = $('<span class="title">').attr('name', peer.peer).html(peer.peer).appendTo(titlebox);
        var bgbox = $('<div>').css(tbcellright).appendTo(phead);
        var bgroup = $('<div class="btn-group bgroup">').appendTo(bgbox);

        if (isHost) {
            $('<div class="panel panel-primary host-panel">').css(peerpanel).attr({id: peer.id}).appendTo('#pgroup').append(phead).append(pbody);
            if (pc.support.video || pc.support.audio) {
                $('<button>').addClass('btn btn-sm btn-default btn-cast').html('broadcast').appendTo(bgroup).on('click', prepCast);
                $('<button>').addClass('btn btn-sm btn-success btn-conf').html('conference').appendTo(bgroup).on('click', prepConf);
            }
        }
        else {
            $('<div class="panel panel-success peer-panel">').css(peerpanel).attr({id: peer.id}).appendTo('#pgroup').append(phead).append(pbody);
            $('<button>').addClass('btn btn-sm btn-default btn-watch').html('watch').attr('disabled', false).appendTo(bgroup).on('click', recvCast);
            $('<button>').addClass('btn btn-sm btn-default btn-listen').html('listen').attr('disabled', false).appendTo(bgroup).on('click', recvCast);
            $('<button>').addClass('btn btn-sm btn-warning btn-video').html('video').attr('disabled', true).appendTo(bgroup).on('click', makeCall);
            $('<button>').addClass('btn btn-sm btn-primary btn-audio').html('audio').attr('disabled', true).appendTo(bgroup).on('click', makeCall);
            $('<input type="checkbox" class="peersel">').appendTo(bgroup).on('click', validateCheckbox).hide();

            resetPeerPanel(peer.id);

            // change peer panel visibility by current call/conference state
            if (cstate == 'confprep') {
                if (!pc.peers[peer.id].support.video && !pc.peers[peer.id].support.audio) {
                    hidePeerPanel(peer.id);
                }
                else {
                    hidePeerButtons(peer.id);
                    showPeerCheckbox(peer.id);
                }
            }
            else if (cstate != 'idle') { hidePeerPanel(peer.id); }
        }
        ding.play();
    }

    function prepCast() {
        cstate = 'castprep';
        // change buttons
        hidePeerPanel();
        hidePeerButtons(getHostPanelId());

        // append cancel button
        addPeerButton(getHostPanelId(), sbtn.video, makeCast);
        addPeerButton(getHostPanelId(), sbtn.audio, makeCast);
        addPeerButton(getHostPanelId(), sbtn.cancel, cancelConf);
        enablePeerButton(getHostPanelId(), '.btn-video', true);
        enablePeerButton(getHostPanelId(), '.btn-audio', true);
        cstate = 'castprep';
    }

    function makeCast() {
        // make request to each selected peer
        var ctype = $(this).html();
        var mdesc = ctype == 'video' ? {audio: {dir: 'sendonly'}, video: {mandatory: videoresol, dir: 'sendonly'}} : {audio: {dir: 'sendonly'}};

        cid = getHostPanelId();
        sa.startcast(mdesc);

        // change button to sbtn.end
        recycleElement(sbtn.video);
        recycleElement(sbtn.audio);
        recycleElement(sbtn.cancel);
        addPeerButton(getHostPanelId(), sbtn.end, endCast);
        enablePeerButton(getHostPanelId(), '.btn-cast', false);
        enablePeerButton(getHostPanelId(), '.btn-conf', false);

        setPeerTitle(cid, getPeerTitle(cid) + ' (' + ctype + ' broadcasting...)');
        cstate = 'casting';
    }

    function endCast() {
        sa.stopcast();
        recycleElement(sbtn.end);
        resetDefault();
        cstate = 'idle';
    }

    function recvCast() {
        var p = getPeerPanelId($(this));
        cid = p;
        sa.recvcast(p);
        hidePeerPanel();
        showPeerPanel(p);
        hidePeerButtons(p);
        addPeerButton(p, sbtn.end, endRecv);
        enablePeerButton(getHostPanelId(), '.btn-cast', false);
        enablePeerButton(getHostPanelId(), '.btn-conf', false);
        cstate = 'recvcast';
    }

    function endRecv() {
        var p = getPeerPanelId($(this));
        sa.endrecv();
        recycleElement(sbtn.end);
        resetDefault();
        cstate = 'idle';
    }

    function prepConf() {
        cstate = 'confprep';

        // change buttons
        hidePeerButtons(getHostPanelId());
        showPeerButton(getHostPanelId(), '.btn-video');
        showPeerButton(getHostPanelId(), '.btn-audio');

        // append cancel button
        addPeerButton(getHostPanelId(), sbtn.video, makeConf);
        addPeerButton(getHostPanelId(), sbtn.audio, makeConf);
        addPeerButton(getHostPanelId(), sbtn.cancel, cancelConf);
        enablePeerButton(getHostPanelId(), '.btn-video', false);
        enablePeerButton(getHostPanelId(), '.btn-audio', false);

        // change peer list buttons to checkbox for conference parties selection
        hidePeerButtons();
        showPeerCheckbox();
        resetPeerCheckbox();

        for (var k in pc.peers) {
            // hide peers which does not support both audio and video call
            if ((!pc.peers[k].support.video && !pc.peers[k].audio) || sa.pmdesc[k]) { hidePeerPanel(k); }
        }
     }

    function makeConf() {
        // make request to each selected peer
        var ctype = $(this).html();
        var mdesc = ctype == 'video' ? {audio: true, video: {mandatory: videoresol}} : {audio: true};

        // if only one remote peer is selected, cancel conference request and make normal call
        if (ca.peers.length == 2) {
            cid = ca.peers[1];
            cancelConf();
            if (ctype == 'video') { $('#' + cid).find('.btn-video').click(); }
            else { $('#' + cid).find('.btn-audio').click(); }
        }
        // ConfAgent.request returns true if request can be made or false if not
        else if (ca.request(mdesc)) {
            // change buttons to 'accept' and 'reject'
            recycleElement(sbtn.cancel);
            hidePeerButtons(getHostPanelId());
            addPeerButton(getHostPanelId(), sbtn.cancel, cancelConf);

            // hide other peers
            hidePeerPanel();
            hidePeerCheckbox();

            // show conference party
            ca.peers.forEach(function(p) {
                // filter self from conference peer list
                if (p != pc.id) {
                    showPeerPanel(p);
                    hidePeerButtons(p);
                    setPeerTitle(p, getPeerTitle(p) + ' (' + ca.pstate[p] + ')');
                }
            });

            // show call type
            setPeerTitle(getHostPanelId(), getPeerTitle(getHostPanelId()) + '<br>(' + ctype + ' conference call)');

            // change state
            ringback.play();
            cstate ='confrequest'
        }
    }

    function acceptConf() {
        recycleElement(sbtn.accept);
        recycleElement(sbtn.reject);
        ca.response('accept');
        cstate = 'conferencing';
    }

    function rejectConf() {
        ca.response('reject');
        clearConf();
    }

    function cancelConf() {
        if (cstate == 'confrequest') {
            ca.cancel();
        }

        ca.reset();
        clearConf();
    }

    function endConf() {
        ca.exit();
        clearConf();
    }

    function clearConf() {
        resetDefault();

        cstate = 'idle';
    }

    function validateCheckbox() {
        var cpid = getPeerPanelId($(this));
        if ($(this).is(':checked')) {
            if (ca.peers.length < 4) { ca.addPeer(cpid); }
            else {
                alert('You can select up to three peers at maximum.');
                $(this).attr('checked', false);
            }
        }
        else { ca.removePeer(cpid); }

        if (ca.peers.length > 2) {
            enablePeerButton(getHostPanelId(), '.btn-video', true);
            enablePeerButton(getHostPanelId(), '.btn-audio', true);
        }
        else {
            enablePeerButton(getHostPanelId(), '.btn-video', false);
            enablePeerButton(getHostPanelId(), '.btn-audio', false);
        }
    }

    function makeCall() {
        var req = {};
        var mdesc = $(this).html() == 'video' ? {audio: true, video: {mandatory: videoresol}} : {audio: true};
        // var mdesc = $(this).html() == 'video' ? {audio: {dir: 'sendonly'}, video: {mandatory: videoresol, dir: 'recvonly'}} : {audio: {dir: 'sendonly'}};
        // var mdesc = $(this).html() == 'video' ? {audio: {dir: 'recvonly'}, video: {mandatory: videoresol, dir: 'sendonly'}} : {audio: {dir: 'sendonly'}};
  
        // get target peer id from panel id
        cid = $(this).parents('.peer-panel').attr('id');
        cparty = $('#' + cid);

        // set media description by the button clicked
        req = {to: cid, mdesc: mdesc};

        // disable conference button
        enablePeerButton(getHostPanelId(), '.btn-cast', false);
        enablePeerButton(getHostPanelId(), '.btn-conf', false);

        // hide rest peers but show only taget peer in the list
        hidePeerPanel();
        showPeerPanel(cid);

        // append cancel button to peer panel
        hidePeerButtons(cid);
        addPeerButton(cid, sbtn.cancel, function(){ endCall('cancel'); });

        // indicate call type
        setPeerTitle(cid, getPeerTitle(cid) + ' (' + $(this).html() + ' call)');

        // send request through PeerCom API, if request can be made, a request id will be returned
        req.id = pc.mediaRequest(req);

        if (req.id && pc.medchans[req.id]) {
            // add lstream to media elements
            if (pc.medchans[req.id].lstream) {
                addLocalMedia(pc.medchans[req.id].lstream);
            }
            else {
                pc.medchans[req.id].onlstreamready = addLocalMedia;
            }

            // add rstream ready hander
            pc.medchans[req.id].onrstreamready = addRemoteMedia;

            // queue reqest for call trace
            reqpool.push(req);

            // change state
            cstate = 'calling';
            // play ringback tone
            ringback.play();
        }
        else {
            // if no valid request id returned, call requuest failed, call endCall() to resetDefault
            endCall('cancel');
        }
    }

    function acceptCall() {
        // stop ringing
        ring.pause();
        // pop out current request
        var req = reqpool.pop();

        if (req && pc.medchans[req.id]) {
            // send response
            // req.mdesc = {audio: true}   // one-way video test
            pc.mediaResponse(req, 'accept');
            // handle rstream
            if (pc.medchans[req.id].rstream) {
                addRemoteMedia(pc.medchans[req.id].rstream);
            }
            else {
                pc.medchans[req.id].onrstreamready = addRemoteMedia;
            }

            // change answering buttons to in-call buttons
            recycleElement(sbtn.reject);
            recycleElement(sbtn.accept);
            addPeerButton(cid, sbtn.mute, muteCall);
            addPeerButton(cid, sbtn.end, function(){ endCall('end'); });

            creq = req;         // set public variable of request
            reqpool.push(req);  // put request back to queue
            cstate = 'busy';    // change call state
        }
    }

    function muteCall() {
        // pop out current request
        var req = reqpool.pop();
        // mute microphone through PeerCom media channel
        if (req) { pc.medchans[req.id].mute(); }
        // put reqeust back to queue
        reqpool.push(req);

        // update mute button context
        if (sbtn.mute.html() == 'mute') { sbtn.mute.removeClass('btn-warning').addClass('btn-success').html('unmute'); }
        else { sbtn.mute.removeClass('btn-success').addClass('btn-warning').html('mute'); }
    }

    function endCall(reason) {
        var req = reqpool.pop();
        if (req && pc.medchans[req.id]) {
            if (reason == 'reject') { pc.mediaResponse(req, 'reject'); }
            else if (reason == 'cancel') { pc.medchans[req.id].cancel(); }
            else if (reason == 'end') {
                removeRemoteMedia(pc.medchans[req.id].rstream.id);
                pc.medchans[req.id].end();
            }

            if (cstate == 'ringing') { ring.pause(); }
        }
        resetDefault();
    }

    function resetAudioElements() {
        au.forEach(function(e) {
            e.pause();
            e.src = '';
        });
        raudio = 0;
    }

    function resetVideoElements() {
        vpad.children('video').attr('src', '').hide();
        recycleElement(vpad);
        rvideo = 0;
    }

    // restore page layout and default elements
    function resetDefault() {
        // stop ring/ringback tone();
        ring.pause();
        ringback.pause();

        // reset local media
        resetAudioElements();
        resetVideoElements();

        // reset local media added flag
        lmediaadded = false;

        // remove queued request
        reqpool = [];

        // recycle buttons
        Object.keys(sbtn).forEach(function(k) { recycleElement(sbtn[k]); });

        // show default buttons and hidden peers
        resetHostPanel();
        resetPeerPanel();
        showPeerPanel();

        // reset state
        cstate = 'idle';

        // reload ring/ringback tones
        ring.load();
        ringback.load();
    }

    // configure/add local audio/video element
    function addLocalMedia(s) {
        if (!lmediaadded) {
            var src = URL.createObjectURL(s);
            if (s.getVideoTracks().length && s.getVideoTracks()[0].enabled) {
                if (!vpad.is(':visible')){ appendPeerVideo(cid); }

                $(vidLocal).show();
                arrangeVideo();
                vidLocal.muted = true;
                vidLocal.src = src;
                vidLocal.play();
            }
            else {
                au[0].src = src;
                au[0].muted = true;
                au[0].play();
            }
            lmediaadded = true;
        }
    }

    // configure/add remote audio/video element
    function addRemoteMedia(s) {
        var src = URL.createObjectURL(s);
        if (s.getVideoTracks().length && s.getVideoTracks()[0].enabled) {
            if (!vpad.is(':visible')){ appendPeerVideo(cid); }

            rvideo++;
            $(vid[rvideo-1]).attr('id', s.id);
            $(vid[rvideo-1]).show();
            arrangeVideo();
            vid[rvideo-1].src = src;
        }
        else {
            raudio++;
            $(au[raudio]).attr('id', s.id);
            au[raudio].src = src
            au[raudio].play();
        }

        // cache stream id in sidcache with remote peer id for alternative way to search stream id when remove stream
        Object.keys(pc.medchans).forEach(function(k) {
            if (pc.medchans[k].rstream == s) {
                if (pc.medchans[k].from == pc.id) { sidcache[pc.medchans[k].to] = s.id; }
                else { sidcache[pc.medchans[k].from] = s.id; }
            }
        });
    }

    // remove/reset remote audio/video element by stream id
    function removeRemoteMedia(id) {
        // check if id is a remote peer id, if yes, get its stream id and delete cache
        if (sidcache[id]) {
            id = sidcache[id];
            delete sidcache[id];
        }

        vid.each(function(k, e){
            if ($(e).attr('id') ==  id) {
                $(e).attr('id', '');
                $(e).hide();
                e.pause();
                e.src = ''
                e.muted = false;
                rvideo--;
                arrangeVideo();
            }
        });

        au.forEach(function(e) {
            if ($(e).attr('id') == id) {
                $(e).attr('id', '');
                e.pause();
                e.src = '';
                e.muted = false;
                raudio--;
            }
        });
    }

    // rearrange video element based on the number of available video elements
    function arrangeVideo() {
        var rv = [];
        for (var i = 0; i < vid.length - 1; i++) {
            if ($(vid[i]).is(':visible')) { rv.push($(vid[i])); }
        }
        switch (rv.length) {
            case 0:
                $(vidLocal).css(szfull).css(bralign);
                break;
            case 1:
                rv[0].css(szfull).css(tlalign);
                $(vidLocal).css(szthird).css(bralign);
                break;
            case 2:
                rv[0].css(szhalf).css(tlalign);
                rv[1].css(szhalf).css(tralign);
                $(vidLocal).css(szhalf).css(bcalign);
                break;
            case 3:
                rv[0].css(szhalf).css(tlalign);
                rv[1].css(szhalf).css(tralign);
                rv[2].css(szhalf).css(blalign);
                $(vidLocal).css(szhalf).css(bralign);
                break;
        }
    }

    // initialize login screen
    function initLoginScreen() {
        // load values from cookies if available
        if (getCookie('user') && getCookie('user').length > 0) { $('#user').val(getCookie('user')); }
        if (getCookie('hub') && getCookie('hub').length > 0) { $('#hub').val(getCookie('hub')); }
        if (getCookie('cache')) { $('#cache').attr('checked', getCookie('cache')); }

        // Disable button 'Enter' by default
        $('#enter').attr('disabled', true).on('click', function() { login(); });

        // Enable button 'Enter' when 'user' is not empty and execute login() when user pressed enter
        $('#user').on('keyup', function(e) {
            if (this.value.length) {
                $('#enter').attr('disabled', false);
                if (e.keyCode == 13) { login(); }
            }
        }).on('focus blur', function() {
            if (this.value.length) { $('#enter').attr('disabled', false); }
            else { $('#enter').attr('disabled', true); }
        });

        // Execute login() by 'enter' key when button 'Enter' enabled
        $('#hub').on('keyup', function(e){
            if (!$('#enter').attr('disabled') && e.keyCode == 13) { login(); }
        });
        $('#cache').on('keyup', function(e){
            if (!$('#enter').attr('disabled') && e.keyCode == 13) { login(); }
        });

        // Set 'user' input as default focused elemennt
        setTimeout(function() { $('#user').focus().select(); }, 100);
    }

    // initialize communicator screen
    function initCommScreen() {
        // create peer list container
        $('#layer1').attr('align', 'center').hide();
        $('<h3 id="title">').appendTo('#layer1');
        $('<div class="panel-group" id="pgroup" style="max-width: 640px" align="left">').appendTo('#layer1');
    }

    // Login to hub
    function login() {
        // set/clear cookies
        if ($('#cache').is(':checked')) {
            setCookie('user', $('#user').val());
            setCookie('hub', $('#hub').val());
            setCookie('cache', $('#cache').is(':checked'));
        }
        else {
            setCookie('user', '');
            setCookie('hub', '');
            setCookie('cache', '');
        }

        // configure peer/hub
        peer = $('#user').val();
        if ($('#hub').val().length) { hub = $('#hub').val(); }

        // hide login screen and show communicator screen
        $('#layer0').hide();
        $('#layer1').show();


        // configure peer/hub to PeerCom
        pc.peer = peer;
        pc.hub = hub;
        
        // start PeerCom
        svcStart();
    }

    // we need this function for mobile browser which requires user interaction to trigger audio play
    function svcStart() {
        ding.play();
        ding.pause();
        ring.play();
        ring.pause();
        ringback.play();
        ringback.pause();
        au.forEach(function(e) {
            e.play();
            e.paulse
        });

        pc.start();
    }

     // GUI Operation Functions
    function hidePeerPanel(peer) {
        if (peer) { $('#' + peer).hide(); }
        else { $('.peer-panel').hide(); }
    }
    function showPeerPanel(peer) {
        if (peer) { $('#' + peer).show(); }
        else { $('.peer-panel').show(); }
    }
    function hidePeerButtons(peer) {
        if (peer) { $('#' + peer).find('button').hide(); }
        else { $('.peer-panel').find('button').hide(); }
    }
    function showPeerButton(peer, btn) { $('#' + peer).find(btn).show(); }
    function showPeerCheckbox(peer) {
        if (peer) { $('#' + peer).find('.peersel').show(); }
        else { $('.peer-panel').find('.peersel').show(); }
    }
    function hidePeerCheckbox(peer) {
        if (peer) { $('#' + peer).find('.peersel').hide(); }
        else { $('.peer-panel').find('.peersel').hide(); }
    }
    function resetPeerCheckbox(peer) {
        if (peer) { $('#' + peer).find('.peersel').attr('checked', false); }
        else { $('.peer-panel').find('.peersel').attr('checked', false); }
    }
    function addPeerButton(peer, btn, clickfunc) {
        $('#' + peer).find('.bgroup').append(btn);
        if (clickfunc) {
            btn.off('click');
            btn.on('click', clickfunc);
        }
    }
    function setPeerCasting(p) {
        if (sa.pmdesc[p]) {
            var type = sa.pmdesc[p].video ? 'video' : 'audio';
            setPeerTitle(p, getPeerTitle(p) + ' (' + type + ' broadcasting...)');
            hidePeerButtons(p);
            if (type == 'video') { showPeerButton(p, '.btn-watch'); }
            else { showPeerButton(p, '.btn-listen'); }
        }
    }   
    function enablePeerButton(peer, btn, onoff) { $('#' + peer).find(btn).attr('disabled', !onoff); }
    function setPeerTitle(peer, title) { $('#' + peer).find('.title').html(title); }
    function getPeerTitle(peer) { return $('#' + peer).find('.title').html(); }
    function getHostPanelId(e) { return $('.host-panel').attr('id'); }
    function getPeerPanelId(e) { return e.parents('.peer-panel').attr('id'); }
    function appendPeerVideo(peer) { $('#' + peer).find('.pbody').append(vpad).show(); }
    function resetPeerPanel(peer) {
        if (peer) {
            $('#' + peer).find('button').hide();
            $('#' + peer).find('.btn-video').show();
            $('#' + peer).find('.btn-audio').show();
            $('#' + peer).find('.pbody').hide();
            $('#' + peer).find('.peersel').hide();
            resetPeerTitle(peer);
            resetPeerCheckbox(peer);
            setPeerCasting(peer);
        }
        else {
            $('.peer-panel').find('button').hide();
            $('.peer-panel').find('.btn-video').show();
            $('.peer-panel').find('.btn-audio').show();
            $('.peer-panel').find('.pbody').hide();
            $('.peer-panel').find('.peersel').hide();
            resetPeerTitle();
            resetPeerCheckbox();
            $('.peer-panel').each(function(k, e) { setPeerCasting(e.id); });
        }
    }
    function resetHostPanel() {
        $('.host-panel').find('.pbody').hide();
        $('.host-panel').find('button').attr('disabled', true).hide();
        $('.host-panel').find('.btn-cast').attr('disabled', false).show();
        $('.host-panel').find('.btn-conf').attr('disabled', false).show();
        $('.host-panel').find('.title').html($('.host-panel').find('.title').attr('name'));
    }
    function resetPeerTitle(peer) {
        if (peer) { $('#' + peer).find('.title').html($('#' + peer).find('.title').attr('name')); }
        else { $('.peer-panel').find('.title').each(function(k, e) { $(e).html($(e).attr('name')); }); }
    }

    // recycle shared elements
    function recycleElement(e) {
        if (e.prop('tagName').toLowerCase() == 'button') { e.off('click'); }
        if (e == sbtn.mute) { e.removeClass('btn-success').addClass('btn-warning').html('mute'); }
        e.appendTo(recycle);
    }

    // Cookie functions
    function setCookie(key, value) {
        var expires = new Date();
        expires.setTime(expires.getTime() + (180 * 24 * 60 * 60 * 1000));
        document.cookie = key + '=' + value + ';expires=' + expires.toUTCString();
    }
    function getCookie(key) {
        var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
        return keyValue ? keyValue[2] : null;
    }
})();