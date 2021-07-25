const roomNumber = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "roomNumber=" + roomNumber})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

var myStream

let isAlreadyCalling = false

document.title = `Store Room ${roomNumber}`

//Start video and display on own screen
navigator.mediaDevices.getUserMedia({
    video: true, audio: true
}).then(function (stream) {
    const localVideo = document.getElementById('local-video')
    if (localVideo) {
        localVideo.srcObject = stream
    }
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
    const remoteVideo = document.getElementById('remote-video')
    if (remoteVideo) {
        remoteVideo.srcObject = stream
        document.getElementById('call-store-view-user-container').style.display = 'none'
    }
}

socket.on('store-load', data => {
    const userInfo = document.getElementById('store-info')
    userInfo.innerHTML = `Hello ${data.socketid}, welcome to room ${data.roomNumber}`
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