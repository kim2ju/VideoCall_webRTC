import http from "http";
import SocketIO from "socket.io";
import express from "express";
import { count } from "console";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

function RoomList() {
  const {
    sockets: {
      adapter: { sids, rooms }
    }
  } = wsServer;
  const RoomList = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      RoomList.push(key);
    }
  });
  return RoomList;
}

function countRoom(roomName) {
  return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
  socket["nickname"] = "익명";
  wsServer.sockets.emit("room_change", RoomList());
  socket.on("edit_nickname", (nickname, roomName) => {
    socket["nickname"] = nickname;
    socket.to(roomName).emit("peerNickname_change", socket.nickname);
  });
  socket.on("enter_room", (roomName, done) => {
    if (countRoom(roomName) === undefined || countRoom(roomName) < 2) {
      socket.join(roomName);
      done();
      socket.to(roomName).emit("hi", socket.nickname, countRoom(roomName));
      socket.emit("hi_me", socket.nickname, countRoom(roomName));
      wsServer.sockets.emit("room_change", RoomList());
    } else {
      socket.emit("room_full");
    }
  });
  socket.on("exit_room", (roomName, done) => {
    socket.rooms.forEach((roomName) =>
      socket.to(roomName).emit("bye", socket.nickname, countRoom(roomName) - 1)
    );
    socket.leave(roomName);
    done();
    wsServer.sockets.emit("room_change", RoomList());
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomName) =>
      socket.to(roomName).emit("bye", socket.nickname, countRoom(roomName) - 1)
    );
  });
  socket.on("disconnect", () => {
    wsServer.sockets.emit("room_change", RoomList());
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer, roomName, socket.nickname);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
