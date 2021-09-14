const roomNumber = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "roomNumber=" + roomNumber})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

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

if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices()) {
    const userInfo = document.getElementById('store-info')
    userInfo.innerHTML = 'This browser is not supported'
}

var cameraMode = 'environment' //Store starts off showing the back of the camera if there is one
var camsAvailable
var micsAvailable
var mediaConstraints
var cameraSelected = ''

//Start video and display on own screen
navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        camsAvailable = devices.filter(device => device.kind == 'videoinput')
        micsAvailable = devices.filter(device => device.kind == 'audioinput')

        // //call getUserMedia once to ensure a full list of all video and audio devices
        // mediaConstraints = { video: camsAvailable.length > 0, audio: micsAvailable.length > 0}

        // console.log('total cameras: ' + camsAvailable.length)
        // camsAvailable.forEach(camera => {
        //     console.log(camera)
        // })

        //Initially use back camera if available
        if (camsAvailable.length > 0) {
            mediaConstraints = {
                video: {
                    facingMode: {
                        exact: cameraMode
                    }
                }, audio: micsAvailable.length > 0}
        }
        else {
            mediaConstraints = { video: false, audio: micsAvailable.length > 0}
        }

        return navigator.mediaDevices.getUserMedia(mediaConstraints)
    })
        .then((stream) => {
            initializeMediaDevices(stream)
        }).catch(function(error) {
            console.warn(error)

            if (error.name === 'OverconstrainedError') {
                const mediaConstraints = { video: camsAvailable.length > 0, audio: micsAvailable.length > 0}
                navigator.mediaDevices.getUserMedia(mediaConstraints)
                    .then((finalStream) => {
                        initializeMediaDevices(finalStream)
                    }).catch(function(error) {
                        console.warn(error)
                    })
            }
        })

function initializeMediaDevices(stream) {
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

    return navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
        setupCameraList(devices)
    })
}

function setupCameraList(devices) {
    //Ensure we have latest list of devices (necessary when asking for permission as we have empty results beforehand)
    camsAvailable = devices.filter(device => device.kind == 'videoinput')
    micsAvailable = devices.filter(device => device.kind == 'audioinput')

    const cameraOptions = document.getElementById('cam-select')
    //Wipe out list to ensure no duplicates
    while (cameraOptions.firstChild) {
        cameraOptions.removeChild(cameraOptions.firstChild)
    }

    if (myStream.getVideoTracks()[0]) {
        cameraSelected = myStream.getVideoTracks()[0].getSettings().deviceId
    }

    if (camsAvailable.length == 0) {
        var noCameraOption = document.createElement('option')
        noCameraOption.value = ''
        noCameraOption.innerHTML = 'No Camera'
        cameraOptions.appendChild(noCameraOption)
    }

    camsAvailable.forEach(camera => {
        var camOption = document.createElement('option')
        camOption.value = camera.deviceId
        camOption.innerHTML = camera.label
        if (camera.deviceId === cameraSelected) {
            camOption.setAttribute('selected', 'selected')
        }
        cameraOptions.appendChild(camOption)
    })

    //If mobile device with exactly two cameras, have ability to swap between front and back camera
    if (isMobile && camsAvailable.length == 2) {
        document.getElementById('cameraSwapButton').style.display = 'inline-block'
    }
}

