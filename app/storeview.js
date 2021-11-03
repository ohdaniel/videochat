const userId = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "userId=" + userId})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
// var peerConnection = new RTCPeerConnection(configuration)
var peerConnection = null

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

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

var cams
var mics
var mediaConstraints
var cameraSelected = ''

var isAlertOn = false //default false, need user action in order to play audio on mobile
var iceConnectionSucceededSound = new Audio('./audio/glass_drop_and_roll.mp3')
iceConnectionSucceededSound.volume = 0.0
var iceConnectionDisconnectedSound = new Audio('./audio/screen_door_close.mp3')
iceConnectionDisconnectedSound.volume = 0.0

//Start video and display on own screen
navigator.mediaDevices.enumerateDevices()
    .then(devices => {
        cams = devices.filter(device => device.kind == 'videoinput')
        mics = devices.filter(device => device.kind == 'audioinput')

        mediaConstraints = { video: cams.length > 0, audio: mics.length > 0}

        return navigator.mediaDevices.getUserMedia(mediaConstraints)
    })
        .then(function (stream) {
            const localVideo = document.getElementById('local-video')
            if (localVideo) {
                localVideo.srcObject = stream
            }

            // stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))

            myStream = stream

            initializePeerConnection()

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
                console.log("isMobile: " + isMobile)
                console.log("initial cams.length: " + cams.length)
                console.log("devices.length: " + devices.length)
                cams = devices.filter(device => device.kind == 'videoinput')
                console.log("new cams.length: " + cams.length)
                //If mobile device with exactly two cameras, have ability to swap between front and back camera
                if (isMobile && cams.length === 2) {
                    document.getElementById('cameraSwapButton').style.display = 'inline-block'
                }
            })
        }).catch(function(error) {
            console.warn(error)
        })

function initializePeerConnection() {
    peerConnection = new RTCPeerConnection(configuration)

    if (myStream) {
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream))
    }
    peerConnection.ontrack = function({ streams: [stream] }) {
        peerConnectionOnTrack({ streams: [stream] })
    }

    peerConnection.oniceconnectionstatechange = function() {
        peerConnectionOnIceConnectionStateChange()
    }
}

function recreatePeerConnection() {
    peerConnection.close()
    initializePeerConnection()
}

function peerConnectionOnTrack({ streams: [stream] }) {
    const remoteVideo = document.getElementById('remote-video')
    if (remoteVideo) {
        remoteVideo.srcObject = stream
    }
}

function peerConnectionOnIceConnectionStateChange() {
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

        if (isAlertOn) {
            iceConnectionSucceededSound.play()
        }

        // document.getElementById('feedback-container').style.opacity = 0
        document.getElementById('feedback-container').style.display = 'none'
    }
    if (iceConnectionState == 'disconnected') {
        cleanUpConnection()

        if (isAlertOn) {
            iceConnectionDisconnectedSound.play()
        }
    }
}

function cleanUpConnection() {
    document.getElementById('remote-video').srcObject = null
    currentRoomNumber = null
    document.title = `Store View User ${userId}`
    document.getElementById('active-room-container').style.display = 'block'
    isAlreadyCalling = false

    //Make user available again
    socket.emit('make-socket-available', {})

    if (isAlertOn) {
        iceConnectionDisconnectedSound.play()
    }

    // document.getElementById('feedback-container').style.opacity = 1
    document.getElementById('feedback-container').style.display = 'inline-block'

    recreatePeerConnection()
}

socket.on('store-view-load', data => {
    const userInfo = document.getElementById('user-info')
    userInfo.innerHTML = `User ID: ${data.storeViewUserId}` //`, Socket ID: ${data.socketid}`
})

socket.on('update-room-list', ({ sockets, rooms, userDetails }) => {
    updateRoomList(sockets, rooms, userDetails)
})

function updateRoomList(sockets, rooms, userDetails) {
    if (sockets.length > 0) {
        deleteEmptyRoomDiv()
    }

    const activeUserContainer = document.getElementById('active-room-container')

    for (var i = 0; i < sockets.length; i++) {
        const alreadyExistingRoom = document.getElementById(sockets[i])
        if(!alreadyExistingRoom) {
            const userContainerElement = createRoomItemContainer(sockets[i], rooms[i], userDetails[i])

            //Add new room sorted
            var activeRoomElements = Array.prototype.slice.call(activeUserContainer.getElementsByTagName('div'))
            var beforeRoomElement = activeRoomElements.find(function(roomElement) {
                return roomElement.innerHTML > userContainerElement.innerHTML
            })
            activeUserContainer.insertBefore(userContainerElement, beforeRoomElement)
        }
    }
}

