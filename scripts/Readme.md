## Overview

There are four core Javascripts files for PeerCom:
* peercom.js - Core implementation of PeerCom to provide all-in-one (data/audio/video) WebRTC peer functions with wrapped up signaling and call setup procedures and simple APIs.
* confagent.js - Implementation of audio/video conferencing feature based on PeerCom.
* castagent.js - Implementation of audio/video broadcassting feature based on PeerCom.
* peercom-example.js - Implementation of integration of UI and PeerCom libraries.

NOTE: To avoid naming conflicts, all object modules are declared under Gatherhub naming space. i.e. Gatherhub.PeerCom(), Gatherhub.ConfAgent(), Gatherhub.CastAgent().

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

**oncaststart**

**oncaststop**

**onpeerjoin**

**onpeerleft**

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