console.log("Notification:")
console.log('Notification' in window)
//Attempt to get permission to send notifications when someone joins room.
if ('Notification' in window) {
    if (Notification.permission === 'granted') {
        console.log('Notification permission already granted!')
        document.getElementById('notificationIcon').innerHTML = 'notifications_active'
    }
    else {
        Notification.requestPermission().then(function(result) {
            if (result === 'granted') {
                document.getElementById('notificationIcon').innerHTML = 'notifications_active'
            }
            else {
                alert('Please allow notifications if you want to be alerted when someone joins your room')
                document.getElementById('notificationIcon').innerHTML = 'notifications_off'
            }
        })
    }
}
else {
    console.log('Notification is not supported')
}

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

        if (isMobile) {
            zoomOutMobile();
        }

        //Notify store that someone connected if tab isn't active
        if (Notification.permission === 'granted') {
            if (document.visibilityState === 'hidden') {
                navigator.serviceWorker.register('sw.js')
                navigator.serviceWorker.ready.then(function (registration) {
                    registration.showNotification('Video Chat', {
                    body: 'Someone joined your room!',
                    icon: './img/call_received.png',
                    vibrate: [200, 100, 200, 100, 200, 100, 200],
                    tag: 'vibration-sample',
                    })
                })
            }
        }
        
        console.log('End of connect success')
    }
    if (iceConnectionState == 'disconnected') {
        //Clear out traces of old connection and setup screen to be able to connect to someone again
        document.getElementById('remote-video').srcObject = null
        document.getElementById('call-store-view-user-container').style.display = 'block'

        //Make room available again
        socket.emit('make-socket-available', {})
    }
}
console.log(document.querySelector('meta[name="viewport"]').content)
function zoomOutMobile() {
    var viewport = document.querySelector('meta[name="viewport"]')
    console.log(viewport.content)

    if (viewport) {
        viewport.content = "width=device-width";
        viewport.content = "initial-scale=0";
    }
    console.log(viewport.content)
}

socket.on('store-load', data => {
    const userInfo = document.getElementById('store-info')
    userInfo.innerHTML = `Room Number: ${data.roomNumber}, Socket ID: ${data.socketid}`
})

async function callStoreViewUser(storeViewUserId) {
    var offerConstraints = { offerToReceiveAudio: true, offerToReceiveVideo: true } //In the event the current screen doesn't have either video or audio, will always accept video and audio from user called
    const offer = await peerConnection.createOffer(offerConstraints)
    await peerConnection.setLocalDescription(new RTCSessionDescription(offer))

    socket.emit('call-store-view-user-id', {
        offer,
        storeViewUserId: storeViewUserId
    })
}

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

const callStoreViewUserButton = document.getElementById('callStoreViewUserButton')
callStoreViewUserButton.addEventListener('click', () => {
    const inputtedStoreViewUserId = document.getElementById('store-view-user-id').value
    callStoreViewUser(inputtedStoreViewUserId)
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

const cameraSwapButton = document.getElementById('cameraSwapButton')
cameraSwapButton.addEventListener('click', () => {
    console.log("old deviceid: " + myStream.getVideoTracks()[0].id)
    console.log(camsAvailable.length)
    var otherCamera = camsAvailable.filter(device => device.deviceId != myStream.getVideoTracks()[0].id)
    console.log("new deviceid: " + otherCamera.deviceId)
    changeCamera(otherCamera.deviceId)
})

function changeCamera(cameraDeviceId) {
    if (cameraDeviceId === '') {
        mediaConstraints = { video: false, audio: micsAvailable.length > 0}
    }
    else {
        mediaConstraints = {
            video: {
                deviceId: cameraDeviceId
            }, audio: micsAvailable.length > 0}
    }

    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(function (stream) {
        const localVideo = document.getElementById('local-video')
        if (localVideo) {
            localVideo.srcObject = stream
        }
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))

        myStream = stream

        var videoTrack = stream.getVideoTracks()[0]
        var sender = peerConnection.getSenders().find(function(rtcRtpSender) {
            return rtcRtpSender.track.kind == 'video' //videoTrack.kind
        })
        sender.replaceTrack(videoTrack)

    }).catch(function(error) {
        console.warn(error)
    })
}

const swapButton = document.getElementById('swapButton')
swapButton.addEventListener('click', () => {
    var localClass = document.getElementById('local-video').className;
    var remoteClass = document.getElementById('remote-video').className;
    document.getElementById('local-video').className = remoteClass;
    document.getElementById('remote-video').className = localClass;
})