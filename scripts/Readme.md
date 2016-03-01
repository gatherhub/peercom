## Overview

There are four core Javascripts files for PeerCom:
* peercom.js - Core implementation of PeerCom to provide all-in-one (data/audio/video) WebRTC peer functions with wrapped up signaling and call setup procedures and simple APIs.
* confagent.js - Implementation of audio/video conferencing feature based on PeerCom.
* castagent.js - Implementation of audio/video broadcassting feature based on PeerCom.
* peercom-example.js - Implementation of integration of UI and PeerCom libraries.

NOTE: To avoid naming conflicts, all object modules are declared under Gatherhub naming space. For examole. 

```javascript
var pc = new Gatherhub.PeerCom(config);
var ca = new Gatherhub.ConfAgent(pc);
var sa = new Gatherhub.CastAgent(pc);
```

## peercom.js

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
