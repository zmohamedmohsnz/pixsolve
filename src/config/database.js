import mongoose from "mongoose";
import logger from "./logger.js";

const connectToDB = async (uri) => {
  await mongoose.connect(uri);

  logger.info(
    {
      database: {
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
    },
    'MongoDB connection established'
  );

  return mongoose.connection;
}

export default connectToDB;
