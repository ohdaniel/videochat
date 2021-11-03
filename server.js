require("dotenv").config()

const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server, {cors: {origin: '*'}, allowEIO3: true})
// const nodeMailer = require('nodemailer')
// const SMTPTransport = require("nodemailer/lib/smtp-transport")
const sendmail = require('sendmail')()

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

let activeSockets = []
let socketIdRoomNumberMap = new Map() //Can probably delete
let storeSocketIds = []
let storeRoomNumbers = []
let storeUserDetails = []
let socketIdUserIdMap = new Map()
let storeViewSocketIds = []
let storeViewUserIds = []

io.on('connection', (socket) => {
    var host = 'localhost';
    // var host = '192.168.86.23';

    const roomNumber = socket.handshake.query['roomNumber']
    const userDetail = socket.handshake.query['userDetail']
    const storeViewUserId = socket.handshake.query['userId']

    socket.on('message', (data) => {
        io.emit('message', data)
        console.log('server.js message')
    })

    socket.emit('socketid', {
        socketid: socket.id,
        roomNumber: roomNumber,
        storeViewUserId: storeViewUserId
    })

    socket.emit('store-view-load', {
        socketid: socket.id,
        roomNumber: roomNumber,
        storeViewUserId: storeViewUserId
    })

    socket.emit('store-load', {
        socketid: socket.id,
        roomNumber: roomNumber
    })

    var isStore = false
    if (roomNumber) {
        isStore = true
    }

    var isStoreView = false
    if (storeViewUserId) {
        isStoreView = true
    }

    var isOverview = !(isStore || isStoreView)

    addToSocketCollections()

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
        const existingSocket = activeSockets.find(existingSocket => existingSocket === data.to)
        if (existingSocket) {
            socket.to(data.to).emit('call-made', {
                offer: data.offer,
                socket: socket.id
            })
        }
        else {
            //TODO: Add pop up if connection doesn't happen
            //TODO: Call happens twice, so first call connects fine but second fails (since the id gets removed after success)
            console.log('Socket doesnt exist: ' + data.to)
        }
    })

    socket.on('make-answer', data => {
        socket.to(data.to).emit('answer-made', {
            socket: socket.id,
            answer: data.answer
        })
    })

    socket.on('make-socket-available', () => {
        addToSocketCollections()
    })

    socket.on('connection-succeeded', () => {
        //clear out socketId collections so that socketId can't be called anymore
        clearOutSocketCollections()
    })

    socket.on('disconnect', () => {
        //clear out socketId collections so that socketId can't be called anymore
        clearOutSocketCollections()
    })

    function addToSocketCollections() {
        const existingSocket = activeSockets.find(existingSocket => existingSocket === socket.id)

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

        if (isStore && !existingRoom) {
            socketIdRoomNumberMap.set(socket.id, roomNumber)
            storeSocketIds.push(socket.id)
            storeRoomNumbers.push(roomNumber)
            storeUserDetails.push(userDetail)

            socket.broadcast.emit('update-room-list', {
                sockets: storeSocketIds,
                rooms: storeRoomNumbers,
                userDetails: storeUserDetails
            })
        }

        const existingStoreViewUser = socketIdUserIdMap.has(socket.id)

        if (isStoreView && !existingStoreViewUser) {
            socketIdUserIdMap.set(socket.id, storeViewUserId)
            storeViewSocketIds.push(socket.id)
            storeViewUserIds.push(storeViewUserId)

            socket.broadcast.emit('update-storeviewers-list', {
                sockets: storeViewSocketIds
            })
        }

        if (isStoreView || isOverview) {
            socket.emit('update-storeviewers-list', {
                sockets: storeViewSocketIds
            })
            
            socket.emit('update-room-list', {
                sockets: storeSocketIds,
                rooms: storeRoomNumbers,
                userDetails: storeUserDetails
            })

            //Send an email right now to keep track of number of storeviewusers and stores open
            emailFeedback('Storeview User Connected', '# of customers: ' + storeViewSocketIds.length + ' # of store rooms available: ' + storeSocketIds.length)
        }
    }

    function clearOutSocketCollections() {
        activeSockets = activeSockets.filter(existingSocket => existingSocket !== socket.id)
    
        socket.broadcast.emit('remove-user', {
            socketId: socket.id
        })
        
        if (isStore) {
            socketIdRoomNumberMap.delete(socket.id)
            var storeSocketIdIndex = storeSocketIds.indexOf(socket.id)
            if (storeSocketIdIndex > -1) {
                storeSocketIds.splice(storeSocketIdIndex, 1)
                storeRoomNumbers.splice(storeSocketIdIndex, 1)
                storeUserDetails.splice(storeSocketIdIndex, 1)
            }
            // storeSocketIds = storeSocketIds.filter(existingSocket => existingSocket !== socket.id)
            // storeRoomNumbers = storeRoomNumbers.filter(existingSocket => existingSocket !== roomNumber)
            socket.broadcast.emit('remove-room', {
                roomNumber: socket.id
            })
        }

        if (isStoreView) {
            socketIdUserIdMap.delete(socket.id)
            storeViewSocketIds = storeViewSocketIds.filter(existingStoreViewSocketId => existingStoreViewSocketId !== socket.id)
            storeViewUserIds = storeViewUserIds.filter(existingStoreViewUserId => existingStoreViewUserId !== storeViewUserId)

            socket.broadcast.emit('update-storeviewers-list', {
                sockets: storeViewSocketIds
            })
        }
    }
    
    socket.on('email-feedback', data => {
        emailFeedback(data.subject, data.feedback)
    })

    function emailFeedback(emailSubject, emailBody) {
        // const transporter = nodeMailer.createTransport({
        //     host: 'localhost',
        //     port: 465,
        //     secure: true,
        //     auth: {}
        // })

        // const transporter = nodeMailer.createTransport(new SMTPTransport ({
        //     name: 'localhost',
        //     host: 'smtp.ethereal.email',
        //     port: 587,
        //     auth: {
        //         user: 'tina.schulist87@ethereal.email',
        //         pass: 'CDdfUfGcvzpCJyjkGJ'
        //     }
        // }))
    
        // var mailOptions = {
        //     // from: 'ohdaniel629@gmail.com',
        //     to: 'ohdaniel629@gmail.com',
        //     subject: 'Test email survey',
        //     text: 'Good job'
        // }
    
        // transporter.sendMail(mailOptions, function(error) {
        //     if (error) {
        //         console.log(error)
        //     }
        // })

        sendmail({
            from: 'noreply@mail.com',
            to: 'ohdaniel629@gmail.com',
            subject: emailSubject,
            html: emailBody
        }, function (error, reply) {
            console.log(error && error.stack)
            console.log(reply)
        })
    }
})