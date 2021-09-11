const userId = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "userId=" + userId})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

var myStream
var currentRoomNumber = null

let isAlreadyCalling = false

document.title = `Store View User ${userId}`

let menuButtonSelected = false
const menu = document.getElementById('menu')
const menuButton = document.querySelector('.menu-button')
const informationDiv = document.getElementById('information')
menuButton.addEventListener('click', () => {
    if(!menuButtonSelected) {
        menuButton.classList.add('selected')
        menu.style.width = '100%'
        informationDiv.style.display = 'inline-block'
        menuButtonSelected = true
    }
    else {
        menuButton.classList.remove('selected')
        menu.style.width = '31px'
        informationDiv.style.display = 'none'
        menuButtonSelected = false
    }
})

//Start video and display on own screen
navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        const cams = devices.filter(device => device.kind == 'videoinput')
        const mics = devices.filter(device => device.kind == 'audioinput')

        const mediaConstraints = { video: cams.length > 0, audio: mics.length > 0}

        return navigator.mediaDevices.getUserMedia(mediaConstraints)
    })
        .then(function (stream) {
            const localVideo = document.getElementById('local-video')
            if (localVideo) {
                localVideo.srcObject = stream
            }

            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))

            myStream = stream

            var vid = stream.getVideoTracks()[0]
            var vidEnabled = vid && vid.enabled
            var mic = stream.getAudioTracks()[0]
            var micEnabled = mic && mic.enabled
            var vidButton = document.getElementById('vidButton')
            var micButton = document.getElementById('micButton')
            var vidIcon = document.getElementById('vidIcon')
            var micIcon = document.getElementById('micIcon')
            if (vidEnabled) {
                vidButton.classList.replace('buttonDisabled', 'buttonEnabled')
                vidIcon.innerHTML = 'videocam'
            }
            else {
                vidButton.classList.replace('buttonEnabled', 'buttonDisabled')
                vidIcon.innerHTML = 'videocam_off'
            }
            
            if (micEnabled) {
                micButton.classList.replace('buttonDisabled', 'buttonEnabled')
                micIcon.innerHTML = 'mic'
            }
            else {
                micButton.classList.replace('buttonEnabled', 'buttonDisabled')
                micIcon.innerHTML = 'mic_off'
            }
        }).catch(function(error) {
            console.warn(error)
        })

peerConnection.ontrack = function({ streams: [stream] }) {
    const remoteVideo = document.getElementById('remote-video')
    if (remoteVideo) {
        remoteVideo.srcObject = stream
    }
}

peerConnection.oniceconnectionstatechange = function() {
    console.log('peerConnection.oniceconnectionstatechange')
    var iceConnectionState = peerConnection.iceConnectionState
    console.log(iceConnectionState)

    if (iceConnectionState == 'connected') {
        //Clean out all possibilities of being connected to anyone else
        if (currentRoomNumber) {
            document.title = `Store View Room ${currentRoomNumber}`
        }
        document.getElementById('active-room-container').style.display = 'none'
        socket.emit('connection-succeeded', {})
    }
    if (iceConnectionState == 'disconnected') {
        //Clear out traces of old connection and setup screen to be able to connect to someone again
        document.getElementById('remote-video').srcObject = null
        currentRoomNumber = null
        document.title = `Store View User ${userId}`
        document.getElementById('active-room-container').style.display = 'block'

        //Make user available again
        socket.emit('make-socket-available', {})
    }
}

socket.on('store-view-load', data => {
    const userInfo = document.getElementById('user-info')
    userInfo.innerHTML = `User ID: ${data.storeViewUserId}, Socket ID: ${data.socketid}`
})

socket.on('update-room-list', ({ sockets, rooms }) => {
    updateRoomList(sockets, rooms)
})

