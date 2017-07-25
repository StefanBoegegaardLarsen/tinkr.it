// for routing
var express = require("express");
var ValidatePassword = require('validate-password');
var app = express();
var fs = require('fs');
// create the socket server - creating an extra server which is connected to the normal server
var server = require("http").Server(app);
// io = input/output
var io = require("socket.io")(server);

// to play with POST data
var bodyParser = require("body-parser");
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( {"extended":false} ) );

var siofu = require("socketio-file-upload");
app.use( siofu.router );

var mysql      = require('mysql');
var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : '',
	database : 'tinkr'
});

app.use(express.static('./public/'));
app.use(express.static('./uploads/'));

// for valitadating passwords
var options = {
	enforce: {
		lowercase: true,
		uppercase: true,
		specialCharacters: false,
		numbers: true
	}
};

var validator = new ValidatePassword(options);

// oSocket.emit 						-> only that specific socket/client
// io.emit			 						-> all sockets
// oSocket.broadcast.emit		-> all sockets EXCEPT the one that triggers the action

io.on("connection", function(oSocket){
	var uploader = new siofu();
	uploader.dir = __dirname + "/uploads";
	uploader.listen(oSocket);

	// *****************************************************************************
				// SIGNUP
	// *****************************************************************************

	var aUsers = [];

	connection.query('CALL sp_getall()', function (error, results, fields) {
		if (error) throw error;
		aUsers = results;
	});

	var emailTaken = false;

	oSocket.on("try to create user", function(jData){
		var sEmail = jData.email;
		var sFirstName = jData.firstname;
		var sLastName = jData.lastname;
		var sUserPass = jData.pass;

		var passwordCheck = validator.checkPassword(sUserPass, [sEmail]);
		if (passwordCheck.isValid && sUserPass.length>=8) {

			for (var i = 0; i < aUsers[0].length; i++) {
				var currentUser = aUsers[0][i];

				if(currentUser.email.toLowerCase() == sEmail.toLowerCase()) {
					emailTaken = true;
					break;
				}
			}

			if (emailTaken == false) {
				connection.query('INSERT INTO `users` (`firstname`,`lastname`, `pass`,`email`) VALUES ("'+sFirstName+'","'+sLastName+'","'+sUserPass+'","'+sEmail+'");', function (error, results, fields) {
					if (error){
						console.log("Error is: "+error);
						throw error
					}
				});

				var sMessageToUser = "\""+sFirstName+" "+sLastName+"\" has been registered";
				var sToken = "secretToken";
				oSocket.emit("User created", {"message":sMessageToUser, "token":sToken});
			} else {
				var sMessageToUser = "\""+sEmail+"\" already registered";
				oSocket.emit("Email already registered", {"message":sMessageToUser});
				emailTaken = false;
			}
		} else {
			var sMessageToUser = "Password must include upper- and lowercase letters and numbers and have a length of min. 8 characters";
			oSocket.emit("Password is invalid", {"message":sMessageToUser});
		}
	});


	// *****************************************************************************
			// LOGIN
	// *****************************************************************************

	oSocket.on("Login attempt", function(jData){
		var sEmail = jData.email.toLowerCase();
		var sUserPass = jData.pass;
		var sToken;

		if (sEmail != "" && sUserPass != "" && sUserPass.length>=8) {
			for (var i = 0; i < aUsers[0].length; i++) {
				var currentUser = aUsers[0][i];

				if(currentUser.email.toLowerCase() == sEmail && currentUser.pass == sUserPass) {
					var sMessageToUser = "Correct login";
					sToken = "secretToken";

					var queryString = "SELECT * FROM users WHERE email = '"+sEmail+"'";

					connection.query(queryString, function(err, rows, fields) {
						if (err) throw err;
						var userId = rows[0].id;
						oSocket.emit("Correct login", {"message":sMessageToUser, "token":sToken, "userId":userId});
					});

					break;
				} else {
					var sMessageToUser = "Wrong login";
					oSocket.emit("Wrong login", {"message":sMessageToUser});
				}
			}
		} else {
			var sMessageToUser = "Wrong login";
			oSocket.emit("Please enter valid email and pass", {"message":sMessageToUser});
		}
	});


	// *****************************************************************************
			// ON LOAD
	// *****************************************************************************

	var aGroupNames = [];
	var aClassNames = [];

	oSocket.on("Client requesting username", function(jData){
		var userId = jData;
		var queryStringJNCTGroups = "SELECT * FROM users WHERE id = '"+userId+"'";

		connection.query(queryStringJNCTGroups, function(err, rows, fields) {
			if (err) throw err;

			oSocket.emit("Server sending username", rows);
		});
	});

	oSocket.on("Client requesting all load information", function(jData){
		var lastLocation = jData.lastLocation.toLowerCase();
		var lastRoom = jData.lastRoom;
		var userId = jData.userId;

		var queryStringJNCTClasses = "SELECT className, classes.id FROM classes JOIN jnct_classes_users ON classes.id = jnct_classes_users.fk_class WHERE jnct_classes_users.fk_user = '"+userId+"'";
		connection.query(queryStringJNCTClasses, function(err, rows, fields) {
			if (err) throw err;

			for (var i = 0; i < rows.length; i++) {
				aClassNames.push(rows[i].className);
			}
			oSocket.emit("Server sending all classes", rows);
		});

		var queryStringJNCTGroups = "SELECT groupName, groups.id FROM groups JOIN jnct_groups_users ON groups.id = jnct_groups_users.fk_group WHERE jnct_groups_users.fk_user = '"+userId+"'";
		connection.query(queryStringJNCTGroups, function(err, rows, fields) {
			if (err) throw err;

			for (var i = 0; i < rows.length; i++) {
				aGroupNames.push(rows[i].groupName);
			}
			oSocket.emit("Server sending all groups", rows);
		});

		var queryStringDMusers = "SELECT * FROM users JOIN jnct_dm_users ON users.id = jnct_dm_users.fk_users WHERE jnct_dm_users.fk_dms IN (SELECT fk_dms FROM jnct_dm_users WHERE jnct_dm_users.fk_users = '"+userId+"')";

		connection.query(queryStringDMusers, function(err, rows, fields) {
			if (err) throw err;
			oSocket.emit("Server sending all direct messages", rows);
		});

		var queryString = "SELECT * FROM "+lastLocation+" JOIN users ON users.id = "+lastLocation+".poster WHERE "+lastLocation+".location = '"+lastRoom+"'";

		connection.query(queryString, function(err, rows, fields) {
			if (err) throw err;
			oSocket.emit("Server sending load information", rows);
		});
	});


	// *****************************************************************************
				// ON CLASS, GROUP OR TAB CLICK
	// *****************************************************************************

	oSocket.on("Client sending clicked location id and lastLocation", function(jData){
		var lastLocation = jData.lastLocation.toLowerCase();
		var lastRoom = jData.lastRoom;
		var userId = jData.userId;

		var queryString = "SELECT * FROM "+lastLocation+" JOIN users ON users.id = "+lastLocation+".poster WHERE "+lastLocation+".location = '"+lastRoom+"'";

		connection.query(queryString, function(err, rows, fields) {
			if (err) throw err;
			oSocket.emit("Server sending load information for clicked location", rows);
		});
	});


	// *****************************************************************************
				// NEW CHAT MESSAGE
	// *****************************************************************************

	oSocket.on("Client sending a new chat message", function(jData){
		var sMessage = jData.message;
		var sUpload = jData.upload;

		var weekday = new Array(7);
		weekday[0] = "Sun";
		weekday[1] = "Mon";
		weekday[2] = "Tue";
		weekday[3] = "Wed";
		weekday[4] = "Thu";
		weekday[5] = "Fri";
		weekday[6] = "Sat";

		var date = new Date;
		var now = Date.now();
		date.setTime(now);

		var dayOfWeek = weekday[date.getDay()];
		var day = date.getDate();
		var month = date.getMonth();
		var year = date.getFullYear();

		var hour = date.getHours();
		var minutes = date.getMinutes();

		var timestamp = dayOfWeek+" "+day+"."+month+"."+year+" - "+hour+"."+minutes;

		var messageType = jData.messageType;
		var lastRoom = jData.lastRoom;

		var userId = jData.userId;

		var queryStringUsername = "SELECT * FROM users WHERE id ='"+userId+"'";

		connection.query(queryStringUsername, function(err, rows, fields) {
			if (err) throw err;
			var firstname = rows[0].firstname;
			var lastname = rows[0].lastname;
			var sUsername = firstname + " " + lastname;

			var queryString = "INSERT INTO "+messageType+" (`chatId`, `chatMessage`, `location`, `poster`, `timestamp`, `chatUpload`) VALUES (NULL, '"+sMessage+"', '"+lastRoom+"', '"+userId+"', '"+timestamp+"', '"+sUpload+"')";

			connection.query(queryString, function(err, rows, fields, result) {
				if (err) throw err;
				var insertId = rows.insertId;
				io.emit("Here is the new message which was just created", {"message":sMessage, "lastRoom":lastRoom, "sUsername":sUsername, "timestamp":timestamp, "userId":userId, "insertId":insertId, "upload":sUpload, "userId":userId});
			});
		});

	});


	// *****************************************************************************
				// NEW POST
	// *****************************************************************************

	oSocket.on("Client sending the new post content", function(jData){
		var newPostTitle = jData.title;
		var newPostDescription = jData.description;
		var lastRoom = jData.lastRoom;
		var userId = jData.userId;
		var newPostUpload = jData.upload;

		var weekday = new Array(7);
		weekday[0] = "Sun";
		weekday[1] = "Mon";
		weekday[2] = "Tue";
		weekday[3] = "Wed";
		weekday[4] = "Thu";
		weekday[5] = "Fri";
		weekday[6] = "Sat";

		var date = new Date;
		var now = Date.now();
		date.setTime(now);

		var dayOfWeek = weekday[date.getDay()];
		var day = date.getDate();
		var month = date.getMonth();
		var year = date.getFullYear();

		var hour = date.getHours();
		var minutes = date.getMinutes();

		var timestamp = dayOfWeek+" "+day+"."+month+"."+year+" - "+hour+"."+minutes;

		var queryStringUsername = "SELECT * FROM users WHERE id ='"+userId+"'";

		connection.query(queryStringUsername, function(err, rows, fields) {
			if (err) throw err;
			var firstname = rows[0].firstname;
			var lastname = rows[0].lastname;
			var username = firstname + " " + lastname;

			var queryString = "INSERT INTO posts (`postId`, `postTitle`, `postDescription`, `location`, `poster`, `timestamp`, `postUpload`) VALUES (NULL, '"+newPostTitle+"', '"+newPostDescription+"', '"+lastRoom+"', '"+userId+"', '"+timestamp+"', '"+newPostUpload+"')";

			connection.query(queryString, function(err, rows, fields) {
				if (err) throw err;
				var insertId = rows.insertId;
				io.emit("Server sending the new post which was just created", {"newPostTitle":newPostTitle, "newPostDescription":newPostDescription, "lastRoom":lastRoom, "timestamp":timestamp, "insertId":insertId, "username":username, "userId":userId, "newPostUpload":newPostUpload, "userId":userId});
			});
		});
	});


	// *****************************************************************************
				// NEW ASSIGNMENT
	// *****************************************************************************

	oSocket.on("Client sending the new assignment content", function(jData){
		var newAssignmentTitle = jData.title;
		var newAssignmentDescription = jData.description;
		var lastRoom = jData.lastRoom;
		var userId = jData.userId;
		var newAssignmentUpload = jData.upload;

		var weekday = new Array(7);
		weekday[0] = "Sun";
		weekday[1] = "Mon";
		weekday[2] = "Tue";
		weekday[3] = "Wed";
		weekday[4] = "Thu";
		weekday[5] = "Fri";
		weekday[6] = "Sat";

		var date = new Date;
		var now = Date.now();
		date.setTime(now);

		var dayOfWeek = weekday[date.getDay()];
		var day = date.getDate();
		var month = date.getMonth();
		var year = date.getFullYear();

		var hour = date.getHours();
		var minutes = date.getMinutes();

		var timestamp = dayOfWeek+" "+day+"."+month+"."+year+" - "+hour+"."+minutes;
		var startDate = year+"."+month+"."+day;
		var deadline = jData.deadline;

		var queryStringUsername = "SELECT * FROM users WHERE id ='"+userId+"'";

		connection.query(queryStringUsername, function(err, rows, fields) {
			if (err) throw err;
			var firstname = rows[0].firstname;
			var lastname = rows[0].lastname;
			var sUsername = firstname + " " + lastname;
			var userId = rows[0].id;

			var queryString = "INSERT INTO assignments (`assignmentId`, `assignmentTitle`, `assignmentDescription`, `location`, `poster`, `timestamp`, `startDate`, `deadline`, `assignmentUpload`) VALUES (NULL, '"+newAssignmentTitle+"', '"+newAssignmentDescription+"', '"+lastRoom+"', '"+userId+"', '"+timestamp+"', '"+startDate+"', '"+deadline+"', '"+newAssignmentUpload+"')";

			connection.query(queryString, function(err, rows, fields) {
				if (err) throw err;
				io.emit("Server sending the new assignment which was just created", {"newAssignmentTitle":newAssignmentTitle, "newAssignmentDescription":newAssignmentDescription, "lastRoom":lastRoom, "timestamp":timestamp, "id":rows.insertId, "startDate":startDate, "deadline":deadline, "newAssignmentUpload":newAssignmentUpload, "userId":userId});
			});
		});
	});


	// *****************************************************************************
				// NEW GROUP CREATION
	// *****************************************************************************

	oSocket.on("Client checking if groupname exists", function(jData){
		var groupName = jData.groupName;
		var queryString = "SELECT * FROM groups WHERE groupName = '"+groupName+"'";
		var groupNameTaken;

		var query = connection.query(queryString, function(err, rows, fields){
			if (rows.length > 0){
				groupNameTaken = true;
				oSocket.emit("Server responding if groupname is taken", groupNameTaken);
			} else {
				groupNameTaken = false;
				oSocket.emit("Server responding if groupname is taken", groupNameTaken);
			}
		});
	});

	oSocket.on("Client requesting all users for group creation", function(jData){
		var query = "SELECT * FROM users";

		var query = connection.query(query, function(err, rows, fields){
			if (err) throw err;
			oSocket.emit("Server sending list of users for group creation", rows);
		});
	});


	oSocket.on("Client sending new group name and group members", function(jData){
		var groupName = jData.asGroup[0];
		var groupCreator = jData.userId;

		// inserting class into class table
		var queryString = "INSERT INTO `tinkr`.`groups` (`groupName`, `groupCreator`) VALUES ('"+groupName+"', '"+groupCreator+"')";

		var query = connection.query(queryString, function(err, rows, fields){
			if (err) throw err;
			var groupId = rows.insertId;

			// inserting a row per user checked off in the jnct_classes_users table
			var usersCheckedOff = jData.usersCheckedOff;

			for (var i = 0; i < usersCheckedOff.length; i++) {
				var currentUserId = jData.usersCheckedOff[i];

				var queryStringJNCT = "INSERT INTO jnct_groups_users (`groupuser_id`, `fk_group`, `fk_user`) VALUES (NULL, '"+groupId+"', '"+currentUserId+"')";

				var query = connection.query(queryStringJNCT, function(err, rows, fields){
					if (err) throw err;
				});
			}
		});
		io.emit("Server sending new group back", groupName);
	});


	// *****************************************************************************
				// NEW CLASS CREATION
	// *****************************************************************************

	oSocket.on("Client requesting user role for user with id", function(jData){
		var userId = jData;

		var querySelect = "SELECT * FROM users WHERE id = '"+userId+"'";

		var query = connection.query(querySelect, function(err, rows, fields){
			if (err) throw err;
			var userRole = rows;
			oSocket.emit("Server sending user role", rows);
		});
	});

	oSocket.on("Client checking if classname exists", function(jData){
		var className = jData.className;
		var queryString = "SELECT * FROM classes WHERE className = '"+className+"'";
		var classNameTaken;

		var query = connection.query(queryString, function(err, rows, fields){
			if (rows.length > 0){
				classNameTaken = true;
				oSocket.emit("Server responding if classname is taken", classNameTaken);
			} else {
				classNameTaken = false;
				oSocket.emit("Server responding if classname is taken", classNameTaken);
			}
		});
	});

	oSocket.on("Client requesting all users for class creation", function(jData){
		var query = "SELECT * FROM users";

		var query = connection.query(query, function(err, rows, fields){
			if (err) throw err;
			oSocket.emit("Server sending list of users for class creation", rows);
		});
	});

	oSocket.on("Client sending new class name and class members", function(jData){
		var className = jData.asClass[0];
		var classCreator = jData.userId;

		// inserting class into class table
		var queryString = "INSERT INTO `tinkr`.`classes` (`className`, `classCreator`) VALUES ('"+className+"', '"+classCreator+"')";

		var query = connection.query(queryString, function(err, rows, fields){
			if (err) throw err;
			var classId = rows.insertId;

			// inserting a row per user checked off in the jnct_classes_users table
			var usersCheckedOff = jData.usersCheckedOff;

			for (var i = 0; i < usersCheckedOff.length; i++) {
				var currentUserId = jData.usersCheckedOff[i];

				var queryStringJNCT = "INSERT INTO jnct_classes_users (`classuser_id`, `fk_class`, `fk_user`) VALUES (NULL, '"+classId+"', '"+currentUserId+"')";

				var query = connection.query(queryStringJNCT, function(err, rows, fields){
					if (err) throw err;
				});
			}
		});
		io.emit("Server sending new class back", className);
	});


	// *****************************************************************************
				// EDIT CHAT MESSAGE
	// *****************************************************************************

	oSocket.on("Client sending edited chat data", function(jData){
		var oldChatMessage = jData.oldChatMessage;
		var newChatMessage = jData.newChatMessage;
		var chatId = jData.chatId;

		var query = "UPDATE chat SET `chatMessage` = '"+jData.newChatMessage+"' WHERE chatId = '"+chatId+"'";

		var query = connection.query(query, function(err, rows, fields){
			if (err) throw err;

			io.emit("Server sending new chat message", {"oldChatMessage":oldChatMessage, "newChatMessage":newChatMessage, "chatId":chatId});
		});
	});


	// *****************************************************************************
				// DELETE CHAT MESSAGE
	// *****************************************************************************

	oSocket.on("Client sending chat message to delete", function(jData){
		var txtChatToDelete = jData.txtChatToDelete;
		var chatId = jData.chatId;

		var query = "DELETE FROM chat WHERE chatId = '"+chatId+"'";

		var query = connection.query(query, function(err, rows, fields){
			if (err) throw err;
			io.emit("Server sending chat to delete", {"txtChatToDelete":txtChatToDelete, "chatId":chatId});
		});
	});


	// *****************************************************************************
				// EDIT POST
	// *****************************************************************************

	oSocket.on("Client sending edited post data", function(jData){
		var newPostTitle = jData.newPostTitle;
		var newPostDescription = jData.newPostDescription;

		var postId = jData.postId;

		var queryUpdate = "UPDATE posts SET postTitle = '"+newPostTitle+"', postDescription = '<p>"+newPostDescription+"</p>' WHERE `posts`.`postId` = "+postId+"";

		var query = connection.query(queryUpdate, function(err, rows, fields){
			if (err) throw err;

			io.emit("Server sending new post", {"newPostTitle":newPostTitle, "newPostDescription":newPostDescription, "postId":postId});
		});
	});


	// *****************************************************************************
				// DELETE POST
	// *****************************************************************************

	oSocket.on("Client sending post to delete", function(jData){
		var txtPostTitleToDelete = jData.txtPostTitleToDelete;
		var txtPostDescriptionToDelete = jData.txtPostDescriptionToDelete;
		var postTitleId = jData.postTitleId;
		var query = "DELETE FROM posts WHERE postTitle = '"+txtPostTitleToDelete+"' AND postDescription = '"+txtPostDescriptionToDelete+"'";

		var query = connection.query(query, function(err, rows, fields){
			if (err) throw err;
			io.emit("Server sending post to delete", {"postToDelete":txtPostTitleToDelete, "postTitleId":postTitleId});
		});
	});


	// *****************************************************************************
				// EDIT ASSIGNMENT
	// *****************************************************************************

	oSocket.on("Client sending edited assignment data", function(jData){
		var newAssignmentTitle = jData.newAssignmentTitle;
		var newAssignmentDescription = jData.newAssignmentDescription;
		var newAssignmentDeadline = jData.newAssignmentDeadline;

		var assignmentId = jData.assignmentId;

		var queryUpdate = "UPDATE assignments SET assignmentTitle = '"+newAssignmentTitle+"', assignmentDescription = '"+newAssignmentDescription+"', deadline = '"+newAssignmentDeadline+"' WHERE `assignments`.`assignmentId` = "+assignmentId+"";

		var query = connection.query(queryUpdate, function(err, rows, fields){
			if (err) throw err;

			io.emit("Server sending new assignment", {"newAssignmentTitle":newAssignmentTitle, "newAssignmentDescription":newAssignmentDescription, "deadline":newAssignmentDeadline, "assignmentId":assignmentId});
		});
	});


	// *****************************************************************************
				// DELETE ASSIGNMENT
	// *****************************************************************************

	oSocket.on("Client sending assignment to delete", function(jData){
		var txtAssignmentTitleToDelete = jData.txtAssignmentTitleToDelete;
		var txtAssignmentDescriptionToDelete = jData.txtAssignmentDescriptionToDelete;
		var assignmentTitleId = jData.assignmentTitleId;
		var query = "DELETE FROM assignments WHERE assignmentTitle = '"+txtAssignmentTitleToDelete+"' AND assignmentDescription = '"+txtAssignmentDescriptionToDelete+"'";

		var query = connection.query(query, function(err, rows, fields){
			if (err) throw err;
			io.emit("Server sending assignment to delete", {"assignmentToDelete":txtAssignmentTitleToDelete, "assignmentTitleId":assignmentTitleId});
		});
	});


	//*************************************************************************************
		// DIRECT MESSAGING
	//*************************************************************************************

	oSocket.on("Client starting new direct conversation", function(jData){
		var currentUserId = jData.currentUserId;
		var clickedUsernameId = jData.clickedUsernameId;
		var currentUser = jData.currentUser;
		var clickedUsername = jData.clickedUsername;
		var users = [];
		users.push(currentUserId);
		users.push(clickedUsernameId);

		var queryInsertDM = "INSERT INTO directMessageConversations (`dm_id`, `dmName`) VALUES (NULL, 'name')";

		var query = connection.query(queryInsertDM, function(err, rows, fields){
			if (err) throw err;
			var insertId = rows.insertId;

			for (var i = 0; i < users.length; i++){
				var queryInsertJNCT = "INSERT INTO jnct_dm_users (`dmuser_id`, `fk_dms`, `location`, `fk_users`) VALUES (NULL, '"+insertId+"', 'dm"+insertId+"', '"+users[i]+"')";

				var query = connection.query(queryInsertJNCT, function(err, rows, fields){
					if (err) throw err;
				});
			}
			io.emit("Server has created direct message between", {"clickedUsername":clickedUsername, "currentUser":currentUser, "clickedUsernameId":clickedUsernameId, "currentUserId":currentUserId, "location":"dm"+insertId});
		});
	});

	var timestamp = "13.06.2017";

	oSocket.on("Client sending new direct message", function(jData){
		var directMessage = jData.directMessage;
		var directConversationId = jData.directConversationId;
		var userId = jData.userId;
		var queryInsertNewDM = "INSERT INTO `tinkr`.`chat` (`chatId`, `chatMessage`, `location`, `poster`, `timestamp`, `chatUpload`) VALUES (NULL, '"+directMessage+"', '"+directConversationId+"', '"+userId+"', '"+timestamp+"', 'undefined');";

		console.log("directConversationId: "+directConversationId);
		console.log("directMessage: "+directMessage);

		var query = connection.query(queryInsertNewDM, function(err, rows, fields){

			io.emit("Server sending new direct message back", {"directMessage":directMessage, "directConversationId":directConversationId, "timestamp":timestamp, "userId":userId});
		});
	});

	oSocket.on("Client requesting messages for direct conversation", function(jData){
		if(jData.clickedUsernameId != ""){
			var clickedUsernameId = jData.clickedUsernameId;
			var currentUserId = jData.currentUserId;
			var noMessages;

			var queryGetUsername = "SELECT * FROM users WHERE id ='"+clickedUsernameId+"'";

			var query = connection.query(queryGetUsername, function(err, rows, fields){
				var firstname = rows[0].firstname;
				var lastname = rows[0].lastname;
				var clickedUsername = firstname+" "+lastname;

				var querySelect = "SELECT * FROM chat JOIN jnct_dm_users ON chat.location = jnct_dm_users.location WHERE jnct_dm_users.location IN (SELECT jnct_dm_users.location FROM jnct_dm_users WHERE fk_users IN ('"+clickedUsernameId+"','"+currentUserId+"') GROUP BY fk_dms having count(*) >1) GROUP BY chat.chatId";

				var query = connection.query(querySelect, function(err, rows, fields){
					if (rows.length == 0) {
						noMessages = true;
						console.log("no messages");

						var querySelectEmpty = "SELECT jnct_dm_users.location FROM jnct_dm_users WHERE fk_users IN ('"+clickedUsernameId+"','"+currentUserId+"') GROUP BY fk_dms having count(*) >1";
						var query = connection.query(querySelectEmpty, function(err, rows, fields){
							if (rows.length > 0){
								var dmContainerId = rows[0].location;
								oSocket.emit("Server sending messages for direct conversation", {"dmContainerId":dmContainerId, "noMessages":noMessages, "clickedUsernameId":clickedUsernameId, "clickedUsername":clickedUsername});
							} else {
								console.log("no messages, not in ls");
							}
						});

					} else {
						noMessages = false;
						oSocket.emit("Server sending messages for direct conversation", {"rows":rows, "clickedUsernameId":clickedUsernameId, "clickedUsername":clickedUsername});
					}
				});
			});
		} else {
			console.log("else");
		}
	});


	//*************************************************************************************
			// SEARCH GLOBAL
	//*************************************************************************************

	oSocket.on("Client searching for global results", function(jData){
		var searchRequest = jData.request;
		var chatResults = [];
		var postResults = [];
		var assignmentResults = [];
		var userResults = [];
		var queryChatMessage = "SELECT * FROM `chat` INNER JOIN users ON users.id = chat.poster INNER JOIN groups ON groups.id = chat.location WHERE `chatMessage` LIKE '%"+searchRequest+"%' OR `poster` LIKE '%"+searchRequest+"%' OR `groupName` LIKE '%"+searchRequest+"%' OR `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%'";
		var queryChatMessage = connection.query(queryChatMessage, function(err, rows, fields){
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				chatResults.push({"location":results.groupName, "poster":results.firstname+" "+results.lastname, "chatMessage":results.chatMessage});
			}
		});

		var queryPosts = "SELECT * FROM `posts` INNER JOIN users ON users.id = posts.poster INNER JOIN groups ON groups.id = posts.location WHERE `postTitle` LIKE '%"+searchRequest+"%' OR `postDescription` LIKE '%"+searchRequest+"%' OR `groupName` LIKE '%"+searchRequest+"%' OR `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%'";
		var queryPosts = connection.query(queryPosts, function(err, rows, fields){
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				postResults.push({"location":results.groupName, "poster":results.firstname+" "+results.lastname, "postTitle":results.postTitle,"postDescription":results.postDescription});
			}
		});

		var queryAssignments = "SELECT * FROM `assignments` INNER JOIN users ON users.id = assignments.poster INNER JOIN groups ON groups.id = assignments.location WHERE `assignmentTitle` LIKE '%"+searchRequest+"%' OR `assignmentDescription` LIKE '%"+searchRequest+"%' OR `groupName` LIKE '%"+searchRequest+"%' OR `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%'";
		var queryAssignments = connection.query(queryAssignments, function(err, rows, fields){
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				assignmentResults.push({"location":results.groupName, "poster":results.firstname+" "+results.lastname, "assignmentTitle":results.assignmentTitle,"assignmentDescription":results.assignmentDescription});
			}
		});

		var queryUsers = "SELECT * FROM `users` WHERE `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%'";
		var queryUsers = connection.query(queryUsers, function(err, rows, fields){
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				userResults.push({"firstname":results.firstname, "lastname":results.lastname});
			}

			oSocket.emit("Server sending global search results", {"chatResults":chatResults, "postResults":postResults, "userResults":userResults, "assignmentResults":assignmentResults});
		});
	});


