const userId = Math.floor((Math.random()*9999)+1) //TODO: Ensure duplicates don't cause any issues
const socket = io({query: "userId=" + userId})

const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]}
const {RTCPeerConnection, RTCSessionDescription} = window
const peerConnection = new RTCPeerConnection(configuration)

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

var myStream
var currentRoomNumber = null

let isAlreadyCalling = false

document.title = `Overview`

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
    const usernameElement = document.createElement('span')

    userContainerElement.setAttribute('class', 'active-room')
    userContainerElement.setAttribute('id', socketId)
    usernameElement.innerHTML = ` Room ${roomNumber}: ${userDetail}`

    userContainerElement.append(usernameElement)

    return userContainerElement
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
    userIconElement.setAttribute('class','material-icons md-20')
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

const storeIcon = document.getElementById('storeIcon')
storeIcon.addEventListener('click', () => {
    window.location.href = new URL('/app/store.html', window.location.href)
})

const userInfo = document.getElementById('store-info')
userInfo.addEventListener('click', () => {
    document.getElementById('user-detail-container').style.display = 'inline'
})

if (localStorage.getItem('userDetail')) {
    document.getElementById('user-detail-container').style.display = 'none'

    document.getElementById('store-info').innerHTML = localStorage.getItem('userDetail')
    document.getElementById('user-detail-input').value = localStorage.getItem('userDetail')
}

const userDetailButton = document.getElementById('userDetailButton')
userDetailButton.addEventListener('click', () => {
    const inputtedUserDetail = document.getElementById('user-detail-input').value

    if (inputtedUserDetail) {
        localStorage.setItem('userDetail', inputtedUserDetail)
        document.getElementById('store-info').innerHTML = inputtedUserDetail
        document.getElementById('user-detail-container').style.display = 'none'
    }
})


//TODO:
//Be able to change name
//link to store url
//have store access localStorage.getItem('userName') and have that passed into rooms
//Add list of storeViewUsers