
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const {Server} = require("socket.io");

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
console.log(io.path());

const PORT = 3002;

let roomUsers = {
    roomNo: "",
    members: [
        // {}
        // {socketId: "", username: ""}
    ]
};

let socketToRoom = {};

io.on('error', e => console.log(`error... ${e}`))

// 연결
io.on('connection', (socket) => {
    console.log(`connected... socket id: [ ${socket.id} ]`);

    socket.on('join_room', (data) => {

        // 생성된 users 중 해당 roomNo 가 존재하면?
        if(roomUsers.members.length !== 0) {
            // room 에 2 명 초과로 접속 시도 시
            if(roomUsers.members.length === 2) {
                socket.to(socket.id).emit('room_full');
                return;
            }

            // 해당 roomNo 에 user 추가
            roomUsers.members.push({
                socketId: socket.id, username: data.username
            });
            console.log(`${data.roomNo} 에 ${socket.id}, ${data.username} 추가함`)
        } else {
            // room 생성
            roomUsers.roomNo = data.roomNo;

            roomUsers.members.push({
                socketId: socket.id,
                username: data.username
            });
            console.log(`생성한거 ${roomUsers.roomNo}, ${data.username}`)
        }
        // 해당 소켓이 어느 room 에 속해있는지 알기 위해 저장
        socketToRoom[socket.id] = data.roomNo;

        socket.join(data.roomNo);
        console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

        // 본인을 제외한 user
        const thisRoomUser = roomUsers.members.filter(m => m.socketId !== socket.id);

        // 본인에게 접속한 "나" 빼고 room 안에 있는 user 정보를 보냄
        // 새로 접속하는 user 가 이미 방에 있는 user 에게 offer(signal) 을 보내기 위해서
        console.log(`thisRoomUser : ${thisRoomUser.toString()}`)
        socket.broadcast.emit("thisRoomUser", thisRoomUser);
    });

    // 다른 user 에게 offer 를 보냄 (자신의 RTCSessionDescription)
    socket.on("offer", sdp => {
        console.log(`offer: ${socket.id}`);
        //  broadcast 를 통해 전달
        socket.broadcast.emit('getOffer', sdp);
    });

    // offer 를 보낸 user 에게 answer 를 보냄 (자신의 RTCSessionDescription)
    socket.on('answer', sdp => {
        console.log(`answer: ${socket.id}`);
        socket.broadcast.emit('getAnswer', sdp);
    });

    // 자신의 ICECandidate 정보를 signal (offer 또는 answer 을) 주고받은 상대에게 전달
    socket.on('candidate', candidate => {
        console.log(`candidate: ${socket.id}`);
        socket.broadcast.emit('getCandidate', candidate);
    });

    // 나가기 버튼 눌렀을 때
    socket.on('delete_user', joinRoomInfo => {
       console.log(joinRoomInfo.username + " 이 나감");

        if (roomUsers.members.length > 1) { // 룸에 2명 이상이면 사람 지우고
            console.log(`member length: ${roomUsers.members.length}`)
            roomUsers.members = roomUsers.members.filter(m => m.username === joinRoomInfo.username);

            // socket.broadcast.emit("user_exit");
            socket.broadcast.to(roomUsers.roomNo).emit("user_exit");
            console.log(`현재 [${roomUsers.roomNo}] user: ${roomUsers.members}`);
        } else {    // 1명 있었던 상황이면 방을 없앤다.
            // roomUser 제거
            roomUsers = {
                roomNo: "",
                members: [ ]
            };
        }

    });

    // 사용자 간의 연결이 끊겼을 때
    socket.on('disconnect', () => {
        console.log(`disconnect ... socket id: ${socket.id}`)
        console.log(`[${socketToRoom[socket.id]}: ${socket.id} exit`);

        // disconnect 한 user 가 포함된 roomId
        // const roomId = socketToRoom[socket.id];
        const roomId = socketToRoom[socket.id];
        console.log(`disconnect roomId:::: ${roomId}`)

        // roomUser 에 포함된 user 정보 제거
        if (roomUsers.members.length) {
            console.log(`member length: ${roomUsers.members.length}`)
            roomUsers.members = roomUsers.members.filter(m => m.socketId === socket.id);
        } else {
            // roomUser 제거
            roomUsers = {
                roomNo: "",
                members: [ ]
            };
        }

        // 어떤 user 가 나갔는지 room 의 다른 user 에게 통보
        socket.broadcast.to(roomUsers.roomNo).emit("user_exit", socketToRoom[socket.id]);
        console.log(`현재 [${roomUsers.roomNo}] user: ${roomUsers.members}`);
    });
});

server.listen(PORT, () => console.log(`server running on ${PORT}`));