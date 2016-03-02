# PeerCom

### _Peer-to-Peer Messaage, Data, Audio, Video, Conferencing, and Broadcasting_

PeerCom is a WebRTC implementation to provide the above features. It also provides fully wrapped up APIs and nice example to help developers to deliver these features quickly without going through the complex processes. 

**NOTE:** Currently PeerCom only supports Google Chrome browser for PC/Android. There will be additional work to support other browsers.

# Installation / Deployment

PeerCom is implemented fully in Javascript as the front-end application. However, it does need a little help from a server. This particular server is called [Message Switch Router] (https://github.com/gatherhub/msgsrouter). Message Switch Router (or MSR) helps PeerCom to setup the peer-to-peer communication network. After that, MSR is not very needed and most communications go through the peer-to-peer channels created by PeerCom. You can run PeerCom with its original MSR configuration, or if you would like to setup your own, you may refer to https://github.com/gatherhub/msgsrouter. 

Developer may leverage PeerCom as a library or take it as a base and exapnd more functionality from it. PeerCom contains no server-side implementation and everything can be executed in a browser. Just download the PeerCom repository and put it on your https server. The next thing is to make sure you configured your https server correctly with proper certificate and private key. 

# Module Description and API Manual

Module description and API manual is put in /scripts folder. [Click here] (https://github.com/gatherhub/peercom/tree/master/scripts)

# License

PeerCom is released and distributed under the permissive MIT License:
Copyright (c) Quark Li, quarkli@gmail.com
