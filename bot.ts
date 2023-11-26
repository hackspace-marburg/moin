import * as fs from 'fs';
import * as yaml from 'js-yaml';

import irc from 'irc';
import * as sqlite3 from 'sqlite3';

// Read YAML file
const fileContents = fs.readFileSync('./config.yml', 'utf8');

// Parse YAML content into a plain JavaScript object
const config = yaml.load(fileContents);

// Specify the path to the SQLite database file
const dbFilePath = './data/database.db';

// Create the SQLite database connection
const db = new sqlite3.Database(dbFilePath);

// Create a table to store catchphrase events
db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    channel TEXT,
    event_type TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create a table to store opt-in and opt-out preferences
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    channel TEXT,
    opted_in BOOLEAN DEFAULT false,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// IRC bot configuration
const ircConfig: irc.Config = {
  channels: config.irc.channels,
  server: config.irc.server,
  port: config.irc.port,
  secure: config.irc.tls,
  userName: config.irc.username,
  realName: config.irc.username,
  autoConnect: true,
};

const catchphrases = config.moin.variations;

const irc = require('irc');

// Create the IRC client
const client = new irc.Client(ircConfig.server, ircConfig.userName, ircConfig);

// Listen for the 'raw' event to log raw IRC messages
// client.addListener('raw', (message) => {
//  console.log('Raw IRC message:', message);
// });

// Dictionary to store users who opted-in
const optedInUsers: Record<string, boolean> = {};

// Register event handlers
client.addListener('registered', () => {
  // Identify with NickServ after the bot has registered on the server
  client.say('NickServ', `IDENTIFY ${config.irc.username} ${config.irc.passphrase}`);
});

// Register event handlers
client.addListener('message', async (from, to, message) => {
  // Convert the message to lowercase for case-insensitive matching
  const lowercaseMessage = message.toLowerCase();


  // Check if the message contains any of the catchphrases
  const catchphraseUsed = catchphrases.some((catchphrase) =>
    lowercaseMessage.includes(catchphrase)
  );

  if (to.startsWith('#')) {
    const catchphraseUsed = catchphrases.includes(lowercaseMessage);

    // Check if the user has opted in and a catchphrase is used
    if (catchphraseUsed && (await hasUserOptedIn(from, to) || config.moin.allowedUsers.includes(from))) {
      // Log the catchphrase event to the database
      logEvent(from, to, lowercaseMessage);
    }
  
    // Check if the message is the opt-in command
    if (lowercaseMessage === '!ja') {
      optInUser(from, to);
      client.notice(to, `${from} sagt zum moin ja.`);
    }
  
    // Check if the message is the opt-out command
    if (lowercaseMessage === '!nein') {
      optOutUser(from, to);
      client.notice(to, `${from} sagt zum moin nein.`);
    }

    if (lowercaseMessage === '!moin') {
      // Query the database to get the count of "moin" events for the channel
      const count = await getChannelCatchphraseCount(to);
      client.notice(to, `Bisher gab es ${count} verschiedene moins.`);
    }

    if (lowercaseMessage.startsWith('!zahl')) {
      const parts = message.split(' ');
      const nickToCount = parts[1] || from;

      const userCount = await getUserCatchphraseCount(to, nickToCount);
      if (userCount > 0) {
        client.notice(to, `${nickToCount} hat ${userCount} Mal moin gesagt.`);
      } else {
        client.notice(to, `Der Nick ist nicht bekannt.`);
      }
    }
  }
});

// Function to log events to the database
function logEvent(user: string, channel: string, eventType: string) {
  db.run(
    'INSERT INTO events (user, channel, event_type) VALUES (?, ?, ?)',
    [user, channel, eventType],
    (err) => {
      if (err) {
        console.error('Error logging event:', err.message);
      }
    }
  );
}

// Function to check if a user has opted in
function hasUserOptedIn(user: string, channel: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    const query = 'SELECT opted_in FROM users WHERE user = ? AND channel = ? ORDER BY timestamp DESC LIMIT 1';
    db.get(query, [user, channel], (err, row: { opted_in?: boolean }) => {
      if (err) {
        console.error('Error checking user preference:', err.message);
        reject(err);
        return;
      }
      resolve(!!row?.opted_in);
    });
  });
}

// Function to opt-in a user
function optInUser(user: string, channel: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const query = 'INSERT OR REPLACE INTO users (user, channel, opted_in) VALUES (?, ?, true)';
    db.run(query, [user, channel], (err) => {
      if (err) {
        console.error('Error opting in user:', err.message);
        reject(err);
        return;
      }
      optedInUsers[user] = true;
      resolve();
    });
  });
}

// Function to opt-out a user
function optOutUser(user: string, channel: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const query = 'INSERT OR REPLACE INTO users (user, channel, opted_in) VALUES (?, ?, false)';
    db.run(query, [user, channel], (err) => {
      if (err) {
        console.error('Error opting out user:', err.message);
        reject(err);
        return;
      }
      delete optedInUsers[user];
      resolve();
    });
  });
}

async function getChannelCatchphraseCount(channel: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const query = 'SELECT COUNT(*) as count FROM events WHERE channel = ?';
    db.get(query, [channel], (err, row: { count?: number }) => {
      if (err) {
        console.error('Error getting catchphrase count:', err.message);
        reject(err);
        return;
      }
      resolve(row && typeof row.count === 'number' ? row.count : 0);
    });
  });
}

// Function to get the count of catchphrase events for a user (defaults to the sender)
async function getUserCatchphraseCount(channel: string, user?: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const query = 'SELECT COUNT(*) as count FROM events WHERE channel = ? AND user COLLATE NOCASE = ?';
    const params = user ? [channel, user] : [channel, user || ''];
    db.get(query, params, (err, row: { count?: number }) => {
      if (err) {
        console.error('Error getting catchphrase count:', err.message);
        reject(err);
        return;
      }
      // TypeScript now knows the structure of the result
      resolve(row && typeof row.count === 'number' ? row.count : 0);
    });
  });
}

// Handle errors
client.addListener('error', (message) => {
  console.error('Error:', message);
});

// Handle disconnects
client.addListener('disconnect', () => {
  console.log('Disconnected. Reconnecting...');
  client.connect();
});
