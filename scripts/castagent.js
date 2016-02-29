/*
castagent.js is distributed under the permissive MIT License:

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

'use strict';

// Module Namespace：Gatherhub, all functions
// object prototypes will be under Gatherhub.xxx
var Gatherhub = Gatherhub || {};

(function() {
    // Abbreviation
    var g = Gatherhub;

    // Module based public object: CastAgent, Broadcast Agent based on PeerCom
    (function() {
        // Object-base shared local variables and functions

        // Export object Prototype to public namespace
        g.CastAgent = CastAgent;

        // Object Constructor
        function CastAgent(pc) {
        	var ca = this;
            var mdesc, castpeers, pmdesc, pmedchans, lstream, state;
            var oncaststart, oncaststop, onpeerjoin, onpeerleft, onlocalstream, onremotestream, onstatechange;
            var _peer;    // current broadcasting peer

            // Properties / Event Callbacks/ Methods declaration
            (function() {
                // read-only properties
                Object.defineProperty(ca, 'mdesc', {get: function() { return mdesc; }});
                Object.defineProperty(ca, 'castpeers', {get: function() { return castpeers; }});
                Object.defineProperty(ca, 'pmdesc', {get: function() { return pmdesc; }});
                Object.defineProperty(ca, 'pmedchans', {get: function() { return pmedchans; }});
                Object.defineProperty(ca, 'lstream', {get: function() { return lstream; }});
                Object.defineProperty(ca, 'state', {get: function() { return state; }});

                // Callbacks declaration, type check: function
                Object.defineProperty(ca, 'oncaststart', {
                    get: function() { return oncaststart; },
                    set: function(x) {
                        if (typeof(x) == 'function') { oncaststart = x; }
                        else { warn(hint.fcb, 'oncaststart'); }
                    }
                });
                Object.defineProperty(ca, 'oncaststop', {
                    get: function() { return oncaststop; },
                    set: function(x) {
                        if (typeof(x) == 'function') { oncaststop = x; }
                        else { warn(hint.fcb, 'oncaststop'); }
                    }
                });
                Object.defineProperty(ca, 'onpeerjoin', {
                    get: function() { return onpeerjoin; },
                    set: function(x) {
                        if (typeof(x) == 'function') { onpeerjoin = x; }
                        else { warn(hint.fcb, 'onpeerjoin'); }
                    }
                });
                Object.defineProperty(ca, 'onpeerleft', {
                    get: function() { return onpeerleft; },
                    set: function(x) {
                        if (typeof(x) == 'function') { onpeerleft = x; }
                        else { warn(hint.fcb, 'onpeerleft'); }
                    }
                });
                Object.defineProperty(ca, 'onlocalstream', {
                    get: function() { return onlocalstream; },
                    set: function(x) {
                        if (typeof(x) == 'function') { onlocalstream = x; }
                        else { warn(hint.fcb, 'onlocalstream'); }
                    }
                });
                Object.defineProperty(ca, 'onremotestream', {
                    get: function() { return onremotestream; },
                    set: function(x) {
                        if (typeof(x) == 'function') { onremotestream = x; }
                        else { warn(hint.fcb, 'onremotestream'); }
                    }
                });
                Object.defineProperty(ca, 'onstatechange', {
                    get: function() { return onstatechange; },
                    set: function(x) {
                        if (typeof(x) == 'function') { onstatechange = x; }
                        else { warn(hint.fcb, 'onstatechange'); }
                    }
                });

                // Methods declaration, read-only
                Object.defineProperty(ca, 'start', { value: start });
                Object.defineProperty(ca, 'startcast', { value: startcast });
                Object.defineProperty(ca, 'stopcast', { value: stopcast });
                Object.defineProperty(ca, 'recvcast', { value: recvcast });
                Object.defineProperty(ca, 'endrecv', { value: endrecv });
                Object.defineProperty(ca, 'consumemsg', { value: consumemsg });
                Object.defineProperty(ca, 'consumereq', { value: consumereq });
            })();

            // start CastAgent, must be called after PeerCom started
            function start() {
                mdesc = {};
                castpeers = [];
                pmdesc = {};
                pmedchans = {};
                state = 'idle';
                _peer = null;

                pc.send({cmd: 'query', mdesc: mdesc}, 'cast');
            }

            // notify all peers broadcast starting
            function startcast(desc) {
                if (state == 'idle') {
                    var _mdesc = {};
                    mdesc = desc || {};
                    mdesc.castid = (parseInt(pc.id, 16) + Date.now()).toString(16);

                    if (mdesc.audio) {
                        _mdesc.audio = mdesc.audio;
                        if (_mdesc.audio.dir) {
                            delete _mdesc.audio.dir;
                            if (!Object.keys(_mdesc.audio).length) { _mdesc.audio = true; }
                        }
                    }
                    if (mdesc.video) {
                        _mdesc.video = mdesc.video;
                        if (_mdesc.video.dir) {
                            delete _mdesc.video.dir;
                            if (!Object.keys(_mdesc.video).length) { _mdesc.video = true; }
                        }
                    }
                    pc.onlocalstream = function(s) {
                        lstream = s;
                        if (onlocalstream) { setTimeout(function() { onlocalstream(s); }, 0); }
                    };
                    pc.setLocalStream(_mdesc);
                    pc.send({cmd: 'start', mdesc: mdesc}, 'cast');
                    _changeState('casting');
                }
            }

            // notify all peers broadcast stopped
            function stopcast() {
                if (state == 'casting') {
                    // end all media sessions
                    lstream = null;
                    pc.freeLocalStream();
                    Object.keys(pmedchans).forEach(function(k) {
                        if (pmedchans[k]) {
                            pmedchans[k].end();
                            pmedchans[k] = null;
                            delete pmedchans[k];
                        } 
                    });
                    pc.send({cmd: 'stop', mdesc: mdesc}, 'cast');

                    _changeState('idle');
                }
            }

            // receiving broadcst from a peer
            function recvcast(peer) {
            	if (state == 'idle' && pmdesc[peer]) {
                    _peer = peer;
                    mdesc = pmdesc[peer];
                    if (mdesc.audio) { mdesc.audio.dir = 'recvonly'; }
                    if (mdesc.video) { mdesc.video.dir = 'recvonly'; }
	            	_changeState('requesting');

                    // make mediarequest to peer
                    var id = pc.mediaRequest({to: peer, mdesc: mdesc});
                    if (id) {
                        pmedchans[peer] = pc.medchans[id];
                        // notify application a new media channel is created
                        if (onremotestream) {
                            setTimeout(function() { onremotestream(pmedchans[peer]); }, 0);
                        }

                        _changeState('recvcast');
                        // return true for success
                        return true;
                    }
            	}

                _changeState('idle');
                // CastAgent can only make request when its state is 'idle'
                return false;
            }

            // stop receiving broadcast
            function endrecv() {
            	if (state == 'recvcast' && pmedchans[_peer]) {
                    pmedchans[_peer].end();
                    pmedchans[_peer] = null;
                    delete pmedchans[_peer];
                }
                pc.send({cmd: 'end', mdesc: mdesc}, 'cast', _peer);
                _changeState('idle');
            }

            // CastAgent shares PeerCom messaging dispatcher with applicaion,
            // application should call CastAgent.consumemsg() first before processing PeerCom messages
            // if message is what CastAgent concerns, it will be consumed and return null, or return as is if irrelavant
            function consumemsg(msg) {
                var pout = 0, pin = 0;
            	if (msg.type == 'cast') {
            		switch (msg.data.cmd) {
            			case 'start':
                            castpeers.push(msg.from);
                            pmdesc[msg.from] = msg.data.mdesc;
                            if (oncaststart) { setTimeout(function() { oncaststart(msg.from); }, 0); }
                            break;
            			case 'stop':
                            if (state == 'recvcast' && _peer == msg.from && pmedchans[msg.from]) { endrecv(); }
                            if (castpeers.indexOf(msg.from) > -1) {
                                castpeers.splice(castpeers.indexOf(msg.from),1);
                                if (oncaststop) { setTimeout(function() { oncaststop(msg.from); }, 0); }
                            }
                            if (pmdesc[msg.from]) { delete pmdesc[msg.from]; }
            				break;
                        case 'end':
                            if (pmedchans[msg.from]) {
                                pmedchans[msg.from].end();
                                pmedchans[msg.from] = null;
                                delete pmedchans[msg.from];
                            }
                            if (onpeerleft) { setTimeout(function() { onpeerleft(msg.from); }, 0); }
                            break;
                        case 'query':
                            if (state == 'casting') { pc.send({cmd: 'start', mdesc: mdesc}, 'cast', msg.from); }
                            break;
            			default:
            				break;
            		}

            		return null;
            	}
            	else {
                    if (msg.type == 'bye') {
                        if (pmedchans[msg.from]) {
                            pmedchans[msg.from].end();
                            pmedchans[msg.from] = null;
                            delete pmedchans[msg.from];
                        }
                        if (onpeerleft) { setTimeout(function() { onpeerleft(msg.from); }, 0); }
                    }
                    return msg;
                }
            }

            // To setup media channels need by CastAgent, CastAgent need to process PeerCom media request event
            // same as consumemsg, application should call consumereq first to let CastAgent process concerned request
            function consumereq(req) {
                // PeerCom will automatically create a media channel in a new offer request
            	// if req has matched castid and exists in peers.medchan then process it, or return it to application
            	if (req.mdesc.castid && req.mdesc.castid == mdesc.castid && pc.medchans[req.id]) {
                    // we only interested in answering (say 'yes') to an new offer reuqest (pmedchans[x] has not been created)
            		if (req.type == 'offer' && !pmedchans[req.from]) {
	        			pmedchans[req.from] = pc.medchans[req.id];
                       // Auto-accept offer
	        			pc.mediaResponse(req, 'accept');
                        if (onpeerjoin) { setTimeout(function() { onpeerjoin(req.from); }, 0); }
            		}
            		return null;
            	}
            	else { return req; }
            }

            function _changeState(ste) {
                state = ste;
                if (onstatechange) {
                    setTimeout(function() { onstatechange(state); }, 0);
                }
            }
	}
	})();	
})();