const socket = io();

const nickname = document.getElementById("nickname");
const nicknameInput = nickname.querySelector("input");

const enter = document.getElementById("enter");
const join = document.getElementById("join");
const joinInput = join.querySelector("input");
const rooms = enter.querySelector("h4");

const modal = document.getElementById("modal");
const modalBtn = modal.querySelector("button");

const room = document.getElementById("room");
const roomTitle = room.querySelector("h3");
const exitBtn = document.getElementById("exit");
const messages = room.querySelector("ul");
const messageForm = room.querySelector("#message");
const messageInput = messageForm.querySelector("input");

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const myStream = document.getElementById("myStream")
const peerStream = document.getElementById("peerStream")
const peerFace = document.getElementById("peerFace");
const peerNickname = peerStream.querySelector("h3");

room.hidden = true;
myStream.hidden = true;
peerStream.hidden = true;
modal.style.display = "none";

let minestream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

function handleNicknameSubmit(event) {
  event.preventDefault();
  addMessage(`닉네임을 ${nicknameInput.value}로 변경했습니다.`, "notice");
  socket.emit("edit_nickname", nicknameInput.value, roomName);
}

nickname.addEventListener("submit", handleNicknameSubmit);

function showRoom() {
  enter.hidden = true;
  room.hidden = false;
  myStream.hidden = false;
  peerStream.hidden = false;
  messageForm.hidden = true;
  while (messages.hasChildNodes()) { 
    messages.removeChild(messages.childNodes[0]); 
  };
}

async function initCall() {
  await getMedia();
  makeConnection();
}

async function handleEnterRoomSubmit(event) {
  event.preventDefault();
  await initCall();
  socket.emit("enter_room", joinInput.value, showRoom);
  roomName = joinInput.value;
}

join.addEventListener("submit", handleEnterRoomSubmit);



async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = minestream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (error) {
    console.log(error);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    minestream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = minestream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (error) {
    console.log(error);
  }
}

function handleMuteClick() {
  minestream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}

function handleCameraClick() {
  minestream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = minestream.getVideoTracks()[0];
    const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);



function hiddenRoom() {
  enter.hidden = false;
  room.hidden = true;
  myStream.hidden = true;
  peerStream.hidden = true;
}

function handleExitBtn(event) {
  event.preventDefault();
  socket.emit("exit_room", roomName, hiddenRoom);
}

exitBtn.addEventListener("click", handleExitBtn);



function addMessage(message, type) {
  const li = document.createElement("li");
  li.innerText = message;
  li.className = type
  messages.appendChild(li);
}

function handleMessageSubmit(event) {
  event.preventDefault();
  const message = messageInput.value;
  myDataChannel.send(`${message}`);
  addMessage(`${message}`, "me");
  messageInput.value = "";
}

messageForm.addEventListener("submit", handleMessageSubmit);


socket.on("room_full", () => {
  modal.style.display = "block"
  modalBtn.addEventListener("click", () => modal.style.display = "none");
})

socket.on("room_change", (roomList) => {
  rooms.innerText = "";
  roomList.forEach((room) => {
    rooms.innerText = `${rooms.innerText} ${room}`
  });
})

socket.on("peerNickname_change", (user) => {
  addMessage(`${peerNickname.innerText}이(가) 닉네임을 ${user}로 변경했습니다.`, "notice");
  peerNickname.innerText = `${user}`;
})

socket.on("hi", async (user, newCount) => {
  roomTitle.innerText = `${roomName} (${newCount}명)`;
  peerNickname.innerText = `${user}`;
  addMessage(`${user}이(가) 접속했습니다.`, "notice");
  messageForm.hidden = false;
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => 
    addMessage(`${peerNickname.innerText}: ${event.data}`, "you")
  );
  console.log("made data channel");
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("hi_me", async (user, newCount) => {
  roomTitle.innerText = `${roomName} (${newCount}명)`;
  addMessage(`${user}이(가) 접속했습니다.`, "notice");
});

socket.on("bye", (user, newCount) => {
  roomTitle.innerText = `${roomName} (${newCount}명)`;
  addMessage(`${user}이(가) 나갔습니다.`, "notice");
  peerNickname.innerText = "";
});

socket.on("offer", async (offer, roomName, user) => {
  messageForm.hidden = false;
  peerNickname.innerText = `${user}`;
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) =>
      addMessage(`${peerNickname.innerText}: ${event.data}`, "you")
    );
  });
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});



function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  minestream.getTracks().forEach((track) => myPeerConnection.addTrack(track, minestream));
}

function handleIce(data) {
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  peerFace.srcObject = data.stream;
}
