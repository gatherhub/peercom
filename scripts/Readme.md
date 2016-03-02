## Overview

There are four core files for PeerCom:
* **peercom.js** - Core implementation of PeerCom to provide all-in-one (data/audio/video) WebRTC peer functions with wrapped up signaling and media channel setup procedures in simple APIs.
* **confagent.js** - Implementation of full-meshed peer-to-peer audio/video conferencing features based on PeerCom.
* **castagent.js** - Implementation of one-way audio/video broadcassting features based on PeerCom.
* **peercom-example.js** - Demostration of the integration of UI and PeerCom libraries.

**NOTE**: To avoid naming conflicts, all object modules are declared under Gatherhub naming space. For example. 

```javascript
var pc = new Gatherhub.PeerCom(config);
var ca = new Gatherhub.ConfAgent(pc);
var sa = new Gatherhub.CastAgent(pc);
```

## peercom.js

peercom.js is the very core module of PeerCom. It consists three internal object modules which does not interact with application directly but do the real jobs below the surface. For developers who simply wants to leverage the capabilities of PeerCom, they do not need any further knowledge to the internal design of PeerCom. To those who may considering alter the design, here's a brief to these modules,

* **WCC** - WebSocket Communication Channel. WCC plays the role as the basic signaling channel object. WCC is designed to provide the very basic functionalities to get connected and exchange module-deifined or user-defined data with other PeerCom agents. A WebSocket server to incorporate with WCC named [Message Switch Router] (https://github.com/gatherhub/msgsrouter) written in Ruby is also provided in open source. There is only one WCC instance for each PeerCom agent.
* **WPC** - WebRTC PeerConnection Channel. With the help from WCC, WPC sets up a meshed peer-to-peer data channels among connected PeerCom agents if possible and once the data channel is opened, WPC replace WCC as the major communication channel between peers. When WPC setup is not possible, peers can still send/receive messages through WCC. PeerCom will check the availability automatically and select the right one. There is one WPC for each connected peers.
* **WMC** - WebRTC Media Channel. WMC is dynamically created and destroyed when a media transmision is needed or closed. There could be N x WMC objects depending on the use cases. WMC handles all media creation, negotiation, and manipulation internally. Developer only needs to provide the correct configuration without geting involved to the complex procedures.

Usage Example:
```javascript
  // create a PeerCom ojbect
  var pc = new Gatherhub.PeerCom(config);
  
  // setup handler for message
  pc.onmessage = function (msg) {
    console.log(msg.from, msg.type, msg.data);
  };
  // set up handler for media reuqest
  pc.onmediarequest = function (req) {
    switch (req.type) {
      case 'offer':
        // accept the call
        pc.mediaResponse(req, 'accept');
        // reject the call
        pc.mediaResponse(req, 'reject');
        break;
      case 'answer':
        console.log('call connected');
        break;
      case 'reject':
      case 'cancel':
      case 'end':
        console.log('call ends');
        break;
    }
  };
  
  // make a call
  var mdesc = {audio: true, video: true};
  var req = {to: peerx, mdesc};
  var id = pc.mediaRequest(req);
  if (id) {
    console.log('requesting')
    // set local stream handler
    pc.medchans[id].onlstreamready = function (stream) {
      addLocalMedia(stream);
    };
    // set remote stream handler
    pc.medchans[id].onrstreamready = function (stream) {
      addRemoteMedia(stream);
    };
  }
```
### Data Structures:

**config** - PeerCom Configurations

PeerCom confiurations can be provided at instance creation or configured later through its properties.

```javascript
  var peer_name = 'My name';  // Display name of a peer, a unique Peer ID is dynamically given by Message Switch Router when connected
  var hubid = 'myhub';        // Any strings, only peers with the same hub ID can communicate to each others.
  // Message Switch Router server address, if more than one server is provided, 
  // WCC will auto rotate server connection at connection failure. To support media 
  // communication, SSL is required for security concern. therefore, we must use secure WebSocket (wss).
  var msrsvrs = ['wss://<server1>:<port>', 'wss://<server2>:<port2>'];   
  var icesvrs = [
        {'urls': 'stun:stun01.sipphone.com'},
        {'urls': 'stun:stun.fwdnet.net'},
        {'urls': 'stun:stun.voxgratia.org'},
        {'urls': 'stun:stun.xten.com'},
        {'urls': 'stun:chi2-tftp2.starnetusa.net'},
        {'urls': 'stun:stun.l.google.com:19302'}
    ];
    
  var config = {
    peer: peer_name,
    hub:  hubid,
    servers: msrsvrs,
    iceservers: icesvrs,
  };
```

**mdesc/desc** - Media Description

Media description is very similar to WebRTC getUserMedia constraints but only with some little extensions,

```javascript
  // standard getUserMedia constraints is compatible
  var mdesc = {
    audio: true,
    video: true
  };
  
  // add extended audio/video direction constraints, when direction is not set, default is bi-directional 'sendrecv'
  var mdesc = {
    audio: {
      dir: 'recvonly'   // dir is the PeerCom extension to set the stream direction
    },
    video: {
      mandatory: {
        minWidth: 320,
        minWidth: 240,
        maxWidth: 320,
        maxHeight:240
      },
      dir: 'sendonly'
      // audio/video may be set with different directions, 
      // options are 'sendrecv', 'sendonly', 'recvonly', 'inactive'
    }
  };
```

**req/res** - Media Request/Response

Media request provides the requirements of media channel. For a new request, user only needs to provide the target peer (to) and media description (mdesc) field to PeerCom. If media channel set up is possible a unique request ID will be added to (req) and be used within the whole session which is also the major identy of a media channel. As negotiation moves on, more information will be appended to (req) automatically. User may alter a (req) returned from PeerCom to make desired change, but it might not be necessary in most of times.

```javascript
  var req = {
    // id: reqid            // id is generated by PeerCom.mediaRequest() and will returned to caller as media channel handler
    to: peer_id,
    // from:                // from will be automatically filled in by PeerCom
    mdesc: mdesc,
    // sdp: sdp             // sdp is generated by PeerCom during negotiation
    // conn: icecandidate,  // conn is generated by PeerCom during negotiation
    // confid: confid,      // confid is added by conference agent to identify a conference session
    // castid: castid       // castid is added by broadcast agent to identify a broadcast session
  };
```

### Properties:

**id**

String, read-only - 'id' is given by MSR (Message Switch Router) when PeerCom connected to one. It is used as the unique communication identy of PeerCom.

**peer**

String, read-write - 'peer' is the display name of the user. If user changes 'peer' value after PeerCom started, PeerCom will auto-restart to update the change to other peers.

**hub**

String, read-write - 'hub' is the identiification of a "room" PeerCom intended to join. 'hub' can be any String, but only PeerComs configured with the same 'hub' would be able to communicate to each others. If user changes 'hub' value after PeerCom started, PeerCom will auto-restart to join the updated 'hub'.

**servers**

Array(String), read-write - Address of MSR in the formate of 'wss://<server>:<port>' in an Array. If more than one is provided, PeerCom will try to connect the next MSR in round-robin manner in connection failure. Insecure WebSocket (ws://) is also supported. However, there is strict requirement in browser that only allows web pages and scripts to open media devices from a secure channel. Hence, it is recommeded to use secure WebSocket to get full features of PeerCom available.

**iceservers**

Array(Object/JSON), read-write - Address of Ice servers, same sa defined in WebRTC. It is for WebRTC PeerConnection object initiation. A null value can be provided when testing peers are in the same LAN, but active Ice servers are needed if PeeCom is running over Internet.

**peers**

Object/JSON, read-only - 'peers' is self-managed by PeerCom and holds the 'peer' objects of connected peers. 

```javascript
  peer = {
    peer: "peer_name", 
    sigchan: WPC,                   // WebRTC PeerConnection of Data Channel for peer-to-peer direct data/message communication
    support: {audio: 1, video: 1},  // audio/video capability
    overdue: 0,                     // times of missed response of a peer, updated only when 'autopin' sets to enable
    rtdelay: 6                      // round-trip delay, auto-logged in 'ping' response
  }
```

**medchans**

Object/JSON, read-only - Media Channels, dyanmically created and self-managed by PeerCom. Each media channel is a WMC object with a unique WMC id which is the same as the key of 'medchans'. Users may perform operations on a media channel through 'medchans'.

```javascript
  // code snippet on caller side
  var pc = new Gatherhub.PeerCom(config);
  var id = pc.mediaRequest(req);
  
  if (id && pc.medchans[id]) {
    // mute/unmute channel
    pc.medchans[id].mute();

    // canceling request
    pc.medchans[id].cancel();

    // close channel
    pc.medchans[id].end();
  }
```

**NOTE**: here is a list of properties, event callbacks, and methods of WMC,

- **WMC Properties:**
  * id - Unique WMC id and key of PeerCom.medchans 
  * to - WMC target peer
  * from - WMC source peer
  * mdesc - Media description
  * lsdp - local SDP, maianly for debugging
  * rsdp - remote SDP, mainly for debugging
  * lconn - local ICE candidates, mainly for debugging
  * rconn - remote ICE candidates, mainly for debugging
  * lstream - local stream
  * rstream - remote stream
  * csrcstream - customized source stream, this is used to set customized source stream instead of default local stream. It is part of media relay/forward feature which is not completed yet.
  * muted: true/false
  * type: 'audio'/'video'
  * audiodir: 'sendrecv'/'sendonly'/'recvonly'/'inactive'
  * videodir: 'sendrecv'/'sendonly'/'recvonly'/'inactive'
  * state: 'initialized'/'preparing'/'open'/'canceled'/'rejected'/'ended'/'failed'/'requesting'/'accepting'/'timeout'/'closed'

- **WMC Event Callbacsk:**
  * onstatechange(state) - Fired when WMC state changed.
  * onlstreamready(stream) - Fired when local stream is ready.
  * onrstreamready(stream) - Fired when remote stream is ready.

**NOTE**: _**onlstreamready and onrstreamready maybe fired before callback function is configured. It is suggested to check the WMC.lstream and WMC.rstream availability first instead of all relying on onlstreamready/onrstreamready events.**_

- **WMC Methods:**
  * accept() - Accept offer, should call PeerCom.mediaResponse(req, 'accept') instead.
  * reject() - Reject offer, should call PeerCom.mediaResponse(req. 'reject') instead.
  * cancel() - Cancel offer request.
  * end() - End session.
  * mute() - Mute local audio capturing.

**support**

Object/JSON, read-only - PeerCom checks local media support capability and logged in 'support'.

**state**

String, read-pnly - PeerCom state: 'starting'/'started'/'stopping'/'stopped'

**autoping**

Boolean, read-write - true/false. Enable/disable Audo-ping function, default enabled. When auto-ping is enabled, PeerCom will send a 'ping' message to all connected peers at the interval of 'pingwait'. Each ping response will come with the round-trip delay and overdue measurement to track the connectivity of each peers. When auto-ping is enabled, if a remote peer's WPC channel is closed or failed to response ping for three times, it will be removed from PeerCom.peers.

**pingwait**

Numeric, read-write - The wating time for each auto-ping interval.

### Event Callbacks:

**onerror(error)**

Fired, when error occures in PeerCom.

**onpeerchange(peers)**

Fired when there is a peer joined or left. Application should update UI accordingly.

**onmessage(message)**

Fired when received a message. Some control messages is consumed by PeerCom itself and will not be passed down to application.

**onmediarequest(req)**

Fired when received a media request (offer). Application should handle the request properly and answer to the request.

**onstatechange(state)**

Fired when PeerCom.state changed. Application should make corresponding UI changes based on the state.

**onpeerstatechange(peerstate)**

Fired when a peer's WPC (sigchan) state changed. This helps application to catch the changes of connected peer's data channel availabilty.

**onlocalstream(localstream)**

Fired when 'localstream' is set. Refer to setLocatStream for more detail.

### Methods:

**start()**

Start PeerCom service.

**stop()**

Stop PeerCom service.

**send(data, type, to)**

Send message to target peer (to). If 'to' is not provided, message will be sent to all connected peers (in the same hub). 'type' can be any String, but there are already some types defined by PeerCom for flow-controls and some other types defined by other applications like ConfAgent and CastAgent. User must be careful about the type conflicts. 'data' can be any type of data, String, Numeric, Object/JSON. 

**mediaRequest(req)**

Make a media channel requeset (offer). The media channel configuration is configured in 'req' data structure (refer to 'req' in Data Structures). 

**mediaResponse(req, answer)**

Make an answer to a request, when an offer request is received from onmediarequest event callback, user simply put the 'req' into mediaResponse() and give an answer of 'accept' or 'reject' to accept or reject the offer.

**setLocalStream(mdesc)**

This is a special feature which is to get local stream object before opening any media channel (WMC). It is useful for broadcast scenario that a broadcasting host may open a local stream and waiting for connection before construct any. When setLocalStream is called and a local stream is created successfully, onlocalstream(stream）event callback will be fired. Please also refer to freeLocalStream.

freeLocalStream()

When a local stream is created by setLocalStream() instead of standard mediaRequest()/mediaResponse() functions, the local stream will be locked untill freeLocalStream() is called. User must call freeLocalStream after calling setLocalstream.

## confagent.js

ConfAgent provides the functionalities of setting up a full-meshed peer-to-peer audio/video conference. A peer may initiate a conference request through ConfAgent. Peers can answer the conference request through ConfAgent. ConfAgent also maintains the connectivity state of conferencing peers and generates events at peer's join or left.

Usage Example:
```javascript
  var pc = new Gatherhub.PeerCom(config);
  var ca = new Gatherhub.ConfAgent(pc);
  
  pc.onmessage = function (msg) {
    // when a message is received, pass it to ConfAgent first.
    msg = ca.consumemsg(msg);
    // if the message is for ConfAgent, it will be consumed by ConfAgent and return null, otherwise, return message as is.
    if (msg) {
      // do whatever it supposed to
    }
  };
  
  pc.onmediarequest = function (req) {
    // when a request is received, pass it to ConfAgent first.
    req = ca.consumereq(req);
    // if the request is for ConfAgent, it will be consumed by ConfAgent and return null, otherwise, return request as is.
    if (req) {
      // do whatever it supposed to
    }
  };
  
  ca.onconfrequest = function (req) {
    // notify user of conference request through user interface
    
    // user can get the list of peers who are invited to the conference from req.peers
    // and each peers' response from ca.pstate[peer]
    req.peers.forEach(function(p) {
        // filter self from conference peer list
        if (p != pc.id) {
          console.log(pc.peers[p].peer + ' state: ' + ca.pstate[p]);
        }
    });
  };
  
  ca.onconfresponse = function(res) {
    // update peer respoonse in user interface
  };
  
  ca.onmedchancreated = function(medchan) {
    // attach media streams to html media object
    medchans.onlstreamready = function (stream) {
      addLocalMedia(stream);
    }
    
    medchan.onrstreamready = function (stream) {
      addRemoteMedia(stream);
    }
  };
  
  ca.onstatechange = function(state) {
    // update user interface based on ConfAgent state update
  };
  
  // add peer into conference
  ca.addPeer(peer);
  
  // remove peer from conference
  ca.removePeer(peer);
  
  // make conference request
  ca.request(mdesc);
  
  // accept conference request
  ca.response('accept');
  
  // reject conference request
  ca.response('reject');
  
  // cancel conference request
  ca.cancel();
  
  // mute/unmute microphone
  ca.mute();
  
  // exit from a conference
  ca.exit();
  
  // rest conference agent
  ca.reset();
```

### Properties:

**peers**

Array(String), read-only - Conference peer list stores peer_id of invited peers.

**pstate**

Object/JSON, read-only - Conference peer state: 'host'/'wait'/'accepted'/'rejected'/'joined'/'left'

**pmedchans**

Object/JSON, read-only - Key = peer_id, WMC object for each conference peer.

**state**

String, read-only - ConfAgent State: 'idle'/'requeseting'/'waitanswer'/'answering'/'joining'/'canceling'/'leaving'

**muted**

Boolean, read-only - ConfAgent muted state: true/false, default: false

### Event Callbacks:

**onconfrequest(req)**

**onconfresponse(msg)**

**onmedchancreated(medchan)**

**onstatechange(state)**

### Methods:

**start()**

**consumemsg(msg)**

**consumereq(req)**

**addPeer(p, s)**

**removePeer(p)**

**request(mdesc)**

**response(res)**

**cancel()**

**mute()**

**exit()**

**reset()**

## castagent.js

CastAgent provides the funcationalities of setting up a one-to-many one-way audio/video broadcasting service. A peer may start a broadcast with CastAgent or receiving broadcast through CastAgent. CastAgent maintains the broadcasting state of peers and update the changes to the others. It also maintains the audience join/left state and update changes to the broadcast host.

Usage Example:
``` javascript
  var pc = new Gatherhub.PeerCom(config);
  var sa = new Gatherhub.CastAgent(pc);
```

### Properties:

**mdesc**

Media description, stores the media description

**castpeers**


**pmdesc**

**pmedchans**

**lstream**

**state**

### Event Callbacks:

**oncaststart(peer)**

'oncaststart' is fired by ConfAgent when a remote peer started a casting. 'peer' is the remote peer who started a broadcast. Application should update UI to notify user about the change.


```javascript
sa.oncaststart = function(p) {
  // add broadcasting to peer title
}
```

**oncaststop(peer)**

'oncaststop' is fired by ConfAgent when a remote peer stopped a casting. 'peer' is the remote peer who stopped a broadcast. Application should update UI to notify user about the change.

**onpeerjoin(peer)**

'onpeerjoin' is fired by broadcasting ConfAgent when a remote peer is starting to receive the broadcast. 'peer' is the remote peer who is joining the broadcast. Application may update UI to notify user about the change.

**onpeerleft(peer)**

'onpeerleft' is fired by broadcasting ConfAgent when a remote peer is stopping to receive the broadcast. 'peer' is the remote peer who is leaving the broadcast. Application may update UI to notify user about the change.

**onlocalstream(stream)**

**onremotestream(stream)**

**onstatechange(state)**

### Methods:

**start()**

**startcast(desc)**

**stopcast()**

**recvcast(peer)**

**endrecv()**

**consumemsg(msg)**

**consumereq(req)**

## peercom-example.js

peercom-example.js is the application which glues everything together including user interface. It is provided as a complete demo or a ready to use implementation for developers. peercom-example demostrates the manipulation of PeerCom and how to dynamically notify and change user interface to provide a peer-to-peer media communication client.
