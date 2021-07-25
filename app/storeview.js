const userId = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "userId=" + userId})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

var myStream

let isAlreadyCalling = false

document.title = `Store View User ${userId}`

//Start video and display on own screen
navigator.mediaDevices.getUserMedia({
    video: true, audio: true
}).then(function (stream) {
    const localVideo = document.getElementById('local-video')
    if (localVideo) {
        localVideo.srcObject = stream
    }

    console.log(peerConnection)
    stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))

    myStream = stream
    const vidEnabled = stream.getVideoTracks()[0].enabled
    const micEnabled = stream.getVideoTracks()[0].enabled
    var vidButton = document.getElementById('vidButton')
    var micButton = document.getElementById('micButton')
    if (vidEnabled) {
        vidButton.className = vidButton.className + ' buttonEnabled'
    }
    else {
        vidButton.className = vidButton.className + ' buttonDisabled'
    }
    
    if (micEnabled) {
        micButton.className = micButton.className + ' buttonEnabled'
    }
    else {
        micButton.className = micButton.className + ' buttonDisabled'
    }
}).catch(function(error) {
    console.warn(error)
})

peerConnection.ontrack = function({ streams: [stream] }) {
    console.log(peerConnection.onTrack)
    const remoteVideo = document.getElementById('remote-video')
    if (remoteVideo) {
        remoteVideo.srcObject = stream
        document.getElementById('active-room-container').style.display = 'none'
    }
}

socket.on('socketid', data => {
    console.log(data)
    const userInfo = document.getElementById('user-info')
    userInfo.innerHTML = `Socket ID: ${data.socketid}, User ID: ${data.storeViewUserId}`
})

socket.on('update-room-list', ({ sockets, rooms }) => {
    console.log('socket.on(updateRoomList)')
    console.log(sockets)
    console.log(rooms)
    updateRoomList(sockets, rooms)
})

function updateRoomList(sockets, rooms) {
    console.log('updateRoomList')
    console.log(rooms)
    const activeUserContainer = document.getElementById('active-room-container')

    for (var i = 0; i < sockets.length; i++) {
        console.log('key:' +sockets[i]+" value:" + rooms[i])
        const alreadyExistingRoom = document.getElementById(sockets[i])
        if(!alreadyExistingRoom) {
            const userContainerElement = createRoomItemContainer(sockets[i], rooms[i])
            activeUserContainer.appendChild(userContainerElement)
        }
    }
}

function createRoomItemContainer(socketId, roomNumber) {
    console.log('createRoomItemContainer')
    const userContainerElement = document.createElement('div')
    const usernameElement = document.createElement('p')

    userContainerElement.setAttribute('class', 'active-room')
    userContainerElement.setAttribute('id', socketId)
    usernameElement.setAttribute('class', 'username')
    usernameElement.innerHTML = `Room Number: ${roomNumber} (${socketId})`

    userContainerElement.append(usernameElement)

    userContainerElement.addEventListener('click', () => {
        unselectRoomsFromList();
        userContainerElement.setAttribute('class', 'active-room active-room--selected')
        document.title = `Store View Room ${roomNumber}`
        callUser(socketId)
    })

    return userContainerElement
}

function unselectRoomsFromList() {
    console.log('unselectRoomsFromList')
    const alreadySelectedRoom = document.querySelectorAll('.active-room.active-room--selected')
    alreadySelectedRoom.forEach(selectedRoom => selectedRoom.setAttribute('class','active-room'))
}

socket.on('remove-room', ({ roomNumber }) => {
    console.log('remove-room')
    console.log(roomNumber)
    
    const elementToRemove = document.getElementById(roomNumber)

    if (elementToRemove) {
        elementToRemove.remove()
    }
})

async function callUser(socketId) {
    console.log('callUser: ' + socketId)
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))

    socket.emit('call-user', {
        offer,
        to: socketId
    })
}

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

    console.log('isAlreadyCalling:' + isAlreadyCalling)
    if (!isAlreadyCalling) {
        callUser(data.socket)
        isAlreadyCalling = true
    }
})

const vidButton = document.getElementById('vidButton')
vidButton.addEventListener('click', () => {
    myStream.getVideoTracks()[0].enabled = !(myStream.getVideoTracks()[0].enabled)
    
    const vidEnabled = myStream.getVideoTracks()[0].enabled
    var vidButton = document.getElementById('vidButton')
    if (vidEnabled) {
        vidButton.setAttribute('class', 'button buttonEnabled')
    }
    else {
        vidButton.setAttribute('class', 'button buttonDisabled')
    }
})

const micButton = document.getElementById('micButton')
micButton.addEventListener('click', () => {
    myStream.getAudioTracks()[0].enabled = !(myStream.getAudioTracks()[0].enabled)

    const micEnabled = myStream.getAudioTracks()[0].enabled
    var micButton = document.getElementById('micButton')
    if (micEnabled) {
        micButton.setAttribute('class', 'button buttonEnabled')
    }
    else {
        micButton.setAttribute('class', 'button buttonDisabled')
    }
})

const swapButton = document.getElementById('swapButton')
swapButton.addEventListener('click', () => {
    var localClass = document.getElementById('local-video').className;
    var remoteClass = document.getElementById('remote-video').className;
    document.getElementById('local-video').className = remoteClass;
    document.getElementById('remote-video').className = localClass;
})