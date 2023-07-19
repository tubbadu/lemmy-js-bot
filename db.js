import sqlite3 from "sqlite3"

let db;

function db_get(associations, table) {
	return new Promise((resolve, reject) => {
		// Extract the keys and values from the associations object
		const keys = [];
		const values = [];
		Object.entries(associations).forEach(([key, value]) => {
			keys.push(key);
			values.push(value);
		});
		// Construct the WHERE clause for the query dynamically
		const whereClause = keys.map(key => `${key} = ?`).join(' AND ');
		// Construct the SELECT query
		const query = `SELECT * FROM ${table} WHERE ${whereClause}`;

		// Execute the query with the provided values
		db.get(query, values, (error, row) => {
			if (error) {
				reject(error);
			} else {
				resolve(row);
			}
		});
	});
}

function db_check(keys, table, callbackYes, callbackNo, callbackFail){
	return new Promise((resolve, reject) => {
		db_get(keys, table).then((row) => {
			if(row){
				resolve(true);
				if(callbackYes) callbackYes(value);
			} else {
				resolve(false);
				if(callbackNo) callbackNo(value);
			}
		}).catch((err) => {
			resolve(err);
			if(callbackFail) callbackFail(value, err);
		})
	})
}

function db_insert(associations, table) {
	return new Promise((resolve, reject) => {
		// Extract the keys and values from the data object
		const keys = [];
		const values = [];
		Object.entries(associations).forEach(([key, value]) => {
			keys.push(key);
			values.push(value);
		});

		// Construct the placeholders for the query
		const placeholders = values.map(() => '?').join(', ');

		// Construct the INSERT query dynamically
		const query = `INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;

		// Execute the query with the provided values
		db.run(query, values, function (error) {
			if (error) {
				reject(error);
			} else {
				resolve(this.lastID);
			}
		});
	});
}

function db_remove(associations, table) {
	return new Promise((resolve, reject) => {
		// Extract the keys and values from the associations object
		const keys = [];
		const values = [];
		Object.entries(associations).forEach(([key, value]) => {
			keys.push(key);
			values.push(value);
		});
		// Construct the WHERE clause for the query dynamically
		const whereClause = keys.map(key => `${key} = ?`).join(' AND ');
		// Construct the SELECT query
		const query = `DELETE FROM ${table} WHERE ${whereClause}`;

		// Execute the query with the provided values
		db.get(query, values, (error, row) => {
			if (error) {
				reject(error);
			} else {
				resolve(row);
			}
		});
	});
}


function db_createTable(table, keys, primaryKey){
	let queryKeys = '';
	for (const [key, type] of Object.entries(keys)) {
		queryKeys += `${key} ${type}, `;
	}
	queryKeys += `PRIMARY KEY(${primaryKey.toString()})`;
	let query = `CREATE TABLE IF NOT EXISTS ${table} (${queryKeys})`;
	db.run(query);
}

function db_init(filename){
	db = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
		if (err) {
			return console.error(err.message);
		}
		console.log('Connected to the SQlite database file.');
	});
}

function db_close(){
	db.close();
}

const Db = {
	init: db_init,
	close: db_close,
	check: db_check,
	insert: db_insert,
	remove: db_remove,
	get: db_get,
	createTable: db_createTable
}

export default Db

process.on('SIGINT', () => {
	// Custom code to execute before closing
	console.log('\nReceived SIGINT signal. Closing database...');
	// Perform any necessary cleanup tasks, save state, etc.
	db.close();

	// Exit the process
	process.exit(0);
});