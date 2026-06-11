const app = require('./app');
const config = require('./config');
const { connectDB } = require('./config/db');

async function startServer() {
  // Connect database
  await connectDB();

  // Listen
  app.listen(config.PORT, () => {
    console.log(`Server running in environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Server listening on port ${config.PORT}`);
  });
}

startServer().catch(err => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
