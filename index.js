import express from "express";
import pg from "pg";
import env from "dotenv";
import bodyPasrser from "body-parser";
import bcrypt from "bcrypt";
import uid from "uid-safe"
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + file.originalname)
  }
})

const upload = multer({ storage })

env.config()
const app = express();
const port = 3000;
const db = new pg.Client({
		user: process.env.USERDATANAME,
		host: process.env.HOST,
		database: process.env.DATABASE,
		password: process.env.PASSWORD,
		port: 5432
	}
);
const saltingRound = 10;

app.use(bodyPasrser.urlencoded({extended: true}))
app.use(cors())

db.connect()

// functions
function future(days) {
	// this function give a future time 
	var dayMs = 86400000;
	var ts = dayMs * days;
	var now = +new Date();
	var fts = now + ts;
	return new Date(fts);
}
async function makeSession(userId) {
	// this function make a sessions if it's not already exist
	const sessionId = uid.sync(18);
	const futureDate = future(15)
	await db.query("INSERT INTO sessions (id, session_id, expires_date) VALUES ($1, $2, $3)", [userId, sessionId, futureDate])
	return {
		"session_id": sessionId,
		"expires_date": futureDate
	}
};
async function isAuthenticated(session_id) {
	// make sure the session id and expires date is valid
	const nowDate = new Date();
	const sessionData = await db.query("SELECT expires_date FROM sessions WHERE session_id = $1", [session_id]);
	if (sessionData.rows.length > 0){
		const expires_date = sessionData.rows[0]. expires_date;
		if (nowDate < expires_date) {
			return true
		}else{
			return false
		};
	}else{
		return false
	};
};
async function checkSession(userId) {
	// check if the user had old session 
	const reqData = await db.query("SELECT * FROM sessions WHERE id = $1", [userId])
	if (reqData.rows.length > 0) {
		return true;
	}else{
		return false;
	};	
}
async function updateSession(userId) {
	// update the old use session
	const sessionId = uid.sync(18);
	const futureDate = future(15);
	await db.query("UPDATE sessions SET session_id = $1, expires_date = $2 WHERE id = $3", [sessionId, futureDate, userId])
	return {
		"session_id": sessionId,
		"expires_date": futureDate
	}
}

async function sendEmail(resultStates, userEmail, forgettenPassword) {
	if (resultStates == "user name and email is true") {
		const transporter = nodemailer.createTransport({
			host: "smtp.gmail.com",
			port: 465,
			secure: true,
			auth: {
				user: process.env.EMAIL,
				pass: process.env.EMAILPASSWORD
			}
		});
		const mailoptions = {
			from: process.env.EMAIL,
			to: userEmail,
			subject: "Forgotten Passwrod",
			text: "test email"
		}
		transporter.sendMail(mailoptions, (error, info) => {
			if (error) {
				console.log(error);
			};	
		});
		return "email sent";

	}else{
		return resultStates;	
	};
};



// APIs
// get all users data
app.get("/users", async (req, res) => {
	const usersData = await db.query("SELECT user_name, first_name, last_name, email FROM users");
	res.json(usersData.rows)
});

//register API
app.post("/register", async (req, res) => {
	const userName = req.body.user_name;
	const fName = req.body.first_name;
	const lName = req.body.last_name;
	const email = req.body.email;
	const password = req.body.password;
	try {
		const checkResult = await db.query("SELECT * FROM users WHERE user_name = $1", [userName]);
		if (checkResult.rows.length > 0) {
			res.json({
				"message": "user_name used"
			});
		}else {
			bcrypt.hash(password, saltingRound, async (err, hash) => {
				if (err) {
					res.json({
						"message": "error in hashing process",
						"error": err
					});
				}else {
					const user = await db.query("INSERT INTO users (user_name, first_name, last_name, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING * ",
						[userName, fName, lName, email, hash]
					);
					const sessionData = await makeSession(user.rows[0].id)
					res.json({
						"message": "user register successfully",
						"userdata": user.rows[0],
						"session_data": sessionData
					})
				};
			} )
		}
	}catch (err){
		res.json({
			"message": "error in register process",
			"error": err
		});
	};
});