//*************************************************************************************
		// SEARCH LOCAL
//*************************************************************************************

oSocket.on("Client searching for local results", function(jData){
	var searchRequest = jData.request;
	var searchLocation = jData.location;
	var chatResults = [];
	var postResults = [];
	var assignmentResults = [];
	var userResults = [];
	var queryChatMessage = "SELECT * FROM `chat` INNER JOIN users ON users.id = chat.poster INNER JOIN groups ON groups.id = chat.location WHERE (`chatMessage` LIKE '%"+searchRequest+"%' OR `poster` LIKE '%"+searchRequest+"%' OR `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%') AND (groups.id = '"+searchLocation+"')";

	var queryChatMessage = connection.query(queryChatMessage, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				chatResults.push({"location":results.groupName, "poster":results.firstname+" "+results.lastname, "chatMessage":results.chatMessage});
			}
		}
	});

	var queryPosts = "SELECT * FROM `posts` INNER JOIN users ON users.id = posts.poster INNER JOIN groups ON groups.id = posts.location WHERE (`postTitle` LIKE '%"+searchRequest+"%' OR `postDescription` LIKE '%"+searchRequest+"%' OR `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%') AND (groups.id = '"+searchLocation+"')";
	var queryPosts = connection.query(queryPosts, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				postResults.push({"location":results.groupName, "poster":results.firstname+" "+results.lastname, "postTitle":results.postTitle,"postDescription":results.postDescription});
			}
		}
	});

	var queryAssignments = "SELECT * FROM `assignments` INNER JOIN users ON users.id = assignments.poster INNER JOIN groups ON groups.id = assignments.location WHERE (`assignmentTitle` LIKE '%"+searchRequest+"%' OR `assignmentDescription` LIKE '%"+searchRequest+"%' OR `firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%') AND (groups.id = '"+searchLocation+"')";
	var queryAssignments = connection.query(queryAssignments, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				assignmentResults.push({"location":results.groupName, "poster":results.firstname+" "+results.lastname, "assignmentTitle":results.assignmentTitle,"assignmentDescription":results.assignmentDescription});
			}
		}
	});

	var queryUsers = "SELECT * FROM groups JOIN jnct_groups_users ON groups.id = jnct_groups_users.fk_group JOIN users ON users.id = jnct_groups_users.fk_user WHERE (`firstname` LIKE '%"+searchRequest+"%' OR `lastname` LIKE '%"+searchRequest+"%') AND (groups.id = '"+searchLocation+"')";
	var queryUsers = connection.query(queryUsers, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				userResults.push({"firstname":results.firstname, "lastname":results.lastname});
			}
		}
		oSocket.emit("Server sending local search results", {"chatResults":chatResults, "postResults":postResults, "userResults":userResults, "assignmentResults":assignmentResults});
	});
});


