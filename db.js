import sqlite3 from "sqlite3"

function ifCommunitySubscribed(community_id, callbackSuccess, callbackFail) {
	db.get(`SELECT community_id FROM subscribed WHERE community_id = ?`, community_id, (err, row) => {
		if (err) {
			console.error(err);
			return;
		}

		if (row) {
			if(callbackSuccess) callbackSuccess(community_id); // Value exists
		} else {
			if(callbackFail) callbackFail(community_id)
		}
	});
}

async function isKeyPresent(key, value, table) {
	/*let isPresent = false;
	let x = await db.get(`SELECT ${key} FROM ${table} WHERE ${key} = ?`, value);
	console.log(x, x.row, x.err, x[key])
	return isPresent*/
	let data = await getData(key, value, table);
	if(data) return true;
	else return false;
}


function getData(key, value, table) {
	return new Promise((resolve, reject) => {
		db.get(`SELECT ${key} FROM ${table} WHERE ${key} = ?`, value, (error, row) => {
			if (error) {
				reject(error);
			} else {
				resolve(row);
			}
		});
	});
}

async function addKey(key, value, table) {
	let success = false;
	const query = `INSERT OR IGNORE INTO ${table} (${key})
		VALUES (?)`;

	db.run(query, value, function (err) {
		if (err) {
			console.error(err);
			return;
		}

		if (this.changes > 0) {
			success = true;
		}
	});
	return success;
}

function subscribeCommunity(community_id, callbackSuccess, callbackFail) {
	const query = `INSERT OR IGNORE INTO subscribed (community_id)
		VALUES (?)`;

	db.run(query, community_id, function (err) {
		if (err) {
			console.error(err);
			return;
		}

		if (this.changes > 0) {
			console.log(`Value ${community_id} inserted into the database.`);
			if(callbackSuccess) callbackSuccess(community_id);
		} else {
			console.log(`Value ${community_id} already exists in the database.`);
			if(callbackFail) callbackFail(community_id);
		}
	});
}

function unsubscribeCommunity(community_id, callbackSuccess, callbackFail) {
	const query = `DELETE FROM subscribed
		WHERE community_id = ?`;

	db.run(query, community_id, function (err) {
		if (err) {
			console.error(err);
			return;
		}

		if (this.changes > 0) {
			console.log(`Value ${community_id} removed from the database.`);
			if(callbackSuccess) callbackSuccess(community_id);
		} else {
			console.log(`Value ${community_id} is not present in the database.`);
			if(callbackFail) callbackFail(community_id);
		}
	});
}

function db_init(){
	db.run(`CREATE TABLE IF NOT EXISTS subscribed_communities (
		community_id int,
		PRIMARY KEY(community_id)
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS processedComments (
		id int,
		PRIMARY KEY(id)
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS processedPosts(
		id int,
		PRIMARY KEY(id)
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS processedMentions(
		id int,
		PRIMARY KEY(id)
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS processedPrivateMessages(
		id int,
		PRIMARY KEY(id)
	)`);
	db.run(`CREATE TABLE IF NOT EXISTS reminders (
		request_comment_id INT,
		time CHAR(26),
		PRIMARY KEY(request_comment_id)
	)`);
}



function db_close(){
	db.close();
}

let db = new sqlite3.Database('./data.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
	if (err) {
		return console.error(err.message);
	}
	console.log('Connected to the SQlite database file.');
});

db_init();

const Db = {
	init: db_init,
	//subscribeCommunity: subscribe,
	//unsubscribeCommunity: unsubscribe,
	//ifCommunitySubscribed: ifSubscribed,
	close: db_close,
	isKeyPresent: isKeyPresent,
	addKey: addKey,
}

export default Db


process.on('SIGINT', () => {
	// Custom code to execute before closing
	console.log('\nReceived SIGINT signal. Cleaning up...');
	// Perform any necessary cleanup tasks, save state, etc.
	db.close();

	// Exit the process
	process.exit(0);
});