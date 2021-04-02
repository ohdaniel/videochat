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
const path = require('path');
if (process.env.PROD) {
    app.use(express.static(path.join(__dirname, './app')))
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, './app/home.html'))
    })
}

const port = process.env.PORT || 3001
server.listen(port, () => {
    console.log('Server started...')
})

// console.log('__dirname:' + __dirname)

let activeSockets = []

io.on('connection', (socket) => {
    var host = 'localhost';
    // var host = '192.168.86.23';

    console.log('Connected on Socket ID: ' + socket.id)

    socket.on('message', (data) => {
        // socket.broadcast.emit('message', data)
        io.emit('message', data)
        console.log('server.js message')
    })

    console.log('connection begin activeSockets:' + activeSockets)
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

    console.log('connection end activeSockets: ' + activeSockets)

    socket.on('call-user', data => {
        console.log('call-user')
        socket.to(data.to).emit('call-made', {
            offer: data.offer,
            socket: socket.id
        })
    })

    socket.on('make-answer', data => {
        console.log('make-answer')
        socket.to(data.to).emit('answer-made', {
            socket: socket.id,
            answer: data.answer
        })
    })

    socket.on('disconnect', () => {
        console.log('disconnection begin activeSockets: ' + activeSockets)
        activeSockets = activeSockets.filter(existingSocket => existingSocket !== socket.id)
    
        socket.broadcast.emit('remove-user', {
            socketId: socket.id
        })
        console.log('disconnection end activeSockets: ' + activeSockets)
    })
})


