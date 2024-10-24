require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, Databases } = require('node-appwrite'); // Import Appwrite

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const client = new Client();
const databases = new Databases(client);

// Initialize Appwrite using environment variables
client
  .setEndpoint(process.env.APPWRITE_ENDPOINT) // Appwrite Endpoint
  .setProject(process.env.APPWRITE_PROJECT_ID) // Appwrite Project ID
  .setKey(process.env.APPWRITE_API_KEY); // Appwrite API Key

const users = {};

// Save chat message to Appwrite database
const saveMessageToDatabase = async (data) => {
  try {
    const response = await databases.createDocument(
      process.env.APPWRITE_DATABASE_ID, // Appwrite Database ID
      process.env.APPWRITE_COLLECTION_ID, // Appwrite Collection ID
      'unique()', // Unique document ID
      data
    );
    console.log('Message saved:', response);
  } catch (error) {
    console.error('Error saving message:', error);
  }
};

// Fetch messages from Appwrite database
const fetchMessagesFromDatabase = async () => {
  try {
    const response = await databases.listDocuments(
      process.env.APPWRITE_DATABASE_ID, // Appwrite Database ID
      process.env.APPWRITE_COLLECTION_ID // Appwrite Collection ID
    );
    return response.documents;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

io.on('connection', async (socket) => {
  console.log('A user connected:', socket.id);

  // Send existing messages from the database to the newly connected user
  const previousMessages = await fetchMessagesFromDatabase();
  socket.emit('previousMessages', previousMessages);

  socket.on('setUsername', (username) => {
    users[socket.id] = username;
    const joinMessage = { username: 'System', message: `${username} has joined the chat`, time: new Date().toLocaleTimeString() };
    
    io.emit('chatMessage', joinMessage);
    io.emit('userList', Object.values(users));

    saveMessageToDatabase(joinMessage); // Save system message to the database
  });

  socket.on('chatMessage', (data) => {
    io.emit('chatMessage', data);
    saveMessageToDatabase(data); // Save user message to the database
  });

  socket.on('refreshMessages', async () => {
    const messages = await fetchMessagesFromDatabase();
    socket.emit('previousMessages', messages); // Send the latest messages to the client
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    delete users[socket.id];

    const leaveMessage = { username: 'System', message: `${username} has left the chat`, time: new Date().toLocaleTimeString() };
    io.emit('chatMessage', leaveMessage);
    io.emit('userList', Object.values(users));

    saveMessageToDatabase(leaveMessage); // Save system message to the database
  });
});

const PORT = 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
