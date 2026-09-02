import mongoose from "mongoose";

const connectToDB = async (uri) => {
  await mongoose.connect(uri);

  // logger.info({host: connection.host }, 'MongoDB Connected');
  console.log('MongoDB connection established');
  return mongoose.connection;
  
}

export default connectToDB;
