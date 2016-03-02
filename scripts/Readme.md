## Overview

There are four core files for PeerCom:
* peercom.js - Core implementation of PeerCom to provide all-in-one (data/audio/video) WebRTC peer functions with wrapped up signaling and media channel setup procedures in simple APIs.
* confagent.js - Implementation of full-meshed peer-to-peer audio/video conferencing features based on PeerCom.
* castagent.js - Implementation of one-way audio/video broadcassting features based on PeerCom.
* peercom-example.js - Demostration of the integration of UI and PeerCom libraries.

NOTE: To avoid naming conflicts, all object modules are declared under Gatherhub naming space. For example. 

```javascript
var pc = new Gatherhub.PeerCom(config);
var ca = new Gatherhub.ConfAgent(pc);
var sa = new Gatherhub.CastAgent(pc);
```

## peercom.js

peercom.js is the very core module of PeerCom. It consists three internal object modules which does not interact with application directly but do the real jobs below the surface. For developers who simply wants to leverage the capabilities of PeerCom, they do not need any further knowledge to the internal design of PeerCom. To those who may considering alter the design, here's a brief to these modules,

* WCC - WebSocket Communication Channel. WCC plays the role as the basic signaling channel object. WCC is designed to provide the very basic functionalities to get connected and exchange module-deifined or user-defined data with other PeerCom agents. A WebSocket server to incorporate with WCC named [Message Switch Router] (https://github.com/gatherhub/msgsrouter) written in Ruby is also provided in open source. There is only one WCC instance for each PeerCom agent.
* WPC - WebRTC PeerConnection Channel. With the help from WCC, WPC sets up a meshed peer-to-peer data channels among connected PeerCom agents if possible and once the data channel is opened, WPC replace WCC as the major communication channel between peers. When WPC setup is not possible, peers can still send/receive messages through WCC. PeerCom will check the availability automatically and selet the right one. There is one WPC for each connected peers.
* WMC - WebRTC Media Channel. WMC is dynamically created and destroyed when a media transmision is needed or closed. There could be N WMC objects depending on the use cases. WMC handles all media creation, negotiation, and manipulation internally. Developer only needs to provide the correct configuration without geting involved to the complex procedures.

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

Array[String], read-write - Address of MSR in the formate of 'wss://<server>:<port>' in an Array. If more than one is provided, PeerCom will try to connect the next MSR in round-robin manner in connection failure. Insecure WebSocket (ws://) is also supported. However, there is strict requirement in browser that only allows web pages and scripts to open media devices from a secure channel. Hence, it is recommeded to use secure WebSocket to get full features of PeerCom available.

**iceservers**

Array[Object/JSON], read-write - Address of Ice servers, same sa defined in WebRTC. It is for WebRTC PeerConnection object initiation. A null value can be provided when testing peers are in the same LAN, but active Ice servers are needed if PeeCom is running over Internet.

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
    
    pc.medchans[id].onlstreamready = function (stream) {
      addLocalStream(stream);
      // or
      addLocalStream(pc.medchans[id].lstream);
    }

    pc.medchans[id].onrstreamready = function (stream) {
      addRemoteStream(stream);
      // or
      addRemoteStream(pc.medchans[id].rstream);
    }
  }
  
  // code snippet on callee side
  var pc = new Gatherhub.PeerCom(config);
  
  pc.onmediarequest(req) = function (req) {
    switch (req) {
      case 'offer':
        // when 'offer' is received, a medchans[req.id] is created and waiting for user to response with PeerCom.mediaResponse()
        if (pc.medchans[req.id]) {
          pc.medchans[id].onlstreamready = function (stream) {
            addLocalStream(stream);
            // or
            addLocalStream(pc.medchans[id].lstream);
          }
      
          pc.medchans[id].onrstreamready = function (stream) {
            addRemoteStream(stream);
            // or
            addRemoteStream(pc.medchans[id].rstream);
          }
        }
        break;
      case 'answer':
        // when 'answwer' is received, the media channel is set up completly and ready to send/receive stream
        break;
      case 'cancel':
      case 'reject':
      case 'end':
        // when a media channel is closed, it will be auto-destroyed by PeerCom
        break;
    }
  }
```

NOTE: here is a list of properties, event callbacks, and methods of WMC,

#### WMC Properties:
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

#### WMC Event Callbacsk:
* onstatechange(state) - Fired when WMC state changed.
* onlstreamready(stream) - Fired when local stream is ready.
* onrstreamready(stream) - Fired when remote stream is ready.

#### WMC Methods:


**support**

Object/JSON, read-only -

**state**

String, read-pnly -

**autoping**

Boolean, read-write -

**pingwait**

Numeric, read-write -

### Event Callbacks:

**onerror(error)**

**onpeerchange(peers)**

**onmessage(message)**

**onmediarequest(req)**

**onstatechange(state)**

**onpeerstatechange(state)**

**onlocalstream(localstream)**

### Methods:

start()

stop()

send(data, type, to) 

mediaRequest(req)

mediaResponse(req, answer)

setLocalStream(mdesc)

freeLocalStream()

## confagent.js

## castagent.js

CastAgent provides the funcationality of playing the role as a broadcasting host or audience. CastAgent is implemented with its own state and signalling process and leverage PeerCom to exchange signalling information and media channel set up.

Usage example:
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
