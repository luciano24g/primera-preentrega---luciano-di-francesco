const express = require('express');
const { engine } = require('express-handlebars');
const http = require('http');
const path = require('path');
const dbConnection = require('./db.js');  // Importa la conexión de MongoDB desde src/db.js
const viewsRouter = require('./routes/viewsRouter');
const { router: productsRouter } = require('./routes/productRouter');
const productManagerMongo = require('./dao/ProductManagerMongo.js');
const Message = require('./dao/models/Message');  // Asegúrate de que esta ruta sea correcta
const socketIo = require('socket.io');

const PORT = 8080;
const app = express();
const httpServer = http.createServer(app);

// Middleware para parsear el cuerpo de la solicitud en formato JSON
app.use(express.json());

// Configuración de Handlebars
app.engine('.handlebars', engine({
  runtimeOptions: {
    allowProtoMethodsByDefault: true,
    allowProtoPropertiesByDefault: true,
  },
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

// Agrega el enrutador de productos bajo '/api'
app.use('/api', productsRouter);
app.use('/', viewsRouter);  // Asegúrate de que esta ruta maneje la vista de productos

// Configuración de Socket.IO
const io = socketIo(httpServer);
app.set('socketio', io);

io.on('connection', (socket) => {
  console.log('New client connected');
  const productList = productManagerMongo.getProducts();

  socket.emit('actualizarLista', productList);

  socket.on('chatMessage', async (data) => {
    try {
        const newMessage = {
            user: data.user,
            message: data.message
        };

        // Guardar el mensaje en MongoDB
        await Message.create(newMessage);

        // Obtener todos los mensajes y enviarlos a todos los clientes
        const messages = await Message.find();
        io.emit('chatMessages-update', messages);

    } catch (error) {
        console.error('Error al procesar el mensaje de chat:', error.message);
    }
  });
});

// Verificar si la conexión a MongoDB está activa antes de iniciar el servidor
dbConnection.once('open', () => {
  console.log(`Conexión a MongoDB activa. Servidor funcionando en el puerto: ${PORT}`);
});

dbConnection.on('error', (error) => {
  console.error('Error en conexión a MongoDB:', error.message);
});

// Iniciar el servidor HTTP
httpServer.listen(PORT, () => {
  console.log(`Servidor funcionando en el puerto: ${PORT}`);
});
