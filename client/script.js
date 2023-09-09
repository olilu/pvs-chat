if (location.host.includes("localhost")) {
  // Load livereload script if we are on localhost
  document.write(
    '<script src="http://' +
      (location.host || "localhost").split(":")[0] +
      ':35729/livereload.js?snipver=1"></' +
      "script>"
  );
}
const backendUrl = window.location.origin
  .replace(/^http/, "ws")
  .replace(/^https/, "wss");
const socket = new WebSocket(backendUrl);

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !!!!!!!!!!!! DON'T TOUCH ANYTHING ABOVE THIS LINE !!!!!!!!!!!!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

// creates a unique id for the user
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  .replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, 
          v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
}

// create default user parameters
const userUUID = uuidv4()
const userColor = "#" + Math.floor(Math.random()*16777215).toString(16)

// generate an initial random username
async function getRandomUser() {
  const response = await fetch("https://randomuser.me/api/");
  const data = await response.json();
  return data.results[0];
}

socket.addEventListener("open", async (event) => {
  console.log("WebSocket connected!");
  const randomUser = await getRandomUser();
  document.getElementById("username").value = randomUser.name.first;
  const message = {
    type: "user",
    user: {
      id: userUUID,
      name: document.getElementById("username").value,
      initial: document.getElementById("username").value.charAt(0),
      color: userColor
    },
  };
  console.log(JSON.stringify(message));
  socket.send(JSON.stringify(message));
});

socket.addEventListener("message", (event) => {
  const messageObject = JSON.parse(event.data);
  console.log("Received message from server: " + messageObject.type);
  switch (messageObject.type) {
    case "ping":
      socket.send(JSON.stringify({ type: "pong", data: "FROM CLIENT" }));
    case "users":
      showParticipants(messageObject.users);
      break;
    case "message":
      showMessage(messageObject.data);
      break;
    default:
      console.error("Unknown message type: " + messageObject.type);
  }
});


// show all chat participants in the participants list
function showParticipants(users) {
  const participantsElement = document.getElementById("participants-list");
  participantsElement.innerHTML = "";
  users.forEach((user) => {
    const htmlParticipant = generateParticipantHTML(user);
    const participantElement = document.createElement("li");
    participantElement.classList.add("flex", "items-center", "space-x-3");
    participantElement.innerHTML = htmlParticipant;
    participantsElement.appendChild(participantElement);
  });
}

function generateParticipantHTML(user) {
  const html = `
    <div class="flex-shrink-0">
      <div class="h-3 w-3 rounded-full bg-[${user.color}]"></div>
    </div>
    <div class="text-sm font-medium text-white-900">${user.name}</div>
  `
  return html;
}

function showMessage(message) {
  console.log("show message")
  const htmlMessage = generateMessageHTML(message.user, message.timestamp, message.message);
  const element = document.createElement("li");
  element.innerHTML = htmlMessage;
  document.getElementById("chat-messages").appendChild(element);
  const chatMessages = document.getElementById('chat-container');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function generateMessageHTML(user, timestamp, message) {
  let formattedTimestamp;
  if (new Date().toLocaleDateString() === new Date(timestamp).toLocaleDateString()) {
      // Same day, include only time
      formattedTimestamp = new Date(timestamp).toLocaleTimeString();
  } else {
      // Not the same day, include date and time
      formattedTimestamp = new Date(timestamp).toLocaleString();
  }

  const html = `
  <div class="flex space-x-2 pl-2 pt-5">
      <div class="flex-shrink-0">
        <div 
          class="h-10 w-10 rounded-full bg-[${user.color}] flex items-center justify-center font-bold text-white">
          ${user.initial}</div>
      </div>
      <div class="flex flex-col">
        <div class="flex items-baseline space-x-2">
          <div id="user" class="font-bold">${user.name}</div>
          <div class="text-sm text-gray-400">${timestamp}</div>
        </div>

        <p class="text-sm text-light-500">${message}</p>
      </div>
    </div>
  `
  return html;
}

socket.addEventListener("close", (event) => {
  console.log("WebSocket closed.");
});

socket.addEventListener("error", (event) => {
  console.error("WebSocket error:", event);
});


function changeUsername() {
  const newUsername = document.getElementById("username").value;
  if (newUsername === "") return;
  const message = {
    type: "user",
    user: {
      id: userUUID,
      name: document.getElementById("username").value,
      initial: document.getElementById("username").value.charAt(0),
      color: userColor
    },
  };
  socket.send(JSON.stringify(message));
}

function sendMessage() {
  // TODO get message from input and send message as object to backend
  const message = document.getElementById("message").value;
  const messageObject = {
      type: "message",
      data: {
        user: {
          id: userUUID,
          name: document.getElementById("username").value,
          initial: document.getElementById("username").value.charAt(0),
          color: userColor
        },
        message: message,
        timestamp: new Date().toLocaleTimeString()
      }
  };
  document.getElementById("message").value = "";
  socket.send(JSON.stringify(messageObject));
}
