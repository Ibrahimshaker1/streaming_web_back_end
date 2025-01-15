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
		roomState.setActiveRoom([...roomState.activeRooms, newRoomData])
	}else{
		const roomId = query.room_id;
		const userName = query.user_name;
		const userId = query.user_id;
		for (let i = 0; i < roomState.activeRooms.length; i++){
			if (roomId == roomState.activeRooms[i].id) {
				userData = {
					userSocketId: socket.id,
					userId: userId,
					userName: userName
				};
				roomState.activeRooms[i].members.push(useData);
			}else{
				console.log("Room Deleted")
			};	
		};
	};
	console.log(roomState.activeRooms)
})






