import mongoose from "mongoose";
import log from "./logger.js";

const connectToDB = async (uri) => {
  await mongoose.connect(uri);

  log.info(
    {
      database: {
        // server where MongoDB is running
        host: mongoose.connection.host,

        // database name you're connected to
        name: mongoose.connection.name
      },
    },
    'MongoDB connection established'
  );

  return mongoose.connection;
}

export default connectToDB;
