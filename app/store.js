const roomNumber = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "roomNumber=" + roomNumber})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

var myStream

let isAlreadyCalling = false

document.title = `Store Room ${roomNumber}`

let menuButtonSelected = false
const menu = document.getElementById('menu')
const menuButton = document.querySelector('.menu-button')
const informationDiv = document.getElementById('information')
menuButton.addEventListener('click', () => {
    if(!menuButtonSelected) {
        menuButton.classList.add('selected')
        menu.style.width = '100%'
        informationDiv.style.display = 'block'
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
                vidButton.className = vidButton.className + ' buttonEnabled'
                vidIcon.innerHTML = 'videocam'
            }
            else {
                vidButton.className = vidButton.className + ' buttonDisabled'
                vidIcon.innerHTML = 'videocam_off'
            }

            if (micEnabled) {
                micButton.className = micButton.className + ' buttonEnabled'
                micIcon.innerHTML = 'mic'
            }
            else {
                micButton.className = micButton.className + ' buttonDisabled'
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
        document.getElementById('call-store-view-user-container').style.display = 'none'
        socket.emit('connection-succeeded', {})
    }
    if (iceConnectionState == 'disconnected') {
        //Clear out traces of old connection and setup screen to be able to connect to someone again
        document.getElementById('remote-video').srcObject = null
        document.getElementById('call-store-view-user-container').style.display = 'block'

        //Make room available again
        socket.emit('make-socket-available', {})
    }
}

socket.on('store-load', data => {
    const userInfo = document.getElementById('store-info')
    userInfo.innerHTML = userInfo.innerHTML + `Room Number: ${data.roomNumber}, Socket ID: ${data.socketid}`
})

async function callStoreViewUser(storeViewUserId) {
    const offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))

    socket.emit('call-store-view-user-id', {
        offer,
        storeViewUserId: storeViewUserId
    })
}

async function callUser(socketId) {
    const offer = await peerConnection.createOffer()
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

const callStoreViewUserButton = document.getElementById('callStoreViewUserButton')
callStoreViewUserButton.addEventListener('click', () => {
    const inputtedStoreViewUserId = document.getElementById('store-view-user-id').value
    callStoreViewUser(inputtedStoreViewUserId)
})

const vidButton = document.getElementById('vidButton')
vidButton.addEventListener('click', () => {
    myStream.getVideoTracks()[0].enabled = !(myStream.getVideoTracks()[0].enabled)
    
    var vid = myStream.getVideoTracks()[0]
    var vidEnabled = vid && vid.enabled
    var vidButton = document.getElementById('vidButton')
    var vidIcon = document.getElementById('vidIcon')
    if (vidEnabled) {
        vidButton.setAttribute('class', 'button buttonEnabled')
        vidIcon.innerHTML = 'videocam'
    }
    else {
        vidButton.setAttribute('class', 'button buttonDisabled')
        vidIcon.innerHTML = 'videocam_off'
    }
})

const micButton = document.getElementById('micButton')
micButton.addEventListener('click', () => {
    myStream.getAudioTracks()[0].enabled = !(myStream.getAudioTracks()[0].enabled)

    var mic = myStream.getAudioTracks()[0]
    var micEnabled = mic && mic.enabled
    var micButton = document.getElementById('micButton')
    var micIcon = document.getElementById('micIcon')
    if (micEnabled) {
        micButton.setAttribute('class', 'button buttonEnabled')
        micIcon.innerHTML = 'mic'
    }
    else {
        micButton.setAttribute('class', 'button buttonDisabled')
        micIcon.innerHTML = 'mic_off'
    }
})

const swapButton = document.getElementById('swapButton')
swapButton.addEventListener('click', () => {
    var localClass = document.getElementById('local-video').className;
    var remoteClass = document.getElementById('remote-video').className;
    document.getElementById('local-video').className = remoteClass;
    document.getElementById('remote-video').className = localClass;
})