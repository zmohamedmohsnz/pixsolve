# this file says: use Node.js, copy my project, install dependencies, then start the app

# start from an existing Docker image
FROM node:22-bookworm-slim

# sets `/app` as the working directory inside the container
# commands after this line, operate from `/app`.
WORKDIR /app

# creates environment variables inside the container
ENV NODE_ENV=production
ENV PORT=3000

# copy these files into `/app`
COPY --chown=node:node package.json package-lock.json ./

# runs a command while building the image
# this command is installing dependencies
RUN npm ci --omit=dev --no-audit --no-fund

# copies local `/src` into `/app/src`
COPY --chown=node:node src ./src

# from now, commands run as `node` user instead of `root` user
USER node

# documents that your app expects to listen on port `3000`
EXPOSE 3000

# sets the default command when container starts `npm start`
CMD ["npm", "start"]