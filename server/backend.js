const WebSocket = require("ws");
const redis = require("redis");
const expireTimeInSeconds = 15;
let redisClient;
let clients = [];

// Intiiate the websocket server
const initializeWebsocketServer = async (server) => {
  redisClient = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || "6379",
    },
  });
  await redisClient.connect();

  const subscriber = redisClient.duplicate();
  await subscriber.connect();
  
  publisher = redisClient.duplicate();
  await publisher.connect();

  const websocketServer = new WebSocket.Server({ server });
  websocketServer.on("connection", onConnection);
  websocketServer.on("error", console.error);
  await subscriber.subscribe("newMessage", onRedisMessage);

  heartbeat();
};

const onRedisMessage = async (message) => {
  const messageObject = JSON.parse(message);
  console.log("Received message from redis channel: " + messageObject.type);
  switch (messageObject.type) {
    case "message":
      clients.forEach((client) => {
        client.ws.send(JSON.stringify(messageObject));
      });
      break;
    case "publishUsers":
      await publishUsers();
      break;
    default:
      console.error("Unknown message type: " + messageObject.type);
  }
};

const sendMessageHistory = async (ws) => {
  const history = await getMessageHistoryArray(); 
  console.log("Send message history to new client");
  if (!history) return;
  history.forEach((message) => {
    ws.send(JSON.stringify(message));
  });
};

const publishUsers = async () => {
  const users = await getUsers();
  const message = {
    type: "users",
    users,
  };
  clients.forEach((client) => {
    client.ws.send(JSON.stringify(message));
  });
};

const getUsers = async () => {
  let userKeys = await redisClient.keys("user:*");

  let users = [];
  for (let i = 0; i < userKeys.length; i++) {
    let user = await redisClient.get(userKeys[i]);
    if (user) {
      users.push(JSON.parse(user));
    }
  }

  return users;
};

// If a new connection is established, the onConnection function is called
const onConnection = (ws) => {
  console.log("New websocket connection");
  ws.on("close", () => onClose(ws));
  ws.on("message", (message) => onClientMessage(ws, message));
  // TODO: Send all connected users and current message history to the new client
  ws.send(JSON.stringify({ type: "ping", data: "FROM SERVER" }));
  messageHistory = getMessageHistory();
  console.log("Message history: " + messageHistory);
  sendMessageHistory(ws);  
};

// If a new message is received, the onClientMessage function is called
const onClientMessage = async (ws, message) => {
  const messageObject = JSON.parse(message);
  console.log("Received message from client: " + messageObject.type);
  switch (messageObject.type) {
    case "pong":
      console.log("Received from client: " + messageObject.data);
      break;
    case "user":
      clients = clients.filter((client) => client.ws !== ws);
      console.log("Connected clients: " + clients.length);
      console.log("Received from client users: " + messageObject.type);
      clients.push({ ws, user: messageObject.user });
      redisClient.set(
        `user:${messageObject.user.id}`,
        JSON.stringify(messageObject.user)
      );
      redisClient.expire(
        `user:${messageObject.user.id}`,
        expireTimeInSeconds
      );
      const message = {
        type: "publishUsers",
      };
      publisher.publish("newMessage", JSON.stringify(message));
      break;
    case "message":
      // TODO: Publish new message to all connected clients and save in redis
      console.log("Received message from client: " + messageObject.data.message);
      messageHistory = await getMessageHistoryArray() || [];
      messageHistory.push(messageObject);
      setMessageHistory(JSON.stringify(messageHistory));
      publisher.publish("newMessage", JSON.stringify(messageObject));
      break;
    default:
      console.error("Unknown message type: " + messageObject.type);
  }
};

// If a connection is closed, the onClose function is called
const onClose = async (ws) => {
  console.log("Websocket connection closed");
  const client = clients.find((client) => client.ws === ws);
  if (!client) return;
  redisClient.del(`user:${client.user.id}`);
  const message = {
    type: "publishUsers",
  };
  publisher.publish("newMessage", JSON.stringify(message));
  clients = clients.filter((client) => client.ws !== ws);
};

const getMessageHistory = async () => {
  return await redisClient.get("messageHistory");
};

const getMessageHistoryArray = async () => {
  const historyString = await getMessageHistory();
  return JSON.parse(historyString);
};

const setMessageHistory = async (messageHistory) => {
  await redisClient.set("messageHistory", messageHistory);
};

const heartbeat = async () => {
  for (let i = 0; i < clients.length; i++) {
    redisClient.expire(`user:${clients[i].user.id}`, expireTimeInSeconds);
  }
  await publishUsers();
  setTimeout(heartbeat, (expireTimeInSeconds * 1000) / 2);
};

module.exports = { initializeWebsocketServer };
