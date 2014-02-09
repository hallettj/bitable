Bitable
=======

Bitable [ˈbɪtˌəbl̩] is an implementation of a distributed hash table
(DHT) in Javascript, using [WebRTC][] to connect peers.  It is intended
to run in web browsers.

[WebRTC]: http://www.webrtc.org/

This is a work-in-progress - that is to say, it is not working yet.  But
a [previous commit][working] did work to demonstrate transmitting
pictures of cats to a network of peers.

[working]: https://github.com/hallettj/bitable/commit/ecfcdbd11358214c9d4162f376bff06802ea2d4f

The plan is that when Bitable is completed it will serve as a platform
for building custom decentralized applications.  Any user who visits
a web page running a Bitable-powered application automatically becomes
a peer on the network.


License
-------

Copyright 2013 Jesse Hallett

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