function updateRoomList(sockets, rooms) {
    const activeUserContainer = document.getElementById('active-room-container')

    for (var i = 0; i < sockets.length; i++) {
        const alreadyExistingRoom = document.getElementById(sockets[i])
        if(!alreadyExistingRoom) {
            const userContainerElement = createRoomItemContainer(sockets[i], rooms[i])
            activeUserContainer.appendChild(userContainerElement)
        }
    }
}

function createRoomItemContainer(socketId, roomNumber) {
    const userContainerElement = document.createElement('div')
    const userIconElement = document.createElement('i')
    const usernameElement = document.createElement('span')

    userContainerElement.setAttribute('class', 'active-room')
    userContainerElement.setAttribute('id', socketId)
    userIconElement.setAttribute('class','material-icons phone')
    userIconElement.innerHTML = 'call'
    // usernameElement.setAttribute('class', 'username')
    usernameElement.innerHTML = ` Room Number: ${roomNumber} (${socketId})`

    userContainerElement.append(userIconElement)
    userContainerElement.append(usernameElement)

    userContainerElement.addEventListener('click', () => {
        unselectRoomsFromList();
        userContainerElement.setAttribute('class', 'active-room active-room--selected')
        currentRoomNumber = roomNumber
        callUser(socketId)
    })

    return userContainerElement
}

function unselectRoomsFromList() {
    const alreadySelectedRoom = document.querySelectorAll('.active-room.active-room--selected')
    alreadySelectedRoom.forEach(selectedRoom => selectedRoom.setAttribute('class','active-room'))
}

socket.on('remove-room', ({ roomNumber }) => {
    const elementToRemove = document.getElementById(roomNumber)

    if (elementToRemove) {
        elementToRemove.remove()
    }
})

async function callUser(socketId) {
    var offerConstraints = { offerToReceiveAudio: true, offerToReceiveVideo: true } //In the event the current screen doesn't have either video or audio, will always accept video and audio from user called
    const offer = await peerConnection.createOffer(offerConstraints)
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))
    socket.emit('call-user', {
        offer,
        to: socketId
    })
}

socket.on('call-made', async data => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer))

    socket.emit('make-answer', {
        answer,
        to: data.socket
    })
})

socket.on('answer-made', async data => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))

    if (!isAlreadyCalling) {
        callUser(data.socket)
        isAlreadyCalling = true
    }
})

const vidButton = document.getElementById('vidButton')
vidButton.addEventListener('click', () => {
    var vid = myStream.getVideoTracks()[0]

    if (vid || vid === false) {
        vid.enabled = !vid.enabled //opposite of what it was before the click
        var vidEnabled = vid.enabled
        var vidButton = document.getElementById('vidButton')
        var vidIcon = document.getElementById('vidIcon')
        if (vidEnabled) {
            vidButton.classList.replace('buttonDisabled', 'buttonEnabled')
            vidIcon.innerHTML = 'videocam'
        }
        else {
            vidButton.classList.replace('buttonEnabled', 'buttonDisabled')
            vidIcon.innerHTML = 'videocam_off'
        }
    }
})

const micButton = document.getElementById('micButton')
micButton.addEventListener('click', () => {
    var mic = myStream.getAudioTracks()[0]
    if (mic || mic === false) {
        mic.enabled = !mic.enabled //opposite of what it was before the click
        var micEnabled = mic.enabled
        var micButton = document.getElementById('micButton')
        var micIcon = document.getElementById('micIcon')
        if (micEnabled) {
            micButton.classList.replace('buttonDisabled', 'buttonEnabled')
            micIcon.innerHTML = 'mic'
        }
        else {
            micButton.classList.replace('buttonEnabled', 'buttonDisabled')
            micIcon.innerHTML = 'mic_off'
        }
    }
})

const swapButton = document.getElementById('swapButton')
swapButton.addEventListener('click', () => {
    var localClass = document.getElementById('local-video').className;
    var remoteClass = document.getElementById('remote-video').className;
    document.getElementById('local-video').className = remoteClass;
    document.getElementById('remote-video').className = localClass;
})