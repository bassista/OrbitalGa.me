# OrbitalGa.me

# Goals

- Infinite horizontal world
- Constantly scrolling forward
- Server generated enemies, powerups, and events
- Goal is to stay alive and generate the most points
  - Leaderboards

# Todo

## Features/Bugs

- [ ] warning when you go too far left?
- [ ] improve bot logic
- [ ] make keyboard wasd
- [ ] fix explosion animation
- [ ] add latency tracking
- [ ] add audio
- [ ] hard to go straight left with nipplejs
- [ ] add server kill switch to boot everyone out
- [ ] support multiple bounding boxes
  - [ ] fix boundingbox not being from center
  - [ ] add rotate to bounding box
  - [ ] figure out collision position for explosion
- [ ] server is offline, play with bots locally
- [ ] figure out ghost players
- [x] better grouping of players and enemies
- [x] optimize server
- [x] only send data for livePlayer vs non
- [x] validate input sequence number, assure they can't send garbage negative, etc
- [x] add ping
- [x] disconnect player for prolonged inactivity 
- [x] disconnect player for delayed pingpong 
- [x] test server version
- [x] import all assets
- [x] add momentum to rocks
- [x] make collisions work better, faster tick?
- [x] abstract shield better, player keeps taking damage
- [x] make collision more abstracted
- [x] fix shots being tied to entity xy
- [x] revive does not work 
- [x] abstract interpolate entities
- [x] better death animation
- [x] moving goes out of sync on mobile, i think its moving faster
- [x] figure out mobile jitter, https://bugs.chromium.org/p/chromium/issues/detail?id=1068769 
- [x] add death animation 
- [x] fix shot offset in shot to be x,y and owner 
- [x] add bots to client
- [x] take damage
  - [x] die
- [x] deploy singleplayer support
- [x] connect on login screen
- [x] show game in background of login, add spectator mode to server
- [x] support drawing bounding boxes in debug
- [x] garbageless client tick
- [x] add server version
- [x] add collisionless entities
- [x] add shake screen effects when attack

## Game Rules

- [ ] watch other shmups
- [ ] add power-ups
  - [ ] two clones fight with you?
- [ ] come up with more enemies
- [ ] come up with realtime events
  - [ ] big bosses every 5 min?
  - [ ] build big enemy like in top left of Kenney expansion
- [ ] abstract game events into a class
  - [ ] register event at tick?
  - [ ] puzzles solve together like a maze blow up walls game event?
- [ ] drop power-ups from enemy
- [ ] drop power-ups from debris
- [ ] add 5 second sustained laser
- [x] add rocket
- [x] abstract weapons
- [x] add death effect
- [x] add a concept of enemy types, better abstraction
- [x] add shields
  - [x] you always have shield that regens but also upgradable
  - [x] add shield power up
- [x] support for player color
- [x] add multiple enemy colors
- [x] better rock debris
- [x] add rock debris

## Infrastructure

- [ ] leaderboard
  - [ ] redis
- [ ] add lambda for join/etc, checks redis for servers, spins one up?
- [ ] add login register
- [ ] add license to repo
- [ ] test what happens if server crashes on aws
- [ ] add analytics to server to see users connected, enemies, etc
- [ ] add monitoring server to watch things happen
- [ ] once the average duration (over 10 ticks) goes above a threshold, take server out of rotation 
- [x] make sure disconnect and kill work

## Money

- [ ] watch ad to get upgrade, or micro-transaction or donate cup of coffee https://www.buymeacoffee.com/
  - [ ] how do other guys do it itch.io
- [ ] let streamers create their own server and send their own waves of enemies until everyone dies?????????
- [ ] for huge streamers 500 people play across 10 servers, same script tho


### old

* [x] figure out multiplayer jumpiness on move
* [x] validate buffer so client get send garbage, try catch and boot user
* [x] move byte buffer code into individual entity
* [x] refactor clientGame to be more dynamic and support adding entities easier
* [x] determine screen size
  - [x] scaling
  - [x] cant go off the screen
* [x] better kenney assets
* [x] shot explode effect
* [x] gun shooting offcenter when youre moving
* [x] add momentum to movement
* [x] alternate left right on shot
* [x] better mobile support
  - [x] add mouse movement
  - [x] add full screen rotate code
* [x] binary transfer
* [x] better background
* [x] refactor code
  - [x] better separation
  - [x] proper draw
  - [x] add better bounding box for collisions
* [x] clean up serialize, worldstate, buffer builder
* [x] make it easier to add things add entities and sync fields
* [x] add worldstate filtering
* [x] build bots
* [x] load test
* [x] deploy to beanstalk
* [x] determine how to scale up servers dynamically


## Groupings

Ideal grouping is 3 players per screen width, try to force this as much as possible, ai and user placement should always enforce this balance