require("dotenv").config()

const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server, {cors: {origin: '*'}, allowEIO3: true})

app.set('view engine', 'html')

// app.get('/home', (req, res) => {
//     res.render('views/home.html')
//     // res.send('hi test')
// })

// app.use(express.static(path.join(__dirname, 'public')));
// app.use(express.static(__dirname + "html"));

// var path = require('path');
// var htmlPath = path.join(__dirname, 'views');
// app.use(express.static(htmlPath));

app.use(express.static(__dirname));

// app.get('/views/home', (req, res) => {
//     res.render('home.html')
//     // res.send('hi test')
// })

const port = process.env.PORT || 3001
server.listen(port, () => {
    console.log('Server started...')
})

// console.log('__dirname:' + __dirname)

let activeSockets = []
let socketIdRoomNumberMap = new Map()
let storeSocketIds = []
let storeRoomNumbers = []
let socketIdUserIdMap = new Map()
let storeViewSocketIds = []
let storeViewUserIds = []

io.on('connection', (socket) => {
    var host = 'localhost';
    // var host = '192.168.86.23';


    const roomNumber = socket.handshake.query['roomNumber']
    const storeViewUserId = socket.handshake.query['userId']

    socket.on('message', (data) => {

        io.emit('message', data)
        console.log('server.js message')
    })

    const existingSocket = activeSockets.find(existingSocket => existingSocket === socket.id)

    socket.emit('socketid', {
        socketid: socket.id,
        roomNumber: roomNumber,
        storeViewUserId: storeViewUserId
    })

    socket.emit('store-load', {
        socketid: socket.id,
        roomNumber: roomNumber
    })

    if (!existingSocket) {
        activeSockets.push(socket.id)

        socket.emit('update-user-list', {
            users: activeSockets.filter(existingSocket => existingSocket !== socket.id)
        })

        socket.broadcast.emit('update-user-list', {
            users: [socket.id]
        })
    }

    const existingRoom = socketIdRoomNumberMap.has(socket.id)
    var isStore = false
    if (roomNumber) {
        isStore = true
    }

    if (isStore && !existingRoom) {
        socketIdRoomNumberMap.set(socket.id, roomNumber)
        storeSocketIds.push(socket.id)
        storeRoomNumbers.push(roomNumber)

        socket.broadcast.emit('update-room-list', {
            sockets: storeSocketIds,
            rooms: storeRoomNumbers
        })
    }

    const existingStoreViewUser = socketIdUserIdMap.has(socket.id)
    var isStoreView = false
    if (storeViewUserId) {
        isStoreView = true
    }

    if (isStoreView && !existingStoreViewUser) {
        socketIdUserIdMap.set(socket.id, storeViewUserId)
        storeViewSocketIds.push(socket.id)
        storeViewUserIds.push(storeViewUserId)
    }

    socket.emit('update-room-list', {
        sockets: storeSocketIds,
        rooms: storeRoomNumbers
    })

    socket.on('call-store-view-user-id', data => {
        storeViewUserExists = false

        storeViewSocketId = [...socketIdUserIdMap.entries()].filter(({1:v}) => v === data.storeViewUserId).map(([k]) => k)

        if (storeViewSocketId.length > 0) {
            storeViewUserExists = true
        }

        if (storeViewUserExists) {
            socket.to(storeViewSocketId).emit('call-made', {
                offer: data.offer,
                socket: socket.id
            })
        }
    })

    socket.on('call-user', data => {
        socket.to(data.to).emit('call-made', {
            offer: data.offer,
            socket: socket.id
        })
    })

    socket.on('make-answer', data => {
        socket.to(data.to).emit('answer-made', {
            socket: socket.id,
            answer: data.answer
        })
    })

    socket.on('disconnect', () => {
        activeSockets = activeSockets.filter(existingSocket => existingSocket !== socket.id)
    
        socket.broadcast.emit('remove-user', {
            socketId: socket.id
        })
        
        if (isStore) {
            socketIdRoomNumberMap.delete(socket.id)
            storeSocketIds = storeSocketIds.filter(existingSocket => existingSocket !== socket.id)
            storeRoomNumbers = storeRoomNumbers.filter(existingSocket => existingSocket !== roomNumber)
            socket.broadcast.emit('remove-room', {
                roomNumber: socket.id
            })
        }

        if (isStoreView) {
            socketIdUserIdMap.delete(socket.id)
            storeViewSocketIds = storeViewSocketIds.filter(existingStoreViewSocketId => existingStoreViewSocketId !== socket.id)
            storeViewUserIds = storeViewUserIds.filter(existingStoreViewUserId => existingStoreViewUserId !== storeViewUserId)
        }
    })
})