//*************************************************************************************
		//SEARCH (members)
//*************************************************************************************

oSocket.on("Client searching for global members", function(jData){
	var memberResults = [];
	var queryUsers = "SELECT * FROM `users`";
	var queryUsers = connection.query(queryUsers, function(err, rows, fields){
		if (rows){
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				memberResults.push({"firstname":results.firstname, "lastname":results.lastname, "userId":results.id});
			}
		}
		oSocket.emit("Server sending global member results", {"memberResults":memberResults});
	});
});

oSocket.on("Client searching for local members", function(jData){
	var searchLocation = jData.location;
	var memberResults = [];
	var queryUsers = "SELECT * FROM groups JOIN jnct_groups_users ON groups.id = jnct_groups_users.fk_group JOIN users ON users.id = jnct_groups_users.fk_user WHERE groups.id = '"+searchLocation+"'";
	var queryUsers = connection.query(queryUsers, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var results = rows[i];
				memberResults.push({"firstname":results.firstname, "lastname":results.lastname, "location":results.groupName});
			}
		}
		oSocket.emit("Server sending local member results", {"memberResults":memberResults});
	});
});


//*************************************************************************************
		// FILES (global)
//*************************************************************************************

oSocket.on("Client searching for global files", function(jData){

	var fileChatResults = [];
	var filePostResults = [];
	var fileAssignmentResults = [];
	var extension;

	var queryChat = "SELECT * FROM `chat` INNER JOIN users ON users.id = chat.poster INNER JOIN groups ON groups.id = chat.location";
	var queryChat = connection.query(queryChat, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var chatUpload = rows[i].chatUpload;
				extension = chatUpload.split('.').pop();

				if (chatUpload != "" && extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif" && extension != "undefined"){
					fileChatResults.push(chatUpload);
				}
			}
		}
	});

	var queryPost = "SELECT * FROM `posts` INNER JOIN users ON users.id = posts.poster INNER JOIN groups ON groups.id = posts.location";
	var queryPost = connection.query(queryPost, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var postUpload = rows[i].postUpload;
				extension = postUpload.split('.').pop();

				if (postUpload != "" && extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif" && extension != "undefined"){
					filePostResults.push(postUpload);
				}
			}
		}
	});

	var queryPost = "SELECT * FROM `assignments` INNER JOIN users ON users.id = assignments.poster INNER JOIN groups ON groups.id = assignments.location";
	var queryPost = connection.query(queryPost, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var assignmentUpload = rows[i].assignmentUpload;
				extension = assignmentUpload.split('.').pop();

				if (assignmentUpload != "" && extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif" && extension != "undefined"){
					fileAssignmentResults.push(assignmentUpload);
				}
			}
		}
		oSocket.emit("Server sending global files results", {"fileChatResults":fileChatResults, "filePostResults":filePostResults, "fileAssignmentResults":fileAssignmentResults});
	});
});


