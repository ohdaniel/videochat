const socket = io('http://localhost:3001')
// const socket = io('http://192.168.86.23:3001')

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

let isAlreadyCalling = false

//Start video and display on own screen
navigator.mediaDevices.getUserMedia({
    video: true, audio: false
}).then(function (stream) {
    const localVideo = document.getElementById('local-video')
    if (localVideo) {
        localVideo.srcObject = stream
    }

    console.log(peerConnection)
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))
}).catch(function(error) {
    console.warn(error)
})

peerConnection.ontrack = function({ streams: [stream] }) {
    console.log(peerConnection.onTrack)
    const remoteVideo = document.getElementById('remote-video')
    if (remoteVideo) {
        remoteVideo.srcObject = stream
    }
}

socket.on('update-user-list', ({ users }) => {
    console.log('socket.on(updateUserList)')
    updateUserList(users)
})

function updateUserList(socketIds) {
    console.log('updateUserList')
    const activeUserContainer = document.getElementById('active-user-container')

    Array.prototype.forEach.call(socketIds, socketId => {
        const alreadyExistingUser = document.getElementById(socketId)
        if(!alreadyExistingUser) {
            const userContainerElement = createUserItemContainer(socketId)
            activeUserContainer.appendChild(userContainerElement)
        }
    })
}

function createUserItemContainer(socketId) {
    console.log('createUserItemContainer')
    const userContainerElement = document.createElement('div')
    const usernameElement = document.createElement('p')

    userContainerElement.setAttribute('class', 'active-user')
    userContainerElement.setAttribute('id', socketId)
    usernameElement.setAttribute('class', 'username')
    usernameElement.innerHTML = `Socket: ${socketId}`

    userContainerElement.append(usernameElement)

    userContainerElement.addEventListener('click', () => {
        unselectUsersFromList();
        userContainerElement.setAttribute('class', 'active-user active-user--selected')
        const talkingWithInfo = document.getElementById('talking-with-info')
        talkingWithInfo.innerHTML = `Talking with: "Socket: ${socketId}`
        callUser(socketId)
    })

    return userContainerElement
}

function unselectUsersFromList() {
    console.log('unselectUsersFromList')
    const alreadySelectedUser = document.querySelectorAll('.active-user.active-user--selected')
}

async function callUser(socketId) {
    console.log('callUser: ' + socketId)
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))

    socket.emit('call-user', {
        offer,
        to: socketId
    })
}

socket.on('remove-user', ({ socketId }) => {
    console.log('remove-user')
    console.log(socketId)
    
    const elementToRemove = document.getElementById(socketId)

    if (elementToRemove) {
        elementToRemove.remove()
    }
})

socket.on('call-made', async data => {
    console.log('call-made')
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer))

    socket.emit('make-answer', {
        answer,
        to: data.socket
    })
})

socket.on('answer-made', async data => {
    console.log('answer-made')
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))

    if (!isAlreadyCalling) {
        callUser(data.socket)
        isAlreadyCalling = true
    }
})