function createRoomItemContainer(socketId, roomNumber, userDetail) {
    const userContainerElement = document.createElement('div')
    const callbuttonElement = document.createElement('button')
    const userIconElement = document.createElement('i')
    const usernameElement = document.createElement('span')

    userContainerElement.setAttribute('class', 'active-room')
    userContainerElement.setAttribute('id', socketId)
    callbuttonElement.setAttribute('class','button buttonEnabled')
    userIconElement.setAttribute('class','material-icons md-20')
    userIconElement.innerHTML = 'call'
    usernameElement.innerHTML = ` ${userDetail} [Room ${roomNumber}]`

    callbuttonElement.append(userIconElement)
    userContainerElement.append(callbuttonElement)
    userContainerElement.append(usernameElement)

    callbuttonElement.addEventListener('click', () => {
        unselectRoomsFromList();
        // userContainerElement.setAttribute('class', 'active-room active-room--selected')
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

    if (document.querySelectorAll('.active-room').length == 0) {
        addEmptyRoomDiv()
    }
})

function addEmptyRoomDiv() {
    const activeUserContainer = document.getElementById('active-room-container')

    const userContainerElement = document.createElement('div')
    const userIconElement = document.createElement('i')
    const usernameElement = document.createElement('span')

    userContainerElement.setAttribute('class', 'active-room')
    userContainerElement.setAttribute('id', 'emptyRoom')
    userIconElement.setAttribute('class','material-icons sad-face')
    userIconElement.innerHTML = 'mood_bad'
    usernameElement.innerHTML = ' No one is available, please call for service'

    userContainerElement.append(userIconElement)
    userContainerElement.append(usernameElement)
    activeUserContainer.append(userContainerElement)
}

function deleteEmptyRoomDiv() {
    const emptyRoom = document.getElementById('emptyRoom')
    if (emptyRoom) {
        emptyRoom.remove()
    }
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

const alertIcon = document.getElementById('alertIcon')
alertIcon.addEventListener('click', () => {    
    iceConnectionSucceededSound.play().then(() => iceConnectionSucceededSound.pause())
    iceConnectionDisconnectedSound.play().then(() => iceConnectionDisconnectedSound.pause())

    isAlertOn = !isAlertOn

    if (isAlertOn) {
        iceConnectionSucceededSound.volume = 1.0
        iceConnectionDisconnectedSound.volume = 1.0
        alertIcon.innerHTML = 'notifications_active'
    }
    else {
        iceConnectionSucceededSound.volume = 0.0
        iceConnectionDisconnectedSound.volume = 0.0
        alertIcon.innerHTML = 'notifications_off'
    }
})

const reviewIcon = document.getElementById('reviewIcon')
reviewIcon.addEventListener('click', () => {
    // document.getElementById('feedback-container').style.opacity = 1
    document.getElementById('feedback-container').style.display = 'inline-block'
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
    otherCamera = cams.filter(device => device.deviceId !== myStream.getVideoTracks()[0])
    changeCamera(otherCamera.deviceId)
})

function changeCamera(cameraDeviceId) {
    mediaConstraints = {
        video: {
            deviceId: cameraDeviceId
        }, audio: micsAvailable.length > 0}

    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(function (stream) {
        const localVideo = document.getElementById('local-video')
        if (localVideo) {
            localVideo.srcObject = stream
        }
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream))

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

const endCallButton = document.getElementById('endCallButton')
endCallButton.addEventListener('click', () => { 
    cleanUpConnection()
})

const sendFeedbackButton = document.getElementById('sendFeedbackButton')
sendFeedbackButton.addEventListener('click', () => {
    var subject = 'Video Chat Feedback'

    var ratingInput = document.querySelectorAll('input[name=rate]:checked')[0]
    var ratingValue = 'N/A'
    if (ratingInput) {
        ratingValue = ratingInput.value + '/5'
    }
    var feedbackInput = document.getElementById('feedback-input').value

    if (ratingInput || feedbackInput) {
        var feedback = ('Rating: ' + ratingValue + '<br/><br/>Feedback: ' + feedbackInput.replace(/(?:\r\n|\r|\n)/g,'<br/>'))

        socket.emit('email-feedback', {subject, feedback})

        console.log('email request sent!')
    }

    // document.getElementById('feedback-container').style.opacity = 0
    document.getElementById('feedback-container').style.display = 'none'
})

const cancelFeedbackButton = document.getElementById('cancelFeedbackButton')
cancelFeedbackButton.addEventListener('click', () => {
    // document.getElementById('feedback-container').style.opacity = 0
    document.getElementById('feedback-container').style.display = 'none'
})