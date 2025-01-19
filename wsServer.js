import express from "express";
import {Server} from "socket.io";
const port = 3500;
const app = express()
const expServer = app.listen(port, () => {console.log(`Listing on port ${port}`)})
const io = new Server(expServer, {
	cors: {
		origin: "http://localhost:5173",
		methods: ["GET", "POST"]
	}
});

//functions

let roomState = {
	activeRooms: [],
	setActiveRoom: function(roomList) {
		this.activeRooms = roomList;
	},
};

io.on("connection", socket => {
	const query = socket.handshake.query
	if (query.creator_name || query.creator_id){
		const newRoomData = {
			id: query.room_id,
			name: query.room_name,
			category: query.room_category,
			video_path: query.video_path,
			creator_id: query.creator_id,
			creator_name: query.creator_name,
			members: [{
				userSocketId: socket.id,
				userId: query.creator_id,
				userName: query.creator_name
			}],
			condation: {
				usersNumber: 1,
				videoInSecond: 0,
				videoOnOff: 0,
				videoSpeed: 1
			}
		};
		roomState.setActiveRoom(roomState.activeRooms.filter((room)=>{
			if (room.id !== query.room_id) {
				return room
			}
		}))
		roomState.setActiveRoom([...roomState.activeRooms, newRoomData])
		const curentRoomData = roomState.activeRooms.filter((room) => {
			if (room.id == query.room_id) {
				return room
			}
		})
		io.emit("memberCount", {
			memberNumber: curentRoomData[0].members.length,
			roomId: curentRoomData[0].id
		});
	}else{
		const roomId = query.room_id;
		const userName = query.user_name;
		const userId = query.user_id;
		for (let i = 0; i < roomState.activeRooms.length; i++){
			if (roomId == roomState.activeRooms[i].id) {
				const userData = {
					userSocketId: socket.id,
					userId: userId,
					userName: userName
				};
				roomState.activeRooms[i].members.push(userData);
				io.emit("memberCount", {
					memberNumber: roomState.activeRooms[i].members.length,
					roomId: roomState.activeRooms[i].id
				});
			}else{
				console.log("Room Deleted")
			};	
		};
	};
	socket.on("message", message => {
		const messageData = message
		for (let i=0; i<roomState.activeRooms.length; i++){
			if(messageData.roomId == roomState.activeRooms[i].id){
				const sendData = {
					message: messageData.messageValue,
					userName: messageData.userName,
					userId: messageData.userId,
					roomId: messageData.roomId,
				};
				io.emit("sendMessage", sendData)
			};
		}
	});
	socket.on("creatorLeave", (data) => {
		const roomId = data;
		roomState.setActiveRoom(roomState.activeRooms.filter( (room) => {
			if (room.id !== roomId) {
				return room
			}
		}));
		io.emit("creatorLeave", roomId)
	});
	socket.on("userLeave", (data) => {
		for (let i=0; i<roomState.activeRooms.length; i++) {
			if (data.roomId == roomState.activeRooms[i].id) {
				roomState.activeRooms[i].members = roomState.activeRooms[i].members.filter( (userData) => {
					if (userData.userId !== data.userId) {
						return userData
					}
				});
			};
			io.emit("memberCount", {
				memberNumber: roomState.activeRooms[i].members.length,
				roomId: roomState.activeRooms[i].id
			});
		};	
	});
	// console.log(roomState.activeRooms)
})






