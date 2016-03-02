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
* WPC - WebRTC PeerConnection Channel. With the help from WCC, WPC sets up a meshed peer-to-peer data channels among connected PeerCom agents if possible and once the data channel is opened, WPC replace WCC as the major communication channel between peers. When WPC setup is not possible, peers can still send/receive message through WCC. PeerCom will check the availability automatically and selet the right one. There is one WPC for each connected peers.
* WMC - WebRTC Media Channel. WMC is dynamically created and destroyed when a media transmision is needed or closed. There could be N WMC objects depending on the use cases. WMC handles all media creation, negotiation, and manipulation internally. Developer only needs to provide the correct configuration without geting involved to the complex procedures.

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

**onlocalstream**

**onremotestream**

**onstatechange**

### Methods:

**start()**

**startcast(desc)**

**stopcast()**

**recvcast(peer)**

**endrecv()**

**consumemsg(msg)**

**consumereq(req)**

## peercom-example.js