//*************************************************************************************
		// FILES (local)
//*************************************************************************************

oSocket.on("Client searching for local files", function(jData){
	var locationIndex = jData.location;
	var fileChatResults = [];
	var filePostResults = [];
	var fileAssignmentResults = [];
	var location;

	var queryChat = "SELECT * FROM `chat` INNER JOIN users ON users.id = chat.poster INNER JOIN groups ON groups.id = chat.location WHERE groups.id = '"+locationIndex+"'";
	var queryChat = connection.query(queryChat, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var chatUpload = rows[i].chatUpload;
				location = rows[i].groupName;

				extension = chatUpload.split('.').pop();

				if (chatUpload != "" && extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif" && extension != "undefined"){
					fileChatResults.push({"chatUpload":chatUpload, "location":location});
				}
			}
		}
	});

	var queryPost = "SELECT * FROM `posts` INNER JOIN users ON users.id = posts.poster INNER JOIN groups ON groups.id = posts.location WHERE groups.id = '"+locationIndex+"'";
	var queryPost = connection.query(queryPost, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var postUpload = rows[i].postUpload;
				location = rows[i].groupName;
				extension = postUpload.split('.').pop();

				if (postUpload != "" && extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif" && extension != "undefined"){
					filePostResults.push({"postUpload":postUpload, "location":location});
				}
			}
		}
	});

	var queryPost = "SELECT * FROM `assignments` INNER JOIN users ON users.id = assignments.poster INNER JOIN groups ON groups.id = assignments.location WHERE groups.id = '"+locationIndex+"'";
	var queryPost = connection.query(queryPost, function(err, rows, fields){
		if (rows) {
			if (err) throw err;
			for (var i = 0; i < rows.length; i++) {
				var assignmentUpload = rows[i].assignmentUpload;
				location = rows[i].groupName;
				extension = assignmentUpload.split('.').pop();

				if (assignmentUpload != "" && extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif" && extension != "undefined"){
					fileAssignmentResults.push({"assignmentUpload":assignmentUpload, "location":location});
				}
			}
		}
		oSocket.emit("Server sending local file results", {"fileChatResults":fileChatResults, "filePostResults":filePostResults, "fileAssignmentResults":fileAssignmentResults, "location":location});
	});
});
}); // CONNECTION END

app.get("/signup" , function(req, res){
	res.sendFile( __dirname + "/views/signup.html" );
});

app.get("/" , function(req, res){
	res.sendFile( __dirname + "/views/login.html" );
});

app.get("/dash" , function(req, res){
	res.sendFile( __dirname + "/views/dashboard.html" );
});

app.get('/logout',function(req,res){
	res.sendFile( __dirname + "/views/logout.html" );
});

app.get('/login',function(req,res){
	res.sendFile( __dirname + "/views/login.html" );
});

app.get("/uploads/:fileToGet" , function(req, res){
	var sFileToGet = req.params.fileToGet;
	res.sendFile( __dirname + "/uploads/"+sFileToGet );
});

// listen on port 80 or any other if needed
server.listen( 3334, function(){
	console.log("SERVER RUNNING");
});












