const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/db.json');

function readDB() {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

exports.createUser = (username, password, role = 'user') => {
    const db = readDB();
    const users = db.users || [];
    const newUser = { id: users.length + 1, username, password, role };
    users.push(newUser);
    db.users = users;
    writeDB(db);
    return newUser;
};

exports.findUserByUsername = (username) => {
    const db = readDB();
    return db.users.find(u => u.username === username);
};

exports.getAllUsers = () => {
    const db = readDB();
    return db.users;
};