//Login API
app.post("/login", async (req, res) => {
	const userName = req.body.user_name
	const inputPassword = req.body.password
	const dbResult = await db.query("SELECT * FROM users WHERE user_name = $1", [userName]);
	if (dbResult.rows.length > 0){
		const user = dbResult.rows[0];
		const userHashedPassword = user.password;
		bcrypt.compare(inputPassword, userHashedPassword, async (err, result) => {
			if (err){
				res.json({
					"message": "hashing compare error",
					"error": err
				})
			}else{
				if (result) {
					const sessionData = await checkSession(user.id) ? await updateSession(user.id) : await makeSession(user.id)
					res.json({
						"message": "login successfully",
						"userdata": user,
						"session_data": sessionData
					})
				}else{
					res.json({
						"message": "password is wrong"
					})
				};	
			};
		});
	}else{
		res.json({
			"message": "user name dose not exist"
		})
	}
})

//Logout API
app.get("/logout/:id", async (req, res) => {
	const userId = req.params.id;
	try{
		const reqData = await db.query("SELECT * FROM sessions WHERE id = $1", [userId])
		if (reqData.rows.length > 0){
			await db.query("DELETE FROM sessions WHERE id = $1", [userId])
			res.sendStatus(200)
		}else{
			res.sendStatus(404)
		};	
	}catch (err) {
		res.sendStatus(404)
	}
});

app.post("/userUpdate", async (req,res) => {
	const newUserName = req.body.newUserName;
	const newFirstName = req.body.newFirstName;
	const newLastName = req.body.newLastName;
	const userId = req.body.userId;
	const userNameList = await db.query("SELECT user_name FROM users")
	let resultCondition = true;
	for (let i=0; i < userNameList.rows.length; i++) {
		if (newUserName == userNameList.rows[i]["user_name"]) {
			resultCondition = false;	
		}
	}
	if (resultCondition) {
		await db.query("UPDATE users SET user_name = $1, first_name = $2, last_name = $3 WHERE id = $4",
		[newUserName, newFirstName, newLastName, userId])
		res.json({"message": "update done"})
	}else{
		res.json({"message": "This user_name is used"})
	}
})

//uploadVideo API "this api save the video file at the server and add it's info. the the DB"
app.post("/uploadVideo", upload.single("file"), async (req, res) => {
	const filePathName = req.file.filename;
	const fileName = req.body.name;
	const fileCategore = req.body.categore;
	await db.query("INSERT INTO videos (name, category, path) VALUES ($1, $2, $3);", [fileName, fileCategore, filePathName]);
	res.sendStatus(200);
});

//Send video data to the client
app.get("/videos", async (req, res) => {
	const videosData = await db.query("SELECT * FROM videos");
	if (videosData.rows.length > 0) {
		res.json(videosData.rows)
	}else{
		res.json({"message": "there is no videos avilble"})
	};
});


//send the passowrd to the user in email
app.post("/forgetPassword", async(req, res) => {
	const userName = req.body.userName;
	const userEmail = req.body.userEmail;
	const userNameList = await db.query("SELECT user_name FROM users");
	let resultStates = "user not found";
	for (let i=0; i < userNameList.rows.length; i++) {
		if (userName == userNameList.rows[i]["user_name"]) {
			resultStates = "user name found";
		};
	};
	if (resultStates == "user name found") {
		const dbUserEmail = await db.query("SELECT email FROM users WHERE user_name = $1;", [userName]);
		if (dbUserEmail.rows[0]["email"] == userEmail) {
			resultStates = "user name and email is true";
		}else{
			resultStates = "wrong email";
		};
	};
	const sendEmailResault = await sendEmail(resultStates, userEmail);
	res.json({"message": sendEmailResault});
});
//create a room data in the database
app.post("/createRoom", async(req, res) => {
	const roomName = req.body.roomName;
	const roomCategory = req.body.category;
	const roomUserId = req.body.id;
	const videoId = req.body.vidId;
	const videoPath = await db.query("SELECT path FROM videos WHERE id = $1;", [videoId]);
	const creatorName = await db.query("SELECT user_name FROM users WHERE id = $1;", [roomUserId]);
	try{ 
		const room = await db.query("INSERT INTO rooms (id, name, category, vid_path, creator_name) VALUES ($1, $2, $3, $4, $5) RETURNING * ;",
			[roomUserId, roomName, roomCategory, videoPath.rows[0]["path"], creatorName.rows[0]["user_name"]]);
		res.json( {
			"roomData": room.rows[0]
		});
	}catch{
		res.json({
			"roomData": "Create Room Error"
		});
	};
});
// get rooms data 
app.get("/roomData", async (req, res) => {
	const roomData = await db.query("SELECT * FROM rooms");
	if (roomData.rows.length > 0) {
		res.json({
			"roomGetData": roomData.rows
		});
	}else{
		res.json({
			"roomGetData": "no rooms in DB"
		});
	}
});


app.listen(port, () => {
	console.log(`server runing at localhost:${port}`)
});


